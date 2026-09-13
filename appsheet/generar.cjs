/* Genera las tablas planas que consume AppSheet, a partir de los mismos datos
 * y parametros de v2/apps-script (00_Esquema.gs y 02_Setup.gs).
 * Uso:  node appsheet/generar.cjs
 * Salida: appsheet/csv/*.csv  -> se importan como pestanas de un Google Sheet.
 *
 * El plan de dias NO se copia de v1: se DERIVA aca, aplicando la jornada y la
 * regla de horas extra sobre las distancias. Asi, si cambia la capacidad del
 * vehiculo o el tiempo de capacitacion, el plan se recalcula solo. */

const fs = require('fs');
const path = require('path');
const SALIDA = path.join(__dirname, 'csv');

/* ==========================================================================
 * A. PARAMETROS  (espejo de CONFIG en 00_Esquema.gs)
 * ========================================================================== */
const P = {
  HOTEL: 50000,             // $/noche/persona          JEFATURA
  VIATICO: 25000,           // $/dia/tecnico desplegado JEFATURA
  // REGLA DE JEFATURA: el viatico existe para cubrir al que esta lejos y no
  // puede volver. Quien trabaja en la RM almuerza fuera pero duerme en su
  // casa: se le paga colacion, no viatico.
  COLACION_RM: 5000,        // $/dia                    JEFATURA
  VIATICO_SOLO_CON_PERNOCTACION: true,  //              JEFATURA
  HOLGURA_IMPREVISTOS: 0.10,  // el "y otros" del PDF   JEFATURA
  REDONDEO_TRANSFERENCIA: 1000,  // $                   JEFATURA
  COSTO_KM: 60,             // $/km desgaste y mantencion JEFATURA
  COSTO_TECNICO_MES: 1400000,  // $/mes                 SUPUESTO
  DIESEL: 1381,             // $/L                      JEFATURA
  RENDIMIENTO: 20,          // km/L                     PDF
  HORAS_EQUIPO: 2,          // h por equipo             PDF
  // PDF: "Cada capacitacion toma 30 min". Se reduce al 50%, no al 100%, porque
  // al cliente se le envia antes un enlace de Drive con el video detallado: en
  // terreno solo queda responder dudas.                 JEFATURA
  HORAS_CAPACITACION: 0.25,
  // CORREGIDO: la Peugeot Partner es furgon de cabina corta. Caben DOS
  // personas con sus bolsos de herramientas, no tres.   JEFATURA
  CAPACIDAD_CAMIONETA: 2,
  JORNADA_DIA: 8.4,         // h ordinarias              SUPUESTO
  JORNADA_TOPE: 10.4,       // h con las 2 extra         = JORNADA_DIA + EXTRA_MAX
  EXTRA_MAX_DIA: 2,         // h                         SUPUESTO
  EXTRA_MAX_SEMANA: 10,     // h                         SUPUESTO
  COSTO_HORA: 6500,         // $/h-tecnico               SUPUESTO
  RECARGO_EXTRA: 1.5,       // factor, Codigo del Trabajo
  CONDUCCION_MAX_DIA: 9     // h al volante              SUPUESTO
};

// Horas que toma UN tecnico por cada equipo que instala: 2 h + 15 min.
const HORAS_POR_EQUIPO = P.HORAS_EQUIPO + P.HORAS_CAPACITACION;
const COSTO_HORA_EXTRA = P.COSTO_HORA * P.RECARGO_EXTRA; // $9.750

/* ==========================================================================
 * B. TABLAS MAESTRAS
 * ========================================================================== */

/* Los diez tienen licencia: eso es lo que permite designar DOS conductores por
 * cuadrilla y alternarlos, en vez de cargarle el viaje completo a uno solo. */
const TECNICOS = [
  ['T01', 'Alvaro Fuentes'], ['T02', 'Camila Rojas'],
  ['T03', 'Diego Munoz'],    ['T04', 'Javiera Soto'],
  ['T05', 'Matias Contreras'], ['T06', 'Fernanda Araya'],
  ['T07', 'Cristian Vega'],  ['T08', 'Paulina Herrera'],
  ['T09', 'Rodrigo Caceres'], ['T10', 'Barbara Neira']
];

const FLOTA = [['V1'], ['V2'], ['V3'], ['V4'], ['V5'], ['V6']];

/* localidad, region, direccion, RM, equipos, zonaHotel, km desde base, peaje ida, corredor */
const DESTINOS = [
  ['Maipu', 'Metropolitana', 'Av. 5 de Abril 0260, Maipu, Santiago, Chile', 'Si', 3, 'No aplica', 18, 0, 'URB'],
  ['Pudahuel', 'Metropolitana', 'Av. San Pablo 8444, Pudahuel, Santiago, Chile', 'Si', 3, 'No aplica', 22, 0, 'URB'],
  ['Santiago', 'Metropolitana', 'Plaza de Armas 444, Santiago Centro, Santiago, Chile', 'Si', 3, 'No aplica', 10, 1300, 'URB'],
  ['Puente Alto', 'Metropolitana', 'Concha y Toro 1820, Puente Alto, Santiago, Chile', 'Si', 1, 'No aplica', 24, 2200, 'URB'],
  ['Lo Barnechea', 'Metropolitana', 'Av. Lo Barnechea 1210, Lo Barnechea, Santiago, Chile', 'Si', 3, 'No aplica', 22, 2400, 'URB'],
  ['Melipilla', 'Metropolitana', 'Serrano 1550, Melipilla, Chile', 'Si', 2, 'No aplica', 68, 2800, 'R78'],
  ['San Antonio', 'Valparaiso', 'Av. Barros Luco 1881, San Antonio, Chile', 'No', 2, 'No aplica', 108, 5600, 'R78'],
  ['La Calera', 'Valparaiso', 'J. J. Perez 351, La Calera, Chile', 'No', 1, 'No aplica', 110, 3900, 'R5N'],
  ['Coquimbo', 'Coquimbo', 'Bilbao 330, Coquimbo, Chile', 'No', 2, 'Centro de Coquimbo', 470, 18100, 'R5N'],
  ['Copiapo', 'Atacama', 'Chacabuco 546, Copiapo, Chile', 'No', 5, 'Centro de Copiapo', 800, 25500, 'R5N'],
  ['Curico', 'Maule', 'Carmen 360, Curico, Chile', 'No', 1, 'No aplica', 195, 7600, 'R5S'],
  ['Talca', 'Maule', '1 Sur 835, Talca, Chile', 'No', 3, 'Centro de Talca', 255, 11000, 'R5S'],
  ['San Pedro de la Paz', 'Biobio', 'Los Alamos 2093, San Pedro de la Paz, Chile', 'No', 1, 'Centro de Concepcion', 505, 20600, 'R5S'],
  ['Penco', 'Biobio', 'Penco, Biobio, Chile', 'No', 1, 'Centro de Concepcion', 520, 20600, 'R5S'],
  ['Santa Juana', 'Biobio', 'Irarrazaval 320, Santa Juana, Chile', 'No', 1, 'Centro de Concepcion', 530, 20600, 'R5S'],
  ['Tome', 'Biobio', 'Tome, Biobio, Chile', 'No', 1, 'Centro de Concepcion', 545, 20600, 'R5S']
];

const IMPLEMENTOS = [
  [1, 'Multimetro y pinza amperimetrica calibrados', 'BOLSO'],
  [2, 'Crimpeadora, conectores RJ45 y tester de red', 'BOLSO'],
  [3, 'Kit de fibra optica: fusionadora, pigtails y alcohol isopropilico', 'BOLSO'],
  [4, 'Taladro percutor, brocas y tarugos', 'BOLSO'],
  [5, 'Set de destornilladores aislados y llaves ajustables', 'BOLSO'],
  [6, 'Amarras, cinta aisladora y canaletas', 'BOLSO'],
  [7, 'Equipo de reemplazo ONT/router y repuestos menores', 'BOLSO'],
  [8, 'Notebook con software de puesta en marcha y respaldo de configuraciones', 'BOLSO'],
  [9, 'Escalera telescopica', 'VEHICULO'],
  [10, 'Extension electrica, conos y senaletica', 'VEHICULO'],
  [11, 'Documentos del vehiculo: permiso de circulacion, revision tecnica, seguro y TAG', 'VEHICULO'],
  [12, 'Tarjeta corporativa de combustible', 'VEHICULO'],
  [13, 'EPP: casco, guantes dielectricos, lentes, zapatos de seguridad y arnes', 'PERSONAL'],
  [14, 'Botiquin, agua y linterna frontal', 'PERSONAL'],
  [15, 'Celular con datos para reportar avance', 'PERSONAL'],
  [16, 'Guia de despacho y acta de conformidad del cliente', 'PERSONAL'],
  [17, 'Material de capacitacion enviado al cliente ANTES de llegar', 'PERSONAL']
];

/* ==========================================================================
 * C. CUADRILLAS
 * --------------------------------------------------------------------------
 * Con capacidad 2 caben cinco cuadrillas de dos en cinco camionetas, y queda
 * V6 de reserva. Los dos integrantes tienen licencia y se ALTERNAN al volante:
 * ningun tecnico maneja dos dias seguidos, y en los tramos largos el trayecto
 * se reparte. Esa es la razon de fondo para no dejar un solo conductor fijo.
 * Cada cuadrilla toma un corredor completo para no cruzar rutas.
 * ========================================================================== */
const CUADRILLAS = [
  { id: 'C1', tecnicos: ['T01', 'T02'], vehiculo: 'V1', corredor: 'Norte · Ruta 5 Norte',
    ruta: ['Copiapo', 'Coquimbo', 'La Calera'] },
  { id: 'C2', tecnicos: ['T03', 'T04'], vehiculo: 'V2', corredor: 'Maule · Ruta 5 Sur',
    ruta: ['Curico', 'Talca'] },
  { id: 'C3', tecnicos: ['T05', 'T06'], vehiculo: 'V3', corredor: 'Biobio',
    ruta: ['San Pedro de la Paz', 'Penco', 'Tome', 'Santa Juana'] },
  { id: 'C4', tecnicos: ['T07', 'T08'], vehiculo: 'V4', corredor: 'Region Metropolitana',
    ruta: ['Maipu', 'Pudahuel', 'Santiago'] },
  { id: 'C5', tecnicos: ['T09', 'T10'], vehiculo: 'V5', corredor: 'RM sur y Ruta 78',
    ruta: ['Lo Barnechea', 'Puente Alto', 'Melipilla', 'San Antonio'] }
];

/* Lunes siguiente a Fiestas Patrias 2026 (el 18 y 19 son feriados). */
const FECHA_INICIO = new Date(Date.UTC(2026, 8, 21));

/* ==========================================================================
 * D. GEOMETRIA
 * ========================================================================== */
const dest = {};
DESTINOS.forEach(function (d) {
  dest[d[0]] = { region: d[1], direccion: d[2], rm: d[3], equipos: d[4],
    zonaHotel: d[5], km: d[6], peaje: d[7], corredor: d[8] };
});
const DIRECCION_BASE = 'INACAP Sede Santiago Sur, Av. Vicuna Mackenna 3864, Macul, Santiago, Chile';
dest.BASE = { km: 0, corredor: 'URB', equipos: 0, direccion: DIRECCION_BASE,
  region: 'Metropolitana', rm: 'Si', zonaHotel: 'No aplica' };

const nombre = {};
TECNICOS.forEach(function (t) { nombre[t[0]] = t[1]; });
const emailDe = function (cod) { return cod.toLowerCase() + '@servicioenruta.cl'; };

/* Misma regla que respaldoDistancia_() en 04_Motor.gs: dentro del mismo
 * corredor se resta el kilometraje; si cambia de corredor se pasa por la base. */
function kmEntre(a, b) {
  const o = dest[a], d = dest[b];
  return o.corredor === d.corredor ? Math.abs(d.km - o.km) : o.km + d.km;
}
// Carretera 90 km/h; trayectos cortos son urbanos y rinden 35 km/h.
function horasEntre(a, b) {
  const km = kmEntre(a, b);
  return km > 40 ? km / 90 : km / 35;
}
/* El peaje de T_PEAJES es el ACUMULADO de ida desde la base. Dentro del mismo
 * corredor, el peaje de un tramo intermedio es la diferencia; si se cambia de
 * corredor hay que pasar por la base y se suman ambos acumulados. */
function peajeEntre(a, b) {
  const o = dest[a], d = dest[b];
  const pa = o.peaje || 0, pb = d.peaje || 0;
  return o.corredor === d.corredor ? Math.abs(pb - pa) : pa + pb;
}
function tandas(loc, n) { return Math.ceil(dest[loc].equipos / n); }
function horasTrabajo(loc, n) { return tandas(loc, n) * HORAS_POR_EQUIPO; }
function r2(x) { return Math.round(x * 100) / 100; }
/* PDF: la transferencia cubre "estadia, colacion, peajes y otros". La holgura
 * del 10% es ese "y otros"; despues se redondea hacia arriba al millar para
 * que el tecnico reciba una cifra manejable en efectivo. */
function redondearTransferencia(monto) {
  if (!monto) { return 0; }
  const conHolgura = monto * (1 + P.HOLGURA_IMPREVISTOS);
  return Math.ceil(conHolgura / P.REDONDEO_TRANSFERENCIA) * P.REDONDEO_TRANSFERENCIA;
}
function fechaDe(dia) {
  const f = new Date(FECHA_INICIO.getTime() + (dia - 1) * 86400000);
  return f.toISOString().slice(0, 10);
}

/* ==========================================================================
 * E. PLANIFICADOR
 * --------------------------------------------------------------------------
 * Regla, en este orden:
 *   1. La jornada se arma hasta las 8,4 h ordinarias.
 *   2. Al cerrar el dia se evalua el regreso. Si volver cabe dentro de las
 *      10,4 h (o sea, con hasta 2 h extra), SE VUELVE: dos horas extra para
 *      dos tecnicos cuestan 2 x 2 x $9.750 = $39.000, contra $150.000 de una
 *      noche para dos mas el viatico del dia siguiente.
 *   3. Si ni con horas extra se llega, se pernocta y se paga hostal.
 *   4. Un trayecto que por si solo no deja espacio para trabajar genera un
 *      dia de solo viaje (caso Copiapo, a ~8,9 h de la base).
 * ========================================================================== */
function planificar(cuad) {
  const n = cuad.tecnicos.length;
  const jornadas = [];
  let pos = 'BASE';
  let dia = 1;
  let horas = 0;
  let sitios = [];
  let conduccion = 0;
  let kmDia = 0;
  let peajeDia = 0;

  function cerrar(ultimo) {
    const vuelta = horasEntre(pos, 'BASE');
    let pernocta = false;
    let lugar = '';
    // Se vuelve a casa si el regreso cabe usando, como mucho, las 2 h extra.
    if (pos === 'BASE' || horas + vuelta <= P.JORNADA_TOPE) {
      horas += vuelta;
      conduccion += vuelta;
      kmDia += kmEntre(pos, 'BASE');
      peajeDia += peajeEntre(pos, 'BASE');
      pos = 'BASE';
    } else if (ultimo) {
      // Fin de itinerario lejos de la base: se duerme y se vuelve al dia
      // siguiente en un dia de solo viaje.
      pernocta = true; lugar = pos;
    } else {
      pernocta = true; lugar = pos;
    }
    jornadas.push({ dia: dia, sitios: sitios.slice(), horas: r2(horas),
      extra: r2(Math.max(0, horas - P.JORNADA_DIA)), conduccion: r2(conduccion),
      pernocta: pernocta, lugar: lugar, km: Math.round(kmDia),
      peaje: Math.round(peajeDia) });
    dia += 1; horas = 0; sitios = []; conduccion = 0; kmDia = 0; peajeDia = 0;
  }

  cuad.ruta.forEach(function (loc) {
    const tv = horasEntre(pos, loc);
    const tt = horasTrabajo(loc, n);

    if (horas + tv + tt > P.JORNADA_DIA) {
      if (sitios.length || horas > 0) { cerrar(false); }
      if (tv + tt > P.JORNADA_DIA) {
        // El viaje solo ya ocupa el dia: se viaja hoy y se trabaja manana.
        horas = tv; conduccion = tv; sitios = [];
        jornadas.push({ dia: dia, sitios: [], horas: r2(tv),
          extra: r2(Math.max(0, tv - P.JORNADA_DIA)), conduccion: r2(tv),
          pernocta: true, lugar: loc, viajeSolo: true,
          km: Math.round(kmEntre(pos, loc)), peaje: Math.round(peajeEntre(pos, loc)) });
        dia += 1; horas = 0; conduccion = 0; kmDia = 0; peajeDia = 0;
        pos = loc;
        horas = tt; sitios = [loc];
        return;
      }
      horas = tv + tt; conduccion = tv; sitios = [loc];
      kmDia = kmEntre(pos, loc); peajeDia = peajeEntre(pos, loc); pos = loc;
      return;
    }
    horas += tv + tt; conduccion += tv; sitios.push(loc);
    kmDia += kmEntre(pos, loc); peajeDia += peajeEntre(pos, loc); pos = loc;
  });
  cerrar(true);

  // Si quedo durmiendo fuera al final, se agrega el dia de regreso.
  const ult = jornadas[jornadas.length - 1];
  if (ult.pernocta) {
    const vuelta = horasEntre(ult.lugar, 'BASE');
    jornadas.push({ dia: dia, sitios: [], horas: r2(vuelta),
      extra: r2(Math.max(0, vuelta - P.JORNADA_DIA)), conduccion: r2(vuelta),
      pernocta: false, lugar: '', regreso: true,
      km: Math.round(kmEntre(ult.lugar, 'BASE')),
      peaje: Math.round(peajeEntre(ult.lugar, 'BASE')) });
  }
  return jornadas;
}

/* ==========================================================================
 * F. CONSTRUCCION DE LAS TABLAS
 * ========================================================================== */
const ordenes = [];
const checks = [];
const bitacoraJornadas = [];
let n = 0;

CUADRILLAS.forEach(function (cuad) {
  const jornadas = planificar(cuad);
  const nTec = cuad.tecnicos.length;
  // El viatico se paga por VIAJE con pernoctacion, no por dia suelto: si la
  // cuadrilla duerme fuera alguna noche, todos sus dias son dias de viatico.
  const viajeConPernoctacion = jornadas.some(function (x) { return x.pernocta; });

  /* Devuelve el estipendio del dia para un tecnico: viatico si esta fuera de
   * la RM en un viaje con pernoctacion; colacion si vuelve a dormir a su casa. */
  function estipendio(enRM) {
    const fuera = enRM !== 'Si';
    if (fuera && (!P.VIATICO_SOLO_CON_PERNOCTACION || viajeConPernoctacion)) {
      return { monto: P.VIATICO, tipo: 'Viatico' };
    }
    return { monto: P.COLACION_RM, tipo: 'Colacion' };
  }

  jornadas.forEach(function (j, idx) {
    // Conductor alternado: cambia cada dia, y los dos tienen licencia.
    const conductor = cuad.tecnicos[idx % nTec];
    bitacoraJornadas.push({ cuadrilla: cuad.id, j: j, conductor: conductor });

    /* Un dia de solo viaje o de regreso NO instala equipos, pero el tecnico
     * igual esta desplegado: cobra viatico, puede dormir fuera y tiene que ver
     * ese dia en su agenda. Se emite una orden de traslado. */
    if (!j.sitios.length) {
      const hacia = j.regreso ? 'BASE' : j.lugar;
      const dd = dest[hacia] || {};
      cuad.tecnicos.forEach(function (tec) {
        n += 1;
        const esConductor = tec === conductor;
        ordenes.push({
          ID: 'ORD-' + String(n).padStart(3, '0'),
          Origen: 'CASO_1',
          Tecnico: tec, Nombre_Tecnico: nombre[tec], Email: emailDe(tec),
          Cuadrilla: cuad.id, Dia: 'D' + j.dia, Fecha: fechaDe(j.dia),
          Destino: j.regreso ? 'Regreso a base' : 'Traslado a ' + hacia,
          Region: dd.region || 'Metropolitana',
          Direccion: j.regreso ? DIRECCION_BASE : dd.direccion,
          En_RM: j.regreso ? 'Si' : (dd.rm || 'No'),
          Equipos: 0, Tecnicos_En_Sitio: nTec, Tandas: 0, Horas_Trabajo: 0,
          Horas_Jornada: j.horas, Horas_Extra: j.extra,
          Costo_Horas_Extra: Math.round(j.extra * COSTO_HORA_EXTRA),
          Conduccion_Dia: j.conduccion,
          Conduccion_Por_Tecnico: r2(j.conduccion / nTec),
          Vehiculo: cuad.vehiculo, Conductor: esConductor ? 'Si' : 'No',
          Noches: j.pernocta ? 1 : 0,
          Hotel_Zona: j.pernocta ? (dest[j.lugar] || {}).zonaHotel || '' : 'No aplica',
          Hotel_Direccion: j.pernocta ? j.lugar + ', Chile' : '',
          Km_Ida: 0, Km_Dia: j.km,
          Viatico: estipendio('No').monto, Tipo_Estipendio: estipendio('No').tipo,
          Hotel_Monto: (j.pernocta ? 1 : 0) * P.HOTEL,
          Peaje: esConductor ? j.peaje : 0,
          Combustible: esConductor ? Math.round(j.km / P.RENDIMIENTO * P.DIESEL) : 0,
          Gastos_Extra: 0,
          Total_Transferencia: redondearTransferencia(
            estipendio('No').monto + (j.pernocta ? 1 : 0) * P.HOTEL +
            (esConductor ? j.peaje + Math.round(j.km / P.RENDIMIENTO * P.DIESEL) : 0)),
          Estado: 'Pendiente',
          Observaciones: j.regreso ? 'Dia de regreso, sin instalacion'
                                   : 'Dia de traslado, sin instalacion',
          Foto_Instalacion: '', Firma_Cliente: ''
        });
      });
      return;
    }

    // Combustible y peaje son del VEHICULO y del DIA, no de cada sitio: se
    // cobran una sola vez, al conductor, sobre los km efectivamente recorridos.
    const combustibleDia = Math.round(j.km / P.RENDIMIENTO * P.DIESEL);
    const peajeDia = j.peaje;

    j.sitios.forEach(function (loc) {
      const d = dest[loc];

      cuad.tecnicos.forEach(function (tec) {
        n += 1;
        const id = 'ORD-' + String(n).padStart(3, '0');
        const esConductor = tec === conductor;
        const primeroDelDia = loc === j.sitios[0];
        // Viatico una vez por tecnico y por dia, no por orden.
        const est = estipendio(d.rm);
        const viatico = primeroDelDia ? est.monto : 0;
        const noches = (primeroDelDia && j.pernocta) ? 1 : 0;
        const hotelMonto = noches * P.HOTEL;
        const extra = primeroDelDia ? j.extra : 0;
        const costoExtra = Math.round(extra * COSTO_HORA_EXTRA);
        // Solo la primera orden del dia lleva el costo del vehiculo.
        const cargaVehiculo = esConductor && primeroDelDia;
        const transferencia = redondearTransferencia(viatico + hotelMonto +
          (cargaVehiculo ? peajeDia + combustibleDia : 0));

        ordenes.push({
          ID: id,
          Origen: 'CASO_1',
          Tecnico: tec, Nombre_Tecnico: nombre[tec], Email: emailDe(tec),
          Cuadrilla: cuad.id, Dia: 'D' + j.dia, Fecha: fechaDe(j.dia),
          Destino: loc, Region: d.region, Direccion: d.direccion, En_RM: d.rm,
          Equipos: d.equipos, Tecnicos_En_Sitio: nTec, Tandas: tandas(loc, nTec),
          Horas_Trabajo: r2(horasTrabajo(loc, nTec)),
          Horas_Jornada: j.horas, Horas_Extra: extra, Costo_Horas_Extra: costoExtra,
          Conduccion_Dia: j.conduccion,
          Conduccion_Por_Tecnico: r2(j.conduccion / nTec),
          Vehiculo: cuad.vehiculo, Conductor: esConductor ? 'Si' : 'No',
          Noches: noches,
          Hotel_Zona: noches > 0 ? (dest[j.lugar] || d).zonaHotel : 'No aplica',
          Hotel_Direccion: noches > 0 ? j.lugar + ', Chile' : '',
          Km_Ida: kmEntre('BASE', loc), Km_Dia: j.km,
          Viatico: viatico, Tipo_Estipendio: primeroDelDia ? est.tipo : '',
          Hotel_Monto: hotelMonto,
          Peaje: cargaVehiculo ? peajeDia : 0,
          Combustible: cargaVehiculo ? combustibleDia : 0,
          Gastos_Extra: 0,
          Total_Transferencia: transferencia,
          Estado: 'Pendiente', Observaciones: '', Foto_Instalacion: '', Firma_Cliente: ''
        });

        IMPLEMENTOS.forEach(function (im) {
          const ord = im[0], item = im[1], cat = im[2];
          if (cat === 'VEHICULO' && !esConductor) { return; }
          checks.push({ ID: id + '-I' + String(ord).padStart(2, '0'),
            ID_Orden: id, Item_ID: 'I' + String(ord).padStart(2, '0'),
            Item: item, Categoria: cat, Listo: 'FALSE', Observacion: '' });
        });
      });
    });
  });
});

/* ==========================================================================
 * G. ESCRITURA
 * ========================================================================== */
function csv(filas) {
  if (!filas.length) { return ''; }
  const cols = Object.keys(filas[0]);
  const esc = function (val) {
    const s = String(val === null || val === undefined ? '' : val);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lineas = [cols.join(',')];
  filas.forEach(function (f) {
    lineas.push(cols.map(function (c) { return esc(f[c]); }).join(','));
  });
  return lineas.join('\n') + '\n';
}
function escribir(nom, filas) {
  fs.writeFileSync(path.join(SALIDA, nom + '.csv'), csv(filas), 'utf8');
  console.log(nom.padEnd(14) + String(filas.length).padStart(5) + ' filas');
}

escribir('ORDENES', ordenes);
escribir('CHECKLIST', checks);
escribir('TECNICOS', TECNICOS.map(function (t) {
  return { Codigo: t[0], Nombre: t[1], Licencia_Conducir: 'Si', Activo: 'Si',
    Email: emailDe(t[0]), Telefono: '' };
}));
escribir('FLOTA', FLOTA.map(function (v) {
  const usada = CUADRILLAS.filter(function (c) { return c.vehiculo === v[0]; })[0];
  return { Codigo: v[0], Modelo: 'Peugeot Partner', Patente: '',
    Capacidad: P.CAPACIDAD_CAMIONETA,
    Estado: usada ? 'Asignada ' + usada.id : 'Reserva', Lleva_Herramientas: 'Si' };
}));
escribir('DESTINOS', DESTINOS.map(function (d) {
  return { Localidad: d[0], Region: d[1], Direccion: d[2], En_RM: d[3],
    Equipos_PDF: d[4], Hotel_Zona: d[5], Km_Ida: d[6], Peaje_Ida: d[7], Corredor: d[8] };
}));
escribir('IMPLEMENTOS', IMPLEMENTOS.map(function (i) {
  return { Item_ID: 'I' + String(i[0]).padStart(2, '0'), Orden: i[0],
    Item: i[1], Categoria: i[2] };
}));
escribir('GASTOS', [{
  ID: 'GAS-001', ID_Orden: 'ORD-001', Tecnico: 'T01', Fecha: '2026-09-21',
  Tipo: 'Colacion', Monto: 0, Boleta: '', Descripcion: 'Fila de ejemplo, borrar',
  Estado_Rendicion: 'Pendiente'
}]);

/* ==========================================================================
 * H. INFORME
 * ========================================================================== */
console.log('\n=== ITINERARIO POR CUADRILLA ===');
CUADRILLAS.forEach(function (c) {
  const js = bitacoraJornadas.filter(function (b) { return b.cuadrilla === c.id; });
  console.log('\n' + c.id + ' · ' + c.corredor + ' · ' + c.vehiculo +
    ' · ' + c.tecnicos.map(function (t) { return nombre[t]; }).join(' + '));
  js.forEach(function (b) {
    const j = b.j;
    const que = j.viajeSolo ? 'viaje a ' + j.lugar
      : j.regreso ? 'regreso a base'
      : j.sitios.join(' + ');
    console.log('  D' + j.dia + ' ' + fechaDe(j.dia) + '  ' +
      String(j.horas).padStart(5) + 'h' +
      (j.extra > 0 ? '  +' + j.extra + 'h extra' : '           ') +
      (j.conduccion > P.CONDUCCION_MAX_DIA ? ' !VOLANTE ' : '  ') +
      'conduce ' + b.conductor + '  ' + que +
      (j.pernocta ? '  [pernocta en ' + j.lugar + ']' : ''));
  });
});

const equipos = DESTINOS.reduce(function (s, d) { return s + d[4]; }, 0);
const tecnicoNoches = ordenes.reduce(function (s, o) { return s + o.Noches; }, 0);
const tecnicoDias = ordenes.filter(function (o) { return o.Viatico > 0; }).length;
const extraTotal = ordenes.reduce(function (s, o) { return s + o.Costo_Horas_Extra; }, 0);
const peajes = ordenes.reduce(function (s, o) { return s + o.Peaje; }, 0);
const comb = ordenes.reduce(function (s, o) { return s + o.Combustible; }, 0);
const total = ordenes.reduce(function (s, o) { return s + o.Total_Transferencia; }, 0);
const diasPlan = Math.max.apply(null, bitacoraJornadas.map(function (b) { return b.j.dia; }));

console.log('\n=== CUADRATURA CONTRA EL PDF ===');
console.log('Equipos instalados      ' + equipos + '   (PDF: 33)');
console.log('Localidades             ' + DESTINOS.length + '   (PDF: 16)');
console.log('Tecnicos                ' + TECNICOS.length + '   (PDF: 10)  en ' +
  CUADRILLAS.length + ' cuadrillas de ' + P.CAPACIDAD_CAMIONETA);
console.log('Camionetas usadas       ' + CUADRILLAS.length + ' de ' + FLOTA.length +
  '   (PDF: 6)   queda V6 de reserva');
console.log('Duracion del plan       ' + diasPlan + ' dias habiles');
console.log('Ordenes de trabajo      ' + ordenes.length);

const nViatico = ordenes.filter(function (o) { return o.Tipo_Estipendio === 'Viatico'; }).length;
const nColacion = ordenes.filter(function (o) { return o.Tipo_Estipendio === 'Colacion'; }).length;
const sumaEst = ordenes.reduce(function (s, o) { return s + o.Viatico; }, 0);
const kmTotales = bitacoraJornadas.reduce(function (s, b) { return s + (b.j.km || 0); }, 0);
const desgaste = kmTotales * P.COSTO_KM;
const subtotal = sumaEst + tecnicoNoches * P.HOTEL + peajes + comb;

console.log('\n=== DINERO ===');
console.log('Viatico fuera de la RM  ' + String(nViatico).padStart(3) + ' tec-dias x $' +
  P.VIATICO.toLocaleString('es-CL') + '  = $' + (nViatico * P.VIATICO).toLocaleString('es-CL'));
console.log('Colacion en la RM       ' + String(nColacion).padStart(3) + ' tec-dias x $' +
  P.COLACION_RM.toLocaleString('es-CL') + '   = $' +
  (nColacion * P.COLACION_RM).toLocaleString('es-CL'));
console.log('Alojamiento             ' + String(tecnicoNoches).padStart(3) + ' tec-noches x $' +
  P.HOTEL.toLocaleString('es-CL') + ' = $' + (tecnicoNoches * P.HOTEL).toLocaleString('es-CL'));
console.log('Peajes                                      $' + peajes.toLocaleString('es-CL'));
console.log('Combustible   ' + kmTotales.toLocaleString('es-CL') +
  ' km / 20 km/L x $1.381    = $' + comb.toLocaleString('es-CL'));
console.log('                                            ----------');
console.log('Subtotal                                    $' + subtotal.toLocaleString('es-CL'));
console.log('+ holgura 10% imprevistos, redondeo al millar');
console.log('TOTAL A TRANSFERIR                          $' + total.toLocaleString('es-CL'));
console.log('\nCostos de empresa, NO se transfieren:');
console.log('  Horas extra                               $' + extraTotal.toLocaleString('es-CL'));
console.log('  Desgaste  ' + kmTotales.toLocaleString('es-CL') + ' km x $' + P.COSTO_KM +
  '                   = $' + desgaste.toLocaleString('es-CL'));
console.log('\n=== HORAS EXTRA vs HOSTAL ===');
console.log('2 h extra para 2 tecnicos:  2 x 2 x $' + COSTO_HORA_EXTRA.toLocaleString('es-CL') +
  ' = $' + (2 * 2 * COSTO_HORA_EXTRA).toLocaleString('es-CL'));
console.log('1 noche para 2 tecnicos:    2 x $' + P.HOTEL.toLocaleString('es-CL') +
  ' + 2 x $' + P.VIATICO.toLocaleString('es-CL') + ' del dia siguiente = $' +
  (2 * P.HOTEL + 2 * P.VIATICO).toLocaleString('es-CL'));
console.log('Por eso se vuelve con horas extra siempre que el regreso quepa en 10,4 h.');

console.log('\n=== CARGA POR TECNICO ===');
TECNICOS.forEach(function (t) {
  const mias = ordenes.filter(function (o) { return o.Tecnico === t[0]; });
  const dias = {};
  mias.forEach(function (o) { dias[o.Fecha] = true; });
  const ds = Object.keys(dias).sort();
  console.log(t[0] + '  ' + nombre[t[0]].padEnd(18) + String(mias.length).padStart(2) +
    ' ordenes  ' + (ds.length ? ds.map(function (f) { return f.slice(5); }).join(' ')
                              : 'SIN CARGA · disponible'));
});

/* ==========================================================================
 * I. FUTURA MEJORA  (lo que el PDF pide justificar)
 * --------------------------------------------------------------------------
 * Se evalua la alternativa contra el plan vigente usando el MISMO
 * planificador, no a ojo. La comparacion es en dias de calendario y en plata.
 * ========================================================================== */
function evaluar(cuads) {
  let dias = 0, tDias = 0, tNoches = 0, extra = 0;
  cuads.forEach(function (c) {
    const n = c.tecnicos.length;
    planificar(c).forEach(function (j) {
      dias = Math.max(dias, j.dia);
      tDias += n;
      if (j.pernocta) { tNoches += n; }
      extra += j.extra * n * COSTO_HORA_EXTRA;
    });
  });
  return { dias: dias, tDias: tDias, tNoches: tNoches,
    extra: Math.round(extra),
    plata: tDias * P.VIATICO + tNoches * P.HOTEL };
}

/* Alternativa: contratar 2 tecnicos (sexta cuadrilla) y ocupar V6, partiendo
 * el corredor norte, que es el que manda la duracion del plan. */
const ALTERNATIVA = [
  { id: 'C1a', tecnicos: ['T01', 'T02'], vehiculo: 'V1', corredor: 'Copiapo',
    ruta: ['Copiapo'] },
  { id: 'C1b', tecnicos: ['T11', 'T12'], vehiculo: 'V6', corredor: 'Coquimbo y La Calera',
    ruta: ['Coquimbo', 'La Calera'] },
  CUADRILLAS[1], CUADRILLAS[2], CUADRILLAS[3], CUADRILLAS[4]
];

const base = evaluar(CUADRILLAS);
const alt = evaluar(ALTERNATIVA);
console.log('\n=== FUTURA MEJORA: contratar 2 tecnicos y usar V6 ===');
console.log('                        actual      con 6 cuadrillas   diferencia');
console.log('Duracion del plan   ' + String(base.dias).padStart(7) + ' dias' +
  String(alt.dias).padStart(14) + ' dias' + String(alt.dias - base.dias).padStart(12) + ' dias');
console.log('Tecnico-dias        ' + String(base.tDias).padStart(7) +
  String(alt.tDias).padStart(19) + String(alt.tDias - base.tDias).padStart(17));
console.log('Tecnico-noches      ' + String(base.tNoches).padStart(7) +
  String(alt.tNoches).padStart(19) + String(alt.tNoches - base.tNoches).padStart(17));
console.log('Viatico + hotel      $' + base.plata.toLocaleString('es-CL').padStart(9) +
  '   $' + alt.plata.toLocaleString('es-CL').padStart(12) +
  '   $' + (alt.plata - base.plata).toLocaleString('es-CL').padStart(10));
console.log('Horas extra          $' + base.extra.toLocaleString('es-CL').padStart(9) +
  '   $' + alt.extra.toLocaleString('es-CL').padStart(12));

/* ==========================================================================
 * J. DOTACION POR SITIO
 * --------------------------------------------------------------------------
 * El tamano de cuadrilla NO lo fija el PDF, asi que hay que sustentarlo.
 * Los diez tecnicos tienen licencia: se puede mandar cualquier dotacion a
 * cualquier punto. Lo que decide es el costo.
 * ========================================================================== */
console.log('\n=== CONVIENE MANDAR MAS GENTE A UN SITIO? ===');
console.log('Sitio            Eq   con 2   con n  ahorra      movil+  estipendio+      TOTAL+   vale');
let hubo = false;
DESTINOS.forEach(function (d) {
  const loc = d[0], eq = d[4], km = d[6], peajeIda = d[7], enRM = d[3];
  if (eq <= P.CAPACIDAD_CAMIONETA) { return; }
  hubo = true;
  /* Dias que la cuadrilla que atiende este sitio pasa desplegada, y si duerme
   * fuera: de ahi sale lo que costaria cada tecnico adicional. En la RM es
   * colacion, no viatico, porque el tecnico vuelve a dormir a su casa. */
  const cuad = CUADRILLAS.filter(function (c) { return c.ruta.indexOf(loc) >= 0; })[0];
  const js = bitacoraJornadas.filter(function (b) { return b.cuadrilla === cuad.id; });
  const dias = js.length;
  const duermeFuera = js.some(function (b) { return b.j.pernocta; });
  const porDia = (enRM !== 'Si' && duermeFuera) ? P.VIATICO : P.COLACION_RM;
  const noches = js.filter(function (b) { return b.j.pernocta; }).length;

  const conBase = Math.ceil(eq / P.CAPACIDAD_CAMIONETA) * HORAS_POR_EQUIPO;
  const movilesExtra = Math.ceil(eq / P.CAPACIDAD_CAMIONETA) - 1;
  const extraMovil = movilesExtra *
    (Math.round(km * 2 / P.RENDIMIENTO * P.DIESEL) + peajeIda * 2);
  const nExtra = eq - P.CAPACIDAD_CAMIONETA;
  const extraGente = nExtra * (dias * porDia + noches * P.HOTEL);
  const totalExtra = extraMovil + extraGente;
  /* P_VALORA_TIEMPO_TECNICO = 'Solo si genera sobretiempo'. Ahorrar horas de
   * una jornada que ya cabe en las 8,4 h ordinarias NO ahorra dinero: el
   * tecnico esta contratado igual y simplemente vuelve antes. Solo valen las
   * horas que hoy se pagan como extra. */
  const jornadaDelSitio = Math.max.apply(null, js.map(function (b) {
    return b.j.sitios.indexOf(loc) >= 0 ? b.j.horas : 0; }));
  const extraDelSitio = Math.max(0, jornadaDelSitio - P.JORNADA_DIA);
  const horasQueValen = Math.min(conBase - HORAS_POR_EQUIPO, extraDelSitio);
  const valorAhorro = Math.round(horasQueValen * P.CAPACIDAD_CAMIONETA * COSTO_HORA_EXTRA);

  console.log(loc.padEnd(16) + String(eq).padStart(3) +
    String(conBase).padStart(7) + 'h' + String(HORAS_POR_EQUIPO).padStart(7) + 'h' +
    String(r2(conBase - HORAS_POR_EQUIPO)).padStart(7) + 'h' +
    ('$' + extraMovil.toLocaleString('es-CL')).padStart(12) +
    ('$' + extraGente.toLocaleString('es-CL')).padStart(13) +
    ('$' + totalExtra.toLocaleString('es-CL')).padStart(12) +
    ('  $' + valorAhorro.toLocaleString('es-CL')) +
    (jornadaDelSitio <= P.JORNADA_DIA ? '  (jornada de ' + jornadaDelSitio +
      'h, no genera sobretiempo)' : ''));
});
if (!hubo) { console.log('Ningun sitio supera la capacidad del vehiculo.'); }
console.log('');
console.log('Ninguna jornada de estos sitios pasa de las 8,4 h ordinarias, asi que las');
console.log('horas ahorradas no valen dinero: el tecnico vuelve antes, nada mas. El');
console.log('sobrecosto, en cambio, es real y se paga.');
console.log('Por eso la cuadrilla es de ' + P.CAPACIDAD_CAMIONETA + ' y no mas.');
console.log('\n=== CONTRATAR: COSTO VARIABLE vs COSTO FIJO ===');
console.log('Ahorro por despliegue: 1 dia, con sobrecosto de $' +
  (alt.plata - base.plata + alt.extra - base.extra).toLocaleString('es-CL'));
console.log('Costo fijo de 2 tecnicos: 2 x $' + P.COSTO_TECNICO_MES.toLocaleString('es-CL') +
  ' = $' + (2 * P.COSTO_TECNICO_MES).toLocaleString('es-CL') + ' al mes');
console.log('Decide la FRECUENCIA de despliegues, no el ahorro por viaje.');

/* ==========================================================================
 * K. QUE MONTO REQUIERE CADA TECNICO
 * --------------------------------------------------------------------------
 * Es la pregunta textual del enunciado. El rango lo explican, en orden: las
 * noches fuera, si trabajo fuera de la RM, y si le toco conducir.
 * ========================================================================== */
console.log('\n=== QUE MONTO REQUIERE CADA TECNICO ===');
console.log('Tec  Nombre             Dias Noch Conduce   Viat/Col     Hotel     Peaje      Comb      TOTAL');
const porTec = {};
ordenes.forEach(function (o) {
  const t = porTec[o.Tecnico] || (porTec[o.Tecnico] = {
    v: 0, h: 0, p: 0, c: 0, t: 0, n: 0, dias: {}, cond: {} });
  t.v += o.Viatico; t.h += o.Hotel_Monto; t.p += o.Peaje;
  t.c += o.Combustible; t.t += o.Total_Transferencia; t.n += o.Noches;
  t.dias[o.Fecha] = true;
  if (o.Conductor === 'Si') { t.cond[o.Dia] = true; }
});
const pesos = function (n) { return ('$' + n.toLocaleString('es-CL')).padStart(10); };
TECNICOS.forEach(function (tec) {
  const t = porTec[tec[0]];
  if (!t) { return; }
  console.log(tec[0] + '  ' + tec[1].padEnd(18) +
    String(Object.keys(t.dias).length).padStart(3) +
    String(t.n).padStart(5) + '  ' +
    Object.keys(t.cond).sort().join(',').padEnd(8) +
    pesos(t.v) + pesos(t.h) + pesos(t.p) + pesos(t.c) + pesos(t.t));
});
console.log(' '.repeat(59) + 'TOTAL' + pesos(total));
