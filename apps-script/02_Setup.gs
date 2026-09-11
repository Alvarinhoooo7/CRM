/**
 * ============================================================================
 *  02_Setup.gs  ·  Construccion automatica del libro completo.
 * ============================================================================
 *  instalarCRM() es el unico punto de entrada que el usuario debe ejecutar.
 *  Crea las 22 hojas, aplica formatos, validaciones, formato condicional,
 *  siembra CONFIG y los datos maestros, y deja el sistema operativo.
 *  Es idempotente: se puede volver a ejecutar sin perder datos transaccionales.
 * ============================================================================
 */

/** PUNTO DE ENTRADA PRINCIPAL. Ejecutar una vez desde el editor. */
function instalarCRM() {
  var ss = libro();
  ss.setSpreadsheetTimeZone(APP.TZ);
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());

  var creadas = [];
  ORDEN_HOJAS.forEach(function (nombre) {
    if (construirHoja(ss, nombre)) creadas.push(nombre);
  });

  sembrarConfig();
  var secretoGenerado = asegurarWebhookSecret();
  sembrarMaestros();      // 03_Seed.gs
  simplificarConfiguracion();
  aplicarVistaSimple();
  ordenarHojas(ss);
  eliminarHojaPorDefecto(ss);
  crearRangosNombrados(ss);
  log('INFO', 'Setup', 'Instalacion completada. Hojas creadas: ' + creadas.length +
      (secretoGenerado ? '. Se genero WEBHOOK_SECRET.' : '.'));

  var msg = 'CRM instalado.\n\n' +
            'Hojas nuevas: ' + (creadas.length ? creadas.join(', ') : 'ninguna (ya existian)') + '\n\n' +
            'Siguiente paso:\n' +
            '1. Menu CRM > Abrir presentacion.\n' +
            '2. Menu CRM > Ver token para UI / AppSheet.\n' +
            '3. Revise direcciones en Maps y pulse Planificar / actualizar presupuesto.';
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
  return msg;
}

/** Reinstalacion completa: BORRA TODO. Pide confirmacion. */
function reinstalarDesdeCero() {
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch (e) { ui = null; }
  if (ui) {
    var r = ui.alert('Reinstalar desde cero',
      'Se ELIMINARAN todas las hojas y sus datos. Esta accion no se puede deshacer.\n\nContinuar?',
      ui.ButtonSet.YES_NO);
    if (r !== ui.Button.YES) return 'Cancelado.';
  }
  var ss = libro();
  var temporal = ss.insertSheet('__tmp__' + Date.now());
  ss.getSheets().forEach(function (h) {
    if (h.getSheetId() !== temporal.getSheetId()) ss.deleteSheet(h);
  });
  _configCache = null;
  var res = instalarCRM();
  ss.deleteSheet(ss.getSheetByName(temporal.getName()));
  return res;
}

/**
 * Crea o actualiza una hoja segun SCHEMA.
 * @return {boolean} true si la hoja fue creada en esta ejecucion.
 */
function construirHoja(ss, nombre) {
  var def = SCHEMA[nombre];
  if (!def) return false;

  var hoja = ss.getSheetByName(nombre);
  var nueva = false;
  if (!hoja) { hoja = ss.insertSheet(nombre); nueva = true; }

  var encabezados = def.cols.map(function (c) { return c.n; });
  var nCols = encabezados.length;

  // --- Encabezado -------------------------------------------------------
  hoja.getRange(1, 1, 1, nCols)
      .setValues([encabezados])
      .setFontWeight('bold')
      .setFontColor('#ffffff')
      .setBackground(def.color || '#37474f')
      .setVerticalAlignment('middle')
      .setWrap(true);
  hoja.setRowHeight(1, 34);
  hoja.setFrozenRows(def.congelar || 1);
  if (def.congelarCols) hoja.setFrozenColumns(def.congelarCols);

  // Elimina columnas sobrantes si el esquema se redujo.
  if (hoja.getMaxColumns() > nCols) {
    hoja.deleteColumns(nCols + 1, hoja.getMaxColumns() - nCols);
  }
  if (hoja.getMaxColumns() < nCols) {
    hoja.insertColumnsAfter(hoja.getMaxColumns(), nCols - hoja.getMaxColumns());
  }

  // --- Formato por columna ---------------------------------------------
  var ultimaFila = Math.max(hoja.getMaxRows(), 1000);
  if (hoja.getMaxRows() < 1000) hoja.insertRowsAfter(hoja.getMaxRows(), 1000 - hoja.getMaxRows());

  def.cols.forEach(function (c, i) {
    var col = i + 1;
    hoja.setColumnWidth(col, c.w || 120);
    var rango = hoja.getRange(2, col, ultimaFila - 1, 1);

    switch (c.t) {
      case 'money':
        rango.setNumberFormat('$#,##0;[RED]-$#,##0').setHorizontalAlignment('right');
        break;
      case 'number':
        rango.setNumberFormat('#,##0.##').setHorizontalAlignment('right');
        break;
      case 'date':
        rango.setNumberFormat('dd-mm-yyyy').setHorizontalAlignment('center');
        break;
      case 'datetime':
        rango.setNumberFormat('dd-mm-yyyy hh:mm').setHorizontalAlignment('center');
        break;
      case 'time':
        rango.setNumberFormat('hh:mm').setHorizontalAlignment('center');
        break;
      case 'list':
        if (c.l && LISTAS[c.l]) {
          var regla = SpreadsheetApp.newDataValidation()
            .requireValueInList(LISTAS[c.l], true)
            .setAllowInvalid(false)
            .setHelpText('Valores validos: ' + LISTAS[c.l].join(', '))
            .build();
          rango.setDataValidation(regla);
          rango.setHorizontalAlignment('center');
        }
        break;
      case 'url':
        rango.setFontColor('#1155cc');
        break;
      default:
        rango.setNumberFormat('@');
    }
  });

  // --- Bandas y formato condicional -------------------------------------
  aplicarFormatoCondicional(hoja, nombre, def, ultimaFila);

  hoja.setTabColor(def.color || '#37474f');
  return nueva;
}

/** Reglas de color por hoja: semaforos de estado, desvios, etc. */
function aplicarFormatoCondicional(hoja, nombre, def, ultimaFila) {
  var reglas = [];
  var idx = {};
  def.cols.forEach(function (c, i) { idx[c.n] = i + 1; });

  function letra(col) {
    var s = '', n = col;
    while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - m) / 26); }
    return s;
  }
  function reglaTexto(colNombre, texto, fondo, color) {
    if (!idx[colNombre]) return;
    var r = hoja.getRange(2, idx[colNombre], ultimaFila - 1, 1);
    reglas.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(texto).setBackground(fondo).setFontColor(color || '#000000')
      .setRanges([r]).build());
  }
  function reglaFormula(colNombre, formula, fondo) {
    if (!idx[colNombre]) return;
    var r = hoja.getRange(2, idx[colNombre], ultimaFila - 1, 1);
    reglas.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(formula).setBackground(fondo)
      .setRanges([r]).build());
  }

  if (nombre === SH.OT) {
    reglaTexto('ESTADO', 'COMPLETADA',   '#d9ead3');
    reglaTexto('ESTADO', 'EN_EJECUCION', '#fff2cc');
    reglaTexto('ESTADO', 'EN_RUTA',      '#cfe2f3');
    reglaTexto('ESTADO', 'EN_SITIO',     '#d0e0e3');
    reglaTexto('ESTADO', 'NO_REALIZADA', '#f4cccc');
    reglaTexto('ESTADO', 'REPROGRAMADA', '#fce5cd');
    reglaFormula('DESVIO_MIN', '=AND($' + letra(idx.DESVIO_MIN) + '2<>"",$' + letra(idx.DESVIO_MIN) + '2>30)', '#f4cccc');
    reglaFormula('DESVIO_MIN', '=AND($' + letra(idx.DESVIO_MIN) + '2<>"",$' + letra(idx.DESVIO_MIN) + '2<-15)', '#d9ead3');
  }
  if (nombre === SH.GASTOS) {
    reglaTexto('ESTADO', 'APROBADO',   '#d9ead3');
    reglaTexto('ESTADO', 'RECHAZADO',  '#f4cccc');
    reglaTexto('ESTADO', 'ENVIADO',    '#fff2cc');
    reglaTexto('ESTADO', 'REEMBOLSADO','#cfe2f3');
    reglaFormula('DESVIO_CLP', '=AND($' + letra(idx.DESVIO_CLP) + '2<>"",$' + letra(idx.DESVIO_CLP) + '2>0)', '#f4cccc');
  }
  if (nombre === SH.VIATICOS) {
    reglaTexto('ESTADO', 'TRANSFERIDO', '#d9ead3');
    reglaTexto('ESTADO', 'CALCULADO',   '#fff2cc');
    reglaTexto('ESTADO', 'CERRADO',     '#efefef');
  }
  if (nombre === SH.VEHICULOS) {
    reglaTexto('ESTADO', 'DISPONIBLE',     '#d9ead3');
    reglaTexto('ESTADO', 'EN_RUTA',        '#fff2cc');
    reglaTexto('ESTADO', 'MANTENCION',     '#fce5cd');
    reglaTexto('ESTADO', 'FUERA_SERVICIO', '#f4cccc');
  }
  if (nombre === SH.KPI_TECNICO) {
    reglaTexto('SEMAFORO', 'VERDE',    '#d9ead3');
    reglaTexto('SEMAFORO', 'AMARILLO', '#fff2cc');
    reglaTexto('SEMAFORO', 'ROJO',     '#f4cccc');
    if (idx.PCT_UTILIZACION) {
      hoja.getRange(2, idx.PCT_UTILIZACION, ultimaFila - 1, 1).setNumberFormat('0.0%');
    }
    ['PCT_TIEMPO_VIAJE', 'MARGEN_PCT', 'CUMPLIMIENTO_SLA_PCT', 'PUNTUALIDAD_PCT'].forEach(function (k) {
      if (idx[k]) hoja.getRange(2, idx[k], ultimaFila - 1, 1).setNumberFormat('0.0%');
    });
  }
  if (nombre === SH.KPI_SEMANAL) {
    reglaTexto('CUMPLE', 'SI', '#d9ead3');
    reglaTexto('CUMPLE', 'NO', '#f4cccc');
  }
  if (nombre === SH.RENTABILIDAD) {
    if (idx.MARGEN_PCT) {
      hoja.getRange(2, idx.MARGEN_PCT, ultimaFila - 1, 1).setNumberFormat('0.0%');
      reglaFormula('MARGEN_PCT', '=AND($' + letra(idx.MARGEN_PCT) + '2<>"",$' + letra(idx.MARGEN_PCT) + '2<0)', '#f4cccc');
      reglaFormula('MARGEN_PCT', '=$' + letra(idx.MARGEN_PCT) + '2>=0.35', '#d9ead3');
    }
  }
  if (nombre === SH.ITINERARIO) {
    reglaTexto('MODO', 'AVION',       '#cfe2f3');
    reglaTexto('MODO', 'CAMIONETA',   '#d9ead3');
    reglaTexto('MODO', 'BUS',         '#fff2cc');
    reglaTexto('MODO', 'METRO_MICRO', '#d0e0e3');
    reglaTexto('LLEGADA_NOCTURNA', 'SI', '#fce5cd');
  }
  if (nombre === SH.LOG) {
    reglaTexto('NIVEL', 'ERROR', '#f4cccc');
    reglaTexto('NIVEL', 'WARN',  '#fff2cc');
  }
  if (nombre === SH.CONFIG) {
    reglaTexto('TIPO', 'secret', '#fce5cd');
  }

  if (reglas.length) hoja.setConditionalFormatRules(reglas);
}

/** Siembra la hoja CONFIG con los valores por defecto que falten. */
function sembrarConfig() {
  var hoja = libro().getSheetByName(SH.CONFIG);
  var existentes = {};
  var datos = hoja.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (datos[i][0]) existentes[String(datos[i][0]).trim()] = true;
  }
  var nuevas = CONFIG_DEFAULTS.filter(function (d) { return CONFIG_BASICA.indexOf(d[0]) !== -1 && !existentes[d[0]]; });
  if (nuevas.length) {
    hoja.getRange(hoja.getLastRow() + 1, 1, nuevas.length, 6).setValues(nuevas);
  }
  // La semana por defecto es la semana en curso.
  _configCache = null;
  if (!cfg('SEMANA_PLANIFICACION', '')) setCfg('SEMANA_PLANIFICACION', semanaISO(new Date()));
  _configCache = null;
  return nuevas.length;
}

function ordenarHojas(ss) {
  ORDEN_HOJAS.forEach(function (nombre, i) {
    var h = ss.getSheetByName(nombre);
    if (h) { ss.setActiveSheet(h); ss.moveActiveSheet(i + 1); }
  });
  ss.setActiveSheet(ss.getSheetByName(SH.CONFIG));
}

function eliminarHojaPorDefecto(ss) {
  ['Hoja 1', 'Hoja1', 'Sheet1', 'Hoja de cálculo 1'].forEach(function (n) {
    var h = ss.getSheetByName(n);
    if (h && !SCHEMA[n] && ss.getSheets().length > 1) {
      try { ss.deleteSheet(h); } catch (e) {}
    }
  });
}

/** Rangos nombrados utiles para formulas del usuario y para AppSheet. */
function crearRangosNombrados(ss) {
  var pares = [
    ['ListaTecnicos', SH.TECNICOS, 'A2:B'],
    ['ListaDestinos', SH.DESTINOS, 'A2:D'],
    ['ListaVehiculos', SH.VEHICULOS, 'A2:C'],
    ['TablaConfig', SH.CONFIG, 'A2:B']
  ];
  pares.forEach(function (p) {
    try {
      var h = ss.getSheetByName(p[1]);
      if (!h) return;
      ss.setNamedRange(p[0], h.getRange(p[2] + h.getMaxRows()));
    } catch (e) {}
  });
}

/** Escribe una linea en la bitacora. */
function log(nivel, modulo, mensaje) {
  try {
    var hoja = libro().getSheetByName(SH.LOG);
    if (!hoja) return;
    var usuario = '';
    try { usuario = Session.getActiveUser().getEmail() || 'sistema'; } catch (e) { usuario = 'sistema'; }
    hoja.appendRow([new Date(), nivel, modulo, String(mensaje).substring(0, 2000), usuario]);
  } catch (e) {
    Logger.log('[' + nivel + '] ' + modulo + ': ' + mensaje);
  }
}
