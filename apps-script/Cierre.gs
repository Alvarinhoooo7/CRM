/** NOMINA Y CIERRE. No ejecuta pagos ni cambia el estado Transferido al exportar. */
function csvSeguro_(filas) {
  return '\uFEFF'+filas.map(function(f) { return f.map(function(v) { var s=String(v===undefined?'':v); if(/^[=+@\-\t\r]/.test(s)) s="'"+s; return '"'+s.replace(/"/g,'""')+'"'; }).join(';'); }).join('\r\n');
}
function prepararNominaTransferencias() {
  return conBloqueo_(function() {
    recalcularInterno_();
    var filas=leerTabla_('TRANSFERENCIAS'),columnas=columnas_('TRANSFERENCIAS');
    var csv=csvSeguro_([columnas].concat(filas.map(function(f) { return columnas.map(function(c) { return f[c] instanceof Date?fechaClave_(f[c]):f[c]; }); })));
    var archivo=carpetaDocumentos_().createFile('Nomina_'+Utilities.formatDate(new Date(),'America/Santiago','yyyyMMdd-HHmmss')+'.csv',csv,MimeType.CSV);
    return {url:archivo.getUrl(),nota:'Nómina de revisión, no archivo bancario de ejecución. Complete datos reales antes de transferir.'};
  });
}
function menuNomina() { return informar_(prepararNominaTransferencias); }
function revisarGastosPendientes() { libro_().setActiveSheet(hoja_('GASTOS')); return informar_(function() { return leerTabla_('GASTOS').filter(function(g) { return g.Estado==='Pendiente'; }).map(function(g) { return {id:g.ID_Gasto,tecnico:g.ID_Tecnico,monto:g.Monto,error:g.Error_Validacion}; }); }); }
function resumenCierre_(datos,inicio,fin) {
  var desde=fechaClave_(inicio),hasta=fechaClave_(fin);
  function dentro(fecha) { if(!fecha) return false; var f=fechaClave_(fecha); return f>=desde&&f<=hasta; }
  return datos.TECNICOS.map(function(t) {
    var ordenes=datos.ORDENES.filter(function(o) { return o.ID_Tecnico===t.ID_Tecnico&&dentro(o.Fecha)&&o.Estado_Orden!=='Cancelada'; });
    var gastos=datos.GASTOS.filter(function(g) { return g.ID_Tecnico===t.ID_Tecnico&&dentro(g.Fecha); });
    var horas=ordenes.reduce(function(a,o) { return a+(o.Hora_Fin_Jornada instanceof Date&&o.Hora_Inicio_Jornada instanceof Date?(o.Hora_Fin_Jornada-o.Hora_Inicio_Jornada)/3600000:0); },0);
    var rendido=gastos.filter(function(g) { return g.Estado==='Revisado'&&!g.Error_Validacion; }).reduce(function(a,g) { return a+Number(g.Monto); },0);
    var anticipos=datos.TRANSFERENCIAS.filter(function(x) { return x.ID_Tecnico===t.ID_Tecnico&&dentro(x.Fecha_Transferencia); }).reduce(function(a,x) { return a+Number(x.Monto_Transferido||0); },0);
    return [t.ID_Tecnico,t.Nombre,horas,rendido,anticipos,anticipos-rendido,gastos.filter(function(g) { return g.Estado==='Pendiente'; }).length];
  });
}
function cerrarSemana(fechaInicio) {
  return conBloqueo_(function() {
    exigir_(/^\d{4}-\d{2}-\d{2}$/.test(String(fechaInicio)),'Indique lunes inicial yyyy-mm-dd');
    var partes=fechaInicio.split('-').map(Number), inicio=new Date(partes[0],partes[1]-1,partes[2],12),fin=new Date(inicio);
    exigir_(fechaClave_(inicio)===fechaInicio&&inicio.getDay()===1,'El inicio del cierre debe ser lunes'); fin.setDate(fin.getDate()+6);
    var nombre='CIERRE_'+Utilities.formatDate(inicio,'America/Santiago','dd-MM-yyyy'),libro=libro_();
    exigir_(!libro.getSheetByName(nombre),'Ya existe '+nombre+'. No se sobrescribe un cierre histórico.');
    var datos=leerOperacion_();
    exigir_(!datos.ORDENES.some(function(o) { return fechaClave_(o.Fecha)>=fechaClave_(inicio)&&fechaClave_(o.Fecha)<=fechaClave_(fin)&&o.Error_Validacion; }),'Hay jornadas inválidas en la semana; procese y corrija antes de cerrar');
    datos.ORDENES.filter(function(o) { return fechaClave_(o.Fecha)>=fechaClave_(inicio)&&fechaClave_(o.Fecha)<=fechaClave_(fin)&&o.Estado_Orden!=='Cancelada'; }).forEach(function(o) {
      var errores=validarHitos_(o,datos.CHECKLIST.filter(function(c) { return c.ID_Orden===o.ID_Orden; }),datos.VISITAS);
      exigir_(!errores.length,'ORDENES '+o.ID_Orden+': '+errores.join('; '));
      exigir_(!o.Hora_Inicio_Jornada||o.Hora_Fin_Jornada,'ORDENES '+o.ID_Orden+': jornada iniciada sin cierre');
    });
    var filas=[['ID_Tecnico','Nombre','Horas_Reales','Rendido_Aprobado','Anticipos_Pagados','Saldo_Semana','Gastos_Pendientes']].concat(resumenCierre_(datos,inicio,fin));
    var h=libro.insertSheet(nombre); h.getRange(1,1,filas.length,filas[0].length).setValues(filas); h.setFrozenRows(1); h.getRange(1,1,1,7).setFontWeight('bold');
    h.getRange(filas.length+2,1,1,2).setValues([['Cerrado',new Date()]]);
    h.getRange(filas.length+3,1,1,2).setValues([['Rendiciones tardías','Se registran como ajuste en un cierre posterior; nunca reescribir este documento.']]);
    var proteccion=h.protect().setDescription('Cierre histórico'); proteccion.addEditor(Session.getEffectiveUser());
    proteccion.getEditors().forEach(function(e) { if(e.getEmail()!==Session.getEffectiveUser().getEmail()) proteccion.removeEditor(e); }); if(proteccion.canDomainEdit()) proteccion.setDomainEdit(false);
    return {hoja:nombre,tecnicos:filas.length-1};
  });
}
function menuCerrarSemana() { var fecha=pedir_('Lunes de la semana (yyyy-mm-dd)'); if(fecha&&confirmar_('Crear cierre protegido para la semana del '+fecha+'?')) return informar_(function() { return cerrarSemana(fecha); }); }
