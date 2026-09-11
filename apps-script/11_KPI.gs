/**
 * ============================================================================
 *  11_KPI.gs  ·  Indicadores, rentabilidad y fichas de desempeno.
 * ============================================================================
 *  Alimenta tres conversaciones concretas del negocio:
 *
 *   1. "Jefe, me puede subir el sueldo?"  -> fichaTecnico() entrega horas
 *      efectivas, equipos instalados, ingreso generado y margen aportado.
 *
 *   2. "Este servicio no sirve, no nos conviene" -> analisisRentabilidad()
 *      muestra por destino cuanto se factura, cuanto cuesta llegar y cual es
 *      el margen real; con eso se renegocia o se descarta con evidencia.
 *
 *   3. "Cuanta capacidad real tengo?" -> recalcularKPIs() separa horas
 *      productivas de horas de viaje, que es donde se pierde la semana.
 * ============================================================================
 */

/** Recalcula KPI_TECNICO, KPI_SEMANAL y RENTABILIDAD. */
function recalcularKPIs(semana) {
  semana = semana || cfg('SEMANA_PLANIFICACION');
  var porTecnico = _kpiPorTecnico(semana);
  var consolidado = _kpiSemanal(semana, porTecnico);
  var rentabilidad = _kpiRentabilidad(semana);

  dbEliminar(SH.KPI_TECNICO, { SEMANA: semana });
  dbEliminar(SH.KPI_SEMANAL, { SEMANA: semana });
  dbEliminar(SH.RENTABILIDAD, { SEMANA: semana });

  if (porTecnico.length) dbInsertarVarios(SH.KPI_TECNICO, porTecnico);
  if (consolidado.length) dbInsertarVarios(SH.KPI_SEMANAL, consolidado);
  if (rentabilidad.length) dbInsertarVarios(SH.RENTABILIDAD, rentabilidad);

  log('INFO', 'KPI', 'KPIs recalculados para ' + semana);
  return { tecnicos: porTecnico.length, indicadores: consolidado.length, destinos: rentabilidad.length };
}

// ---------------------------------------------------------------------------
function _kpiPorTecnico(semana) {
  var tecnicos = dbLeer(SH.TECNICOS).filter(function (t) { return esSi(t.ACTIVO); });
  var ot = dbLeer(SH.OT).filter(function (o) { return o.FECHA && semanaISO(new Date(o.FECHA)) === semana; });
  var calendario = dbBuscar(SH.CALENDARIO, { SEMANA: semana });
  var gastos = dbLeer(SH.GASTOS).filter(function (g) { return g.FECHA && semanaISO(new Date(g.FECHA)) === semana; });
  var tramosPorCuadrilla = agruparPor(dbLeer(SH.ITINERARIO), 'CUADRILLA_ID');
  var cuadrillas = indexarPor(dbLeer(SH.CUADRILLAS), 'CUADRILLA_ID');
  var tope = cfgNum('HORAS_SEMANALES_LEGALES');

  return tecnicos.map(function (t) {
    var misOt = ot.filter(function (o) { return o.TECNICO_ID === t.TECNICO_ID; });
    var misBloques = calendario.filter(function (b) { return b.TECNICO_ID === t.TECNICO_ID; });
    var misGastos = gastos.filter(function (g) { return g.TECNICO_ID === t.TECNICO_ID; });

    var horasServicio = sumarPor(misBloques.filter(function (b) { return b.BLOQUE === BLOQUES.SERVICIO; }), 'DURACION_H');
    var horasViaje = sumarPor(misBloques.filter(function (b) { return b.BLOQUE === BLOQUES.VIAJE; }), 'DURACION_H');
    var horasColacion = sumarPor(misBloques.filter(function (b) { return b.BLOQUE === BLOQUES.COLACION; }), 'DURACION_H');
    var horasTotales = horasServicio + horasViaje + (cfgBool('COLACION_IMPUTABLE') ? horasColacion : 0);
    var horasExtra = Math.max(0, horasTotales - tope);

    // Kilometros: se reparten entre los tecnicos de cada cuadrilla.
    var misCuadrillas = {};
    misOt.forEach(function (o) { if (o.CUADRILLA_ID) misCuadrillas[o.CUADRILLA_ID] = true; });
    var kms = 0;
    Object.keys(misCuadrillas).forEach(function (cid) {
      kms += sumarPor(tramosPorCuadrilla[cid] || [], 'KM');
    });

    var completadas = misOt.filter(function (o) { return o.ESTADO === 'COMPLETADA'; });
    var equipos = sumarPor(misOt, 'EQUIPOS');
    var ingreso = sumarPor(misOt, 'INGRESO_CLP');

    var costoHora = Number(t.COSTO_HORA) || cfgNum('COSTO_HORA_TECNICO');
    var costoManoObra = horasServicio * costoHora + horasViaje * costoHora +
                        horasExtra * costoHora * (cfgNum('RECARGO_HORA_EXTRA') - 1);
    var costoTerreno = sumarPor(misGastos, 'MONTO_CLP') || sumarPor(misGastos, 'PRESUPUESTADO_CLP');
    var costoTotal = costoManoObra + costoTerreno;
    var margen = ingreso - costoTotal;

    // Puntualidad y desvio sobre lo ejecutado.
    var conReal = misOt.filter(function (o) { return o.DURACION_REAL_MIN; });
    var desvioProm = conReal.length
      ? sumarPor(conReal, 'DESVIO_MIN') / conReal.length : 0;
    var puntuales = conReal.filter(function (o) {
      return Math.abs(Number(o.DESVIO_MIN) || 0) <= 15;
    }).length;

    var slaOk = misOt.filter(function (o) { return o.ESTADO !== 'NO_REALIZADA'; }).length;

    var utilizacion = tope > 0 ? horasTotales / tope : 0;
    var pctViaje = horasTotales > 0 ? horasViaje / horasTotales : 0;

    var semaforo = 'VERDE';
    if (utilizacion < 0.6 || (ingreso > 0 && margen / Math.max(1, ingreso) < 0.15)) semaforo = 'AMARILLO';
    if (utilizacion < 0.35 || margen < 0) semaforo = 'ROJO';
    if (horasTotales === 0) semaforo = 'ROJO';

    return {
      SEMANA: semana,
      TECNICO_ID: t.TECNICO_ID,
      NOMBRE: t.NOMBRE,
      OT_ASIGNADAS: misOt.length,
      OT_COMPLETADAS: completadas.length,
      EQUIPOS_INSTALADOS: equipos,
      CAPACITACIONES: misOt.filter(function (o) { return o.CAPACITACION_MODO !== ''; }).length,
      HORAS_EFECTIVAS: redondear(horasServicio, 2),
      HORAS_VIAJE: redondear(horasViaje, 2),
      HORAS_COLACION: redondear(horasColacion, 2),
      HORAS_TOTALES: redondear(horasTotales, 2),
      HORAS_EXTRA: redondear(horasExtra, 2),
      PCT_UTILIZACION: redondear(utilizacion, 4),
      PCT_TIEMPO_VIAJE: redondear(pctViaje, 4),
      KM_RECORRIDOS: redondear(kms, 1),
      COSTO_GENERADO: Math.round(costoTotal),
      INGRESO_GENERADO: Math.round(ingreso),
      MARGEN_CLP: Math.round(margen),
      MARGEN_PCT: ingreso > 0 ? redondear(margen / ingreso, 4) : 0,
      INGRESO_POR_HORA: horasTotales > 0 ? Math.round(ingreso / horasTotales) : 0,
      CUMPLIMIENTO_SLA_PCT: misOt.length ? redondear(slaOk / misOt.length, 4) : 0,
      PUNTUALIDAD_PCT: conReal.length ? redondear(puntuales / conReal.length, 4) : 0,
      DESVIO_PROMEDIO_MIN: redondear(desvioProm, 1),
      GASTO_RENDIDO: Math.round(sumarPor(misGastos, 'MONTO_CLP')),
      GASTO_PRESUPUESTADO: Math.round(sumarPor(misGastos, 'PRESUPUESTADO_CLP')),
      SEMAFORO: semaforo
    };
  });
}

// ---------------------------------------------------------------------------
function _kpiSemanal(semana, kpiTecnicos) {
  var ot = dbLeer(SH.OT).filter(function (o) { return o.FECHA && semanaISO(new Date(o.FECHA)) === semana; });
  var tramos = dbLeer(SH.ITINERARIO).filter(function (t) { return t.FECHA && semanaISO(new Date(t.FECHA)) === semana; });
  var viaticos = dbBuscar(SH.VIATICOS, { SEMANA: semana });
  var cuadrillas = dbLeer(SH.CUADRILLAS);
  var vehiculosUsados = {};
  cuadrillas.forEach(function (c) { if (c.VEHICULO_ID) vehiculosUsados[c.VEHICULO_ID] = true; });

  var equipos = sumarPor(ot, 'EQUIPOS');
  var ingreso = sumarPor(ot, 'INGRESO_CLP');
  var horasServicio = kpiTecnicos.reduce(function (a, k) { return a + k.HORAS_EFECTIVAS; }, 0);
  var horasViaje = kpiTecnicos.reduce(function (a, k) { return a + k.HORAS_VIAJE; }, 0);
  var horasTotales = horasServicio + horasViaje;
  var kms = sumarPor(tramos, 'KM');
  var combustible = sumarPor(tramos, 'COSTO_COMBUSTIBLE');
  var peajes = sumarPor(tramos, 'COSTO_PEAJE');
  var pasajes = sumarPor(tramos, 'COSTO_PASAJES');
  var alojamiento = sumarPor(viaticos, 'MONTO_ALOJAMIENTO');
  var viatico = sumarPor(viaticos, 'MONTO_VIATICO');
  var manoObra = kpiTecnicos.reduce(function (a, k) { return a + k.COSTO_GENERADO; }, 0);
  var costoTerreno = combustible + peajes + pasajes + alojamiento + viatico;
  var costoTotal = costoTerreno + cfgNum('COSTO_FIJO_SEMANAL');
  var margen = ingreso - costoTotal;
  var capacidad = kpiTecnicos.length * cfgNum('HORAS_SEMANALES_LEGALES');

  function fila(indicador, valor, unidad, meta, grupo, detalle) {
    var cumple = '';
    if (meta !== null && meta !== undefined && meta !== '') {
      cumple = (Number(valor) >= Number(meta)) ? 'SI' : 'NO';
    }
    return {
      SEMANA: semana, INDICADOR: indicador, VALOR: valor, UNIDAD: unidad,
      META: meta === null ? '' : meta, CUMPLE: cumple, GRUPO: grupo, DETALLE: detalle || ''
    };
  }

  return [
    fila('Equipos instalados', equipos, 'un', 33, 'PRODUCCION', 'Total de equipos puestos en marcha en la semana.'),
    fila('Ordenes de trabajo', ot.length, 'OT', null, 'PRODUCCION', 'Una OT por tecnico y sitio.'),
    fila('Localidades atendidas', Object.keys(agruparPor(ot, 'DESTINO_ID')).length, 'comunas', null, 'PRODUCCION', ''),
    fila('Cuadrillas despachadas', cuadrillas.length, 'un', null, 'PRODUCCION', 'Tamano variable segun carga de trabajo.'),

    fila('Horas efectivas de servicio', redondear(horasServicio, 1), 'h', null, 'TIEMPO', 'Horas realmente trabajadas en sitio.'),
    fila('Horas de viaje', redondear(horasViaje, 1), 'h', null, 'TIEMPO', 'Horas de traslado imputadas a la jornada.'),
    fila('Horas totales', redondear(horasTotales, 1), 'h', null, 'TIEMPO', ''),
    fila('Capacidad instalada', redondear(capacidad, 1), 'h', null, 'TIEMPO', kpiTecnicos.length + ' tecnicos x ' + cfgNum('HORAS_SEMANALES_LEGALES') + ' h.'),
    fila('Utilizacion de la dotacion', capacidad ? redondear(horasTotales / capacidad * 100, 1) : 0, '%', 75, 'TIEMPO', 'Horas ocupadas sobre capacidad legal.'),
    fila('Proporcion de tiempo en viaje', horasTotales ? redondear(horasViaje / horasTotales * 100, 1) : 0, '%', null, 'TIEMPO',
         'INDICADOR CRITICO: mide cuanta jornada se consume en carretera en vez de instalando.'),
    fila('Horas por equipo instalado', equipos ? redondear(horasTotales / equipos, 2) : 0, 'h/equipo', null, 'TIEMPO', ''),

    fila('Kilometros recorridos', redondear(kms, 0), 'km', null, 'LOGISTICA', ''),
    fila('Camionetas utilizadas', Object.keys(vehiculosUsados).length, 'un', null, 'LOGISTICA',
         'De una flota de ' + cfgNum('TOTAL_VEHICULOS') + '.'),
    fila('Utilizacion de flota', redondear(Object.keys(vehiculosUsados).length / cfgNum('TOTAL_VEHICULOS') * 100, 1), '%', null, 'LOGISTICA',
         'Si es baja, comprar mas camionetas no resuelve el cuello de botella.'),
    fila('Noches de alojamiento', sumarPor(viaticos, 'NOCHES'), 'noches', null, 'LOGISTICA', ''),

    fila('Costo de combustible', combustible, 'CLP', null, 'COSTOS', redondear(kms / (cfgNum('RENDIMIENTO_KM_LTS') * cfgNum('FACTOR_CARGA_RENDIMIENTO')), 1) + ' litros.'),
    fila('Costo de peajes', peajes, 'CLP', null, 'COSTOS', ''),
    fila('Costo de pasajes', pasajes, 'CLP', null, 'COSTOS', 'Aereos, bus y transporte urbano.'),
    fila('Costo de alojamiento', alojamiento, 'CLP', null, 'COSTOS', ''),
    fila('Viaticos', viatico, 'CLP', null, 'COSTOS', ''),
    fila('Costo de mano de obra', Math.round(manoObra), 'CLP', null, 'COSTOS', 'Incluye recargo de horas extra.'),
    fila('Costo directo de terreno', costoTerreno, 'CLP', null, 'COSTOS', 'Lo que se desembolsa para ejecutar la semana.'),
    fila('Costo total', Math.round(costoTotal), 'CLP', null, 'COSTOS', 'Incluye overhead de ' + clp(cfgNum('COSTO_FIJO_SEMANAL')) + '.'),
    fila('Costo por equipo instalado', equipos ? Math.round(costoTotal / equipos) : 0, 'CLP', null, 'COSTOS', ''),

    fila('Ingreso facturable', Math.round(ingreso), 'CLP', null, 'COMERCIAL', ''),
    fila('Margen bruto', Math.round(margen), 'CLP', null, 'COMERCIAL', ''),
    fila('Margen bruto porcentual', ingreso ? redondear(margen / ingreso * 100, 1) : 0, '%', redondear(cfgNum('MARGEN_OBJETIVO') * 100, 1), 'COMERCIAL', ''),
    fila('Viaticos a transferir', sumarPor(viaticos, 'TOTAL_TRANSFERIR'), 'CLP', null, 'TESORERIA',
         'Dinero que debe estar en las cuentas de los tecnicos antes del lunes.')
  ];
}

// ---------------------------------------------------------------------------
function _kpiRentabilidad(semana) {
  var ot = dbLeer(SH.OT).filter(function (o) { return o.FECHA && semanaISO(new Date(o.FECHA)) === semana; });
  if (!ot.length) return [];
  var destinos = indexarPor(dbLeer(SH.DESTINOS), 'DESTINO_ID');
  var tramos = dbLeer(SH.ITINERARIO);
  var cuadrillas = indexarPor(dbLeer(SH.CUADRILLAS), 'CUADRILLA_ID');
  var viaticos = dbBuscar(SH.VIATICOS, { SEMANA: semana });
  var calendario = dbBuscar(SH.CALENDARIO, { SEMANA: semana });
  var porDestino = agruparPor(ot, 'DESTINO_ID');
  var objetivo = cfgNum('MARGEN_OBJETIVO');

  return Object.keys(porDestino).map(function (destinoId) {
    var lista = porDestino[destinoId];
    var d = destinos[destinoId];
    var equipos = sumarPor(lista, 'EQUIPOS');
    var ingreso = sumarPor(lista, 'INGRESO_CLP');

    // Costo de traslado imputado: los tramos que llegan a este destino mas
    // la parte proporcional del retorno de la cuadrilla.
    var cuadrillaIds = {};
    lista.forEach(function (o) { if (o.CUADRILLA_ID) cuadrillaIds[o.CUADRILLA_ID] = true; });
    var costoTraslado = 0, horasViaje = 0;
    Object.keys(cuadrillaIds).forEach(function (cid) {
      var deLaCuadrilla = tramos.filter(function (t) { return t.CUADRILLA_ID === cid; });
      var sitiosDeLaCuadrilla = Object.keys(agruparPor(
        ot.filter(function (o) { return o.CUADRILLA_ID === cid; }), 'DESTINO_ID')).length || 1;
      costoTraslado += sumarPor(deLaCuadrilla, 'COSTO_TOTAL') / sitiosDeLaCuadrilla;
      horasViaje += sumarPor(deLaCuadrilla, 'MINUTOS') / 60 / sitiosDeLaCuadrilla;
    });

    var horasServicio = sumarPor(
      calendario.filter(function (b) {
        return b.BLOQUE === BLOQUES.SERVICIO && b.UBICACION === (d ? d.COMUNA : '');
      }), 'DURACION_H');

    var costoManoObra = (horasServicio + horasViaje) * cfgNum('COSTO_HORA_TECNICO');

    var viaticosDestino = 0, alojamientoDestino = 0;
    Object.keys(cuadrillaIds).forEach(function (cid) {
      var v = viaticos.filter(function (x) { return x.CUADRILLA_ID === cid; });
      var sitios = Object.keys(agruparPor(ot.filter(function (o) { return o.CUADRILLA_ID === cid; }), 'DESTINO_ID')).length || 1;
      viaticosDestino += sumarPor(v, 'MONTO_VIATICO') / sitios;
      alojamientoDestino += sumarPor(v, 'MONTO_ALOJAMIENTO') / sitios;
    });

    var costoTotal = costoTraslado + costoManoObra + viaticosDestino + alojamientoDestino;
    var margen = ingreso - costoTotal;
    var margenPct = ingreso ? margen / ingreso : 0;

    var veredicto;
    if (margenPct >= objetivo) {
      veredicto = 'RENTABLE. Margen sobre el objetivo de ' + redondear(objetivo * 100, 0) + '%.';
    } else if (margenPct > 0) {
      veredicto = 'MARGEN BAJO. Agrupar con otros servicios de la zona o renegociar tarifa: ' +
                  'el traslado se lleva ' + (costoTotal ? redondear(costoTraslado / costoTotal * 100, 0) : 0) + '% del costo.';
    } else {
      veredicto = 'PERDIDA. No se justifica un viaje dedicado: ' +
                  'atender solo en conjunto con otra localidad de la zona, o via tecnico residente.';
    }

    return {
      SEMANA: semana,
      DESTINO_ID: destinoId,
      COMUNA: d ? d.COMUNA : destinoId,
      EQUIPOS: equipos,
      INGRESO_CLP: Math.round(ingreso),
      COSTO_MANO_OBRA: Math.round(costoManoObra),
      COSTO_TRASLADO: Math.round(costoTraslado),
      COSTO_ALOJAMIENTO: Math.round(alojamientoDestino),
      COSTO_VIATICO: Math.round(viaticosDestino),
      COSTO_TOTAL: Math.round(costoTotal),
      MARGEN_CLP: Math.round(margen),
      MARGEN_PCT: redondear(margenPct, 4),
      COSTO_POR_EQUIPO: equipos ? Math.round(costoTotal / equipos) : 0,
      HORAS_TOTALES: redondear(horasServicio + horasViaje, 2),
      VEREDICTO: veredicto
    };
  }).sort(function (a, b) { return a.MARGEN_PCT - b.MARGEN_PCT; });
}

// ---------------------------------------------------------------------------
//  Fichas de analisis
// ---------------------------------------------------------------------------
/**
 * Ficha completa de un tecnico: el respaldo objetivo para una conversacion
 * de desempeno, aumento o reasignacion.
 */
function fichaTecnico(tecnicoId, semana) {
  semana = semana || cfg('SEMANA_PLANIFICACION');
  var t = dbUno(SH.TECNICOS, { TECNICO_ID: tecnicoId });
  if (!t) return null;
  var k = dbUno(SH.KPI_TECNICO, { TECNICO_ID: tecnicoId, SEMANA: semana });
  if (!k) return { tecnicoId: tecnicoId, nombre: t.NOMBRE, sinDatos: true, semana: semana };

  var pares = dbBuscar(SH.KPI_TECNICO, { SEMANA: semana });
  function ranking(campo, mayorEsMejor) {
    var ordenados = pares.slice().sort(function (a, b) {
      return mayorEsMejor ? Number(b[campo]) - Number(a[campo]) : Number(a[campo]) - Number(b[campo]);
    });
    for (var i = 0; i < ordenados.length; i++) {
      if (ordenados[i].TECNICO_ID === tecnicoId) return i + 1;
    }
    return ordenados.length;
  }
  function promedio(campo) {
    return pares.length ? sumarPor(pares, campo) / pares.length : 0;
  }

  var costoSemanal = Number(t.COSTO_HORA) * cfgNum('HORAS_SEMANALES_LEGALES');
  var margen = Number(k.MARGEN_CLP);
  var retorno = costoSemanal ? margen / costoSemanal : 0;

  var argumentos = [];
  argumentos.push('En la semana ' + semana + ' instalo ' + k.EQUIPOS_INSTALADOS +
    ' equipo(s) en ' + k.OT_ASIGNADAS + ' orden(es) de trabajo.');
  argumentos.push('Trabajo ' + horasLegibles(Number(k.HORAS_TOTALES)) + ' de las ' +
    cfgNum('HORAS_SEMANALES_LEGALES') + ' h legales (' + redondear(Number(k.PCT_UTILIZACION) * 100, 1) + '% de utilizacion), ' +
    'de las cuales ' + horasLegibles(Number(k.HORAS_VIAJE)) + ' fueron traslado (' +
    redondear(Number(k.PCT_TIEMPO_VIAJE) * 100, 1) + '%).');
  argumentos.push('Genero ' + clp(k.INGRESO_GENERADO) + ' de ingreso con un costo asociado de ' +
    clp(k.COSTO_GENERADO) + ': margen de ' + clp(margen) + ' (' + redondear(Number(k.MARGEN_PCT) * 100, 1) + '%).');
  argumentos.push('Ingreso por hora trabajada: ' + clp(k.INGRESO_POR_HORA) +
    ' contra un costo hora de ' + clp(t.COSTO_HORA) + '.');
  argumentos.push('Por cada peso de remuneracion semanal aporta ' + redondear(retorno, 2) + ' pesos de margen.');
  argumentos.push('Ranking interno: #' + ranking('EQUIPOS_INSTALADOS', true) + ' de ' + pares.length +
    ' en equipos instalados, #' + ranking('MARGEN_CLP', true) + ' en margen aportado.');
  if (Number(k.DESVIO_PROMEDIO_MIN)) {
    argumentos.push('Desvio promedio respecto de lo planificado: ' + k.DESVIO_PROMEDIO_MIN +
      ' min por OT (' + (Number(k.DESVIO_PROMEDIO_MIN) > 0 ? 'por sobre' : 'por debajo de') + ' lo estimado).');
  }

  var recomendacion;
  if (k.SEMAFORO === 'VERDE' && retorno > 1.5) {
    recomendacion = 'Desempeno solido y rentable. La solicitud de aumento tiene respaldo: ' +
      'aporta ' + clp(margen) + ' de margen semanal sobre un costo de ' + clp(costoSemanal) + '.';
  } else if (k.SEMAFORO === 'VERDE') {
    recomendacion = 'Desempeno correcto pero con retorno ajustado. Antes de un aumento conviene ' +
      'subir su utilizacion o asignarle rutas de mayor densidad de equipos.';
  } else if (k.SEMAFORO === 'AMARILLO') {
    recomendacion = 'Utilizacion o margen bajo el estandar. Revisar si la causa es asignacion ' +
      '(rutas con mucho viaje y pocos equipos) antes de atribuirlo al desempeno individual.';
  } else {
    recomendacion = 'Semana bajo estandar. Revisar asignacion, disponibilidad y causas de OT no realizadas.';
  }

  return {
    tecnicoId: tecnicoId,
    nombre: t.NOMBRE,
    cargo: t.CARGO,
    especialidad: t.ESPECIALIDAD,
    semana: semana,
    kpi: k,
    costoSemanal: Math.round(costoSemanal),
    retornoPorPesoRemunerado: redondear(retorno, 2),
    rankingEquipos: ranking('EQUIPOS_INSTALADOS', true),
    rankingMargen: ranking('MARGEN_CLP', true),
    promedioEquiposEquipo: redondear(promedio('EQUIPOS_INSTALADOS'), 1),
    argumentos: argumentos,
    recomendacion: recomendacion
  };
}

/**
 * Analisis de rentabilidad de un destino o del portafolio completo.
 * Es la respuesta cuantitativa a "este servicio no nos conviene".
 */
function analisisRentabilidad(semana, destinoId) {
  semana = semana || cfg('SEMANA_PLANIFICACION');
  var filas = dbBuscar(SH.RENTABILIDAD, { SEMANA: semana });
  if (destinoId) filas = filas.filter(function (f) { return f.DESTINO_ID === destinoId; });
  if (!filas.length) return { semana: semana, sinDatos: true };

  var ingreso = sumarPor(filas, 'INGRESO_CLP');
  var costo = sumarPor(filas, 'COSTO_TOTAL');
  var rentables = filas.filter(function (f) { return Number(f.MARGEN_PCT) >= cfgNum('MARGEN_OBJETIVO'); });
  var perdida = filas.filter(function (f) { return Number(f.MARGEN_CLP) < 0; });

  var conclusiones = [];
  conclusiones.push('Portafolio de la semana: ' + filas.length + ' localidades, ' +
    clp(ingreso) + ' de ingreso contra ' + clp(costo) + ' de costo, margen de ' +
    clp(ingreso - costo) + ' (' + redondear((ingreso - costo) / Math.max(1, ingreso) * 100, 1) + '%).');
  conclusiones.push(rentables.length + ' localidad(es) superan el margen objetivo de ' +
    redondear(cfgNum('MARGEN_OBJETIVO') * 100, 0) + '%.');
  if (perdida.length) {
    conclusiones.push('Con perdida: ' + perdida.map(function (f) {
      return f.COMUNA + ' (' + clp(f.MARGEN_CLP) + ')';
    }).join(', ') + '. En todos los casos el costo de traslado supera el ingreso del sitio: ' +
      'la solucion no es subir la tarifa sino agrupar la visita con otra localidad de la misma zona.');
  }
  var peor = filas[0];
  var mejor = filas[filas.length - 1];
  if (peor && mejor) {
    conclusiones.push('Mejor caso: ' + mejor.COMUNA + ' con ' + redondear(Number(mejor.MARGEN_PCT) * 100, 1) +
      '% de margen y ' + clp(mejor.COSTO_POR_EQUIPO) + ' de costo por equipo. ' +
      'Peor caso: ' + peor.COMUNA + ' con ' + redondear(Number(peor.MARGEN_PCT) * 100, 1) +
      '% y ' + clp(peor.COSTO_POR_EQUIPO) + ' por equipo.');
  }

  return {
    semana: semana,
    destinos: filas,
    totalIngreso: Math.round(ingreso),
    totalCosto: Math.round(costo),
    margen: Math.round(ingreso - costo),
    margenPct: ingreso ? redondear((ingreso - costo) / ingreso, 4) : 0,
    conclusiones: conclusiones
  };
}

/** Datos agregados que alimentan el dashboard de la web app. */
function datosDashboard(semana) {
  semana = semana || cfg('SEMANA_PLANIFICACION');
  var kpis = dbBuscar(SH.KPI_SEMANAL, { SEMANA: semana });
  var indicador = {};
  kpis.forEach(function (k) { indicador[k.INDICADOR] = Number(k.VALOR); });

  var ot = dbLeer(SH.OT).filter(function (o) { return o.FECHA && semanaISO(new Date(o.FECHA)) === semana; });
  var porEstado = agruparPor(ot, 'ESTADO');
  var tramos = dbLeer(SH.ITINERARIO).filter(function (t) { return t.FECHA && semanaISO(new Date(t.FECHA)) === semana; });
  var porModo = agruparPor(tramos, 'MODO');

  return {
    semana: semana,
    indicadores: kpis,
    resumen: {
      equipos: indicador['Equipos instalados'] || 0,
      ot: ot.length,
      horasServicio: indicador['Horas efectivas de servicio'] || 0,
      horasViaje: indicador['Horas de viaje'] || 0,
      utilizacion: indicador['Utilizacion de la dotacion'] || 0,
      pctViaje: indicador['Proporcion de tiempo en viaje'] || 0,
      km: indicador['Kilometros recorridos'] || 0,
      costoTotal: indicador['Costo total'] || 0,
      ingreso: indicador['Ingreso facturable'] || 0,
      margen: indicador['Margen bruto'] || 0,
      margenPct: indicador['Margen bruto porcentual'] || 0,
      viaticos: indicador['Viaticos a transferir'] || 0
    },
    costos: {
      combustible: indicador['Costo de combustible'] || 0,
      peajes: indicador['Costo de peajes'] || 0,
      pasajes: indicador['Costo de pasajes'] || 0,
      alojamiento: indicador['Costo de alojamiento'] || 0,
      viaticos: indicador['Viaticos'] || 0,
      manoObra: indicador['Costo de mano de obra'] || 0
    },
    estadosOT: Object.keys(porEstado).map(function (e) {
      return { estado: e, cantidad: porEstado[e].length };
    }),
    modosTransporte: Object.keys(porModo).map(function (m) {
      return {
        modo: m,
        tramos: porModo[m].length,
        km: redondear(sumarPor(porModo[m], 'KM'), 0),
        costo: sumarPor(porModo[m], 'COSTO_TOTAL')
      };
    }),
    tecnicos: dbBuscar(SH.KPI_TECNICO, { SEMANA: semana }),
    rentabilidad: dbBuscar(SH.RENTABILIDAD, { SEMANA: semana }),
    tesoreria: resumenTesoreria(semana)
  };
}
