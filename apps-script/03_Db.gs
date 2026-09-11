/**
 * ============================================================================
 *  03_Db.gs  ·  Capa de acceso a datos. El Spreadsheet ES la base de datos.
 * ============================================================================
 *  Responde a la pregunta "puedo usar Apps Script como DB?": si. Este modulo
 *  entrega una API tipo ORM sobre las hojas, con:
 *    - lectura/escritura por nombre de columna (no por indice)
 *    - insert/update/upsert/delete por clave primaria
 *    - IDs correlativos con prefijo
 *    - bloqueo (LockService) para evitar escrituras concurrentes de AppSheet
 *    - cache de lectura por ejecucion
 *  Limite practico: ~1-2 millones de celdas por libro. Para este caso de uso
 *  (decenas de miles de filas al ano) es holgadamente suficiente.
 * ============================================================================
 */

var _dbCache = {};

/** Invalida el cache de lectura (llamar tras escrituras masivas). */
function dbInvalidar(hoja) {
  if (hoja) delete _dbCache[hoja]; else _dbCache = {};
}

/** Lee una hoja completa como arreglo de objetos. */
function dbLeer(nombreHoja, opciones) {
  opciones = opciones || {};
  if (!opciones.sinCache && _dbCache[nombreHoja]) return _dbCache[nombreHoja];

  var hoja = libro().getSheetByName(nombreHoja);
  if (!hoja) throw new Error('Hoja inexistente: ' + nombreHoja);
  var ultimaFila = hoja.getLastRow();
  var ultimaCol = hoja.getLastColumn();
  if (ultimaFila < 2) { _dbCache[nombreHoja] = []; return []; }

  var valores = hoja.getRange(1, 1, ultimaFila, ultimaCol).getValues();
  var encabezados = valores[0];
  var filas = [];
  for (var i = 1; i < valores.length; i++) {
    var vacia = true;
    var obj = { _fila: i + 1 };
    for (var j = 0; j < encabezados.length; j++) {
      var clave = String(encabezados[j] || '').trim();
      if (!clave) continue;
      obj[clave] = valores[i][j];
      if (valores[i][j] !== '' && valores[i][j] !== null) vacia = false;
    }
    if (!vacia) filas.push(obj);
  }
  _dbCache[nombreHoja] = filas;
  return filas;
}

/** Filtra filas por un objeto de criterios de igualdad. */
function dbBuscar(nombreHoja, criterios) {
  var filas = dbLeer(nombreHoja);
  var claves = Object.keys(criterios || {});
  if (!claves.length) return filas;
  return filas.filter(function (f) {
    return claves.every(function (k) { return String(f[k]) === String(criterios[k]); });
  });
}

/** Primera fila que cumple los criterios, o null. */
function dbUno(nombreHoja, criterios) {
  var r = dbBuscar(nombreHoja, criterios);
  return r.length ? r[0] : null;
}

/** Inserta un objeto. Devuelve el objeto con su numero de fila. */
function dbInsertar(nombreHoja, obj) {
  return dbInsertarVarios(nombreHoja, [obj])[0];
}

/** Insercion masiva: una sola llamada a setValues (rapido). */
function dbInsertarVarios(nombreHoja, objetos) {
  if (!objetos || !objetos.length) return [];
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var hoja = libro().getSheetByName(nombreHoja);
    var encabezados = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
    var filas = objetos.map(function (o) {
      return encabezados.map(function (h) {
        var v = o[String(h).trim()];
        return (v === undefined || v === null) ? '' : v;
      });
    });
    var inicio = hoja.getLastRow() + 1;
    if (inicio + filas.length > hoja.getMaxRows()) {
      hoja.insertRowsAfter(hoja.getMaxRows(), filas.length + 200);
    }
    hoja.getRange(inicio, 1, filas.length, encabezados.length).setValues(filas);
    objetos.forEach(function (o, i) { o._fila = inicio + i; });
    dbInvalidar(nombreHoja);
    return objetos;
  } finally {
    lock.releaseLock();
  }
}

/** Actualiza los campos indicados de la fila cuya PK coincide. */
function dbActualizar(nombreHoja, campoPk, valorPk, cambios) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var hoja = libro().getSheetByName(nombreHoja);
    var encabezados = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0]
      .map(function (h) { return String(h).trim(); });
    var colPk = encabezados.indexOf(campoPk);
    if (colPk < 0) throw new Error('Columna PK inexistente: ' + campoPk + ' en ' + nombreHoja);

    var ultimaFila = hoja.getLastRow();
    if (ultimaFila < 2) return 0;
    var columna = hoja.getRange(2, colPk + 1, ultimaFila - 1, 1).getValues();
    var fila = -1;
    for (var i = 0; i < columna.length; i++) {
      if (String(columna[i][0]) === String(valorPk)) { fila = i + 2; break; }
    }
    if (fila < 0) return 0;

    Object.keys(cambios).forEach(function (k) {
      var c = encabezados.indexOf(k);
      if (c >= 0) hoja.getRange(fila, c + 1).setValue(cambios[k]);
    });
    dbInvalidar(nombreHoja);
    return fila;
  } finally {
    lock.releaseLock();
  }
}

/** Inserta si la PK no existe, actualiza si existe. */
function dbUpsert(nombreHoja, campoPk, obj) {
  var fila = dbActualizar(nombreHoja, campoPk, obj[campoPk], obj);
  if (!fila) return dbInsertar(nombreHoja, obj);
  obj._fila = fila;
  return obj;
}

/** Elimina filas que cumplan los criterios. Devuelve cuantas borro. */
function dbEliminar(nombreHoja, criterios) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var objetivo = dbBuscar(nombreHoja, criterios);
    if (!objetivo.length) return 0;
    var hoja = libro().getSheetByName(nombreHoja);
    objetivo.map(function (o) { return o._fila; })
            .sort(function (a, b) { return b - a; })
            .forEach(function (f) { hoja.deleteRow(f); });
    dbInvalidar(nombreHoja);
    return objetivo.length;
  } finally {
    lock.releaseLock();
  }
}

/** Vacia el contenido de una hoja conservando el encabezado y formatos. */
function dbTruncar(nombreHoja) {
  var hoja = libro().getSheetByName(nombreHoja);
  if (!hoja) return 0;
  var n = hoja.getLastRow() - 1;
  if (n > 0) hoja.getRange(2, 1, n, hoja.getLastColumn()).clearContent();
  dbInvalidar(nombreHoja);
  return n;
}

/** Reemplaza todo el contenido de una hoja de una sola vez. */
function dbReemplazar(nombreHoja, objetos) {
  dbTruncar(nombreHoja);
  return dbInsertarVarios(nombreHoja, objetos);
}

/**
 * Genera un ID correlativo del tipo OT-0007.
 * Usa PropertiesService para no depender del contenido de la hoja.
 */
function dbNuevoId(prefijo, ancho) {
  ancho = ancho || 4;
  var props = PropertiesService.getScriptProperties();
  var clave = 'SEQ_' + prefijo;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var actual = Number(props.getProperty(clave) || 0) + 1;
    props.setProperty(clave, String(actual));
    var s = String(actual);
    while (s.length < ancho) s = '0' + s;
    return prefijo + '-' + s;
  } finally {
    lock.releaseLock();
  }
}

/** Reinicia los correlativos (util al replanificar una semana completa). */
function dbReiniciarSecuencia(prefijo) {
  PropertiesService.getScriptProperties().deleteProperty('SEQ_' + prefijo);
}

/** Indexa un arreglo de objetos por una clave. */
function indexarPor(arreglo, clave) {
  var mapa = {};
  (arreglo || []).forEach(function (o) { mapa[String(o[clave])] = o; });
  return mapa;
}

/** Agrupa un arreglo de objetos por una clave. */
function agruparPor(arreglo, clave) {
  var mapa = {};
  (arreglo || []).forEach(function (o) {
    var k = String(typeof clave === 'function' ? clave(o) : o[clave]);
    if (!mapa[k]) mapa[k] = [];
    mapa[k].push(o);
  });
  return mapa;
}

function sumarPor(arreglo, campo) {
  return (arreglo || []).reduce(function (a, o) { return a + (Number(o[campo]) || 0); }, 0);
}
