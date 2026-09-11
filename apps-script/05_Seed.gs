/**
 * ============================================================================
 *  05_Seed.gs  ·  Datos maestros del caso de estudio.
 * ============================================================================
 *  Dotacion (10 tecnicos), flota (6 camionetas), las 16 localidades del caso
 *  con kilometraje real por carretera y peajes vigentes, los requerimientos
 *  (33 equipos) y los alojamientos convenidos.
 *
 *  Origen de los kilometrajes: rutas reales por Ruta 5 / Ruta 68 / Ruta 78
 *  desde INACAP Sede Santiago Sur (Av. Salvador Allende 4900, San Miguel).
 *  Se sobreescriben con valores exactos cuando GOOGLE_MAPS_API_KEY esta
 *  configurada (ver 06_Geo.gs > recalcularMatrizConMaps).
 * ============================================================================
 */

var BASE_ID = 'BASE';

/** [id, nombre, rut, cargo, email, fono, comuna, lat, lng, licencia, conduce, especialidad, nivel, costoHora] */
var SEED_TECNICOS = [
  ['T01', 'Sebastian Munoz Cortes',     '17.845.223-6', 'TECNICO_SENIOR',     'smunoz@servitec.cl',     '+56 9 8423 1178', 'San Miguel',      -33.4960, -70.6510, 'B', 'SI', 'Radioenlace / Microondas',      3, 7800],
  ['T02', 'Cristian Fuentes Ramirez',   '18.223.901-K', 'TECNICO_INSTALADOR', 'cfuentes@servitec.cl',   '+56 9 7712 4430', 'La Cisterna',     -33.5380, -70.6620, 'B', 'SI', 'Fibra optica / FTTH',           2, 6500],
  ['T03', 'Rodrigo Caceres Soto',       '16.990.447-2', 'TECNICO_SENIOR',     'rcaceres@servitec.cl',   '+56 9 9014 2265', 'Maipu',           -33.5110, -70.7580, 'A2','SI', 'Energia / UPS / Respaldo',      3, 7800],
  ['T04', 'Camila Vergara Nunez',       '19.556.128-4', 'TECNICO_INSTALADOR', 'cvergara@servitec.cl',   '+56 9 6688 9021', 'Santiago',        -33.4489, -70.6693, 'B', 'SI', 'Redes IP / Configuracion',      2, 6500],
  ['T05', 'Felipe Sandoval Rojas',      '17.334.882-9', 'TECNICO_INSTALADOR', 'fsandoval@servitec.cl',  '+56 9 5541 7783', 'Puente Alto',     -33.6111, -70.5756, 'B', 'SI', 'Instalacion / Montaje',         2, 6500],
  ['T06', 'Nicolas Tapia Aravena',      '18.771.035-1', 'TECNICO_INSTALADOR', 'ntapia@servitec.cl',     '+56 9 8890 3312', 'Pudahuel',        -33.4419, -70.7761, 'B', 'SI', 'Instalacion / Montaje',         1, 6000],
  ['T07', 'Marcela Ibanez Pizarro',     '16.442.719-7', 'SUPERVISOR',         'mibanez@servitec.cl',    '+56 9 7234 5590', 'Nunoa',           -33.4569, -70.5980, 'B', 'SI', 'Puesta en marcha / Capacitacion',4, 9200],
  ['T08', 'Jorge Valenzuela Leiva',     '15.887.664-0', 'TECNICO_SENIOR',     'jvalenzuela@servitec.cl','+56 9 9962 1147', 'San Bernardo',    -33.5920, -70.7000, 'A2','SI', 'Torres / Altura / Rigging',     3, 7800],
  ['T09', 'Daniela Contreras Miranda',  '19.882.340-5', 'TECNICO_INSTALADOR', 'dcontreras@servitec.cl', '+56 9 6120 8874', 'La Florida',      -33.5520, -70.5590, 'B', 'NO', 'Redes IP / Documentacion',      2, 6500],
  ['T10', 'Patricio Riquelme Fuentealba','17.108.256-3','TECNICO_INSTALADOR', 'priquelme@servitec.cl',  '+56 9 8345 6692', 'Estacion Central',-33.4610, -70.6790, 'B', 'SI', 'Fibra optica / Empalmes',       2, 6500]
];

/** [id, patente, modelo, anio, combustible, rendimiento, kg, pax, tag, estado, km] */
var SEED_VEHICULOS = [
  ['V01', 'KLRT-42', 'Peugeot Partner Maxi', 2022, 'DIESEL', 20, 850, 3, 'SI', 'DISPONIBLE', 84200],
  ['V02', 'KLRT-43', 'Peugeot Partner Maxi', 2022, 'DIESEL', 20, 850, 3, 'SI', 'DISPONIBLE', 91500],
  ['V03', 'JXPB-58', 'Peugeot Partner',      2021, 'DIESEL', 20, 700, 3, 'SI', 'DISPONIBLE', 128400],
  ['V04', 'JXPB-59', 'Peugeot Partner',      2021, 'DIESEL', 20, 700, 3, 'SI', 'DISPONIBLE', 133900],
  ['V05', 'HGVD-11', 'Peugeot Partner',      2020, 'DIESEL', 20, 700, 3, 'SI', 'DISPONIBLE', 176300],
  ['V06', 'HGVD-12', 'Peugeot Partner',      2020, 'DIESEL', 20, 700, 3, 'NO', 'MANTENCION',  188750]
];

/**
 * Destinos del caso.
 * [id, region, provincia, comuna, direccion, lat, lng, zona, km, min, peajeIda,
 *  iata, kmAeropuerto, metro, pernoctar]
 */
var SEED_DESTINOS = [
  [BASE_ID, 'Region Metropolitana', 'Santiago', 'San Miguel', APP.BASE_DIRECCION, APP.BASE_LAT, APP.BASE_LNG, 'BASE', 0, 0, 0, 'SCL', 28, 'SI', 'NO'],

  ['D01', 'Region de Atacama',        'Copiapo',    'Copiapo',              'Los Carrera 1263, Copiapo',                 -27.3668, -70.3323, 'NORTE',  805, 540, 27400, 'CPO', 50, 'NO', 'SI'],
  ['D02', 'Region de Coquimbo',       'Elqui',      'Coquimbo',             'Av. Costanera 1450, Coquimbo',              -29.9533, -71.3436, 'NORTE',  470, 315, 18900, 'LSC', 22, 'NO', 'SI'],
  ['D03', 'Region de Valparaiso',     'Quillota',   'La Calera',            'Av. Jose Joaquin Perez 240, La Calera',     -32.7861, -71.1906, 'CENTRO', 105,  80,  5400, 'SCL', 95, 'NO', 'NO'],
  ['D04', 'Region de Valparaiso',     'San Antonio','San Antonio',          'Av. Barros Luco 1801, San Antonio',         -33.5928, -71.6127, 'CENTRO', 105,  85,  5900, 'SCL', 118,'NO', 'NO'],
  ['D05', 'Region Metropolitana',     'Melipilla',  'Melipilla',            'Serrano 210, Melipilla',                    -33.6889, -71.2153, 'RM',      70,  62,  3200, 'SCL', 62, 'NO', 'NO'],
  ['D06', 'Region Metropolitana',     'Santiago',   'Lo Barnechea',         'Av. La Dehesa 1445, Lo Barnechea',          -33.3506, -70.5181, 'RM',      32,  48,     0, 'SCL', 42, 'NO', 'NO'],
  ['D07', 'Region Metropolitana',     'Cordillera', 'Puente Alto',          'Av. Concha y Toro 1820, Puente Alto',       -33.6111, -70.5756, 'RM',      22,  40,     0, 'SCL', 45, 'SI', 'NO'],
  ['D08', 'Region Metropolitana',     'Santiago',   'Santiago',             'Agustinas 1022, Santiago Centro',           -33.4489, -70.6693, 'RM',      12,  28,     0, 'SCL', 23, 'SI', 'NO'],
  ['D09', 'Region Metropolitana',     'Santiago',   'Pudahuel',             'Av. San Pablo 8450, Pudahuel',              -33.4419, -70.7761, 'RM',      25,  42,     0, 'SCL', 10, 'SI', 'NO'],
  ['D10', 'Region Metropolitana',     'Santiago',   'Maipu',                'Av. Pajaritos 2020, Maipu',                 -33.5110, -70.7580, 'RM',      18,  35,     0, 'SCL', 18, 'SI', 'NO'],
  ['D11', 'Region del Maule',         'Curico',     'Curico',               'Merced 351, Curico',                        -34.9828, -71.2394, 'SUR',    195, 140,  7800, 'SCL', 200,'NO', 'NO'],
  ['D12', 'Region del Maule',         'Talca',      'Talca',                '1 Sur 1150, Talca',                         -35.4264, -71.6554, 'SUR',    255, 178, 11500, 'SCL', 260,'NO', 'SI'],
  ['D13', 'Region del Biobio',        'Concepcion', 'San Pedro de la Paz',  'Av. Pedro Aguirre Cerda 1100, San Pedro',   -36.8420, -73.1050, 'SUR',    505, 350, 21300, 'CCP', 28, 'NO', 'SI'],
  ['D14', 'Region del Biobio',        'Concepcion', 'Penco',                'Freire 455, Penco',                         -36.7400, -72.9950, 'SUR',    520, 360, 21300, 'CCP', 22, 'NO', 'SI'],
  ['D15', 'Region del Biobio',        'Concepcion', 'Tome',                 'Sotomayor 1120, Tome',                      -36.6170, -72.9560, 'SUR',    540, 378, 21300, 'CCP', 38, 'NO', 'SI'],
  ['D16', 'Region del Biobio',        'Concepcion', 'Santa Juana',          'Bernardo OHiggins 380, Santa Juana',        -37.1720, -72.9400, 'SUR',    520, 368, 22100, 'CCP', 52, 'NO', 'SI']
];

/** Requerimientos del caso: 33 equipos en 16 localidades. */
var SEED_REQUERIMIENTOS = [
  ['R01', 'D01', 5, 'ALTA'],
  ['R02', 'D02', 2, 'NORMAL'],
  ['R03', 'D03', 1, 'NORMAL'],
  ['R04', 'D04', 2, 'NORMAL'],
  ['R05', 'D05', 2, 'NORMAL'],
  ['R06', 'D06', 3, 'NORMAL'],
  ['R07', 'D07', 1, 'NORMAL'],
  ['R08', 'D08', 3, 'ALTA'],
  ['R09', 'D09', 3, 'NORMAL'],
  ['R10', 'D10', 3, 'NORMAL'],
  ['R11', 'D11', 1, 'NORMAL'],
  ['R12', 'D12', 3, 'NORMAL'],
  ['R13', 'D13', 1, 'NORMAL'],
  ['R14', 'D14', 1, 'NORMAL'],
  ['R15', 'D15', 1, 'NORMAL'],
  ['R16', 'D16', 1, 'NORMAL']
];

/** [destinoId, nombre, direccion, fono, valorNoche, desayuno, estac, rating, kmSitio] */
var SEED_HOTELES = [
  ['D01', 'Hotel Chagall Copiapo',        'OHiggins 760, Copiapo',              '+56 52 235 2900', 48000, 'SI', 'SI', 4.1, 1.2],
  ['D01', 'Hotel Diego de Almagro',       'Av. Copayapu 650, Copiapo',          '+56 52 261 2400', 45000, 'SI', 'SI', 4.0, 2.4],
  ['D02', 'Hotel Costa Real La Serena',   'Av. Francisco de Aguirre 170',       '+56 51 222 1010', 49000, 'SI', 'SI', 4.2, 12.0],
  ['D02', 'Hotel Isla Damas Coquimbo',    'Videla 480, Coquimbo',               '+56 51 232 8800', 42000, 'SI', 'NO', 3.8, 1.8],
  ['D12', 'Hotel Diego de Almagro Talca', '2 Sur 1330, Talca',                  '+56 71 274 4600', 46000, 'SI', 'SI', 4.0, 0.9],
  ['D12', 'Hotel Casino Talca',           '1 Norte 1660, Talca',                '+56 71 220 1900', 50000, 'SI', 'SI', 4.1, 1.6],
  ['D13', 'Hotel Alborada Concepcion',    'Barros Arana 457, Concepcion',       '+56 41 291 1121', 47000, 'SI', 'SI', 4.0, 9.5],
  ['D13', 'Hotel Terrano Concepcion',     'OHiggins 340, Concepcion',           '+56 41 224 0078', 44000, 'SI', 'SI', 3.9, 10.2],
  ['D14', 'Hotel Alborada Concepcion',    'Barros Arana 457, Concepcion',       '+56 41 291 1121', 47000, 'SI', 'SI', 4.0, 13.0],
  ['D15', 'Hotel Alborada Concepcion',    'Barros Arana 457, Concepcion',       '+56 41 291 1121', 47000, 'SI', 'SI', 4.0, 29.0],
  ['D16', 'Hotel Terrano Concepcion',     'OHiggins 340, Concepcion',           '+56 41 224 0078', 44000, 'SI', 'SI', 3.9, 48.0]
];

/** Kit estandar que viaja con cada tecnico. Se replica por OT. */
var KIT_ESTANDAR = [
  ['Equipo a instalar (embalado)',   'EQUIPO',       1, 'un', 18.0],
  ['Kit de anclaje y tornilleria',   'FERRETERIA',   1, 'set', 2.5],
  ['Maletin herramientas electricas','HERRAMIENTA',  1, 'set', 7.0],
  ['Multimetro / Power meter optico','INSTRUMENTO',  1, 'un', 1.2],
  ['Fusionadora de fibra',           'INSTRUMENTO',  1, 'un', 3.5],
  ['Rollo cable UTP Cat6 (50 m)',    'INSUMO',       1, 'rollo', 3.0],
  ['Patch cords / conectores',       'INSUMO',      10, 'un', 0.4],
  ['EPP: casco, guantes, arnes',     'SEGURIDAD',    1, 'set', 4.5],
  ['Notebook de configuracion',      'INSTRUMENTO',  1, 'un', 2.0],
  ['Tablet AppSheet + cargador',     'INSTRUMENTO',  1, 'un', 0.8]
];

/** Siembra todas las tablas maestras si estan vacias. */
function sembrarMaestros() {
  var resumen = [];
  resumen.push('Tecnicos: ' + sembrarTecnicos());
  resumen.push('Vehiculos: ' + sembrarVehiculos());
  resumen.push('Destinos: ' + sembrarDestinos());
  resumen.push('Matriz: ' + sembrarMatrizBase());
  resumen.push('Requerimientos: ' + sembrarRequerimientos());
  resumen.push('Hoteles: ' + sembrarHoteles());
  log('INFO', 'Seed', resumen.join(' | '));
  return resumen.join(' | ');
}

function sembrarTecnicos() {
  if (dbLeer(SH.TECNICOS).length) return 0;
  var filas = SEED_TECNICOS.map(function (t) {
    return {
      TECNICO_ID: t[0], NOMBRE: t[1], RUT: t[2], CARGO: t[3], EMAIL: t[4],
      TELEFONO: t[5], COMUNA_RESIDENCIA: t[6], LAT_RESIDENCIA: t[7], LNG_RESIDENCIA: t[8],
      LICENCIA_CONDUCIR: t[9], PUEDE_CONDUCIR: t[10], ESPECIALIDAD: t[11],
      NIVEL: t[12], COSTO_HORA: t[13], DISPONIBLE_VIAJE: 'SI', ACTIVO: 'SI', FOTO_URL: ''
    };
  });
  dbInsertarVarios(SH.TECNICOS, filas);
  return filas.length;
}

function sembrarVehiculos() {
  if (dbLeer(SH.VEHICULOS).length) return 0;
  var filas = SEED_VEHICULOS.map(function (v) {
    return {
      VEHICULO_ID: v[0], PATENTE: v[1], MARCA_MODELO: v[2], ANIO: v[3],
      COMBUSTIBLE: v[4], RENDIMIENTO_KM_L: v[5], CAPACIDAD_KG: v[6],
      CAPACIDAD_PASAJEROS: v[7], TIENE_TAG: v[8], ESTADO: v[9],
      KM_ACTUAL: v[10], PROX_MANTENCION_KM: Math.ceil((v[10] + 10000) / 10000) * 10000,
      OBSERVACION: v[9] === 'MANTENCION' ? 'En taller: cambio de correa de distribucion.' : ''
    };
  });
  dbInsertarVarios(SH.VEHICULOS, filas);
  return filas.length;
}

function sembrarDestinos() {
  if (dbLeer(SH.DESTINOS).length) return 0;
  var filas = SEED_DESTINOS.map(function (d) {
    return {
      DESTINO_ID: d[0], REGION: d[1], PROVINCIA: d[2], COMUNA: d[3], DIRECCION: d[4],
      LAT: d[5], LNG: d[6], ZONA: d[7], KM_DESDE_BASE: d[8], MIN_DESDE_BASE: d[9],
      PEAJE_IDA_CLP: d[10], AEROPUERTO_IATA: d[11], KM_AEROPUERTO_DESTINO: d[12],
      TIENE_METRO: d[13], REQUIERE_PERNOCTAR: d[14],
      CONTACTO_SITIO: 'Jefe de sitio ' + d[3], TELEFONO_SITIO: '+56 9 0000 0000'
    };
  });
  dbInsertarVarios(SH.DESTINOS, filas);
  return filas.length;
}

/**
 * Matriz base BASE<->destino y destino<->destino por estimacion geografica.
 * Los pares base-destino usan el kilometraje real cargado en DESTINOS.
 */
function sembrarMatrizBase() {
  if (dbLeer(SH.MATRIZ).length) return 0;
  var destinos = dbLeer(SH.DESTINOS);
  var filas = [];
  var ahora = new Date();

  destinos.forEach(function (a) {
    destinos.forEach(function (b) {
      if (a.DESTINO_ID === b.DESTINO_ID) return;
      var km, min, peaje, fuente;

      if (a.DESTINO_ID === BASE_ID || b.DESTINO_ID === BASE_ID) {
        var otro = (a.DESTINO_ID === BASE_ID) ? b : a;
        km = Number(otro.KM_DESDE_BASE);
        min = Number(otro.MIN_DESDE_BASE);
        peaje = Number(otro.PEAJE_IDA_CLP);
        fuente = 'CARGA_MANUAL_RUTA_REAL';
      } else {
        km = redondear(kmRutaEstimados(a.LAT, a.LNG, b.LAT, b.LNG), 0);
        var urbano = (a.ZONA === 'RM' && b.ZONA === 'RM');
        var vel = urbano ? cfgNum('VEL_URBANA_KMH') : cfgNum('VEL_CARRETERA_KMH');
        min = Math.round(km / vel * 60);
        peaje = urbano ? 0 : Math.round(km * cfgNum('PEAJE_FALLBACK_CLP_KM') / 100) * 100;
        fuente = 'ESTIMACION_HAVERSINE_X1.25';
      }

      filas.push({
        ORIGEN_ID: a.DESTINO_ID, DESTINO_ID: b.DESTINO_ID,
        KM: km, MINUTOS: min, PEAJE_CLP: peaje,
        FUENTE: fuente, ACTUALIZADO: ahora
      });
    });
  });

  dbInsertarVarios(SH.MATRIZ, filas);
  return filas.length;
}

function sembrarRequerimientos() {
  if (dbLeer(SH.REQUERIMIENTOS).length) return 0;
  var destinos = indexarPor(dbLeer(SH.DESTINOS), 'DESTINO_ID');
  var hoy = new Date();
  var filas = SEED_REQUERIMIENTOS.map(function (r) {
    var d = destinos[r[1]];
    var sla = r[3] === 'ALTA' ? 5 : 10;
    return {
      REQ_ID: r[0],
      CLIENTE: 'Telecomunicaciones Andes S.A.',
      DESTINO_ID: r[1],
      COMUNA: d ? d.COMUNA : '',
      EQUIPOS: r[2],
      TIPO_SERVICIO: 'Instalacion y puesta en marcha + capacitacion',
      REQUIERE_CAPACITACION: 'SI',
      PRIORIDAD: r[3],
      FECHA_SOLICITUD: hoy,
      SLA_DIAS: sla,
      FECHA_COMPROMISO: sumarDias(hoy, sla),
      ESTADO: 'PENDIENTE',
      OBSERVACION: ''
    };
  });
  dbInsertarVarios(SH.REQUERIMIENTOS, filas);
  return filas.length;
}

function sembrarHoteles() {
  if (dbLeer(SH.HOTELES).length) return 0;
  var destinos = indexarPor(dbLeer(SH.DESTINOS), 'DESTINO_ID');
  var filas = SEED_HOTELES.map(function (h, i) {
    var d = destinos[h[0]];
    return {
      HOTEL_ID: 'H' + (i + 1 < 10 ? '0' : '') + (i + 1),
      DESTINO_ID: h[0], COMUNA: d ? d.COMUNA : '',
      NOMBRE: h[1], DIRECCION: h[2], TELEFONO: h[3], VALOR_NOCHE: h[4],
      INCLUYE_DESAYUNO: h[5], ESTACIONAMIENTO: h[6], RATING: h[7],
      KM_AL_SITIO: h[8], CONVENIO: 'SI', RESERVA_URL: ''
    };
  });
  dbInsertarVarios(SH.HOTELES, filas);
  return filas.length;
}

/** Hotel mas conveniente para un destino: convenio, precio y cercania. */
function mejorHotel(destinoId) {
  var opciones = dbBuscar(SH.HOTELES, { DESTINO_ID: destinoId });
  if (!opciones.length) return null;
  var tope = cfgNum('VALOR_ALOJAMIENTO_DIA');
  var validas = opciones.filter(function (h) { return Number(h.VALOR_NOCHE) <= tope; });
  var pool = validas.length ? validas : opciones;
  pool.sort(function (a, b) {
    var pa = Number(a.KM_AL_SITIO) * 1000 + Number(a.VALOR_NOCHE) - Number(a.RATING) * 5000;
    var pb = Number(b.KM_AL_SITIO) * 1000 + Number(b.VALOR_NOCHE) - Number(b.RATING) * 5000;
    return pa - pb;
  });
  return pool[0];
}
