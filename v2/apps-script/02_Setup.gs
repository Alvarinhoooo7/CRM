/**
 * ============================================================================
 *  SERVICIO TECNICO EN RUTA · v2 · 02_Setup.gs
 *  Construccion de las hojas a partir del esquema. Idempotente.
 * ============================================================================
 *
 *  Nada de lo que hay aqui inventa estructura: todo sale de 00_Esquema.gs.
 *  Si se agrega un parametro alla, aparece aca solo, con su named range, su
 *  formato y su validacion. Si se agrega un tecnico a la nomina, PLAN gana su
 *  columna de casilla sin tocar una linea de este archivo.
 *
 *  IDEMPOTENTE: se puede correr las veces que sea. Si una hoja ya tiene datos,
 *  pregunta antes de sobrescribir. Las hojas de sistema se recrean sin avisar
 *  porque son cache, no datos de trabajo.
 * ============================================================================
 */

/* ==========================================================================
 * A. PUNTO DE ENTRADA
 * ========================================================================== */

/**
 * Crea o restaura las tres hojas de entrada y las dos de sistema.
 * @param {boolean} forzar  true para sobrescribir sin preguntar
 * @return {{creadas:Array, conservadas:Array, mensajes:Array}}
 */
function instalarSistema_(forzar) {
  var libro = obtenerLibro_();
  var reporte = { creadas: [], conservadas: [], mensajes: [] };

  libro.setSpreadsheetTimeZone(APP.ZONA_HORARIA);
  libro.setSpreadsheetLocale(APP.LOCALE);

  construirHoja_(libro, HOJAS.CONFIG.nombre, forzar, reporte, construirCONFIG_);
  construirHoja_(libro, HOJAS.DESTINOS.nombre, forzar, reporte, construirDESTINOS_);
  construirHoja_(libro, HOJAS.PLAN.nombre, forzar, reporte, construirPLAN_);

  construirHojaSistema_(libro, HOJAS.RUTAS.nombre, ESQUEMA_RUTAS.columnas, reporte);
  construirHojaSistema_(libro, HOJAS.BITACORA.nombre,
    ['Fecha', 'Accion', 'Usuario', 'Detalle'], reporte);

  ordenarHojas_(libro);
  eliminarHojaPorDefecto_(libro);

  registrarBitacora_(libro, 'INSTALACION',
    'Creadas: ' + (reporte.creadas.join(', ') || 'ninguna') +
    '. Conservadas: ' + (reporte.conservadas.join(', ') || 'ninguna') + '.');

  return reporte;
}

/** Envoltorio idempotente: decide si construir o conservar. */
function construirHoja_(libro, nombre, forzar, reporte, constructor) {
  var hoja = libro.getSheetByName(nombre);

  if (hoja && !forzar && hoja.getLastRow() > 1) {
    reporte.conservadas.push(nombre);
    reporte.mensajes.push('La hoja ' + nombre + ' ya tenia datos y se conservo. ' +
                          'Use "Reinstalar desde cero" si quiere reconstruirla.');
    return hoja;
  }

  if (hoja) {
    hoja.clear();
    hoja.clearConditionalFormatRules();
    limpiarValidaciones_(hoja);
  } else {
    hoja = libro.insertSheet(nombre);
  }

  constructor(libro, hoja);
  reporte.creadas.push(nombre);
  return hoja;
}

/** Hojas de cache: se recrean siempre, no guardan datos de trabajo. */
function construirHojaSistema_(libro, nombre, encabezados, reporte) {
  var hoja = libro.getSheetByName(nombre);
  if (!hoja) {
    hoja = libro.insertSheet(nombre);
    reporte.creadas.push(nombre);
  }
  if (hoja.getLastRow() === 0) {
    hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados])
      .setFontWeight('bold').setBackground('#D9D9D9');
    hoja.setFrozenRows(1);
  }
  hoja.hideSheet();
  return hoja;
}

/* ==========================================================================
 * B. HOJA CONFIG
 * ========================================================================== */

function construirCONFIG_(libro, hoja) {
  var fila = 1;

  // --- Titulo ---------------------------------------------------------
  hoja.getRange(fila, 1, 1, 4).merge()
    .setValue(APP.NOMBRE + ' · Configuracion · v' + APP.VERSION)
    .setBackground(APP.COLOR_PRIMARIO).setFontColor('#FFFFFF')
    .setFontSize(14).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  hoja.setRowHeight(fila, 34);
  fila += 1;

  hoja.getRange(fila, 1, 1, 4).merge()
    .setValue('Fuente del caso: ' + APP.CASO + '. Las celdas amarillas se editan; ' +
              'las grises son calculadas y estan protegidas.')
    .setFontStyle('italic').setFontSize(9).setWrap(true);
  hoja.setRowHeight(fila, 30);
  fila += 2;

  // --- Encabezado de columnas -----------------------------------------
  var filaEncabezado = fila;
  hoja.getRange(fila, 1, 1, 4)
    .setValues([['Parametro', 'Valor', 'Unidad', 'Nota y fuente']])
    .setFontWeight('bold').setBackground('#D9D9D9')
    .setBorder(true, true, true, true, true, true);
  fila += 1;

  // --- Secciones y parametros -----------------------------------------
  var rangosNombrados = [];

  for (var s = 0; s < ESQUEMA_CONFIG.length; s++) {
    var seccion = ESQUEMA_CONFIG[s];

    hoja.getRange(fila, 1, 1, 4).merge()
      .setValue(seccion.seccion.toUpperCase())
      .setBackground(APP.COLOR_PRIMARIO).setFontColor('#FFFFFF')
      .setFontWeight('bold').setFontSize(10);
    fila += 1;

    for (var i = 0; i < seccion.parametros.length; i++) {
      var def = seccion.parametros[i];
      escribirParametro_(hoja, fila, def);
      rangosNombrados.push({ clave: def.clave, fila: fila });
      fila += 1;
    }
    fila += 1;  // aire entre secciones
  }

  // --- Tablas maestras -------------------------------------------------
  fila += 1;
  for (var clave in ESQUEMA_TABLAS) {
    if (!Object.prototype.hasOwnProperty.call(ESQUEMA_TABLAS, clave)) continue;
    fila = escribirTabla_(libro, hoja, fila, ESQUEMA_TABLAS[clave]) + 2;
  }

  // --- Named ranges: el motor lee por nombre, nunca por coordenada -----
  for (var r = 0; r < rangosNombrados.length; r++) {
    definirRango_(libro, rangosNombrados[r].clave,
                 hoja.getRange(rangosNombrados[r].fila, 2));
  }

  // --- Formato general -------------------------------------------------
  hoja.setColumnWidth(1, 330);
  hoja.setColumnWidth(2, 130);
  hoja.setColumnWidth(3, 95);
  hoja.setColumnWidth(4, 560);
  hoja.setFrozenRows(filaEncabezado);
  hoja.getRange(1, 4, hoja.getMaxRows(), 1).setWrap(true).setFontSize(9);
}

/** Escribe una fila de parametro con su formato, validacion y proteccion. */
function escribirParametro_(hoja, fila, def) {
  hoja.getRange(fila, 1).setValue(def.etiqueta);
  hoja.getRange(fila, 3).setValue(def.unidad);

  var nota = def.nota || '';
  if (def.fuente) nota = '[' + def.fuente + '] ' + nota;
  hoja.getRange(fila, 4).setValue(nota).setWrap(true).setFontSize(9);

  var celda = hoja.getRange(fila, 2);
  var esCalculada = !!def.formula;

  if (esCalculada) {
    celda.setFormula(def.formula)
      .setBackground(APP.COLOR_CELDA_CALCULADA)
      .setFontStyle('italic')
      .setNote('Celda calculada. No editar: se recalcula sola desde los otros ' +
               'parametros.');
  } else {
    celda.setValue(valorDeSiembra_(def))
      .setBackground(APP.COLOR_CELDA_EDITABLE)
      .setBorder(true, true, true, true, false, false);
    aplicarValidacion_(celda, def);
  }

  celda.setHorizontalAlignment('center');
  aplicarFormatoNumerico_(celda, def.tipo);

  if (def.critico) {
    hoja.getRange(fila, 1).setFontWeight('bold')
      .setNote('Parametro critico: al cambiarlo hay que recalcular el plan antes de ' +
               'transferir dinero.');
  }
}

/** Convierte el valor del esquema al tipo que espera la celda. */
function valorDeSiembra_(def) {
  if (def.tipo === 'fecha' && typeof def.valor === 'string') {
    var partes = def.valor.split('-');
    return new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
  }
  if (def.tipo === 'lista' && typeof def.valor === 'boolean') {
    return def.valor ? 'Si' : 'No';
  }
  return def.valor;
}

/** Aplica la validacion de datos declarada en el esquema. */
function aplicarValidacion_(celda, def) {
  var v = def.validacion;
  if (!v) return;

  var regla = null;

  if (v.valores) {
    var opciones = v.valores.map(function (x) {
      return (typeof x === 'boolean') ? (x ? 'Si' : 'No') : String(x);
    });
    regla = SpreadsheetApp.newDataValidation()
      .requireValueInList(opciones, true)
      .setAllowInvalid(false)
      .setHelpText('Valores permitidos: ' + opciones.join(', '));

  } else if (typeof v.min === 'number' && typeof v.max === 'number') {
    regla = SpreadsheetApp.newDataValidation()
      .requireNumberBetween(v.min, v.max)
      .setAllowInvalid(false)
      .setHelpText(def.etiqueta + ': debe estar entre ' + v.min + ' y ' + v.max +
                   ' ' + def.unidad + '.');

  } else if (def.tipo === 'fecha') {
    regla = SpreadsheetApp.newDataValidation()
      .requireDate()
      .setAllowInvalid(false)
      .setHelpText('Ingrese una fecha valida.');
  }

  if (regla) celda.setDataValidation(regla.build());
}

/** Formato numerico segun el tipo declarado. */
function aplicarFormatoNumerico_(rango, tipo) {
  if (tipo === 'moneda') rango.setNumberFormat(APP.FORMATO_MONEDA);
  else if (tipo === 'porcentaje') rango.setNumberFormat(APP.FORMATO_PORCENTAJE);
  else if (tipo === 'entero') rango.setNumberFormat(APP.FORMATO_ENTERO);
  else if (tipo === 'numero') rango.setNumberFormat(APP.FORMATO_DECIMAL);
  else if (tipo === 'fecha') rango.setNumberFormat(APP.FORMATO_FECHA);
}

/** Escribe una tabla maestra y le define su named range. */
function escribirTabla_(libro, hoja, fila, tabla) {
  hoja.getRange(fila, 1, 1, 4).merge()
    .setValue(tabla.titulo)
    .setBackground(APP.COLOR_ACENTO).setFontColor('#FFFFFF')
    .setFontWeight('bold').setFontSize(10);
  fila += 1;

  if (tabla.nota) {
    hoja.getRange(fila, 1, 1, 4).merge()
      .setValue(tabla.nota).setFontStyle('italic').setFontSize(9).setWrap(true);
    hoja.setRowHeight(fila, 32);
    fila += 1;
  }

  var nCol = tabla.columnas.length;
  hoja.getRange(fila, 1, 1, nCol).setValues([tabla.columnas])
    .setFontWeight('bold').setBackground('#EFEFEF')
    .setBorder(true, true, true, true, true, true);
  var filaEncabezado = fila;
  fila += 1;

  var primeraFilaDatos = fila;
  if (tabla.filas.length) {
    var matriz = tabla.filas.map(function (f) {
      return f.map(function (celda) {
        if (typeof celda === 'string' && celda.indexOf('=') === 0) return celda;
        return celda;
      });
    });

    var rango = hoja.getRange(fila, 1, matriz.length, nCol);
    rango.setValues(matriz);
    rango.setBackground(APP.COLOR_CELDA_EDITABLE);
    rango.setBorder(true, true, true, true, true, true);

    for (var c = 0; c < nCol; c++) {
      aplicarFormatoNumerico_(hoja.getRange(fila, c + 1, matriz.length, 1), tabla.tipos[c]);
    }
    fila += matriz.length;
  } else {
    // Tabla vacia: se dejan 10 filas en blanco listas para escribir.
    var vacio = hoja.getRange(fila, 1, 10, nCol);
    vacio.setBackground(APP.COLOR_CELDA_EDITABLE);
    vacio.setBorder(true, true, true, true, true, true);
    fila += 10;
  }

  // El named range cubre encabezado y datos, para que BUSCARV funcione.
  definirRango_(libro, tabla.rango,
               hoja.getRange(primeraFilaDatos, 1, fila - primeraFilaDatos, nCol));

  if (tabla.piePagina) {
    hoja.getRange(fila, 1, 1, 4).merge()
      .setValue(tabla.piePagina).setFontSize(8).setFontStyle('italic').setWrap(true);
    hoja.setRowHeight(fila, 40);
    fila += 1;
  }

  return fila;
}

/* ==========================================================================
 * C. HOJA DESTINOS
 * ========================================================================== */

/**
 * Direcciones de las 16 municipalidades del enunciado, mas la base.
 * Son lo unico que se le pide al usuario: los km y las horas los trae Maps.
 * Se escriben completas y con "Chile" al final porque es lo que Google
 * necesita para geocodificar sin ambiguedad.
 */
var SIEMBRA_DESTINOS = [
  ['BASE', 'Metropolitana',
   'INACAP Sede Santiago Sur, Av. Vicuna Mackenna 3864, Macul, Santiago, Chile',
   'Si', 0, '—', '', 'URB', ''],

  ['Maipu', 'Metropolitana',
   'Av. 5 de Abril 0260, Maipu, Santiago, Chile',
   'Si', 3, 'No aplica', '', 'URB', 'URB_VSU'],

  ['Pudahuel', 'Metropolitana',
   'Av. San Pablo 8444, Pudahuel, Santiago, Chile',
   'Si', 3, 'No aplica', '', 'URB', 'URB_VSU,URB_CNO'],

  ['Santiago', 'Metropolitana',
   'Plaza de Armas 444, Santiago Centro, Santiago, Chile',
   'Si', 3, 'No aplica', '', 'URB', 'URB_ACE'],

  ['Puente Alto', 'Metropolitana',
   'Concha y Toro 1820, Puente Alto, Santiago, Chile',
   'Si', 1, 'No aplica', '', 'URB', 'URB_VSU'],

  ['Lo Barnechea', 'Metropolitana',
   'Av. Lo Barnechea 1210, Lo Barnechea, Santiago, Chile',
   'Si', 3, 'No aplica', '', 'URB', 'URB_CNO'],

  ['Melipilla', 'Metropolitana',
   'Serrano 1550, Melipilla, Chile',
   'Si', 2, 'No aplica', '', 'R78', 'R78_AVE,R78_RIN,R78_PHU,R78_MAL,R78_TAL,R78_PAI,R78_POM'],

  ['San Antonio', 'Valparaiso',
   'Av. Barros Luco 1881, San Antonio, Chile',
   'No', 2, 'No aplica', '', 'R78',
   'R78_AVE,R78_RIN,R78_PHU,R78_MAL,R78_TAL,R78_PAI,R78_POM,R78_PUA'],

  ['La Calera', 'Valparaiso',
   'J. J. Perez 351, La Calera, Chile',
   'No', 1, 'No aplica', '', 'R5N', 'R5N_LMA,R5N_BUE,R5N_LMO,R5N_LPI,R5N_LAM,R5N_LVE'],

  ['Coquimbo', 'Coquimbo',
   'Bilbao 330, Coquimbo, Chile',
   'No', 2, 'Centro de Coquimbo o La Serena', '', 'R5N',
   'R5N_LMA,R5N_BUE,R5N_LMO,R5N_LPI,R5N_LAM,R5N_LVE,R5N_MEL,R5N_PIC,R5N_ELQ_S'],

  ['Copiapo', 'Atacama',
   'Chacabuco 546, Copiapo, Chile',
   'No', 5, 'Centro de Copiapo', '', 'R5N',
   'R5N_LMA,R5N_BUE,R5N_LMO,R5N_LPI,R5N_LAM,R5N_LVE,R5N_MEL,R5N_PIC,R5N_ELQ_S,' +
   'R5N_ELQ_N,R5N_PCO,R5N_CAC,R5N_TOT'],

  ['Curico', 'Maule',
   'Carmen 360, Curico, Chile',
   'No', 1, 'No aplica', '', 'R5S', 'R5S_TOC,R5S_GAB,R5S_RMA,R5S_ANG'],

  ['Talca', 'Maule',
   '1 Sur 835, Talca, Chile',
   'No', 3, 'Centro de Talca', '', 'R5S', 'R5S_TOC,R5S_GAB,R5S_RMA,R5S_ANG'],

  ['Santa Juana', 'Biobio',
   'Irarrazaval 320, Santa Juana, Chile',
   'No', 1, 'Centro de Concepcion', '', 'R5S',
   'R5S_TOC,R5S_GAB,R5S_RMA,R5S_ANG,R5S_RCL,ITA_NAL,ITA_RAF,ITA_AAM'],

  ['San Pedro de la Paz', 'Biobio',
   'Los Alamos 2093, San Pedro de la Paz, Chile',
   'No', 1, 'Centro de Concepcion', '', 'R5S',
   'R5S_TOC,R5S_GAB,R5S_RMA,R5S_ANG,R5S_RCL,ITA_NAL,ITA_RAF,ITA_AAM,BIO_PIN'],

  ['Penco', 'Biobio',
   'Freire 545, Penco, Chile',
   'No', 1, 'Centro de Concepcion', '', 'R5S',
   'R5S_TOC,R5S_GAB,R5S_RMA,R5S_ANG,R5S_RCL,ITA_NAL,ITA_RAF,ITA_AAM'],

  ['Tome', 'Biobio',
   'Ignacio Serrano 1130, Tome, Chile',
   'No', 1, 'Centro de Concepcion', '', 'R5S',
   'R5S_TOC,R5S_GAB,R5S_RMA,R5S_ANG,R5S_RCL,ITA_NAL,ITA_RAF,ITA_AAM']
];

function construirDESTINOS_(libro, hoja) {
  var columnas = ESQUEMA_DESTINOS.columnas;
  var nCol = columnas.length;

  // --- Titulo ----------------------------------------------------------
  hoja.getRange(1, 1, 1, nCol).merge()
    .setValue('DESTINOS · una fila por localidad. Se ingresa la direccion; los ' +
              'kilometros, las horas y el peaje los calcula el sistema.')
    .setBackground(APP.COLOR_PRIMARIO).setFontColor('#FFFFFF')
    .setFontWeight('bold').setFontSize(11).setVerticalAlignment('middle');
  hoja.setRowHeight(1, 30);

  // --- Encabezados -----------------------------------------------------
  var titulos = columnas.map(function (c) { return c.titulo; });
  var encabezado = hoja.getRange(2, 1, 1, nCol);
  encabezado.setValues([titulos])
    .setFontWeight('bold').setBackground('#D9D9D9').setWrap(true)
    .setBorder(true, true, true, true, true, true);

  for (var c = 0; c < nCol; c++) {
    hoja.setColumnWidth(c + 1, columnas[c].ancho || 120);
    if (columnas[c].nota) hoja.getRange(2, c + 1).setNote(columnas[c].nota);
    // Las columnas que llena Maps o el motor van grises desde el encabezado.
    if (columnas[c].origen !== 'usuario') {
      hoja.getRange(2, c + 1).setBackground('#BFBFBF');
    }
  }

  // --- Siembra ---------------------------------------------------------
  var filaInicio = 3;
  var matriz = SIEMBRA_DESTINOS.map(function (d) {
    var fila = new Array(nCol).fill('');
    fila[0] = d[0];  // Localidad
    fila[1] = d[1];  // Region
    fila[2] = d[2];  // Direccion exacta
    fila[3] = d[3];  // En RM
    fila[4] = d[4];  // Equipos
    fila[5] = d[5];  // Hotel
    fila[6] = d[6];  // Link capacitacion
    fila[7] = d[7];  // Corredor
    fila[8] = d[8];  // Plazas de peaje
    return fila;
  });

  hoja.getRange(filaInicio, 1, matriz.length, nCol).setValues(matriz);

  var ultimaFila = filaInicio + matriz.length - 1;
  var filasUtiles = ultimaFila - filaInicio + 1;

  // --- Formato por columna --------------------------------------------
  for (var k = 0; k < nCol; k++) {
    var col = columnas[k];
    var rango = hoja.getRange(filaInicio, k + 1, filasUtiles, 1);

    aplicarFormatoNumerico_(rango, col.tipo);

    if (col.origen === 'usuario') {
      rango.setBackground(APP.COLOR_CELDA_EDITABLE);
      if (col.valores) {
        rango.setDataValidation(SpreadsheetApp.newDataValidation()
          .requireValueInList(col.valores, true).setAllowInvalid(false).build());
      }
      if (col.validacion && typeof col.validacion.min === 'number') {
        rango.setDataValidation(SpreadsheetApp.newDataValidation()
          .requireNumberBetween(col.validacion.min, col.validacion.max)
          .setAllowInvalid(false).build());
      }
    } else {
      rango.setBackground(APP.COLOR_CELDA_CALCULADA).setFontStyle('italic');
    }
    rango.setBorder(true, true, true, true, true, true);
  }

  hoja.getRange(filaInicio, 1, filasUtiles, 1).setFontWeight('bold');
  hoja.setFrozenRows(2);
  hoja.setFrozenColumns(1);

  // La lista de localidades alimenta las validaciones Desde/Hasta de PLAN.
  definirRango_(libro, ESQUEMA_DESTINOS.rangoLocalidades,
               hoja.getRange(filaInicio, 1, filasUtiles, 1));

  // Semaforo visual sobre equipos pendientes.
  var reglaEquipos = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(0)
    .setBackground('#FFF2CC')
    .setRanges([hoja.getRange(filaInicio, 5, filasUtiles, 1)])
    .build();
  hoja.setConditionalFormatRules([reglaEquipos]);
}

/* ==========================================================================
 * D. HOJA PLAN
 * ==========================================================================
 * Plan de referencia: 3 cuadrillas de 3 tecnicos, periferia primero y la RM
 * al final con dias cortos y sin hotel. 23 tramos, 4 dias habiles, 33 equipos.
 * T10 queda de reserva: con 10 tecnicos y grupos de 3 sobra uno, y el sistema
 * lo dice en vez de esconderlo.
 *
 * Formato de cada fila:
 * [N, Dia, Cuadrilla, Modo, Vehiculo, Desde, Hasta, Noches, Conductor, tecnicos]
 * ========================================================================== */

var SIEMBRA_PLAN = [
  // --- C1 · corredor norte: Coquimbo y Copiapo ------------------------
  [ 1, 'D1', 'C1', 'Camioneta', 'V1', 'BASE',     'Coquimbo', 1, 'T01', ['T01','T02','T03']],
  [ 2, 'D2', 'C1', 'Camioneta', 'V1', 'Coquimbo', 'Copiapo',  1, 'T01', ['T01','T02','T03']],
  [ 3, 'D3', 'C1', 'Camioneta', 'V1', 'Copiapo',  'Coquimbo', 1, 'T02', ['T01','T02','T03']],
  [ 4, 'D4', 'C1', 'Camioneta', 'V1', 'Coquimbo', 'La Calera',0, 'T02', ['T01','T02','T03']],
  [ 5, 'D4', 'C1', 'Camioneta', 'V1', 'La Calera','BASE',     0, 'T02', ['T01','T02','T03']],

  // --- C2 · corredor sur: Maule y Biobio ------------------------------
  [ 6, 'D1', 'C2', 'Camioneta', 'V2', 'BASE',     'Curico',   0, 'T04', ['T04','T05','T06']],
  [ 7, 'D1', 'C2', 'Camioneta', 'V2', 'Curico',   'Talca',    1, 'T04', ['T04','T05','T06']],
  [ 8, 'D2', 'C2', 'Camioneta', 'V2', 'Talca',    'Santa Juana', 1, 'T05', ['T04','T05','T06']],
  [ 9, 'D3', 'C2', 'Camioneta', 'V2', 'Santa Juana', 'San Pedro de la Paz', 0, 'T05', ['T04','T05','T06']],
  [10, 'D3', 'C2', 'Camioneta', 'V2', 'San Pedro de la Paz', 'Penco', 1, 'T05', ['T04','T05','T06']],
  // Tome queda a mas de 6 h de la base: hacer el trabajo y volver el mismo dia
  // deja la jornada en 11 h, sobre el tope legal. Se pernocta y se vuelve al
  // dia siguiente. Aqui el hotel no es comodidad, es la unica opcion legal.
  [11, 'D4', 'C2', 'Camioneta', 'V2', 'Penco',    'Tome',     1, 'T06', ['T04','T05','T06']],
  [12, 'D5', 'C2', 'Camioneta', 'V2', 'Tome',     'BASE',     0, 'T06', ['T04','T05','T06']],

  // --- C3 · Region Metropolitana y Ruta 78, sin pernoctar -------------
  [13, 'D1', 'C3', 'Camioneta', 'V3', 'BASE',     'Maipu',    0, 'T07', ['T07','T08','T09']],
  [14, 'D1', 'C3', 'Camioneta', 'V3', 'Maipu',    'Pudahuel', 0, 'T07', ['T07','T08','T09']],
  [15, 'D1', 'C3', 'Camioneta', 'V3', 'Pudahuel', 'BASE',     0, 'T07', ['T07','T08','T09']],
  [16, 'D2', 'C3', 'Camioneta', 'V3', 'BASE',     'Santiago', 0, 'T09', ['T07','T08','T09']],
  [17, 'D2', 'C3', 'Camioneta', 'V3', 'Santiago', 'Lo Barnechea', 0, 'T09', ['T07','T08','T09']],
  [18, 'D2', 'C3', 'Camioneta', 'V3', 'Lo Barnechea', 'BASE', 0, 'T09', ['T07','T08','T09']],
  [19, 'D3', 'C3', 'Camioneta', 'V3', 'BASE',     'Melipilla',0, 'T07', ['T07','T08','T09']],
  [20, 'D3', 'C3', 'Camioneta', 'V3', 'Melipilla','San Antonio', 0, 'T07', ['T07','T08','T09']],
  [21, 'D3', 'C3', 'Camioneta', 'V3', 'San Antonio', 'BASE',  0, 'T07', ['T07','T08','T09']],
  [22, 'D4', 'C3', 'Camioneta', 'V3', 'BASE',     'Puente Alto', 0, 'T09', ['T07','T08','T09']],
  [23, 'D4', 'C3', 'Camioneta', 'V3', 'Puente Alto', 'BASE',  0, 'T09', ['T07','T08','T09']]
];

function construirPLAN_(libro, hoja) {
  var tecnicos = ESQUEMA_TABLAS.TECNICOS.filas.filter(function (t) { return t[3] === 'Si'; });
  var fijas = ESQUEMA_PLAN.columnas;
  var nFijas = fijas.length;
  var nCol = nFijas + tecnicos.length;

  // --- Titulo ----------------------------------------------------------
  hoja.getRange(1, 1, 1, nCol).merge()
    .setValue('PLAN · un tramo por fila. Marque con la casilla que tecnicos van en ' +
              'cada tramo. Un tramo con destino BASE es el regreso y no ejecuta trabajo.')
    .setBackground(APP.COLOR_PRIMARIO).setFontColor('#FFFFFF')
    .setFontWeight('bold').setFontSize(11).setVerticalAlignment('middle');
  hoja.setRowHeight(1, 30);

  // --- Encabezados ------------------------------------------------------
  var titulos = fijas.map(function (c) { return c.titulo; })
    .concat(tecnicos.map(function (t) { return t[0]; }));

  hoja.getRange(2, 1, 1, nCol).setValues([titulos])
    .setFontWeight('bold').setBackground('#D9D9D9').setWrap(true)
    .setHorizontalAlignment('center')
    .setBorder(true, true, true, true, true, true);

  for (var c = 0; c < nFijas; c++) {
    hoja.setColumnWidth(c + 1, fijas[c].ancho || 110);
    if (fijas[c].nota) hoja.getRange(2, c + 1).setNote(fijas[c].nota);
  }
  for (var t = 0; t < tecnicos.length; t++) {
    hoja.setColumnWidth(nFijas + t + 1, 45);
    hoja.getRange(2, nFijas + t + 1)
      .setNote(tecnicos[t][0] + ' · ' + tecnicos[t][1] +
               (tecnicos[t][2] === 'No' ? '\nSIN licencia de conducir' : '\nCon licencia'));
  }

  // --- Siembra ----------------------------------------------------------
  var filaInicio = 3;
  var codigos = tecnicos.map(function (x) { return x[0]; });

  var matriz = SIEMBRA_PLAN.map(function (tramo) {
    var fila = [tramo[0], tramo[1], tramo[2], tramo[3], tramo[4],
                tramo[5], tramo[6], tramo[7], tramo[8]];
    for (var i = 0; i < codigos.length; i++) {
      fila.push(tramo[9].indexOf(codigos[i]) !== -1);
    }
    return fila;
  });

  hoja.getRange(filaInicio, 1, matriz.length, nCol).setValues(matriz);

  // Se dejan 60 filas listas para planificar mas tramos.
  var filasUtiles = matriz.length + 60;

  // --- Validaciones por lista ------------------------------------------
  var listas = construirListasDerivadas_();

  for (var k = 0; k < nFijas; k++) {
    var col = fijas[k];
    var rango = hoja.getRange(filaInicio, k + 1, filasUtiles, 1);
    rango.setBackground(APP.COLOR_CELDA_EDITABLE);
    rango.setBorder(true, true, true, true, true, true);
    aplicarFormatoNumerico_(rango, col.tipo);

    if (col.lista && listas[col.lista]) {
      rango.setDataValidation(SpreadsheetApp.newDataValidation()
        .requireValueInList(listas[col.lista], true).setAllowInvalid(false)
        .setHelpText(col.titulo + ': elija de la lista.').build());

    } else if (col.rangoLista) {
      var rangoFuente = libro.getRangeByName(col.rangoLista);
      if (rangoFuente) {
        // Para la nomina se valida contra la primera columna, que es el codigo.
        if (col.rangoLista === 'T_TECNICOS') {
          rangoFuente = rangoFuente.offset(0, 0, rangoFuente.getNumRows(), 1);
        }
        rango.setDataValidation(SpreadsheetApp.newDataValidation()
          .requireValueInRange(rangoFuente, true).setAllowInvalid(false).build());
      }
    } else if (col.validacion && typeof col.validacion.min === 'number') {
      rango.setDataValidation(SpreadsheetApp.newDataValidation()
        .requireNumberBetween(col.validacion.min, col.validacion.max)
        .setAllowInvalid(false).build());
    }
  }

  // --- Casillas de tecnicos ---------------------------------------------
  var rangoCasillas = hoja.getRange(filaInicio, nFijas + 1, filasUtiles, tecnicos.length);
  rangoCasillas.insertCheckboxes();
  rangoCasillas.setHorizontalAlignment('center');
  rangoCasillas.setBorder(true, true, true, true, true, true);

  // Una columna de tecnico sin licencia se marca visualmente, para que no se
  // le asigne conduccion por descuido.
  for (var lic = 0; lic < tecnicos.length; lic++) {
    if (tecnicos[lic][2] === 'No') {
      hoja.getRange(2, nFijas + lic + 1).setBackground('#F4CCCC');
    }
  }

  hoja.setFrozenRows(2);
  hoja.setFrozenColumns(3);
}

/* ==========================================================================
 * E. UTILIDADES
 * ========================================================================== */

/** Construye las listas derivadas a partir de los valores de siembra. */
function construirListasDerivadas_() {
  var valores = {};
  listarParametros_().forEach(function (p) {
    valores[p.definicion.clave] = p.definicion.valor;
  });

  var salida = {};
  for (var nombre in ESQUEMA_LISTAS) {
    if (!Object.prototype.hasOwnProperty.call(ESQUEMA_LISTAS, nombre)) continue;
    var def = ESQUEMA_LISTAS[nombre];

    if (def.valores) {
      // Solo se ofrecen los modos habilitados en CONFIG.
      salida[nombre] = def.valores.filter(function (v) {
        var flag = def.habilitadosPor && def.habilitadosPor[v];
        return !flag || valores[flag] !== false;
      });
      continue;
    }

    var cantidad = 1;
    for (var i = 0; i < def.cantidadDesde.length; i++) {
      var n = Number(valores[def.cantidadDesde[i]]) || 1;
      cantidad = (def.operacion === 'producto' || i === 0) ? cantidad * n : cantidad;
    }

    var lista = [];
    for (var j = 1; j <= cantidad; j++) lista.push(def.prefijo + j);
    if (def.extras) lista = lista.concat(def.extras);
    salida[nombre] = lista;
  }
  return salida;
}

/** Define o redefine un named range. */
function definirRango_(libro, nombre, rango) {
  try { libro.removeNamedRange(nombre); } catch (e) { /* no existia */ }
  libro.setNamedRange(nombre, rango);
}

/** Quita todas las validaciones de una hoja antes de reconstruirla. */
function limpiarValidaciones_(hoja) {
  hoja.getRange(1, 1, hoja.getMaxRows(), hoja.getMaxColumns()).clearDataValidations();
}

/** Deja las hojas en el orden logico de trabajo. */
function ordenarHojas_(libro) {
  var orden = [HOJAS.CONFIG.nombre, HOJAS.DESTINOS.nombre, HOJAS.PLAN.nombre];
  for (var i = 0; i < orden.length; i++) {
    var hoja = libro.getSheetByName(orden[i]);
    if (hoja) {
      libro.setActiveSheet(hoja);
      libro.moveActiveSheet(i + 1);
    }
  }
  libro.setActiveSheet(libro.getSheetByName(HOJAS.CONFIG.nombre));
}

/** Elimina la "Hoja 1" vacia que Google crea con todo libro nuevo. */
function eliminarHojaPorDefecto_(libro) {
  var candidatas = ['Hoja 1', 'Hoja1', 'Sheet1'];
  for (var i = 0; i < candidatas.length; i++) {
    var hoja = libro.getSheetByName(candidatas[i]);
    if (hoja && libro.getSheets().length > 1 && hoja.getLastRow() === 0) {
      libro.deleteSheet(hoja);
    }
  }
}

/** Libro activo, o el enlazado por ID cuando se corre como web app. */
function obtenerLibro_() {
  var activo = SpreadsheetApp.getActiveSpreadsheet();
  if (activo) return activo;

  var id = PropertiesService.getScriptProperties().getProperty('ID_PLANILLA');
  if (!id) {
    throw new Error('No hay libro activo y falta la propiedad ID_PLANILLA. ' +
                    'Definala en Apps Script, Configuracion del proyecto, ' +
                    'Propiedades del script.');
  }
  return SpreadsheetApp.openById(id);
}

/** Deja constancia de una accion en la hoja oculta _BITACORA. */
function registrarBitacora_(libro, accion, detalle) {
  try {
    var hoja = libro.getSheetByName(HOJAS.BITACORA.nombre);
    if (!hoja) return;
    var usuario = '';
    try { usuario = Session.getActiveUser().getEmail(); } catch (e) { usuario = 'sistema'; }
    hoja.appendRow([new Date(), accion, usuario, detalle]);
  } catch (e) {
    // La bitacora nunca debe hacer fallar una operacion real.
  }
}
