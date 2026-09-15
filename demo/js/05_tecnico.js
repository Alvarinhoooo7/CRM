/* VISTA TECNICO. Marco de telefono sobre un escenario oscuro, usable con mouse.
   El checklist es bloqueante: sin los implementos verificados no se abre la orden ni la ruta. */

var pantallaTecnico = 'hoy';
var ordenActiva = null;
var filtroOrdenes = 'pendientes';
var firmaLienzo = null;
var firmaContexto = null;
var firmaDibujando = false;
var firmaVacia = true;

function dibujarTecnico(contenedor) {
  var tecnico = buscarTecnico(sesion.idTecnico);
  if (!tecnico) { cerrarSesion(); return; }

  contenedor.innerHTML =
    '<div class="escenario">'
    + '<div class="escenario-barra">'
    + '<h1>Servicio técnico en ruta</h1>'
    + '<span>Aplicación del técnico</span>'
    + '<span class="empuje"></span>'
    + '<label style="font-size:.85rem">Entrar como '
    + '<select data-accion="cambiar-tecnico">'
    + estado.tecnicos.map(function (t) {
      return '<option value="' + esc(t.ID_Tecnico) + '"' + (t.ID_Tecnico === sesion.idTecnico ? ' selected' : '') + '>'
        + esc(t.Nombre) + '</option>';
    }).join('')
    + '</select></label>'
    + '<button class="boton" data-accion="salir">Salir</button>'
    + '</div>'
    + '<div class="telefono"><div class="telefono-pantalla">'
    + '<div class="muesca"></div>'
    + '<div class="tel-barra" id="tel-barra"></div>'
    + '<div class="tel-cuerpo" id="tel-cuerpo"></div>'
    + '<nav class="tel-menu" id="tel-menu"></nav>'
    + '</div></div>'
    + '</div>';

  contenedor.onclick = manejarAccionTecnico;
  contenedor.onchange = manejarCambioTecnico;

  dibujarPantallaTecnico(true);
}

function ordenesDelTecnico() {
  return estado.ordenes.filter(function (o) { return o.ID_Tecnico === sesion.idTecnico; })
    .sort(function (a, b) { return a.Fecha < b.Fecha ? -1 : a.Fecha > b.Fecha ? 1 : 0; });
}

/* Marcar un ítem del checklist redibuja la pantalla entera. Sin conservar el scroll, la
   lista de 17 ítems saltaría al tope en cada tick y sería imposible de usar. Solo se vuelve
   al tope cuando de verdad se cambia de pantalla. */
function dibujarPantallaTecnico(volverAlTope) {
  var tecnico = buscarTecnico(sesion.idTecnico);
  var barra = el('#tel-barra');
  var cuerpo = el('#tel-cuerpo');
  var menu = el('#tel-menu');
  if (!barra) { return; }
  var scroll = cuerpo ? cuerpo.scrollTop : 0;

  var ahora = new Date();
  barra.innerHTML = '<div class="hora"><span>' + pad2(ahora.getHours()) + ':' + pad2(ahora.getMinutes()) + '</span>'
    + '<span>' + esc(tecnico.Licencia ? 'Licencia clase B' : 'Sin licencia') + '</span></div>'
    + '<h2>' + esc(tecnico.Nombre) + '</h2>'
    + '<span class="sub">' + esc(tecnico.ID_Tecnico) + ' · ' + esc(tituloPantalla()) + '</span>';

  if (pantallaTecnico === 'hoy') { cuerpo.innerHTML = pantallaHoy(); }
  else if (pantallaTecnico === 'orden') { cuerpo.innerHTML = pantallaOrden(); }
  else if (pantallaTecnico === 'plata') { cuerpo.innerHTML = pantallaPlata(); }
  else if (pantallaTecnico === 'gastos') { cuerpo.innerHTML = pantallaGastos(); }

  var items = [
    { id: 'hoy', icono: '📋', titulo: 'Mis órdenes' },
    { id: 'orden', icono: '🧭', titulo: 'Orden' },
    { id: 'plata', icono: '💵', titulo: 'Mis fondos' },
    { id: 'gastos', icono: '🧾', titulo: 'Gastos' }
  ];
  menu.innerHTML = items.map(function (i) {
    return '<button data-pantalla="' + i.id + '" aria-selected="' + (i.id === pantallaTecnico) + '">'
      + '<span class="icono">' + i.icono + '</span>' + esc(i.titulo) + '</button>';
  }).join('');

  if (pantallaTecnico === 'orden') { prepararFirma(); }
  cuerpo.scrollTop = volverAlTope ? 0 : scroll;
}

function tituloPantalla() {
  if (pantallaTecnico === 'hoy') { return 'Mis órdenes'; }
  if (pantallaTecnico === 'orden') { return 'Orden de trabajo'; }
  if (pantallaTecnico === 'plata') { return 'Mis fondos'; }
  return 'Gastos';
}

/* ---------- Mis ordenes ---------- */

function pantallaHoy() {
  var ordenes = ordenesDelTecnico();
  if (!ordenes.length) {
    return '<div class="vacio">No tienes órdenes asignadas. El coordinador te asigna desde la pestaña Asignación.</div>';
  }

  var abiertas = ordenes.filter(function (o) { return !o.Hora_Fin; });
  var siguiente = abiertas.filter(function (o) { return !!o.Hora_Inicio; })[0] || abiertas[0];
  var intro = '<section class="tecnico-resumen"><span class="sobretitulo">TU AGENDA DE TERRENO</span><h2>' + (abiertas.length ? 'Vamos con la siguiente orden' : 'Todo al día') + '</h2><p>' + abiertas.length + ' pendientes · ' + (ordenes.length - abiertas.length) + ' cerradas</p>';
  if (siguiente) { intro += '<button class="boton" data-accion="abrir-orden" data-orden="' + esc(siguiente.ID_Orden) + '">' + (siguiente.Hora_Inicio ? 'Continuar trabajo' : 'Preparar orden') + ' →</button>'; }
  intro += '</section><div class="filtros-ordenes" aria-label="Filtrar órdenes">' + [['pendientes', 'Pendientes'], ['cerradas', 'Cerradas'], ['todas', 'Todas']].map(function (f) { return '<button class="boton secundario chico" data-filtro="' + f[0] + '" aria-pressed="' + (filtroOrdenes === f[0]) + '">' + f[1] + '</button>'; }).join('') + '</div>';
  var visibles = ordenes.filter(function (o) { return filtroOrdenes === 'todas' || (filtroOrdenes === 'cerradas' ? !!o.Hora_Fin : !o.Hora_Fin); });
  return intro + (visibles.length ? '' : '<div class="vacio">No hay órdenes en esta categoría.</div>') + visibles.map(function (o) {
    var j = plan.jornadasPorId[o.ID_Jornada];
    var marcados = o.Checklist.filter(function (c) { return c.Marcado; }).length;
    var listo = marcados === o.Checklist.length;
    var marca = o.Estado === 'Cerrada' ? 'ruta' : o.Estado === 'En curso' ? 'peaje' : '';
    return '<button class="tel-tarjeta" style="display:block;width:100%;text-align:left;cursor:pointer" '
      + 'data-accion="abrir-orden" data-orden="' + esc(o.ID_Orden) + '">'
      + '<h3>' + esc(j ? recorridoTexto(j) : o.ID_Orden) + '</h3>'
      + '<span class="meta">' + esc(fechaLarga(o.Fecha)) + ' · ' + esc(o.ID_Orden) + '</span>'
      + '<div style="margin-top:.35rem">'
      + '<span class="marca ' + marca + '">' + esc(o.Estado) + '</span> '
      + (o.Es_Conductor ? '<span class="marca ruta">Conduces</span> ' : '')
      + '<span class="marca ' + (listo ? 'ruta' : 'peaje') + '">Checklist ' + marcados + '/' + o.Checklist.length + '</span>'
      + '</div>'
      + '</button>';
  }).join('');
}

/* ---------- Orden ---------- */

function pantallaOrden() {
  var ordenes = ordenesDelTecnico();
  var orden = ordenActiva ? ordenes.filter(function (o) { return o.ID_Orden === ordenActiva; })[0] : ordenes.filter(function (o) { return o.Hora_Inicio && !o.Hora_Fin; })[0] || ordenes.filter(function (o) { return !o.Hora_Fin; })[0] || ordenes[0];
  if (!orden) {
    return '<div class="vacio">Elige una orden en Mis órdenes.</div>';
  }
  ordenActiva = orden.ID_Orden;

  var j = plan.jornadasPorId[orden.ID_Jornada];
  var completo = checklistCompleto(orden);
  var marcados = orden.Checklist.filter(function (c) { return c.Marcado; }).length;

  var paso = orden.Hora_Fin ? 3 : orden.Hora_Inicio ? 2 : completo ? 1 : 0;
  var html = '<div class="pasos-orden" aria-label="Progreso de la orden">' + ['Preparación', 'Ruta', 'Trabajo', 'Cierre'].map(function (nombre, i) { return '<span class="' + (i <= paso ? 'hecho' : '') + '">' + (i + 1) + '. ' + nombre + '</span>'; }).join('') + '</div>';
  var bloqueoSecuencia = !orden.Hora_Inicio ? motivoInicio(estado, orden) : '';
  if (bloqueoSecuencia) { html += '<div class="aviso-regla" role="status"><strong>Etapa pendiente</strong><p>' + esc(bloqueoSecuencia) + '</p></div>'; }

  if (!completo) {
    html += '<div class="bloqueado-velo">'
      + '<div class="contenido-oculto">'
      + '<h3>' + esc(j ? recorridoTexto(j) : '') + '</h3>'
      + '<p class="meta">Dirección del cliente, contacto, equipos y ruta asignada</p>'
      + '<p class="meta">Teléfono de contacto · Enlace a Google Maps</p>'
      + '</div>'
      + '<div class="candado">'
      + '<strong>Orden bloqueada</strong>'
      + '<span>Verifica los ' + orden.Checklist.length + ' implementos para abrir la orden y la ruta.</span>'
      + '<span><strong>' + marcados + ' de ' + orden.Checklist.length + '</strong> verificados</span>'
      + '</div></div>'
      + '<div class="progreso"><span class="relleno" style="width:' + ((marcados / orden.Checklist.length) * 100).toFixed(0) + '%"></span></div>'
      + listaChecklist(orden);
    return html;
  }

  /* Checklist completo: la orden se abre entera. */
  var destinos = j ? j.Sesiones.map(function (id) { return plan.destinosPorId[id]; }).filter(Boolean) : [];
  var principal = destinos[0];
  var maps = j ? enlaceMaps(j, estado) : null;

  html += '<div class="tel-tarjeta">'
    + '<h3>' + esc(j ? recorridoTexto(j) : orden.ID_Orden) + '</h3>'
    + '<span class="meta">' + esc(fechaLarga(orden.Fecha)) + ' · ' + esc(orden.ID_Orden) + '</span>'
    + '<div style="margin-top:.4rem">'
    + '<span class="marca ruta">Checklist completo</span> '
    + (orden.Es_Conductor ? '<span class="marca peaje">Conduces ' + esc(j.ID_Vehiculo) + '</span>' : '')
    + '</div></div>';

  if (principal) {
    html += '<div class="tel-tarjeta">'
      + '<h3>' + esc(principal.Empresa || 'Cliente') + '</h3>'
      + '<span class="meta">' + esc(principal.Direccion) + '</span><br>'
      + '<span class="meta">' + esc(principal.Contacto) + '</span>'
      + '<div style="margin-top:.4rem">'
      + '<span class="marca">' + (j ? j.Equipos : 0) + ' equipo(s)</span> '
      + '<span class="marca">' + (j ? j.Sesiones.length : 0) + ' capacitación(es)</span> '
      + '<span class="marca ' + (principal.Link_Enviado ? 'ruta' : 'peaje') + '">'
      + (principal.Link_Enviado ? 'Capacitación digital enviada · 15 min' : 'Sin link previo · 30 min') + '</span>'
      + '</div></div>';
  }

  html += '<div class="tel-tarjeta"><h3>Jornada</h3>'
    + '<div class="plata-fila"><span>Kilómetros</span><span class="monto">' + Math.round(j.Km).toLocaleString('es-CL') + ' km</span></div>'
    + '<div class="plata-fila"><span>Horas de viaje</span><span class="monto">' + esc(formatoHoras(j.Horas_Viaje)) + '</span></div>'
    + '<div class="plata-fila"><span>Instalación</span><span class="monto">' + esc(formatoHoras(j.Horas_Instalacion)) + '</span></div>'
    + '<div class="plata-fila"><span>Capacitación</span><span class="monto">' + esc(formatoHoras(j.Horas_Capacitacion)) + '</span></div>'
    + '<div class="plata-fila total"><span>Total de la jornada</span><span class="monto">' + esc(formatoHoras(j.Horas_Totales)) + '</span></div>'
    + (j.Noches ? '<div class="plata-fila"><span>Pernoctación</span><span class="monto">' + j.Noches + ' noche(s)</span></div>' : '')
    + '</div>';

  html += '<div class="acciones-tel">';
  if (maps) {
    html += '<a class="boton" href="' + esc(maps) + '" target="_blank" rel="noopener">Abrir ruta en Google Maps</a>';
  }
  if (principal) {
    var telefono = principal.Telefono || '';
    if (telefono) { html += '<a class="boton secundario" href="tel:' + esc(telefono.replace(/ /g, '')) + '">Llamar al cliente</a>'; }
  }
  html += '</div>';

  html += '<div class="tel-tarjeta" style="margin-top:.6rem"><h3>Hitos</h3>'
    + '<div class="plata-fila"><span>Inicio</span><span class="monto">' + esc(horaCorta(orden.Hora_Inicio)) + '</span></div>'
    + '<div class="plata-fila"><span>Termino</span><span class="monto">' + esc(horaCorta(orden.Hora_Fin)) + '</span></div>'
    + (orden.Coord_Inicio ? '<span class="meta">Lugar planificado: ' + esc(orden.Coord_Inicio.lugar) + '</span>' : '')
    + '</div>';

  if (!orden.Hora_Inicio) {
    var bloqueo = motivoInicio(estado, orden);
    html += '<div class="acciones-tel"><button class="boton" data-accion="iniciar"' + (bloqueo ? ' disabled' : '') + '>Iniciar trabajo</button></div>';
  } else if (!orden.Hora_Fin) {
    html += '<div class="tel-tarjeta"><h3>Cerrar la orden</h3>'
      + '<label class="campo"><span>Equipos instalados</span>'
      + '<p class="nota">Informa el total instalado por la cuadrilla. Se cuenta una sola vez y debe coincidir con el cierre de tus compa\u00f1eros.</p>'
      + '<input type="number" id="equipos-instalados" min="0" max="' + (j ? j.Equipos : 0) + '" value="' + (j ? j.Equipos : 0) + '"></label>'
      + '<label class="campo"><span>Observaciones</span><textarea id="observaciones" style="min-height:4em"></textarea></label>'
      + '<span class="meta">Firma del cliente</span>'
      + '<canvas class="firma-lienzo" id="firma" width="330" height="130"></canvas>'
      + '<button class="boton secundario chico" data-accion="limpiar-firma" style="margin-top:.35rem">Borrar firma</button>'
      + '<label class="campo" style="margin-top:.6rem"><span>Foto de la instalación terminada</span>'
      + '<input type="file" accept="image/jpeg,image/png,image/webp" id="foto-instalacion"></label>'
      + '</div>'
      + '<div class="acciones-tel"><button class="boton" data-accion="finalizar">Finalizar trabajo</button></div>';
  } else {
    html += '<div class="tel-tarjeta"><h3>Orden cerrada</h3>'
      + '<div class="plata-fila"><span>Equipos instalados</span><span class="monto">' + orden.Equipos_Instalados + '</span></div>'
      + (orden.Observaciones ? '<span class="meta">' + esc(orden.Observaciones) + '</span>' : '')
      + '<div style="display:flex;gap:.5rem;margin-top:.5rem;align-items:center">'
      + (orden.Firma ? '<img class="miniatura" src="' + esc(orden.Firma) + '" alt="Firma del cliente">' : '')
      + (orden.Foto ? '<img class="miniatura" src="' + esc(orden.Foto) + '" alt="Foto de la instalacion">' : '')
      + '</div></div>';
  }

  html += '<details style="margin-top:.6rem"><summary class="meta" style="cursor:pointer">Ver checklist verificado</summary>'
    + listaChecklist(orden) + '</details>';

  return html;
}

function listaChecklist(orden) {
  var porCategoria = { Bolso: [], Vehiculo: [], Persona: [] };
  estado.implementos.forEach(function (im) {
    var marca = orden.Checklist.filter(function (c) { return c.ID_Implemento === im.ID_Implemento; })[0];
    porCategoria[im.Categoria].push({ im: im, marcado: marca ? marca.Marcado : false });
  });

  var titulos = { Bolso: 'En el bolso', Vehiculo: 'En la camioneta', Persona: 'Sobre la persona' };
  var html = '<div class="tel-tarjeta">';
  Object.keys(porCategoria).forEach(function (categoria) {
    html += '<div class="grupo-check">' + esc(titulos[categoria]) + '</div>';
    porCategoria[categoria].forEach(function (x) {
      html += '<label class="item-check' + (x.marcado ? ' marcado' : '') + '">'
        + '<input type="checkbox" data-implemento="' + esc(x.im.ID_Implemento) + '"' + (x.marcado ? ' checked' : '') + (orden.Hora_Inicio ? ' disabled' : '') + '>'
        + '<span class="texto">' + esc(x.im.Item) + '</span></label>';
    });
  });
  html += '</div>';
  return html;
}

/* ---------- Mis fondos ---------- */

function pantallaPlata() {
  var n = plan.nomina.filter(function (x) { return x.ID_Tecnico === sesion.idTecnico; })[0];
  if (!n) { return '<div class="vacio">Sin transferencias calculadas.</div>'; }

  var pagado = !!estado.pagos[sesion.idTecnico];
  var mios = estado.gastos.filter(function (g) { return g.ID_Tecnico === sesion.idTecnico; });
  var aprobado = mios.filter(function (g) { return g.Estado === 'Aprobado'; })
    .reduce(function (a, g) { return a + g.Monto; }, 0);
  var pendiente = mios.filter(function (g) { return g.Estado === 'Pendiente'; })
    .reduce(function (a, g) { return a + g.Monto; }, 0);
  var disponible = n.Transferido + (n.Reembolsado || 0) - aprobado - pendiente;

  return '<div class="tel-tarjeta">'
    + '<h3>' + 'Anticipo recibido' + '</h3>'
    + '<div style="font-size:2rem;font-weight:700;font-variant-numeric:tabular-nums">' + esc(clp(n.Transferido)) + '</div>'
    + '<div class="meta">Pendiente de transferencia: ' + esc(clp(n.Por_Transferir)) + '</div>'
    + '<span class="meta">' + n.Jornadas + ' jornada(s) asignada(s)</span>'
    + (pagado ? '' : '<div style="margin-top:.4rem"><span class="marca peaje">Esperando la transferencia del supervisor</span></div>')
    + '</div>'

    + '<div class="tel-tarjeta"><h3>Detalle del anticipo</h3>'
    + '<div class="plata-fila"><span>Viáticos</span><span class="monto">' + esc(clp(n.Viatico)) + '</span></div>'
    + '<div class="plata-fila"><span>Colaciones</span><span class="monto">' + esc(clp(n.Colacion)) + '</span></div>'
    + '<div class="plata-fila"><span>Hotel</span><span class="monto">' + esc(clp(n.Hotel)) + '</span></div>'
    + '<div class="plata-fila"><span>Combustible</span><span class="monto">' + esc(clp(n.Combustible)) + '</span></div>'
    + '<div class="plata-fila"><span>Peajes</span><span class="monto">' + esc(clp(n.Peaje)) + '</span></div>'
    + '<div class="plata-fila reserva"><span>Reserva de emergencia</span><span class="monto">' + esc(clp(n.Reserva)) + '</span></div>'
    + '<div class="plata-fila total"><span>Total</span><span class="monto">' + esc(clp(n.Total)) + '</span></div>'
    + (n.Combustible === 0 && n.Peaje === 0 ? '<span class="meta">No conduces en ninguna jornada, por eso no recibes combustible ni peajes.</span>' : '')
    + '</div>'

    + '<div class="tel-tarjeta"><h3>Saldo de rendición</h3>'
    + '<div class="plata-fila"><span>Rendido y aprobado</span><span class="monto">' + esc(clp(aprobado)) + '</span></div>'
    + '<div class="plata-fila"><span>Rendido por revisar</span><span class="monto">' + esc(clp(pendiente)) + '</span></div>'
    + '<div class="plata-fila"><span>Reembolsos recibidos</span><span class="monto">' + esc(clp(n.Reembolsado)) + '</span></div>'
    + '<div class="plata-fila"><span>Reembolso aprobado pendiente</span><span class="monto">' + esc(clp(n.Por_Reembolsar)) + '</span></div>'
    + '<div class="plata-fila total"><span>Saldo disponible</span><span class="monto">' + esc(clp(disponible)) + '</span></div>'
    + (disponible < 0 ? '<p class="nota">Tus rendiciones superan el anticipo recibido. Solicita la revisión del supervisor.</p>' : '')
    + '</div>'

    + '<div class="tel-tarjeta" style="border-left:4px solid var(--peaje)">'
    + '<h3>Reserva de emergencia</h3>'
    + '<div style="font-size:1.4rem;font-weight:700;color:var(--peaje);font-variant-numeric:tabular-nums">' + esc(clp(n.Reserva)) + '</div>'
    + '<span class="meta">Es el ' + Math.round(estado.parametros.P_IMPREVISTOS * 100) + '% que va incluido en tu transferencia. '
    + 'Solo se usa en emergencia: una pana, un peaje que no estaba, un imprevisto en ruta. '
    + 'Todo gasto contra la reserva se marca como emergencia al subir el comprobante.</span>'
    + '</div>';
}

/* ---------- Gastos ---------- */

function pantallaGastos() {
  var mios = estado.gastos.filter(function (g) { return g.ID_Tecnico === sesion.idTecnico; });
  var ordenes = ordenesDelTecnico();

  var html = '<div class="tel-tarjeta"><h3>Subir comprobante</h3>'
    + '<label class="campo"><span>Orden</span><select id="gasto-orden">'
    + ordenes.map(function (o) {
      return '<option value="' + esc(o.ID_Orden) + '">' + esc(o.ID_Orden) + ' · ' + esc(fechaCorta(o.Fecha)) + '</option>';
    }).join('')
    + '</select></label>'
    + '<label class="campo"><span>Tipo</span><select id="gasto-tipo">'
    + ['Viático', 'Colación', 'Peaje', 'Combustible', 'Hotel', 'Otro'].map(function (t) {
      return '<option>' + esc(t) + '</option>';
    }).join('')
    + '</select></label>'
    + '<label class="campo"><span>Monto</span><input type="number" id="gasto-monto" min="0" step="100" value="5000"></label>'
    + '<label class="item-check"><input type="checkbox" id="gasto-emergencia">'
    + '<span class="texto">Es una emergencia: se paga con la reserva</span></label>'
    + '<label class="campo" style="margin-top:.5rem"><span>Foto de la boleta · máximo 2 MB</span>'
    + '<input type="file" accept="image/jpeg,image/png,image/webp" id="gasto-foto"></label>'
    + '<div class="acciones-tel"><button class="boton" data-accion="subir-gasto">Subir comprobante</button></div>'
    + '</div>';

  if (!mios.length) {
    html += '<div class="vacio">Todavia no subes comprobantes.</div>';
    return html;
  }

  html += mios.slice().reverse().map(function (g) {
    var marca = g.Estado === 'Aprobado' ? 'ruta' : g.Estado === 'Rechazado' ? 'alerta' : 'peaje';
    return '<div class="tel-tarjeta" style="display:flex;gap:.6rem;align-items:flex-start">'
      + (g.Comprobante ? '<img class="miniatura" src="' + esc(g.Comprobante) + '" alt="Comprobante">' : '')
      + '<div style="flex:1">'
      + '<h3>' + esc(g.Tipo) + ' · ' + esc(clp(g.Monto)) + '</h3>'
      + '<span class="meta">' + esc(g.ID_Gasto) + ' · ' + esc(fechaCorta(g.Fecha)) + '</span>'
      + '<div style="margin-top:.3rem"><span class="marca ' + marca + '">' + esc(g.Estado) + '</span>'
      + (g.Emergencia ? ' <span class="marca alerta">Emergencia</span>' : '') + '</div>'
      + '</div></div>';
  }).join('');

  return html;
}

/* ---------- Firma ---------- */

function prepararFirma() {
  firmaLienzo = el('#firma');
  if (!firmaLienzo) { return; }
  firmaContexto = firmaLienzo.getContext('2d');
  firmaContexto.lineWidth = 2;
  firmaContexto.lineCap = 'round';
  firmaContexto.strokeStyle = '#15211c';
  firmaVacia = true;

  function posicion(evento) {
    var caja = firmaLienzo.getBoundingClientRect();
    var punto = evento.touches ? evento.touches[0] : evento;
    return {
      x: (punto.clientX - caja.left) * (firmaLienzo.width / caja.width),
      y: (punto.clientY - caja.top) * (firmaLienzo.height / caja.height)
    };
  }
  function empezar(evento) {
    evento.preventDefault();
    firmaDibujando = true;
    firmaVacia = false;
    var p = posicion(evento);
    firmaContexto.beginPath();
    firmaContexto.moveTo(p.x, p.y);
  }
  function mover(evento) {
    if (!firmaDibujando) { return; }
    evento.preventDefault();
    var p = posicion(evento);
    firmaContexto.lineTo(p.x, p.y);
    firmaContexto.stroke();
  }
  function terminar() { firmaDibujando = false; }

  firmaLienzo.addEventListener('mousedown', empezar);
  firmaLienzo.addEventListener('mousemove', mover);
  firmaLienzo.addEventListener('mouseleave', terminar);
  firmaLienzo.addEventListener('mouseup', terminar);
  firmaLienzo.addEventListener('touchstart', empezar);
  firmaLienzo.addEventListener('touchmove', mover);
  firmaLienzo.addEventListener('touchend', terminar);
}

/* ---------- Eventos ---------- */

function manejarAccionTecnico(evento) {
  var filtro = evento.target.closest('[data-filtro]');
  if (filtro) { filtroOrdenes = filtro.getAttribute('data-filtro'); dibujarPantallaTecnico(true); return; }
  var pantalla = evento.target.closest('[data-pantalla]');
  if (pantalla) {
    pantallaTecnico = pantalla.getAttribute('data-pantalla');
    dibujarPantallaTecnico(true);
    return;
  }

  var nodo = evento.target.closest('[data-accion]');
  if (!nodo) { return; }
  var accion = nodo.getAttribute('data-accion');

  if (accion === 'salir') { cerrarSesion(); }
  else if (accion === 'abrir-orden') {
    ordenActiva = nodo.getAttribute('data-orden');
    pantallaTecnico = 'orden';
    dibujarPantallaTecnico(true);
  } else if (accion === 'iniciar') { iniciarTrabajo(); }
  else if (accion === 'finalizar') { finalizarTrabajo(); }
  else if (accion === 'limpiar-firma') {
    if (firmaContexto) {
      firmaContexto.clearRect(0, 0, firmaLienzo.width, firmaLienzo.height);
      firmaVacia = true;
    }
  } else if (accion === 'subir-gasto') { subirGasto(); }
}

function manejarCambioTecnico(evento) {
  var selector = evento.target.closest('[data-accion="cambiar-tecnico"]');
  if (selector) {
    sesion.idTecnico = selector.value;
    sesion.correo = buscarTecnico(selector.value).Email;
    ordenActiva = null;
    pantallaTecnico = 'hoy';
    dibujarTecnico(el('#aplicacion'));
    return;
  }

  var caja = evento.target.closest('[data-implemento]');
  if (caja) {
    despachar('marcarChecklist', {
      idOrden: ordenActiva,
      idImplemento: caja.getAttribute('data-implemento'),
      marcado: caja.checked
    });
  }
}

function ubicacionPlanificada(jornada) {
  if (!jornada) { return null; }
  var id = jornada.Sesiones[0] || jornada.Comunas[0];
  var d = plan.destinosPorId[id];
  if (!d) { return { lugar: 'Base de operaciones', lat: BASE_OPERACIONES.Lat, lng: BASE_OPERACIONES.Lng, en_sitio: null, fuente: 'Plan' }; }
  return { lugar: d.Comuna, lat: d.Lat, lng: d.Lng, en_sitio: null, fuente: 'Plan' };
}

function iniciarTrabajo() {
  var orden = buscarOrden(ordenActiva);
  if (!orden) { return; }
  var j = plan.jornadasPorId[orden.ID_Jornada];
  var resultado = despachar('iniciarTrabajo', { idOrden: ordenActiva, coordenadas: ubicacionPlanificada(j) });
  if (!resultado) { return; }
  alertaSuave('Trabajo iniciado. La hora quedo registrada y el supervisor ya la ve.', 'ruta');
}

function finalizarTrabajo() {
  var orden = buscarOrden(ordenActiva);
  if (!orden) { return; }
  var j = plan.jornadasPorId[orden.ID_Jornada];
  var equipos = Number((el('#equipos-instalados') || {}).value || 0);
  var observaciones = (el('#observaciones') || {}).value || '';
  var firma = (firmaLienzo && !firmaVacia) ? firmaLienzo.toDataURL('image/png') : null;

  if (!Number.isInteger(equipos) || equipos < 0 || equipos > j.Equipos) { alertaSuave('Indica una cantidad válida de equipos para esta jornada.', 'alerta'); return; }
  if (j.Equipos > 0 && (!firma || !(el('#foto-instalacion').files || []).length)) { alertaSuave('Agrega la firma y una foto antes de cerrar la instalación.', 'alerta'); return; }
  leerArchivo(el('#foto-instalacion'), function (foto) {
    var resultado = despachar('finalizarTrabajo', {
      idOrden: orden.ID_Orden,
      coordenadas: ubicacionPlanificada(j),
      equipos: equipos,
      observaciones: observaciones,
      firma: firma,
      foto: foto
    });
    if (!resultado) { return; }
    alertaSuave('Orden cerrada con ' + equipos + ' equipo(s). El avance del supervisor ya se movio.', 'ruta');
  });
}

function subirGasto() {
  var monto = Number((el('#gasto-monto') || {}).value || 0);
  if (!Number.isSafeInteger(monto) || monto <= 0) { alertaSuave('El monto tiene que ser mayor que cero.', 'alerta'); return; }
  var idOrden = (el('#gasto-orden') || {}).value;
  var tipo = (el('#gasto-tipo') || {}).value;
  var emergencia = (el('#gasto-emergencia') || {}).checked;

  if (!idOrden || !(el('#gasto-foto').files || []).length) { alertaSuave('Selecciona una orden y adjunta la foto de la boleta.', 'alerta'); return; }
  leerArchivo(el('#gasto-foto'), function (comprobante) {
    var resultado = despachar('agregarGasto', {
      idOrden: idOrden,
      idTecnico: sesion.idTecnico,
      tipo: tipo,
      monto: monto,
      emergencia: emergencia,
      comprobante: comprobante
    });
    if (!resultado) { return; }
    alertaSuave('Comprobante enviado. Queda pendiente hasta que el supervisor lo revise.', 'ruta');
  });
}

/* Lee la foto elegida como data-URL. Si no hay archivo, sigue igual sin imagen. */
function leerArchivo(campo, alTerminar) {
  if (!campo || !campo.files || !campo.files[0]) { alTerminar(null); return; }
  var archivo = campo.files[0];
  if (!/^image\/(jpeg|png|webp)$/.test(archivo.type) || archivo.size > 2 * 1024 * 1024) { alertaSuave('Usa una imagen JPG, PNG o WebP de hasta 2 MB.', 'alerta'); return; }
  var lector = new FileReader();
  lector.onload = function () { alTerminar(lector.result); };
  lector.onerror = function () { alertaSuave('No se pudo leer la imagen. Inténtalo nuevamente.', 'alerta'); };
  lector.readAsDataURL(campo.files[0]);
}
