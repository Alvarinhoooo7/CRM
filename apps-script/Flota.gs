/** FLOTA. El kilometraje previsto no reemplaza la lectura real del odómetro. */
function alertasFlota_(vehiculo,p,fecha) {
  var alertas=[], faltantes=Number(vehiculo.Km_Proxima_Mantencion)-Number(vehiculo.Km_Inicial)-Number(vehiculo.Km_Recorridos_Plan||0);
  if(faltantes<=p.P_AVISO_MANTENCION) alertas.push(faltantes<0?'Mantención vencida según proyección':'Mantención próxima según proyección');
  ['Venc_Revision_Tecnica','Venc_Seguro','Venc_Permiso_Circulacion'].forEach(function(c) {
    var venc=vehiculo[c];
    if(!(venc instanceof Date)||isNaN(venc.getTime())) alertas.push(c+': falta fecha');
    else if((venc-fecha)/86400000<=p.P_AVISO_DOCUMENTOS) alertas.push(c+': vencido o próximo');
  });
  return alertas;
}
function actualizarFlota_(datos,r) {
  var porId=indice_(r.flota,'ID_Vehiculo','flota calculada');
  var calculados=datos.CAMIONETAS.map(function(v) { var f=porId[v.ID_Vehiculo]||{Km_Recorridos_Plan:0,Gasto_Peajes:0}; return Object.assign({},v,f); });
  escribirCampos_('CAMIONETAS',datos.CAMIONETAS,calculados,['Km_Recorridos_Plan','Gasto_Peajes']);
  if(!calculados.length) return;
  var h=hoja_('CAMIONETAS');
  ['Km_Acumulado','Km_Faltantes','Litros_Consumidos','Gasto_Combustible','Gasto_Desgaste','Alerta'].forEach(function(c) {
    h.getRange(2,columnas_('CAMIONETAS').indexOf(c)+1,calculados.length,1).setFormulas(calculados.map(function(v,i) {
      var f=i+2,formula;
      if(c==='Km_Acumulado') formula='D'+f+'+E'+f;
      if(c==='Km_Faltantes') formula='G'+f+'-F'+f;
      if(c==='Litros_Consumidos') formula='E'+f+'/P_RENDIMIENTO';
      if(c==='Gasto_Combustible') formula='M'+f+'*P_DIESEL';
      if(c==='Gasto_Desgaste') formula='E'+f+'*P_COSTO_KM';
      if(c==='Alerta') formula='TEXTJOIN("; ",TRUE,IF(H'+f+'<=P_AVISO_MANTENCION,"Mantención próxima/vencida (proyección)",""),IF(OR(I'+f+'="",J'+f+'="",K'+f+'=""),"Falta documento",IF(MIN(I'+f+':K'+f+')<=TODAY()+P_AVISO_DOCUMENTOS,"Documento próximo/vencido","")))';
      return ['='+formula];
    }));
  });
}
function revisarFlota() { return conBloqueo_(function() { var d=leerOperacion_(), r=calcularPlan(d); actualizarFlota_(d,r); return d.CAMIONETAS.map(function(v) { var f=r.flota.find(function(f) { return f.ID_Vehiculo===v.ID_Vehiculo; }); return {vehiculo:v.ID_Vehiculo,alertas:alertasFlota_(Object.assign({},v,f),d.parametros,new Date())}; }).filter(function(v) { return v.alertas.length; }); }); }
function menuFlota() { return informar_(revisarFlota); }
function menuTaller() {
  var id=pedir_('ID de camioneta para marcar En taller'); if(!id||!confirmar_('Marcar '+id+' en taller. Se alertarán sus asignaciones existentes.')) return;
  return informar_(function() { return conBloqueo_(function() { var filas=leerTabla_('CAMIONETAS'), v=filas.find(function(v) { return v.ID_Vehiculo===id; }); exigir_(v,'CAMIONETAS: ID inexistente'); escribirCampos_('CAMIONETAS',filas,[Object.assign({},v,{Estado:'En taller'})],['Estado']); return recalcularInterno_(); }); });
}
function procesoDiarioFlota() {
  var alertas=revisarFlota(), p=parametros_();
  if(alertas.length&&verdadero_(p.P_CORREOS_HABILITADOS)) {
    exigir_(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.P_MAIL_SUPERVISOR)&&!/@serviciotecnico\.cl$/i.test(p.P_MAIL_SUPERVISOR),'CONFIG: falta correo real de supervisor');
    var clave='ALERTA_FLOTA_'+Utilities.formatDate(new Date(),'America/Santiago','yyyyMMdd');
    conBloqueo_(function() { var props=PropertiesService.getScriptProperties(); if(props.getProperty(clave)) return; props.setProperty(clave,'ENVIANDO'); MailApp.sendEmail(p.P_MAIL_SUPERVISOR,'Alertas de flota',JSON.stringify(alertas,null,2)); props.setProperty(clave,'ENVIADO'); });
  }
  return alertas;
}
