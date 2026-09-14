/** Puente temporal que se añade al proyecto actual sin sustituir su aplicación.
 * Ejecutar desde Extensiones > Apps Script con la cuenta propietaria.
 * No modifica ni elimina hojas operativas; crea un respaldo y verifica su contenido.
 */
function prepararMigracionPlanillaFuncional() {
  var bloqueo=LockService.getScriptLock(); bloqueo.waitLock(30000);
  try {
    var libro=SpreadsheetApp.getActiveSpreadsheet();
    if(!libro) throw new Error('Abra esta función desde el Apps Script vinculado al spreadsheet.');
    var fecha=Utilities.formatDate(new Date(),'America/Santiago','yyyyMMdd-HHmmss');
    var inventario={fecha:fecha,nombre:libro.getName(),hojas:[],rangos:[],activadores:[]};
    libro.getSheets().forEach(function(h) {
      var rango=h.getDataRange();
      inventario.hojas.push({nombre:h.getName(),filas:h.getLastRow(),columnas:h.getLastColumn(),valores:rango.getValues(),formulas:rango.getFormulas(),combinaciones:rango.getMergedRanges().map(function(r) { return r.getA1Notation(); })});
    });
    inventario.rangos=libro.getNamedRanges().map(function(n) { return {nombre:n.getName(),hoja:n.getRange().getSheet().getName(),rango:n.getRange().getA1Notation()}; });
    inventario.activadores=ScriptApp.getProjectTriggers().map(function(t) { return {funcion:t.getHandlerFunction(),tipo:String(t.getEventType()),id:t.getUniqueId()}; });
    var carpeta=DriveApp.createFolder('Respaldo migración planilla '+fecha);
    var copia=DriveApp.getFileById(libro.getId()).makeCopy(libro.getName()+' RESPALDO '+fecha,carpeta);
    var exportacion=carpeta.createFile('inventario.json',JSON.stringify(inventario,null,2),MimeType.PLAIN_TEXT);
    var verificacion=SpreadsheetApp.openById(copia.getId());
    if(verificacion.getSheets().length!==inventario.hojas.length) throw new Error('El número de hojas de la copia no coincide; no migrar.');
    inventario.hojas.forEach(function(original) {
      var h=verificacion.getSheetByName(original.nombre);
      if(!h||h.getLastRow()!==original.filas||h.getLastColumn()!==original.columnas) throw new Error('Copia incompleta: '+original.nombre);
      var formulas=h.getDataRange().getFormulas(),valores=h.getDataRange().getValues();
      for(var i=0;i<original.valores.length;i++) for(var j=0;j<original.valores[i].length;j++) {
        if(formulas[i][j]!==original.formulas[i][j]) throw new Error('Fórmula distinta en copia: '+original.nombre+' fila '+(i+1));
        if(!original.formulas[i][j]&&JSON.stringify(valores[i][j])!==JSON.stringify(original.valores[i][j])) throw new Error('Dato distinto en copia: '+original.nombre+' fila '+(i+1));
      }
    });
    PropertiesService.getScriptProperties().setProperties({MIGRACION_RESPALDO_ID:copia.getId(),MIGRACION_INVENTARIO_ID:exportacion.getId(),MIGRACION_RESPALDO_FECHA:fecha});
    var resultado={estado:'RESPALDO VERIFICADO; sistema original conservado',respaldo:copia.getUrl(),inventario:exportacion.getUrl(),carpeta:carpeta.getUrl(),hojas:inventario.hojas.map(function(h) { return {nombre:h.nombre,filas:h.filas,columnas:h.columnas}; })};
    Logger.log(JSON.stringify(resultado,null,2));
    SpreadsheetApp.getUi().alert('Respaldo verificado.\n'+copia.getUrl()+'\n\nInventario: '+exportacion.getUrl()+'\n\nCopie el resultado del registro de ejecución para continuar la migración.');
    return resultado;
  } finally { bloqueo.releaseLock(); }
}
