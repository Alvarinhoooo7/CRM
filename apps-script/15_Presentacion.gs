/** Entrada sencilla para la presentación. Los importes son supuestos editables. */
var CONFIG_BASICA = ['SEMANA_PLANIFICACION', 'TIEMPO_INSTALACION_MIN',
  'TIEMPO_CAPACITACION_MIN', 'VALOR_ALOJAMIENTO_DIA', 'VALOR_VIATICO_DIA',
  'VALOR_VIATICO_SIN_PERNOCTAR', 'FONDO_A_RENDIR_HOLGURA',
  'PRECIO_DIESEL_LTS', 'TARIFA_METRO_MICRO_VIAJE', 'TARIFA_BUS_CLP_KM'];
var HOJAS_VISIBLES = [SH.CONFIG, SH.REQUERIMIENTOS, SH.OT, SH.ITINERARIO, SH.VIATICOS, SH.GASTOS];

function simplificarConfiguracion() {
  var valores = _cargarConfig();
  var avanzada = {};
  Object.keys(valores).forEach(function (k) {
    if (CONFIG_BASICA.indexOf(k) === -1) avanzada[k] = valores[k];
  });
  PropertiesService.getScriptProperties().setProperty('CONFIG_AVANZADA', JSON.stringify(avanzada));
  var filas = CONFIG_DEFAULTS.filter(function (d) { return CONFIG_BASICA.indexOf(d[0]) !== -1; })
    .map(function (d) { return { CLAVE: d[0], VALOR: Object.prototype.hasOwnProperty.call(valores, d[0]) ? valores[d[0]] : d[1],
      TIPO: d[2], UNIDAD: d[3], DESCRIPCION: d[4], GRUPO: d[5] }; });
  dbReemplazar(SH.CONFIG, filas);
  _configCache = null;
}

function aplicarVistaSimple() {
  var ss = libro();
  HOJAS_VISIBLES.forEach(function (n) { var h = ss.getSheetByName(n); if (h) h.showSheet(); });
  ORDEN_HOJAS.forEach(function (n) { var h = ss.getSheetByName(n); if (h && HOJAS_VISIBLES.indexOf(n) === -1) h.hideSheet(); });
}
function mostrarHojasAuxiliares() {
  ORDEN_HOJAS.forEach(function (n) { var h = libro().getSheetByName(n); if (h) h.showSheet(); });
}

function prepararDemo() {
  instalarCRM();
  var matriz = dbLeer(SH.MATRIZ);
  if (matriz.some(function (r) { return r.FUENTE === 'CARGA_MANUAL_RUTA_REAL'; })) {
    matriz.forEach(function (r) { if (r.FUENTE === 'CARGA_MANUAL_RUTA_REAL') r.FUENTE = 'DEMO_ESTIMADA'; });
    dbReemplazar(SH.MATRIZ, matriz);
    _matrizCache = null;
  }
  // Completa solamente IDs faltantes; conserva cambios y estados existentes.
  var existentes = indexarPor(dbLeer(SH.REQUERIMIENTOS), 'REQ_ID');
  var destinos = indexarPor(dbLeer(SH.DESTINOS), 'DESTINO_ID');
  SEED_REQUERIMIENTOS.forEach(function (r) {
    if (!existentes[r[0]] && destinos[r[1]]) dbInsertar(SH.REQUERIMIENTOS, {
      REQ_ID: r[0], DESTINO_ID: r[1], COMUNA: destinos[r[1]].COMUNA,
      CLIENTE: 'Cliente simulado', EQUIPOS: r[2], REQUIERE_CAPACITACION: 'SI',
      TIPO_SERVICIO: 'Instalacion y capacitacion', PRIORIDAD: r[3],
      FECHA_SOLICITUD: new Date(), ESTADO: 'PENDIENTE', OBSERVACION: 'DEMO'
    });
  });
  var base = dbUno(SH.DESTINOS, { DESTINO_ID: BASE_ID });
  if (base && base.DIRECCION.indexOf('Salvador Allende') !== -1) {
    dbActualizar(SH.DESTINOS, 'DESTINO_ID', BASE_ID, { DIRECCION: APP.BASE_DIRECCION,
      COMUNA: 'Macul', LAT: APP.BASE_LAT, LNG: APP.BASE_LNG });
    dbEliminar(SH.MATRIZ, { ORIGEN_ID: BASE_ID });
    dbEliminar(SH.MATRIZ, { DESTINO_ID: BASE_ID });
    _matrizCache = null;
  }
  if (!dbLeer(SH.OT).length) planificarSemana();
  abrirPresentacion();
  return 'Demostracion cargada: 16 localidades, 33 equipos y capacitacion por equipo.';
}

function abrirPresentacion() {
  SpreadsheetApp.getUi().showModelessDialog(
    HtmlService.createHtmlOutputFromFile('Presentacion').setWidth(1200).setHeight(800),
    'Planificación desde INACAP Santiago Sur');
}

function _validarReplanificacion() {
  if (dbLeer(SH.OT).some(function (o) { return o.HORA_INICIO_REAL || ['EN_EJECUCION', 'COMPLETADA', 'NO_REALIZADA'].indexOf(o.ESTADO) !== -1; }) ||
      dbLeer(SH.VIATICOS).some(function (v) { return v.ESTADO !== 'CALCULADO'; }) ||
      dbLeer(SH.GASTOS).some(function (g) { return g.ESTADO !== 'BORRADOR'; })) {
    throw new Error('Este plan ya tiene ejecucion, transferencias o rendiciones. Use un libro de demo nuevo para simular otra planificacion.');
  }
}

/** JSON elimina objetos Date no admitidos por google.script.run. */
function apiPresentacion() {
  var destinos = indexarPor(dbLeer(SH.DESTINOS), 'DESTINO_ID');
  var req = dbLeer(SH.REQUERIMIENTOS).map(function (r) {
    var d = destinos[r.DESTINO_ID] || {};
    var ruta = tramo(BASE_ID, r.DESTINO_ID);
    return { id: r.DESTINO_ID, comuna: r.COMUNA, equipos: r.EQUIPOS, direccion: d.DIRECCION,
      estado: r.ESTADO, km: ruta.km, minutos: ruta.min, fuente: ruta.fuente };
  });
  return JSON.parse(JSON.stringify({ base: APP.BASE_DIRECCION, requerimientos: req,
    semana: cfg('SEMANA_PLANIFICACION'), tesoreria: resumenTesoreria(),
    ot: dbLeer(SH.OT), itinerario: dbLeer(SH.ITINERARIO), cuadrillas: dbLeer(SH.CUADRILLAS),
    configuracion: CONFIG_DEFAULTS.filter(function (d) { return CONFIG_BASICA.indexOf(d[0]) !== -1; })
      .map(function (d) { return { clave: d[0], valor: cfg(d[0]), unidad: d[3], descripcion: d[4] }; }),
    mapsConfigurado: !!cfg('GOOGLE_MAPS_API_KEY', '') }));
}

/** Operaciones UI con el mismo token de la API; nunca se devuelve la clave. */
function apiAccionPresentacion(token, accion, datos) {
  if (!_tokenValido(token)) throw new Error('Ingrese el token de coordinación para guardar o calcular.');
  datos = datos || {};
  var resultado;
  switch (accion) {
    case 'planificar': resultado = planificarSemana(); break;
    case 'config':
      var cambios = datos.valores || {};
      Object.keys(cambios).forEach(function (k) {
        if (CONFIG_BASICA.indexOf(k) === -1) throw new Error('Parametro no editable.');
        if (k === 'SEMANA_PLANIFICACION') {
          if (!/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(String(cambios[k]))) throw new Error('Semana invalida: use 2026-W38.');
        } else if (!isFinite(Number(cambios[k])) || Number(cambios[k]) < 0 ||
          (/TIEMPO_|TARIFA_/.test(k) && Number(cambios[k]) === 0) ||
          (k === 'FONDO_A_RENDIR_HOLGURA' && Number(cambios[k]) > 1)) throw new Error('Valor invalido: ' + k);
      });
      Object.keys(cambios).forEach(function (k) { setCfg(k, k === 'SEMANA_PLANIFICACION' ? cambios[k] : Number(cambios[k])); });
      resultado = { mensaje: 'Configuracion guardada. Pulse Planificar para actualizar agenda y presupuesto.' }; break;
    case 'mapsKey':
      setCfg('GOOGLE_MAPS_API_KEY', String(datos.key || '').trim());
      resultado = { mensaje: 'Conexion guardada. La clave queda en el servidor.' }; break;
    case 'ruta': resultado = guardarDireccionYCalcularRuta_(datos); break;
    case 'guardarRuta': resultado = confirmarRuta_(datos.previewId); break;
    case 'iniciarOT': resultado = iniciarOT(datos.otId, datos.tecnicoId, datos.lat, datos.lng); break;
    case 'finalizarOT': resultado = finalizarOT(datos); break;
    default: throw new Error('Accion no disponible.');
  }
  return JSON.parse(JSON.stringify(resultado));
}

function verTokenIntegracion() {
  _alerta('Token de coordinación / AppSheet', String(cfg('WEBHOOK_SECRET')));
}
