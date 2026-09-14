/** Proveedores de carretera. La clave nunca se envía al navegador. */
function conexionMaps_() {
  var props = PropertiesService.getScriptProperties();
  var proveedor = props.getProperty('MAPS_PROVEEDOR') || 'NATIVO';
  if (['NATIVO', 'ROUTES_API'].indexOf(proveedor) < 0) throw new Error('MAPS_PROVEEDOR debe ser NATIVO o ROUTES_API.');
  var clave = props.getProperty('GOOGLE_MAPS_API_KEY') || '';
  if (proveedor === 'ROUTES_API' && !clave) throw new Error('Falta GOOGLE_MAPS_API_KEY en Propiedades del script.');
  return { proveedor: proveedor, clave: clave };
}

function consultarRoutesApi_(origen, destino, sinPeaje, p, clave) {
  var respuesta = UrlFetchApp.fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: {'X-Goog-Api-Key': clave, 'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.legs.steps.navigationInstruction'},
    payload: JSON.stringify({origin: {address: origen}, destination: {address: destino},
      travelMode: 'DRIVE', routingPreference: 'TRAFFIC_UNAWARE', languageCode: 'es', regionCode: 'CL',
      routeModifiers: {avoidTolls: !!sinPeaje}})
  });
  var codigo = respuesta.getResponseCode();
  var json;
  try { json = JSON.parse(respuesta.getContentText()); } catch (e) { throw new Error('Routes API devolvió una respuesta inválida (HTTP ' + codigo + ').'); }
  if (codigo !== 200) {
    var ayuda = codigo === 403 ? ' Revise API habilitada, facturación y restricciones de la clave.' : codigo === 429 ? ' Se agotó la cuota; reintente más tarde.' : '';
    // Solo código/status: no devolver posibles datos de credenciales en mensajes del proveedor.
    throw new Error('Routes API HTTP ' + codigo + ' (' + (json.error && json.error.status || 'ERROR') + ').' + ayuda);
  }
  var r = json.routes && json.routes[0];
  if (!r || !Number.isFinite(r.distanceMeters) || !/^\d+(\.\d+)?s$/.test(r.duration || '')) throw new Error('Google no encontró una ruta válida. Revise calle, número, comuna y país.');
  var horas = parseFloat(r.duration) / 3600;
  var pasos = [];
  (r.legs || []).forEach(function (l) { (l.steps || []).forEach(function (s) { if (s.navigationInstruction) pasos.push(normalizarTexto_(s.navigationInstruction.instructions)); }); });
  return {ok: true, km: Math.round(r.distanceMeters / 100) / 10,
    horas: Math.round(horas * p.P_FACTOR_HORAS * 100) / 100, horasCrudas: horas, pasos: pasos,
    fuente: 'Google Maps · Routes API', error: ''};
}

function diagnosticarMaps(token, direccion) {
  exigirSesion_(token);
  var libro = obtenerLibro_(), p = leerParametros_(libro);
  var destinos = leerDestinos_(libro, leerTablas_(libro));
  var origen = destinos.filter(function (d) { return d.localidad === 'BASE'; })[0];
  var objetivo = textoCelda_(direccion || 'Plaza de Armas, Santiago, Chile');
  var r = consultarRutaMaps_(origen.direccion, objetivo, false, p);
  return {ok: r.ok, mensaje: r.ok ? 'Conexión correcta: ' + r.km + ' km y ' + Math.round(r.horas * 60) + ' min por carretera.' : r.error,
    proveedor: PropertiesService.getScriptProperties().getProperty('MAPS_PROVEEDOR') || 'NATIVO', ruta: r};
}

/** Actualiza UN lote, conserva progresos y devuelve los fallos a la interfaz. */
function actualizarMapsWeb(token) {
  exigirSesion_(token);
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var datos = leerDatosDelLibro_(), direcciones = {};
    datos.destinos.forEach(function (d) { direcciones[d.localidad] = d.direccion; });
    var pares = datos.tramos.map(function (t) { return {origen:t.desde,destino:t.hasta}; });
    datos.destinos.forEach(function (d) { if (d.localidad !== 'BASE') pares.push({origen:'BASE',destino:d.localidad}); });
    var r = resolverRutas_(pares, direcciones, datos.parametros, datos.libro);
    escribirCalculadosEnDestinos_(datos.libro, datos.destinos, r.rutas, datos.parametros, datos.ajustesPeaje);
    invalidarTableros_();
    var faltantes = {};
    pares.forEach(function (par) { if (par.origen === par.destino) return;
      (datos.parametros.P_MAPS_COMPARA_SIN_PEAJE ? [false,true] : [false]).forEach(function (evitar) {
        var k = claveRuta_(par.origen,par.destino,evitar); if (!r.rutas[k] || !r.rutas[k].ok) faltantes[k]=true;
      });
    });
    return {ok:true, consultas:r.consultas, pendientes:Object.keys(faltantes).length, errores:r.errores,
      mensaje:r.consultas + ' consultas. ' + Object.keys(faltantes).length + ' rutas pendientes. Puede continuar con el siguiente lote.'};
  } finally { lock.releaseLock(); }
}
