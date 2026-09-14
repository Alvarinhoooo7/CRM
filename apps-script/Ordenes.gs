/** DOCUMENTOS. HTML escapado; PDF privado en Drive, sin publicación anónima. */
function escaparHtml_(texto) { return String(texto===undefined?'':texto).replace(/[&<>"']/g,function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function carpetaDocumentos_() {
  var p=PropertiesService.getScriptProperties(),id=p.getProperty('CARPETA_DOCUMENTOS');
  if(id) return DriveApp.getFolderById(id);
  var carpeta=DriveApp.createFolder('Servicio Técnico — documentos'); p.setProperty('CARPETA_DOCUMENTOS',carpeta.getId()); return carpeta;
}
function htmlOrden_(id,datos,r) {
  var t=datos.TECNICOS.find(function(t) { return t.ID_Tecnico===id; }); exigir_(t,'TECNICOS: ID inexistente '+id);
  var ordenes=r.ordenes.filter(function(o) { return o.ID_Tecnico===id; }); exigir_(ordenes.length,'Técnico sin órdenes activas');
  var transferencia=r.transferencias.find(function(t) { return t.ID_Tecnico===id; });
  var html='<html><head><meta charset="utf-8"><style>body{font:11pt Arial;color:#17365d}table{width:100%;border-collapse:collapse}td,th{border:1px solid #bbb;padding:6px}h2{page-break-after:avoid}.orden{page-break-inside:avoid}</style></head><body><h1>Orden de servicio — '+escaparHtml_(t.Nombre)+'</h1><p>Base: '+escaparHtml_(datos.parametros.P_BASE)+'</p><p>Anticipo previsto: '+clp_(transferencia.Monto_A_Transferir)+'. No acredita pago.</p>';
  ordenes.forEach(function(o) {
    var visitas=r.visitas.filter(function(v) { return v.ID_Jornada===o.ID_Jornada; }), v=datos.CAMIONETAS.find(function(v) { return v.ID_Vehiculo===o.ID_Vehiculo; });
    html+='<div class="orden"><h2>'+escaparHtml_(fechaClave_(o.Fecha))+' · '+escaparHtml_(o.ID_Orden)+'</h2><p>Camioneta: '+escaparHtml_(v.Modelo+' / '+v.Patente)+' · '+(verdadero_(o.Es_Conductor)?'Conductor':'Acompañante')+'</p><p>Horas: '+o.Horas_Totales.toFixed(2)+' · '+escaparHtml_(o.Estado_Jornada)+'</p><table><tr><th>Ruta y dirección</th><th>Equipos</th><th>Hotel de referencia</th></tr>';
    visitas.forEach(function(visita) {
      var destino=datos.DESTINOS.find(function(d) { return d.ID_Destino===visita.ID_Destino; });
      html+='<tr><td>'+escaparHtml_(visita.ID_Origen+' → '+visita.Comuna)+'<br>'+escaparHtml_(visita.Direccion)+'</td><td>'+visita.Equipos+'</td><td>'+escaparHtml_(Number(visita.Noches)>0&&destino?destino.Hotel_Referencia:'Sin pernoctación')+'</td></tr>';
    });
    html+='</table><p>Gasto base de la jornada: '+clp_(o.Total_Transferencia)+'</p></div>';
  });
  html+='<h2>Checklist e implementos</h2><ul>';
  datos.IMPLEMENTOS.forEach(function(i) { html+='<li>☐ '+escaparHtml_(i.Categoria+' — '+i.Item)+(verdadero_(i.Obligatorio)?' (obligatorio)':'')+'</li>'; });
  return html+'</ul><p>Rutas y hoteles referenciales. Confirme indicaciones y reservas antes de viajar.</p></body></html>';
}
function generarOrdenPDF(idTecnico) { return conBloqueo_(function() { var d=leerOperacion_(), r=calcularPlan(d); return generarPDFInterno_(idTecnico,d,r); }); }
function generarPDFInterno_(id,d,r) {
  var pdf=Utilities.newBlob(htmlOrden_(id,d,r),'text/html','orden.html').getAs(MimeType.PDF).setName('Orden_'+id+'_'+Utilities.formatDate(new Date(),'America/Santiago','yyyyMMdd-HHmmss')+'.pdf');
  var archivo=carpetaDocumentos_().createFile(pdf); return {tecnico:id,url:archivo.getUrl()};
}
function menuPDF() { var id=pedir_('ID del técnico'); if(id) return informar_(function() { return generarOrdenPDF(id); }); }
function generarTodasOrdenes() { return informar_(function() { return conBloqueo_(function() { var d=leerOperacion_(),r=calcularPlan(d); return r.transferencias.map(function(t) { return generarPDFInterno_(t.ID_Tecnico,d,r); }); }); }); }
