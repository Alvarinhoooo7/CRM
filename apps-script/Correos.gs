/** CORREOS. Un registro ENVIANDO incierto exige revisión humana, no reintento ciego. */
function menuCapacitacion() {
  var comuna=pedir_('Comuna o ID destino'); if(!comuna) return;
  return informar_(function() {
    var d=leerTabla_('DESTINOS').find(function(d) { return d.ID_Destino===comuna||d.Comuna.toLowerCase()===comuna.toLowerCase(); });
    exigir_(d,'DESTINOS: comuna inexistente');
    if(!confirmar_('Enviar a '+d.Mail_Cliente+'\nEnlace: '+d.Link_Capacitacion)) return 'Cancelado';
    return enviarCapacitacion(d.ID_Destino);
  });
}
function enviarCapacitacion(idDestino) { return conBloqueo_(function() { return enviarCapacitacionInterno_(idDestino); }); }
function enviarCapacitacionInterno_(idDestino) {
  var p=parametros_(), destinos=leerTabla_('DESTINOS'), d=destinos.find(function(d) { return d.ID_Destino===idDestino; });
  exigir_(d,'DESTINOS: ID inexistente '+idDestino);
  if(d.Capacitacion_Enviada) return {estado:'Ya enviado',destino:idDestino};
  exigir_(verdadero_(p.P_CORREOS_HABILITADOS),'CONFIG: correos deshabilitados. Complete destinatarios reales y habilítelos explícitamente.');
  exigir_(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.Mail_Cliente)&&!/@serviciotecnico\.cl$/i.test(d.Mail_Cliente),'DESTINOS '+idDestino+': reemplace el correo de ejemplo por un destinatario real');
  exigir_(/^https:\/\//i.test(d.Link_Capacitacion),'DESTINOS '+idDestino+': falta enlace HTTPS de capacitación');
  var envios=leerTabla_('ENVIOS'), id='CAP-'+idDestino, anterior=envios.find(function(e) { return e.ID_Envio===id; });
  if(anterior) {
    if(anterior.Estado==='ENVIADO') { escribirCampos_('DESTINOS',destinos,[Object.assign({},d,{Capacitacion_Enviada:anterior.Fecha})],['Capacitacion_Enviada']); return {estado:'Registro recuperado'}; }
    throw new Error('ENVIOS '+id+': envío incierto; revise correo enviado y registro antes de reintentar');
  }
  var registro={ID_Envio:id,ID_Destino:idDestino,Destinatario:d.Mail_Cliente,Enlace:d.Link_Capacitacion,Estado:'ENVIANDO',Fecha:new Date()};
  anexarObjetos_('ENVIOS',[registro]); SpreadsheetApp.flush();
  try {
    MailApp.sendEmail({to:d.Mail_Cliente,subject:'Capacitación previa a instalación — '+d.Comuna,body:'Hola,\n\nAntes de nuestra visita, revise la capacitación completa:\n'+d.Link_Capacitacion+'\n\nEn terreno responderemos sus dudas.\nServicio Técnico'});
    registro.Estado='ENVIADO'; registro.Fecha=new Date();
    escribirCampos_('ENVIOS',envios.concat([registro]),[registro],['Estado','Fecha','Error']);
    escribirCampos_('DESTINOS',destinos,[Object.assign({},d,{Capacitacion_Enviada:registro.Fecha})],['Capacitacion_Enviada']);
    return {estado:'Enviado',destino:idDestino};
  } catch(e) { registro.Error='Resultado incierto: '+e.message; escribirCampos_('ENVIOS',envios.concat([registro]),[registro],['Error']); throw e; }
}
