/**
 * ============================================================================
 *  08_Costos.gs  ·  Valorizacion economica de la planificacion.
 * ============================================================================
 *  Traduce la planificacion a dinero: combustible, peajes, alojamiento,
 *  viaticos, pasajes y mano de obra; y determina cuanto hay que TRANSFERIR
 *  a cada tecnico antes de que salga a la ruta.
 *
 *  Distingue dos conceptos que suelen confundirse:
 *    - VIATICO: dinero que se entrega al tecnico (alojamiento, colacion, caja).
 *    - COSTO:   lo que la operacion le cuesta a la empresa (incluye mano de
 *               obra y depreciacion, que NO se transfieren a nadie).
 * ============================================================================
 */

/** Costo de combustible de un tramo. */
function costoCombustible(kms, vehiculo) {
  var rendimiento = vehiculo && Number(vehiculo.RENDIMIENTO_KM_L)
    ? Number(vehiculo.RENDIMIENTO_KM_L)
    : cfgNum('RENDIMIENTO_KM_LTS');
  rendimiento = rendimiento * cfgNum('FACTOR_CARGA_RENDIMIENTO');
  var precio = (vehiculo && String(vehiculo.COMBUSTIBLE).toUpperCase() === 'GASOLINA')
    ? cfgNum('PRECIO_GASOLINA_93_LTS')
    : cfgNum('PRECIO_DIESEL_LTS');
  var litros = kms / rendimiento;
  return { litros: redondear(litros, 2), monto: Math.round(litros * precio), precioLitro: precio };
}

/** Duracion de servicio de una OT segun modo de capacitacion. */
function minutosServicio(equipos, modoCapacitacion) {
  var instal = Number(equipos) * cfgNum('TIEMPO_INSTALACION_MIN');
  var setup = cfgNum('TIEMPO_SETUP_SITIO_MIN');
  var modo = modoCapacitacion || cfg('CAPACITACION_MODO');
  var capacitacion = 0;
  if (modo === 'PRESENCIAL') capacitacion = Number(equipos) * cfgNum('TIEMPO_CAPACITACION_MIN');
  else if (modo === 'MIXTO') capacitacion = Math.round(Number(equipos) * cfgNum('TIEMPO_CAPACITACION_MIN') * 0.4);
  // VIDEO_ASINCRONICO: 0 min en sitio, el video se envia en ruta.
  return instal + capacitacion + setup;
}

/** Ingreso que genera una OT. */
function ingresoOT(equipos, requiereCapacitacion) {
  var ingreso = Number(equipos) * cfgNum('VALOR_SERVICIO_INSTALACION');
  if (requiereCapacitacion !== false) {
    ingreso += Number(equipos) * cfgNum('VALOR_SERVICIO_CAPACITACION');
  }
  return Math.round(ingreso);
}

/**
 * Calcula el paquete economico completo de un despacho (cuadrilla).
 * @param {Object} despacho  { cuadrillaId, tecnicos[], modo, km, peajes,
 *                             noches, diasTerreno, equipos, pasajes,
 *                             arriendo, flete, horasViaje, horasServicio }
 */
function valorizarDespacho(despacho) {
  var n = despacho.tecnicos.length;
  var comb = costoCombustible(despacho.km || 0, despacho.vehiculo);

  var alojamiento = (despacho.noches || 0) * n * cfgNum('VALOR_ALOJAMIENTO_DIA');
  var viatico = (despacho.diasTerreno || 0) * n *
    ((despacho.noches > 0) ? cfgNum('VALOR_VIATICO_DIA') : cfgNum('VALOR_VIATICO_SIN_PERNOCTAR'));

  var manoObra = despacho.tecnicos.reduce(function (acc, t) {
    var costoHora = Number(t.COSTO_HORA) || cfgNum('COSTO_HORA_TECNICO');
    return acc + costoHora * ((despacho.horasViaje || 0) + (despacho.horasServicio || 0));
  }, 0);

  var directos = (despacho.modo === MODOS.CAMIONETA ? comb.monto + (despacho.peajes || 0) : 0) +
                 (despacho.pasajes || 0) + (despacho.arriendo || 0) + (despacho.flete || 0);

  return {
    combustible: despacho.modo === MODOS.CAMIONETA ? comb.monto : 0,
    litros: despacho.modo === MODOS.CAMIONETA ? comb.litros : 0,
    peajes: despacho.modo === MODOS.CAMIONETA ? (despacho.peajes || 0) : 0,
    pasajes: despacho.pasajes || 0,
    arriendo: despacho.arriendo || 0,
    flete: despacho.flete || 0,
    alojamiento: Math.round(alojamiento),
    viaticos: Math.round(viatico),
    manoObra: Math.round(manoObra),
    costosDirectos: Math.round(directos),
    costoCaja: Math.round(directos + alojamiento + viatico),
    costoTotal: Math.round(directos + alojamiento + viatico + manoObra)
  };
}

/**
 * Determina cuanto dinero recibe CADA tecnico antes de salir.
 * Regla de negocio:
 *   - Alojamiento y viatico: se transfieren a todos los tecnicos del despacho.
 *   - Combustible y peajes:  van como fondo a rendir SOLO al conductor.
 *   - Pasajes: los compra la empresa, no se transfieren (salvo bus local).
 *   - Holgura: % sobre el fondo a rendir para imprevistos de ruta.
 */
function calcularViaticos(semana) {
  semana = semana || cfg('SEMANA_PLANIFICACION');
  dbEliminar(SH.VIATICOS, { SEMANA: semana });

  var cuadrillas = dbLeer(SH.CUADRILLAS).filter(function (c) {
    return !semana || semanaISO(new Date(c.FECHA_INICIO)) === semana;
  });
  var tecnicos = indexarPor(dbLeer(SH.TECNICOS), 'TECNICO_ID');
  var itinerario = agruparPor(dbLeer(SH.ITINERARIO), 'CUADRILLA_ID');
  var filas = [];

  cuadrillas.forEach(function (c) {
    var ids = String(c.TECNICOS_IDS || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!ids.length) return;

    var tramos = itinerario[c.CUADRILLA_ID] || [];
    var combustible = sumarPor(tramos, 'COSTO_COMBUSTIBLE');
    var peajes = sumarPor(tramos, 'COSTO_PEAJE');
    var pasajes = sumarPor(tramos, 'COSTO_PASAJES');

    var noches = Number(c.NOCHES) || 0;
    var dias = _diasEntre(c.FECHA_INICIO, c.FECHA_FIN);
    var conductorId = _conductorDe(c, tecnicos);

    ids.forEach(function (tid) {
      var t = tecnicos[tid];
      if (!t) return;
      var esConductor = (tid === conductorId);

      var montoAlojamiento = noches * cfgNum('VALOR_ALOJAMIENTO_DIA');
      var montoViatico = dias * (noches > 0 ? cfgNum('VALOR_VIATICO_DIA') : cfgNum('VALOR_VIATICO_SIN_PERNOCTAR'));
      var fondoComb = esConductor ? Math.round(combustible) : 0;
      var fondoPeaje = esConductor ? Math.round(peajes) : 0;
      var montoPasajes = (c.MODO_TRANSPORTE === MODOS.CAMIONETA) ? 0 : Math.round(pasajes / ids.length);
      var holgura = Math.round((fondoComb + fondoPeaje) * cfgNum('FONDO_A_RENDIR_HOLGURA'));

      var total = redondearArriba(
        (montoAlojamiento + montoViatico) * cfgNum('ANTICIPO_PORCENTAJE') +
        fondoComb + fondoPeaje + holgura, 1000);

      filas.push({
        VIATICO_ID: dbNuevoId('VT'),
        SEMANA: semana,
        TECNICO_ID: tid,
        TECNICO_NOMBRE: t.NOMBRE,
        CUADRILLA_ID: c.CUADRILLA_ID,
        DIAS_TERRENO: dias,
        NOCHES: noches,
        MONTO_ALOJAMIENTO: montoAlojamiento,
        MONTO_VIATICO: montoViatico,
        MONTO_PASAJES: montoPasajes,
        FONDO_COMBUSTIBLE: fondoComb,
        FONDO_PEAJES: fondoPeaje,
        HOLGURA: holgura,
        TOTAL_TRANSFERIR: total,
        ESTADO: 'CALCULADO',
        FECHA_TRANSFERENCIA: '',
        RENDIDO_CLP: 0,
        SALDO_CLP: total,
        OBSERVACION: esConductor
          ? 'Conductor designado: lleva el fondo a rendir de combustible y peajes de la cuadrilla.'
          : 'Viatico personal (alojamiento + colacion).'
      });
    });
  });

  if (filas.length) dbInsertarVarios(SH.VIATICOS, filas);
  log('INFO', 'Costos', 'Viaticos calculados: ' + filas.length + ' registros, total ' + clp(sumarPor(filas, 'TOTAL_TRANSFERIR')));
  return filas;
}

function _diasEntre(a, b) {
  if (!a) return 1;
  var d1 = aMedianoche(new Date(a));
  var d2 = aMedianoche(new Date(b || a));
  return Math.max(1, Math.round((d2 - d1) / MS_DIA) + 1);
}

/** Primer tecnico del despacho con licencia vigente. */
function _conductorDe(cuadrilla, tecnicosIdx) {
  if (cuadrilla.LIDER_ID && tecnicosIdx[cuadrilla.LIDER_ID] &&
      esSi(tecnicosIdx[cuadrilla.LIDER_ID].PUEDE_CONDUCIR)) {
    return cuadrilla.LIDER_ID;
  }
  var ids = String(cuadrilla.TECNICOS_IDS || '').split(',').map(function (s) { return s.trim(); });
  for (var i = 0; i < ids.length; i++) {
    var t = tecnicosIdx[ids[i]];
    if (t && esSi(t.PUEDE_CONDUCIR)) return ids[i];
  }
  return ids[0] || '';
}

/**
 * Genera las lineas de gasto PRESUPUESTADAS a partir del itinerario.
 * El tecnico despues rinde contra estas lineas desde AppSheet, y el sistema
 * calcula el desvio automaticamente.
 */
function generarGastosPresupuestados(semana) {
  semana = semana || cfg('SEMANA_PLANIFICACION');
  var tramos = dbLeer(SH.ITINERARIO);
  var cuadrillas = indexarPor(dbLeer(SH.CUADRILLAS), 'CUADRILLA_ID');
  var tecnicos = indexarPor(dbLeer(SH.TECNICOS), 'TECNICO_ID');
  var filas = [];

  tramos.forEach(function (tr) {
    var c = cuadrillas[tr.CUADRILLA_ID];
    if (!c) return;
    if (semana && semanaISO(new Date(tr.FECHA)) !== semana) return;
    var conductorId = _conductorDe(c, tecnicos);
    var conductor = tecnicos[conductorId];

    function agregar(categoria, monto, descripcion, medio) {
      if (!monto) return;
      filas.push({
        GASTO_ID: dbNuevoId('GP'),
        FECHA: tr.FECHA,
        TECNICO_ID: conductorId,
        TECNICO_NOMBRE: conductor ? conductor.NOMBRE : '',
        CUADRILLA_ID: tr.CUADRILLA_ID,
        OT_ID: '',
        CATEGORIA: categoria,
        DESCRIPCION: descripcion,
        MONTO_CLP: 0,
        PRESUPUESTADO_CLP: Math.round(monto),
        DESVIO_CLP: 0,
        MEDIO_PAGO: medio,
        LITROS: '', KM_ODOMETRO: '', BOLETA_URL: '',
        ESTADO: 'BORRADOR',
        APROBADO_POR: '',
        COMENTARIO: 'Linea presupuestada automaticamente por el planificador.',
        REGISTRADO: new Date()
      });
    }

    agregar('COMBUSTIBLE', tr.COSTO_COMBUSTIBLE, 'Combustible tramo ' + tr.ORIGEN_NOMBRE + ' -> ' + tr.DESTINO_NOMBRE + ' (' + tr.KM + ' km)', 'EFECTIVO_VIATICO');
    agregar('PEAJE', tr.COSTO_PEAJE, 'Peajes tramo ' + tr.ORIGEN_NOMBRE + ' -> ' + tr.DESTINO_NOMBRE, 'TAG_EMPRESA');
    if (tr.MODO === MODOS.AVION) agregar('PASAJE_AEREO', tr.COSTO_PASAJES, 'Pasajes aereos ' + tr.ORIGEN_NOMBRE + ' -> ' + tr.DESTINO_NOMBRE, 'TARJETA_EMPRESA');
    if (tr.MODO === MODOS.BUS) agregar('PASAJE_BUS', tr.COSTO_PASAJES, 'Pasajes de bus ' + tr.ORIGEN_NOMBRE + ' -> ' + tr.DESTINO_NOMBRE, 'TARJETA_EMPRESA');
    if (tr.MODO === MODOS.UBER) agregar('TRANSPORTE_APP', tr.COSTO_PASAJES, 'Auto de aplicacion ' + tr.ORIGEN_NOMBRE + ' -> ' + tr.DESTINO_NOMBRE, 'PERSONAL_REEMBOLSABLE');
    if (tr.MODO === MODOS.METRO_MICRO) agregar('TRANSPORTE_PUBLICO', tr.COSTO_PASAJES, 'Pasajes Red ' + tr.ORIGEN_NOMBRE + ' -> ' + tr.DESTINO_NOMBRE, 'EFECTIVO_VIATICO');
  });

  // Alojamiento y viatico por tecnico y por dia.
  dbBuscar(SH.VIATICOS, { SEMANA: semana }).forEach(function (v) {
    if (v.MONTO_ALOJAMIENTO) {
      filas.push(_lineaGastoViatico(v, 'ALOJAMIENTO', v.MONTO_ALOJAMIENTO,
        v.NOCHES + ' noche(s) de alojamiento'));
    }
    if (v.MONTO_VIATICO) {
      filas.push(_lineaGastoViatico(v, 'VIATICO', v.MONTO_VIATICO,
        v.DIAS_TERRENO + ' dia(s) de viatico y colacion'));
    }
  });

  if (filas.length) dbInsertarVarios(SH.GASTOS, filas);
  log('INFO', 'Costos', 'Gastos presupuestados generados: ' + filas.length);
  return filas.length;
}

function _lineaGastoViatico(v, categoria, monto, descripcion) {
  return {
    GASTO_ID: dbNuevoId('GP'),
    FECHA: '',
    TECNICO_ID: v.TECNICO_ID,
    TECNICO_NOMBRE: v.TECNICO_NOMBRE,
    CUADRILLA_ID: v.CUADRILLA_ID,
    OT_ID: '',
    CATEGORIA: categoria,
    DESCRIPCION: descripcion,
    MONTO_CLP: 0,
    PRESUPUESTADO_CLP: Math.round(monto),
    DESVIO_CLP: 0,
    MEDIO_PAGO: 'EFECTIVO_VIATICO',
    LITROS: '', KM_ODOMETRO: '', BOLETA_URL: '',
    ESTADO: 'BORRADOR',
    APROBADO_POR: '',
    COMENTARIO: 'Linea presupuestada automaticamente por el planificador.',
    REGISTRADO: new Date()
  };
}

/**
 * Registra un gasto real desde AppSheet o desde la web app.
 * Calcula el desvio contra el presupuesto de la misma categoria y cuadrilla.
 */
function registrarGasto(datos) {
  var tecnico = dbUno(SH.TECNICOS, { TECNICO_ID: datos.tecnicoId });
  var presupuesto = 0;
  if (datos.cuadrillaId) {
    var lineas = dbBuscar(SH.GASTOS, {
      CUADRILLA_ID: datos.cuadrillaId,
      CATEGORIA: datos.categoria,
      TECNICO_ID: datos.tecnicoId
    });
    presupuesto = sumarPor(lineas, 'PRESUPUESTADO_CLP');
  }

  var fila = {
    GASTO_ID: dbNuevoId('GA'),
    FECHA: datos.fecha ? new Date(datos.fecha) : new Date(),
    TECNICO_ID: datos.tecnicoId,
    TECNICO_NOMBRE: tecnico ? tecnico.NOMBRE : '',
    CUADRILLA_ID: datos.cuadrillaId || '',
    OT_ID: datos.otId || '',
    CATEGORIA: datos.categoria,
    DESCRIPCION: datos.descripcion || '',
    MONTO_CLP: Math.round(Number(datos.monto) || 0),
    PRESUPUESTADO_CLP: presupuesto,
    DESVIO_CLP: Math.round((Number(datos.monto) || 0) - presupuesto),
    MEDIO_PAGO: datos.medioPago || 'EFECTIVO_VIATICO',
    LITROS: datos.litros || '',
    KM_ODOMETRO: datos.kmOdometro || '',
    BOLETA_URL: datos.boletaUrl || '',
    ESTADO: 'ENVIADO',
    APROBADO_POR: '',
    COMENTARIO: datos.comentario || '',
    REGISTRADO: new Date()
  };
  dbInsertar(SH.GASTOS, fila);
  _actualizarRendicionViatico(datos.tecnicoId, datos.cuadrillaId);
  log('INFO', 'Costos', 'Gasto registrado ' + fila.GASTO_ID + ' ' + fila.CATEGORIA + ' ' + clp(fila.MONTO_CLP));
  return fila;
}

function _actualizarRendicionViatico(tecnicoId, cuadrillaId) {
  if (!tecnicoId) return;
  var v = dbUno(SH.VIATICOS, { TECNICO_ID: tecnicoId, CUADRILLA_ID: cuadrillaId || '' });
  if (!v) return;
  var gastos = dbBuscar(SH.GASTOS, { TECNICO_ID: tecnicoId, CUADRILLA_ID: cuadrillaId || '' })
    .filter(function (g) { return g.ESTADO !== 'BORRADOR' && g.ESTADO !== 'RECHAZADO'; });
  var rendido = sumarPor(gastos, 'MONTO_CLP');
  dbActualizar(SH.VIATICOS, 'VIATICO_ID', v.VIATICO_ID, {
    RENDIDO_CLP: rendido,
    SALDO_CLP: Number(v.TOTAL_TRANSFERIR) - rendido,
    ESTADO: rendido > 0 ? 'RENDIDO' : v.ESTADO
  });
}

/** Marca como transferidos los viaticos de una semana. */
function marcarViaticosTransferidos(semana) {
  semana = semana || cfg('SEMANA_PLANIFICACION');
  var filas = dbBuscar(SH.VIATICOS, { SEMANA: semana });
  filas.forEach(function (v) {
    dbActualizar(SH.VIATICOS, 'VIATICO_ID', v.VIATICO_ID, {
      ESTADO: 'TRANSFERIDO',
      FECHA_TRANSFERENCIA: new Date()
    });
  });
  return filas.length;
}

/**
 * Resumen de tesoreria: cuanto hay que girar esta semana y a quien.
 */
function resumenTesoreria(semana) {
  semana = semana || cfg('SEMANA_PLANIFICACION');
  var viaticos = dbBuscar(SH.VIATICOS, { SEMANA: semana });
  var porTecnico = viaticos.map(function (v) {
    return {
      tecnicoId: v.TECNICO_ID,
      nombre: v.TECNICO_NOMBRE,
      cuadrilla: v.CUADRILLA_ID,
      dias: Number(v.DIAS_TERRENO),
      noches: Number(v.NOCHES),
      alojamiento: Number(v.MONTO_ALOJAMIENTO),
      viatico: Number(v.MONTO_VIATICO),
      fondoRendir: Number(v.FONDO_COMBUSTIBLE) + Number(v.FONDO_PEAJES) + Number(v.HOLGURA),
      total: Number(v.TOTAL_TRANSFERIR)
    };
  }).sort(function (a, b) { return b.total - a.total; });

  return {
    semana: semana,
    tecnicos: porTecnico,
    totalAlojamiento: sumarPor(viaticos, 'MONTO_ALOJAMIENTO'),
    totalViaticos: sumarPor(viaticos, 'MONTO_VIATICO'),
    totalPasajes: sumarPor(viaticos, 'MONTO_PASAJES'),
    totalFondos: sumarPor(viaticos, 'FONDO_COMBUSTIBLE') + sumarPor(viaticos, 'FONDO_PEAJES') + sumarPor(viaticos, 'HOLGURA'),
    totalTransferir: sumarPor(viaticos, 'TOTAL_TRANSFERIR')
  };
}
