/* VISTA SUPERVISOR. Escritorio, densa y tabular: es una pantalla de datos.
   Seis pestanas: resumen, finanzas, desempeno, nomina, gastos y parametros. */

var PESTANAS_SUPERVISOR = [
  { id: 'resumen', titulo: 'Resumen' },
  { id: 'finanzas', titulo: 'Finanzas' },
  { id: 'desempeno', titulo: 'Desempeño' },
  { id: 'nomina', titulo: 'Nómina' },
  { id: 'gastos', titulo: 'Gastos' },
  { id: 'parametros', titulo: 'Parámetros' }
];

var pestanaSupervisor = 'resumen';

function dibujarSupervisor(contenedor) {
  contenedor.innerHTML =
    '<div class="barra">'
    + '<h1>Servicio técnico en ruta</h1>'
    + '<span class="quien">Supervisión · ' + esc(sesion.correo) + '</span>'
    + '<span class="empuje"></span>'
    + '<button class="boton" data-accion="imprimir">Imprimir informe</button>'
    + '<button class="boton" data-accion="reiniciar">Reiniciar demo</button>'
    + '<button class="boton" data-accion="salir">Salir</button>'
    + '</div>'
    + '<div class="pestanas" role="tablist">'
    + PESTANAS_SUPERVISOR.map(function (p) {
      return '<button class="pestana" role="tab" data-pestana="' + p.id + '" '
        + 'aria-selected="' + (p.id === pestanaSupervisor) + '">' + esc(p.titulo) + '</button>';
    }).join('')
    + '</div>'
    + '<div class="contenido" id="contenido-supervisor"></div>';

  contenedor.addEventListener('click', function (evento) {
    var boton = evento.target.closest('[data-pestana]');
    if (boton) {
      pestanaSupervisor = boton.getAttribute('data-pestana');
      dibujarSupervisor(contenedor);
      return;
    }
    manejarAccionSupervisor(evento);
  });

  contenedor.addEventListener('change', manejarCambioSupervisor);
  dibujarPestanaSupervisor();
}

/* Cada cambio redibuja la pestaña entera. Se conserva el scroll para que aprobar un
   gasto o editar un parámetro no devuelva la página al tope. */
function dibujarPestanaSupervisor() {
  var desplazamiento = window.scrollY;
  var caja = el('#contenido-supervisor');
  if (!caja) { return; }
  if (pestanaSupervisor === 'resumen') { caja.innerHTML = vistaResumen(); }
  else if (pestanaSupervisor === 'finanzas') { caja.innerHTML = vistaFinanzas(); }
  else if (pestanaSupervisor === 'desempeno') { caja.innerHTML = vistaDesempeno(); }
  else if (pestanaSupervisor === 'nomina') { caja.innerHTML = vistaNomina(); }
  else if (pestanaSupervisor === 'gastos') { caja.innerHTML = vistaGastos(); }
  else if (pestanaSupervisor === 'parametros') { caja.innerHTML = vistaParametros(); }
  window.scrollTo(0, desplazamiento);
}

/* ---------- Resumen ---------- */

function vistaResumen() {
  var r = plan.resumen;
  var altas = plan.alertas.filter(function (a) { return a.nivel === 'alto'; }).length;

  var html = '<div class="indicadores">'
    + indicador(clp(r.Costo_Total), 'Costo presupuestado del plan', 'acento')
    + indicador(clp(r.Nomina), 'A transferir a los técnicos')
    + indicador(clp(r.Transferido), 'Transferido')
    + indicador(clp(r.Rendido), 'Rendido con comprobante')
    + indicador(clp(r.Brecha), 'Brecha por rendir', r.Brecha > 0 ? 'aviso' : '')
    + indicador(r.Equipos_Instalados + ' / ' + r.Equipos_Previstos, 'Equipos instalados')
    + indicador(porcentaje(r.Avance), 'Avance del plan')
    + indicador(formatoHoras(r.Horas_Extra), 'Horas extra del plan', r.Horas_Extra > 0 ? 'aviso' : '')
    + indicador(String(altas), 'Alertas críticas', altas > 0 ? 'malo' : '')
    + '</div>';

  html += '<div class="columnas">';

  html += '<div class="panel"><h2>Cómo se compone el costo</h2>'
    + '<p class="nota">El desgaste de la camioneta es costo de empresa y no se le transfiere a nadie. '
    + 'La reserva del 10% si se transfiere, pero solo se puede usar en emergencia.</p>'
    + barras([
      ['Combustible', r.Combustible],
      ['Peajes', r.Peajes],
      ['Viáticos', r.Viaticos],
      ['Colaciones', r.Colaciones],
      ['Hotel', r.Hotel],
      ['Reserva 10%', r.Reserva],
      ['Horas extra', r.Costo_Horas_Extra],
      ['Desgaste', r.Desgaste]
    ])
    + '</div>';

  html += '<div class="panel"><h2>Estado de la operación</h2>'
    + '<table class="datos"><tbody>'
    + fila('Jornadas planificadas', r.Jornadas)
    + fila('Órdenes de trabajo', r.Ordenes)
    + fila('Checklist completos', r.Checklist_Completos + ' de ' + r.Ordenes)
    + fila('Órdenes iniciadas', r.Ordenes_Iniciadas)
    + fila('Órdenes cerradas', r.Ordenes_Cerradas)
    + fila('Capacitaciones', r.Capacitaciones)
    + fila('Kilómetros del plan', Math.round(r.Km).toLocaleString('es-CL') + ' km')
    + fila('Noches de hotel por persona', r.Noches_Persona)
    + fila('Horas planificadas', formatoHoras(r.Horas_Plan))
    + fila('Horas reales registradas', formatoHoras(r.Horas_Reales))
    + '</tbody></table></div>';

  html += '</div>';

  html += '<div class="panel"><h2>Alertas</h2>'
    + '<p class="nota">El motor no descarta solo una jornada que se pasa del tope: la deja planificada y la alerta, '
    + 'para que la decision sea de una persona.</p>'
    + listaAlertas(plan.alertas) + '</div>';

  return html;
}

/* ---------- Finanzas ---------- */

function vistaFinanzas() {
  var comunas = Object.keys(plan.porComuna).map(function (c) {
    return [c, plan.porComuna[c]];
  }).sort(function (a, b) { return b[1] - a[1]; });

  var html = '<div class="panel"><h2>Costo por comuna</h2>'
    + '<p class="nota">Reparto contable declarado: el costo completo del corredor se prorratea entre las comunas '
    + 'según equipos, incluidos los traslados que no instalan nada. No es un costo geografico exacto.</p>'
    + barras(comunas) + '</div>';

  html += '<div class="panel"><h2>Detalle por jornada</h2>'
    + '<div class="tabla-envoltorio"><table class="datos">'
    + '<thead><tr>'
    + '<th>Jornada</th><th>Fecha</th><th>Recorrido</th><th>Equipo</th>'
    + '<th class="num">Km</th><th class="num">Horas</th><th class="num">Combustible</th>'
    + '<th class="num">Peaje</th><th>Estipendio</th><th class="num">Hotel</th><th class="num">Extra</th>'
    + '</tr></thead><tbody>';

  plan.jornadas.slice().sort(function (a, b) {
    return a.Fecha < b.Fecha ? -1 : a.Fecha > b.Fecha ? 1 : 0;
  }).forEach(function (j) {
    var n = j.Tecnicos.length;
    html += '<tr>'
      + '<td>' + esc(j.ID_Jornada) + (j.Alertas.length ? ' <span class="marca alerta">' + j.Alertas.length + '</span>' : '') + '</td>'
      + '<td>' + esc(fechaCorta(j.Fecha)) + '</td>'
      + '<td>' + esc(recorridoTexto(j)) + '</td>'
      + '<td>' + esc(j.Tecnicos.map(nombreTecnico).join(', ')) + '</td>'
      + '<td class="num">' + Math.round(j.Km).toLocaleString('es-CL') + '</td>'
      + '<td class="num">' + esc(formatoHoras(j.Horas_Totales)) + '</td>'
      + '<td class="num">' + esc(clp(j.Combustible)) + '</td>'
      + '<td class="num">' + esc(clp(j.Peaje)) + '</td>'
      + '<td><span class="marca ' + (j.Estipendio_Tipo === 'Viático' ? 'peaje' : 'ruta') + '">'
      + esc(j.Estipendio_Tipo) + ' ' + esc(clp(j.Estipendio * n)) + '</span></td>'
      + '<td class="num">' + esc(clp(j.Hotel * n)) + '</td>'
      + '<td class="num">' + (j.Horas_Extra > 0 ? esc(formatoHoras(j.Horas_Extra)) : '—') + '</td>'
      + '</tr>';
  });

  var r = plan.resumen;
  html += '</tbody><tfoot><tr>'
    + '<td colspan="4">Totales del plan</td>'
    + '<td class="num">' + Math.round(r.Km).toLocaleString('es-CL') + '</td>'
    + '<td class="num">' + esc(formatoHoras(r.Horas_Plan)) + '</td>'
    + '<td class="num">' + esc(clp(r.Combustible)) + '</td>'
    + '<td class="num">' + esc(clp(r.Peajes)) + '</td>'
    + '<td>' + esc(clp(r.Viaticos + r.Colaciones)) + '</td>'
    + '<td class="num">' + esc(clp(r.Hotel)) + '</td>'
    + '<td class="num">' + esc(formatoHoras(r.Horas_Extra)) + '</td>'
    + '</tr></tfoot></table></div></div>';

  return html;
}

/* ---------- Desempeno ---------- */

function vistaDesempeno() {
  var porTecnico = {};
  estado.tecnicos.forEach(function (t) {
    porTecnico[t.ID_Tecnico] = {
      ordenes: 0, cerradas: 0, checklist: 0, equipos: 0,
      horasReales: 0, enSitio: 0, conSello: 0
    };
  });

  estado.ordenes.forEach(function (o) {
    var d = porTecnico[o.ID_Tecnico];
    if (!d) { return; }
    d.ordenes++;
    if (o.Hora_Fin) { d.cerradas++; }
    if (checklistCompleto(o)) { d.checklist++; }
    d.equipos += o.Equipos_Instalados || 0;
    if (o.Hora_Inicio && o.Hora_Fin) {
      d.horasReales += (new Date(o.Hora_Fin) - new Date(o.Hora_Inicio)) / 3600000;
    }
    if (o.Coord_Inicio) {
      d.conSello++;
      if (o.Coord_Inicio.en_sitio) { d.enSitio++; }
    }
  });

  var html = '<div class="panel"><h2>Desempeño por técnico</h2>'
    + '<p class="nota">Las horas reales salen de los hitos que el propio técnico marca en el teléfono. '
    + 'Una hora capturada por teléfono no es certificacion del servidor: es lo que declaro el técnico.</p>'
    + '<div class="tabla-envoltorio"><table class="datos">'
    + '<thead><tr><th>Técnico</th><th>Licencia</th><th class="num">Jornadas</th>'
    + '<th class="num">Horas plan</th><th class="num">Horas reales</th><th class="num">Desviacion</th>'
    + '<th class="num">Checklist</th><th class="num">Cerradas</th><th class="num">Equipos</th>'
    + '<th class="num">En sitio</th></tr></thead><tbody>';

  plan.nomina.forEach(function (n) {
    var d = porTecnico[n.ID_Tecnico];
    var desviacion = d.horasReales > 0 ? d.horasReales - n.Horas : 0;
    html += '<tr>'
      + '<td>' + esc(n.Nombre) + ' <span class="marca">' + esc(n.ID_Tecnico) + '</span></td>'
      + '<td>' + (n.Licencia ? '<span class="marca ruta">Clase B</span>' : '<span class="marca">Sin licencia</span>') + '</td>'
      + '<td class="num">' + n.Jornadas + '</td>'
      + '<td class="num">' + esc(formatoHoras(n.Horas)) + '</td>'
      + '<td class="num">' + (d.horasReales > 0 ? esc(formatoHoras(d.horasReales)) : '—') + '</td>'
      + '<td class="num">' + (d.horasReales > 0
        ? '<span class="marca ' + (desviacion > 0 ? 'peaje' : 'ruta') + '">'
        + (desviacion > 0 ? '+' : '−') + esc(formatoHoras(Math.abs(desviacion))) + '</span>'
        : '—') + '</td>'
      + '<td class="num">' + d.checklist + ' / ' + d.ordenes + '</td>'
      + '<td class="num">' + d.cerradas + ' / ' + d.ordenes + '</td>'
      + '<td class="num">' + d.equipos + '</td>'
      + '<td class="num">' + (d.conSello ? d.enSitio + ' / ' + d.conSello : '—') + '</td>'
      + '</tr>';
  });

  html += '</tbody></table></div></div>';

  html += '<div class="panel"><h2>Carga horaria comparada</h2>'
    + '<p class="nota">Jornada efectiva de referencia: ' + esc(formatoHoras(estado.parametros.P_JORNADA_DIA))
    + ' al día. Las barras en ambar pasan el tope diario de ' + esc(formatoHoras(estado.parametros.P_TOPE_DIA)) + '.</p>'
    + barras(plan.nomina.map(function (n) {
      return [n.Nombre, n.Horas, n.Horas_Extra > 0 ? 'peaje' : ''];
    }), function (v) { return formatoHoras(v); })
    + '</div>';

  return html;
}

/* ---------- Nomina ---------- */

function vistaNomina() {
  var r = plan.resumen;
  var html = '<div class="panel"><h2>Transferencias a los técnicos</h2>'
    + '<p class="nota">Importe individual: base por (1 + reserva), redondeado hacia arriba al millar. '
    + 'Solo el conductor de cada jornada recibe combustible y peajes.</p>'
    + '<div class="tabla-envoltorio"><table class="datos">'
    + '<thead><tr><th>Técnico</th><th class="num">Viático</th><th class="num">Colación</th>'
    + '<th class="num">Hotel</th><th class="num">Combustible</th><th class="num">Peaje</th>'
    + '<th class="num">Base</th><th class="num">Reserva</th><th class="num">A transferir</th>'
    + '<th class="num">Rendido</th><th>Estado</th></tr></thead><tbody>';

  plan.nomina.forEach(function (n) {
    var pagado = !!estado.pagos[n.ID_Tecnico];
    html += '<tr>'
      + '<td>' + esc(n.Nombre) + '<br><span class="nota">' + esc(n.Email) + '</span></td>'
      + '<td class="num">' + esc(clp(n.Viatico)) + '</td>'
      + '<td class="num">' + esc(clp(n.Colacion)) + '</td>'
      + '<td class="num">' + esc(clp(n.Hotel)) + '</td>'
      + '<td class="num">' + esc(clp(n.Combustible)) + '</td>'
      + '<td class="num">' + esc(clp(n.Peaje)) + '</td>'
      + '<td class="num">' + esc(clp(n.Base)) + '</td>'
      + '<td class="num">' + esc(clp(n.Reserva)) + '</td>'
      + '<td class="num"><strong>' + esc(clp(n.Total)) + '</strong></td>'
      + '<td class="num">' + esc(clp(n.Rendido)) + '</td>'
      + '<td><button class="boton chico ' + (pagado ? '' : 'secundario') + ' no-imprimir" '
      + 'data-accion="pago" data-tecnico="' + esc(n.ID_Tecnico) + '">'
      + (pagado ? 'Transferido' : 'Marcar pagado') + '</button></td>'
      + '</tr>';
  });

  html += '</tbody><tfoot><tr><td>Total</td>'
    + '<td class="num">' + esc(clp(r.Viaticos)) + '</td>'
    + '<td class="num">' + esc(clp(r.Colaciones)) + '</td>'
    + '<td class="num">' + esc(clp(r.Hotel)) + '</td>'
    + '<td class="num">' + esc(clp(r.Combustible)) + '</td>'
    + '<td class="num">' + esc(clp(r.Peajes)) + '</td>'
    + '<td class="num">' + esc(clp(r.Nomina - r.Reserva)) + '</td>'
    + '<td class="num">' + esc(clp(r.Reserva)) + '</td>'
    + '<td class="num">' + esc(clp(r.Nomina)) + '</td>'
    + '<td class="num">' + esc(clp(r.Rendido)) + '</td>'
    + '<td><button class="boton chico no-imprimir" data-accion="pagar-todo">Marcar todo</button></td>'
    + '</tr></tfoot></table></div></div>';

  html += '<div class="panel"><h2>Cierre del presupuesto</h2>'
    + '<table class="datos"><tbody>'
    + fila('Nómina con reserva', clp(r.Nomina))
    + fila('Desgaste de vehículos (costo de empresa)', clp(r.Desgaste))
    + fila('Horas extra', clp(r.Costo_Horas_Extra))
    + '</tbody><tfoot><tr><td>Costo presupuestado total</td>'
    + '<td class="num">' + esc(clp(r.Costo_Total)) + '</td></tr></tfoot></table></div>';

  return html;
}

/* ---------- Gastos ---------- */

function vistaGastos() {
  if (!estado.gastos.length) {
    return '<div class="panel"><h2>Gastos por revisar</h2>'
      + '<div class="vacio">Todavia no hay comprobantes. Los técnicos los suben desde el teléfono, '
      + 'en la pestaña Gastos.</div></div>';
  }

  var html = '<div class="panel"><h2>Gastos por revisar</h2>'
    + '<p class="nota">Aprobar un gasto lo suma al rendido del técnico y cierra la brecha del resumen. '
    + 'Los gastos marcados como emergencia se pagan con la reserva del 10%.</p>'
    + '<div class="tabla-envoltorio"><table class="datos">'
    + '<thead><tr><th>Folio</th><th>Tecnico</th><th>Fecha</th><th>Tipo</th>'
    + '<th class="num">Monto</th><th>Comprobante</th><th>Estado</th><th class="no-imprimir">Revisión</th></tr></thead><tbody>';

  estado.gastos.slice().reverse().forEach(function (g) {
    var t = buscarTecnico(g.ID_Tecnico);
    var marca = g.Estado === 'Aprobado' ? 'ruta' : g.Estado === 'Rechazado' ? 'alerta' : 'peaje';
    html += '<tr>'
      + '<td>' + esc(g.ID_Gasto) + '</td>'
      + '<td>' + esc(t ? t.Nombre : g.ID_Tecnico) + '</td>'
      + '<td>' + esc(fechaCorta(g.Fecha)) + '</td>'
      + '<td>' + esc(g.Tipo) + (g.Emergencia ? ' <span class="marca alerta">Emergencia</span>' : '') + '</td>'
      + '<td class="num">' + esc(clp(g.Monto)) + '</td>'
      + '<td>' + (g.Comprobante
        ? '<img class="miniatura" src="' + esc(g.Comprobante) + '" alt="Comprobante de ' + esc(g.Tipo) + '">'
        : '<span class="nota">Sin foto</span>') + '</td>'
      + '<td><span class="marca ' + marca + '">' + esc(g.Estado) + '</span></td>'
      + '<td class="no-imprimir">'
      + '<button class="boton chico" data-accion="gasto" data-gasto="' + esc(g.ID_Gasto) + '" data-estado="Aprobado">Aprobar</button> '
      + '<button class="boton chico peligro" data-accion="gasto" data-gasto="' + esc(g.ID_Gasto) + '" data-estado="Rechazado">Rechazar</button>'
      + '</td></tr>';
  });

  html += '</tbody></table></div></div>';
  return html;
}

/* ---------- Parametros ---------- */

function vistaParametros() {
  var html = '<div class="panel"><h2>Parámetros de operación</h2>'
    + '<p class="nota">Nada esta cableado en el codigo: cambiar cualquiera de estos valores recalcula '
    + 'el plan completo al instante. Sirve para responder que pasa si sube el diesel o si cambia la politica de viáticos.</p>'
    + '<div class="rejilla-campos">';

  PARAMETROS_EDITABLES.forEach(function (pe) {
    html += '<label class="campo"><span>' + esc(pe.etiqueta) + ' <em>(' + esc(pe.unidad) + ')</em></span>'
      + '<input type="number" step="' + pe.paso + '" min="0" data-parametro="' + esc(pe.codigo) + '" '
      + 'value="' + esc(estado.parametros[pe.codigo]) + '"></label>';
  });

  html += '</div>'
    + '<button class="boton secundario" data-accion="restaurar-parametros">Volver a los valores de la semilla</button>'
    + '</div>';

  var p = estado.parametros;
  html += '<div class="panel"><h2>Valores derivados</h2>'
    + '<p class="nota">Se recalculan solos a partir de los de arriba. No se editan a mano.</p>'
    + '<table class="datos"><tbody>'
    + fila('Jornada semanal efectiva', formatoHoras(p.P_JORNADA_EFECTIVA))
    + fila('Jornada diaria efectiva', formatoHoras(p.P_JORNADA_DIA))
    + fila('Jornada diaria contractual', formatoHoras(p.P_JORNADA_DIA_MAX))
    + fila('Tope diario absoluto con horas extra', formatoHoras(p.P_TOPE_DIA))
    + fila('Capacitación con link enviado', formatoHoras(p.P_T_CAP_EFECTIVA))
    + fila('Velocidad urbana / Ruta 78 / Ruta 5', p.P_VEL_URBANA + ' / ' + p.P_VEL_R78 + ' / ' + p.P_VEL_RUTA5 + ' km/h')
    + '</tbody></table></div>';

  return html;
}

/* ---------- Auxiliares de dibujo ---------- */

function indicador(valor, rotulo, clase) {
  return '<div class="indicador ' + (clase || '') + '">'
    + '<span class="valor">' + esc(valor) + '</span>'
    + '<span class="rotulo">' + esc(rotulo) + '</span></div>';
}

function fila(rotulo, valor) {
  return '<tr><td>' + esc(rotulo) + '</td><td class="num">' + esc(valor) + '</td></tr>';
}

function barras(pares, formato) {
  var maximo = pares.reduce(function (m, p) { return Math.max(m, p[1]); }, 0) || 1;
  var fmt = formato || clp;
  return '<div class="barras">' + pares.map(function (p) {
    var ancho = Math.max(1, (p[1] / maximo) * 100);
    return '<div class="fila">'
      + '<span>' + esc(p[0]) + '</span>'
      + '<span class="pista"><span class="relleno ' + esc(p[2] || '') + '" style="width:' + ancho.toFixed(1) + '%"></span></span>'
      + '<span class="monto">' + esc(fmt(p[1])) + '</span>'
      + '</div>';
  }).join('') + '</div>';
}

function listaAlertas(alertas) {
  if (!alertas.length) {
    return '<div class="vacio">Sin alertas. El plan cabe en los topes de jornada, conducción y capacidad.</div>';
  }
  var orden = { alto: 0, medio: 1, bajo: 2 };
  return '<ul class="lista-alertas">' + alertas.slice().sort(function (a, b) {
    return orden[a.nivel] - orden[b.nivel];
  }).map(function (a) {
    return '<li class="' + esc(a.nivel) + '"><span class="origen">' + esc(a.origen) + '</span>' + esc(a.texto) + '</li>';
  }).join('') + '</ul>';
}

function nombreTecnico(idTecnico) {
  var t = plan.tecnicosPorId[idTecnico];
  return t ? t.Nombre : idTecnico;
}

function recorridoTexto(jornada) {
  var nombres = [];
  jornada.Tramos.forEach(function (t, i) {
    if (i === 0) { nombres.push(nombreLugar(t.Origen)); }
    if (nombres[nombres.length - 1] !== nombreLugar(t.Destino)) { nombres.push(nombreLugar(t.Destino)); }
  });
  return nombres.join(' → ');
}

function nombreLugar(idDestino) {
  if (idDestino === 'BASE') { return 'Base'; }
  var d = plan.destinosPorId[idDestino];
  return d ? d.Comuna : idDestino;
}

/* ---------- Eventos ---------- */

function manejarAccionSupervisor(evento) {
  var boton = evento.target.closest('[data-accion]');
  if (!boton) { return; }
  var accion = boton.getAttribute('data-accion');

  if (accion === 'imprimir') { window.print(); }
  else if (accion === 'reiniciar') { pedirReinicio(); }
  else if (accion === 'salir') { cerrarSesion(); }
  else if (accion === 'pago') { despachar('marcarPago', { idTecnico: boton.getAttribute('data-tecnico') }); }
  else if (accion === 'pagar-todo') { despachar('pagarTodo', {}); }
  else if (accion === 'gasto') {
    despachar('revisarGasto', {
      idGasto: boton.getAttribute('data-gasto'),
      estado: boton.getAttribute('data-estado')
    });
  } else if (accion === 'restaurar-parametros') {
    despachar('restaurarParametros', {});
  }
}

function manejarCambioSupervisor(evento) {
  var campo = evento.target.closest('[data-parametro]');
  if (!campo) { return; }
  var valor = Number(campo.value);
  if (!isFinite(valor) || valor < 0) { return; }
  despachar('parametro', { codigo: campo.getAttribute('data-parametro'), valor: valor });
}
