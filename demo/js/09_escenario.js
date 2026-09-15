/* Datos sintéticos solicitados para presentación. No corresponden a pagos reales.
   Carga aditiva e idempotente; no reemplaza registros operativos existentes. */
function comprobanteEjemplo(folio, tipo, monto) {
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="210"><rect width="320" height="210" fill="#fff"/><text x="20" y="35" font-size="18">COMPROBANTE INTERNO</text><text x="20" y="75">' + folio + '</text><text x="20" y="110">' + tipo + '</text><text x="20" y="150" font-size="24">$' + monto + '</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
function cargarEscenarioFinanciero(e) {
  if (e.escenarioFinancieroV1) { return false; }
  var p = recalcularPlan(e);
  var casos = [
    ['T01', 'Viático', 25000, 'Aprobado', false], ['T01', 'Combustible', 48000, 'Aprobado', false],
    ['T01', 'Hotel', 50000, 'Pendiente', false], ['T02', 'Viático', 25000, 'Pendiente', false],
    ['T03', 'Peaje', 10500, 'Aprobado', false], ['T03', 'Hotel', 50000, 'Aprobado', false],
    ['T04', 'Viático', 25000, 'Pendiente', false], ['T05', 'Combustible', 62000, 'Aprobado', false],
    ['T05', 'Otro', 18500, 'Pendiente', true], ['T06', 'Hotel', 50000, 'Rechazado', false],
    ['T07', 'Colación', 5000, 'Aprobado', false], ['T08', 'Colación', 5000, 'Pendiente', false],
    ['T09', 'Peaje', 6500, 'Pendiente', false], ['T10', 'Colación', 5000, 'Aprobado', false]
  ];
  ['T01', 'T02', 'T05', 'T07'].forEach(function (id) {
    var n = p.nomina.find(function (n) { return n.ID_Tecnico === id; });
    if (n && !e.pagos[id]) { e.pagos[id] = { Monto: n.Total, Fecha: FECHA_INICIO_PLAN + 'T08:00:00-03:00', Simulado: true }; }
  });
  casos.forEach(function (c, i) {
    var o = e.ordenes.find(function (o) { return o.ID_Tecnico === c[0]; });
    if (!o) { return; }
    e.consecutivos.gasto++;
    var id = 'G' + pad4(e.consecutivos.gasto);
    e.gastos.push({ ID_Gasto: id, ID_Orden: o.ID_Orden, ID_Tecnico: c[0], Fecha: fechaLaboral(FECHA_INICIO_PLAN, i % 3), Tipo: c[1],
      Monto: c[2], Estado: c[3], Emergencia: c[4], Comprobante: comprobanteEjemplo(id, c[1], c[2]),
      Comentario: c[3] === 'Rechazado' ? 'Comprobante emitido fuera del período autorizado.' : '', Simulado: true });
  });
  e.escenarioFinancieroV1 = true;
  return true;
}
ACCIONES.cargarEscenario = function () { return cargarEscenarioFinanciero(estado); };
