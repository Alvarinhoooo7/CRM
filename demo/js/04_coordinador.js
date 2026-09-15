/* VISTA COORDINADOR. Recibe trabajos, arma equipos, agenda y avisa al cliente.
   Seis pestanas: ordenes, nueva orden, asignacion, calendario, flota y capacitacion. */

var PESTANAS_COORDINADOR = [
  { id: 'ordenes', titulo: 'Órdenes' },
  { id: 'nueva', titulo: 'Nueva orden' },
  { id: 'asignacion', titulo: 'Asignación' },
  { id: 'calendario', titulo: 'Calendario' },
  { id: 'flota', titulo: 'Flota' },
  { id: 'capacitacion', titulo: 'Capacitación' }
];

/* Referencia por region para comunas que todavia no estan en la tabla de destinos.
   El coordinador siempre puede corregir los kilometros en el formulario. */
var REFERENCIA_REGION = {
  'Atacama': { km: 812.2, peaje: 28582, corredor: 'R5N', lat: -27.3665, lng: -70.3323 },
  'Coquimbo': { km: 469.8, peaje: 15132, corredor: 'R5N', lat: -29.9533, lng: -71.3436 },
  'Valparaíso': { km: 121.7, peaje: 5082, corredor: 'R5N', lat: -32.7876, lng: -71.1929 },
  'Metropolitana': { km: 20, peaje: 1200, corredor: 'URB', lat: -33.4372, lng: -70.6506 },
  'Maule': { km: 194.7, peaje: 5249, corredor: 'R5S', lat: -34.9828, lng: -71.2394 },
  'Biobío': { km: 508.1, peaje: 16421, corredor: 'R5S', lat: -36.8420, lng: -73.1050 }
};

var pestanaCoordinador = 'ordenes';
var propuestaActual = null;
var seleccionAsignacion = { jornada: null, tecnicos: [], conductor: null, vehiculo: null };
var arrastrando = null;

function dibujarCoordinador(contenedor) {
  contenedor.innerHTML =
    '<div class="barra">'
    + '<h1>Servicio técnico en ruta</h1>'
    + '<span class="quien">Coordinación · ' + esc(sesion.correo) + '</span>'
    + '<span class="empuje"></span>'
    + '<button class="boton" data-accion="reiniciar">Reiniciar demo</button>'
    + '<button class="boton" data-accion="salir">Salir</button>'
    + '</div>'
    + '<div class="pestanas" role="tablist">'
    + PESTANAS_COORDINADOR.map(function (p) {
      return '<button class="pestana" role="tab" data-pestana="' + p.id + '" '
        + 'aria-selected="' + (p.id === pestanaCoordinador) + '">' + esc(p.titulo) + '</button>';
    }).join('')
    + '</div>'
    + '<div class="contenido" id="contenido-coordinador"></div>';

  contenedor.addEventListener('click', function (evento) {
    var boton = evento.target.closest('[data-pestana]');
    if (boton) {
      pestanaCoordinador = boton.getAttribute('data-pestana');
      propuestaActual = null;
      dibujarCoordinador(contenedor);
      return;
    }
    manejarAccionCoordinador(evento);
  });
  contenedor.addEventListener('change', manejarCambioCoordinador);
  contenedor.addEventListener('input', manejarEntradaCoordinador);

  dibujarPestanaCoordinador();
}

/* Cada cambio redibuja la pestaña entera. Se conserva el scroll para que aprobar un
   gasto o editar un parámetro no devuelva la página al tope. */
function dibujarPestanaCoordinador() {
  var desplazamiento = window.scrollY;
  var caja = el('#contenido-coordinador');
  if (!caja) { return; }
  if (pestanaCoordinador === 'ordenes') { caja.innerHTML = vistaOrdenes(); }
  else if (pestanaCoordinador === 'nueva') { caja.innerHTML = vistaNuevaOrden(); rellenarKmComuna(); }
  else if (pestanaCoordinador === 'asignacion') { caja.innerHTML = vistaAsignacion(); }
  else if (pestanaCoordinador === 'calendario') { caja.innerHTML = vistaCalendario(); activarArrastre(); }
  else if (pestanaCoordinador === 'flota') { caja.innerHTML = vistaFlota(); }
  else if (pestanaCoordinador === 'capacitacion') { caja.innerHTML = vistaCapacitacion(); }
  window.scrollTo(0, desplazamiento);
}

/* ---------- Ordenes ---------- */

function vistaOrdenes() {
  var r = plan.resumen;
  var html = '<div class="indicadores">'
    + indicador(String(r.Jornadas), 'Jornadas en el plan')
    + indicador(String(r.Ordenes), 'Órdenes de trabajo')
    + indicador(r.Checklist_Completos + ' / ' + r.Ordenes, 'Checklist completos')
    + indicador(String(r.Ordenes_Cerradas), 'Cerradas')
    + indicador(r.Equipos_Instalados + ' / ' + r.Equipos_Previstos, 'Equipos instalados')
    + indicador(String(estado.correos.length), 'Capacitaciones enviadas')
    + '</div>';

  html += '<div class="panel"><h2>Órdenes de trabajo</h2>'
    + '<p class="nota">Una orden por técnico y jornada. El técnico solo la puede abrir en el teléfono '
    + 'después de verificar los ' + estado.implementos.length + ' implementos del checklist.</p>'
    + '<p><button class="boton secundario" data-accion="exportar-nomina">Exportar nómina de transferencias (CSV)</button></p>'
    + '<div class="tabla-envoltorio"><table class="datos">'
    + '<thead><tr><th>Orden</th><th>Fecha</th><th>Jornada</th><th>Recorrido</th>'
    + '<th>Técnico</th><th>Rol</th><th class="num">Checklist</th><th>Estado</th>'
    + '<th>Inicio</th><th>Fin</th><th class="num">Equipos</th></tr></thead><tbody>';

  estado.ordenes.slice().sort(function (a, b) {
    return a.Fecha < b.Fecha ? -1 : a.Fecha > b.Fecha ? 1 : (a.ID_Orden < b.ID_Orden ? -1 : 1);
  }).forEach(function (o) {
    var j = plan.jornadasPorId[o.ID_Jornada];
    var marcados = o.Checklist.filter(function (c) { return c.Marcado; }).length;
    var marca = o.Estado === 'Cerrada' ? 'ruta' : o.Estado === 'En curso' ? 'peaje' : '';
    html += '<tr>'
      + '<td>' + esc(o.ID_Orden) + '</td>'
      + '<td>' + esc(fechaCorta(o.Fecha)) + '</td>'
      + '<td>' + esc(o.ID_Jornada) + '</td>'
      + '<td>' + esc(j ? recorridoTexto(j) : '—') + '</td>'
      + '<td>' + esc(nombreTecnico(o.ID_Tecnico)) + '</td>'
      + '<td>' + (o.Es_Conductor ? '<span class="marca ruta">Conduce</span>' : '<span class="marca">Acompaña</span>') + '</td>'
      + '<td class="num">' + marcados + ' / ' + o.Checklist.length + '</td>'
      + '<td><span class="marca ' + marca + '">' + esc(o.Estado) + '</span></td>'
      + '<td>' + esc(horaCorta(o.Hora_Inicio)) + '</td>'
      + '<td>' + esc(horaCorta(o.Hora_Fin)) + '</td>'
      + '<td class="num">' + (o.Equipos_Instalados || 0) + '</td>'
      + '</tr>';
  });

  html += '</tbody></table></div></div>';

  html += '<div class="panel"><h2>Alertas del plan</h2>' + listaAlertas(plan.alertas) + '</div>';
  return html;
}

/* ---------- Nueva orden ---------- */

function vistaNuevaOrden() {
  var regiones = Object.keys(REGIONES);
  var primeraRegion = (propuestaActual && propuestaActual.entrada.region) || 'Metropolitana';

  var html = '<div class="columnas">';

  html += '<div class="panel"><h2>Trabajo nuevo</h2>'
    + '<p class="nota">Se simula primero y se confirma después. La simulación muestra horas, itinerario, '
    + 'noches de hotel y costo antes de comprometer a nadie.</p>'
    + '<form id="form-trabajo">'
    + '<div class="rejilla-campos">'
    + campoTexto('empresa', 'Empresa', 'Telecomunicaciones del Pacífico')
    + campoSelect('region', 'Región', regiones, primeraRegion)
    + campoSelect('comuna', 'Comuna', REGIONES[primeraRegion], REGIONES[primeraRegion][0])
    + campoTexto('direccion', 'Calle', 'Av. Laguna Sur')
    + campoTexto('numero', 'Número', '1234')
    + campoTexto('cliente', 'Nombre del cliente', 'Patricia Muñoz')
    + campoTexto('mail', 'Correo del cliente', 'patricia.munoz@cliente.cl', 'email')
    + campoNumero('equipos', 'Equipos a instalar', 2, 1)
    + campoTexto('fecha', 'Fecha', proximaFechaLibre(), 'date')
    + campoNumero('tecnicos', 'Técnicos a enviar', 2, 1)
    + '</div>'
    + '<div class="rejilla-campos">'
    + campoNumero('km', 'Km desde la base', 20, 0, 0.1)
    + campoNumero('peaje', 'Peaje por trayecto', 1200, 0, 1)
    + '</div>'
    + '<p class="nota" id="nota-km"></p>'
    + '<button type="button" class="boton" data-accion="simular">Simular</button> '
    + '<button type="button" class="boton secundario" data-accion="autoasignar">Autoasignar equipo</button>'
    + '</form></div>';

  html += '<div class="panel"><h2>Simulación</h2>' + (propuestaActual ? cuerpoPropuesta() : '<div class="vacio">Completa los datos y aprieta Simular. '
    + 'Hasta entonces no se crea ninguna orden.</div>') + '</div>';

  html += '</div>';

  if (estado.trabajos.length) {
    html += '<div class="panel"><h2>Trabajos ingresados en esta sesión</h2>'
      + '<div class="tabla-envoltorio"><table class="datos">'
      + '<thead><tr><th>Empresa</th><th>Cliente</th><th>Direccion</th><th>Comuna</th>'
      + '<th class="num">Equipos</th><th>Fecha</th><th>Jornada</th></tr></thead><tbody>'
      + estado.trabajos.slice().reverse().map(function (t) {
        return '<tr><td>' + esc(t.Empresa) + '</td><td>' + esc(t.Cliente) + '<br><span class="nota">' + esc(t.Mail) + '</span></td>'
          + '<td>' + esc(t.Direccion) + '</td><td>' + esc(t.Comuna) + ', ' + esc(t.Region) + '</td>'
          + '<td class="num">' + t.Equipos + '</td><td>' + esc(fechaCorta(t.Fecha)) + '</td>'
          + '<td>' + esc(t.ID_Jornada) + '</td></tr>';
      }).join('')
      + '</tbody></table></div></div>';
  }

  return html;
}

function cuerpoPropuesta() {
  var p = propuestaActual;
  var j = p.jornadaCalculada;
  var n = j.Tecnicos.length;

  var html = '<table class="datos"><tbody>'
    + fila('Recorrido', recorridoTexto(j))
    + fila('Equipo', j.Tecnicos.map(nombreTecnico).join(', '))
    + fila('Conduce', nombreTecnico(j.Conductor))
    + fila('Camioneta', j.ID_Vehiculo)
    + fila('Kilómetros ida y vuelta', Math.round(j.Km).toLocaleString('es-CL') + ' km')
    + fila('Horas de viaje', formatoHoras(j.Horas_Viaje))
    + fila('Horas de instalación', formatoHoras(j.Horas_Instalacion))
    + fila('Horas de capacitación', formatoHoras(j.Horas_Capacitacion))
    + fila('Horas totales de la jornada', formatoHoras(j.Horas_Totales))
    + fila('Noches de hotel', j.Noches ? j.Noches + ' por técnico' : 'Retorno en el día')
    + fila('Combustible', clp(j.Combustible))
    + fila('Peajes', clp(j.Peaje))
    + fila(j.Estipendio_Tipo, clp(j.Estipendio * n))
    + fila('Hotel', clp(j.Hotel * n))
    + '</tbody><tfoot><tr><td>Costo de la jornada</td><td class="num">' + esc(clp(p.costo)) + '</td></tr></tfoot></table>';

  if (j.Alertas.length) {
    html += '<h3 style="margin-top:1rem">Advertencias</h3>' + listaAlertas(j.Alertas.map(function (a) {
      return { nivel: a.nivel, origen: 'Simulacion', texto: a.texto };
    }));
  }

  var bloqueante = j.Alertas.filter(function (a) { return a.nivel === 'alto'; }).length > 0;
  html += '<div style="margin-top:1rem">'
    + '<button class="boton" data-accion="confirmar"' + (bloqueante ? ' disabled' : '') + '>Confirmar y crear órdenes</button> '
    + '<button class="boton secundario" data-accion="descartar">Descartar</button>'
    + (bloqueante ? '<p class="nota" style="margin-top:.6rem;color:var(--alerta)">Hay advertencias criticas. '
      + 'Corrige la fecha, el equipo o la camioneta antes de confirmar.</p>' : '')
    + '</div>';

  return html;
}

/* ---------- Asignacion ---------- */

function vistaAsignacion() {
  var jornadasOrdenadas = plan.jornadas.slice().sort(function (a, b) {
    return a.Fecha < b.Fecha ? -1 : a.Fecha > b.Fecha ? 1 : 0;
  });
  var seleccionada = seleccionAsignacion.jornada
    ? plan.jornadasPorId[seleccionAsignacion.jornada]
    : null;

  var html = '<div class="columnas">';

  html += '<div class="panel"><h2>Jornadas</h2>'
    + '<p class="nota">Elige una jornada para rearmar su equipo. Los 10 técnicos son un pool: puedes mandar '
    + 'uno solo, dos o hasta ' + estado.parametros.P_CAPACIDAD_CAMIONETA + ' por camioneta.</p>'
    + '<div class="tabla-envoltorio"><table class="datos">'
    + '<thead><tr><th>Jornada</th><th>Fecha</th><th>Recorrido</th><th>Equipo</th><th class="num">Horas</th></tr></thead><tbody>'
    + jornadasOrdenadas.map(function (j) {
      var activa = seleccionAsignacion.jornada === j.ID_Jornada;
      return '<tr style="cursor:pointer' + (activa ? ';background:var(--ruta-claro)' : '') + '" data-accion="elegir-jornada" data-jornada="' + esc(j.ID_Jornada) + '">'
        + '<td>' + esc(j.ID_Jornada) + '</td>'
        + '<td>' + esc(fechaCorta(j.Fecha)) + '</td>'
        + '<td>' + esc(recorridoTexto(j)) + '</td>'
        + '<td>' + esc(j.Tecnicos.map(nombreTecnico).join(', ') || 'Sin asignar') + '</td>'
        + '<td class="num">' + esc(formatoHoras(j.Horas_Totales)) + '</td>'
        + '</tr>';
    }).join('')
    + '</tbody></table></div></div>';

  html += '<div class="panel"><h2>' + (seleccionada ? 'Equipo de ' + esc(seleccionada.ID_Jornada) : 'Disponibilidad') + '</h2>';

  if (!seleccionada) {
    html += '<p class="nota">Elige una jornada de la izquierda para rearmarla.</p>';
  }

  var ocupacion = ocupacionPorFecha(seleccionada ? seleccionada.Fecha : null, seleccionada ? seleccionada.ID_Jornada : null);

  html += '<h3>Técnicos</h3><div class="fichas">'
    + estado.tecnicos.map(function (t) {
      var ocupadoEn = ocupacion.tecnicos[t.ID_Tecnico];
      var elegido = seleccionAsignacion.tecnicos.indexOf(t.ID_Tecnico) !== -1;
      var clase = ocupadoEn ? 'ocupado' : 'libre';
      if (!t.Licencia) { clase = 'bloqueado'; }
      var carga = plan.nomina.filter(function (n) { return n.ID_Tecnico === t.ID_Tecnico; })[0];
      return '<button class="ficha ' + clase + '" data-accion="alternar-tecnico" data-tecnico="' + esc(t.ID_Tecnico) + '" '
        + 'aria-pressed="' + elegido + '"' + (seleccionada ? '' : ' disabled') + '>'
        + '<strong>' + esc(t.Nombre) + '</strong>'
        + '<span class="estado">' + (ocupadoEn ? 'En ' + esc(ocupadoEn) : 'Libre ese día')
        + ' · ' + esc(formatoHoras(carga ? carga.Horas : 0))
        + (t.Licencia ? '' : ' · sin licencia') + '</span>'
        + '</button>';
    }).join('')
    + '</div>';

  if (seleccionada && seleccionAsignacion.tecnicos.length) {
    html += '<h3 style="margin-top:1rem">Quien conduce</h3>'
      + '<p class="nota">Solo aparecen los del equipo que tienen licencia.</p>'
      + '<div class="fichas">'
      + seleccionAsignacion.tecnicos.map(function (id) {
        var t = buscarTecnico(id);
        if (!t || !t.Licencia) { return ''; }
        return '<button class="ficha" data-accion="elegir-conductor" data-tecnico="' + esc(id) + '" '
          + 'aria-pressed="' + (seleccionAsignacion.conductor === id) + '">'
          + '<strong>' + esc(t.Nombre) + '</strong><span class="estado">Recibe combustible y peajes</span></button>';
      }).join('')
      + '</div>';
  }

  if (seleccionada) {
    html += '<h3 style="margin-top:1rem">Camioneta</h3><div class="fichas">'
      + estado.flota.map(function (v) {
        var ocupadaEn = ocupacion.vehiculos[v.ID_Vehiculo];
        var enTaller = v.Estado === 'Taller';
        return '<button class="ficha ' + (enTaller ? 'bloqueado' : ocupadaEn ? 'ocupado' : 'libre') + '" '
          + 'data-accion="elegir-vehiculo" data-vehiculo="' + esc(v.ID_Vehiculo) + '" '
          + 'aria-pressed="' + (seleccionAsignacion.vehiculo === v.ID_Vehiculo) + '"' + (enTaller ? ' disabled' : '') + '>'
          + '<strong>' + esc(v.ID_Vehiculo) + ' · ' + esc(v.Patente) + '</strong>'
          + '<span class="estado">' + esc(v.Estado) + (ocupadaEn ? ' · en ' + esc(ocupadaEn) : '') + '</span></button>';
      }).join('')
      + '</div>';

    var problema = validarAsignacion();
    html += '<div style="margin-top:1rem">'
      + '<button class="boton" data-accion="guardar-asignacion"' + (problema ? ' disabled' : '') + '>Guardar equipo</button> '
      + '<button class="boton secundario" data-accion="autoasignar-jornada">Autoasignar</button>'
      + (problema ? '<p class="nota" style="margin-top:.6rem;color:var(--alerta)">' + esc(problema) + '</p>' : '')
      + '</div>';
  }

  html += '</div></div>';
  return html;
}

function ocupacionPorFecha(fecha, exceptoJornada) {
  var tecnicos = {}, vehiculos = {};
  if (!fecha) { return { tecnicos: tecnicos, vehiculos: vehiculos }; }
  plan.jornadas.forEach(function (j) {
    if (j.Fecha !== fecha || j.ID_Jornada === exceptoJornada) { return; }
    j.Tecnicos.forEach(function (id) { tecnicos[id] = j.ID_Jornada; });
    vehiculos[j.ID_Vehiculo] = j.ID_Jornada;
  });
  return { tecnicos: tecnicos, vehiculos: vehiculos };
}

function validarAsignacion() {
  var s = seleccionAsignacion;
  if (!s.tecnicos.length) { return 'El equipo no puede quedar vacio.'; }
  if (s.tecnicos.length > estado.parametros.P_CAPACIDAD_CAMIONETA) {
    return 'La camioneta lleva como máximo ' + estado.parametros.P_CAPACIDAD_CAMIONETA + ' personas.';
  }
  if (!s.conductor) { return 'Falta elegir quien conduce.'; }
  var conductor = buscarTecnico(s.conductor);
  if (!conductor || !conductor.Licencia) { return 'El conductor elegido no tiene licencia.'; }
  if (s.tecnicos.indexOf(s.conductor) === -1) { return 'El conductor tiene que ir en el equipo.'; }
  if (!s.vehiculo) { return 'Falta elegir la camioneta.'; }
  return null;
}

/* ---------- Calendario ---------- */

function vistaCalendario() {
  var fechas = {};
  plan.jornadas.forEach(function (j) { fechas[j.Fecha] = true; });
  var listaFechas = Object.keys(fechas).sort();
  var desde = listaFechas[0] || FECHA_INICIO_PLAN;

  /* Dos semanas laborales desde la primera fecha con jornadas. */
  var dias = [];
  for (var i = 0; i < 10; i++) { dias.push(fechaLaboral(desde, i)); }
  listaFechas.forEach(function (f) { if (dias.indexOf(f) === -1) { dias.push(f); } });
  dias.sort();

  var html = '<div class="panel"><h2>Calendario</h2>'
    + '<p class="nota">Arrastra una jornada a otro día para reprogramarla. Al soltarla se revalidan los topes '
    + 'y se recalcula el plan. Nunca se agenda sabado ni domingo.</p>'
    + '<div class="tabla-envoltorio"><div class="calendario" style="grid-template-columns:repeat(' + dias.length + ',minmax(150px,1fr));min-width:' + (dias.length * 158) + 'px">';

  dias.forEach(function (fecha) {
    var delDia = plan.jornadas.filter(function (j) { return j.Fecha === fecha; });
    html += '<div class="dia" data-fecha="' + esc(fecha) + '">'
      + '<header>' + esc(fechaCorta(fecha)) + '</header>'
      + delDia.map(function (j) {
        return '<div class="tarjeta-jornada' + (j.Alertas.length ? ' con-alerta' : '') + '" draggable="true" data-jornada="' + esc(j.ID_Jornada) + '">'
          + '<strong>' + esc(j.ID_Jornada) + ' · ' + esc(j.ID_Vehiculo) + '</strong>'
          + '<span class="detalle">' + esc(recorridoTexto(j)) + '</span>'
          + '<span class="detalle">' + esc(j.Tecnicos.map(nombreTecnico).join(', ')) + '</span>'
          + '<span class="detalle">' + esc(formatoHoras(j.Horas_Totales))
          + (j.Noches ? ' · ' + j.Noches + ' noche(s)' : '') + '</span>'
          + '</div>';
      }).join('')
      + (delDia.length ? '' : '<span class="nota">Sin jornadas</span>')
      + '</div>';
  });

  html += '</div></div></div>';
  return html;
}

function activarArrastre() {
  todos('.tarjeta-jornada').forEach(function (tarjeta) {
    tarjeta.addEventListener('dragstart', function () {
      arrastrando = tarjeta.getAttribute('data-jornada');
    });
  });
  todos('.dia').forEach(function (dia) {
    dia.addEventListener('dragover', function (evento) {
      evento.preventDefault();
      dia.classList.add('destino-activo');
    });
    dia.addEventListener('dragleave', function () { dia.classList.remove('destino-activo'); });
    dia.addEventListener('drop', function (evento) {
      evento.preventDefault();
      dia.classList.remove('destino-activo');
      if (!arrastrando) { return; }
      despachar('moverJornada', { idJornada: arrastrando, fecha: dia.getAttribute('data-fecha') });
      arrastrando = null;
    });
  });
}

/* ---------- Flota ---------- */

function vistaFlota() {
  var enTaller = estado.flota.filter(function (v) { return v.Estado === 'Taller'; });
  var sinVehiculo = plan.jornadas.filter(function (j) {
    var v = estado.flota.filter(function (x) { return x.ID_Vehiculo === j.ID_Vehiculo; })[0];
    return v && v.Estado === 'Taller';
  });

  var html = '<div class="panel"><h2>Camionetas</h2>'
    + '<p class="nota">Marcar una camioneta en taller no borra sus jornadas: las deja visibles y alertadas, '
    + 'para que la reasignacion sea una decision explicita.</p>'
    + '<div class="tabla-envoltorio"><table class="datos">'
    + '<thead><tr><th>Vehículo</th><th>Patente</th><th>Modelo</th><th class="num">Km</th>'
    + '<th class="num">Próxima mantención</th><th>Revisión técnica</th><th>Estado</th><th>Cambiar</th></tr></thead><tbody>'
    + estado.flota.map(function (v) {
      var jornadas = plan.jornadas.filter(function (j) { return j.ID_Vehiculo === v.ID_Vehiculo; }).length;
      var falta = v.Km_Proxima_Mantencion - v.Km;
      return '<tr>'
        + '<td>' + esc(v.ID_Vehiculo) + '<br><span class="nota">' + jornadas + ' jornada(s)</span></td>'
        + '<td>' + esc(v.Patente) + '</td>'
        + '<td>' + esc(v.Modelo) + '</td>'
        + '<td class="num">' + v.Km.toLocaleString('es-CL') + '</td>'
        + '<td class="num">' + v.Km_Proxima_Mantencion.toLocaleString('es-CL')
        + (falta <= 1000 ? ' <span class="marca peaje">faltan ' + falta.toLocaleString('es-CL') + '</span>' : '') + '</td>'
        + '<td>' + esc(fechaCorta(v.Venc_Revision)) + '</td>'
        + '<td><span class="marca ' + (v.Estado === 'Taller' ? 'alerta' : v.Estado === 'Reserva' ? 'peaje' : 'ruta') + '">'
        + esc(v.Estado) + '</span></td>'
        + '<td>'
        + ['Disponible', 'Reserva', 'Taller'].map(function (e) {
          return '<button class="boton chico ' + (v.Estado === e ? '' : 'secundario') + '" '
            + 'data-accion="estado-vehiculo" data-vehiculo="' + esc(v.ID_Vehiculo) + '" data-estado="' + e + '">' + e + '</button>';
        }).join(' ')
        + '</td></tr>';
    }).join('')
    + '</tbody></table></div></div>';

  if (enTaller.length) {
    html += '<div class="panel"><h2>Jornadas afectadas por el taller</h2>'
      + (sinVehiculo.length
        ? '<p class="nota">Estas jornadas quedaron con una camioneta en taller. Reasignalas desde la pestaña '
        + 'Asignacion: la camioneta de reserva V6 es la única holgura que existe hoy.</p>'
        + '<div class="tabla-envoltorio"><table class="datos">'
        + '<thead><tr><th>Jornada</th><th>Fecha</th><th>Recorrido</th><th>Equipo</th><th>Camioneta</th></tr></thead><tbody>'
        + sinVehiculo.map(function (j) {
          return '<tr><td>' + esc(j.ID_Jornada) + '</td><td>' + esc(fechaCorta(j.Fecha)) + '</td>'
            + '<td>' + esc(recorridoTexto(j)) + '</td>'
            + '<td>' + esc(j.Tecnicos.map(nombreTecnico).join(', ')) + '</td>'
            + '<td><span class="marca alerta">' + esc(j.ID_Vehiculo) + ' en taller</span></td></tr>';
        }).join('')
        + '</tbody></table></div>'
        : '<div class="vacio">Ninguna jornada usa la camioneta que está en taller.</div>')
      + '</div>';
  }

  return html;
}

/* ---------- Capacitacion ---------- */

function vistaCapacitacion() {
  var pendientes = estado.destinos.filter(function (d) { return d.Equipos > 0 && !d.Link_Enviado; });
  var elegido = pendientes[0] || estado.destinos.filter(function (d) { return d.Equipos > 0; })[0];

  var html = '<div class="columnas">';

  html += '<div class="panel"><h2>Enviar capacitación</h2>'
    + '<p class="nota">Mandar el link antes de la visita baja la capacitación presencial de '
    + esc(formatoHoras(estado.parametros.P_T_CAPACITACION)) + ' a '
    + esc(formatoHoras(estado.parametros.P_T_CAP_EFECTIVA)) + '. El plan se recalcula al enviarlo.</p>';

  if (!elegido) {
    html += '<div class="vacio">No hay destinos con equipos por instalar.</div></div>';
  } else {
    html += '<form id="form-correo">'
      + '<label class="campo"><span>Destino</span><select name="destino">'
      + estado.destinos.filter(function (d) { return d.Equipos > 0; }).map(function (d) {
        return '<option value="' + esc(d.ID_Destino) + '"' + (d.ID_Destino === elegido.ID_Destino ? ' selected' : '') + '>'
          + esc(d.Comuna) + ' · ' + d.Equipos + ' equipo(s)' + (d.Link_Enviado ? ' · ya enviado' : '') + '</option>';
      }).join('')
      + '</select></label>'
      + campoTexto('mail', 'Correo del cliente', elegido.Mail_Cliente || 'contacto@' + sinTildes(elegido.Comuna).toLowerCase().replace(/ /g, '') + '.cl', 'email')
      + campoTexto('asunto', 'Asunto', 'Capacitación previa a la instalación en ' + elegido.Comuna)
      + '<label class="campo"><span>Mensaje</span><textarea name="cuerpo">' + esc(cuerpoCorreoPorDefecto(elegido)) + '</textarea></label>'
      + '<button type="button" class="boton" data-accion="enviar-correo">Enviar capacitación</button>'
      + '</form></div>';

    html += '<div class="panel"><h2>Vista previa</h2>'
      + '<p class="nota">Asi le llega al cliente. El enlace es de demostración.</p>'
      + '<div class="sobre" id="previsualizacion">' + sobreCorreo(elegido) + '</div></div>';
  }

  html += '</div>';

  html += bloqueAhorroCapacitacion(pendientes);

  html += '<div class="panel"><h2>Enviados</h2>';
  if (!estado.correos.length) {
    html += '<div class="vacio">Todavia no se ha enviado ninguna capacitación. '
      + 'Cada envio baja el tiempo presencial a la mitad en esa comuna.</div>';
  } else {
    html += '<div class="tabla-envoltorio"><table class="datos">'
      + '<thead><tr><th>Folio</th><th>Comuna</th><th>Para</th><th>Asunto</th><th>Enviado</th><th>Estado</th></tr></thead><tbody>'
      + estado.correos.slice().reverse().map(function (c) {
        return '<tr><td>' + esc(c.ID_Correo) + '</td><td>' + esc(c.Comuna) + '</td>'
          + '<td>' + esc(c.Para) + '</td><td>' + esc(c.Asunto) + '</td>'
          + '<td>' + esc(horaCorta(c.Enviado)) + '</td>'
          + '<td><span class="marca ruta">' + esc(c.Estado) + '</span></td></tr>';
      }).join('')
      + '</tbody></table></div>';
  }
  html += '</div>';

  return html;
}

/* Cuanto se ganaria enviando las capacitaciones que faltan. Se simula sobre una copia:
   el ahorro en horas es directo, pero el ahorro en dinero solo aparece donde la reduccion
   alcanza a sacar a una jornada de las horas extra. */
function bloqueAhorroCapacitacion(pendientes) {
  if (!pendientes.length) {
    return '<div class="panel"><h2>Efecto en el plan</h2>'
      + '<p class="nota">Todas las comunas con equipos ya tienen su capacitación enviada.</p></div>';
  }

  var copia = JSON.parse(JSON.stringify(estado));
  copia.destinos.forEach(function (d) { d.Link_Enviado = true; });
  var planConTodo = recalcularPlan(copia);

  var horas = plan.resumen.Horas_Plan - planConTodo.resumen.Horas_Plan;
  var dinero = plan.resumen.Costo_Total - planConTodo.resumen.Costo_Total;

  return '<div class="panel"><h2>Efecto en el plan</h2>'
    + '<p class="nota">Quedan ' + pendientes.length + ' comuna(s) por avisar. Enviarles la capacitación '
    + 'le saca <strong>' + esc(formatoHoras(horas)) + '</strong> de trabajo presencial al plan.</p>'
    + '<p class="nota">En dinero son <strong>' + esc(clp(dinero)) + '</strong>, y solo por las horas extra que se dejan '
    + 'de pagar. El resto del ahorro es tiempo del técnico, no costo directo: viáticos, hotel, '
    + 'combustible y peajes no dependen de cuánto dure la capacitación.</p>'
    + '</div>';
}

function cuerpoCorreoPorDefecto(destino) {
  return 'Estimado cliente:\n\n'
    + 'Antes de la instalación en ' + destino.Comuna + ' le enviamos la capacitación en video. '
    + 'Verla toma 10 minutos y permite que la sesión presencial baje de 30 a 15 minutos, '
    + 'con lo que el técnico termina antes y usted ocupa menos tiempo.\n\n'
    + 'El día de la visita el técnico resuelve las dudas que le queden y hace la puesta en marcha.\n\n'
    + 'Equipo de servicio técnico';
}

function sobreCorreo(destino, datos) {
  var d = datos || {
    mail: destino.Mail_Cliente || 'contacto@' + sinTildes(destino.Comuna).toLowerCase().replace(/ /g, '') + '.cl',
    asunto: 'Capacitación previa a la instalación en ' + destino.Comuna,
    cuerpo: cuerpoCorreoPorDefecto(destino)
  };
  var link = enlaceCapacitacion(destino);
  return '<header>'
    + '<div><span>Para</span><span>' + esc(d.mail) + '</span></div>'
    + '<div><span>De</span><span>coordinador@serviciotecnico.cl</span></div>'
    + '<div><span>Asunto</span><span><strong>' + esc(d.asunto) + '</strong></span></div>'
    + '</header>'
    + '<div class="cuerpo">' + esc(d.cuerpo)
    + '\n<a class="enlace-cap" href="' + esc(link) + '">Ver la capacitación (10 min)</a>\n'
    + '<span class="nota">' + esc(link) + '</span></div>';
}

function enlaceCapacitacion(destino) {
  return 'https://capacitacion.serviciotecnico.cl/' + sinTildes(destino.Comuna).toLowerCase().replace(/ /g, '-')
    + '/' + destino.ID_Destino.toLowerCase();
}

/* ---------- Campos ---------- */

function campoTexto(nombre, etiqueta, valor, tipo) {
  return '<label class="campo"><span>' + esc(etiqueta) + '</span>'
    + '<input type="' + (tipo || 'text') + '" name="' + esc(nombre) + '" value="' + esc(valor) + '"></label>';
}

function campoNumero(nombre, etiqueta, valor, minimo, paso) {
  return '<label class="campo"><span>' + esc(etiqueta) + '</span>'
    + '<input type="number" name="' + esc(nombre) + '" value="' + esc(valor) + '" min="' + minimo + '" step="' + (paso || 1) + '"></label>';
}

function campoSelect(nombre, etiqueta, opciones, elegido) {
  return '<label class="campo"><span>' + esc(etiqueta) + '</span><select name="' + esc(nombre) + '">'
    + opciones.map(function (o) {
      return '<option value="' + esc(o) + '"' + (o === elegido ? ' selected' : '') + '>' + esc(o) + '</option>';
    }).join('')
    + '</select></label>';
}

function proximaFechaLibre() {
  var usadas = {};
  estado.jornadas.forEach(function (j) { usadas[j.Fecha] = (usadas[j.Fecha] || 0) + 1; });
  for (var i = 0; i < 20; i++) {
    var f = fechaLaboral(FECHA_INICIO_PLAN, i);
    if ((usadas[f] || 0) < 5) { return f; }
  }
  return fechaLaboral(FECHA_INICIO_PLAN, 0);
}

function leerFormulario(selector) {
  var form = el(selector);
  if (!form) { return null; }
  var datos = {};
  todos('input, select, textarea', form).forEach(function (campo) {
    datos[campo.name] = campo.type === 'number' ? Number(campo.value) : campo.value;
  });
  return datos;
}

/* ---------- Eventos ---------- */

function manejarAccionCoordinador(evento) {
  var nodo = evento.target.closest('[data-accion]');
  if (!nodo) { return; }
  var accion = nodo.getAttribute('data-accion');

  if (accion === 'reiniciar') { pedirReinicio(); }
  else if (accion === 'salir') { cerrarSesion(); }
  else if (accion === 'simular') { simularTrabajo(); }
  else if (accion === 'autoasignar') { autoasignarFormulario(); }
  else if (accion === 'confirmar') { confirmarTrabajo(); }
  else if (accion === 'descartar') { propuestaActual = null; dibujarPestanaCoordinador(); }
  else if (accion === 'elegir-jornada') { elegirJornada(nodo.getAttribute('data-jornada')); }
  else if (accion === 'alternar-tecnico') { alternarTecnico(nodo.getAttribute('data-tecnico')); }
  else if (accion === 'elegir-conductor') {
    seleccionAsignacion.conductor = nodo.getAttribute('data-tecnico');
    dibujarPestanaCoordinador();
  } else if (accion === 'elegir-vehiculo') {
    seleccionAsignacion.vehiculo = nodo.getAttribute('data-vehiculo');
    dibujarPestanaCoordinador();
  } else if (accion === 'guardar-asignacion') { guardarAsignacion(); }
  else if (accion === 'autoasignar-jornada') { autoasignarJornada(); }
  else if (accion === 'estado-vehiculo') {
    despachar('estadoVehiculo', {
      idVehiculo: nodo.getAttribute('data-vehiculo'),
      estado: nodo.getAttribute('data-estado')
    });
  } else if (accion === 'enviar-correo') { enviarCapacitacion(); }
  else if (accion === 'exportar-nomina') { exportarNomina(); }
}

function manejarCambioCoordinador(evento) {
  var campo = evento.target;
  if (campo.name === 'region' && el('#form-trabajo')) {
    var select = el('[name="comuna"]', el('#form-trabajo'));
    var comunas = REGIONES[campo.value] || [];
    select.innerHTML = comunas.map(function (c) {
      return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
    }).join('');
    rellenarKmComuna();
  } else if (campo.name === 'comuna') {
    rellenarKmComuna();
  } else if (campo.name === 'destino' && el('#form-correo')) {
    dibujarPestanaCoordinador();
  }
}

function manejarEntradaCoordinador(evento) {
  var form = el('#form-correo');
  if (!form || !form.contains(evento.target)) { return; }
  var datos = leerFormulario('#form-correo');
  var destino = buscarDestino(datos.destino);
  if (destino) { el('#previsualizacion').innerHTML = sobreCorreo(destino, datos); }
}

/* Cuando la comuna ya existe en la tabla de destinos usamos sus kilometros reales.
   Cuando es nueva, se propone la referencia de la region y se avisa que es estimacion. */
function rellenarKmComuna() {
  var form = el('#form-trabajo');
  if (!form) { return; }
  var comuna = el('[name="comuna"]', form).value;
  var region = el('[name="region"]', form).value;
  var conocido = estado.destinos.filter(function (d) { return d.Comuna === comuna; })[0];
  var ref = REFERENCIA_REGION[region] || REFERENCIA_REGION.Metropolitana;
  el('[name="km"]', form).value = conocido ? conocido.Km_Ida : ref.km;
  el('[name="peaje"]', form).value = conocido ? conocido.Peaje_Ida : ref.peaje;
  el('#nota-km').textContent = conocido
    ? 'Kilómetros y peaje de ' + comuna + ' tomados de la tabla de destinos: consulta real a Google Maps y catalogo MOP.'
    : comuna + ' no esta en la tabla de destinos. Se propone la referencia de ' + region + '; corrige los kilómetros si los conoces.';
}

function datosTrabajo() {
  var d = leerFormulario('#form-trabajo');
  if (!d) { return null; }
  if (!d.empresa || !d.direccion || !d.cliente || !d.mail || !d.fecha) {
    alertaSuave('Faltan datos: empresa, calle, cliente, correo y fecha son obligatorios.');
    return null;
  }
  if (d.equipos < 1) { alertaSuave('Tiene que haber al menos un equipo.'); return null; }
  var ref = REFERENCIA_REGION[d.region] || REFERENCIA_REGION.Metropolitana;
  var conocido = estado.destinos.filter(function (x) { return x.Comuna === d.comuna; })[0];
  d.corredor = conocido ? conocido.Corredor : ref.corredor;
  d.lat = conocido ? conocido.Lat : ref.lat;
  d.lng = conocido ? conocido.Lng : ref.lng;
  return d;
}

function simularTrabajo() {
  var d = datosTrabajo();
  if (!d) { return; }

  var propuesta = autoasignar(estado, plan, d.fecha, d.tecnicos);
  if (!propuesta.ok) { alertaSuave(propuesta.motivo); return; }

  /* Se simula sobre una copia del estado: nada se escribe hasta que el coordinador confirma. */
  var copia = JSON.parse(JSON.stringify(estado));
  var destinoSimulado = copia.destinos.filter(function (x) { return x.Comuna === d.comuna; })[0];
  if (!destinoSimulado) {
    destinoSimulado = {
      ID_Destino: 'SIM', Comuna: d.comuna, Region: d.region, En_RM: d.region === 'Metropolitana',
      Corredor: d.corredor, Km_Ida: d.km, Peaje_Ida: d.peaje, Equipos: d.equipos,
      Lat: d.lat, Lng: d.lng, Link_Enviado: false
    };
    copia.destinos.push(destinoSimulado);
  }

  var pernocta = (d.km / velocidadCorredor(d.corredor, copia.parametros)) * copia.parametros.P_FACTOR_HORAS > copia.parametros.P_UMBRAL_PERNOCTA;
  var jornadaSimulada = {
    ID_Jornada: 'SIMULACION',
    Fecha: d.fecha,
    ID_Vehiculo: propuesta.vehiculo,
    Tecnicos: propuesta.tecnicos,
    Conductor: propuesta.conductor,
    Tramos: [
      { Origen: 'BASE', Destino: destinoSimulado.ID_Destino, Km: d.km, Peaje: d.peaje, Equipos: d.equipos, Noches: pernocta ? 1 : 0, Corredor: d.corredor },
      { Origen: destinoSimulado.ID_Destino, Destino: 'BASE', Km: d.km, Peaje: d.peaje, Equipos: 0, Noches: 0, Corredor: d.corredor }
    ]
  };

  var calculada = calcularJornada(jornadaSimulada, copia);
  var n = calculada.Tecnicos.length;
  var costo = calculada.Combustible + calculada.Peaje + calculada.Desgaste
    + calculada.Estipendio * n + calculada.Hotel * n + calculada.Costo_Horas_Extra * n;

  propuestaActual = {
    entrada: d,
    propuesta: propuesta,
    jornadaCalculada: calculada,
    costo: costo
  };
  dibujarPestanaCoordinador();
  alertaSuave(propuesta.motivo, 'ruta');
}

function autoasignarFormulario() {
  var d = datosTrabajo();
  if (!d) { return; }
  var propuesta = autoasignar(estado, plan, d.fecha, d.tecnicos);
  alertaSuave(propuesta.ok ? propuesta.motivo : propuesta.motivo, propuesta.ok ? 'ruta' : 'alerta');
}

function confirmarTrabajo() {
  if (!propuestaActual) { return; }
  var d = propuestaActual.entrada;
  var p = propuestaActual.propuesta;
  var idJornada = despachar('crearTrabajo', {
    empresa: d.empresa, region: d.region, comuna: d.comuna,
    direccion: d.direccion, numero: d.numero, cliente: d.cliente, mail: d.mail,
    equipos: d.equipos, fecha: d.fecha, km: d.km, peaje: d.peaje,
    corredor: d.corredor, lat: d.lat, lng: d.lng,
    tecnicos: p.tecnicos, conductor: p.conductor, vehiculo: p.vehiculo
  });
  propuestaActual = null;
  pestanaCoordinador = 'ordenes';
  dibujarCoordinador(el('#aplicacion'));
  alertaSuave('Jornada ' + idJornada + ' creada con ' + p.tecnicos.length + ' orden(es) de trabajo.', 'ruta');
}

function elegirJornada(idJornada) {
  var j = plan.jornadasPorId[idJornada];
  if (!j) { return; }
  seleccionAsignacion = {
    jornada: idJornada,
    tecnicos: j.Tecnicos.slice(),
    conductor: j.Conductor,
    vehiculo: j.ID_Vehiculo
  };
  dibujarPestanaCoordinador();
}

function alternarTecnico(idTecnico) {
  var i = seleccionAsignacion.tecnicos.indexOf(idTecnico);
  if (i === -1) {
    seleccionAsignacion.tecnicos.push(idTecnico);
  } else {
    seleccionAsignacion.tecnicos.splice(i, 1);
    if (seleccionAsignacion.conductor === idTecnico) { seleccionAsignacion.conductor = null; }
  }
  if (!seleccionAsignacion.conductor) {
    var conLicencia = seleccionAsignacion.tecnicos.filter(function (id) {
      var t = buscarTecnico(id);
      return t && t.Licencia;
    });
    seleccionAsignacion.conductor = conLicencia[0] || null;
  }
  dibujarPestanaCoordinador();
}

function guardarAsignacion() {
  var problema = validarAsignacion();
  if (problema) { alertaSuave(problema, 'alerta'); return; }
  despachar('asignar', {
    idJornada: seleccionAsignacion.jornada,
    tecnicos: seleccionAsignacion.tecnicos.slice(),
    conductor: seleccionAsignacion.conductor,
    vehiculo: seleccionAsignacion.vehiculo
  });
  alertaSuave('Equipo de ' + seleccionAsignacion.jornada + ' actualizado.', 'ruta');
}

function autoasignarJornada() {
  var j = plan.jornadasPorId[seleccionAsignacion.jornada];
  if (!j) { return; }
  var propuesta = autoasignar(estado, plan, j.Fecha, Math.max(1, j.Tecnicos.length));
  if (!propuesta.ok) { alertaSuave(propuesta.motivo, 'alerta'); return; }
  seleccionAsignacion.tecnicos = propuesta.tecnicos;
  seleccionAsignacion.conductor = propuesta.conductor;
  seleccionAsignacion.vehiculo = propuesta.vehiculo;
  dibujarPestanaCoordinador();
  alertaSuave(propuesta.motivo, 'ruta');
}

function enviarCapacitacion() {
  var d = leerFormulario('#form-correo');
  if (!d || !d.mail) { alertaSuave('Falta el correo del cliente.', 'alerta'); return; }
  var destino = buscarDestino(d.destino);
  if (!destino) { return; }
  despachar('enviarCapacitacion', {
    idDestino: d.destino,
    mail: d.mail,
    asunto: d.asunto,
    cuerpo: d.cuerpo,
    link: enlaceCapacitacion(destino)
  });
  alertaSuave('Capacitación enviada a ' + destino.Comuna + '. La sesión presencial baja a '
    + formatoHoras(estado.parametros.P_T_CAP_EFECTIVA) + ' y el plan ya se recalculo.', 'ruta');
}

/* ---------- Exportar nomina ---------- */

function exportarNomina() {
  var filas = [['ID_Tecnico', 'Nombre', 'RUT', 'Email', 'Monto', 'Reserva', 'Detalle']];
  plan.nomina.forEach(function (n, i) {
    if (n.Total <= 0) { return; }
    filas.push([
      n.ID_Tecnico,
      n.Nombre,
      rutFicticio(i),
      n.Email,
      Math.round(n.Total),
      Math.round(n.Reserva),
      n.Jornadas + ' jornada(s): viático ' + Math.round(n.Viatico) + ', colación ' + Math.round(n.Colacion)
      + ', hotel ' + Math.round(n.Hotel) + ', combustible ' + Math.round(n.Combustible) + ', peaje ' + Math.round(n.Peaje)
    ]);
  });

  var csv = filas.map(function (f) {
    return f.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(';');
  }).join('\r\n');

  descargar('nomina-transferencias.csv', '﻿' + csv, 'text/csv;charset=utf-8');
}

/* RUT de demostracion con digito verificador valido, para que el CSV se vea real.
   No corresponde a ninguna persona. */
function rutFicticio(indice) {
  var numero = 11000000 + indice * 1234567;
  var suma = 0, multiplo = 2, resto = numero;
  while (resto > 0) {
    suma += (resto % 10) * multiplo;
    resto = Math.floor(resto / 10);
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  var dv = 11 - (suma % 11);
  var digito = dv === 11 ? '0' : dv === 10 ? 'K' : String(dv);
  return numero.toLocaleString('es-CL') + '-' + digito;
}

function descargar(nombre, contenido, tipo) {
  var blob = new Blob([contenido], { type: tipo });
  var url = URL.createObjectURL(blob);
  var enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}
