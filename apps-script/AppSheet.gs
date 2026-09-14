/** INTEGRACION. El sondeo procesa escrituras API que no disparan onChange. */
function prepararHojasAppSheet() {
  var errores=[], datos=leerOperacion_(), ordenes=indice_(datos.ORDENES,'ID_Orden','ORDENES');
  TABLAS_APP.forEach(function(n) {
    var h=hoja_(n);
    if(h.getDataRange().getMergedRanges().length) errores.push(n+': hay celdas combinadas');
    var clave=columnas_(n)[0]; indice_(datos[n],clave,n);
    datos[n].forEach(function(f) {
      if(['TECNICOS','ORDENES','CHECKLIST','GASTOS'].indexOf(n)>=0&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.Email)) errores.push(n+' '+f[clave]+': falta Email válido');
      if(['CHECKLIST','GASTOS'].indexOf(n)>=0) {
        var o=ordenes[f.ID_Orden];
        if(!o||o.ID_Tecnico!==f.ID_Tecnico||o.Email!==f.Email) errores.push(n+' '+f[clave]+': propietario no coincide con orden');
      }
    });
  });
  exigir_(!errores.length,errores.join('\n'));
  return {tablas:TABLAS_APP,resultado:'Estructura válida. Configure seguridad, acciones y usuarios en el editor AppSheet antes de conectar técnicos.'};
}
function menuPrepararApp() { return informar_(prepararHojasAppSheet); }
function regenerarChecklist() { return conBloqueo_(regenerarChecklistInterno_); }
function construirChecklist_(ordenes,implementos,existentes) {
  var ids=indice_(existentes,'ID_Item','CHECKLIST'), combinaciones={};
  existentes.forEach(function(c) { var k=c.ID_Orden+'|'+c.ID_Implemento; exigir_(!combinaciones[k],'CHECKLIST: ítem duplicado '+k); combinaciones[k]=true; });
  var nuevos=[];
  ordenes.filter(function(o) { return o.Estado_Orden!=='Cancelada'; }).forEach(function(o) {
    implementos.forEach(function(i) {
      var clave=o.ID_Orden+'|'+i.ID_Implemento, id='CK-'+o.ID_Orden+'-'+i.ID_Implemento;
      if(!combinaciones[clave]) { exigir_(!ids[id],'CHECKLIST: colisión ID '+id); nuevos.push({ID_Item:id,ID_Orden:o.ID_Orden,ID_Tecnico:o.ID_Tecnico,Fecha:o.Fecha,Categoria:i.Categoria,Item:i.Item,Obligatorio:i.Obligatorio,Marcado:false,Email:o.Email,ID_Implemento:i.ID_Implemento}); }
    });
  });
  return nuevos;
}
function regenerarChecklistInterno_() { var nuevas=construirChecklist_(leerTabla_('ORDENES'),leerTabla_('IMPLEMENTOS'),leerTabla_('CHECKLIST')); anexarObjetos_('CHECKLIST',nuevas); return {creadas:nuevas.length}; }
function validarHitos_(orden,items,visitas) {
  var errores=[], secuencia=['Hora_Inicio_Jornada','Hora_Salida_Ruta'];
  if(Number(orden.Equipos)>0) secuencia=secuencia.concat(['Hora_Inicio_Instalacion','Hora_Fin_Instalacion']);
  if(Number(orden.Horas_Capacitacion)>0) secuencia=secuencia.concat(['Hora_Inicio_Capacitacion','Hora_Fin_Capacitacion']);
  secuencia.push('Hora_Fin_Jornada');
  var anterior=null, falta=false;
  secuencia.forEach(function(c) {
    var valor=orden[c];
    if(!valor) { falta=true; return; }
    var tiempo=valor instanceof Date?valor.getTime():NaN;
    if(!Number.isFinite(tiempo)) errores.push(c+': fecha inválida');
    if(falta) errores.push(c+': falta hito anterior');
    if(anterior!==null&&tiempo<anterior) errores.push(c+': hora anterior al hito previo');
    anterior=tiempo;
  });
  if(orden.Hora_Salida_Ruta) {
    if(!items.length||items.some(function(i) { return verdadero_(i.Obligatorio)&&!verdadero_(i.Marcado); })) errores.push('Salida sin checklist obligatorio completo');
    if(!verdadero_(orden.Checklist_Completo)) errores.push('Salida sin confirmar checklist');
  }
  if(orden.Hora_Fin_Jornada&&Number(orden.Equipos)>0) {
    visitas.filter(function(v) { return v.ID_Jornada===orden.ID_Jornada&&Number(v.Equipos)>0; }).forEach(function(v) {
      if(Number(v.Equipos_Instalados)!==Number(v.Equipos)||!v.Firma_Cliente||!v.Foto_Instalacion||!v.Hora_Fin_Instalacion) errores.push('Visita incompleta: '+v.ID_Visita);
    });
  }
  return errores;
}
function procesarLoQueEnvioApp() {
  return conBloqueo_(function() {
    var d=leerOperacion_(), ordenes=indice_(d.ORDENES,'ID_Orden','ORDENES'), ahora=new Date();
    indice_(d.GASTOS,'ID_Gasto','GASTOS'); indice_(d.CHECKLIST,'ID_Item','CHECKLIST');
    var cambios=d.ORDENES.map(function(o) {
      var errores=validarHitos_(o,d.CHECKLIST.filter(function(c) { return c.ID_Orden===o.ID_Orden; }),d.VISITAS);
      var estado=o.Estado_Orden;
      if(!errores.length && ['Cancelada','Reprogramada'].indexOf(estado)<0) estado=o.Hora_Fin_Jornada?'Completada':o.Hora_Inicio_Jornada?'En curso':estado;
      return Object.assign({},o,{Estado_Orden:estado,Error_Validacion:errores.join('; '),Recibido_Servidor:o.Recibido_Servidor|| (o.Hora_Inicio_Jornada?ahora:'')});
    });
    var gastos=d.GASTOS.map(function(g) {
      var o=ordenes[g.ID_Orden], errores=[];
      if(!o||o.ID_Tecnico!==g.ID_Tecnico||o.Email!==g.Email) errores.push('Propietario incompatible con orden');
      if(o&&o.Estado_Orden==='Cancelada') errores.push('Orden cancelada: requiere revisión del supervisor');
      if(!Number.isFinite(Number(g.Monto))||Number(g.Monto)<=0) errores.push('Monto debe ser positivo');
      if(!g.Foto_Boleta) errores.push('Falta foto de boleta');
      return Object.assign({},g,{Error_Validacion:errores.join('; '),Recibido_Servidor:g.Recibido_Servidor||ahora,Folio:g.Folio||nuevaClave_('F',d.GASTOS,'Folio')});
    });
    escribirCampos_('ORDENES',d.ORDENES,cambios,['Estado_Orden','Error_Validacion','Recibido_Servidor']);
    escribirCampos_('GASTOS',d.GASTOS,gastos,['Folio','Recibido_Servidor','Error_Validacion']);
    // Registra el envío antes de MailApp. Ante resultado incierto no reenvía automáticamente.
    if(verdadero_(d.parametros.P_CORREOS_HABILITADOS)) {
      var destinos={}; cambios.filter(function(o) { return o.Hora_Salida_Ruta&&!o.Error_Validacion&&o.Estado_Orden!=='Cancelada'; }).forEach(function(o) {
        d.VISITAS.filter(function(v) { return v.ID_Jornada===o.ID_Jornada&&Number(v.Equipos)>0; }).forEach(function(v) { destinos[v.ID_Destino]=true; });
      });
      Object.keys(destinos).forEach(function(id) { enviarCapacitacionInterno_(id); });
    }
    return recalcularInterno_();
  });
}
function menuProcesarApp() { return informar_(procesarLoQueEnvioApp); }
function instalarActivadores() {
  return conBloqueo_(function() {
    var p=parametros_(), intervalo=Number(p.P_INTERVALO_APP);
    exigir_([1,5,10,15,30].indexOf(intervalo)>=0,'CONFIG P_INTERVALO_APP debe ser 1, 5, 10, 15 o 30');
    var funciones=['procesoDiarioFlota','procesoDiarioPlan','procesarLoQueEnvioApp'];
    ScriptApp.getProjectTriggers().forEach(function(t) { if(funciones.indexOf(t.getHandlerFunction())>=0) ScriptApp.deleteTrigger(t); });
    ScriptApp.newTrigger('procesoDiarioFlota').timeBased().atHour(Number(p.P_HORA_FLOTA)).everyDays(1).inTimezone('America/Santiago').create();
    ScriptApp.newTrigger('procesoDiarioPlan').timeBased().atHour(Number(p.P_HORA_RECALCULO)).everyDays(1).inTimezone('America/Santiago').create();
    ScriptApp.newTrigger('procesarLoQueEnvioApp').timeBased().everyMinutes(intervalo).create();
    return {activadores:funciones,nota:'Ventanas horarias; las escrituras de AppSheet se procesan por sondeo.'};
  });
}
function procesoDiarioPlan() { return procesarLoQueEnvioApp(); }
function escribirGuiaApp_() {
  var filas=[['Tema','Instrucción'],['Fuente','Conectar este mismo spreadsheet. No importar CSV.'],['Login','Require sign-in con Google. Agregar únicamente usuarios autorizados.'],
    ['ORDENES / CHECKLIST / GASTOS','Security filter: [Email] = USEREMAIL(). Email y propietario no editables.'],['TECNICOS','Security filter: [Email] = USEREMAIL(). No exponer montos de compañeros.'],
    ['VISITAS','Security filter: IN([ID_Jornada], SELECT(ORDENES[ID_Jornada], [Email] = USEREMAIL())).'],['Maestros','DESTINOS, TECNICOS, CAMIONETAS, IMPLEMENTOS: solo lectura.'],
    ['Gastos','Adds only. ID_Gasto inicial CONCATENATE("G-", UNIQUEID()). Email USEREMAIL(). ID_Tecnico por referencia a orden; Folio lo asigna servidor.'],
    ['Claves','Usar ID de primera columna. Nunca _RowNumber. CHECKLIST se regenera sin borrar marcas.'],['Escritura','ORDENES: únicamente hitos, firma, foto, observaciones y GPS. Motor conserva esas columnas.'],
    ['Visitas','Una fila por tramo; evidencias de servicio por visita. Solo conductor registra evidencias compartidas.'],['Sincronización','Sondeo según P_INTERVALO_APP. Hora móvil no certifica hora servidor; Recibido_Servidor registra primera recepción.'],
    ['Salida','Solo tras checklist obligatorio completo. Correo se envía tras sincronizar, con P_CORREOS_HABILITADOS.'],['Traslado','Sin instalación: después de salir a ruta habilitar cierre, sin exigir firma.'],
    ['Vistas','Mi ruta; Detalle de la orden; Mi jornada; Checklist; Rendir gasto; Mi saldo. Ver appsheet/README.md para expresiones completas.'],['Pruebas','Probar dos usuarios y sin conexión antes del corte. No basta con slices o vistas para proteger datos.']];
  var h=hoja_('LEEME_APPSHEET'); h.clearContents(); h.getRange(1,1,filas.length,2).setValues(filas); h.setColumnWidth(2,850); h.getDataRange().setWrap(true);
}
