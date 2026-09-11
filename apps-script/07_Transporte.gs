/**
 * ============================================================================
 *  07_Transporte.gs  ·  Motor de decision del modo de traslado.
 * ============================================================================
 *  Responde: conviene camioneta, avion, bus, metro o micro?
 *
 *  El criterio NO es el costo de los pasajes: es el COSTO TOTAL DE LA MISION,
 *  que suma cuatro componentes que se mueven en direcciones opuestas:
 *
 *     costo_total = costo_directo          (combustible, peajes, pasajes, arriendo)
 *                 + costo_alojamiento      (noches que el modo obliga a pagar)
 *                 + costo_oportunidad      (horas-tecnico quemadas viajando)
 *                 + penalizaciones         (carga, riesgo, falta de vehiculo)
 *
 *  Por eso un pasaje de avion de $105.000 puede ser mas barato que $88.000 de
 *  petroleo: 18 horas de camioneta a Copiapo son 2 dias de trabajo perdidos de
 *  tres tecnicos, mas dos noches de hotel que el avion no necesita.
 * ============================================================================
 */

var MODOS = {
  CAMIONETA: 'CAMIONETA',
  AVION: 'AVION',
  BUS: 'BUS',
  METRO_MICRO: 'METRO_MICRO'
};

/**
 * Evalua todos los modos posibles para una mision y los devuelve rankeados.
 *
 * @param {Object} mision
 *   @param {string}   mision.destinoId
 *   @param {number}   mision.nTecnicos
 *   @param {number}   mision.equipos        equipos a instalar en destino
 *   @param {number}   mision.diasEnDestino  dias de permanencia
 *   @param {boolean}  mision.hayVehiculo    hay camioneta disponible
 *   @param {boolean}  mision.hayConductor   alguien del grupo tiene licencia
 *   @param {string[]} mision.secuencia      destinos encadenados (opcional)
 * @return {Object} { recomendado, opciones[], justificacion }
 */
function evaluarModosTransporte(mision) {
  var destinos = indexarPor(dbLeer(SH.DESTINOS), 'DESTINO_ID');
  var destino = destinos[mision.destinoId];
  if (!destino) throw new Error('Destino inexistente: ' + mision.destinoId);

  var n = Math.max(1, Number(mision.nTecnicos) || 1);
  var equipos = Number(mision.equipos) || 0;
  var dias = Math.max(1, Number(mision.diasEnDestino) || 1);
  var secuencia = (mision.secuencia && mision.secuencia.length) ? mision.secuencia : [mision.destinoId];

  var kmRuta = kmDeRuta(secuencia, true);
  var peajeRuta = peajeDeRuta(secuencia, true);
  var minRuta = _minutosDeRuta(secuencia, true);


  var ctx = {
    destino: destino, n: n, equipos: equipos, dias: dias,
    kmRuta: kmRuta, peajeRuta: peajeRuta, minRuta: minRuta,
    secuencia: secuencia,
    hayVehiculo: mision.hayVehiculo !== false,
    hayConductor: mision.hayConductor !== false
  };

  var opciones = [
    _evaluarCamioneta(ctx),
    _evaluarAvion(ctx),
    _evaluarBus(ctx),
    _evaluarMetroMicro(ctx)
  ].filter(Boolean);

  opciones.forEach(function (o) {
    o.costoOportunidad = Math.round(o.horasViaje * n * cfgNum('COSTO_HORA_TECNICO') * cfgNum('PESO_HORA_VIAJE_EN_DECISION'));
    o.costoAlojamiento = Math.round(o.nochesRequeridas * n * cfgNum('VALOR_ALOJAMIENTO_DIA'));
    o.costoViatico = Math.round(o.diasTotales * n * cfgNum('VALOR_VIATICO_DIA'));
    o.costoTotal = o.costoDirecto + o.costoAlojamiento + o.costoViatico + o.costoOportunidad + (o.penalizacion || 0);
    o.costoCaja = o.costoDirecto + o.costoAlojamiento + o.costoViatico;  // desembolso real
  });

  var viables = opciones.filter(function (o) { return o.viable; });
  viables.sort(function (a, b) { return a.costoTotal - b.costoTotal; });

  var recomendado = viables.length ? viables[0] : opciones[0];
  var segundo = viables.length > 1 ? viables[1] : null;

  return {
    destinoId: mision.destinoId,
    comuna: destino.COMUNA,
    nTecnicos: n,
    recomendado: recomendado,
    opciones: opciones.sort(function (a, b) {
      if (a.viable !== b.viable) return a.viable ? -1 : 1;
      return a.costoTotal - b.costoTotal;
    }),
    justificacion: _redactarJustificacion(recomendado, segundo, ctx)
  };
}

function _minutosDeRuta(ids, cerrarCiclo) {
  if (!ids.length) return 0;
  var total = tramo(BASE_ID, ids[0]).min;
  for (var i = 0; i < ids.length - 1; i++) total += tramo(ids[i], ids[i + 1]).min;
  if (cerrarCiclo !== false) total += tramo(ids[ids.length - 1], BASE_ID).min;
  return total;
}

// ---------------------------------------------------------------------------
//  CAMIONETA
// ---------------------------------------------------------------------------
function _evaluarCamioneta(ctx) {
  var rendimiento = cfgNum('RENDIMIENTO_KM_LTS') * cfgNum('FACTOR_CARGA_RENDIMIENTO');
  var litros = ctx.kmRuta / rendimiento;
  var combustible = Math.round(litros * cfgNum('PRECIO_DIESEL_LTS'));

  // Pausas obligatorias de conduccion: 30 min cada 4,5 h al volante.
  var horasVolante = ctx.minRuta / 60;
  var pausas = Math.floor(horasVolante / cfgNum('CONDUCCION_CONTINUA_MAX_H'));
  var horasViaje = horasVolante + pausas * (cfgNum('PAUSA_CONDUCCION_MIN') / 60);

  // Noches: las de permanencia mas las que obliga el propio traslado.
  var nochesPermanencia = ctx.destino.REQUIERE_PERNOCTAR === 'SI' ? ctx.dias : 0;
  var nochesTraslado = _nochesPorTraslado(horasViaje);
  var noches = nochesPermanencia + nochesTraslado;

  var o = {
    modo: MODOS.CAMIONETA,
    etiqueta: 'Camioneta de la empresa (Peugeot Partner)',
    viable: true,
    km: ctx.kmRuta,
    horasViaje: redondear(horasViaje, 2),
    diasTotales: ctx.dias + Math.ceil(horasViaje / 8),
    nochesRequeridas: noches,
    litros: redondear(litros, 1),
    costoDirecto: combustible + ctx.peajeRuta,
    detalle: {
      combustible: combustible,
      peajes: ctx.peajeRuta,
      litros: redondear(litros, 1),
      pausasConduccion: pausas
    },
    motivos: []
  };

  if (!ctx.hayVehiculo) {
    o.viable = false;
    o.motivos.push('No hay camioneta disponible en la flota para estas fechas.');
  }
  if (!ctx.hayConductor) {
    o.viable = false;
    o.motivos.push('Ningun tecnico del grupo tiene licencia vigente.');
  }
  if (o.viable) {
    o.motivos.push('Autonomia para desplazarse entre sitios.');
    o.motivos.push('Da autonomia total en destino, sin depender de arriendos ni horarios.');
    if (horasViaje > 9) o.motivos.push('ALERTA: ' + horasLegibles(horasViaje) + ' de traslado consumen mas de una jornada completa.');
  }
  return o;
}

/** Un traslado de mas de ~10 h obliga a pernoctar en ruta. */
function _nochesPorTraslado(horasViaje) {
  if (horasViaje <= 9) return 0;
  if (horasViaje <= 14) return 1;
  return 2;
}

// ---------------------------------------------------------------------------
//  AVION
// ---------------------------------------------------------------------------
function _evaluarAvion(ctx) {
  var iata = String(ctx.destino.AEROPUERTO_IATA || '').trim();
  var o = {
    modo: MODOS.AVION,
    etiqueta: 'Avion + bus y micro en destino',
    viable: true,
    km: ctx.kmRuta,
    motivos: []
  };

  if (!iata || iata === 'SCL') {
    o.viable = false;
    o.motivos.push('El destino no tiene aeropuerto propio: se atiende desde Santiago por tierra.');
    o.costoDirecto = 0; o.horasViaje = 0; o.nochesRequeridas = 0; o.diasTotales = ctx.dias;
    return o;
  }
  if (ctx.kmRuta < cfgNum('UMBRAL_KM_EVALUAR_VUELO')) {
    o.viable = false;
    o.motivos.push('Distancia bajo el umbral de ' + cfgNum('UMBRAL_KM_EVALUAR_VUELO') + ' km: volar no compensa el tiempo de aeropuerto.');
    o.costoDirecto = 0; o.horasViaje = 0; o.nochesRequeridas = 0; o.diasTotales = ctx.dias;
    return o;
  }

  var tarifa = tarifaAerea('SCL', iata, new Date());
  var pasajes = tarifa.idaVuelta * ctx.n;

  // Tiempo puerta a puerta, ida y vuelta.
  var minAeropuertoSantiago = tramo(BASE_ID, BASE_ID).min + 45;
  var horasViaje = 2 * (
    45 / 60 +                                        // base -> SCL
    cfgNum('CHECKIN_AEROPUERTO_MIN') / 60 +
    tarifa.duracionMin / 60 +
    cfgNum('SALIDA_AEROPUERTO_MIN') / 60 +
    Number(ctx.destino.KM_AEROPUERTO_DESTINO) / cfgNum('VEL_CARRETERA_KMH')
  );

  // El vuelo entra por el primer aeropuerto y vuelve por el mismo. Las
  // conexiones entre sitios se recorren por tierra y deben volver al primero.
  if (ctx.secuencia.length > 1) {
    o.viable = false;
    o.motivos.push('Para comparar avion, seleccione un solo destino. El circuito de varias localidades se planifica por tierra en esta demo.');
  }

  var movilidadLocal = cfgNum('TARIFA_METRO_MICRO_VIAJE') * 2 * ctx.n * ctx.dias;
  var trasladosSantiago = cfgNum('TRASLADO_AEROPUERTO_CLP') * 2 * ctx.n;
  o.costoDirecto = pasajes + movilidadLocal + trasladosSantiago;
  o.horasViaje = redondear(horasViaje, 2);
  o.nochesRequeridas = ctx.destino.REQUIERE_PERNOCTAR === 'SI' ? ctx.dias : 0;
  o.diasTotales = ctx.dias;
  o.detalle = {
    pasajes: pasajes,
    tarifaUnitariaIdaVuelta: tarifa.idaVuelta,
    aerolinea: tarifa.aerolinea,
    duracionVueloMin: tarifa.duracionMin,
    movilidadLocal: movilidadLocal,
    trasladosAeropuerto: trasladosSantiago,
    fuenteTarifa: tarifa.fuente
  };

  if (o.viable) {
    o.motivos.push('Vuelo SCL-' + iata + ' de ' + tarifa.duracionMin + ' min con ' + tarifa.aerolinea + ': ' + horasLegibles(horasViaje) + ' puerta a puerta ida y vuelta.');
    o.motivos.push('Evita ' + redondear(ctx.kmRuta, 0) + ' km de conduccion y la fatiga asociada.');
  }
  return o;
}

// ---------------------------------------------------------------------------
//  BUS
// ---------------------------------------------------------------------------
function _evaluarBus(ctx) {
  var o = {
    modo: MODOS.BUS,
    etiqueta: 'Bus interurbano + movilidad local',
    viable: true,
    km: ctx.kmRuta,
    motivos: []
  };

  if (ctx.kmRuta < 80) {
    o.viable = false;
    o.motivos.push('Trayecto demasiado corto para bus interurbano.');
    o.costoDirecto = 0; o.horasViaje = 0; o.nochesRequeridas = 0; o.diasTotales = ctx.dias;
    return o;
  }

  var pasajes = Math.round(ctx.kmRuta * cfgNum('TARIFA_BUS_CLP_KM') * ctx.n);
  var horasViaje = ctx.kmRuta / cfgNum('VEL_BUS_KMH') + 1.0;  // +1 h de terminales
  var movilidadLocal = cfgNum('TARIFA_METRO_MICRO_VIAJE') * 2 * ctx.n * ctx.dias;
  o.costoDirecto = pasajes + movilidadLocal;
  o.horasViaje = redondear(horasViaje, 2);
  o.nochesRequeridas = (ctx.destino.REQUIERE_PERNOCTAR === 'SI' ? ctx.dias : 0) + _nochesPorTraslado(horasViaje);
  o.diasTotales = ctx.dias + Math.ceil(horasViaje / 8);
  o.detalle = { pasajes: pasajes, movilidadLocal: movilidadLocal };

  o.motivos.push('Pasaje mas barato del ranking, pero ' + horasLegibles(horasViaje) + ' de viaje sin autonomia en destino.');
  if (horasViaje > 10) {
    o.penalizacion = 60000;
    o.motivos.push('Trayecto superior a 10 h: castigo por fatiga y rigidez de horarios de terminal.');
  }
  return o;
}

// ---------------------------------------------------------------------------
//  METRO / MICRO (Red Movilidad)
// ---------------------------------------------------------------------------
function _evaluarMetroMicro(ctx) {
  var o = {
    modo: MODOS.METRO_MICRO,
    etiqueta: 'Metro / Micro (Red Movilidad)',
    viable: true,
    km: ctx.kmRuta,
    motivos: []
  };

  if (ctx.destino.ZONA !== 'RM' || ctx.kmRuta > 120) {
    o.viable = false;
    o.motivos.push('El destino no cuenta con cobertura de transporte publico integrado adecuada.');
    o.costoDirecto = 0; o.horasViaje = 0; o.nochesRequeridas = 0; o.diasTotales = ctx.dias;
    return o;
  }
  var minutos = ctx.kmRuta / cfgNum('VEL_TRANSPORTE_PUBLICO_KMH') * 60;
  o.costoDirecto = Math.round(cfgNum('TARIFA_METRO_MICRO_VIAJE') * 2 * ctx.n);
  o.horasViaje = redondear(minutos / 60, 2);
  o.nochesRequeridas = 0;
  o.diasTotales = ctx.dias;
  o.detalle = { pasajes: o.costoDirecto, viajesPorTecnico: 2 };
  o.motivos.push('Opcion mas economica en caja para servicios urbanos livianos.');
  o.motivos.push('Penaliza el tiempo: ' + horasLegibles(minutos / 60) + ' contra ' + horasLegibles(ctx.minRuta / 60) + ' en vehiculo.');
  return o;
}

// ---------------------------------------------------------------------------
//  Tarifas aereas
// ---------------------------------------------------------------------------
/**
 * Tarifa aerea con tres fuentes en cascada:
 *   1. Cache en la hoja TARIFAS_AEREAS (vigencia 7 dias)
 *   2. API Amadeus self-service (si hay credenciales)
 *   3. Modelo por distancia calibrado al mercado domestico chileno
 */
function tarifaAerea(origenIata, destinoIata, fecha) {
  var cacheado = _tarifaDesdeCache(origenIata, destinoIata);
  if (cacheado) return cacheado;

  var api = _tarifaDesdeAmadeus(origenIata, destinoIata, fecha);
  if (api) {
    _guardarTarifa(api);
    return api;
  }

  return _tarifaEstimada(origenIata, destinoIata);
}

function _tarifaDesdeCache(o, d) {
  var filas = dbBuscar(SH.TARIFAS_AEREAS, { ORIGEN_IATA: o, DESTINO_IATA: d });
  if (!filas.length) return null;
  filas.sort(function (a, b) { return new Date(b.CONSULTADO) - new Date(a.CONSULTADO); });
  var f = filas[0];
  if ((new Date() - new Date(f.CONSULTADO)) > 7 * MS_DIA) return null;
  return {
    origen: o, destino: d,
    ida: Number(f.PRECIO_IDA),
    idaVuelta: Number(f.PRECIO_IDA_VUELTA),
    duracionMin: Number(f.DURACION_MIN),
    aerolinea: f.AEROLINEA,
    escalas: Number(f.ESCALAS) || 0,
    fuente: 'CACHE:' + f.FUENTE
  };
}

function _tarifaDesdeAmadeus(origenIata, destinoIata, fecha) {
  var id = String(cfg('AMADEUS_CLIENT_ID', '')).trim();
  var secret = String(cfg('AMADEUS_CLIENT_SECRET', '')).trim();
  if (!id || !secret) return null;

  try {
    var token = _amadeusToken(id, secret);
    if (!token) return null;
    var salida = isoFecha(fecha || sumarDias(new Date(), 7));
    var url = 'https://api.amadeus.com/v2/shopping/flight-offers' +
      '?originLocationCode=' + origenIata +
      '&destinationLocationCode=' + destinoIata +
      '&departureDate=' + salida +
      '&adults=1&currencyCode=CLP&max=5&nonStop=false';
    var resp = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) {
      log('WARN', 'Transporte', 'Amadeus HTTP ' + resp.getResponseCode());
      return null;
    }
    var data = JSON.parse(resp.getContentText());
    if (!data.data || !data.data.length) return null;

    var mejor = data.data.reduce(function (a, b) {
      return Number(a.price.grandTotal) <= Number(b.price.grandTotal) ? a : b;
    });
    var seg = mejor.itineraries[0].segments;
    var dur = mejor.itineraries[0].duration || 'PT1H30M';
    var horas = /(\d+)H/.exec(dur), mins = /(\d+)M/.exec(dur);
    var duracionMin = (horas ? Number(horas[1]) * 60 : 0) + (mins ? Number(mins[1]) : 0);
    var precioIda = Math.round(Number(mejor.price.grandTotal));

    return {
      origen: origenIata, destino: destinoIata,
      ida: precioIda,
      idaVuelta: Math.round(precioIda * 1.8),
      duracionMin: duracionMin,
      aerolinea: seg[0].carrierCode,
      escalas: seg.length - 1,
      fuente: 'AMADEUS_IDA_RETORNO_ESTIMADO'
    };
  } catch (e) {
    log('WARN', 'Transporte', 'Amadeus fallo: ' + e.message);
    return null;
  }
}

function _amadeusToken(id, secret) {
  var cache = CacheService.getScriptCache();
  var guardado = cache.get('AMADEUS_TOKEN');
  if (guardado) return guardado;
  try {
    var resp = UrlFetchApp.fetch('https://api.amadeus.com/v1/security/oauth2/token', {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: { grant_type: 'client_credentials', client_id: id, client_secret: secret },
      muteHttpExceptions: true
    });
    var data = JSON.parse(resp.getContentText());
    if (!data.access_token) return null;
    cache.put('AMADEUS_TOKEN', data.access_token, Math.max(60, (data.expires_in || 1800) - 60));
    return data.access_token;
  } catch (e) {
    return null;
  }
}

/**
 * Modelo de tarifa por distancia, calibrado con el mercado domestico chileno
 * (LATAM / JetSMART / SKY, compra anticipada, tarifa base sin equipaje).
 */
function _tarifaEstimada(origenIata, destinoIata) {
  var KM_AEREO = { CPO: 665, LSC: 390, CCP: 430, ANF: 1100, IQQ: 1450, ARI: 1650, PMC: 920, PUQ: 2140, ZCO: 590, ZOS: 830 };
  var kms = KM_AEREO[destinoIata] || 600;
  var ida = Math.round((22000 + kms * 45) / 1000) * 1000;
  return {
    origen: origenIata, destino: destinoIata,
    ida: ida,
    idaVuelta: Math.round(ida * 1.8 / 1000) * 1000,
    duracionMin: Math.round(kms / 750 * 60 + 25),
    aerolinea: 'Estimado mercado domestico',
    escalas: 0,
    fuente: 'MODELO_DISTANCIA'
  };
}

function _guardarTarifa(t) {
  dbInsertar(SH.TARIFAS_AEREAS, {
    ORIGEN_IATA: t.origen, DESTINO_IATA: t.destino, FECHA_VUELO: new Date(),
    AEROLINEA: t.aerolinea, PRECIO_IDA: t.ida, PRECIO_IDA_VUELTA: t.idaVuelta,
    DURACION_MIN: t.duracionMin, ESCALAS: t.escalas, FUENTE: t.fuente,
    CONSULTADO: new Date()
  });
}

// ---------------------------------------------------------------------------
//  Justificacion en lenguaje natural
// ---------------------------------------------------------------------------
function _redactarJustificacion(ganador, segundo, ctx) {
  if (!ganador) return 'Sin opciones viables.';
  var partes = [];
  partes.push('Modo elegido: ' + ganador.etiqueta + ' para ' + ctx.n + ' tecnico(s) a ' + ctx.destino.COMUNA + '.');
  partes.push('Costo total de mision ' + clp(ganador.costoTotal) +
              ' (desembolso ' + clp(ganador.costoCaja) +
              ' + ' + horasLegibles(ganador.horasViaje) + ' de viaje valorizadas en ' + clp(ganador.costoOportunidad) + ').');
  if (segundo) {
    var delta = segundo.costoTotal - ganador.costoTotal;
    partes.push('Supera a la alternativa "' + segundo.etiqueta + '" por ' + clp(delta) +
                ' (' + redondear(delta / Math.max(1, segundo.costoTotal) * 100, 1) + '% mas barato).');
    if (segundo.costoCaja < ganador.costoCaja) {
      partes.push('Nota: ' + segundo.etiqueta + ' tiene menor desembolso inmediato (' + clp(segundo.costoCaja) +
                  ') pero pierde ' + horasLegibles(segundo.horasViaje - ganador.horasViaje) + ' adicionales de jornada tecnica.');
    }
  }
  (ganador.motivos || []).forEach(function (m) { partes.push(m); });
  return partes.join(' ');
}

/**
 * Comparador ejecutable desde el menu: imprime la tabla de decision de un
 * destino para que el coordinador la revise antes de aprobar la ruta.
 */
function compararTransporteDestino(destinoId, nTecnicos, equipos, dias) {
  var r = evaluarModosTransporte({
    destinoId: destinoId,
    nTecnicos: nTecnicos || 2,
    equipos: equipos || 1,
    diasEnDestino: dias || 1,
    hayVehiculo: true,
    hayConductor: true
  });
  var lineas = ['COMPARATIVA DE TRANSPORTE  ·  ' + r.comuna + '  ·  ' + r.nTecnicos + ' tecnico(s)', ''];
  r.opciones.forEach(function (o, i) {
    lineas.push((i + 1) + '. ' + o.etiqueta + (o.viable ? '' : '  [NO VIABLE]'));
    if (o.viable) {
      lineas.push('   Desembolso: ' + clp(o.costoCaja) +
                  ' | Horas viaje: ' + horasLegibles(o.horasViaje) +
                  ' | Noches: ' + o.nochesRequeridas +
                  ' | Costo total: ' + clp(o.costoTotal));
    }
    (o.motivos || []).forEach(function (m) { lineas.push('   - ' + m); });
    lineas.push('');
  });
  lineas.push('RECOMENDACION: ' + r.justificacion);
  return lineas.join('\n');
}
