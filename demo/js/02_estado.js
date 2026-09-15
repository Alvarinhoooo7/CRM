/* ESTADO COMPARTIDO. Un solo store para las tres vistas.
   Ninguna vista escribe aqui directamente: todas pasan por despachar(). */

var CLAVE_ALMACEN = 'crm-ruta-demo-v2';

/* localStorage sobre file:// se comporta distinto segun navegador y configuracion.
   Si falla, se cae a memoria y la demo sigue funcionando: solo se pierde el F5. */
var almacen = (function () {
  var memoria = null;
  var disponible = false;
  try {
    window.localStorage.setItem('__prueba__', '1');
    window.localStorage.removeItem('__prueba__');
    disponible = true;
  } catch (e) {
    disponible = false;
  }
  return {
    disponible: function () { return disponible; },
    leer: function () {
      if (!disponible) { return memoria; }
      try { return window.localStorage.getItem(CLAVE_ALMACEN); } catch (e) { return null; }
    },
    guardar: function (texto) {
      memoria = texto;
      if (!disponible) { return; }
      try { window.localStorage.setItem(CLAVE_ALMACEN, texto); } catch (e) { disponible = false; }
    },
    borrar: function () {
      memoria = null;
      if (!disponible) { return; }
      try { window.localStorage.removeItem(CLAVE_ALMACEN); } catch (e) { /* nada que hacer */ }
    }
  };
}());

var estado = null;
var plan = null;
var suscriptores = [];
var sesion = { rol: null, idTecnico: null };

function clonar(objeto) { return JSON.parse(JSON.stringify(objeto)); }

function completarEstado(e) {
  if (!e.pagos) { e.pagos = {}; }
  if (!e.reembolsos) { e.reembolsos = {}; }
  if (!e.gastos) { e.gastos = []; }
  if (!e.correos) { e.correos = []; }
  if (!e.trabajos) { e.trabajos = []; }
  if (!e.consecutivos) { e.consecutivos = { jornada: e.jornadas.length, orden: e.ordenes.length, gasto: 0, correo: 0, destino: e.destinos.length }; }
  var anterior = recalcularPlan(e);
  anterior.nomina.forEach(function (n) {
    if (e.pagos[n.ID_Tecnico] === true) { e.pagos[n.ID_Tecnico] = { Monto: n.Total, Fecha: null, Origen: 'Convertido desde registro anterior' }; }
  });
  return e;
}

function cargarEstado() {
  var guardado = almacen.leer();
  if (guardado) {
    try {
      estado = completarEstado(JSON.parse(guardado));
      recalcular();
      return;
    } catch (err) {
      /* Estado corrupto de una version anterior: se descarta y se parte de la semilla. */
      almacen.borrar();
    }
  }
  estado = completarEstado(construirSemilla());
  recalcular();
  persistir();
}

function persistir() {
  almacen.guardar(JSON.stringify(estado));
}

function recalcular() {
  plan = recalcularPlan(estado);
  try { validarPlanOperativo(estado); }
  catch (err) { plan.alertas.unshift({ nivel: 'alto', origen: 'Validación del plan', fecha: '', texto: err.message }); }
}

function suscribir(fn) { suscriptores.push(fn); }

function notificar() {
  suscriptores.forEach(function (fn) { fn(estado, plan); });
}

/* Punto unico de escritura. Recalcula, guarda y redibuja las tres vistas. */
function despachar(accion, carga) {
  var original = estado;
  ultimoError = '';
  try {
    exigir(!!ACCIONES[accion], 'Acción inexistente.');
    validarAccion(accion, carga || {}, estado);
    estado = clonar(estado);
    var resultado = ACCIONES[accion](carga || {});
    if (['moverJornada', 'asignar', 'crearTrabajo', 'parametro', 'restaurarParametros'].indexOf(accion) !== -1) { validarPlanOperativo(estado); }
    recalcular();
  } catch (err) {
    estado = original;
    ultimoError = err.message;
    if (typeof alertaSuave === 'function') { alertaSuave(ultimoError, 'alerta'); }
    return null;
  }
  persistir();
  notificar();
  return resultado === undefined ? true : resultado;
}

function buscarOrden(idOrden) {
  return estado.ordenes.filter(function (o) { return o.ID_Orden === idOrden; })[0];
}
function buscarJornada(idJornada) {
  return estado.jornadas.filter(function (j) { return j.ID_Jornada === idJornada; })[0];
}
function buscarDestino(idDestino) {
  return estado.destinos.filter(function (d) { return d.ID_Destino === idDestino; })[0];
}
function buscarTecnico(idTecnico) {
  return estado.tecnicos.filter(function (t) { return t.ID_Tecnico === idTecnico; })[0];
}

/* --- Utilidades de interfaz compartidas por las tres vistas --- */

var DIAS_CORTOS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
var MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/* Todo texto de origen humano pasa por aqui antes de entrar al DOM. */
function esc(texto) {
  return String(texto === null || texto === undefined ? '' : texto)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function el(selector, raiz) { return (raiz || document).querySelector(selector); }
function todos(selector, raiz) {
  return Array.prototype.slice.call((raiz || document).querySelectorAll(selector));
}

function fechaDesdeISO(iso) {
  var p = String(iso).split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12);
}

function fechaCorta(iso) {
  if (!iso) { return '—'; }
  var f = fechaDesdeISO(iso);
  return DIAS_CORTOS[f.getDay()] + ' ' + f.getDate() + ' ' + MESES_CORTOS[f.getMonth()];
}

function fechaLarga(iso) {
  if (!iso) { return '—'; }
  var f = fechaDesdeISO(iso);
  return DIAS_CORTOS[f.getDay()] + ' ' + f.getDate() + ' de ' + MESES_CORTOS[f.getMonth()] + ' ' + f.getFullYear();
}

function horaCorta(marca) {
  if (!marca) { return '—'; }
  var f = new Date(marca);
  return pad2(f.getHours()) + ':' + pad2(f.getMinutes());
}

function porcentaje(n) { return Math.round((n || 0) * 100) + '%'; }

var ACCIONES = {

  reiniciar: function () {
    estado = completarEstado(construirSemilla());
    if (typeof cargarEscenarioFinanciero === 'function') { cargarEscenarioFinanciero(estado); }
  },

  parametro: function (c) {
    var base = {};
    PARAMETROS_EDITABLES.forEach(function (pe) { base[pe.codigo] = estado.parametros[pe.codigo]; });
    var crudos = {};
    for (var k in PARAMETROS_BASE) { if (PARAMETROS_BASE.hasOwnProperty(k)) { crudos[k] = estado.parametros[k]; } }
    crudos[c.codigo] = c.valor;
    estado.parametros = derivarParametros(crudos);
  },

  restaurarParametros: function () {
    estado.parametros = derivarParametros(PARAMETROS_BASE);
  },

  /* --- Tecnico --- */

  marcarChecklist: function (c) {
    var orden = buscarOrden(c.idOrden);
    if (!orden || orden.Hora_Inicio) { return; }
    orden.Checklist.forEach(function (item) {
      if (item.ID_Implemento === c.idImplemento) {
        item.Marcado = c.marcado;
        item.Hora = c.marcado ? new Date().toISOString() : null;
      }
    });
    if (checklistCompleto(orden) && orden.Estado === 'Planificada') {
      orden.Estado = 'Lista';
    } else if (!checklistCompleto(orden) && orden.Estado === 'Lista') {
      orden.Estado = 'Planificada';
    }
  },

  iniciarTrabajo: function (c) {
    var orden = buscarOrden(c.idOrden);
    if (!orden || !checklistCompleto(orden) || orden.Hora_Inicio) { return; }
    orden.Hora_Inicio = new Date().toISOString();
    orden.Horas_Plan_Inicio = plan.jornadasPorId[orden.ID_Jornada].Horas_Totales;
    orden.Coord_Inicio = c.coordenadas || null;
    orden.Estado = 'En curso';
  },

  finalizarTrabajo: function (c) {
    var orden = buscarOrden(c.idOrden);
    if (!orden || !orden.Hora_Inicio || orden.Hora_Fin) { return; }
    var jornada = plan.jornadasPorId[orden.ID_Jornada];
    if (!jornada || !Number.isInteger(c.equipos) || c.equipos < 0 || c.equipos > jornada.Equipos) { return; }
    if (jornada.Equipos > 0 && (!c.firma || !c.foto)) { return; }
    orden.Hora_Fin = new Date().toISOString();
    orden.Coord_Fin = c.coordenadas || null;
    orden.Equipos_Instalados = c.equipos || 0;
    orden.Firma = c.firma || null;
    orden.Foto = c.foto || null;
    orden.Observaciones = c.observaciones || '';
    orden.Estado = 'Cerrada';
  },

  agregarGasto: function (c) {
    var orden = buscarOrden(c.idOrden);
    if (!orden || orden.ID_Tecnico !== c.idTecnico || !Number.isSafeInteger(c.monto) || c.monto <= 0 || !c.comprobante) { return; }
    estado.consecutivos.gasto++;
    estado.gastos.push({
      ID_Gasto: 'G' + pad4(estado.consecutivos.gasto),
      ID_Orden: c.idOrden,
      ID_Tecnico: c.idTecnico,
      Fecha: new Date().toISOString().slice(0, 10),
      Tipo: c.tipo,
      Monto: Number(c.monto) || 0,
      Comprobante: c.comprobante || null,
      Emergencia: !!c.emergencia,
      Estado: 'Pendiente',
      Comentario: ''
    });
  },

  /* --- Supervisor --- */

  revisarGasto: function (c) {
    estado.gastos.forEach(function (g) {
      if (g.ID_Gasto === c.idGasto) {
        g.Estado = c.estado;
        g.Comentario = c.comentario || '';
      }
    });
  },

  marcarPago: function (c) {
    var n = plan.nomina.find(function (n) { return n.ID_Tecnico === c.idTecnico; });
    exigir(n, 'Técnico inexistente.');
    exigir(n.Por_Transferir > 0, 'No hay anticipo pendiente para este técnico.');
    estado.pagos[c.idTecnico] = { Monto: n.Transferido + n.Por_Transferir, Fecha: new Date().toISOString() };
  },

  pagarTodo: function () {
    plan.nomina.forEach(function (n) {
      if (n.Por_Transferir > 0) { estado.pagos[n.ID_Tecnico] = { Monto: n.Transferido + n.Por_Transferir, Fecha: new Date().toISOString() }; }
    });
  },

  pagarReembolso: function (c) {
    var n = plan.nomina.find(function (n) { return n.ID_Tecnico === c.idTecnico; });
    exigir(n && n.Por_Reembolsar > 0, 'No hay rendiciones aprobadas pendientes de reembolso.');
    estado.reembolsos[c.idTecnico] = { Monto: n.Reembolsado + n.Por_Reembolsar, Fecha: new Date().toISOString() };
  },

  /* --- Coordinador --- */

  crearTrabajo: function (c) {
    var preparado = prepararTrabajo(c, estado);
    estado.destinos.push(preparado.destino);
    estado.consecutivos.destino++;
    var idJornada = preparado.jornadas[0].ID_Jornada;
    preparado.jornadas.forEach(function (jornada) {
      estado.jornadas.push(jornada);
      estado.consecutivos.jornada++;
      jornada.Tecnicos.forEach(function (idTecnico) {
        estado.consecutivos.orden++;
        estado.ordenes.push({
          ID_Orden: 'O' + pad4(estado.consecutivos.orden), ID_Jornada: jornada.ID_Jornada,
          ID_Tecnico: idTecnico, Es_Conductor: idTecnico === jornada.Conductor, Fecha: jornada.Fecha,
          Estado: 'Planificada', Checklist: estado.implementos.map(function (im) {
            return { ID_Implemento: im.ID_Implemento, Marcado: false, Hora: null };
          }), Hora_Inicio: null, Hora_Fin: null, Coord_Inicio: null, Coord_Fin: null,
          Equipos_Instalados: 0, Firma: null, Foto: null, Observaciones: ''
        });
      });
    });

    estado.trabajos.push({
      Empresa: c.empresa, Comuna: c.comuna, Region: c.region,
      Direccion: c.direccion + ' ' + c.numero, Cliente: c.cliente, Mail: c.mail,
      Equipos: c.equipos, Fecha: c.fecha, ID_Jornada: idJornada,
      Creado: new Date().toISOString()
    });

    return idJornada;
  },

  asignar: function (c) {
    var jornada = buscarJornada(c.idJornada);
    if (!jornada) { return; }
    var antes = jornada.Tecnicos.slice();
    jornada.Tecnicos = c.tecnicos.slice();
    jornada.Conductor = c.conductor;
    if (c.vehiculo) { jornada.ID_Vehiculo = c.vehiculo; }

    /* Las ordenes siguen al equipo: se borran las de quien salio y se crean las de quien entro. */
    estado.ordenes = estado.ordenes.filter(function (o) {
      return o.ID_Jornada !== c.idJornada || c.tecnicos.indexOf(o.ID_Tecnico) !== -1;
    });
    c.tecnicos.forEach(function (idTecnico) {
      var existe = estado.ordenes.filter(function (o) {
        return o.ID_Jornada === c.idJornada && o.ID_Tecnico === idTecnico;
      })[0];
      if (existe) {
        existe.Es_Conductor = idTecnico === c.conductor;
        return;
      }
      estado.consecutivos.orden++;
      estado.ordenes.push({
        ID_Orden: 'O' + pad4(estado.consecutivos.orden),
        ID_Jornada: c.idJornada,
        ID_Tecnico: idTecnico,
        Es_Conductor: idTecnico === c.conductor,
        Fecha: jornada.Fecha,
        Estado: 'Planificada',
        Checklist: estado.implementos.map(function (im) {
          return { ID_Implemento: im.ID_Implemento, Marcado: false, Hora: null };
        }),
        Hora_Inicio: null, Hora_Fin: null, Coord_Inicio: null, Coord_Fin: null,
        Equipos_Instalados: 0, Firma: null, Foto: null, Observaciones: ''
      });
    });
    return antes;
  },

  moverJornada: function (c) {
    var jornada = buscarJornada(c.idJornada);
    if (!jornada) { return; }
    jornada.Fecha = c.fecha;
    estado.trabajos.forEach(function (t) { if (t.ID_Jornada === c.idJornada) { t.Fecha = c.fecha; } });
    estado.ordenes.forEach(function (o) {
      if (o.ID_Jornada === c.idJornada) { o.Fecha = c.fecha; }
    });
  },

  estadoVehiculo: function (c) {
    estado.flota.forEach(function (v) {
      if (v.ID_Vehiculo === c.idVehiculo) { v.Estado = c.estado; }
    });
  },

  enviarCapacitacion: function (c) {
    var destino = buscarDestino(c.idDestino);
    if (!destino) { return; }
    destino.Mail_Cliente = c.mail;
    destino.Link_Enviado = true;
    estado.consecutivos.correo++;
    estado.correos.push({
      ID_Correo: 'C' + pad4(estado.consecutivos.correo),
      ID_Destino: c.idDestino,
      Comuna: destino.Comuna,
      Para: c.mail,
      Asunto: c.asunto,
      Cuerpo: c.cuerpo,
      Link: c.link,
      Enviado: new Date().toISOString(),
      Estado: 'Registrado'
    });
  }
};
