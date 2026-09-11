/**
 * ============================================================================
 *  04_Utils.gs  ·  Utilidades de fecha, hora, formato y geografia.
 * ============================================================================
 */

var MS_MIN = 60000;
var MS_HORA = 3600000;
var MS_DIA = 86400000;
var DIAS_ES = ['DO', 'LU', 'MA', 'MI', 'JU', 'VI', 'SA'];
var DIAS_LARGO = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

/** Semana ISO en formato 2026-W38. */
function semanaISO(fecha) {
  var d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  var dia = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dia);
  var inicioAnio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  var semana = Math.ceil((((d - inicioAnio) / MS_DIA) + 1) / 7);
  return d.getUTCFullYear() + '-W' + (semana < 10 ? '0' + semana : semana);
}

/** Lunes de una semana ISO '2026-W38'. */
function lunesDeSemanaISO(iso) {
  var partes = String(iso).split('-W');
  var anio = Number(partes[0]);
  var semana = Number(partes[1]);
  var enero4 = new Date(anio, 0, 4);
  var diaEnero4 = enero4.getDay() || 7;
  var lunesSemana1 = new Date(enero4);
  lunesSemana1.setDate(enero4.getDate() - diaEnero4 + 1);
  var lunes = new Date(lunesSemana1);
  lunes.setDate(lunesSemana1.getDate() + (semana - 1) * 7);
  lunes.setHours(0, 0, 0, 0);
  return lunes;
}

/** Arreglo de fechas habiles (LU..VI) de una semana ISO. */
function diasDeSemana(iso, diasHabiles) {
  var codigos = String(diasHabiles || 'LU,MA,MI,JU,VI').split(',').map(function (s) { return s.trim(); });
  var lunes = lunesDeSemanaISO(iso);
  var salida = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(lunes.getTime() + i * MS_DIA);
    if (codigos.indexOf(DIAS_ES[d.getDay()]) >= 0) salida.push(d);
  }
  return salida;
}

/** Combina una fecha con un texto 'HH:MM'. */
function enFechaHora(fecha, hhmm) {
  var p = String(hhmm).split(':');
  var d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(),
                   Number(p[0]) || 0, Number(p[1]) || 0, 0, 0);
  return d;
}

function sumarMin(fecha, minutos) { return new Date(fecha.getTime() + minutos * MS_MIN); }
function sumarHoras(fecha, horas) { return new Date(fecha.getTime() + horas * MS_HORA); }
function sumarDias(fecha, dias) { return new Date(fecha.getTime() + dias * MS_DIA); }
function difMin(a, b) { return Math.round((b.getTime() - a.getTime()) / MS_MIN); }
function difHoras(a, b) { return (b.getTime() - a.getTime()) / MS_HORA; }

/** Minutos transcurridos desde medianoche. */
function minutosDelDia(fecha) { return fecha.getHours() * 60 + fecha.getMinutes(); }

function hhmm(fecha) {
  if (!fecha) return '';
  var d = (fecha instanceof Date) ? fecha : new Date(fecha);
  return Utilities.formatDate(d, APP.TZ, 'HH:mm');
}

function ddmmyyyy(fecha) {
  if (!fecha) return '';
  var d = (fecha instanceof Date) ? fecha : new Date(fecha);
  return Utilities.formatDate(d, APP.TZ, 'dd-MM-yyyy');
}

function isoFecha(fecha) {
  if (!fecha) return '';
  var d = (fecha instanceof Date) ? fecha : new Date(fecha);
  return Utilities.formatDate(d, APP.TZ, 'yyyy-MM-dd');
}

function mismaFecha(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function aMedianoche(fecha) {
  var d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Formatea CLP: 1234567 -> $1.234.567 */
function clp(monto) {
  var n = Math.round(Number(monto) || 0);
  var signo = n < 0 ? '-' : '';
  n = Math.abs(n);
  var s = String(n).split('').reverse().join('').replace(/(\d{3})(?=\d)/g, '$1.');
  return signo + '$' + s.split('').reverse().join('');
}

function redondear(n, decimales) {
  var f = Math.pow(10, decimales || 0);
  return Math.round((Number(n) || 0) * f) / f;
}

/** Redondeo de dinero al alza en multiplos (viaticos en efectivo). */
function redondearArriba(monto, multiplo) {
  multiplo = multiplo || 1000;
  return Math.ceil((Number(monto) || 0) / multiplo) * multiplo;
}

/** Distancia haversine en km. Fallback cuando no hay Maps API. */
function haversineKm(lat1, lng1, lat2, lng2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Factor de sinuosidad: la carretera nunca es la linea recta.
 * En Chile, con la Ruta 5 como eje longitudinal, 1.25 es un estimador solido.
 */
function kmRutaEstimados(lat1, lng1, lat2, lng2) {
  return haversineKm(lat1, lng1, lat2, lng2) * 1.25;
}

function esSi(v) {
  var s = String(v).trim().toUpperCase();
  return s === 'SI' || s === 'TRUE' || s === 'VERDADERO' || s === '1' || s === 'X';
}

function siNo(b) { return b ? 'SI' : 'NO'; }

/** Normaliza texto para comparar (sin tildes, minusculas). */
function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n')
    .trim();
}

/** Clon superficial seguro. */
function clonar(obj) { return JSON.parse(JSON.stringify(obj)); }

/** Convierte horas decimales a '8h 24m'. */
function horasLegibles(horas) {
  var h = Math.floor(horas);
  var m = Math.round((horas - h) * 60);
  if (m === 60) { h += 1; m = 0; }
  return h + 'h' + (m ? ' ' + m + 'm' : '');
}
