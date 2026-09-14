/**
 * ============================================================================
 *  SERVICIO TECNICO EN RUTA · v2 · 07_WebApp.gs
 *  Publicacion como aplicacion web, menu del libro y exportacion a PDF.
 * ============================================================================
 *
 *  POR QUE WEB APP Y NO UNA VENTANA DENTRO DE LA HOJA
 *  El enunciado del caso 2 pide que CADA TECNICO pueda ver su ruta, sus
 *  implementos, su hotel y su camioneta. Una ventana dentro del libro obliga a
 *  dar acceso al libro completo, y con el vienen CONFIG y los montos de todos.
 *  Publicada como web app se manda un enlace y cada uno ve lo suyo, sin tener
 *  permiso sobre la planilla.
 *
 *  COMO SE PUBLICA
 *  Implementar -> Nueva implementacion -> Aplicacion web
 *    Ejecutar como       : Yo
 *    Quien tiene acceso  : Cualquier persona con el enlace
 *  Con "Ejecutar como: yo" el script entra al libro con los permisos del
 *  dueno, asi que el tecnico nunca necesita permisos propios. El control de
 *  quien entra lo hace el login de 06_Api.gs.
 * ============================================================================
 */

/* ==========================================================================
 * A. APLICACION WEB
 * ========================================================================== */

function doGet(e) {
  var parametros = (e && e.parameter) ? e.parameter : {};

  var plantilla = HtmlService.createTemplateFromFile('Index');
  plantilla.vistaInicial = parametros.vista || 'resumen';
  plantilla.tecnicoInicial = parametros.tecnico || '';
  plantilla.version = APP.VERSION;
  plantilla.nombreApp = APP.NOMBRE;

  return plantilla.evaluate()
    .setTitle(APP.NOMBRE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Permite partir archivos HTML: <?!= incluir_('Estilos') ?> */
function incluir_(nombre) {
  return HtmlService.createHtmlOutputFromFile(nombre).getContent();
}

/* ==========================================================================
 * B. MENU DEL LIBRO
 * ========================================================================== */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙ Servicio Tecnico')
    .addItem('Abrir panel', 'abrirPanel_')
    .addSeparator()
    .addItem('Configurar credenciales de acceso', 'menuConfigurarAcceso_')
    .addItem('Actualizar CONFIG con parametros nuevos', 'menuSincronizar_')
    .addItem('Crear o restaurar hojas base', 'menuInstalar_')
    .addItem('Reinstalar desde cero (borra datos)', 'menuReinstalar_')
    .addSeparator()
    .addItem('Recalcular y validar plan', 'menuRecalcular_')
    .addItem('Actualizar rutas con Google Maps', 'menuActualizarRutas_')
    .addSeparator()
    .addItem('Orden de servicio por tecnico', 'menuOrdenServicio_')
    .addItem('Ver enlace de la aplicacion web', 'menuVerEnlace_')
    .addSeparator()
    .addItem('Acerca de y supuestos', 'menuAcercaDe_')
    .addToUi();
}

/** Abre el panel dentro del libro, util para el jefe de servicio. */
function abrirPanel_() {
  var plantilla = HtmlService.createTemplateFromFile('Index');
  plantilla.vistaInicial = 'resumen';
  plantilla.tecnicoInicial = '';
  plantilla.version = APP.VERSION;
  plantilla.nombreApp = APP.NOMBRE;

  SpreadsheetApp.getUi().showModalDialog(
    plantilla.evaluate().setWidth(1250).setHeight(820), APP.NOMBRE);
}

function menuConfigurarAcceso_() {
  var ui = SpreadsheetApp.getUi();
  try {
    var resultado = configurarAcceso_();
    ui.alert('Acceso Web', resultado, ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Error al configurar acceso', err.message, ui.ButtonSet.OK);
  }
}

function menuSincronizar_() {
  var ui = SpreadsheetApp.getUi();
  try {
    var r = sincronizarParametros_();
    var texto = r.mensaje;
    if (r.agregados.length) texto += '\n\n' + r.agregados.join('\n');
    ui.alert('CONFIG actualizada', texto, ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Error al sincronizar', err.message, ui.ButtonSet.OK);
  }
}

function menuInstalar_() {
  var ui = SpreadsheetApp.getUi();
  try {
    var r = instalarSistema_(false);
    var texto = 'Hojas creadas: ' + (r.creadas.join(', ') || 'ninguna') + '.\n' +
                'Conservadas: ' + (r.conservadas.join(', ') || 'ninguna') + '.';
    if (r.mensajes.length) texto += '\n\n' + r.mensajes.join('\n');
    ui.alert('Instalacion', texto, ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Error al instalar', err.message, ui.ButtonSet.OK);
  }
}

function menuReinstalar_() {
  var ui = SpreadsheetApp.getUi();
  var respuesta = ui.alert('Reinstalar desde cero',
    'Esto BORRA el contenido de CONFIG, DESTINOS y PLAN y vuelve a sembrar los datos ' +
    'de referencia. Todo lo que haya planificado se pierde.\n\n' +
    'Si solo quiere reparar la estructura, cancele y use "Crear o restaurar hojas base".\n\n' +
    'Continuar?', ui.ButtonSet.YES_NO);

  if (respuesta !== ui.Button.YES) return;

  try {
    var r = instalarSistema_(true);
    ui.alert('Listo', 'Reconstruidas: ' + r.creadas.join(', ') + '.', ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Error al reinstalar', err.message, ui.ButtonSet.OK);
  }
}

function menuRecalcular_() {
  var libro = SpreadsheetApp.getActiveSpreadsheet();
  try {
    var payload = construirTablero_(ESQUEMA_ESCENARIOS.activo);
    var T = payload.resultado.totales;
    var errores = payload.resultado.alertas.filter(function (a) {
      return a.nivel === 'error'; });

    libro.toast(
      'Gasto total ' + formatearPesos_(T.gastoTotal) + ' · ' + T.equipos + ' equipos · ' +
      T.diasHabiles + ' dias · ' + errores.length + ' errores, ' +
      (payload.resultado.alertas.length - errores.length) + ' avisos',
      'Plan recalculado', 12);

    if (errores.length) {
      SpreadsheetApp.getUi().alert('Errores que impiden ejecutar el plan',
        errores.map(function (a, i) { return (i + 1) + '. ' + a.mensaje; }).join('\n\n'),
        SpreadsheetApp.getUi().ButtonSet.OK);
    }
  } catch (err) {
    SpreadsheetApp.getUi().alert('Error al recalcular', err.message,
                                 SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function menuActualizarRutas_() {
  var ui = SpreadsheetApp.getUi();
  var libro = SpreadsheetApp.getActiveSpreadsheet();
  try {
    libro.toast('Consultando Google Maps...', 'Rutas', 30);
    var datos = leerDatosDelLibro_();
    var direcciones = {};
    datos.destinos.forEach(function (d) { direcciones[d.localidad] = d.direccion; });

    var pares = datos.destinos
      .filter(function (d) { return d.localidad !== 'BASE'; })
      .map(function (d) { return { origen: 'BASE', destino: d.localidad }; });
    datos.tramos.forEach(function (t) {
      pares.push({ origen: t.desde, destino: t.hasta }); });

    var r = resolverRutas_(pares, direcciones, datos.parametros, libro);
    escribirCalculadosEnDestinos_(libro, datos.destinos, r.rutas, datos.parametros,
                                 datos.ajustesPeaje);

    var texto = r.consultas + ' consultas nuevas a Maps. ' +
                (r.errores.length ? r.errores.length + ' con problema.' : 'Sin errores.');
    libro.toast(texto, 'Rutas actualizadas', 10);
    if (r.errores.length) ui.alert('Problemas de ruteo', r.errores.join('\n\n'), ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Error al actualizar rutas', err.message, ui.ButtonSet.OK);
  }
}

function menuOrdenServicio_() {
  var ui = SpreadsheetApp.getUi();
  var datos = leerDatosDelLibro_();
  var codigos = datos.tecnicos.map(function (t) {
    return t.codigo + ' (' + t.nombre + ')'; }).join('\n');

  var r = ui.prompt('Orden de servicio',
    'Escriba el codigo del tecnico:\n\n' + codigos, ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;

  var codigo = r.getResponseText().trim().toUpperCase();
  try {
    var archivo = exportarOrdenPDF_(codigo);
    ui.alert('Orden generada',
      'Se creo el PDF "' + archivo.getName() + '" en Drive.\n\n' + archivo.getUrl(),
      ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Error', err.message, ui.ButtonSet.OK);
  }
}

function menuVerEnlace_() {
  var url = ScriptApp.getService().getUrl();
  var ui = SpreadsheetApp.getUi();

  if (!url) {
    ui.alert('Aplicacion web no publicada',
      'Todavia no se publica. Vaya a Implementar, Nueva implementacion, tipo ' +
      'Aplicacion web, con "Ejecutar como: yo" y "Acceso: cualquier persona con el ' +
      'enlace".', ui.ButtonSet.OK);
    return;
  }

  ui.alert('Enlace de la aplicacion',
    'Panel completo:\n' + url + '\n\n' +
    'Vista directa de un tecnico:\n' + url + '?vista=orden&tecnico=T01\n\n' +
    'Entre con el correo y la clave definidos en configurarAcceso_().',
    ui.ButtonSet.OK);
}

function menuAcercaDe_() {
  var delPdf = listarParametrosDelEnunciado_();
  var criticos = listarParametrosCriticos_();

  var texto =
    APP.NOMBRE + ' version ' + APP.VERSION + '\n' +
    APP.CASO + '\n\n' +
    'DE DONDE SALE CADA NUMERO\n' +
    '· ' + delPdf.length + ' parametros salen textuales del enunciado y no se negocian.\n' +
    '· El resto son decisiones de jefatura o supuestos declarados, editables en CONFIG.\n' +
    '· ' + criticos.length + ' son criticos: al cambiarlos hay que recalcular antes de ' +
    'transferir dinero.\n\n' +
    'FUENTES\n' +
    '· Trayecto: Google Maps, solo kilometros y tiempo.\n' +
    '· Peajes: catalogo MOP 2026, categoria 1 auto y camioneta, sumado plaza por plaza.\n' +
    '· Hotel: $' + '50.000 por noche por persona, valor de jefatura.\n' +
    '· Viatico: $' + '25.000 por tecnico y dia desplegado, incluye la colacion.\n\n' +
    'LO QUE EL SISTEMA NO SABE\n' +
    '· Las secuencias de plazas marcadas ESTIMADO no estan contrastadas contra un total ' +
    'oficial del MOP. Se corrigen con la primera cartola del TAG.\n' +
    '· Las tarifas de bus y avion son referenciales: hay que cotizar antes de comprometer.\n' +
    '· Maps entrega tiempo de auto liviano sin paradas; por eso se aplica un factor de ' +
    'correccion configurable.';

  SpreadsheetApp.getUi().alert('Acerca de y supuestos', texto,
                               SpreadsheetApp.getUi().ButtonSet.OK);
}

/* ==========================================================================
 * C. EXPORTAR ORDEN DE SERVICIO A PDF
 * ========================================================================== */

/**
 * Genera el PDF de la hoja de ruta de un tecnico y lo deja en Drive.
 * @param {string} codigoTecnico
 * @return {File} archivo de Drive
 */
function exportarOrdenPDF_(codigoTecnico, escenario) {
  var tablero = construirTablero_(escenario || ESQUEMA_ESCENARIOS.activo);
  var R = tablero.resultado;

  var tecnico = tablero.tecnicos.filter(function (t) {
    return t.codigo === codigoTecnico; })[0];
  if (!tecnico) {
    throw new Error('El tecnico "' + codigoTecnico + '" no esta en la nomina. Codigos ' +
                    'validos: ' + tablero.tecnicos.map(function (t) {
                      return t.codigo; }).join(', ') + '.');
  }

  var destinos = indexarPor_(tablero.destinos, 'localidad');
  var tramos = R.tramos.filter(function (t) {
    return t.tecnicos.indexOf(codigoTecnico) !== -1; });

  if (!tramos.length) {
    throw new Error(codigoTecnico + ' (' + tecnico.nombre + ') no tiene tramos asignados ' +
                    'en el plan vigente.');
  }

  var transferencia = R.transferencias.filter(function (x) {
    return x.tecnico === codigoTecnico; })[0] || {};
  var resumen = R.porTecnico.filter(function (x) {
    return x.tecnico === codigoTecnico; })[0] || {};

  var html = armarHtmlOrden_(tecnico, tramos, transferencia, resumen, destinos,
                            tablero, R);

  var nombre = 'Orden de servicio ' + codigoTecnico + ' ' +
               tecnico.nombre.replace(/\s+/g, ' ') + ' ' + R.escenario + '.pdf';
  var pdf = HtmlService.createHtmlOutput(html).getAs('application/pdf').setName(nombre);

  var carpetaId = PropertiesService.getScriptProperties().getProperty('ID_CARPETA_DRIVE');
  var destino = carpetaId ? DriveApp.getFolderById(carpetaId) : DriveApp.getRootFolder();
  var archivo = destino.createFile(pdf);

  registrarBitacora_(obtenerLibro_(), 'ORDEN_PDF', codigoTecnico + ' -> ' + archivo.getUrl());
  return archivo;
}

/** HTML de la orden. Se usa para el PDF y tambien lo reutiliza la interfaz. */
function armarHtmlOrden_(tecnico, tramos, transferencia, resumen, destinos, tablero, R) {
  var htmlSeguro = function (v) { return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); };
  var sanear = function (obj) { if (typeof obj === 'string') return htmlSeguro(obj); if (Array.isArray(obj)) return obj.map(sanear); if (obj && typeof obj === 'object') { var copia={}; Object.keys(obj).forEach(function(k){ copia[k]=sanear(obj[k]); }); return copia; } return obj; };
  tecnico = sanear(tecnico); tramos = sanear(tramos); resumen = sanear(resumen);
  var destinosSeguros = {}; Object.keys(destinos).forEach(function(k){destinosSeguros[htmlSeguro(k)] = sanear(destinos[k]);}); destinos = destinosSeguros;
  tablero = Object.assign({}, tablero, {checklist: sanear(tablero.checklist)});
  var pesos = function (n) { return formatearPesos_(n || 0); };
  var fecha = function (dia) {
    var f = tablero.fechas[dia];
    if (!f) return dia;
    var d = new Date(f);
    return Utilities.formatDate(d, APP.ZONA_HORARIA, 'EEE dd-MM-yyyy');
  };

  var filas = tramos.map(function (t) {
    var d = destinos[t.hasta] || {};
    return '<tr>' +
      '<td>' + t.dia + '<br><span class="chico">' + fecha(t.dia) + '</span></td>' +
      '<td>' + t.cuadrilla + '<br><span class="chico">' + t.vehiculo +
        (t.conductor === tecnico.codigo ? ' · CONDUCE' : '') + '</span></td>' +
      '<td><b>' + t.desde + ' → ' + t.hasta + '</b><br>' +
        '<span class="chico">' + (d.direccion || '') + '</span></td>' +
      '<td class="c">' + (t.equipos || '—') + '</td>' +
      '<td class="c">' + t.horasTramo.toFixed(2) + ' h<br>' +
        '<span class="chico">' + t.km + ' km</span></td>' +
      '<td>' + (t.noches ? '<b>' + t.noches + ' noche(s)</b><br><span class="chico">' +
        (d.hotel || 'Por confirmar') + '</span>' : '—') + '</td>' +
      '</tr>';
  }).join('');

  var checklist = (tablero.checklist || []).map(function (c) {
    return '<div class="item">☐ ' + c.item + '</div>';
  }).join('');

  var avisoCapacitacion = R.parametros.P_CAP_DIGITAL_PREVIA
    ? '<div class="aviso"><b>ANTES DE SALIR:</b> confirme que al cliente se le envio el ' +
      'correo con el enlace de Drive de la capacitacion. La visita presencial esta ' +
      'planificada en ' + (R.parametros.P_T_CAP_EFECTIVA * 60) + ' minutos justamente ' +
      'porque el cliente ya vio el material. Si no se envio, la visita se alarga.</div>'
    : '';

  return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#222;margin:24px}' +
    'h1{font-size:17px;color:#1F3864;margin:0 0 2px}' +
    'h2{font-size:13px;color:#C00000;margin:18px 0 6px;' +
      'border-bottom:2px solid #C00000;padding-bottom:3px}' +
    '.sub{color:#666;margin-bottom:14px}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:10px}' +
    'th{background:#1F3864;color:#fff;padding:6px;text-align:left;font-size:10px}' +
    'td{border:1px solid #ccc;padding:6px;vertical-align:top}' +
    '.c{text-align:center}.chico{color:#666;font-size:9px}' +
    '.caja{border:1px solid #ccc;padding:10px;margin-bottom:10px;background:#f7f7f7}' +
    '.monto{font-size:22px;color:#C00000;font-weight:bold}' +
    '.item{padding:3px 0;border-bottom:1px dotted #ddd}' +
    '.aviso{background:#FFF2CC;border-left:4px solid #E8A33D;padding:9px;margin:10px 0}' +
    '.cols{display:table;width:100%}.col{display:table-cell;width:50%;padding-right:14px}' +
    '</style></head><body>' +

    '<h1>Orden de servicio · ' + tecnico.codigo + ' · ' + tecnico.nombre + '</h1>' +
    '<div class="sub">' + APP.NOMBRE + ' · ' + APP.CASO + '<br>' +
      'Escenario: ' + htmlSeguro(definicionEscenario_(R.escenario).titulo) + '<br>' +
      'Licencia de conducir: <b>' + tecnico.licencia + '</b> · Generada el ' +
      Utilities.formatDate(new Date(), APP.ZONA_HORARIA, 'dd-MM-yyyy HH:mm') + '</div>' +

    '<div class="aviso">Documento de planificación. Peajes, tiempos y alojamiento requieren confirmación. ' +
      'No acredita trabajos realizados, reservas ni pagos.' +
      ((R.alertas || []).some(function (a) { return a.nivel === 'error'; })
        ? '<br><b>BORRADOR CON ERRORES: revisar las alertas del tablero antes de ejecutar la salida.</b>' : '') + '</div>' +

    '<div class="cols"><div class="col">' +
      '<div class="caja"><b>Monto a transferir</b><br>' +
      '<span class="monto">' + pesos(transferencia.total) + '</span><br>' +
      '<span class="chico">Viatico ' + pesos(transferencia.viatico) +
      ' · Hotel ' + pesos(transferencia.hotel) +
      ' · Combustible ' + pesos(transferencia.combustible) +
      ' · Peajes ' + pesos(transferencia.peajes) +
      ' · Imprevistos ' + pesos(transferencia.imprevistos) + '</span></div>' +
    '</div><div class="col">' +
      '<div class="caja"><b>Su carga en el periodo</b><br>' +
      (resumen.dias || 0) + ' dias · ' + (resumen.noches || 0) + ' noches fuera<br>' +
      (resumen.horas || 0) + ' h asignadas · ' + (resumen.nLocalidades || 0) +
        ' localidades<br>' +
      'Utilizacion ' + Math.round((resumen.utilizacion || 0) * 100) + '%' +
      (resumen.diagnostico ? ' · ' + resumen.diagnostico.etiqueta : '') + '</div>' +
    '</div></div>' +

    '<h2>Hoja de ruta</h2>' +
    '<table><tr><th>Dia</th><th>Cuadrilla</th><th>Tramo y direccion</th>' +
    '<th>Equipos</th><th>Tiempo</th><th>Pernocta</th></tr>' + filas + '</table>' +

    avisoCapacitacion +

    '<h2>Implementos y materiales · marque antes de salir</h2>' + checklist +

    '<div class="aviso" style="margin-top:16px">Firma del tecnico: ' +
    '_______________________________ &nbsp;&nbsp; Fecha: ______________</div>' +

    '</body></html>';
}

/** La interfaz la llama para exportar sin pasar por el menu. */
function exportarOrdenDesdeApi(token, codigoTecnico, escenario) {
  exigirSesion_(token);
  var archivo = exportarOrdenPDF_(codigoTecnico, escenario);
  return { ok: true, nombre: archivo.getName(), url: archivo.getUrl() };
}

/* ==========================================================================
 * D. PRUEBAS
 * ========================================================================== */

/**
 * Verifica los invariantes del caso contra el plan vigente y escribe el
 * resultado en el registro. Se ejecuta desde el editor de Apps Script.
 */
function ejecutarPruebas_() {
  var lineas = [];
  var fallas = 0;

  var comprobar = function (nombre, obtenido, esperado, tolerancia) {
    var ok = (typeof esperado === 'number')
      ? Math.abs(obtenido - esperado) <= (tolerancia || 0)
      : obtenido === esperado;
    if (!ok) fallas++;
    lineas.push((ok ? '  OK   ' : '  FALLA') + ' · ' + nombre +
                ': obtenido ' + obtenido + ', esperado ' + esperado);
  };

  try {
    var payload = construirTablero_('OPERACION_REAL');
    var T = payload.resultado.totales;
    var I = INVARIANTES_CASO;

    lineas.push('PRUEBAS · ' + APP.NOMBRE + ' v' + APP.VERSION);
    lineas.push('Escenario: ' + payload.escenarioActivo);
    lineas.push('');

    comprobar('Equipos instalados', T.equipos, I.equiposTotales);
    comprobar('Localidades atendidas', T.localidades, I.localidades);
    comprobar('Capacitaciones', T.capacitaciones,
              I.capacitacionesPorEscenario.OPERACION_REAL);
    comprobar('Cuadrillas-dia fuera de ley', T.fueraDeLey, 0);

    // La regla de paralelizacion, que es la que mas se malinterpreta.
    var p = payload.resultado.parametros;
    comprobar('3 equipos con 3 tecnicos son 2 h de instalacion',
              horasEnSitio_(3, 3, true, p).instalacion, 2, 0.01);
    comprobar('5 equipos con 3 tecnicos son 4 h de instalacion',
              horasEnSitio_(5, 3, true, p).instalacion, 4, 0.01);
    comprobar('Una visita de 3 equipos son 2,25 h en sitio',
              horasEnSitio_(3, 3, true, p).total, 2.25, 0.01);
    comprobar('Segunda visita no ejecuta trabajo',
              horasEnSitio_(3, 3, false, p).total, 0, 0.001);

    // El peaje a San Antonio contra el total oficial del MOP.
    comprobar('Peaje a San Antonio coincide con el MOP',
              peajeDesdeBase_('San Antonio', p, {}).total, 4008, 5);

    // Todo tecnico desplegado tiene monto calculado.
    var sinMonto = payload.resultado.transferencias.filter(function (t) {
      return !t.total; }).length;
    comprobar('Tecnicos desplegados sin monto de transferencia', sinMonto, 0);

    lineas.push('');
    lineas.push(fallas === 0
      ? 'RESULTADO: las ' + (lineas.length - 4) + ' comprobaciones pasaron.'
      : 'RESULTADO: ' + fallas + ' comprobaciones FALLARON.');

    var errores = payload.resultado.alertas.filter(function (a) {
      return a.nivel === 'error'; });
    if (errores.length) {
      lineas.push('');
      lineas.push('El plan vigente tiene ' + errores.length + ' errores de validacion:');
      errores.forEach(function (a) { lineas.push('  · ' + a.mensaje); });
    }

  } catch (err) {
    lineas.push('ERROR AL EJECUTAR LAS PRUEBAS: ' + err.message);
    fallas++;
  }

  var texto = lineas.join('\n');
  Logger.log(texto);
  return texto;
}
