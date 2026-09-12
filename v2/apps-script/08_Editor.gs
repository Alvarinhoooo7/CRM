/** Edición de planificación. Todas las escrituras exigen sesión y bloqueo. */
function invalidarTableros_() {
  CacheService.getScriptCache().removeAll(['tablero_v2_OPERACION_REAL', 'tablero_v2_LITERAL_PDF']);
}

function revisionFilas_(filas) { return hashClave_(JSON.stringify(filas)); }

function obtenerEditor(token) {
  exigirSesion_(token);
  var libro = obtenerLibro_();
  var destinos = libro.getSheetByName('DESTINOS').getDataRange().getValues();
  var plan = libro.getSheetByName('PLAN').getDataRange().getValues();
  return limpiarParaJson_({
    destinos: destinos.slice(2).filter(function (f) { return f[0]; }),
    plan: plan.slice(2).filter(function (f) { return f[5] || f[6]; }),
    encabezadosPlan: plan[1],
    revisionDestinos: revisionFilas_(destinos), revisionPlan: revisionFilas_(plan),
    parametros: leerParametros_(libro), esquema: obtenerEsquemaConfig(token)
  });
}

function textoCelda_(valor, maximo) {
  var texto = String(valor == null ? '' : valor).trim();
  if (texto.length > (maximo || 500) || /^[=+@]/.test(texto)) {
    throw new Error('Texto demasiado largo o inicio de fórmula no permitido.');
  }
  return texto;
}

function guardarDestino(token, solicitud) {
  exigirSesion_(token);
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var libro = obtenerLibro_(), hoja = libro.getSheetByName('DESTINOS');
    var filas = hoja.getDataRange().getValues();
    if (revisionFilas_(filas) !== solicitud.revision) throw new Error('Los destinos cambiaron. Recargue el editor antes de guardar.');
    var indice = filas.findIndex(function (f, i) { return i >= 2 && f[0] === solicitud.localidad; });
    if (indice < 2) throw new Error('Localidad desconocida.');
    var direccion = textoCelda_(solicitud.direccion);
    var hotel = textoCelda_(solicitud.hotel);
    var enlace = textoCelda_(solicitud.linkCapacitacion);
    if (!direccion) throw new Error('Ingrese una dirección.');
    if (enlace && !/^https:\/\//i.test(enlace)) throw new Error('El material de capacitación debe usar un enlace HTTPS.');
    // Las cantidades del caso se conservan; hotel y dirección son supuestos editables.
    var anterior = filas[indice];
    hoja.getRange(indice + 1, 3, 1, 5).setValues([[direccion, anterior[3], anterior[4], hotel, enlace]]);
    if (direccion !== anterior[2]) {
      invalidarCacheRutas_(libro);
      hoja.getRange(indice + 1, 10, 1, 5).clearContent();
    }
    invalidarTableros_();
    registrarBitacora_(libro, 'DESTINO_WEB', solicitud.localidad);
    return { ok: true, mensaje: 'Destino guardado. Recalcule para actualizar las rutas y el presupuesto.' };
  } finally { lock.releaseLock(); }
}

function validarFilasPlan_(filas, encabezados, datos) {
  if (!Array.isArray(filas) || !filas.length || filas.length > 200) throw new Error('El plan debe tener entre 1 y 200 tramos.');
  var locs = datos.destinos.map(function (d) { return d.localidad; });
  var activos = indexarPor_(datos.tecnicos, 'codigo');
  var flota = indexarPor_(datos.flota, 'codigo');
  var anteriores = {}, usos = {}, vehiculos = {}, numeros = {};
  var normalizadas = filas.map(function (f, i) {
    var n = Number(f[0]), dia = String(f[1]), cuadrilla = textoCelda_(f[2], 30);
    var noches = Number(f[7]), conductor = String(f[8] || '');
    if (!Number.isInteger(n) || n < 1 || numeros[n]) throw new Error('Número de tramo inválido o repetido en fila ' + (i + 1));
    numeros[n] = true;
    if (!/^D[1-9]\d*$/.test(dia) || Number(dia.slice(1)) > datos.parametros.P_HORIZONTE_MAX_DIAS) throw new Error('Día fuera del horizonte.');
    if (!cuadrilla || locs.indexOf(f[5]) < 0 || locs.indexOf(f[6]) < 0) throw new Error('Complete cuadrilla, origen y destino.');
    if (f[3] !== 'Camioneta') throw new Error('El editor operativo admite camionetas. Bus y avión se comparan como alternativas referenciales.');
    if (!flota[f[4]] || flota[f[4]].estado !== 'Disponible') throw new Error('Vehículo no disponible.');
    if (!Number.isInteger(noches) || noches < 0 || noches > 1) throw new Error('Cada tramo admite 0 o 1 noche; use un tramo por día.');
    var checks = encabezados.slice(9).map(function (c, j) { return f[j + 9] === true; });
    var tecnicos = encabezados.slice(9).filter(function (c, j) { return checks[j]; });
    if (!tecnicos.length || tecnicos.some(function (c) { return !activos[c]; })) throw new Error('Seleccione técnicos activos.');
    if (tecnicos.indexOf(conductor) < 0 || activos[conductor].licencia !== 'Si') throw new Error('El conductor debe estar asignado y tener licencia.');
    tecnicos.forEach(function (c) {
      var key = dia + '|' + c;
      if (usos[key] && usos[key] !== cuadrilla) throw new Error(c + ' está en dos cuadrillas el mismo día.');
      usos[key] = cuadrilla;
    });
    var key = dia + '|' + f[4];
    if (vehiculos[key] && vehiculos[key] !== cuadrilla) throw new Error('La camioneta está en dos cuadrillas el mismo día.');
    vehiculos[key] = cuadrilla;
    return [n, dia, cuadrilla, 'Camioneta', f[4], f[5], f[6], noches, conductor].concat(checks);
  });
  normalizadas.sort(function (a,b) { return Number(a[1].slice(1))-Number(b[1].slice(1)) || a[2].localeCompare(b[2]) || a[0]-b[0]; });
  normalizadas.forEach(function (f) {
    var previo = anteriores[f[2]];
    if ((previo ? previo[6] : 'BASE') !== f[5]) throw new Error('Ruta discontinua en ' + f[2] + ': revise el origen del tramo ' + f[0]);
    if (previo && previo[1] === f[1] && previo[7]) throw new Error('La pernocta debe ser el último tramo del día.');
    anteriores[f[2]] = f;
  });
  Object.keys(anteriores).forEach(function (c) {
    if (anteriores[c][6] !== 'BASE') throw new Error(c + ' debe terminar de regreso en BASE.');
  });
  return normalizadas;
}

function guardarPlanWeb(token, solicitud) {
  exigirSesion_(token);
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var datos = leerDatosDelLibro_(), hoja = datos.libro.getSheetByName('PLAN');
    var actuales = hoja.getDataRange().getValues();
    if (revisionFilas_(actuales) !== solicitud.revision) throw new Error('El plan cambió. Recargue antes de guardar.');
    var filas = validarFilasPlan_(solicitud.filas, actuales[1], datos);
    var ancho = actuales[1].length;
    var cantidad = Math.max(filas.length, actuales.length - 2);
    while (filas.length < cantidad) filas.push(Array(ancho).fill(''));
    if (hoja.getMaxRows() < cantidad + 2) hoja.insertRowsAfter(hoja.getMaxRows(), cantidad + 2 - hoja.getMaxRows());
    hoja.getRange(3, 1, cantidad, ancho).setValues(filas);
    invalidarTableros_();
    registrarBitacora_(datos.libro, 'PLAN_WEB', solicitud.filas.length + ' tramos');
    return { ok: true, mensaje: 'Plan guardado. Recalcule y revise las alertas antes de ejecutarlo.' };
  } finally { lock.releaseLock(); }
}
