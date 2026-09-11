/**
 * ============================================================================
 *  09_Planificador.gs  ·  Motor de planificacion semanal.
 * ============================================================================
 *  Toma los requerimientos pendientes y produce una semana ejecutable:
 *  cuadrillas dimensionadas, modo de transporte elegido, itinerario con horas,
 *  ordenes de trabajo por tecnico y calendario.
 *
 *  RESTRICCIONES QUE RESPETA
 *  -------------------------
 *   R1. Jornada de 42 h semanales (Ley 21.561) con tope de 10 h diarias.
 *   R2. Una hora de colacion dentro de la ventana 12:30-15:00, no imputable.
 *   R3. Descanso de 10 h si el tecnico llega a destino despues de las 21:00,
 *       y 12 h minimo entre el fin de una jornada y el inicio de la siguiente.
 *   R4. Continuidad geografica: nadie puede estar en Maipu a las 08:00 y en
 *       Pucon a las 10:00 del mismo dia. Todo salto obliga a su tramo real.
 *   R5. Pausa de 30 min tras 4,5 h de conduccion continua.
 *   R6. Un tecnico solo puede viajar solo si la mision lo permite; sobre
 *       350 km o 3 equipos en sitio se exige dupla.
 *
 *  DIMENSIONAMIENTO DE CUADRILLA
 *  -----------------------------
 *  El tamano NO es fijo. Se calcula con la carga real de trabajo del destino:
 *  un equipo en La Calera va con un tecnico; cinco equipos en Copiapo van con
 *  tres, porque instalan en paralelo y el viaje se amortiza entre todos.
 * ============================================================================
 */

/** PUNTO DE ENTRADA. Planifica la semana configurada. */
function planificarSemana(semana) {
  semana = semana || cfg('SEMANA_PLANIFICACION') || semanaISO(new Date());
  var inicio = new Date();
  log('INFO', 'Planificador', 'Inicio de planificacion semana ' + semana);

  limpiarPlanificacion(semana);
  dbInvalidar();

  var contexto = _prepararContexto(semana);
  var misiones = _construirMisiones(contexto);

  misiones.forEach(function (m) { _dimensionarCuadrilla(m, contexto); });

  // Las misiones mas largas y exigentes se asignan primero: toman los
  // tecnicos con mas holgura semanal y los vehiculos disponibles.
  misiones.sort(function (a, b) { return b.prioridad - a.prioridad; });

  var planificadas = [];
  var rechazadas = [];
  misiones.forEach(function (m) {
    var r = _asignarYProgramar(m, contexto);
    if (r.ok) planificadas.push(r); else rechazadas.push(r);
  });

  _persistirPlan(contexto);
  calcularViaticos(semana);
  generarGastosPresupuestados(semana);
  generarMaterialesDeOT();
  generarCapacitaciones();
  construirCalendario(semana);
  recalcularKPIs(semana);

  var seg = redondear((new Date() - inicio) / 1000, 1);
  var resumen = {
    semana: semana,
    misionesPlanificadas: planificadas.length,
    misionesRechazadas: rechazadas.length,
    ot: contexto.ot.length,
    tramos: contexto.tramos.length,
    equipos: contexto.ot.reduce(function (a, o) { return a + Number(o.EQUIPOS); }, 0),
    segundos: seg,
    detalleRechazos: rechazadas.map(function (r) { return r.motivo; })
  };
  log('INFO', 'Planificador', 'Planificacion lista en ' + seg + 's: ' +
      resumen.ot + ' OT, ' + resumen.equipos + ' equipos, ' + resumen.misionesRechazadas + ' rechazos');
  return resumen;
}

/** Borra la planificacion previa de una semana sin tocar datos maestros. */
function limpiarPlanificacion(semana) {
  semana = semana || cfg('SEMANA_PLANIFICACION');
  [SH.OT, SH.ITINERARIO, SH.CUADRILLAS, SH.CALENDARIO, SH.MATERIALES, SH.CAPACITACION].forEach(function (h) {
    dbTruncar(h);
  });
  dbEliminar(SH.VIATICOS, { SEMANA: semana });
  var gastos = dbLeer(SH.GASTOS).filter(function (g) { return g.ESTADO === 'BORRADOR'; });
  gastos.map(function (g) { return g._fila; }).sort(function (a, b) { return b - a; })
        .forEach(function (f) { libro().getSheetByName(SH.GASTOS).deleteRow(f); });
  dbEliminar(SH.KPI_TECNICO, { SEMANA: semana });
  dbEliminar(SH.KPI_SEMANAL, { SEMANA: semana });
  dbEliminar(SH.RENTABILIDAD, { SEMANA: semana });
  // Las camionetas asignadas al plan anterior deben volver al pool antes de
  // recalcularlo. De otro modo, una segunda ejecucion no encontraria flota.
  dbLeer(SH.VEHICULOS).filter(function (v) { return v.ESTADO === 'EN_RUTA'; })
    .forEach(function (v) {
      dbActualizar(SH.VEHICULOS, 'VEHICULO_ID', v.VEHICULO_ID, { ESTADO: 'DISPONIBLE' });
    });
  ['OT', 'TR', 'CU', 'VT', 'GP', 'MT', 'CP'].forEach(dbReiniciarSecuencia);
  dbInvalidar();
  return 'Planificacion de ' + semana + ' limpiada.';
}

// ---------------------------------------------------------------------------
//  1. CONTEXTO
// ---------------------------------------------------------------------------
function _prepararContexto(semana) {
  var tecnicos = dbLeer(SH.TECNICOS).filter(function (t) { return esSi(t.ACTIVO); });
  var vehiculos = dbLeer(SH.VEHICULOS).filter(function (v) { return v.ESTADO === 'DISPONIBLE'; });
  var destinos = indexarPor(dbLeer(SH.DESTINOS), 'DESTINO_ID');
  var dias = diasDeSemana(semana, cfg('DIAS_HABILES'));

  var agenda = {};
  tecnicos.forEach(function (t) {
    agenda[t.TECNICO_ID] = {
      tecnico: t,
      horasSemana: 0,
      horasExtra: 0,
      // Ubicacion y disponibilidad por dia: la base al inicio de cada jornada.
      dias: dias.map(function (d) {
        return {
          fecha: d,
          ubicacion: BASE_ID,
          libreDesde: enFechaHora(d, cfg('HORA_INICIO_JORNADA')),
          horas: 0,
          ocupado: false,
          colacionTomada: false
        };
      })
    };
  });

  var flota = {};
  vehiculos.forEach(function (v) {
    flota[v.VEHICULO_ID] = { vehiculo: v, ocupadoHasta: null, cuadrilla: null };
  });

  return {
    semana: semana, dias: dias, tecnicos: tecnicos, agenda: agenda,
    vehiculos: vehiculos, flota: flota, destinos: destinos,
    ot: [], tramos: [], cuadrillas: []
  };
}

// ---------------------------------------------------------------------------
//  2. MISIONES: agrupacion geografica de los requerimientos
// ---------------------------------------------------------------------------
/**
 * Una mision es un viaje: uno o varios destinos que conviene atender juntos.
 * Regla de agrupacion:
 *   - Zona RM y CENTRO: se agrupan por cercania en rutas de un dia (ida y
 *     vuelta a la base), porque no justifican pernoctar.
 *   - Zonas NORTE y SUR: una sola mision por zona, multi-dia, porque el costo
 *     dominante es llegar hasta alla.
 */
function _construirMisiones(ctx) {
  var reqs = dbLeer(SH.REQUERIMIENTOS).filter(function (r) {
    return r.ESTADO === 'PENDIENTE' || r.ESTADO === 'PLANIFICADO';
  });
  if (!reqs.length) return [];

  var porZona = agruparPor(reqs, function (r) {
    var d = ctx.destinos[r.DESTINO_ID];
    return d ? d.ZONA : 'RM';
  });

  var misiones = [];

  Object.keys(porZona).forEach(function (zona) {
    var lista = porZona[zona];
    var lejana = (zona === 'NORTE' || zona === 'SUR');

    if (lejana) {
      misiones.push(_nuevaMision(zona, lista, ctx, true));
    } else {
      // Rutas de un dia: se llenan por cercania hasta agotar la jornada util.
      var ordenados = optimizarRuta(lista.map(function (r) { return r.DESTINO_ID; }), true);
      var indexReq = indexarPor(lista, 'DESTINO_ID');
      var bloque = [];
      var minutosBloque = 0;
      var topeMin = cfgNum('JORNADA_DIARIA_NORMAL_H') * 60 - 30;

      ordenados.forEach(function (destinoId) {
        var req = indexReq[destinoId];
        if (!req) return;
        var servicio = minutosServicio(req.EQUIPOS, cfg('CAPACITACION_MODO'));
        var viaje = bloque.length
          ? tramo(bloque[bloque.length - 1].DESTINO_ID, destinoId).min
          : tramo(BASE_ID, destinoId).min;
        var retorno = tramo(destinoId, BASE_ID).min;

        // Con dos tecnicos el servicio se parte a la mitad; se estima asi
        // para decidir el corte del dia, luego se recalcula con exactitud.
        var servicioEstimado = Math.ceil(servicio / 2);

        if (bloque.length && (minutosBloque + viaje + servicioEstimado + retorno) > topeMin) {
          misiones.push(_nuevaMision(zona, bloque.slice(), ctx, false));
          bloque = []; minutosBloque = 0;
          viaje = tramo(BASE_ID, destinoId).min;
        }
        bloque.push(req);
        minutosBloque += viaje + servicioEstimado;
      });
      if (bloque.length) misiones.push(_nuevaMision(zona, bloque, ctx, false));
    }
  });

  return misiones;
}

function _nuevaMision(zona, requerimientos, ctx, multiDia) {
  var ids = optimizarRuta(requerimientos.map(function (r) { return r.DESTINO_ID; }), true);
  var equipos = requerimientos.reduce(function (a, r) { return a + Number(r.EQUIPOS); }, 0);
  var kms = kmDeRuta(ids, true);
  var prioridadMax = requerimientos.reduce(function (a, r) {
    var p = { BAJA: 1, NORMAL: 2, ALTA: 3, CRITICA: 4 }[r.PRIORIDAD] || 2;
    return Math.max(a, p);
  }, 0);

  return {
    id: zona + '-' + (ids[0] || 'X'),
    zona: zona,
    multiDia: multiDia,
    requerimientos: requerimientos,
    secuencia: ids,
    equipos: equipos,
    km: kms,
    minutosViaje: _minutosDeRuta(ids, true),
    minutosServicio: requerimientos.reduce(function (a, r) {
      return a + minutosServicio(r.EQUIPOS, cfg('CAPACITACION_MODO'));
    }, 0),
    // Las misiones largas y prioritarias se asignan primero.
    prioridad: kms + prioridadMax * 200 + equipos * 30
  };
}

// ---------------------------------------------------------------------------
//  3. DIMENSIONAMIENTO DE LA CUADRILLA
// ---------------------------------------------------------------------------
/**
 * Calcula cuantos tecnicos conviene enviar.
 *
 * La logica: el viaje es un costo fijo que se paga una vez por vehiculo, y el
 * servicio es un costo variable que se divide entre los tecnicos. Por eso a
 * mayor distancia y mayor carga de equipos, mas conviene llenar la camioneta;
 * y a menor carga, conviene mandar a una sola persona.
 */
function _dimensionarCuadrilla(mision, ctx) {
  var min = cfgNum('CUADRILLA_MIN');
  var max = cfgNum('CUADRILLA_MAX');

  // Horas productivas disponibles: la jornada menos el viaje.
  var horasViaje = mision.minutosViaje / 60;
  var diasDisponibles = mision.multiDia ? 4 : 1;
  var horasUtiles = Math.max(1, diasDisponibles * cfgNum('JORNADA_DIARIA_NORMAL_H') - horasViaje);
  var horasServicio = mision.minutosServicio / 60;

  var n = Math.ceil(horasServicio / horasUtiles);

  // Reglas de seguridad y de carga.
  var maxEquiposSitio = mision.requerimientos.reduce(function (a, r) {
    return Math.max(a, Number(r.EQUIPOS));
  }, 0);
  if (mision.km >= cfgNum('MIN_DUPLA_SOBRE_KM')) n = Math.max(n, 2);
  if (maxEquiposSitio >= cfgNum('MIN_DUPLA_SOBRE_EQUIPOS')) n = Math.max(n, 2);
  if (!cfgBool('PERMITE_TECNICO_SOLO')) n = Math.max(n, 2);

  n = Math.min(max, Math.max(min, n));

  mision.nTecnicos = n;
  mision.justificacionTamano = _justificarTamano(mision, n, horasServicio, horasUtiles, maxEquiposSitio);
  return n;
}

function _justificarTamano(mision, n, horasServicio, horasUtiles, maxEquiposSitio) {
  var partes = [];
  partes.push(n + ' tecnico(s) para ' + mision.equipos + ' equipo(s) en ' + mision.secuencia.length + ' localidad(es).');
  partes.push('Carga de servicio ' + horasLegibles(horasServicio) + ' contra ' + horasLegibles(horasUtiles) + ' de ventana util tras descontar ' + horasLegibles(mision.minutosViaje / 60) + ' de traslado.');
  if (mision.km >= cfgNum('MIN_DUPLA_SOBRE_KM')) {
    partes.push('Se exige dupla: la ruta supera los ' + cfgNum('MIN_DUPLA_SOBRE_KM') + ' km (relevo de conduccion y seguridad).');
  }
  if (maxEquiposSitio >= cfgNum('MIN_DUPLA_SOBRE_EQUIPOS')) {
    partes.push('Se exige dupla: hay un sitio con ' + maxEquiposSitio + ' equipos, que en solitario tomaria mas de una jornada.');
  }
  if (n === 1) {
    partes.push('Se despacha un tecnico solo: la carga cabe en su jornada y la distancia no exige acompanante.');
  }
  return partes.join(' ');
}

// ---------------------------------------------------------------------------
//  4. ASIGNACION Y PROGRAMACION
// ---------------------------------------------------------------------------
function _asignarYProgramar(mision, ctx) {
  // --- Eleccion de tecnicos --------------------------------------------
  var candidatos = _elegirTecnicos(mision, ctx);
  if (candidatos.length < mision.nTecnicos) {
    return { ok: false, motivo: 'Mision ' + mision.id + ': solo ' + candidatos.length +
             ' de ' + mision.nTecnicos + ' tecnicos disponibles con holgura de jornada.' };
  }

  var hayConductor = candidatos.some(function (t) { return esSi(t.PUEDE_CONDUCIR); });
  var vehiculo = _tomarVehiculo(ctx, mision);

  // --- Eleccion del modo de transporte ---------------------------------
  var decision = evaluarModosTransporte({
    destinoId: mision.secuencia[0],
    nTecnicos: mision.nTecnicos,
    equipos: mision.equipos,
    diasEnDestino: mision.multiDia ? 2 : 1,
    hayVehiculo: !!vehiculo,
    hayConductor: hayConductor,
    secuencia: mision.secuencia
  });
  var modo = decision.recomendado.modo;
  if (modo !== MODOS.CAMIONETA && vehiculo) { _liberarVehiculo(ctx, vehiculo); vehiculo = null; }
  if (modo === MODOS.CAMIONETA && !vehiculo) {
    return { ok: false, motivo: 'Mision ' + mision.id + ': sin camioneta disponible.' };
  }

  // --- Simulacion temporal ---------------------------------------------
  var sim = _simularMision(mision, candidatos, modo, vehiculo, decision, ctx);
  if (!sim.ok) return { ok: false, motivo: sim.motivo };

  // --- Registro de la cuadrilla ----------------------------------------
  var cuadrillaId = dbNuevoId('CU');
  ctx.cuadrillas.push({
    CUADRILLA_ID: cuadrillaId,
    NOMBRE: _nombreCuadrilla(mision, ctx),
    ZONA: mision.zona,
    TECNICOS_IDS: candidatos.map(function (t) { return t.TECNICO_ID; }).join(', '),
    N_TECNICOS: candidatos.length,
    LIDER_ID: sim.liderId,
    MODO_TRANSPORTE: modo,
    VEHICULO_ID: vehiculo ? vehiculo.VEHICULO_ID : '',
    FECHA_INICIO: sim.fechaInicio,
    FECHA_FIN: sim.fechaFin,
    EQUIPOS_TOTAL: mision.equipos,
    KM_TOTAL: redondear(sim.kmTotal, 1),
    NOCHES: sim.noches,
    COSTO_TOTAL: sim.costoTotal,
    JUSTIFICACION_MODO: mision.justificacionTamano + ' ' + decision.justificacion
  });

  sim.ot.forEach(function (o) { o.CUADRILLA_ID = cuadrillaId; ctx.ot.push(o); });
  sim.tramos.forEach(function (t) { t.CUADRILLA_ID = cuadrillaId; ctx.tramos.push(t); });

  mision.requerimientos.forEach(function (r) {
    dbActualizar(SH.REQUERIMIENTOS, 'REQ_ID', r.REQ_ID, { ESTADO: 'PLANIFICADO' });
  });

  return { ok: true, cuadrillaId: cuadrillaId, mision: mision.id, ot: sim.ot.length };
}

function _nombreCuadrilla(mision, ctx) {
  var comunas = mision.secuencia.map(function (id) {
    var d = ctx.destinos[id];
    return d ? d.COMUNA : id;
  });
  var etiqueta = comunas.length <= 2 ? comunas.join(' + ') : comunas[0] + ' +' + (comunas.length - 1);
  return mision.zona + ': ' + etiqueta;
}

/**
 * Selecciona los tecnicos con mas holgura semanal, priorizando que al menos
 * uno pueda conducir y que vivan cerca del primer destino.
 */
function _elegirTecnicos(mision, ctx) {
  var primerDestino = ctx.destinos[mision.secuencia[0]];
  var tope = cfgNum('HORAS_SEMANALES_LEGALES');

  var puntuados = ctx.tecnicos.map(function (t) {
    var a = ctx.agenda[t.TECNICO_ID];
    var holgura = tope - a.horasSemana;
    var cercania = primerDestino && Number(t.LAT_RESIDENCIA)
      ? haversineKm(Number(t.LAT_RESIDENCIA), Number(t.LNG_RESIDENCIA), Number(primerDestino.LAT), Number(primerDestino.LNG))
      : 50;
    var puntaje = holgura * 10 - cercania * 0.4 + (esSi(t.PUEDE_CONDUCIR) ? 15 : 0) + Number(t.NIVEL) * 3;
    if (mision.multiDia && !esSi(t.DISPONIBLE_VIAJE)) puntaje -= 500;
    return { tecnico: t, puntaje: puntaje, holgura: holgura };
  }).filter(function (p) {
    // Debe quedarle al menos una jornada util.
    return p.holgura >= 4;
  });

  puntuados.sort(function (a, b) { return b.puntaje - a.puntaje; });
  var elegidos = puntuados.slice(0, mision.nTecnicos).map(function (p) { return p.tecnico; });

  // Garantiza un conductor si el modo probable es camioneta.
  if (elegidos.length && !elegidos.some(function (t) { return esSi(t.PUEDE_CONDUCIR); })) {
    var conductor = puntuados.filter(function (p) { return esSi(p.tecnico.PUEDE_CONDUCIR); })[0];
    if (conductor) elegidos[elegidos.length - 1] = conductor.tecnico;
  }
  return elegidos;
}

function _tomarVehiculo(ctx, mision) {
  var libres = Object.keys(ctx.flota).filter(function (k) { return !ctx.flota[k].cuadrilla; });
  if (!libres.length) return null;
  // Para misiones largas, la camioneta de mayor capacidad y menor kilometraje.
  libres.sort(function (a, b) {
    var va = ctx.flota[a].vehiculo, vb = ctx.flota[b].vehiculo;
    if (mision.multiDia) {
      return (Number(va.KM_ACTUAL) - Number(vb.KM_ACTUAL));
    }
    return Number(vb.KM_ACTUAL) - Number(va.KM_ACTUAL);
  });
  var elegido = ctx.flota[libres[0]];
  elegido.cuadrilla = mision.id;
  return elegido.vehiculo;
}

function _liberarVehiculo(ctx, vehiculo) {
  if (vehiculo && ctx.flota[vehiculo.VEHICULO_ID]) ctx.flota[vehiculo.VEHICULO_ID].cuadrilla = null;
}

// ---------------------------------------------------------------------------
//  5. SIMULACION TEMPORAL  (el corazon del planificador)
// ---------------------------------------------------------------------------
/**
 * Recorre la secuencia de destinos avanzando el reloj minuto a minuto de
 * forma realista, aplicando R1..R6. Devuelve OT, tramos y costos.
 */
function _simularMision(mision, tecnicos, modo, vehiculo, decision, ctx) {
  var idsTecnicos = tecnicos.map(function (t) { return t.TECNICO_ID; });
  var liderId = tecnicos.filter(function (t) { return esSi(t.PUEDE_CONDUCIR); })[0];
  liderId = liderId ? liderId.TECNICO_ID : idsTecnicos[0];

  // Primer dia con holgura para todos los tecnicos de la cuadrilla.
  var indiceDia = _primerDiaComun(idsTecnicos, ctx);
  if (indiceDia < 0) {
    return { ok: false, motivo: 'Mision ' + mision.id + ': sin dia comun disponible en la semana.' };
  }

  var ot = [], tramos = [], secuenciaTramo = 0;
  var ubicacion = BASE_ID;
  var kmTotal = 0, peajeTotal = 0, pasajesTotal = 0, noches = 0;
  var horasViajeAcum = 0, horasServicioAcum = 0;

  var dia = ctx.dias[indiceDia];
  var esViajeLargo = mision.minutosViaje > 150;
  var reloj = enFechaHora(dia, esViajeLargo ? cfg('HORA_SALIDA_VIAJE_LARGO') : cfg('HORA_INICIO_JORNADA'));
  var horasDia = 0;
  var colacionTomada = false;
  var fechaInicio = new Date(dia);

  for (var i = 0; i < mision.secuencia.length; i++) {
    var destinoId = mision.secuencia[i];
    var destino = ctx.destinos[destinoId];
    var req = mision.requerimientos.filter(function (r) { return r.DESTINO_ID === destinoId; })[0];
    if (!req) continue;

    // ---- Tramo de viaje hacia el destino ------------------------------
    var t = tramo(ubicacion, destinoId);
    var minViaje = _minutosViajePorModo(t, modo, decision);
    var costoTramo = _costearTramo(t, modo, tecnicos.length, decision, vehiculo);

    // Pausa obligatoria por conduccion continua (R5).
    if (modo === MODOS.CAMIONETA && minViaje / 60 > cfgNum('CONDUCCION_CONTINUA_MAX_H')) {
      var pausas = Math.floor((minViaje / 60) / cfgNum('CONDUCCION_CONTINUA_MAX_H'));
      minViaje += pausas * cfgNum('PAUSA_CONDUCCION_MIN');
    }

    var salida = new Date(reloj);
    var llegada = sumarMin(salida, minViaje);

    // ---- Llegada nocturna: se corta el dia y se descansa (R3) ---------
    var limiteNocturno = enFechaHora(salida, cfg('HORA_LLEGADA_NOCTURNA'));
    var llegoDeNoche = llegada > limiteNocturno;

    tramos.push({
      TRAMO_ID: dbNuevoId('TR'),
      FECHA: aMedianoche(salida),
      SECUENCIA: ++secuenciaTramo,
      ORIGEN_ID: ubicacion,
      ORIGEN_NOMBRE: ubicacion === BASE_ID ? APP.BASE_NOMBRE : (ctx.destinos[ubicacion] ? ctx.destinos[ubicacion].COMUNA : ubicacion),
      DESTINO_ID: destinoId,
      DESTINO_NOMBRE: destino.COMUNA,
      MODO: modo,
      KM: t.km,
      MINUTOS: minViaje,
      HORA_SALIDA: salida,
      HORA_LLEGADA: llegada,
      N_PASAJEROS: tecnicos.length,
      COSTO_COMBUSTIBLE: costoTramo.combustible,
      COSTO_PEAJE: costoTramo.peaje,
      COSTO_PASAJES: costoTramo.pasajes,
      COSTO_TOTAL: costoTramo.total,
      LLEGADA_NOCTURNA: siNo(llegoDeNoche),
      DESCANSO_REQUERIDO_H: llegoDeNoche ? cfgNum('DESCANSO_POST_VIAJE_NOCTURNO_H') : cfgNum('DESCANSO_POST_VIAJE_DIURNO_H'),
      JUSTIFICACION: costoTramo.nota
    });

    kmTotal += t.km;
    peajeTotal += costoTramo.peaje;
    pasajesTotal += costoTramo.pasajes;
    horasDia += minViaje / 60;
    horasViajeAcum += minViaje / 60;
    reloj = llegada;
    ubicacion = destinoId;

    // ---- Servicio en sitio --------------------------------------------
    var equiposPorTecnico = Math.ceil(Number(req.EQUIPOS) / tecnicos.length);
    var minServicio = minutosServicio(equiposPorTecnico, cfg('CAPACITACION_MODO'));

    // Descanso obligatorio antes de operar.
    if (llegoDeNoche) {
      // Se pernocta y se retoma al dia siguiente tras 10 h de descanso.
      noches++;
      indiceDia++;
      if (indiceDia >= ctx.dias.length) {
        return { ok: false, motivo: 'Mision ' + mision.id + ': la ruta excede la semana planificable.' };
      }
      dia = ctx.dias[indiceDia];
      var minimoTrasDescanso = sumarHoras(llegada, cfgNum('DESCANSO_POST_VIAJE_NOCTURNO_H'));
      var inicioDiaSiguiente = enFechaHora(dia, cfg('HORA_INICIO_JORNADA'));
      reloj = minimoTrasDescanso > inicioDiaSiguiente ? minimoTrasDescanso : inicioDiaSiguiente;
      horasDia = 0;
      colacionTomada = false;
    } else if (minViaje > 90) {
      reloj = sumarHoras(reloj, cfgNum('DESCANSO_POST_VIAJE_DIURNO_H'));
      horasDia += cfgNum('DESCANSO_POST_VIAJE_DIURNO_H');
    }

    // ---- Colacion dentro de la ventana (R2) ---------------------------
    var res = _insertarColacionSiCorresponde(reloj, dia, colacionTomada, minServicio);
    reloj = res.reloj;
    colacionTomada = res.tomada;

    // ---- El servicio cabe en la jornada? (R1) -------------------------
    var finServicio = sumarMin(reloj, minServicio);
    var topeDiario = cfgNum('JORNADA_DIARIA_MAX_H');
    if (horasDia + minServicio / 60 > topeDiario) {
      // No cabe: se cierra el dia y se retoma manana.
      if (destino.REQUIERE_PERNOCTAR === 'SI') noches++;
      indiceDia++;
      if (indiceDia >= ctx.dias.length) {
        return { ok: false, motivo: 'Mision ' + mision.id + ': jornada agotada, requiere semana adicional.' };
      }
      dia = ctx.dias[indiceDia];
      reloj = enFechaHora(dia, cfg('HORA_INICIO_JORNADA'));
      horasDia = 0;
      colacionTomada = false;
      var r2 = _insertarColacionSiCorresponde(reloj, dia, colacionTomada, minServicio);
      reloj = r2.reloj; colacionTomada = r2.tomada;
      finServicio = sumarMin(reloj, minServicio);
    }

    // ---- Una OT por tecnico (calendario individual) --------------------
    var restantes = Number(req.EQUIPOS);
    tecnicos.forEach(function (tec, k) {
      var asignados = Math.min(equiposPorTecnico, restantes);
      restantes -= asignados;
      if (asignados <= 0) return;
      var durTec = minutosServicio(asignados, cfg('CAPACITACION_MODO'));
      ot.push({
        OT_ID: dbNuevoId('OT'),
        REQ_ID: req.REQ_ID,
        CUADRILLA_ID: '',
        TECNICO_ID: tec.TECNICO_ID,
        TECNICO_NOMBRE: tec.NOMBRE,
        DESTINO_ID: destinoId,
        COMUNA: destino.COMUNA,
        DIRECCION: destino.DIRECCION,
        FECHA: aMedianoche(reloj),
        DIA_SEMANA: DIAS_ES[reloj.getDay()],
        HORA_INICIO_PLAN: new Date(reloj),
        HORA_FIN_PLAN: sumarMin(reloj, durTec),
        DURACION_PLAN_MIN: durTec,
        EQUIPOS: asignados,
        CAPACITACION_MODO: cfg('CAPACITACION_MODO'),
        HORA_INICIO_REAL: '', HORA_FIN_REAL: '', DURACION_REAL_MIN: '', DESVIO_MIN: '',
        ESTADO: 'PLANIFICADA',
        VEHICULO_ID: vehiculo ? vehiculo.VEHICULO_ID : '',
        MODO_LLEGADA: modo,
        LAT_CHECKIN: '', LNG_CHECKIN: '',
        FOTO_ANTES_URL: '', FOTO_DESPUES_URL: '', FIRMA_CLIENTE_URL: '',
        NOMBRE_RECEPTOR: '', CAPACITACION_OK: '',
        NOTAS_TECNICO: '', MOTIVO_NO_REALIZADA: '',
        INGRESO_CLP: ingresoOT(asignados, esSi(req.REQUIERE_CAPACITACION)),
        ACTUALIZADO: new Date()
      });
    });

    reloj = finServicio;
    horasDia += minServicio / 60;
    horasServicioAcum += minServicio / 60;

    // Pernoctacion si el destino lo exige y quedan sitios por atender.
    var quedanSitios = (i < mision.secuencia.length - 1);
    if (destino.REQUIERE_PERNOCTAR === 'SI' && quedanSitios && !llegoDeNoche) {
      var siguienteId = mision.secuencia[i + 1];
      var siguienteMin = tramo(destinoId, siguienteId).min;
      var minServSiguiente = minutosServicio(
        Math.ceil(Number((mision.requerimientos.filter(function (r) { return r.DESTINO_ID === siguienteId; })[0] || {}).EQUIPOS || 1) / tecnicos.length),
        cfg('CAPACITACION_MODO'));
      if (horasDia + (siguienteMin + minServSiguiente) / 60 > cfgNum('JORNADA_DIARIA_MAX_H')) {
        noches++;
        indiceDia++;
        if (indiceDia >= ctx.dias.length) {
          return { ok: false, motivo: 'Mision ' + mision.id + ': excede los dias habiles de la semana.' };
        }
        dia = ctx.dias[indiceDia];
        reloj = enFechaHora(dia, cfg('HORA_INICIO_JORNADA'));
        horasDia = 0;
        colacionTomada = false;
      }
    }
  }

  // ---- Retorno a la base ------------------------------------------------
  if (ubicacion !== BASE_ID) {
    var tv = tramo(ubicacion, BASE_ID);
    var minVuelta = _minutosViajePorModo(tv, modo, decision);
    var costoVuelta = _costearTramo(tv, modo, tecnicos.length, decision, vehiculo);

    if (horasDia + minVuelta / 60 > cfgNum('JORNADA_DIARIA_MAX_H')) {
      noches++;
      indiceDia++;
      if (indiceDia < ctx.dias.length) {
        dia = ctx.dias[indiceDia];
        reloj = enFechaHora(dia, cfg('HORA_INICIO_JORNADA'));
        horasDia = 0;
      }
    }

    var salidaVuelta = new Date(reloj);
    var llegadaVuelta = sumarMin(salidaVuelta, minVuelta);
    tramos.push({
      TRAMO_ID: dbNuevoId('TR'),
      FECHA: aMedianoche(salidaVuelta),
      SECUENCIA: ++secuenciaTramo,
      ORIGEN_ID: ubicacion,
      ORIGEN_NOMBRE: ctx.destinos[ubicacion] ? ctx.destinos[ubicacion].COMUNA : ubicacion,
      DESTINO_ID: BASE_ID,
      DESTINO_NOMBRE: APP.BASE_NOMBRE,
      MODO: modo,
      KM: tv.km,
      MINUTOS: minVuelta,
      HORA_SALIDA: salidaVuelta,
      HORA_LLEGADA: llegadaVuelta,
      N_PASAJEROS: tecnicos.length,
      COSTO_COMBUSTIBLE: costoVuelta.combustible,
      COSTO_PEAJE: costoVuelta.peaje,
      COSTO_PASAJES: costoVuelta.pasajes,
      COSTO_TOTAL: costoVuelta.total,
      LLEGADA_NOCTURNA: siNo(llegadaVuelta > enFechaHora(salidaVuelta, cfg('HORA_LLEGADA_NOCTURNA'))),
      DESCANSO_REQUERIDO_H: 0,
      JUSTIFICACION: 'Retorno a base. ' + costoVuelta.nota
    });
    kmTotal += tv.km;
    peajeTotal += costoVuelta.peaje;
    pasajesTotal += costoVuelta.pasajes;
    horasViajeAcum += minVuelta / 60;
    reloj = llegadaVuelta;
  }

  // ---- Imputacion de horas a la agenda de cada tecnico ------------------
  var horasPorTecnico = horasViajeAcum + horasServicioAcum;
  var excedidos = [];
  idsTecnicos.forEach(function (id) {
    var a = ctx.agenda[id];
    var nuevoTotal = a.horasSemana + horasPorTecnico;
    if (nuevoTotal > cfgNum('HORAS_SEMANALES_LEGALES') + cfgNum('HORAS_EXTRA_MAX_SEMANA')) {
      excedidos.push(a.tecnico.NOMBRE);
    }
  });
  if (excedidos.length) {
    return { ok: false, motivo: 'Mision ' + mision.id + ': excede el tope legal semanal para ' + excedidos.join(', ') + '.' };
  }
  idsTecnicos.forEach(function (id) {
    var a = ctx.agenda[id];
    a.horasSemana += horasPorTecnico;
    a.horasExtra += Math.max(0, a.horasSemana - cfgNum('HORAS_SEMANALES_LEGALES'));
    a.ubicacionFinal = BASE_ID;
  });

  var costoTotal = _costoMision(kmTotal, peajeTotal, pasajesTotal, noches, tecnicos, indiceDia, fechaInicio, reloj, horasPorTecnico, vehiculo, modo, decision);

  return {
    ok: true,
    ot: ot,
    tramos: tramos,
    liderId: liderId,
    fechaInicio: fechaInicio,
    fechaFin: aMedianoche(reloj),
    kmTotal: kmTotal,
    noches: noches,
    costoTotal: costoTotal,
    horasViaje: horasViajeAcum,
    horasServicio: horasServicioAcum
  };
}

/** Primer dia de la semana en que todos los tecnicos tienen holgura. */
function _primerDiaComun(idsTecnicos, ctx) {
  for (var d = 0; d < ctx.dias.length; d++) {
    var todos = idsTecnicos.every(function (id) {
      var dia = ctx.agenda[id].dias[d];
      return dia && !dia.ocupado;
    });
    if (todos) return d;
  }
  return -1;
}

function _insertarColacionSiCorresponde(reloj, dia, tomada, minServicio) {
  if (tomada) return { reloj: reloj, tomada: true };
  var desde = enFechaHora(dia, cfg('VENTANA_COLACION_DESDE'));
  var hasta = enFechaHora(dia, cfg('VENTANA_COLACION_HASTA'));
  var finServicio = sumarMin(reloj, minServicio);

  // Se toma colacion si el bloque de trabajo invade la ventana.
  if (reloj < hasta && finServicio > desde) {
    var inicioColacion = reloj > desde ? reloj : desde;
    return { reloj: sumarMin(inicioColacion, cfgNum('COLACION_MIN')), tomada: true };
  }
  return { reloj: reloj, tomada: false };
}

function _minutosViajePorModo(t, modo, decision) {
  switch (modo) {
    case MODOS.AVION:
      // El tiempo aereo ya esta calculado a nivel de mision; se reparte
      // proporcionalmente al peso del tramo dentro de la ruta.
      return Math.round((decision.recomendado.horasViaje * 60) / 2);
    case MODOS.BUS:
      return Math.round(t.km / cfgNum('VEL_BUS_KMH') * 60 + 30);
    case MODOS.UBER:
      return Math.round(t.km / cfgNum('VEL_UBER_KMH') * 60);
    case MODOS.METRO_MICRO:
      return Math.round(t.km / cfgNum('VEL_TRANSPORTE_PUBLICO_KMH') * 60);
    default:
      return t.min;
  }
}

function _costearTramo(t, modo, nPasajeros, decision, vehiculo) {
  var salida = { combustible: 0, peaje: 0, pasajes: 0, total: 0, nota: '' };
  switch (modo) {
    case MODOS.CAMIONETA:
      var c = costoCombustible(t.km, vehiculo);
      salida.combustible = c.monto;
      salida.peaje = t.peaje;
      salida.nota = redondear(c.litros, 1) + ' L a ' + clp(c.precioLitro) + '/L' +
                    (t.peaje ? ' + peajes ' + clp(t.peaje) : '') + '. Fuente distancia: ' + t.fuente + '.';
      break;
    case MODOS.AVION:
      salida.pasajes = Math.round((decision.recomendado.detalle.pasajes || 0) / 2);
      salida.nota = 'Tramo aereo ' + (decision.recomendado.detalle.aerolinea || '') +
                    ', tarifa unitaria ida y vuelta ' + clp(decision.recomendado.detalle.tarifaUnitariaIdaVuelta || 0) +
                    ' (' + (decision.recomendado.detalle.fuenteTarifa || '') + ').';
      break;
    case MODOS.BUS:
      salida.pasajes = Math.round(t.km * cfgNum('TARIFA_BUS_CLP_KM') * nPasajeros);
      salida.nota = nPasajeros + ' pasaje(s) de bus a ' + clp(cfgNum('TARIFA_BUS_CLP_KM')) + '/km.';
      break;
    case MODOS.UBER:
      var minutos = t.km / cfgNum('VEL_UBER_KMH') * 60;
      var autos = Math.ceil(nPasajeros / 4);
      salida.pasajes = Math.round((cfgNum('UBER_TARIFA_BASE') + t.km * cfgNum('UBER_CLP_KM') + minutos * cfgNum('UBER_CLP_MIN')) * autos);
      salida.nota = autos + ' auto(s) de aplicacion para ' + nPasajeros + ' tecnico(s).';
      break;
    case MODOS.METRO_MICRO:
      salida.pasajes = Math.round(cfgNum('TARIFA_METRO_MICRO_VIAJE') * nPasajeros);
      salida.nota = nPasajeros + ' pasaje(s) Red Movilidad.';
      break;
  }
  salida.total = salida.combustible + salida.peaje + salida.pasajes;
  return salida;
}

function _costoMision(km, peajes, pasajes, noches, tecnicos, indiceDia, fechaInicio, fechaFin, horasPorTecnico, vehiculo, modo, decision) {
  var dias = Math.max(1, Math.round((aMedianoche(fechaFin) - aMedianoche(fechaInicio)) / MS_DIA) + 1);
  var v = valorizarDespacho({
    tecnicos: tecnicos,
    modo: modo,
    km: km,
    peajes: peajes,
    pasajes: pasajes,
    arriendo: modo === MODOS.AVION ? (decision.recomendado.detalle.arriendoVehiculo || 0) : 0,
    flete: modo === MODOS.AVION ? (decision.recomendado.detalle.carga || 0) : 0,
    noches: noches,
    diasTerreno: dias,
    horasViaje: horasPorTecnico,
    horasServicio: 0,
    vehiculo: vehiculo
  });
  return v.costoTotal;
}

// ---------------------------------------------------------------------------
//  6. PERSISTENCIA
// ---------------------------------------------------------------------------
function _persistirPlan(ctx) {
  if (ctx.cuadrillas.length) dbInsertarVarios(SH.CUADRILLAS, ctx.cuadrillas);
  if (ctx.tramos.length) dbInsertarVarios(SH.ITINERARIO, ctx.tramos);
  if (ctx.ot.length) {
    ctx.ot.sort(function (a, b) { return new Date(a.HORA_INICIO_PLAN) - new Date(b.HORA_INICIO_PLAN); });
    dbInsertarVarios(SH.OT, ctx.ot);
  }
  // Marca las camionetas comprometidas.
  Object.keys(ctx.flota).forEach(function (k) {
    if (ctx.flota[k].cuadrilla) {
      dbActualizar(SH.VEHICULOS, 'VEHICULO_ID', k, { ESTADO: 'EN_RUTA' });
    }
  });
  dbInvalidar();
}

// ---------------------------------------------------------------------------
//  7. FACTIBILIDAD  (la regla del tecnico en Maipu que no puede estar en Pucon)
// ---------------------------------------------------------------------------
/**
 * Responde si es posible asignar un servicio a un tecnico en una fecha y hora
 * dadas, considerando donde estara fisicamente en ese momento.
 *
 * @return {Object} { factible, motivo, primeraHoraFactible, minutosTraslado,
 *                    ubicacionPrevia, horasSemana, holguraSemanal }
 */
function verificarFactibilidad(tecnicoId, destinoId, fechaHora) {
  var cuando = new Date(fechaHora);
  var tecnico = dbUno(SH.TECNICOS, { TECNICO_ID: tecnicoId });
  if (!tecnico) return { factible: false, motivo: 'Tecnico inexistente.' };
  var destino = dbUno(SH.DESTINOS, { DESTINO_ID: destinoId });
  if (!destino) return { factible: false, motivo: 'Destino inexistente.' };

  var agenda = dbBuscar(SH.OT, { TECNICO_ID: tecnicoId })
    .filter(function (o) { return o.HORA_INICIO_PLAN && o.ESTADO !== 'NO_REALIZADA'; })
    .sort(function (a, b) { return new Date(a.HORA_INICIO_PLAN) - new Date(b.HORA_INICIO_PLAN); });

  // --- Donde esta justo antes del horario solicitado --------------------
  var previa = null, siguiente = null;
  agenda.forEach(function (o) {
    var fin = new Date(o.HORA_FIN_PLAN);
    var ini = new Date(o.HORA_INICIO_PLAN);
    if (fin <= cuando && (!previa || fin > new Date(previa.HORA_FIN_PLAN))) previa = o;
    if (ini >= cuando && (!siguiente || ini < new Date(siguiente.HORA_INICIO_PLAN))) siguiente = o;
  });

  var origenId = previa ? previa.DESTINO_ID : BASE_ID;
  var disponibleDesde = previa ? new Date(previa.HORA_FIN_PLAN) : enFechaHora(cuando, cfg('HORA_INICIO_JORNADA'));
  var t = tramo(origenId, destinoId);
  var llegadaMinima = sumarMin(disponibleDesde, t.min);

  // --- Horas semanales ---------------------------------------------------
  var semana = semanaISO(cuando);
  var horasSemana = _horasSemanaTecnico(tecnicoId, semana);
  var tope = cfgNum('HORAS_SEMANALES_LEGALES');
  var holgura = tope - horasSemana;

  var motivos = [];
  var factible = true;

  if (llegadaMinima > cuando) {
    factible = false;
    motivos.push('Imposible por continuidad geografica: a las ' + hhmm(disponibleDesde) +
      ' el tecnico esta en ' + (previa ? previa.COMUNA : 'la base') +
      ' y el traslado a ' + destino.COMUNA + ' toma ' + horasLegibles(t.min / 60) +
      ' (' + t.km + ' km). Lo antes que puede llegar es ' + hhmm(llegadaMinima) +
      ' del ' + ddmmyyyy(llegadaMinima) + '.');
  }

  if (siguiente) {
    var minServicio = minutosServicio(1, cfg('CAPACITACION_MODO'));
    var finPropuesto = sumarMin(cuando, minServicio);
    var viajeASiguiente = tramo(destinoId, siguiente.DESTINO_ID).min;
    if (sumarMin(finPropuesto, viajeASiguiente) > new Date(siguiente.HORA_INICIO_PLAN)) {
      factible = false;
      motivos.push('Choca con la OT ' + siguiente.OT_ID + ' en ' + siguiente.COMUNA +
        ' a las ' + hhmm(new Date(siguiente.HORA_INICIO_PLAN)) + '.');
    }
  }

  if (holgura < minutosServicio(1, cfg('CAPACITACION_MODO')) / 60) {
    factible = false;
    motivos.push('Sin holgura legal: lleva ' + horasLegibles(horasSemana) +
      ' de las ' + tope + ' h semanales.');
  }

  var horaJornada = minutosDelDia(cuando);
  var inicioJornada = Number(String(cfg('HORA_INICIO_JORNADA')).split(':')[0]) * 60;
  if (horaJornada < inicioJornada) {
    factible = false;
    motivos.push('Anterior al inicio de jornada (' + cfg('HORA_INICIO_JORNADA') + ').');
  }

  return {
    factible: factible,
    motivo: factible
      ? 'Asignacion posible. Traslado de ' + horasLegibles(t.min / 60) + ' desde ' +
        (previa ? previa.COMUNA : 'la base') + '.'
      : motivos.join(' '),
    primeraHoraFactible: llegadaMinima,
    minutosTraslado: t.min,
    kmTraslado: t.km,
    ubicacionPrevia: previa ? previa.COMUNA : APP.BASE_NOMBRE,
    horasSemana: redondear(horasSemana, 2),
    holguraSemanal: redondear(holgura, 2)
  };
}

function _horasSemanaTecnico(tecnicoId, semana) {
  var ot = dbBuscar(SH.OT, { TECNICO_ID: tecnicoId }).filter(function (o) {
    return o.FECHA && semanaISO(new Date(o.FECHA)) === semana;
  });
  var horasServicio = ot.reduce(function (a, o) {
    return a + (Number(o.DURACION_REAL_MIN) || Number(o.DURACION_PLAN_MIN) || 0) / 60;
  }, 0);

  var cuadrillas = {};
  ot.forEach(function (o) { if (o.CUADRILLA_ID) cuadrillas[o.CUADRILLA_ID] = true; });
  var horasViaje = dbLeer(SH.ITINERARIO)
    .filter(function (t) { return cuadrillas[t.CUADRILLA_ID] && semanaISO(new Date(t.FECHA)) === semana; })
    .reduce(function (a, t) { return a + (Number(t.MINUTOS) || 0) / 60; }, 0);

  return horasServicio + horasViaje;
}

/**
 * Sugiere el mejor tecnico para un servicio nuevo, ordenando por factibilidad,
 * cercania y holgura. Es la funcion que usa el coordinador cuando entra un
 * requerimiento de urgencia.
 */
function sugerirTecnico(destinoId, fechaHora) {
  var candidatos = dbLeer(SH.TECNICOS)
    .filter(function (t) { return esSi(t.ACTIVO); })
    .map(function (t) {
      var f = verificarFactibilidad(t.TECNICO_ID, destinoId, fechaHora);
      return {
        tecnicoId: t.TECNICO_ID,
        nombre: t.NOMBRE,
        factible: f.factible,
        minutosTraslado: f.minutosTraslado,
        kmTraslado: f.kmTraslado,
        ubicacionPrevia: f.ubicacionPrevia,
        holguraSemanal: f.holguraSemanal,
        primeraHoraFactible: f.primeraHoraFactible,
        motivo: f.motivo,
        puntaje: (f.factible ? 1000 : 0) - f.minutosTraslado + f.holguraSemanal * 8
      };
    });
  candidatos.sort(function (a, b) { return b.puntaje - a.puntaje; });
  return candidatos;
}
