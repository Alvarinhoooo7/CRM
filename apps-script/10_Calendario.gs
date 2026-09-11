/**
 * ============================================================================
 *  10_Calendario.gs  ·  Calendario semanal, materiales y capacitaciones.
 * ============================================================================
 *  El calendario es la vista que responde "que hizo, que esta haciendo y que
 *  tiene pendiente" un tecnico o el grupo completo. Se construye fusionando
 *  tres fuentes: tramos de viaje, ordenes de trabajo y bloques de colacion,
 *  de modo que la suma de duraciones del dia sea la jornada real.
 * ============================================================================
 */

var BLOQUES = {
  VIAJE: 'VIAJE',
  SERVICIO: 'SERVICIO',
  COLACION: 'COLACION',
  DESCANSO: 'DESCANSO',
  DISPONIBLE: 'DISPONIBLE'
};

/** Reconstruye la hoja CALENDARIO para una semana. */
function construirCalendario(semana) {
  semana = semana || cfg('SEMANA_PLANIFICACION');
  dbEliminar(SH.CALENDARIO, { SEMANA: semana });

  var ot = dbLeer(SH.OT).filter(function (o) {
    return o.FECHA && semanaISO(new Date(o.FECHA)) === semana;
  });
  var tramos = dbLeer(SH.ITINERARIO).filter(function (t) {
    return t.FECHA && semanaISO(new Date(t.FECHA)) === semana;
  });
  var cuadrillas = indexarPor(dbLeer(SH.CUADRILLAS), 'CUADRILLA_ID');
  var tecnicos = indexarPor(dbLeer(SH.TECNICOS), 'TECNICO_ID');

  var filas = [];

  // --- Bloques de servicio ----------------------------------------------
  ot.forEach(function (o) {
    var ini = new Date(o.HORA_INICIO_PLAN);
    var fin = new Date(o.HORA_FIN_PLAN);
    filas.push({
      SEMANA: semana,
      FECHA: aMedianoche(ini),
      DIA: DIAS_LARGO[ini.getDay()],
      TECNICO_ID: o.TECNICO_ID,
      TECNICO: o.TECNICO_NOMBRE,
      CUADRILLA_ID: o.CUADRILLA_ID,
      BLOQUE: BLOQUES.SERVICIO,
      HORA_INICIO: ini,
      HORA_FIN: fin,
      DURACION_H: redondear(difHoras(ini, fin), 2),
      DETALLE: 'Instalacion de ' + o.EQUIPOS + ' equipo(s)' +
               (o.CAPACITACION_MODO === 'PRESENCIAL' ? ' + capacitacion presencial' : ' (capacitacion por video)'),
      UBICACION: o.COMUNA,
      REFERENCIA_ID: o.OT_ID,
      ESTADO: o.ESTADO
    });
  });

  // --- Bloques de viaje: se replican para cada tecnico de la cuadrilla ---
  tramos.forEach(function (t) {
    var c = cuadrillas[t.CUADRILLA_ID];
    if (!c) return;
    var ids = String(c.TECNICOS_IDS || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var ini = new Date(t.HORA_SALIDA);
    var fin = new Date(t.HORA_LLEGADA);
    ids.forEach(function (id) {
      var tec = tecnicos[id];
      filas.push({
        SEMANA: semana,
        FECHA: aMedianoche(ini),
        DIA: DIAS_LARGO[ini.getDay()],
        TECNICO_ID: id,
        TECNICO: tec ? tec.NOMBRE : id,
        CUADRILLA_ID: t.CUADRILLA_ID,
        BLOQUE: BLOQUES.VIAJE,
        HORA_INICIO: ini,
        HORA_FIN: fin,
        DURACION_H: redondear(difHoras(ini, fin), 2),
        DETALLE: t.ORIGEN_NOMBRE + ' -> ' + t.DESTINO_NOMBRE + ' en ' + t.MODO +
                 ' (' + t.KM + ' km, ' + clp(t.COSTO_TOTAL) + ')',
        UBICACION: t.DESTINO_NOMBRE,
        REFERENCIA_ID: t.TRAMO_ID,
        ESTADO: 'PLANIFICADO'
      });
    });
  });

  // --- Colaciones: una por tecnico y dia con actividad -------------------
  var porTecnicoDia = agruparPor(filas, function (f) {
    return f.TECNICO_ID + '|' + isoFecha(f.FECHA);
  });
  Object.keys(porTecnicoDia).forEach(function (clave) {
    var bloques = porTecnicoDia[clave];
    var dia = new Date(bloques[0].FECHA);
    var desde = enFechaHora(dia, cfg('VENTANA_COLACION_DESDE'));
    var jornadaInicio = bloques.reduce(function (m, b) {
      var i = new Date(b.HORA_INICIO); return (!m || i < m) ? i : m;
    }, null);
    var jornadaFin = bloques.reduce(function (m, b) {
      var f = new Date(b.HORA_FIN); return (!m || f > m) ? f : m;
    }, null);
    if (!jornadaInicio || difHoras(jornadaInicio, jornadaFin) < 5) return;

    var inicioColacion = desde;
    // La colacion se ubica en el primer hueco de la ventana.
    var ocupados = bloques.map(function (b) {
      return { i: new Date(b.HORA_INICIO), f: new Date(b.HORA_FIN) };
    }).sort(function (a, b) { return a.i - b.i; });
    for (var k = 0; k < ocupados.length; k++) {
      if (inicioColacion >= ocupados[k].i && inicioColacion < ocupados[k].f) {
        inicioColacion = new Date(ocupados[k].f);
      }
    }

    filas.push({
      SEMANA: semana,
      FECHA: aMedianoche(dia),
      DIA: DIAS_LARGO[dia.getDay()],
      TECNICO_ID: bloques[0].TECNICO_ID,
      TECNICO: bloques[0].TECNICO,
      CUADRILLA_ID: bloques[0].CUADRILLA_ID,
      BLOQUE: BLOQUES.COLACION,
      HORA_INICIO: inicioColacion,
      HORA_FIN: sumarMin(inicioColacion, cfgNum('COLACION_MIN')),
      DURACION_H: redondear(cfgNum('COLACION_MIN') / 60, 2),
      DETALLE: 'Colacion de ' + cfgNum('COLACION_MIN') + ' min' +
               (cfgBool('COLACION_IMPUTABLE') ? ' (imputable a la jornada)' : ' (no imputable a la jornada)'),
      UBICACION: bloques[0].UBICACION,
      REFERENCIA_ID: '',
      ESTADO: 'PLANIFICADO'
    });
  });

  filas.sort(function (a, b) {
    if (a.TECNICO_ID !== b.TECNICO_ID) return String(a.TECNICO_ID).localeCompare(String(b.TECNICO_ID));
    return new Date(a.HORA_INICIO) - new Date(b.HORA_INICIO);
  });

  if (filas.length) dbInsertarVarios(SH.CALENDARIO, filas);
  log('INFO', 'Calendario', 'Calendario de ' + semana + ': ' + filas.length + ' bloques.');
  return filas.length;
}

/**
 * Agenda de un tecnico en formato listo para mostrar (web app / AppSheet).
 */
function agendaTecnico(tecnicoId, semana) {
  semana = semana || cfg('SEMANA_PLANIFICACION');
  var bloques = dbBuscar(SH.CALENDARIO, { TECNICO_ID: tecnicoId, SEMANA: semana });
  var porDia = agruparPor(bloques, function (b) { return isoFecha(b.FECHA); });

  var dias = Object.keys(porDia).sort().map(function (iso) {
    var lista = porDia[iso].sort(function (a, b) {
      return new Date(a.HORA_INICIO) - new Date(b.HORA_INICIO);
    });
    var trabajo = lista.filter(function (b) { return b.BLOQUE !== BLOQUES.COLACION; });
    var horasTrabajo = sumarPor(trabajo, 'DURACION_H');
    var horasViaje = sumarPor(trabajo.filter(function (b) { return b.BLOQUE === BLOQUES.VIAJE; }), 'DURACION_H');
    var horasServicio = sumarPor(trabajo.filter(function (b) { return b.BLOQUE === BLOQUES.SERVICIO; }), 'DURACION_H');

    return {
      fecha: iso,
      dia: lista[0].DIA,
      horasTrabajo: redondear(horasTrabajo, 2),
      horasViaje: redondear(horasViaje, 2),
      horasServicio: redondear(horasServicio, 2),
      inicio: hhmm(new Date(lista[0].HORA_INICIO)),
      fin: hhmm(new Date(lista[lista.length - 1].HORA_FIN)),
      bloques: lista.map(function (b) {
        return {
          tipo: b.BLOQUE,
          desde: hhmm(new Date(b.HORA_INICIO)),
          hasta: hhmm(new Date(b.HORA_FIN)),
          horas: Number(b.DURACION_H),
          detalle: b.DETALLE,
          ubicacion: b.UBICACION,
          referencia: b.REFERENCIA_ID,
          estado: b.ESTADO
        };
      })
    };
  });

  var tecnico = dbUno(SH.TECNICOS, { TECNICO_ID: tecnicoId });
  return {
    tecnicoId: tecnicoId,
    nombre: tecnico ? tecnico.NOMBRE : tecnicoId,
    semana: semana,
    dias: dias,
    totalHoras: redondear(dias.reduce(function (a, d) { return a + d.horasTrabajo; }, 0), 2),
    totalViaje: redondear(dias.reduce(function (a, d) { return a + d.horasViaje; }, 0), 2),
    totalServicio: redondear(dias.reduce(function (a, d) { return a + d.horasServicio; }, 0), 2),
    topeLegal: cfgNum('HORAS_SEMANALES_LEGALES')
  };
}

/** Calendario del grupo completo: matriz tecnico x dia. */
function calendarioGrupo(semana) {
  semana = semana || cfg('SEMANA_PLANIFICACION');
  var bloques = dbBuscar(SH.CALENDARIO, { SEMANA: semana });
  var tecnicos = dbLeer(SH.TECNICOS).filter(function (t) { return esSi(t.ACTIVO); });
  var dias = diasDeSemana(semana, cfg('DIAS_HABILES'));

  var matriz = tecnicos.map(function (t) {
    var celdas = dias.map(function (d) {
      var delDia = bloques.filter(function (b) {
        return b.TECNICO_ID === t.TECNICO_ID && mismaFecha(new Date(b.FECHA), d);
      });
      if (!delDia.length) {
        return { fecha: isoFecha(d), estado: 'LIBRE', horas: 0, detalle: 'Disponible en base', ubicaciones: [] };
      }
      var trabajo = delDia.filter(function (b) { return b.BLOQUE !== BLOQUES.COLACION; });
      var ubicaciones = [];
      trabajo.forEach(function (b) {
        if (b.UBICACION && ubicaciones.indexOf(b.UBICACION) < 0) ubicaciones.push(b.UBICACION);
      });
      var servicios = trabajo.filter(function (b) { return b.BLOQUE === BLOQUES.SERVICIO; }).length;
      var horasViaje = sumarPor(trabajo.filter(function (b) { return b.BLOQUE === BLOQUES.VIAJE; }), 'DURACION_H');
      return {
        fecha: isoFecha(d),
        estado: servicios ? 'SERVICIO' : 'VIAJE',
        horas: redondear(sumarPor(trabajo, 'DURACION_H'), 2),
        horasViaje: redondear(horasViaje, 2),
        servicios: servicios,
        detalle: ubicaciones.join(' > '),
        ubicaciones: ubicaciones,
        desde: hhmm(new Date(trabajo[0].HORA_INICIO)),
        hasta: hhmm(new Date(trabajo[trabajo.length - 1].HORA_FIN))
      };
    });
    return {
      tecnicoId: t.TECNICO_ID,
      nombre: t.NOMBRE,
      cargo: t.CARGO,
      celdas: celdas,
      totalHoras: redondear(celdas.reduce(function (a, c) { return a + c.horas; }, 0), 2)
    };
  });

  return {
    semana: semana,
    dias: dias.map(function (d) { return { iso: isoFecha(d), etiqueta: DIAS_LARGO[d.getDay()] + ' ' + ddmmyyyy(d) }; }),
    tecnicos: matriz
  };
}

// ---------------------------------------------------------------------------
//  Materiales
// ---------------------------------------------------------------------------
/** Genera la lista de implementos por OT a partir del kit estandar. */
function generarMaterialesDeOT() {
  dbTruncar(SH.MATERIALES);
  var ot = dbLeer(SH.OT);
  var filas = [];

  ot.forEach(function (o) {
    KIT_ESTANDAR.forEach(function (k) {
      var cantidad = (k[1] === 'EQUIPO') ? Number(o.EQUIPOS) : k[2];
      filas.push({
        MATERIAL_ID: dbNuevoId('MT'),
        OT_ID: o.OT_ID,
        CUADRILLA_ID: o.CUADRILLA_ID,
        ITEM: k[0],
        CATEGORIA: k[1],
        CANTIDAD: cantidad,
        UNIDAD: k[3],
        PESO_KG: redondear(k[4] * (k[1] === 'EQUIPO' ? cantidad : 1), 2),
        CARGADO: 'NO',
        UTILIZADO: '',
        DEVUELTO: '',
        COSTO_UNITARIO: '',
        OBSERVACION: ''
      });
    });
  });

  if (filas.length) dbInsertarVarios(SH.MATERIALES, filas);
  log('INFO', 'Materiales', 'Generados ' + filas.length + ' items para ' + ot.length + ' OT.');
  return filas.length;
}

/** Checklist de carga de una cuadrilla: que subir a la camioneta. */
function checklistCarga(cuadrillaId) {
  var materiales = dbBuscar(SH.MATERIALES, { CUADRILLA_ID: cuadrillaId });
  var porItem = agruparPor(materiales, 'ITEM');
  var lista = Object.keys(porItem).map(function (item) {
    var filas = porItem[item];
    return {
      item: item,
      categoria: filas[0].CATEGORIA,
      cantidad: sumarPor(filas, 'CANTIDAD'),
      unidad: filas[0].UNIDAD,
      pesoKg: redondear(sumarPor(filas, 'PESO_KG'), 1),
      cargado: filas.every(function (f) { return esSi(f.CARGADO); })
    };
  });
  var cuadrilla = dbUno(SH.CUADRILLAS, { CUADRILLA_ID: cuadrillaId });
  var vehiculo = cuadrilla && cuadrilla.VEHICULO_ID
    ? dbUno(SH.VEHICULOS, { VEHICULO_ID: cuadrilla.VEHICULO_ID }) : null;
  var pesoTotal = redondear(lista.reduce(function (a, l) { return a + l.pesoKg; }, 0), 1);

  return {
    cuadrillaId: cuadrillaId,
    nombre: cuadrilla ? cuadrilla.NOMBRE : '',
    vehiculo: vehiculo ? vehiculo.MARCA_MODELO + ' (' + vehiculo.PATENTE + ')' : 'Sin vehiculo asignado',
    capacidadKg: vehiculo ? Number(vehiculo.CAPACIDAD_KG) : null,
    pesoTotalKg: pesoTotal,
    excedeCapacidad: vehiculo ? pesoTotal > Number(vehiculo.CAPACIDAD_KG) : false,
    items: lista.sort(function (a, b) { return a.categoria.localeCompare(b.categoria); })
  };
}

// ---------------------------------------------------------------------------
//  Capacitaciones
// ---------------------------------------------------------------------------
/**
 * Crea el registro de capacitacion de cada OT.
 * En modo VIDEO_ASINCRONICO el video se envia al cliente y al tecnico apenas
 * queda planificada la OT, de modo que el tecnico lo revise durante el viaje y
 * el cliente llegue capacitado a la puesta en marcha: ahorra 30 min por equipo
 * en sitio sin perder la transferencia de conocimiento.
 */
function generarCapacitaciones() {
  dbTruncar(SH.CAPACITACION);
  var modo = cfg('CAPACITACION_MODO');
  var video = cfg('CAPACITACION_VIDEO_URL', '');
  var ot = dbLeer(SH.OT);
  var filas = ot.map(function (o) {
    return {
      CAP_ID: dbNuevoId('CP'),
      OT_ID: o.OT_ID,
      DESTINO_ID: o.DESTINO_ID,
      MODO: modo,
      VIDEO_URL: modo === 'PRESENCIAL' ? '' : video,
      ENVIADO_A: '',
      FECHA_ENVIO: '',
      VISTO: 'NO',
      FECHA_VISTO: '',
      DURACION_MIN: Number(o.EQUIPOS) * cfgNum('TIEMPO_CAPACITACION_MIN'),
      EVALUACION_OK: '',
      ASISTENTES: '',
      OBSERVACION: modo === 'VIDEO_ASINCRONICO'
        ? 'Video enviado antes de la visita; en sitio solo se resuelven dudas.'
        : 'Capacitacion presencial de ' + cfgNum('TIEMPO_CAPACITACION_MIN') + ' min por equipo.'
    };
  });
  if (filas.length) dbInsertarVarios(SH.CAPACITACION, filas);
  return filas.length;
}

/** Envia por correo el video de capacitacion al contacto del sitio. */
function enviarCapacitacionesPendientes() {
  var modo = cfg('CAPACITACION_MODO');
  if (modo === 'PRESENCIAL') return 'Modo presencial: no hay envios que realizar.';
  var video = String(cfg('CAPACITACION_VIDEO_URL', '')).trim();
  if (!video) return 'Falta configurar CAPACITACION_VIDEO_URL.';

  var pendientes = dbLeer(SH.CAPACITACION).filter(function (c) { return !c.FECHA_ENVIO; });
  var ot = indexarPor(dbLeer(SH.OT), 'OT_ID');
  var destinos = indexarPor(dbLeer(SH.DESTINOS), 'DESTINO_ID');
  var enviados = 0;

  pendientes.forEach(function (c) {
    var o = ot[c.OT_ID];
    if (!o) return;
    var d = destinos[c.DESTINO_ID];
    var tecnico = dbUno(SH.TECNICOS, { TECNICO_ID: o.TECNICO_ID });
    var para = [tecnico ? tecnico.EMAIL : '', cfg('NOTIFICAR_EMAIL', '')].filter(Boolean).join(',');
    if (!para) return;
    try {
      MailApp.sendEmail({
        to: para,
        subject: 'Capacitacion previa - ' + o.COMUNA + ' - OT ' + o.OT_ID,
        htmlBody:
          '<p>Estimado/a,</p>' +
          '<p>La instalacion en <b>' + o.COMUNA + '</b> (' + (d ? d.DIRECCION : '') + ') esta programada para el <b>' +
          ddmmyyyy(new Date(o.FECHA)) + ' a las ' + hhmm(new Date(o.HORA_INICIO_PLAN)) + '</b>.</p>' +
          '<p>Le enviamos el video de capacitacion para revisarlo antes de la visita: ' +
          '<a href="' + video + '">' + video + '</a></p>' +
          '<p>En terreno el tecnico resolvera dudas y validara la operacion del equipo.</p>' +
          '<p>' + APP.NOMBRE + '</p>'
      });
      dbActualizar(SH.CAPACITACION, 'CAP_ID', c.CAP_ID, {
        ENVIADO_A: para, FECHA_ENVIO: new Date()
      });
      enviados++;
    } catch (e) {
      log('WARN', 'Capacitacion', 'No se pudo enviar ' + c.CAP_ID + ': ' + e.message);
    }
  });
  return 'Capacitaciones enviadas: ' + enviados;
}
