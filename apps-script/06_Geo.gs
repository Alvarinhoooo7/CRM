/**
 * ============================================================================
 *  06_Geo.gs  ·  Distancias reales, geocodificacion y ruteo.
 * ============================================================================
 *  Tres niveles de precision, en orden de preferencia:
 *    1. Google Maps Distance Matrix API  (km y minutos reales con trafico)
 *    2. Servicio Maps nativo de Apps Script (sin API key, cuota limitada)
 *    3. Haversine x 1.25  (estimacion offline, siempre disponible)
 *  Todo resultado se persiste en la hoja MATRIZ_DISTANCIAS para no repetir
 *  llamadas y para que el sistema funcione sin conexion a las APIs.
 * ============================================================================
 */

var _matrizCache = null;

/** Consulta por dirección: la clave nunca sale del servidor. No inventa éxito. */
function consultarRutaExacta_(origen, destino) {
  var key = String(cfg('GOOGLE_MAPS_API_KEY', '')).trim();
  if (key) {
    var resp = UrlFetchApp.fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.legs.startLocation,routes.legs.endLocation' },
      payload: JSON.stringify({ origin: { address: origen }, destination: { address: destino },
        travelMode: 'DRIVE', routingPreference: 'TRAFFIC_UNAWARE', languageCode: 'es', units: 'METRIC' })
    });
    if (resp.getResponseCode() !== 200) throw new Error('Google Routes respondió HTTP ' + resp.getResponseCode() + '. Revise la clave, Routes API y su cuota. No se modificaron los datos.');
    var data = JSON.parse(resp.getContentText());
    var r = data.routes && data.routes[0];
    if (!r || !r.legs || !r.legs.length) throw new Error('Google no encontró ruta para estas direcciones.');
    return { km: r.distanceMeters / 1000, min: parseFloat(r.duration) / 60,
      lat: r.legs[0].endLocation.latLng.latitude, lng: r.legs[0].endLocation.latLng.longitude,
      direccion: destino, fuente: 'GOOGLE_ROUTES_API' };
  }
  var directions = Maps.newDirectionFinder().setOrigin(origen).setDestination(destino)
    .setRegion('cl').setMode(Maps.DirectionFinder.Mode.DRIVING).getDirections();
  if (!directions.routes || !directions.routes.length) throw new Error('Google Maps no encontró una ruta. Ingrese calle, número, comuna y Chile.');
  var leg = directions.routes[0].legs[0];
  return { km: leg.distance.value / 1000, min: leg.duration.value / 60,
    lat: leg.end_location.lat, lng: leg.end_location.lng,
    direccion: leg.end_address, fuente: 'APPS_SCRIPT_MAPS' };
}

/** Vista previa: consulta ida y regreso por separado y pide confirmar el punto. */
function guardarDireccionYCalcularRuta_(datos) {
  var d = dbUno(SH.DESTINOS, { DESTINO_ID: datos.destinoId });
  var direccion = String(datos.direccion || '').trim();
  if (!d || d.DESTINO_ID === BASE_ID) throw new Error('Seleccione una localidad.');
  if (direccion.length < 10 || direccion.length > 300 || /^https?:/i.test(direccion)) throw new Error('Escriba la dirección completa o coordenadas; no un enlace acortado.');
  var ida = consultarRutaExacta_(APP.BASE_DIRECCION + ', Chile', direccion);
  var vuelta = consultarRutaExacta_(direccion, APP.BASE_DIRECCION + ', Chile');
  if (![ida.km, ida.min, ida.lat, ida.lng, vuelta.km, vuelta.min].every(function (n) { return isFinite(n); }) || ida.km <= 0) throw new Error('Respuesta de Maps incompleta.');
  var previewId = Utilities.getUuid();
  var resultado = { previewId: previewId, destinoId: d.DESTINO_ID, direccionAnterior: d.DIRECCION,
    direccion: direccion, ida: ida, vuelta: vuelta,
    mapa: 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(APP.BASE_DIRECCION) +
      '&destination=' + encodeURIComponent(ida.lat + ',' + ida.lng) + '&travelmode=driving' };
  CacheService.getScriptCache().put('RUTA_' + previewId, JSON.stringify(resultado), 600);
  return resultado;
}

function confirmarRuta_(previewId) {
  var cache = CacheService.getScriptCache();
  var json = cache.get('RUTA_' + String(previewId));
  if (!json) throw new Error('La vista previa venció. Vuelva a calcular.');
  var p = JSON.parse(json);
  var d = dbUno(SH.DESTINOS, { DESTINO_ID: p.destinoId });
  if (!d || d.DIRECCION !== p.direccionAnterior) throw new Error('La dirección cambió. Vuelva a calcular.');
  dbActualizar(SH.DESTINOS, 'DESTINO_ID', p.destinoId, { DIRECCION: p.direccion,
    LAT: p.ida.lat, LNG: p.ida.lng, KM_DESDE_BASE: redondear(p.ida.km, 1), MIN_DESDE_BASE: Math.round(p.ida.min) });
  // Invalida también enlaces entre localidades: ya no apuntan al mismo sitio.
  dbEliminar(SH.MATRIZ, { ORIGEN_ID: p.destinoId });
  dbEliminar(SH.MATRIZ, { DESTINO_ID: p.destinoId });
  [p.ida, p.vuelta].forEach(function (r, i) {
    dbInsertar(SH.MATRIZ, { ORIGEN_ID: i ? p.destinoId : BASE_ID,
      DESTINO_ID: i ? BASE_ID : p.destinoId, KM: redondear(r.km, 1), MINUTOS: Math.round(r.min),
      PEAJE_CLP: Number(d.PEAJE_IDA_CLP) || 0, FUENTE: r.fuente + '_PEAJE_ESTIMADO', ACTUALIZADO: new Date() });
  });
  _matrizCache = null;
  cache.remove('RUTA_' + String(previewId));
  return { mensaje: 'Dirección y rutas de ida y regreso guardadas. Pulse Planificar para actualizar tiempos y viáticos. Los peajes siguen siendo estimados.' };
}

/** Carga la matriz en memoria indexada por 'ORIGEN|DESTINO'. */
function _cargarMatriz() {
  if (_matrizCache) return _matrizCache;
  _matrizCache = {};
  dbLeer(SH.MATRIZ).forEach(function (m) {
    _matrizCache[m.ORIGEN_ID + '|' + m.DESTINO_ID] = {
      km: Number(m.KM) || 0,
      min: Number(m.MINUTOS) || 0,
      peaje: Number(m.PEAJE_CLP) || 0,
      fuente: m.FUENTE
    };
  });
  return _matrizCache;
}

/**
 * Tramo entre dos destinos. Nunca falla: cae a estimacion geografica.
 * @return {{km:number, min:number, peaje:number, fuente:string}}
 */
function tramo(origenId, destinoId) {
  if (origenId === destinoId) return { km: 0, min: 0, peaje: 0, fuente: 'MISMO_PUNTO' };
  var matriz = _cargarMatriz();
  var directo = matriz[origenId + '|' + destinoId];
  if (directo && directo.km > 0) return directo;
  var inverso = matriz[destinoId + '|' + origenId];
  if (inverso && inverso.km > 0) return inverso;

  // Fallback geografico en caliente.
  var dest = indexarPor(dbLeer(SH.DESTINOS), 'DESTINO_ID');
  var a = dest[origenId], b = dest[destinoId];
  if (!a || !b) return { km: 0, min: 0, peaje: 0, fuente: 'DESCONOCIDO' };
  var km = redondear(kmRutaEstimados(a.LAT, a.LNG, b.LAT, b.LNG), 0);
  var urbano = (a.ZONA === 'RM' && b.ZONA === 'RM');
  var vel = urbano ? cfgNum('VEL_URBANA_KMH') : cfgNum('VEL_CARRETERA_KMH');
  return {
    km: km,
    min: Math.round(km / vel * 60),
    peaje: urbano ? 0 : Math.round(km * cfgNum('PEAJE_FALLBACK_CLP_KM') / 100) * 100,
    fuente: 'ESTIMACION_EN_CALIENTE'
  };
}

/** Kilometros entre dos puntos. Atajo de lectura. */
function km(origenId, destinoId) { return tramo(origenId, destinoId).km; }

/** Minutos de viaje entre dos puntos. */
function minutosViaje(origenId, destinoId) { return tramo(origenId, destinoId).min; }

/**
 * Recalcula toda la matriz con Google Distance Matrix API.
 * Consume cuota: 16x16 = 240 pares. Se ejecuta a demanda, no en cada plan.
 */
function recalcularMatrizConMaps() {
  var apiKey = String(cfg('GOOGLE_MAPS_API_KEY', '')).trim();
  var destinos = dbLeer(SH.DESTINOS);
  var actualizados = 0, errores = 0;
  var ahora = new Date();
  var filas = [];

  for (var i = 0; i < destinos.length; i++) {
    var lote = [];
    for (var j = 0; j < destinos.length; j++) {
      if (i === j) continue;
      lote.push(destinos[j]);
    }
    // Distance Matrix acepta hasta 25 destinos por llamada.
    for (var k = 0; k < lote.length; k += 20) {
      var trozo = lote.slice(k, k + 20);
      var resultado = apiKey
        ? _distanceMatrixHttp(destinos[i], trozo, apiKey)
        : _distanceMatrixNativo(destinos[i], trozo);

      if (!resultado) { errores++; continue; }
      resultado.forEach(function (r) {
        filas.push({
          ORIGEN_ID: destinos[i].DESTINO_ID,
          DESTINO_ID: r.destinoId,
          KM: redondear(r.metros / 1000, 1),
          MINUTOS: Math.round(r.segundos / 60),
          PEAJE_CLP: _peajeEstimado(destinos[i], r.destino, r.metros / 1000),
          FUENTE: apiKey ? 'GOOGLE_DISTANCE_MATRIX' : 'APPS_SCRIPT_MAPS',
          ACTUALIZADO: ahora
        });
        actualizados++;
      });
      Utilities.sleep(200);  // cortesia con la cuota
    }
  }

  if (filas.length) {
    dbReemplazar(SH.MATRIZ, filas);
    _matrizCache = null;
  }
  var msg = 'Matriz recalculada: ' + actualizados + ' pares, ' + errores + ' errores. ' +
            'Fuente: ' + (apiKey ? 'Google Distance Matrix API' : 'Servicio Maps nativo');
  log('INFO', 'Geo', msg);
  return msg;
}

/** Llamada HTTP a Distance Matrix API. */
function _distanceMatrixHttp(origen, destinos, apiKey) {
  var url = 'https://maps.googleapis.com/maps/api/distancematrix/json' +
    '?origins=' + encodeURIComponent(origen.LAT + ',' + origen.LNG) +
    '&destinations=' + encodeURIComponent(destinos.map(function (d) { return d.LAT + ',' + d.LNG; }).join('|')) +
    '&mode=driving&language=es&region=cl&units=metric&key=' + apiKey;
  try {
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var data = JSON.parse(resp.getContentText());
    if (data.status !== 'OK') {
      log('WARN', 'Geo', 'Distance Matrix status=' + data.status + ' ' + (data.error_message || ''));
      return null;
    }
    var elementos = data.rows[0].elements;
    var salida = [];
    for (var i = 0; i < elementos.length; i++) {
      if (elementos[i].status !== 'OK') continue;
      salida.push({
        destinoId: destinos[i].DESTINO_ID,
        destino: destinos[i],
        metros: elementos[i].distance.value,
        segundos: elementos[i].duration.value
      });
    }
    return salida;
  } catch (e) {
    log('ERROR', 'Geo', 'Fallo Distance Matrix: ' + e.message);
    return null;
  }
}

/** Alternativa sin API key usando el servicio Maps de Apps Script. */
function _distanceMatrixNativo(origen, destinos) {
  var salida = [];
  destinos.forEach(function (d) {
    try {
      var dir = Maps.newDirectionFinder()
        .setOrigin(origen.LAT, origen.LNG)
        .setDestination(d.LAT, d.LNG)
        .setMode(Maps.DirectionFinder.Mode.DRIVING)
        .getDirections();
      if (dir.routes && dir.routes.length) {
        var leg = dir.routes[0].legs[0];
        salida.push({
          destinoId: d.DESTINO_ID, destino: d,
          metros: leg.distance.value, segundos: leg.duration.value
        });
      }
    } catch (e) {
      log('WARN', 'Geo', 'Maps nativo fallo ' + origen.DESTINO_ID + '->' + d.DESTINO_ID + ': ' + e.message);
    }
  });
  return salida.length ? salida : null;
}

/**
 * Estima el peaje de un tramo.
 * Dentro de la RM no hay peaje troncal (el TAG urbano se factura aparte y se
 * trata como costo fijo mensual del vehiculo, no como gasto de ruta).
 */
function _peajeEstimado(origen, destino, kms) {
  if (origen.ZONA === 'RM' && destino.ZONA === 'RM') return 0;
  if (origen.DESTINO_ID === BASE_ID && Number(destino.PEAJE_IDA_CLP)) return Number(destino.PEAJE_IDA_CLP);
  if (destino.DESTINO_ID === BASE_ID && Number(origen.PEAJE_IDA_CLP)) return Number(origen.PEAJE_IDA_CLP);
  return Math.round(kms * cfgNum('PEAJE_FALLBACK_CLP_KM') / 100) * 100;
}

/** Geocodifica las direcciones de DESTINOS que no tengan coordenadas. */
function geocodificarDestinosFaltantes() {
  var destinos = dbLeer(SH.DESTINOS);
  var n = 0;
  destinos.forEach(function (d) {
    if (Number(d.LAT) && Number(d.LNG)) return;
    try {
      var r = Maps.newGeocoder().setRegion('cl').geocode(d.DIRECCION + ', Chile');
      if (r.status === 'OK' && r.results.length) {
        var loc = r.results[0].geometry.location;
        dbActualizar(SH.DESTINOS, 'DESTINO_ID', d.DESTINO_ID, { LAT: loc.lat, LNG: loc.lng });
        n++;
      }
    } catch (e) {
      log('WARN', 'Geo', 'Geocoding fallo para ' + d.DESTINO_ID + ': ' + e.message);
    }
  });
  return 'Geocodificados: ' + n;
}

/**
 * Orden de visita optimizado: vecino mas cercano + mejora 2-opt.
 * Resuelve el TSP abierto (parte en la base, no obliga a cerrar el ciclo).
 * @param {string[]} ids  destinos a visitar
 * @param {boolean} cerrarCiclo  true si debe volver a la base
 */
function optimizarRuta(ids, cerrarCiclo) {
  if (!ids || ids.length <= 1) return (ids || []).slice();

  // --- Vecino mas cercano ----------------------------------------------
  var pendientes = ids.slice();
  var ruta = [];
  var actual = BASE_ID;
  while (pendientes.length) {
    var mejor = 0, mejorKm = Infinity;
    for (var i = 0; i < pendientes.length; i++) {
      var d = tramo(actual, pendientes[i]).km;
      if (d < mejorKm) { mejorKm = d; mejor = i; }
    }
    actual = pendientes[mejor];
    ruta.push(actual);
    pendientes.splice(mejor, 1);
  }

  // --- 2-opt -------------------------------------------------------------
  function largo(r) {
    var total = tramo(BASE_ID, r[0]).km;
    for (var i = 0; i < r.length - 1; i++) total += tramo(r[i], r[i + 1]).km;
    if (cerrarCiclo) total += tramo(r[r.length - 1], BASE_ID).km;
    return total;
  }

  var mejoro = true, vueltas = 0;
  while (mejoro && vueltas < 60) {
    mejoro = false; vueltas++;
    for (var a = 0; a < ruta.length - 1; a++) {
      for (var b = a + 1; b < ruta.length; b++) {
        var candidata = ruta.slice(0, a)
          .concat(ruta.slice(a, b + 1).reverse())
          .concat(ruta.slice(b + 1));
        if (largo(candidata) < largo(ruta) - 0.01) {
          ruta = candidata; mejoro = true;
        }
      }
    }
  }
  return ruta;
}

/** Kilometraje total de una secuencia que parte y termina en la base. */
function kmDeRuta(ids, cerrarCiclo) {
  if (!ids.length) return 0;
  var total = tramo(BASE_ID, ids[0]).km;
  for (var i = 0; i < ids.length - 1; i++) total += tramo(ids[i], ids[i + 1]).km;
  if (cerrarCiclo !== false) total += tramo(ids[ids.length - 1], BASE_ID).km;
  return redondear(total, 1);
}

/** Peaje total de una secuencia. */
function peajeDeRuta(ids, cerrarCiclo) {
  if (!ids.length) return 0;
  var total = tramo(BASE_ID, ids[0]).peaje;
  for (var i = 0; i < ids.length - 1; i++) total += tramo(ids[i], ids[i + 1]).peaje;
  if (cerrarCiclo !== false) total += tramo(ids[ids.length - 1], BASE_ID).peaje;
  return Math.round(total);
}

/** Link de Google Maps con la ruta completa, para enviar al tecnico. */
function linkRutaMaps(ids) {
  var dest = indexarPor(dbLeer(SH.DESTINOS), 'DESTINO_ID');
  var base = dest[BASE_ID];
  var puntos = ids.map(function (id) {
    var d = dest[id];
    return d ? d.LAT + ',' + d.LNG : null;
  }).filter(Boolean);
  if (!puntos.length) return '';
  var url = 'https://www.google.com/maps/dir/?api=1' +
    '&origin=' + base.LAT + ',' + base.LNG +
    '&destination=' + puntos[puntos.length - 1] +
    '&travelmode=driving';
  if (puntos.length > 1) {
    url += '&waypoints=' + encodeURIComponent(puntos.slice(0, -1).join('|'));
  }
  return url;
}
