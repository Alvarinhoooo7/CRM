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
