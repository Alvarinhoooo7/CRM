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
  if (!e.gastos) { e.gastos = []; }
  if (!e.correos) { e.correos = []; }
  if (!e.trabajos) { e.trabajos = []; }
  if (!e.consecutivos) { e.consecutivos = { jornada: e.jornadas.length, orden: e.ordenes.length, gasto: 0, correo: 0, destino: e.destinos.length }; }
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
}

function suscribir(fn) { suscriptores.push(fn); }

function notificar() {
  suscriptores.forEach(function (fn) { fn(estado, plan); });
}

/* Punto unico de escritura. Recalcula, guarda y redibuja las tres vistas. */
function despachar(accion, carga) {
  var resultado = ACCIONES[accion] ? ACCIONES[accion](carga) : null;
  recalcular();
  persistir();
  notificar();
  return resultado;
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
    if (!orden) { return; }
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
    orden.Coord_Inicio = c.coordenadas || null;
    orden.Estado = 'En curso';
  },

  finalizarTrabajo: function (c) {
    var orden = buscarOrden(c.idOrden);
    if (!orden || !orden.Hora_Inicio || orden.Hora_Fin) { return; }
    orden.Hora_Fin = new Date().toISOString();
    orden.Coord_Fin = c.coordenadas || null;
    orden.Equipos_Instalados = c.equipos || 0;
    orden.Firma = c.firma || null;
    orden.Foto = c.foto || null;
    orden.Observaciones = c.observaciones || '';
    orden.Estado = 'Cerrada';
  },

  agregarGasto: function (c) {
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
    estado.pagos[c.idTecnico] = !estado.pagos[c.idTecnico];
  },

  pagarTodo: function () {
    plan.nomina.forEach(function (n) {
      if (n.Total > 0) { estado.pagos[n.ID_Tecnico] = true; }
    });
  },

  /* --- Coordinador --- */

  crearTrabajo: function (c) {
    /* Reutiliza el destino si ya existe esa comuna; si no, lo crea con los datos del formulario. */
    var destino = estado.destinos.filter(function (d) { return d.Comuna === c.comuna; })[0];
    if (!destino) {
      estado.consecutivos.destino++;
      destino = {
        ID_Destino: 'D' + pad2(estado.consecutivos.destino),
        Comuna: c.comuna,
        Region: c.region,
        Direccion: c.direccion + ' ' + c.numero + ', ' + c.comuna,
        En_RM: c.region === 'Metropolitana',
        Corredor: c.corredor,
        Km_Ida: c.km,
        Peaje_Ida: c.peaje,
        Equipos: 0,
        Hotel_Referencia: c.km > 300 ? 'Centro de ' + c.comuna : 'Retorno en el día',
        Lat: c.lat,
        Lng: c.lng,
        Empresa: c.empresa,
        Contacto: c.cliente,
        Mail_Cliente: c.mail,
        Link_Enviado: false
      };
      estado.destinos.push(destino);
    } else {
      destino.Empresa = c.empresa;
      destino.Contacto = c.cliente;
      destino.Mail_Cliente = c.mail;
      destino.Direccion = c.direccion + ' ' + c.numero + ', ' + c.comuna;
    }
    destino.Equipos += c.equipos;

    estado.consecutivos.jornada++;
    var idJornada = 'J' + pad2(estado.consecutivos.jornada);
    var pernocta = (destino.Km_Ida / 80) * estado.parametros.P_FACTOR_HORAS > estado.parametros.P_UMBRAL_PERNOCTA;
    var jornada = {
      ID_Jornada: idJornada,
      Dia: 0,
      Fecha: c.fecha,
      ID_Vehiculo: c.vehiculo,
      Tecnicos: c.tecnicos.slice(),
      Conductor: c.conductor,
      Tramos: [
        { Origen: 'BASE', Destino: destino.ID_Destino, Km: destino.Km_Ida, Peaje: destino.Peaje_Ida, Equipos: c.equipos, Noches: pernocta ? 1 : 0, Corredor: destino.Corredor },
        { Origen: destino.ID_Destino, Destino: 'BASE', Km: destino.Km_Ida, Peaje: destino.Peaje_Ida, Equipos: 0, Noches: 0, Corredor: destino.Corredor }
      ]
    };
    estado.jornadas.push(jornada);

    c.tecnicos.forEach(function (idTecnico) {
      estado.consecutivos.orden++;
      estado.ordenes.push({
        ID_Orden: 'O' + pad4(estado.consecutivos.orden),
        ID_Jornada: idJornada,
        ID_Tecnico: idTecnico,
        Es_Conductor: idTecnico === c.conductor,
        Fecha: c.fecha,
        Estado: 'Planificada',
        Checklist: estado.implementos.map(function (im) {
          return { ID_Implemento: im.ID_Implemento, Marcado: false, Hora: null };
        }),
        Hora_Inicio: null, Hora_Fin: null, Coord_Inicio: null, Coord_Fin: null,
        Equipos_Instalados: 0, Firma: null, Foto: null, Observaciones: ''
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
      Estado: 'Enviado'
    });
  }
};
