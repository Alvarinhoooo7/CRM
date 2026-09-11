/**
 * ============================================================================
 *  CRM SERVICIO TECNICO EN RUTA  ·  00_Config.gs
 *  Parametros globales, catalogo de hojas y acceso a la hoja CONFIG.
 * ============================================================================
 *  Toda constante economica u operacional editable por el usuario vive en la
 *  hoja CONFIG del spreadsheet, NO en el codigo. Este archivo solo declara los
 *  valores por defecto con los que se siembra esa hoja la primera vez.
 * ============================================================================
 */

var APP = {
  NOMBRE: 'CRM Servicio Tecnico en Ruta',
  VERSION: '1.1.0',
  TZ: 'America/Santiago',
  MONEDA: 'CLP',
  BASE_NOMBRE: 'INACAP Sede Santiago Sur',
  BASE_DIRECCION: 'Av. Salvador Allende 4900, San Miguel, Region Metropolitana',
  BASE_LAT: -33.5089,
  BASE_LNG: -70.6531
};

/** Nombres canonicos de todas las hojas del libro. */
var SH = {
  CONFIG:         'CONFIG',
  TECNICOS:       'TECNICOS',
  VEHICULOS:      'VEHICULOS',
  DESTINOS:       'DESTINOS',
  MATRIZ:         'MATRIZ_DISTANCIAS',
  REQUERIMIENTOS: 'REQUERIMIENTOS',
  CUADRILLAS:     'CUADRILLAS',
  OT:             'ORDENES_TRABAJO',
  ITINERARIO:     'ITINERARIO',
  GASTOS:         'GASTOS',
  VIATICOS:       'VIATICOS',
  MARCAS:         'MARCAS_TIEMPO',
  MATERIALES:     'MATERIALES',
  HOTELES:        'HOTELES',
  CAPACITACION:   'CAPACITACIONES',
  TARIFAS_AEREAS: 'TARIFAS_AEREAS',
  COMBUSTIBLE:    'PRECIOS_COMBUSTIBLE',
  KPI_TECNICO:    'KPI_TECNICO',
  KPI_SEMANAL:    'KPI_SEMANAL',
  RENTABILIDAD:   'RENTABILIDAD',
  CALENDARIO:     'CALENDARIO',
  LOG:            'LOG'
};

/**
 * Valores por defecto de la hoja CONFIG.
 * Formato: [clave, valor, tipo, unidad, descripcion, grupo]
 */
var CONFIG_DEFAULTS = [
  // --- Combustible y vehiculo -------------------------------------------
  ['PRECIO_DIESEL_LTS',              1100,  'number', 'CLP/L',  'Precio litro diesel. Se actualiza con API CNE.', 'COMBUSTIBLE'],
  ['PRECIO_GASOLINA_93_LTS',         1350,  'number', 'CLP/L',  'Precio litro gasolina 93. Se actualiza con API CNE.', 'COMBUSTIBLE'],
  ['RENDIMIENTO_KM_LTS',             20,    'number', 'km/L',   'Rendimiento Peugeot Partner (dato del caso).', 'COMBUSTIBLE'],
  ['FACTOR_CARGA_RENDIMIENTO',       0.90,  'number', 'factor', 'Castigo al rendimiento con camioneta cargada.', 'COMBUSTIBLE'],
  ['ACTUALIZAR_PRECIO_COMB_AUTO',    true,  'bool',   '',       'Consultar API CNE al planificar.', 'COMBUSTIBLE'],

  // --- Viaticos y estadia -----------------------------------------------
  ['VALOR_ALOJAMIENTO_DIA',          50000, 'number', 'CLP',    'Tope por noche de hotel por tecnico.', 'VIATICOS'],
  ['VALOR_VIATICO_DIA',              20000, 'number', 'CLP',    'Viatico diario con pernoctacion.', 'VIATICOS'],
  ['VALOR_VIATICO_SIN_PERNOCTAR',    20000, 'number', 'CLP',    'Viatico dia en terreno con retorno a casa.', 'VIATICOS'],
  ['ANTICIPO_PORCENTAJE',            1.00,  'number', 'factor', 'Porcentaje del viatico transferido por anticipado.', 'VIATICOS'],
  ['FONDO_A_RENDIR_HOLGURA',         0.15,  'number', 'factor', 'Holgura sobre combustible+peajes para imprevistos.', 'VIATICOS'],

  // --- Tiempos de servicio ----------------------------------------------
  ['TIEMPO_INSTALACION_MIN',         120,   'number', 'min',    'Tiempo de instalacion por equipo (dato del caso).', 'SERVICIO'],
  ['TIEMPO_CAPACITACION_MIN',        30,    'number', 'min',    'Tiempo de capacitacion por equipo (dato del caso).', 'SERVICIO'],
  ['CAPACITACION_MODO',              'PRESENCIAL', 'text', '',  'PRESENCIAL | VIDEO_ASINCRONICO | MIXTO', 'SERVICIO'],
  ['CAPACITACION_VIDEO_URL',         '',    'text',   'url',    'Video enviado al cliente en modo asincronico.', 'SERVICIO'],
  ['TIEMPO_SETUP_SITIO_MIN',         15,    'number', 'min',    'Estacionar, ingresar, protocolo de acceso.', 'SERVICIO'],

  // --- Jornada laboral (Ley 21.561) -------------------------------------
  ['HORAS_SEMANALES_LEGALES',        42,    'number', 'h',      'Jornada semanal legal vigente.', 'JORNADA'],
  ['JORNADA_DIARIA_NORMAL_H',        8.4,   'number', 'h',      '42 h distribuidas en 5 dias.', 'JORNADA'],
  ['JORNADA_DIARIA_MAX_H',           10,    'number', 'h',      'Tope diario con horas extra.', 'JORNADA'],
  ['HORAS_EXTRA_MAX_SEMANA',         10,    'number', 'h',      'Tope legal de horas extraordinarias.', 'JORNADA'],
  ['RECARGO_HORA_EXTRA',             1.5,   'number', 'factor', 'Recargo 50% sobre hora ordinaria.', 'JORNADA'],
  ['COLACION_MIN',                   60,    'number', 'min',    'Colacion de 1 hora.', 'JORNADA'],
  ['COLACION_IMPUTABLE',             false, 'bool',   '',       'Si FALSE no cuenta como hora trabajada.', 'JORNADA'],
  ['HORA_INICIO_JORNADA',            '08:00', 'text', 'hh:mm',  'Hora mas temprana de inicio en sitio.', 'JORNADA'],
  ['HORA_FIN_JORNADA',               '18:00', 'text', 'hh:mm',  'Hora objetivo de termino.', 'JORNADA'],
  ['HORA_SALIDA_VIAJE_LARGO',        '07:00', 'text', 'hh:mm',  'Hora de salida para tramos sobre 150 km.', 'JORNADA'],
  ['VENTANA_COLACION_DESDE',         '12:30', 'text', 'hh:mm',  'Inicio de la ventana de colacion.', 'JORNADA'],
  ['VENTANA_COLACION_HASTA',         '15:00', 'text', 'hh:mm',  'Fin de la ventana de colacion.', 'JORNADA'],

  // --- Descanso y viajes -------------------------------------------------
  ['HORA_LLEGADA_NOCTURNA',          '21:00', 'text', 'hh:mm',  'Sobre esta hora la llegada es nocturna.', 'DESCANSO'],
  ['DESCANSO_POST_VIAJE_NOCTURNO_H', 10,    'number', 'h',      'Descanso minimo si llega de noche.', 'DESCANSO'],
  ['DESCANSO_POST_VIAJE_DIURNO_H',   0.5,   'number', 'h',      'Pausa tras tramo diurno antes de operar.', 'DESCANSO'],
  ['DESCANSO_ENTRE_JORNADAS_H',      12,    'number', 'h',      'Descanso minimo entre fin y nuevo inicio.', 'DESCANSO'],
  ['CONDUCCION_CONTINUA_MAX_H',      4.5,   'number', 'h',      'Maximo al volante sin pausa.', 'DESCANSO'],
  ['PAUSA_CONDUCCION_MIN',           30,    'number', 'min',    'Pausa obligatoria tras conduccion continua.', 'DESCANSO'],
  ['VIAJE_CUENTA_COMO_TRABAJO',      true,  'bool',   '',       'El traslado se imputa a la jornada.', 'DESCANSO'],

  // --- Velocidades y umbrales de ruteo ----------------------------------
  ['VEL_CARRETERA_KMH',              88,    'number', 'km/h',   'Velocidad media efectiva en ruta.', 'RUTEO'],
  ['VEL_URBANA_KMH',                 28,    'number', 'km/h',   'Velocidad media efectiva urbana.', 'RUTEO'],
  ['UMBRAL_KM_PERNOCTAR',            250,   'number', 'km',     'Sobre esta distancia se evalua alojamiento.', 'RUTEO'],
  ['UMBRAL_KM_EVALUAR_VUELO',        400,   'number', 'km',     'Sobre esta distancia se cotiza avion y bus.', 'RUTEO'],
  ['PEAJE_FALLBACK_CLP_KM',          26,    'number', 'CLP/km', 'Peaje estimado por km si no hay dato de tramo.', 'RUTEO'],
  ['USAR_MAPS_API',                  true,  'bool',   '',       'Usar Google Distance Matrix para km reales.', 'RUTEO'],
  ['CACHE_MATRIZ_DIAS',              30,    'number', 'dias',   'Vigencia del cache de distancias.', 'RUTEO'],

  // --- Costos y transporte alternativo ----------------------------------
  ['COSTO_HORA_TECNICO',             6500,  'number', 'CLP/h',  'Costo empresa por hora-tecnico.', 'COSTOS'],
  ['ARRIENDO_VEHICULO_DIA',          45000, 'number', 'CLP',    'Arriendo de vehiculo en destino si se vuela.', 'TRANSPORTE'],
  ['TRASLADO_AEROPUERTO_CLP',        25000, 'number', 'CLP',    'Traslado terminal-ciudad por trayecto.', 'TRANSPORTE'],
  ['CHECKIN_AEROPUERTO_MIN',         90,    'number', 'min',    'Tiempo previo al vuelo.', 'TRANSPORTE'],
  ['SALIDA_AEROPUERTO_MIN',          30,    'number', 'min',    'Retiro de equipaje y salida.', 'TRANSPORTE'],
  ['VEL_BUS_KMH',                    72,    'number', 'km/h',   'Velocidad media bus interurbano.', 'TRANSPORTE'],
  ['TARIFA_BUS_CLP_KM',              32,    'number', 'CLP/km', 'Tarifa referencial semi cama por km.', 'TRANSPORTE'],
  ['FLETE_EQUIPO_CLP',               24000, 'number', 'CLP',    'Despacho por carga de un equipo a regiones.', 'TRANSPORTE'],
  ['EQUIPOS_DESPACHADOS_POR_CARGA',  false, 'bool',   '',       'Si TRUE el avion es viable (no se lleva carga).', 'TRANSPORTE'],
  ['PESO_HORA_VIAJE_EN_DECISION',    1.0,   'number', 'factor', 'Peso del costo de oportunidad al elegir modo.', 'TRANSPORTE'],

  // --- Transporte urbano y menor (tecnico sin camioneta) -----------------
  ['TARIFA_METRO_MICRO_VIAJE',       900,   'number', 'CLP',    'Pasaje Red integrado por viaje.', 'TRANSPORTE'],
  ['VEL_TRANSPORTE_PUBLICO_KMH',     18,    'number', 'km/h',   'Velocidad puerta a puerta en metro/micro.', 'TRANSPORTE'],
  ['UBER_TARIFA_BASE',               1500,  'number', 'CLP',    'Banderazo de app de transporte.', 'TRANSPORTE'],
  ['UBER_CLP_KM',                    750,   'number', 'CLP/km', 'Tarifa variable por km.', 'TRANSPORTE'],
  ['UBER_CLP_MIN',                   120,   'number', 'CLP/min','Tarifa variable por minuto.', 'TRANSPORTE'],
  ['VEL_UBER_KMH',                   26,    'number', 'km/h',   'Velocidad media puerta a puerta en auto app.', 'TRANSPORTE'],

  // --- Dimensionamiento de cuadrilla (flexible) -------------------------
  ['CUADRILLA_MIN',                  1,     'number', 'tec',    'Minimo de tecnicos por despacho.', 'CUADRILLA'],
  ['CUADRILLA_MAX',                  4,     'number', 'tec',    'Maximo de tecnicos por despacho.', 'CUADRILLA'],
  ['PERMITE_TECNICO_SOLO',           true,  'bool',   '',       'Autoriza despachar un tecnico sin acompanante.', 'CUADRILLA'],
  ['MIN_DUPLA_SOBRE_KM',             350,   'number', 'km',     'Sobre esta distancia se exigen 2 tecnicos (seguridad).', 'CUADRILLA'],
  ['MIN_DUPLA_SOBRE_EQUIPOS',        3,     'number', 'equipos','Sobre esta carga de sitio se exigen 2 tecnicos.', 'CUADRILLA'],

  // --- Carga fisica (define si cabe transporte publico) ------------------
  ['EQUIPO_PESO_KG',                 18,    'number', 'kg',     'Peso de un equipo embalado.', 'CARGA'],
  ['HERRAMIENTAS_PESO_KG',           12,    'number', 'kg',     'Maletin de herramientas del tecnico.', 'CARGA'],
  ['PESO_MAX_TRANSPORTE_PUBLICO_KG', 25,    'number', 'kg',     'Tope razonable en metro/micro por persona.', 'CARGA'],
  ['PESO_MAX_UBER_KG',               60,    'number', 'kg',     'Tope razonable en auto de app.', 'CARGA'],
  ['EQUIPAJE_AVION_INCLUIDO_KG',     23,    'number', 'kg',     'Equipaje facturado incluido por pasajero.', 'CARGA'],
  ['COSTO_EQUIPAJE_EXTRA_CLP',       35000, 'number', 'CLP',    'Pieza adicional facturada en avion.', 'CARGA'],

  // --- Comercial ---------------------------------------------------------
  ['VALOR_SERVICIO_INSTALACION',     180000, 'number', 'CLP',   'Precio de venta por equipo instalado.', 'COMERCIAL'],
  ['VALOR_SERVICIO_CAPACITACION',    45000, 'number', 'CLP',    'Precio de venta por capacitacion.', 'COMERCIAL'],
  ['MARGEN_OBJETIVO',                0.35,  'number', 'factor', 'Margen bruto objetivo por servicio.', 'COMERCIAL'],
  ['COSTO_FIJO_SEMANAL',             850000, 'number', 'CLP',   'Overhead semanal prorrateado.', 'COMERCIAL'],

  // --- Operacion ---------------------------------------------------------
  ['TOTAL_TECNICOS',                 10,    'number', 'tec',    'Dotacion disponible.', 'OPERACION'],
  ['TOTAL_VEHICULOS',                6,     'number', 'veh',    'Flota disponible.', 'OPERACION'],
  ['SEMANA_PLANIFICACION',           '',    'text',   'ISO',    'Semana objetivo, formato 2026-W38.', 'OPERACION'],
  ['DIAS_HABILES',                   'LU,MA,MI,JU,VI', 'text', '', 'Dias planificables.', 'OPERACION'],

  // --- Integraciones -----------------------------------------------------
  ['GOOGLE_MAPS_API_KEY',            '',    'secret', '',       'Clave de Distance Matrix / Directions.', 'API'],
  ['AMADEUS_CLIENT_ID',              '',    'secret', '',       'Cliente API tarifas aereas (Amadeus self-service).', 'API'],
  ['AMADEUS_CLIENT_SECRET',          '',    'secret', '',       'Secreto API tarifas aereas.', 'API'],
  ['CNE_API_TOKEN',                  '',    'secret', '',       'Token API CNE (precios de bencineras).', 'API'],
  ['WEBHOOK_SECRET',                 '',    'secret', '', 'Clave compartida del endpoint REST. Se genera al instalar; reemplacela al integrar un consumidor externo.', 'API'],
  ['NOTIFICAR_EMAIL',                '',    'text',   'email',  'Correo del coordinador para alertas.', 'API']
];

/** Cache en memoria de la hoja CONFIG dentro de una misma ejecucion. */
var _configCache = null;

/** Devuelve el valor tipado de una clave de CONFIG. */
function cfg(clave, porDefecto) {
  if (!_configCache) _configCache = _cargarConfig();
  if (Object.prototype.hasOwnProperty.call(_configCache, clave)) return _configCache[clave];
  if (typeof porDefecto !== 'undefined') return porDefecto;
  for (var i = 0; i < CONFIG_DEFAULTS.length; i++) {
    if (CONFIG_DEFAULTS[i][0] === clave) return CONFIG_DEFAULTS[i][1];
  }
  throw new Error('Clave de configuracion desconocida: ' + clave);
}

function cfgNum(clave, porDefecto) { return Number(cfg(clave, porDefecto)) || 0; }

function cfgBool(clave, porDefecto) {
  var v = cfg(clave, porDefecto);
  return v === true || v === 1 || String(v).toUpperCase() === 'TRUE' || String(v).toUpperCase() === 'SI';
}

function _cargarConfig() {
  var hoja = libro().getSheetByName(SH.CONFIG);
  if (!hoja) return {};
  var datos = hoja.getDataRange().getValues();
  var mapa = {};
  for (var i = 1; i < datos.length; i++) {
    var clave = String(datos[i][0] || '').trim();
    if (!clave) continue;
    var valor = datos[i][1];
    var tipo = String(datos[i][2] || 'text');
    if (tipo === 'number') valor = Number(valor) || 0;
    if (tipo === 'bool') valor = (valor === true || String(valor).toUpperCase() === 'TRUE' || String(valor).toUpperCase() === 'SI');
    mapa[clave] = valor;
  }
  return mapa;
}

/** Escribe una clave de CONFIG y limpia el cache. */
function setCfg(clave, valor) {
  var hoja = libro().getSheetByName(SH.CONFIG);
  var datos = hoja.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][0]).trim() === clave) {
      hoja.getRange(i + 1, 2).setValue(valor);
      _configCache = null;
      return true;
    }
  }
  hoja.appendRow([clave, valor, typeof valor === 'number' ? 'number' : 'text', '', 'Agregada en runtime', 'CUSTOM']);
  _configCache = null;
  return true;
}

/** Genera una clave para el endpoint REST si el libro aun conserva una insegura. */
function asegurarWebhookSecret() {
  var actual = String(cfg('WEBHOOK_SECRET', '')).trim();
  if (actual && actual !== 'cambiar-esta-clave') return false;
  setCfg('WEBHOOK_SECRET', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));
  return true;
}

/** Libro activo, o el enlazado por ID en las propiedades del script. */
function libro() {
  var activo = SpreadsheetApp.getActiveSpreadsheet();
  if (activo) return activo;
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Sin spreadsheet activo. Defina la propiedad SPREADSHEET_ID.');
  return SpreadsheetApp.openById(id);
}
