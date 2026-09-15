/* PRUEBAS DEL MOTOR. Se corren con: node demo/pruebas.cjs
   Los archivos .js se cargan en un mismo contexto de vm, igual que Apps Script comparte
   globales entre archivos: 01_motor.js usa BASE_OPERACIONES, que declara 00_datos.js.

   Verifican REGLAS Y CUADRATURAS, no importes fijos. Los montos concretos cambian si se
   editan los tramos o los parametros, y eso es correcto. */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var contexto = vm.createContext({ console: console, Date: Date, Math: Math, JSON: JSON });

['00_datos.js', '01_motor.js'].forEach(function (archivo) {
  var ruta = path.join(__dirname, 'js', archivo);
  new vm.Script(fs.readFileSync(ruta, 'utf8'), { filename: archivo }).runInContext(contexto);
});

var fallos = 0;
var pasadas = 0;

function afirmar(descripcion, condicion, detalle) {
  if (condicion) {
    pasadas++;
    console.log('  ok   ' + descripcion);
  } else {
    fallos++;
    console.log('  FALLA ' + descripcion + (detalle ? '\n         ' + detalle : ''));
  }
}

function casi(a, b, tolerancia) {
  return Math.abs(a - b) <= (tolerancia === undefined ? 0.5 : tolerancia);
}

function nuevoEstado() {
  var e = contexto.construirSemilla();
  e.pagos = {};
  return e;
}

console.log('\nPlan de la semilla');
var estado = nuevoEstado();
var plan = contexto.recalcularPlan(estado);
var r = plan.resumen;

afirmar('33 equipos previstos', r.Equipos_Previstos === 33, 'fueron ' + r.Equipos_Previstos);
afirmar('16 comunas con equipos', Object.keys(plan.porComuna).length === 16,
  'fueron ' + Object.keys(plan.porComuna).length);
afirmar('16 capacitaciones', r.Capacitaciones === 16, 'fueron ' + r.Capacitaciones);
afirmar('15 jornadas', r.Jornadas === 15, 'fueron ' + r.Jornadas);
afirmar('30 órdenes de trabajo', r.Ordenes === 30, 'fueron ' + r.Ordenes);
afirmar('510 filas de checklist',
  estado.ordenes.reduce(function (a, o) { return a + o.Checklist.length; }, 0) === 510);
afirmar('17 implementos obligatorios', estado.implementos.length === 17);

console.log('\nCuadraturas de dinero');
var sumaNomina = plan.nomina.reduce(function (a, n) { return a + n.Total; }, 0);
afirmar('la suma de las transferencias individuales es el total de la nómina',
  casi(sumaNomina, r.Nomina, 0.01), sumaNomina + ' contra ' + r.Nomina);
afirmar('costo total = nómina + desgaste + horas extra',
  casi(r.Costo_Total, r.Nomina + r.Desgaste + r.Costo_Horas_Extra, 0.01));
afirmar('el subtotal suma combustible, peajes, estipendios y hotel',
  casi(r.Subtotal, r.Combustible + r.Peajes + r.Viaticos + r.Colaciones + r.Hotel, 0.01));
afirmar('toda transferencia con monto queda redondeada al millar',
  plan.nomina.every(function (n) { return n.Total === 0 || n.Total % 1000 === 0; }));
afirmar('la reserva nunca es negativa',
  plan.nomina.every(function (n) { return n.Reserva >= 0; }));
afirmar('la reserva es al menos el 10% de la base',
  plan.nomina.every(function (n) {
    return n.Base === 0 || n.Reserva >= n.Base * estado.parametros.P_IMPREVISTOS - 0.01;
  }));
afirmar('el desgaste no entra en ninguna transferencia',
  plan.nomina.every(function (n) {
    return casi(n.Base, n.Viatico + n.Colacion + n.Hotel + n.Combustible + n.Peaje, 0.01);
  }));

console.log('\nReglas de conducción');
afirmar('ningún técnico sin licencia figura como conductor',
  plan.jornadas.every(function (j) {
    var t = plan.tecnicosPorId[j.Conductor];
    return t && t.Licencia;
  }));
afirmar('solo el conductor recibe combustible y peajes',
  plan.nomina.every(function (n) {
    var conduce = plan.jornadas.some(function (j) { return j.Conductor === n.ID_Tecnico; });
    return conduce ? n.Combustible > 0 : n.Combustible === 0 && n.Peaje === 0;
  }));
afirmar('ninguna jornada excede la capacidad de la camioneta',
  plan.jornadas.every(function (j) { return j.Tecnicos.length <= estado.parametros.P_CAPACIDAD_CAMIONETA; }));

console.log('\nEstipendios');
afirmar('viático y colación son excluyentes en cada jornada',
  plan.jornadas.every(function (j) {
    return j.Estipendio_Tipo === 'Viático' || j.Estipendio_Tipo === 'Colación';
  }));
afirmar('una jornada íntegra en la RM paga colación',
  plan.jornadas.filter(function (j) { return !j.Fuera_RM; })
    .every(function (j) { return j.Estipendio === estado.parametros.P_COLACION; }));
afirmar('una jornada que sale de la RM paga viático, incluso si es solo retorno',
  plan.jornadas.filter(function (j) { return j.Fuera_RM; })
    .every(function (j) { return j.Estipendio === estado.parametros.P_VIATICO; }));

console.log('\nAlertas');
afirmar('toda jornada sobre el tope diario genera alerta',
  plan.jornadas.every(function (j) {
    if (j.Horas_Totales <= estado.parametros.P_TOPE_DIA) { return true; }
    return j.Alertas.some(function (a) { return a.texto.indexOf('tope diario') !== -1; });
  }));
afirmar('toda jornada sobre el máximo de conducción genera alerta',
  plan.jornadas.every(function (j) {
    if (j.Horas_Viaje <= estado.parametros.P_TOPE_CONDUCCION) { return true; }
    return j.Alertas.some(function (a) { return a.texto.indexOf('conducción') !== -1; });
  }));

console.log('\nCapacitacion digital');
var conLink = nuevoEstado();
conLink.destinos.forEach(function (d) { d.Link_Enviado = true; });
var planConLink = contexto.recalcularPlan(conLink);
var capSin = plan.jornadas.reduce(function (a, j) { return a + j.Horas_Capacitacion; }, 0);
var capCon = planConLink.jornadas.reduce(function (a, j) { return a + j.Horas_Capacitacion; }, 0);
afirmar('enviar el link reduce la capacitación exactamente a la mitad',
  casi(capCon, capSin / 2, 0.001), capCon + ' contra ' + (capSin / 2));
afirmar('con link enviado las horas totales del plan bajan',
  planConLink.resumen.Horas_Plan < r.Horas_Plan);

console.log('\nParametros editables');
var caro = nuevoEstado();
caro.parametros = contexto.derivarParametros(Object.assign({}, contexto.PARAMETROS_BASE, { P_DIESEL: 2762 }));
var planCaro = contexto.recalcularPlan(caro);
afirmar('duplicar el diesel duplica el combustible',
  casi(planCaro.resumen.Combustible, r.Combustible * 2, 1),
  planCaro.resumen.Combustible + ' contra ' + (r.Combustible * 2));
afirmar('duplicar el diesel no toca los peajes',
  casi(planCaro.resumen.Peajes, r.Peajes, 0.01));
afirmar('duplicar el diesel no toca los viáticos',
  casi(planCaro.resumen.Viaticos, r.Viaticos, 0.01));

var sinReserva = nuevoEstado();
sinReserva.parametros = contexto.derivarParametros(Object.assign({}, contexto.PARAMETROS_BASE, { P_IMPREVISTOS: 0 }));
var planSinReserva = contexto.recalcularPlan(sinReserva);
afirmar('sin reserva la nómina baja',
  planSinReserva.resumen.Nomina < r.Nomina);

console.log('\nEnlace de Google Maps');
var conVariosTramos = plan.jornadas.filter(function (j) { return j.Tramos.length >= 3; })[0];
var url = contexto.enlaceMaps(conVariosTramos, estado);
afirmar('el enlace usa coordenadas y no texto de dirección',
  /origin=-?\d+\.\d+%2C-?\d+\.\d+/.test(url), url);
afirmar('el enlace encadena los waypoints intermedios',
  url.indexOf('waypoints=') !== -1, url);
afirmar('el enlace declara el modo de viaje',
  url.indexOf('travelmode=driving') !== -1);

console.log('\nEjecución del técnico');
var ejecutado = nuevoEstado();
var primera = ejecutado.ordenes[0];
primera.Checklist.forEach(function (c) { c.Marcado = true; });
primera.Hora_Inicio = '2026-09-21T09:00:00.000Z';
primera.Hora_Fin = '2026-09-21T14:00:00.000Z';
primera.Equipos_Instalados = 2;
var planEjecutado = contexto.recalcularPlan(ejecutado);
afirmar('un checklist completo se cuenta como completo',
  planEjecutado.resumen.Checklist_Completos === 1);
afirmar('las horas reales salen de la diferencia entre los hitos',
  casi(planEjecutado.resumen.Horas_Reales, 5, 0.001));
afirmar('los equipos instalados suben el avance',
  planEjecutado.resumen.Equipos_Instalados === 2);

console.log('\nGastos');
var conGasto = nuevoEstado();
conGasto.gastos.push({ ID_Gasto: 'G0001', ID_Tecnico: 'T01', Monto: 12000, Estado: 'Aprobado' });
conGasto.gastos.push({ ID_Gasto: 'G0002', ID_Tecnico: 'T01', Monto: 9000, Estado: 'Pendiente' });
var planGasto = contexto.recalcularPlan(conGasto);
afirmar('solo los gastos aprobados cuentan como rendido',
  planGasto.resumen.Rendido === 12000, 'fue ' + planGasto.resumen.Rendido);

console.log('\nAutoasignacion');
var propuesta = contexto.autoasignar(estado, plan, '2026-10-05', 2);
afirmar('en un día libre propone un equipo valido', propuesta.ok === true, propuesta.motivo);
afirmar('el conductor propuesto tiene licencia',
  propuesta.ok && plan.tecnicosPorId[propuesta.conductor].Licencia);
afirmar('la propuesta explica por qué eligió ese equipo',
  propuesta.ok && propuesta.motivo.length > 30);

console.log('\n' + pasadas + ' pasadas, ' + fallos + ' fallas\n');
process.exit(fallos > 0 ? 1 : 0);
