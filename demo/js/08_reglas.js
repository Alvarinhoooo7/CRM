/* Reglas compartidas. La interfaz propone; el estado valida antes de confirmar. */
var ultimoError = '';
function exigir(condicion, mensaje) { if (!condicion) { throw new Error(mensaje); } }
function fechaValida(f) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f || '')) { return false; }
  var d = new Date(f + 'T12:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === f;
}
function diaHabil(f) { return fechaValida(f) && [0, 6].indexOf(new Date(f + 'T12:00:00Z').getUTCDay()) === -1; }
function semanaDe(f) {
  var d = new Date(f + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
}
function montoPagado(e, id, totalAnterior) {
  var p = (e.pagos || {})[id];
  return p === true ? totalAnterior || 0 : p && Number.isFinite(p.Monto) ? p.Monto : 0;
}
function jornadaProtegida(e, id) {
  return e.ordenes.some(function (o) {
    return o.ID_Jornada === id && (o.Hora_Inicio || o.Hora_Fin || o.Firma || o.Foto || o.Checklist.some(function (x) { return x.Marcado; }) || e.gastos.some(function (g) { return g.ID_Orden === o.ID_Orden; }));
  });
}
function validarParametros(p) {
  Object.keys(PARAMETROS_BASE).forEach(function (k) { exigir(Number.isFinite(p[k]) && p[k] >= 0, 'Parámetro inválido: ' + k); });
  ['P_RENDIMIENTO', 'P_DIAS_SEMANA', 'P_REDONDEO', 'P_VEL_URBANA', 'P_VEL_R78', 'P_VEL_RUTA5', 'P_FACTOR_HORAS', 'P_CAPACIDAD_CAMIONETA', 'P_TOPE_CONDUCCION', 'P_T_INSTALACION'].forEach(function (k) { exigir(p[k] > 0, k + ' debe ser mayor que cero.'); });
  exigir(p.P_JORNADA_SEMANAL > p.P_COLACION_H, 'La colación no puede consumir toda la jornada.');
  exigir(p.P_IMPREVISTOS <= 1 && p.P_REDUCCION_CAP <= 1, 'Los factores porcentuales deben estar entre 0 y 1.');
}
function validarPlanOperativo(e) {
  validarParametros(e.parametros);
  var recursos = {}, horasSemana = {}, ids = {};
  var destinos = indicePor(e.destinos, 'ID_Destino'), tecnicos = indicePor(e.tecnicos, 'ID_Tecnico'), flota = indicePor(e.flota, 'ID_Vehiculo');
  e.jornadas.slice().sort(function (a, b) { return a.Fecha.localeCompare(b.Fecha) || a.ID_Jornada.localeCompare(b.ID_Jornada); }).forEach(function (j) {
    var nombre = j.ID_Jornada;
    exigir(!ids[nombre], 'Jornada duplicada: ' + nombre); ids[nombre] = true;
    exigir(diaHabil(j.Fecha), nombre + ': selecciona una fecha válida de lunes a viernes.');
    exigir(j.Tecnicos.length > 0 && j.Tecnicos.length <= e.parametros.P_CAPACIDAD_CAMIONETA && new Set(j.Tecnicos).size === j.Tecnicos.length, nombre + ': dotación inválida o técnicos duplicados.');
    j.Tecnicos.forEach(function (id) { exigir(tecnicos[id] && tecnicos[id].Activo, nombre + ': técnico inexistente o inactivo.'); });
    exigir(j.Tecnicos.indexOf(j.Conductor) !== -1 && tecnicos[j.Conductor].Licencia, nombre + ': el conductor debe pertenecer al equipo y tener licencia.');
    exigir(flota[j.ID_Vehiculo], nombre + ': vehículo inexistente.');
    var ordenesJornada = e.ordenes.filter(function (o) { return o.ID_Jornada === nombre; });
    var cerrada = ordenesJornada.length > 0 && ordenesJornada.every(function (o) { return !!o.Hora_Fin; });
    /* Taller se controla al asignar/iniciar. Permite reparar una a una las
       jornadas de un vehículo que acaba de entrar en mantenimiento. */
    exigir(j.Tramos && j.Tramos.length, nombre + ': falta el itinerario.');
    j.Tramos.forEach(function (t, i) {
      exigir((t.Origen === 'BASE' || destinos[t.Origen]) && (t.Destino === 'BASE' || destinos[t.Destino]), nombre + ': origen o destino inexistente.');
      exigir(!i || j.Tramos[i - 1].Destino === t.Origen, nombre + ': los tramos no forman una ruta continua.');
      ['Km', 'Peaje', 'Equipos', 'Noches'].forEach(function (k) { exigir(Number.isFinite(t[k]) && t[k] >= 0, nombre + ': ' + k + ' inválido.'); });
      exigir(Number.isInteger(t.Equipos) && Number.isInteger(t.Noches), nombre + ': equipos y noches deben ser enteros.');
      exigir(t.Origen === t.Destino || t.Km > 0, nombre + ': un traslado requiere kilómetros mayores que cero.');
      exigir(t.Destino !== 'BASE' || t.Equipos === 0, nombre + ': no se instalan equipos en la base.');
    });
    var calculada = calcularJornada(j, e);
    exigir(calculada.Horas_Totales <= e.parametros.P_TOPE_DIA + 1e-8, nombre + ': supera el tope diario; divide el trabajo en jornadas.');
    exigir(calculada.Horas_Viaje <= e.parametros.P_TOPE_CONDUCCION + 1e-8, nombre + ': supera el máximo de conducción; agrega una escala.');
    var inicio = j.Tramos[0].Origen, fin = j.Tramos[j.Tramos.length - 1].Destino;
    exigir(calculada.Noches === (fin === 'BASE' ? 0 : 1), nombre + ': la pernoctación debe coincidir con el lugar donde termina la jornada.');
    j.Tecnicos.concat([j.ID_Vehiculo]).forEach(function (id) {
      var anterior = recursos[id];
      exigir(!anterior || anterior.Fecha !== j.Fecha, nombre + ': ' + id + ' ya está ocupado en ' + (anterior || {}).ID_Jornada + ' ese día.');
      var ubicacion = anterior ? anterior.fin : 'BASE';
      exigir(inicio === ubicacion, nombre + ': ' + id + ' está en ' + ubicacion + ', pero la ruta comienza en ' + inicio + '. Respeta la salida, la llegada y el retorno.');
      if (anterior && ubicacion !== 'BASE') {
        exigir((new Date(j.Fecha + 'T12:00:00Z') - new Date(anterior.Fecha + 'T12:00:00Z')) / 86400000 === 1, nombre + ': dejaría días fuera de base sin alojamiento ni jornada planificada.');
      }
      recursos[id] = { Fecha: j.Fecha, fin: fin, ID_Jornada: nombre };
    });
    j.Tecnicos.forEach(function (id) {
      var clave = id + ':' + semanaDe(j.Fecha);
      horasSemana[clave] = (horasSemana[clave] || 0) + calculada.Horas_Extra_Brutas;
      exigir(horasSemana[clave] <= e.parametros.P_HORAS_EXTRA_SEMANA + 1e-8, id + ': supera las horas extra de la semana del ' + semanaDe(j.Fecha) + '.');
    });
  });
  Object.keys(recursos).forEach(function (id) { exigir(recursos[id].fin === 'BASE', id + ': el itinerario termina fuera de base. Debes mantener su jornada de retorno.'); });
}
function motivoInicio(e, orden) {
  if (!orden) { return 'Orden inexistente.'; }
  var j = e.jornadas.filter(function (j) { return j.ID_Jornada === orden.ID_Jornada; })[0];
  if (!j) { return 'Falta la jornada de esta orden.'; }
  if (e.flota.some(function (v) { return v.ID_Vehiculo === j.ID_Vehiculo && v.Estado === 'Taller'; })) { return 'El vehículo está en taller. El coordinador debe reasignarlo antes de iniciar.'; }
  var previas = e.jornadas.filter(function (x) {
    return x.Fecha < j.Fecha && (x.ID_Vehiculo === j.ID_Vehiculo || x.Tecnicos.some(function (t) { return j.Tecnicos.indexOf(t) !== -1; }));
  });
  for (var i = 0; i < previas.length; i++) {
    if (e.ordenes.some(function (o) { return o.ID_Jornada === previas[i].ID_Jornada && !o.Hora_Fin; })) {
      return 'Primero completa ' + previas[i].ID_Jornada + ' (' + previas[i].Fecha + '). No puedes iniciar una etapa posterior ni retornar antes de salir.';
    }
  }
  if (e.ordenes.some(function (o) { return o.ID_Tecnico === orden.ID_Tecnico && o.ID_Orden !== orden.ID_Orden && o.Hora_Inicio && !o.Hora_Fin; })) { return 'Ya tienes otra orden en curso.'; }
  try { validarPlanOperativo(e); } catch (err) { return err.message; }
  return '';
}
function validarEntradaTrabajo(c, p) {
  ['empresa', 'direccion', 'numero', 'cliente', 'mail'].forEach(function (k) { exigir(typeof c[k] === 'string' && c[k].trim(), 'Completa el campo ' + k + '.'); });
  exigir(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.mail), 'El correo del cliente no es válido.');
  exigir(REGIONES[c.region] && REGIONES[c.region].indexOf(c.comuna) !== -1, 'La comuna no pertenece a la región seleccionada.');
  exigir(diaHabil(c.fecha), 'Selecciona una fecha válida de lunes a viernes.');
  exigir(Number.isSafeInteger(c.equipos) && c.equipos > 0, 'La cantidad de equipos debe ser un entero positivo.');
  exigir(Number.isFinite(c.km) && c.km > 0 && Number.isSafeInteger(c.peaje) && c.peaje >= 0, 'Ingresa kilómetros mayores que cero y peajes enteros no negativos.');
  var n = Array.isArray(c.tecnicos) ? c.tecnicos.length : c.tecnicos;
  exigir(Number.isInteger(n) && n > 0 && n <= p.P_CAPACIDAD_CAMIONETA, 'La dotación debe estar entre 1 y ' + p.P_CAPACIDAD_CAMIONETA + '.');
  exigir(['Isla de Pascua', 'Juan Fernández', 'Antártica'].indexOf(c.comuna) === -1, 'Este destino necesita transporte especial; no puede confirmarse como un viaje terrestre desde la base.');
}
/* Mismo constructor para simulación y escritura: no se ignoran km ni peajes editados. */
function prepararTrabajo(c, e) {
  validarEntradaTrabajo(c, e.parametros);
  exigir(e.flota.some(function (v) { return v.ID_Vehiculo === c.vehiculo && v.Estado !== 'Taller'; }), 'El vehículo no existe o está en taller.');
  exigir(!e.trabajos.some(function (t) { return t.Fecha === c.fecha && t.Comuna === c.comuna && t.Empresa === c.empresa.trim() && t.Direccion === c.direccion.trim() + ' ' + c.numero.trim() && t.Equipos === c.equipos; }), 'Ya existe este trabajo para el mismo cliente, dirección y fecha. Revisa las órdenes antes de duplicarlo.');
  var d = { ID_Destino: 'D' + pad2(e.consecutivos.destino + 1), Comuna: c.comuna, Region: c.region,
    Direccion: c.direccion.trim() + ' ' + c.numero.trim() + ', ' + c.comuna, En_RM: esRegionRM(c.region), Corredor: c.corredor,
    Km_Ida: c.km, Peaje_Ida: c.peaje, Equipos: c.equipos, Lat: null, Lng: null,
    Empresa: c.empresa.trim(), Contacto: c.cliente.trim(), Mail_Cliente: c.mail.trim(), Link_Enviado: false,
    Origen_Dato: 'Ingresado por coordinador', Hotel_Referencia: 'Por confirmar' };
  var horasIda = c.km / velocidadCorredor(c.corredor, e.parametros) * e.parametros.P_FACTOR_HORAS;
  exigir(horasIda <= e.parametros.P_TOPE_CONDUCCION, 'La ida supera el máximo de conducción. Define una escala y sus kilómetros antes de agendar este destino.');
  var horasSitio = c.equipos * e.parametros.P_T_INSTALACION / c.tecnicos.length + e.parametros.P_T_CAPACITACION;
  exigir(horasSitio <= e.parametros.P_TOPE_DIA, 'La instalación requiere varios días en sitio. Divide la cantidad de equipos en órdenes separadas.');
  var tramosDia = [], pernocta = horasIda > e.parametros.P_UMBRAL_PERNOCTA || 2 * horasIda + horasSitio > e.parametros.P_TOPE_DIA || 2 * horasIda > e.parametros.P_TOPE_CONDUCCION;
  function tramo(a, b, km, peaje, equipos, noches) { return { Origen: a, Destino: b, Km: km, Peaje: peaje, Equipos: equipos, Noches: noches, Corredor: c.corredor }; }
  if (!pernocta) { tramosDia.push([tramo('BASE', d.ID_Destino, c.km, c.peaje, c.equipos, 0), tramo(d.ID_Destino, 'BASE', c.km, c.peaje, 0, 0)]); }
  else {
    var instalaIda = horasIda + horasSitio <= e.parametros.P_TOPE_DIA;
    tramosDia.push([tramo('BASE', d.ID_Destino, c.km, c.peaje, instalaIda ? c.equipos : 0, 1)]);
    if (!instalaIda) { tramosDia.push([tramo(d.ID_Destino, d.ID_Destino, 0, 0, c.equipos, 1)]); }
    tramosDia.push([tramo(d.ID_Destino, 'BASE', c.km, c.peaje, 0, 0)]);
  }
  var jornadas = tramosDia.map(function (tramos, i) {
    var dia = new Date(c.fecha + 'T12:00:00Z'); dia.setUTCDate(dia.getUTCDate() + i);
    var fecha = dia.toISOString().slice(0, 10);
    exigir(diaHabil(fecha), 'El viaje cruza un fin de semana: elige una salida que permita completar ida, trabajo y retorno en días hábiles.');
    return { ID_Jornada: 'J' + pad2(e.consecutivos.jornada + i + 1), Dia: 0, Fecha: fecha, ID_Vehiculo: c.vehiculo, Tecnicos: c.tecnicos.slice(), Conductor: c.conductor, Tramos: tramos };
  });
  var copia = JSON.parse(JSON.stringify(e)); copia.destinos.push(d); copia.jornadas = copia.jornadas.concat(jornadas);
  validarPlanOperativo(copia);
  return { destino: d, jornadas: jornadas, plan: recalcularPlan(copia) };
}

function validarAccion(accion, c, e) {
  if (accion === 'pagarReembolso') { exigir(sesion.rol === 'supervisor', 'El reembolso corresponde al supervisor.'); }
  var roles = { crearTrabajo: 'coordinador', asignar: 'coordinador', moverJornada: 'coordinador', estadoVehiculo: 'coordinador', enviarCapacitacion: 'coordinador', revisarGasto: 'supervisor', marcarPago: 'supervisor', pagarTodo: 'supervisor', parametro: 'supervisor', restaurarParametros: 'supervisor', marcarChecklist: 'tecnico', iniciarTrabajo: 'tecnico', finalizarTrabajo: 'tecnico', agregarGasto: 'tecnico' };
  if (sesion.rol && roles[accion]) { exigir(sesion.rol === roles[accion], 'Esta acción corresponde al rol ' + roles[accion] + '.'); }
  var o = e.ordenes.filter(function (o) { return o.ID_Orden === c.idOrden; })[0];
  if (roles[accion] === 'tecnico') {
    exigir(o && (!sesion.idTecnico || o.ID_Tecnico === sesion.idTecnico), 'La orden no pertenece al técnico seleccionado.');
  }
  if (accion === 'moverJornada' || accion === 'asignar') {
    exigir(e.jornadas.some(function (j) { return j.ID_Jornada === c.idJornada; }), 'Jornada inexistente.');
    exigir(!jornadaProtegida(e, c.idJornada), 'No puedes reprogramar ni reasignar una jornada con checklist, ejecución o rendiciones registradas.');
  }
  if (accion === 'asignar') { exigir(e.flota.some(function (v) { return v.ID_Vehiculo === c.vehiculo && v.Estado !== 'Taller'; }), 'El vehículo no existe o está en taller.'); }
  if (accion === 'iniciarTrabajo') {
    exigir(!o.Hora_Inicio && checklistCompleto(o), 'Completa el checklist antes de iniciar; una orden no se inicia dos veces.');
    var motivo = motivoInicio(e, o); exigir(!motivo, motivo);
  }
  if (accion === 'marcarChecklist') { exigir(!o.Hora_Inicio, 'El checklist queda protegido al iniciar.'); }
  if (accion === 'finalizarTrabajo') {
    exigir(o.Hora_Inicio && !o.Hora_Fin, 'Debes iniciar la orden antes de cerrarla; un cierre no se repite.');
    exigir(Number.isFinite(new Date(o.Hora_Inicio).getTime()) && new Date(o.Hora_Inicio).getTime() <= Date.now(), 'La hora de inicio es inválida o está en el futuro. Revisa el reloj antes de cerrar.');
    var j = calcularJornada(e.jornadas.filter(function (j) { return j.ID_Jornada === o.ID_Jornada; })[0], e);
    exigir(Number.isInteger(c.equipos) && c.equipos >= 0 && c.equipos <= j.Equipos, 'Cantidad instalada fuera del rango de la jornada.');
    exigir(!j.Equipos || (c.foto && c.firma), 'Agrega foto y firma de la instalación.');
    var cerrada = e.ordenes.filter(function (x) { return x.ID_Jornada === o.ID_Jornada && x.Hora_Fin; })[0];
    exigir(!cerrada || cerrada.Equipos_Instalados === c.equipos, 'El total de la cuadrilla debe coincidir con el cierre ya registrado: ' + (cerrada || {}).Equipos_Instalados + ' equipos.');
  }
  if (accion === 'agregarGasto') {
    exigir(c.idTecnico === o.ID_Tecnico && Number.isSafeInteger(c.monto) && c.monto > 0 && c.comprobante, 'El gasto requiere propietario correcto, monto entero positivo y comprobante.');
    exigir(['Viático', 'Colación', 'Peaje', 'Combustible', 'Hotel', 'Otro'].indexOf(c.tipo) !== -1, 'Tipo de gasto inválido.');
    exigir(!e.gastos.some(function (g) { return g.Comprobante === c.comprobante && g.ID_Tecnico === c.idTecnico; }), 'Este comprobante ya fue registrado.');
  }
  if (accion === 'revisarGasto') {
    var g = e.gastos.filter(function (g) { return g.ID_Gasto === c.idGasto; })[0];
    exigir(g && g.Estado === 'Pendiente', 'Solo se revisan rendiciones pendientes.');
    exigir(c.estado === 'Aprobado' || c.estado === 'Rechazado', 'Estado de revisión inválido.');
    exigir(c.estado !== 'Aprobado' || g.Comprobante, 'No puedes aprobar una rendición sin comprobante.');
  }
  if (accion === 'parametro') { exigir(PARAMETROS_EDITABLES.some(function (p) { return p.codigo === c.codigo; }), 'Parámetro no editable.'); }
  if (accion === 'estadoVehiculo') {
    exigir(['Disponible', 'Reserva', 'Taller'].indexOf(c.estado) !== -1, 'Estado de vehículo inválido.');
    exigir(!e.jornadas.some(function (j) { return j.ID_Vehiculo === c.idVehiculo && e.ordenes.some(function (o) { return o.ID_Jornada === j.ID_Jornada && o.Hora_Inicio && !o.Hora_Fin; }); }), 'No puedes cambiar el estado de un vehículo que está en ruta.');
  }
  if (accion === 'enviarCapacitacion') {
    exigir(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.mail || ''), 'Correo inválido.');
    exigir(!e.ordenes.some(function (o) { var j = e.jornadas.find(function (j) { return j.ID_Jornada === o.ID_Jornada; }); return o.Hora_Inicio && j.Tramos.some(function (t) { return t.Destino === c.idDestino && t.Equipos > 0; }); }), 'La capacitación previa no puede modificar una instalación ya iniciada.');
    exigir(!e.correos.some(function (x) { return x.ID_Destino === c.idDestino && x.Para === c.mail && x.Link === c.link; }), 'La capacitación ya está registrada para ese destinatario.');
  }
}
