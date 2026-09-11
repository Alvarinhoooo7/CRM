/**
 * ============================================================================
 *  12_Ejecucion.gs  ·  Lo que ocurre en terreno, en tiempo real.
 * ============================================================================
 *  Funciones que invoca el tecnico desde AppSheet o la web app:
 *  iniciar jornada, marcar viaje, hacer check-in en sitio, cerrar la OT con
 *  foto y firma, registrar gastos y notas.
 *
 *  Al cerrar una OT el sistema busca automaticamente el siguiente servicio
 *  pendiente mas cercano que quepa en lo que resta de la jornada legal del
 *  tecnico, y lo ofrece como sugerencia de encadenamiento.
 * ============================================================================
 */

/** Registra una marca de tiempo. Es la fuente de verdad de la jornada real. */
function marcar(tipo, tecnicoId, datos) {
  datos = datos || {};
  var fila = {
    MARCA_ID: dbNuevoId('MK', 5),
    TECNICO_ID: tecnicoId,
    FECHA: aMedianoche(new Date()),
    TIPO: tipo,
    TIMESTAMP: new Date(),
    OT_ID: datos.otId || '',
    TRAMO_ID: datos.tramoId || '',
    LAT: datos.lat || '',
    LNG: datos.lng || '',
    ORIGEN_DATO: datos.origen || 'APPSHEET',
    COMENTARIO: datos.comentario || ''
  };
  dbInsertar(SH.MARCAS, fila);
  return fila;
}

/** Inicio de jornada del tecnico. */
function iniciarJornada(tecnicoId, lat, lng) {
  var hoy = aMedianoche(new Date());
  var yaMarco = dbBuscar(SH.MARCAS, { TECNICO_ID: tecnicoId, TIPO: 'INICIO_JORNADA' })
    .filter(function (m) { return mismaFecha(new Date(m.FECHA), hoy); });
  if (yaMarco.length) {
    return { ok: false, mensaje: 'La jornada ya fue iniciada a las ' + hhmm(new Date(yaMarco[0].TIMESTAMP)) + '.' };
  }

  // Control de descanso minimo entre jornadas (R3).
  var finAyer = dbBuscar(SH.MARCAS, { TECNICO_ID: tecnicoId, TIPO: 'FIN_JORNADA' })
    .sort(function (a, b) { return new Date(b.TIMESTAMP) - new Date(a.TIMESTAMP); })[0];
  if (finAyer) {
    var horasDescanso = difHoras(new Date(finAyer.TIMESTAMP), new Date());
    var minimo = cfgNum('DESCANSO_ENTRE_JORNADAS_H');
    if (horasDescanso < minimo) {
      return {
        ok: false,
        mensaje: 'Descanso insuficiente: han pasado ' + horasLegibles(horasDescanso) +
                 ' desde el cierre anterior y se requieren ' + minimo + ' h. ' +
                 'Puede iniciar a las ' + hhmm(sumarHoras(new Date(finAyer.TIMESTAMP), minimo)) + '.',
        puedeIniciarA: sumarHoras(new Date(finAyer.TIMESTAMP), minimo)
      };
    }
  }

  marcar('INICIO_JORNADA', tecnicoId, { lat: lat, lng: lng });
  var agenda = agendaTecnico(tecnicoId, semanaISO(new Date()));
  var hoyIso = isoFecha(new Date());
  var delDia = agenda.dias.filter(function (d) { return d.fecha === hoyIso; })[0];

  return {
    ok: true,
    mensaje: 'Jornada iniciada a las ' + hhmm(new Date()) + '.',
    agendaHoy: delDia || null,
    horasSemana: agenda.totalHoras,
    topeLegal: agenda.topeLegal
  };
}

/** Cierre de jornada con resumen de horas del dia. */
function finalizarJornada(tecnicoId, lat, lng) {
  var hoy = aMedianoche(new Date());
  var marcas = dbBuscar(SH.MARCAS, { TECNICO_ID: tecnicoId })
    .filter(function (m) { return mismaFecha(new Date(m.FECHA), hoy); })
    .sort(function (a, b) { return new Date(a.TIMESTAMP) - new Date(b.TIMESTAMP); });

  var inicio = marcas.filter(function (m) { return m.TIPO === 'INICIO_JORNADA'; })[0];
  if (!inicio) return { ok: false, mensaje: 'No hay marca de inicio de jornada para hoy.' };

  marcar('FIN_JORNADA', tecnicoId, { lat: lat, lng: lng });

  var horasBrutas = difHoras(new Date(inicio.TIMESTAMP), new Date());
  var colacion = _minutosColacionDelDia(marcas) / 60;
  var horasNetas = cfgBool('COLACION_IMPUTABLE') ? horasBrutas : horasBrutas - colacion;
  var extra = Math.max(0, horasNetas - cfgNum('JORNADA_DIARIA_NORMAL_H'));

  var ot = dbBuscar(SH.OT, { TECNICO_ID: tecnicoId })
    .filter(function (o) { return o.FECHA && mismaFecha(new Date(o.FECHA), hoy); });

  return {
    ok: true,
    mensaje: 'Jornada cerrada a las ' + hhmm(new Date()) + '.',
    horasBrutas: redondear(horasBrutas, 2),
    horasColacion: redondear(colacion, 2),
    horasNetas: redondear(horasNetas, 2),
    horasExtra: redondear(extra, 2),
    otCompletadas: ot.filter(function (o) { return o.ESTADO === 'COMPLETADA'; }).length,
    otPendientes: ot.filter(function (o) { return o.ESTADO !== 'COMPLETADA'; }).length,
    equipos: sumarPor(ot.filter(function (o) { return o.ESTADO === 'COMPLETADA'; }), 'EQUIPOS')
  };
}

function _minutosColacionDelDia(marcas) {
  var total = 0, inicio = null;
  marcas.forEach(function (m) {
    if (m.TIPO === 'INICIO_COLACION') inicio = new Date(m.TIMESTAMP);
    if (m.TIPO === 'FIN_COLACION' && inicio) {
      total += difMin(inicio, new Date(m.TIMESTAMP));
      inicio = null;
    }
  });
  return total;
}

/** Check-in en sitio: inicia la ejecucion de una OT. */
function iniciarOT(otId, tecnicoId, lat, lng) {
  var ot = dbUno(SH.OT, { OT_ID: otId });
  if (!ot) return { ok: false, mensaje: 'OT inexistente.' };
  if (tecnicoId !== ot.TECNICO_ID) return { ok: false, mensaje: 'La OT pertenece a otro tecnico.' };
  if (ot.ESTADO === 'EN_EJECUCION') return { ok: true, mensaje: 'Inicio ya registrado.' };
  if (ot.ESTADO !== 'PLANIFICADA' && ot.ESTADO !== 'ASIGNADA') return { ok: false, mensaje: 'Estado no permite iniciar.' };
  if (ot.ESTADO === 'COMPLETADA') return { ok: false, mensaje: 'La OT ya esta completada.' };

  var ahora = new Date();
  dbActualizar(SH.OT, 'OT_ID', otId, {
    HORA_INICIO_REAL: ahora,
    ESTADO: 'EN_EJECUCION',
    LAT_CHECKIN: lat || '',
    LNG_CHECKIN: lng || '',
    ACTUALIZADO: ahora
  });
  marcar('INICIO_OT', tecnicoId || ot.TECNICO_ID, { otId: otId, lat: lat, lng: lng });

  var desvioInicio = ot.HORA_INICIO_PLAN ? difMin(new Date(ot.HORA_INICIO_PLAN), ahora) : 0;
  return {
    ok: true,
    mensaje: 'Check-in registrado en ' + ot.COMUNA + ' a las ' + hhmm(ahora) + '.',
    desvioInicioMin: desvioInicio,
    alerta: desvioInicio > 30 ? 'Inicio con ' + desvioInicio + ' min de atraso respecto del plan.' : '',
    duracionEstimadaMin: Number(ot.DURACION_PLAN_MIN),
    horaFinEstimada: sumarMin(ahora, Number(ot.DURACION_PLAN_MIN)),
    equipos: Number(ot.EQUIPOS),
    checklist: null
  };
}

/**
 * Cierre de OT. Calcula desvio, actualiza el requerimiento y propone el
 * siguiente servicio cercano que quepa en la jornada.
 */
function finalizarOT(datos) {
  var ot = dbUno(SH.OT, { OT_ID: datos.otId });
  if (!ot) return { ok: false, mensaje: 'OT inexistente.' };
  if (datos.tecnicoId !== ot.TECNICO_ID) return { ok: false, mensaje: 'La OT pertenece a otro tecnico.' };
  if (ot.ESTADO === 'COMPLETADA' || ot.ESTADO === 'NO_REALIZADA') return { ok: true, mensaje: 'Termino ya registrado.' };
  if (ot.ESTADO !== 'EN_EJECUCION' || !ot.HORA_INICIO_REAL) return { ok: false, mensaje: 'Primero registre el inicio.' };
  if (datos.realizada !== false && datos.capacitacionOk !== true) return { ok: false, mensaje: 'Confirme la capacitacion antes de completar.' };

  var ahora = new Date();
  var inicioReal = ot.HORA_INICIO_REAL ? new Date(ot.HORA_INICIO_REAL) : new Date(ot.HORA_INICIO_PLAN);
  var duracionReal = difMin(inicioReal, ahora);
  var desvio = duracionReal - Number(ot.DURACION_PLAN_MIN);

  var estado = datos.realizada === false ? 'NO_REALIZADA' : 'COMPLETADA';

  dbActualizar(SH.OT, 'OT_ID', datos.otId, {
    HORA_FIN_REAL: ahora,
    DURACION_REAL_MIN: duracionReal,
    DESVIO_MIN: desvio,
    ESTADO: estado,
    FOTO_ANTES_URL: datos.fotoAntes || ot.FOTO_ANTES_URL || '',
    FOTO_DESPUES_URL: datos.fotoDespues || ot.FOTO_DESPUES_URL || '',
    FIRMA_CLIENTE_URL: datos.firma || '',
    NOMBRE_RECEPTOR: datos.receptor || '',
    CAPACITACION_OK: datos.capacitacionOk ? 'SI' : 'NO',
    NOTAS_TECNICO: datos.notas || '',
    MOTIVO_NO_REALIZADA: datos.motivo || '',
    ACTUALIZADO: ahora
  });
  marcar('FIN_OT', datos.tecnicoId || ot.TECNICO_ID, {
    otId: datos.otId, lat: datos.lat, lng: datos.lng, comentario: datos.notas
  });

  if (datos.capacitacionOk) {
    var cap = dbUno(SH.CAPACITACION, { OT_ID: datos.otId });
    if (cap) {
      dbActualizar(SH.CAPACITACION, 'CAP_ID', cap.CAP_ID, {
        VISTO: 'SI', FECHA_VISTO: ahora,
        EVALUACION_OK: 'SI',
        ASISTENTES: datos.asistentes || ''
      });
    }
  }

  _cerrarRequerimientoSiCorresponde(ot.REQ_ID);

  var sugerencia = sugerirSiguienteServicio(ot.TECNICO_ID, ot.DESTINO_ID, ahora);

  return {
    ok: true,
    mensaje: estado === 'COMPLETADA'
      ? 'OT cerrada. ' + ot.EQUIPOS + ' equipo(s) instalado(s) en ' + horasLegibles(duracionReal / 60) + '.'
      : 'OT marcada como no realizada.',
    duracionRealMin: duracionReal,
    desvioMin: desvio,
    comentarioDesvio: desvio > 0
      ? 'Tomo ' + desvio + ' min mas de lo planificado.'
      : (desvio < 0 ? 'Termino ' + Math.abs(desvio) + ' min antes de lo planificado.' : 'Ajustado al plan.'),
    siguienteSugerido: sugerencia
  };
}

function _cerrarRequerimientoSiCorresponde(reqId) {
  if (!reqId) return;
  var ots = dbBuscar(SH.OT, { REQ_ID: reqId });
  var todasCerradas = ots.length && ots.every(function (o) {
    return o.ESTADO === 'COMPLETADA' || o.ESTADO === 'NO_REALIZADA';
  });
  if (todasCerradas) {
    dbActualizar(SH.REQUERIMIENTOS, 'REQ_ID', reqId, { ESTADO: 'CERRADO' });
  } else if (ots.some(function (o) { return o.ESTADO === 'EN_EJECUCION' || o.ESTADO === 'COMPLETADA'; })) {
    dbActualizar(SH.REQUERIMIENTOS, 'REQ_ID', reqId, { ESTADO: 'EN_CURSO' });
  }
}

/**
 * Al terminar un servicio: que hago ahora?
 * Busca OT pendientes y requerimientos sin planificar ordenados por cercania,
 * descartando los que no caben en el resto de la jornada legal.
 */
function sugerirSiguienteServicio(tecnicoId, ubicacionActualId, desde) {
  desde = desde ? new Date(desde) : new Date();
  var tecnico = dbUno(SH.TECNICOS, { TECNICO_ID: tecnicoId });
  if (!tecnico) return { hay: false, mensaje: 'Tecnico inexistente.' };

  var semana = semanaISO(desde);
  var horasSemana = _horasSemanaTecnico(tecnicoId, semana);
  var holguraSemanal = cfgNum('HORAS_SEMANALES_LEGALES') - horasSemana;

  var marcas = dbBuscar(SH.MARCAS, { TECNICO_ID: tecnicoId, TIPO: 'INICIO_JORNADA' })
    .filter(function (m) { return mismaFecha(new Date(m.FECHA), desde); });
  var inicioJornada = marcas.length ? new Date(marcas[0].TIMESTAMP) : enFechaHora(desde, cfg('HORA_INICIO_JORNADA'));
  var horasHoy = difHoras(inicioJornada, desde);
  var holguraDiaria = cfgNum('JORNADA_DIARIA_MAX_H') - horasHoy;

  if (holguraDiaria <= 0.5 || holguraSemanal <= 0.5) {
    return {
      hay: false,
      mensaje: 'Sin holgura para otro servicio hoy: lleva ' + horasLegibles(horasHoy) +
               ' de jornada y ' + horasLegibles(horasSemana) + ' en la semana.',
      holguraDiaria: redondear(holguraDiaria, 2),
      holguraSemanal: redondear(holguraSemanal, 2)
    };
  }

  // Candidatos: OT ya planificadas del mismo tecnico y requerimientos abiertos.
  var pendientesPropias = dbBuscar(SH.OT, { TECNICO_ID: tecnicoId })
    .filter(function (o) { return o.ESTADO === 'PLANIFICADA' || o.ESTADO === 'ASIGNADA'; });

  var requerimientosAbiertos = dbLeer(SH.REQUERIMIENTOS)
    .filter(function (r) { return r.ESTADO === 'PENDIENTE'; });

  var candidatos = [];

  pendientesPropias.forEach(function (o) {
    var t = tramo(ubicacionActualId, o.DESTINO_ID);
    candidatos.push({
      tipo: 'OT_PLANIFICADA',
      id: o.OT_ID,
      destinoId: o.DESTINO_ID,
      comuna: o.COMUNA,
      direccion: o.DIRECCION,
      equipos: Number(o.EQUIPOS),
      km: t.km,
      minutosViaje: t.min,
      minutosServicio: Number(o.DURACION_PLAN_MIN),
      programadaPara: o.HORA_INICIO_PLAN
    });
  });

  requerimientosAbiertos.forEach(function (r) {
    var t = tramo(ubicacionActualId, r.DESTINO_ID);
    candidatos.push({
      tipo: 'REQUERIMIENTO_ABIERTO',
      id: r.REQ_ID,
      destinoId: r.DESTINO_ID,
      comuna: r.COMUNA,
      direccion: '',
      equipos: Number(r.EQUIPOS),
      km: t.km,
      minutosViaje: t.min,
      minutosServicio: minutosServicio(1, cfg('CAPACITACION_MODO')),
      programadaPara: ''
    });
  });

  var viables = candidatos.filter(function (c) {
    var horasNecesarias = (c.minutosViaje + c.minutosServicio) / 60;
    // Debe caber el servicio Y el retorno a la base.
    var retorno = tramo(c.destinoId, BASE_ID).min / 60;
    return (horasNecesarias + retorno) <= Math.min(holguraDiaria, holguraSemanal);
  });

  viables.sort(function (a, b) { return a.minutosViaje - b.minutosViaje; });

  if (!viables.length) {
    return {
      hay: false,
      mensaje: 'No hay servicios cercanos que quepan en las ' + horasLegibles(Math.min(holguraDiaria, holguraSemanal)) +
               ' que le restan de jornada.',
      holguraDiaria: redondear(holguraDiaria, 2),
      holguraSemanal: redondear(holguraSemanal, 2),
      descartados: candidatos.length
    };
  }

  var mejor = viables[0];
  return {
    hay: true,
    mensaje: 'Siguiente servicio sugerido: ' + mejor.comuna + ' a ' + mejor.km +
             ' km (' + horasLegibles(mejor.minutosViaje / 60) + ' de viaje). ' +
             'Llegada estimada ' + hhmm(sumarMin(desde, mejor.minutosViaje)) + '.',
    sugerido: mejor,
    alternativas: viables.slice(1, 4),
    holguraDiaria: redondear(holguraDiaria, 2),
    holguraSemanal: redondear(holguraSemanal, 2),
    horaLlegadaEstimada: sumarMin(desde, mejor.minutosViaje),
    horaTerminoEstimada: sumarMin(desde, mejor.minutosViaje + mejor.minutosServicio)
  };
}

/**
 * Asigna en caliente un requerimiento a un tecnico, validando factibilidad.
 * Es la accion que ejecuta el coordinador desde el dashboard.
 */
function asignarServicioEnCaliente(reqId, tecnicoId, fechaHora) {
  var req = dbUno(SH.REQUERIMIENTOS, { REQ_ID: reqId });
  if (!req) return { ok: false, mensaje: 'Requerimiento inexistente.' };

  var cuando = new Date(fechaHora);
  var f = verificarFactibilidad(tecnicoId, req.DESTINO_ID, cuando);
  if (!f.factible) {
    return {
      ok: false,
      mensaje: f.motivo,
      primeraHoraFactible: f.primeraHoraFactible,
      sugerencias: sugerirTecnico(req.DESTINO_ID, cuando).filter(function (s) { return s.factible; }).slice(0, 3)
    };
  }

  var tecnico = dbUno(SH.TECNICOS, { TECNICO_ID: tecnicoId });
  var destino = dbUno(SH.DESTINOS, { DESTINO_ID: req.DESTINO_ID });
  var dur = minutosServicio(req.EQUIPOS, cfg('CAPACITACION_MODO'));

  var ot = {
    OT_ID: dbNuevoId('OT'),
    REQ_ID: reqId,
    CUADRILLA_ID: '',
    TECNICO_ID: tecnicoId,
    TECNICO_NOMBRE: tecnico.NOMBRE,
    DESTINO_ID: req.DESTINO_ID,
    COMUNA: destino.COMUNA,
    DIRECCION: destino.DIRECCION,
    FECHA: aMedianoche(cuando),
    DIA_SEMANA: DIAS_ES[cuando.getDay()],
    HORA_INICIO_PLAN: cuando,
    HORA_FIN_PLAN: sumarMin(cuando, dur),
    DURACION_PLAN_MIN: dur,
    EQUIPOS: Number(req.EQUIPOS),
    CAPACITACION_MODO: cfg('CAPACITACION_MODO'),
    ESTADO: 'ASIGNADA',
    MODO_LLEGADA: MODOS.CAMIONETA,
    INGRESO_CLP: ingresoOT(req.EQUIPOS, esSi(req.REQUIERE_CAPACITACION)),
    ACTUALIZADO: new Date()
  };
  dbInsertar(SH.OT, ot);
  dbActualizar(SH.REQUERIMIENTOS, 'REQ_ID', reqId, { ESTADO: 'PLANIFICADO' });
  construirCalendario(semanaISO(cuando));

  return {
    ok: true,
    mensaje: 'Asignado a ' + tecnico.NOMBRE + ' el ' + ddmmyyyy(cuando) + ' a las ' + hhmm(cuando) + '.',
    ot: ot,
    factibilidad: f
  };
}

/** Reprograma una OT a otra fecha u otro tecnico. */
function reprogramarOT(otId, nuevaFechaHora, nuevoTecnicoId) {
  var ot = dbUno(SH.OT, { OT_ID: otId });
  if (!ot) return { ok: false, mensaje: 'OT inexistente.' };
  var cuando = new Date(nuevaFechaHora);
  var tecnicoId = nuevoTecnicoId || ot.TECNICO_ID;

  var f = verificarFactibilidad(tecnicoId, ot.DESTINO_ID, cuando);
  if (!f.factible) return { ok: false, mensaje: f.motivo, factibilidad: f };

  var tecnico = dbUno(SH.TECNICOS, { TECNICO_ID: tecnicoId });
  dbActualizar(SH.OT, 'OT_ID', otId, {
    TECNICO_ID: tecnicoId,
    TECNICO_NOMBRE: tecnico ? tecnico.NOMBRE : ot.TECNICO_NOMBRE,
    FECHA: aMedianoche(cuando),
    DIA_SEMANA: DIAS_ES[cuando.getDay()],
    HORA_INICIO_PLAN: cuando,
    HORA_FIN_PLAN: sumarMin(cuando, Number(ot.DURACION_PLAN_MIN)),
    ESTADO: 'REPROGRAMADA',
    ACTUALIZADO: new Date()
  });
  construirCalendario(semanaISO(cuando));
  return { ok: true, mensaje: 'OT reprogramada para el ' + ddmmyyyy(cuando) + ' a las ' + hhmm(cuando) + '.' };
}

/** Panel del tecnico: todo lo que necesita ver al abrir la app. */
function panelTecnico(tecnicoId) {
  var tecnico = dbUno(SH.TECNICOS, { TECNICO_ID: tecnicoId });
  if (!tecnico) return { error: 'Tecnico inexistente.' };
  var hoy = new Date();
  var semana = semanaISO(hoy);

  var otHoy = dbBuscar(SH.OT, { TECNICO_ID: tecnicoId })
    .filter(function (o) { return o.FECHA && mismaFecha(new Date(o.FECHA), hoy); })
    .sort(function (a, b) { return new Date(a.HORA_INICIO_PLAN) - new Date(b.HORA_INICIO_PLAN); });

  var cuadrillaId = otHoy.length ? otHoy[0].CUADRILLA_ID : '';
  var cuadrilla = cuadrillaId ? dbUno(SH.CUADRILLAS, { CUADRILLA_ID: cuadrillaId }) : null;
  var vehiculo = cuadrilla && cuadrilla.VEHICULO_ID
    ? dbUno(SH.VEHICULOS, { VEHICULO_ID: cuadrilla.VEHICULO_ID }) : null;

  var destinosHoy = otHoy.map(function (o) { return o.DESTINO_ID; });
  var hotel = null;
  if (cuadrilla && Number(cuadrilla.NOCHES) > 0 && destinosHoy.length) {
    hotel = mejorHotel(destinosHoy[destinosHoy.length - 1]);
  }

  var viatico = dbUno(SH.VIATICOS, { TECNICO_ID: tecnicoId, SEMANA: semana });
  var agenda = agendaTecnico(tecnicoId, semana);

  return {
    tecnico: {
      id: tecnico.TECNICO_ID, nombre: tecnico.NOMBRE, cargo: tecnico.CARGO,
      especialidad: tecnico.ESPECIALIDAD, telefono: tecnico.TELEFONO
    },
    fecha: isoFecha(hoy),
    semana: semana,
    otHoy: otHoy.map(function (o) {
      return {
        otId: o.OT_ID, comuna: o.COMUNA, direccion: o.DIRECCION,
        equipos: Number(o.EQUIPOS), estado: o.ESTADO,
        desde: hhmm(new Date(o.HORA_INICIO_PLAN)), hasta: hhmm(new Date(o.HORA_FIN_PLAN)),
        duracionMin: Number(o.DURACION_PLAN_MIN),
        capacitacion: o.CAPACITACION_MODO,
        mapa: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(o.DIRECCION)
      };
    }),
    cuadrilla: cuadrilla ? {
      id: cuadrilla.CUADRILLA_ID, nombre: cuadrilla.NOMBRE,
      modo: cuadrilla.MODO_TRANSPORTE, companeros: cuadrilla.TECNICOS_IDS,
      noches: Number(cuadrilla.NOCHES), justificacion: cuadrilla.JUSTIFICACION_MODO
    } : null,
    vehiculo: vehiculo ? {
      id: vehiculo.VEHICULO_ID, patente: vehiculo.PATENTE,
      modelo: vehiculo.MARCA_MODELO, rendimiento: Number(vehiculo.RENDIMIENTO_KM_L),
      tag: vehiculo.TIENE_TAG
    } : null,
    hotel: hotel ? {
      nombre: hotel.NOMBRE, direccion: hotel.DIRECCION, telefono: hotel.TELEFONO,
      valorNoche: Number(hotel.VALOR_NOCHE),
      mapa: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(hotel.DIRECCION)
    } : null,
    viatico: viatico ? {
      total: Number(viatico.TOTAL_TRANSFERIR),
      alojamiento: Number(viatico.MONTO_ALOJAMIENTO),
      viatico: Number(viatico.MONTO_VIATICO),
      fondoRendir: Number(viatico.FONDO_COMBUSTIBLE) + Number(viatico.FONDO_PEAJES) + Number(viatico.HOLGURA),
      rendido: Number(viatico.RENDIDO_CLP),
      saldo: Number(viatico.SALDO_CLP),
      estado: viatico.ESTADO
    } : null,
    materiales: null,
    horas: {
      semana: agenda.totalHoras, viaje: agenda.totalViaje,
      servicio: agenda.totalServicio, tope: agenda.topeLegal,
      holgura: redondear(agenda.topeLegal - agenda.totalHoras, 2)
    },
    capacitacionVideo: cfg('CAPACITACION_VIDEO_URL', '')
  };
}
