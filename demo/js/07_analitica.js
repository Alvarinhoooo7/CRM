/* Gráficos locales: valores visibles, sin dependencias ni series inventadas. */
function metricasOperacion() {
  var fases = [0, 0, 0, 0];
  estado.ordenes.forEach(function (o) {
    fases[o.Hora_Fin ? 3 : o.Hora_Inicio ? 2 : checklistCompleto(o) ? 1 : 0]++;
  });
  var gastos = { Aprobado: 0, Pendiente: 0, Rechazado: 0 };
  estado.gastos.forEach(function (g) { if (gastos[g.Estado] !== undefined) { gastos[g.Estado] += Number(g.Monto) || 0; } });
  return { fases: fases, gastos: gastos };
}

function graficoBarras(titulo, nota, filas, dinero) {
  var max = Math.max.apply(null, filas.map(function (f) { return Math.max(0, f[1]); }).concat([1]));
  return '<section class="panel grafico"><h2>' + esc(titulo) + '</h2><p class="nota">' + esc(nota) + '</p>'
    + (filas.length ? filas.map(function (f, i) {
      return '<div class="grafico-fila"><div><span>' + esc(f[0]) + '</span><strong>'
        + esc(dinero ? clp(f[1]) : f[1]) + '</strong></div><div class="grafico-pista"><span style="width:'
        + Math.max(0, f[1] / max * 100) + '%;background:var(--serie-' + (i % 4) + ')"></span></div></div>';
    }).join('') : '<div class="vacio">Sin registros para mostrar.</div>') + '</section>';
}

function panelAnalitico(vista) {
  var m = metricasOperacion(), r = plan.resumen;
  var titulos = { resumen: ['Centro de operaciones', 'Avance, recursos y decisiones pendientes.'], finanzas: ['Control financiero', 'Presupuesto del plan y rendiciones registradas.'], desempeno: ['Desempeño del equipo', 'Cumplimiento de órdenes y preparación para terreno.'], gastos: ['Revisión de gastos', 'Prioriza comprobantes pendientes y controla las emergencias.'], nomina: ['Transferencias', 'Fondos asignados a cada integrante del equipo.'], parametros: ['Configuración del plan', 'Ajusta las reglas que utiliza el motor de cálculo.'] };
  var t = titulos[vista] || titulos.resumen;
  var html = '<header class="cabecera-seccion"><div><span class="sobretitulo">SERVICIO TÉCNICO / SUPERVISIÓN</span><h1>' + t[0] + '</h1><p>' + t[1] + '</p></div><span class="estado-local">Control de operaciones</span></header>';
  if (vista === 'resumen' || vista === 'nomina' || vista === 'gastos') {
    html += '<div class="indicadores">' + indicador(clp(r.Por_Transferir), 'Anticipos pendientes', 'aviso')
      + indicador(clp(r.Por_Reembolsar), 'Rendiciones aprobadas por pagar', 'aviso')
      + indicador(clp(r.Reembolsado), 'Reembolsos pagados') + '</div>';
  }
  if (vista === 'nomina' || vista === 'gastos') {
    var pendientes = plan.nomina.filter(function (n) { return n.Por_Reembolsar > 0; });
    html += '<section class="panel"><h2>Rendiciones por pagar</h2><p class="nota">Solo la parte aprobada que supera los fondos ya recibidos. Aprobar un comprobante no registra un pago.</p>'
      + (pendientes.length ? pendientes.map(function (n) { return '<div class="plata-fila"><span>' + esc(n.Nombre) + '</span><strong>' + esc(clp(n.Por_Reembolsar)) + '</strong><button class="boton chico" data-accion="reembolso" data-tecnico="' + esc(n.ID_Tecnico) + '">Registrar reembolso</button></div>'; }).join('') : '<p class="nota">No quedan rendiciones aprobadas por pagar.</p>') + '</section>';
  }
  if (vista === 'resumen' || vista === 'desempeno') {
    html += '<div class="paneles-analitica">' + graficoBarras('Flujo de órdenes', 'Estados excluyentes · total: ' + estado.ordenes.length, [['Por preparar', m.fases[0]], ['Listas para iniciar', m.fases[1]], ['En curso', m.fases[2]], ['Cerradas', m.fases[3]]]);
    var avance = r.Equipos_Previstos ? Math.min(100, r.Equipos_Instalados / r.Equipos_Previstos * 100) : 0;
    html += '<section class="panel grafico avance-panel"><div><h2>Avance de instalación</h2><p class="nota">Equipos reportados sobre equipos planificados.</p></div><div class="anillo" style="--avance:' + avance + '%"><div><strong>' + Math.round(avance) + '%</strong><span>completado</span></div></div><p><strong>' + r.Equipos_Instalados + '</strong> de ' + r.Equipos_Previstos + ' equipos</p></section></div>';
  }
  if (vista === 'desempeno') {
    html += '<div class="paneles-analitica">' + graficoBarras('Órdenes cerradas por técnico', 'Cantidad cerrada / asignada. No equivale a un ranking de productividad.', estado.tecnicos.map(function (t) {
      var os = estado.ordenes.filter(function (o) { return o.ID_Tecnico === t.ID_Tecnico; });
      return [t.Nombre + ' · ' + os.length + ' asignadas', os.filter(function (o) { return !!o.Hora_Fin; }).length];
    })) + graficoBarras('Carga planificada por técnico', 'Horas persona de todas las jornadas asignadas.', plan.nomina.map(function (n) { return [n.Nombre, Math.round(n.Horas * 10) / 10]; })) + '</div>';
  }
  if (vista === 'resumen') {
    html += '<div class="acciones-resumen"><button class="boton secundario" data-pestana="gastos">Revisar ' + estado.gastos.filter(function (g) { return g.Estado === 'Pendiente'; }).length + ' comprobantes pendientes</button><button class="boton secundario" data-pestana="nomina">Gestionar transferencias</button></div>';
  }
  if (vista === 'finanzas' || vista === 'gastos') {
    html += '<div class="indicadores">' + indicador(clp(m.gastos.Aprobado), 'Rendiciones aprobadas', 'acento') + indicador(clp(m.gastos.Pendiente), 'Pendiente de revisión', 'aviso') + indicador(clp(m.gastos.Rechazado), 'Rendiciones rechazadas') + indicador(clp(estado.gastos.filter(function (g) { return g.Emergencia && g.Estado !== 'Rechazado'; }).reduce(function (a, g) { return a + g.Monto; }, 0)), 'Emergencias aprobadas + pendientes') + '</div>';
    html += '<div class="paneles-analitica">' + graficoBarras('Estado de las rendiciones', 'Importes en CLP. Los rechazos no consumen el saldo.', Object.keys(m.gastos).map(function (k) { return [k, m.gastos[k]]; }), true);
    var tipos = {};
    estado.gastos.filter(function (g) { return g.Estado !== 'Rechazado'; }).forEach(function (g) { tipos[g.Tipo] = (tipos[g.Tipo] || 0) + g.Monto; });
    html += graficoBarras('Gastos por categoría', 'Aprobados + pendientes. Importes registrados, no costo ejecutado definitivo.', Object.keys(tipos).map(function (k) { return [k, tipos[k]]; }).sort(function (a, b) { return b[1] - a[1]; }), true) + '</div>';
    var dias = {};
    estado.gastos.forEach(function (g) { if (g.Estado === 'Aprobado') { dias[g.Fecha] = (dias[g.Fecha] || 0) + g.Monto; } });
    html += graficoBarras('Rendiciones aprobadas por fecha', 'Fecha de registro del comprobante. Solo se muestran días con registros aprobados.', Object.keys(dias).sort().map(function (d) { return [fechaCorta(d), dias[d]]; }), true);
  }
  return html;
}

