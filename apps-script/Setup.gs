/** ESQUEMA Y ACCESO A DATOS. Nunca usar número de fila como clave. */
var ESQUEMA = {
  CONFIG:'Parámetro|Valor|Unidad|Origen|Nota',
  DESTINOS:'ID_Destino|Comuna|Region|Direccion_Municipalidad|En_RM|Corredor|Km_Ida|Horas_Ida|Peaje_Ida|Equipos_Pendientes|Equipos_Instalados|Capacitacion_Enviada|Hotel_Referencia|Link_Capacitacion|Contacto_Cliente|Mail_Cliente',
  TECNICOS:'ID_Tecnico|Nombre|Email|Telefono|Licencia|Cuadrilla|Vehiculo_Habitual|Activo|Horas_Asignadas|Horas_Libres|Utilizacion|Equipos_Instalados|Comunas_Visitadas|Dias_Fuera_RM|Dias_En_RM|Noches_Fuera|Monto_Transferido|Monto_Rendido|Saldo|Rendiciones_Atrasadas',
  CAMIONETAS:'ID_Vehiculo|Patente|Modelo|Km_Inicial|Km_Recorridos_Plan|Km_Acumulado|Km_Proxima_Mantencion|Km_Faltantes|Venc_Revision_Tecnica|Venc_Seguro|Venc_Permiso_Circulacion|Estado|Litros_Consumidos|Gasto_Combustible|Gasto_Peajes|Gasto_Desgaste|Alerta',
  ORDENES:'ID_Orden|Dia|Fecha|Cuadrilla|ID_Tecnico|Nombre_Tecnico|ID_Vehiculo|Es_Conductor|ID_Destino|Comuna|Direccion|Equipos|Tecnicos_En_Sitio|Horas_Viaje|Horas_Instalacion|Horas_Capacitacion|Horas_Totales|Estado_Jornada|Horas_Extra|Costo_Horas_Extra|Km_Dia|Peaje|Combustible|Tipo_Estipendio|Estipendio|Noches|Hotel_Monto|Total_Transferencia|Estado_Orden|Hora_Inicio_Jornada|Checklist_Completo|Hora_Salida_Ruta|Capacitacion_Enviada|Hora_Inicio_Instalacion|Hora_Fin_Instalacion|Hora_Inicio_Capacitacion|Hora_Fin_Capacitacion|Hora_Fin_Jornada|Firma_Cliente|Foto_Instalacion|Observaciones|Ubicacion_GPS|Horas_Reales|Desvio_vs_Estimado|Avance|ID_Jornada|Email|Desgaste|Recibido_Servidor|Error_Validacion',
  IMPLEMENTOS:'ID_Implemento|Categoria|Item|Obligatorio|Viaja_En',
  CHECKLIST:'ID_Item|ID_Orden|ID_Tecnico|Fecha|Categoria|Item|Obligatorio|Marcado|Hora_Marcado|Email|ID_Implemento',
  GASTOS:'ID_Gasto|ID_Orden|ID_Tecnico|Fecha|Tipo|Monto|Foto_Boleta|Estado|Revisado_Por|Fecha_Revision|Comentario|Email|Folio|Recibido_Servidor|Error_Validacion',
  TRANSFERENCIAS:'ID_Tecnico|Nombre|Banco|Tipo_Cuenta|Monto_A_Transferir|Detalle|Estado|Fecha_Transferencia|Monto_Rendido|Saldo|Alerta|Monto_Transferido|Reserva',
  VISITAS:'ID_Visita|ID_Jornada|Secuencia|ID_Origen|ID_Destino|Km|Peaje|Equipos|Noches|Corredor|Origen_Dato|Nota|Horas_Viaje|Horas_Instalacion|Horas_Capacitacion|Comuna|Direccion|Equipos_Instalados|Hora_Inicio_Instalacion|Hora_Fin_Instalacion|Hora_Inicio_Capacitacion|Hora_Fin_Capacitacion|Firma_Cliente|Foto_Instalacion|Observaciones|Ubicacion_GPS',
  CALENDARIO:'Técnico|Calendario', AGENDAR:'Campo|Valor', TABLERO:'Indicador|Valor', LEEME_APPSHEET:'Tema|Instrucción',
  ENVIOS:'ID_Envio|ID_Destino|Destinatario|Enlace|Estado|Fecha|Error'
};
var TABLAS_APP = ['DESTINOS','TECNICOS','CAMIONETAS','ORDENES','CHECKLIST','IMPLEMENTOS','GASTOS','VISITAS'];
function columnas_(nombre) { exigir_(ESQUEMA[nombre], 'Hoja desconocida: '+nombre); return ESQUEMA[nombre].split('|'); }
function libro_() {
  var activo=SpreadsheetApp.getActiveSpreadsheet();
  if (activo) return activo;
  var id=PropertiesService.getScriptProperties().getProperty('LIBRO_OPERATIVO');
  exigir_(id,'Ejecute crearHojasBase desde el spreadsheet antes de instalar activadores');
  return SpreadsheetApp.openById(id);
}
function hoja_(nombre) { var h=libro_().getSheetByName(nombre); exigir_(h,'Falta hoja '+nombre+'. Ejecute Crear hojas base.'); return h; }
function conBloqueo_(accion) {
  var bloqueo=LockService.getScriptLock();
  exigir_(bloqueo.tryLock(30000),'Otro proceso está escribiendo. Intente nuevamente.');
  try { return accion(); } finally { bloqueo.releaseLock(); }
}
function leerTabla_(nombre) {
  var valores=hoja_(nombre).getDataRange().getValues(), columnas=columnas_(nombre);
  exigir_(columnas.every(function(c,i) { return valores[0][i]===c; }), nombre+': encabezado incompatible; no se sobrescribió. Requiere migración.');
  return valores.slice(1).map(function(f,i) {
    exigir_(f[0]!=='' && f[0]!==undefined,nombre+', fila '+(i+2)+': ID vacío o fila intermedia vacía');
    var objeto={_fila:i+2}; columnas.forEach(function(c,j) { objeto[c]=f[j]===undefined?'':f[j]; }); return objeto;
  });
}
function parametros_() {
  var libro=libro_(), valores=hoja_('CONFIG').getDataRange().getValues(), salida={};
  var rangos={}; libro.getNamedRanges().forEach(function(r) { rangos[r.getName()]=r.getRange(); });
  definicionParametros_().forEach(function(d) {
    var rango=rangos[d[0]];
    exigir_(rango && rango.getSheet().getName()==='CONFIG' && rango.getNumRows()===1 && rango.getNumColumns()===1, 'CONFIG: falta rango unitario '+d[0]);
    var valor=valores[rango.getRow()-1][rango.getColumn()-1];
    exigir_(valor!=='' && !/^#(REF|ERROR|VALUE|DIV|NAME|N\/A)/.test(String(valor)),'CONFIG '+d[0]+': vacío o fórmula inválida');
    salida[d[0]]=valor;
  });
  return salida;
}
function leerOperacion_() {
  var datos={parametros:parametros_()};
  TABLAS_APP.concat(['TRANSFERENCIAS','ENVIOS']).forEach(function(n) { datos[n]=leerTabla_(n); });
  return datos;
}
function asegurarTamano_(hoja,filas,columnas) {
  if(hoja.getMaxRows()<filas) hoja.insertRowsAfter(hoja.getMaxRows(),filas-hoja.getMaxRows());
  if(hoja.getMaxColumns()<columnas) hoja.insertColumnsAfter(hoja.getMaxColumns(),columnas-hoja.getMaxColumns());
}
function anexarObjetos_(nombre,objetos) {
  if(!objetos.length) return;
  var h=hoja_(nombre), columnas=columnas_(nombre), inicio=h.getLastRow()+1;
  asegurarTamano_(h,inicio+objetos.length-1,columnas.length);
  h.getRange(inicio,1,objetos.length,columnas.length).setValues(objetos.map(function(o) { return columnas.map(function(c) { return o[c]===undefined?'':o[c]; }); }));
}
/** Solo toca las columnas autorizadas; agrupa columnas contiguas en un setValues. */
function escribirCampos_(nombre, originales, resultados, campos) {
  if(!originales.length) return;
  var columnas=columnas_(nombre), clave=columnas[0], porId=indice_(resultados,clave,nombre+' resultados');
  var indices=campos.map(function(c) { var i=columnas.indexOf(c); exigir_(i>=0,nombre+': columna inexistente '+c); return i; }).sort(function(a,b) { return a-b; });
  var grupos=[];
  indices.forEach(function(i) { var ultimo=grupos[grupos.length-1]; if(ultimo && ultimo[ultimo.length-1]+1===i) ultimo.push(i); else grupos.push([i]); });
  var h=hoja_(nombre);
  grupos.forEach(function(g) {
    h.getRange(2,g[0]+1,originales.length,g.length).setValues(originales.map(function(o) { var r=porId[o[clave]]; return g.map(function(i) { var c=columnas[i]; return r && r[c]!==undefined?r[c]:o[c]===undefined?'':o[c]; }); }));
  });
}
function letra_(indice) { var salida=''; for(var n=indice+1;n>0;n=Math.floor((n-1)/26)) salida=String.fromCharCode(65+(n-1)%26)+salida; return salida; }
function rangoCol_(tabla,campo) { var l=letra_(columnas_(tabla).indexOf(campo)); return "'"+tabla+"'!"+l+'2:'+l; }
function celda_(tabla,campo,fila) { return letra_(columnas_(tabla).indexOf(campo))+fila; }
function listaValidacion_(h,campo,valores) {
  var i=columnas_(h.getName()).indexOf(campo);
  h.getRange(2,i+1,h.getMaxRows()-1,1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(valores,true).setAllowInvalid(false).build());
}
function crearHojasBase() { return conBloqueo_(crearHojasInterno_); }
function crearHojasInterno_() {
  var libro=libro_();
  // Rechazar esquemas anteriores antes de modificar una sola hoja.
  Object.keys(ESQUEMA).forEach(function(n) {
    var h=libro.getSheetByName(n);
    if(h && h.getLastRow() && n!=='CALENDARIO') {
      var cols=columnas_(n), actuales=h.getRange(1,1,1,cols.length).getValues()[0];
      exigir_(cols.every(function(c,i) { return c===actuales[i]; }),n+': esquema anterior detectado. Ejecute migración en copia; no se restaurará encima de datos existentes.');
    }
  });
  // Ninguno de los dos devuelve el libro: en Apps Script son void y no se encadenan.
  libro.setSpreadsheetLocale('es_CL');
  libro.setSpreadsheetTimeZone('America/Santiago');
  PropertiesService.getScriptProperties().setProperty('LIBRO_OPERATIVO',libro.getId());
  Object.keys(ESQUEMA).forEach(function(n) {
    var h=libro.getSheetByName(n)||libro.insertSheet(n), cols=columnas_(n);
    asegurarTamano_(h,2,cols.length);
    var encabezado=h.getRange(1,1,1,cols.length);
    if(n!=='CALENDARIO'||h.getLastRow()===0) encabezado.setValues([cols]);
    encabezado.setFontWeight('bold').setBackground('#17365d').setFontColor('#ffffff');
    h.setFrozenRows(1); h.setColumnWidths(1,cols.length,155);
    if(TABLAS_APP.indexOf(n)>=0 || n==='TRANSFERENCIAS' || n==='ENVIOS') {
      if(!h.getFilter()) h.getRange(1,1,h.getMaxRows(),cols.length).createFilter();
      var proteccion=h.getProtections(SpreadsheetApp.ProtectionType.RANGE).filter(function(x) { return x.getDescription()==='ID estable'; })[0];
      if(!proteccion) proteccion=h.getRange(2,1,h.getMaxRows()-1,1).protect().setDescription('ID estable');
      proteccion.setWarningOnly(false);
      var propietario=Session.getEffectiveUser(); proteccion.addEditor(propietario);
      proteccion.getEditors().forEach(function(e) { if(e.getEmail()!==propietario.getEmail()) proteccion.removeEditor(e); });
      if(proteccion.canDomainEdit()) proteccion.setDomainEdit(false);
    }
    cols.forEach(function(c,i) {
      var r=h.getRange(2,i+1,h.getMaxRows()-1,1);
      if(/^(Fecha|Venc_)/.test(c)) r.setNumberFormat('dd-mm-yyyy');
      if(/^Hora_|Recibido_Servidor|Capacitacion_Enviada/.test(c)) r.setNumberFormat('dd-mm-yyyy hh:mm');
      if(/^(Monto|Costo|Gasto_|Peaje|Combustible|Estipendio$|Hotel_Monto|Total_Transferencia|Reserva$|Saldo$|Desgaste$)/.test(c)) r.setNumberFormat('"$"#,##0');
      if(/^(Activo|En_RM|Es_Conductor|Obligatorio|Marcado|Checklist_Completo)$/.test(c)) r.setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().setAllowInvalid(false).build());
    });
  });
  listaValidacion_(hoja_('CAMIONETAS'),'Estado',['Disponible','En ruta','En taller','Reserva']);
  listaValidacion_(hoja_('ORDENES'),'Estado_Orden',['Planificada','En curso','Completada','Reprogramada','Cancelada']);
  listaValidacion_(hoja_('GASTOS'),'Estado',['Pendiente','Revisado','Rechazado']);
  listaValidacion_(hoja_('GASTOS'),'Tipo',['Bencina','Peaje','Hotel','Colación','Estacionamiento','Otro']);
  listaValidacion_(hoja_('TRANSFERENCIAS'),'Estado',['Pendiente','Transferido','Devuelto']);
  instalarConfig_(); instalarAgenda_(); escribirGuiaApp_();
  libro.toast('Hojas listas. Los datos existentes se conservaron.','Servicio Técnico');
  return {hojas:Object.keys(ESQUEMA).length};
}
function instalarConfig_() {
  var h=hoja_('CONFIG'), defs=definicionParametros_(), libro=libro_();
  if(h.getLastRow()<=1) h.getRange(2,1,defs.length,5).setValues(defs.map(function(d) { return [d[0],d[1],d[2],d[3],d[4]]; }));
  var valores=h.getDataRange().getValues();
  defs.forEach(function(d) {
    var i=valores.findIndex(function(f) { return f[0]===d[0]; });
    exigir_(i>=1,'CONFIG: falta parámetro '+d[0]);
    var rango=h.getRange(i+1,2); libro.setNamedRange(d[0],rango);
    rango.setBackground('#fff2cc').setBorder(true,true,true,true,false,false);
    var regla=SpreadsheetApp.newDataValidation().setAllowInvalid(false);
    if(d[2]==='fecha') regla.requireDate();
    else if(d[2]==='booleano') regla.requireCheckbox();
    else if(d[2]==='%') regla.requireNumberBetween(0,1);
    else if(typeof d[1]==='number') regla.requireNumberGreaterThanOrEqualTo(0);
    else return;
    rango.setDataValidation(regla.build());
    if(d[2]==='fecha') rango.setNumberFormat('dd-mm-yyyy');
    if(d[2]==='%') rango.setNumberFormat('0%');
  });
  listaValidacion_(h,'Origen',['PDF','JEFATURA','SUPUESTO','MAPS']);
  var fila=defs.length+3;
  h.getRange(fila,1,4,2).setValues([['VERIFICACIÓN DEMO','Resultado'],['Jornada','=IF(P_JORNADA_EFECTIVA=P_ESPERADO_JORNADA,"OK","REVISAR")'],['Capacitación','=IF(P_T_CAP_EFECTIVA=P_ESPERADO_CAP,"OK","REVISAR")'],['Equipos pendientes + instalados','=IF(SUM('+rangoCol_('DESTINOS','Equipos_Pendientes')+')+SUM('+rangoCol_('DESTINOS','Equipos_Instalados')+')=P_ESPERADO_EQUIPOS,"OK","REVISAR")']]);
  h.setConditionalFormatRules([SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('OK').setBackground('#d9ead3').setRanges([h.getRange(fila+1,2,3,1)]).build()]);
}
function crearRespaldo() {
  return conBloqueo_(function() {
    var libro=libro_(), archivo=DriveApp.getFileById(libro.getId()).makeCopy(libro.getName()+' RESPALDO '+Utilities.formatDate(new Date(),'America/Santiago','yyyyMMdd-HHmmss'));
    PropertiesService.getScriptProperties().setProperty('ULTIMO_RESPALDO',archivo.getId());
    return {url:archivo.getUrl(),hojas:libro.getSheets().map(function(h) { return {nombre:h.getName(),filas:h.getLastRow(),columnas:h.getLastColumn()}; })};
  });
}
function inventariarLibro() {
  var l=libro_();
  return {nombre:l.getName(),hojas:l.getSheets().map(function(h) { return {nombre:h.getName(),filas:h.getLastRow(),columnas:h.getLastColumn(),encabezado:h.getRange(1,1,Math.min(2,Math.max(1,h.getLastRow())),Math.max(1,h.getLastColumn())).getDisplayValues()}; }),rangos:l.getNamedRanges().map(function(r) { return r.getName(); }),activadores:ScriptApp.getProjectTriggers().map(function(t) { return {funcion:t.getHandlerFunction(),tipo:String(t.getEventType())}; })};
}
