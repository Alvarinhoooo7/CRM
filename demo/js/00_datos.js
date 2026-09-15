/* DATOS SEMILLA. Servicio tecnico en ruta.
   Km y peajes provienen de la cache _RUTAS del libro «Evaluacion 1» (consultas reales a
   Google Maps) y del catalogo de plazas MOP 2026 categoria 1.
   Las coordenadas son aproximadas al centro de la direccion municipal y su unico uso es
   abrir Google Maps en el punto correcto sin geocodificar texto. */

var PARAMETROS_BASE = {
  P_RENDIMIENTO: 20,
  P_DIESEL: 1381,
  P_COSTO_KM: 60,
  P_CAMIONETAS: 6,
  P_CAPACIDAD_CAMIONETA: 3,
  P_TECNICOS: 10,
  P_JORNADA_SEMANAL: 42,
  P_COLACION_H: 5,
  P_DIAS_SEMANA: 5,
  P_MAX_EXTRA: 2,
  P_HORAS_EXTRA_SEMANA: 10,
  P_TOPE_CONDUCCION: 9,
  P_VALOR_HORA: 6500,
  P_RECARGO_EXTRA: 0.5,
  P_T_INSTALACION: 2,
  P_T_CAPACITACION: 0.5,
  P_REDUCCION_CAP: 0.5,
  P_HOTEL: 50000,
  P_VIATICO: 25000,
  P_COLACION: 5000,
  P_IMPREVISTOS: 0.1,
  P_FACTOR_HORAS: 1.1,
  P_VEL_URBANA: 36,
  P_VEL_R78: 69,
  P_VEL_RUTA5: 80,
  P_UMBRAL_PERNOCTA: 4,
  P_REDONDEO: 1000
};

/* Parametros derivados. Se recalculan cada vez que el supervisor edita uno base,
   para que nada quede congelado con el valor inicial. */
function derivarParametros(p) {
  var d = {};
  for (var k in p) { if (p.hasOwnProperty(k)) d[k] = p[k]; }
  d.P_JORNADA_EFECTIVA = d.P_JORNADA_SEMANAL - d.P_COLACION_H;
  d.P_JORNADA_DIA = d.P_JORNADA_EFECTIVA / d.P_DIAS_SEMANA;
  d.P_JORNADA_DIA_MAX = d.P_JORNADA_SEMANAL / d.P_DIAS_SEMANA;
  d.P_TOPE_DIA = d.P_JORNADA_DIA_MAX + d.P_MAX_EXTRA;
  d.P_T_CAP_EFECTIVA = d.P_T_CAPACITACION * (1 - d.P_REDUCCION_CAP);
  return d;
}

/* Etiquetas y unidades de los parametros editables del panel del supervisor. */
var PARAMETROS_EDITABLES = [
  { codigo: 'P_DIESEL', etiqueta: 'Precio del diesel', unidad: '$/L', paso: 1 },
  { codigo: 'P_RENDIMIENTO', etiqueta: 'Rendimiento camioneta', unidad: 'km/L', paso: 0.5 },
  { codigo: 'P_COSTO_KM', etiqueta: 'Desgaste por kilómetro', unidad: '$/km', paso: 5 },
  { codigo: 'P_VIATICO', etiqueta: 'Viático diario fuera de la RM', unidad: '$/dia', paso: 1000 },
  { codigo: 'P_COLACION', etiqueta: 'Colación dentro de la RM', unidad: '$/dia', paso: 500 },
  { codigo: 'P_HOTEL', etiqueta: 'Hotel por persona y noche', unidad: '$/noche', paso: 5000 },
  { codigo: 'P_VALOR_HORA', etiqueta: 'Costo de la hora técnico', unidad: '$/h', paso: 500 },
  { codigo: 'P_IMPREVISTOS', etiqueta: 'Reserva de emergencia', unidad: 'factor', paso: 0.05 },
  { codigo: 'P_T_INSTALACION', etiqueta: 'Tiempo de instalación', unidad: 'h/equipo', paso: 0.25 },
  { codigo: 'P_T_CAPACITACION', etiqueta: 'Capacitación presencial', unidad: 'h', paso: 0.25 }
];

var BASE_OPERACIONES = {
  ID_Destino: 'BASE',
  Comuna: 'Macul',
  Region: 'Metropolitana',
  Nombre: 'Base de operaciones',
  Direccion: 'INACAP Sede Santiago Sur, Av. Vicuña Mackenna 3864, Macul',
  En_RM: true,
  Lat: -33.4897,
  Lng: -70.5983
};

/* Comuna, region, direccion, en RM, corredor, km ida, peaje ida, equipos, hotel, lat, lng */
var DESTINOS_SEMILLA = [
  ['Copiapó', 'Atacama', 'Chacabuco 546', false, 'R5N', 812.2, 28582, 5, 'Centro de Copiapó', -27.3665, -70.3323],
  ['Coquimbo', 'Coquimbo', 'Bilbao 330', false, 'R5N', 469.8, 15132, 2, 'Centro de Coquimbo', -29.9533, -71.3436],
  ['La Calera', 'Valparaíso', 'J. J. Pérez 351', false, 'R5N', 121.7, 5082, 1, '', -32.7876, -71.1929],
  ['San Antonio', 'Valparaíso', 'Av. Barros Luco 1881', false, 'R78', 115.7, 4008, 2, '', -33.5928, -71.6127],
  ['Melipilla', 'Metropolitana', 'Serrano 1550', true, 'R78', 73.7, 2847, 2, '', -33.6870, -71.2150],
  ['Lo Barnechea', 'Metropolitana', 'Av. Lo Barnechea 1210', true, 'URB', 23.9, 1498, 3, '', -33.3500, -70.5170],
  ['Puente Alto', 'Metropolitana', 'Concha y Toro 1820', true, 'URB', 12.6, 1005, 1, '', -33.5990, -70.5760],
  ['Santiago', 'Metropolitana', 'Plaza de Armas 444', true, 'URB', 10, 678, 3, '', -33.4372, -70.6506],
  ['Pudahuel', 'Metropolitana', 'Av. San Pablo 8444', true, 'URB', 18.7, 1767, 3, '', -33.4420, -70.7420],
  ['Maipú', 'Metropolitana', 'Av. 5 de Abril 0260', true, 'URB', 16.9, 1206, 3, '', -33.5110, -70.7580],
  ['Curicó', 'Maule', 'Carmen 360', false, 'R5S', 194.7, 5249, 1, '', -34.9828, -71.2394],
  ['Talca', 'Maule', '1 Sur 835', false, 'R5S', 258.7, 5249, 3, 'Centro de Talca', -35.4264, -71.6554],
  ['San Pedro de la Paz', 'Biobío', 'Los Álamos 2093', false, 'R5S', 508.1, 16421, 1, 'Centro de Concepción', -36.8420, -73.1050],
  ['Penco', 'Biobío', 'Freire 545', false, 'R5S', 493.7, 15649, 1, 'Centro de Concepción', -36.7400, -72.9930],
  ['Santa Juana', 'Biobío', 'Irarrázaval 320', false, 'R5S', 556.3, 15649, 1, 'Centro de Concepción', -37.1720, -72.9420],
  ['Tomé', 'Biobío', 'Ignacio Serrano 1130', false, 'R5S', 507.6, 15649, 1, 'Centro de Concepción', -36.6180, -72.9560]
];

var NOMBRES_TECNICOS = [
  'Álvaro Fuentes', 'Camila Rojas', 'Diego Muñoz', 'Javiera Soto', 'Matías Contreras',
  'Fernanda Araya', 'Cristián Vega', 'Paulina Herrera', 'Rodrigo Cáceres', 'Bárbara Neira'
];

/* Los indices 7 y 9 (T08 y T10) no tienen licencia y por lo tanto nunca conducen. */
var SIN_LICENCIA = [7, 9];

var KM_INICIAL_FLOTA = [18900, 39500, 52000, 76000, 96000, 22000];

var IMPLEMENTOS_BOLSO = [
  'Multímetro y pinza amperimétrica',
  'Crimpeadora, conectores RJ45 y tester de red',
  'Kit de fibra óptica con fusionadora y pigtails',
  'Taladro percutor, brocas y tarugos',
  'Destornilladores aislados y llaves',
  'Notebook con software de puesta en marcha',
  'Equipo de reemplazo y repuestos menores',
  'Cinta aisladora, amarras y canaletas'
];
var IMPLEMENTOS_VEHICULO = [
  'Escalera telescópica',
  'Equipos a instalar del día',
  'Extensión eléctrica, conos y señalética',
  'Documentos del vehículo y TAG al día'
];
var IMPLEMENTOS_PERSONA = [
  'Casco, guantes dieléctricos, lentes y zapatos de seguridad',
  'Arnés de seguridad',
  'Botiquín, agua y linterna frontal',
  'Celular con datos y batería cargada',
  'Tarjeta corporativa de combustible y peajes'
];

/* Plan inicial: 15 jornadas ya armadas. Los tecnicos van asignados individualmente,
   no por cuadrilla fija: el coordinador puede rehacer cualquier equipo.
   Cada tramo: [origen, destino, km, peaje, equipos, noches, corredor] */
var JORNADAS_SEMILLA = [
  { dia: 1, vehiculo: 'V1', tecnicos: ['T01', 'T02'], conductor: 'T01', tramos: [['BASE', 'D02', 469.8, 15132, 0, 1, 'R5N']] },
  { dia: 2, vehiculo: 'V1', tecnicos: ['T01', 'T02'], conductor: 'T01', tramos: [['D02', 'D01', 346.4, 13450, 0, 1, 'R5N']] },
  { dia: 3, vehiculo: 'V1', tecnicos: ['T01', 'T02'], conductor: 'T01', tramos: [['D01', 'D01', 0, 0, 5, 1, 'URB']] },
  { dia: 4, vehiculo: 'V1', tecnicos: ['T01', 'T02'], conductor: 'T01', tramos: [['D01', 'D02', 347.8, 13450, 2, 1, 'R5N']] },
  { dia: 5, vehiculo: 'V1', tecnicos: ['T01', 'T02'], conductor: 'T01', tramos: [['D02', 'D03', 352.6, 10050, 1, 0, 'R5N'], ['D03', 'BASE', 120, 5082, 0, 0, 'R5N']] },

  { dia: 1, vehiculo: 'V2', tecnicos: ['T03', 'T04'], conductor: 'T03', tramos: [['BASE', 'D11', 194.7, 5249, 1, 1, 'R5S']] },
  { dia: 2, vehiculo: 'V2', tecnicos: ['T03', 'T04'], conductor: 'T03', tramos: [['D11', 'D12', 66.2, 0, 3, 0, 'R5S'], ['D12', 'BASE', 258.7, 5249, 0, 0, 'R5S']] },

  { dia: 1, vehiculo: 'V3', tecnicos: ['T05', 'T06'], conductor: 'T05', tramos: [['BASE', 'D13', 508.1, 16421, 1, 1, 'R5S']] },
  { dia: 2, vehiculo: 'V3', tecnicos: ['T05', 'T06'], conductor: 'T05', tramos: [['D13', 'D14', 20.8, 772, 1, 0, 'URB'], ['D14', 'D16', 17.5, 0, 1, 0, 'URB'], ['D16', 'D15', 90, 0, 1, 1, 'R5S']] },
  { dia: 3, vehiculo: 'V3', tecnicos: ['T05', 'T06'], conductor: 'T05', tramos: [['D15', 'BASE', 556.3, 15649, 0, 0, 'R5S']] },

  { dia: 1, vehiculo: 'V4', tecnicos: ['T07', 'T08'], conductor: 'T07', tramos: [['BASE', 'D10', 16.9, 1206, 3, 0, 'URB'], ['D10', 'BASE', 16.9, 1206, 0, 0, 'URB']] },
  { dia: 2, vehiculo: 'V4', tecnicos: ['T07', 'T08'], conductor: 'T07', tramos: [['BASE', 'D09', 18.7, 1767, 3, 0, 'URB'], ['D09', 'BASE', 24.2, 1767, 0, 0, 'URB']] },
  { dia: 3, vehiculo: 'V4', tecnicos: ['T07', 'T08'], conductor: 'T07', tramos: [['BASE', 'D08', 10, 678, 3, 0, 'URB'], ['D08', 'BASE', 10, 678, 0, 0, 'URB']] },

  { dia: 1, vehiculo: 'V5', tecnicos: ['T09', 'T10'], conductor: 'T09', tramos: [['BASE', 'D06', 23.9, 1498, 3, 0, 'URB'], ['D06', 'D07', 40, 0, 1, 0, 'URB'], ['D07', 'BASE', 18.4, 1005, 0, 0, 'URB']] },
  { dia: 2, vehiculo: 'V5', tecnicos: ['T09', 'T10'], conductor: 'T09', tramos: [['BASE', 'D05', 73.7, 2847, 2, 0, 'R78'], ['D05', 'D04', 49.6, 1161, 2, 0, 'R78'], ['D04', 'BASE', 117.4, 4008, 0, 0, 'R78']] }
];

var FECHA_INICIO_PLAN = '2026-09-21';

/* Construye el estado inicial completo a partir de la semilla. */
function construirSemilla() {
  var parametros = derivarParametros(PARAMETROS_BASE);

  var destinos = DESTINOS_SEMILLA.map(function (d, i) {
    return {
      ID_Destino: 'D' + pad2(i + 1),
      Comuna: d[0],
      Region: d[1],
      Direccion: d[2] + ', ' + d[0],
      En_RM: d[3],
      Corredor: d[4],
      Km_Ida: d[5],
      Peaje_Ida: d[6],
      Equipos: d[7],
      Hotel_Referencia: d[8] || 'Retorno en el día',
      Lat: d[9],
      Lng: d[10],
      Empresa: 'Telecomunicaciones del Pacífico',
      Contacto: 'Encargado de instalaciones',
      Mail_Cliente: '',
      Link_Enviado: false
    };
  });

  var tecnicos = NOMBRES_TECNICOS.map(function (nombre, i) {
    return {
      ID_Tecnico: 'T' + pad2(i + 1),
      Nombre: nombre,
      Email: sinTildes(nombre).toLowerCase().replace(/ /g, '.') + '@serviciotecnico.cl',
      Telefono: '+56 9 5' + String(1000000 + i * 111111).slice(0, 7),
      Licencia: SIN_LICENCIA.indexOf(i) === -1,
      Activo: true
    };
  });

  var flota = KM_INICIAL_FLOTA.map(function (km, i) {
    return {
      ID_Vehiculo: 'V' + (i + 1),
      Patente: 'JKLM-' + String(i + 1) + String(i + 1),
      Modelo: 'Peugeot Partner',
      Km: km,
      Km_Proxima_Mantencion: Math.ceil(km / 10000) * 10000,
      Venc_Revision: '2026-10-01',
      Venc_Seguro: '2027-03-31',
      Estado: i === 5 ? 'Reserva' : 'Disponible'
    };
  });

  var implementos = [];
  IMPLEMENTOS_BOLSO.forEach(function (n) { implementos.push({ categoria: 'Bolso', item: n }); });
  IMPLEMENTOS_VEHICULO.forEach(function (n) { implementos.push({ categoria: 'Vehiculo', item: n }); });
  IMPLEMENTOS_PERSONA.forEach(function (n) { implementos.push({ categoria: 'Persona', item: n }); });
  implementos = implementos.map(function (x, i) {
    return { ID_Implemento: 'I' + pad2(i + 1), Categoria: x.categoria, Item: x.item };
  });

  var jornadas = JORNADAS_SEMILLA.map(function (j, i) {
    return {
      ID_Jornada: 'J' + pad2(i + 1),
      Dia: j.dia,
      Fecha: fechaLaboral(FECHA_INICIO_PLAN, j.dia - 1),
      ID_Vehiculo: j.vehiculo,
      Tecnicos: j.tecnicos.slice(),
      Conductor: j.conductor,
      Tramos: j.tramos.map(function (t) {
        return { Origen: t[0], Destino: t[1], Km: t[2], Peaje: t[3], Equipos: t[4], Noches: t[5], Corredor: t[6] };
      })
    };
  });

  /* Una orden por tecnico y jornada. El checklist se genera completo y sin marcar. */
  var ordenes = [];
  jornadas.forEach(function (j) {
    j.Tecnicos.forEach(function (idTecnico) {
      ordenes.push({
        ID_Orden: 'O' + pad4(ordenes.length + 1),
        ID_Jornada: j.ID_Jornada,
        ID_Tecnico: idTecnico,
        Es_Conductor: idTecnico === j.Conductor,
        Fecha: j.Fecha,
        Estado: 'Planificada',
        Checklist: implementos.map(function (im) {
          return { ID_Implemento: im.ID_Implemento, Marcado: false, Hora: null };
        }),
        Hora_Inicio: null,
        Hora_Fin: null,
        Coord_Inicio: null,
        Coord_Fin: null,
        Equipos_Instalados: 0,
        Firma: null,
        Foto: null,
        Observaciones: ''
      });
    });
  });

  return {
    parametros: parametros,
    destinos: destinos,
    tecnicos: tecnicos,
    flota: flota,
    implementos: implementos,
    jornadas: jornadas,
    ordenes: ordenes,
    gastos: [],
    correos: [],
    trabajos: [],
    consecutivos: { jornada: jornadas.length, orden: ordenes.length, gasto: 0, correo: 0, destino: destinos.length }
  };
}

function pad2(n) { return String(n).length < 2 ? '0' + n : String(n); }
function pad4(n) { var s = String(n); while (s.length < 4) { s = '0' + s; } return s; }

function sinTildes(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/* Suma dias habiles saltando sabado y domingo. */
function fechaLaboral(inicioISO, saltos) {
  var partes = inicioISO.split('-');
  var f = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]), 12);
  var avanzados = 0;
  while (avanzados < saltos) {
    f.setDate(f.getDate() + 1);
    if (f.getDay() !== 0 && f.getDay() !== 6) { avanzados++; }
  }
  return f.getFullYear() + '-' + pad2(f.getMonth() + 1) + '-' + pad2(f.getDate());
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PARAMETROS_BASE: PARAMETROS_BASE,
    PARAMETROS_EDITABLES: PARAMETROS_EDITABLES,
    BASE_OPERACIONES: BASE_OPERACIONES,
    REGIONES: typeof REGIONES !== 'undefined' ? REGIONES : {},
    derivarParametros: derivarParametros,
    construirSemilla: construirSemilla,
    fechaLaboral: fechaLaboral,
    pad2: pad2,
    pad4: pad4
  };
}
