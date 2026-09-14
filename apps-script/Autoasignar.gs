/** AGENDA. Las simulaciones no escriben tablas; confirmar vuelve a validar. */
function instalarAgenda_() {
  var h=hoja_('AGENDAR');
  if(h.getLastRow()>1) return;
  h.getRange(2,1,15,2).setValues([
    ['ID destino','D01'],['Equipos',''],['Fecha deseada','=P_FECHA_INICIO'],['Técnicos','=P_TEC_POR_CUADRILLA'],
    ['Km ida','=IFERROR(VLOOKUP(B2,DESTINOS!A:P,7,FALSE),"")'],
    ['Viaje ida y vuelta','=IFERROR(VLOOKUP(B2,DESTINOS!A:P,8,FALSE)*2,"")'],
    ['Instalación','=IFERROR(ROUNDUP(B3/B5,0)*P_T_INSTALACION,"")'],
    ['Capacitación','=P_T_CAP_EFECTIVA*P_CAP_POR_COMUNA'],['Horas totales','=IFERROR(B7+B8+B9,"")'],
    ['Semáforo','=IF(B10="","Complete entradas",IF(B10<=P_JORNADA_DIA,"CABE EN LA JORNADA",IF(B10<=P_TOPE_DIA,"NECESITA HORAS EXTRA","NO CABE, HAY QUE PERNOCTAR O MOVER ALGO")))'],
    ['Combustible','=IFERROR(B6*2/P_RENDIMIENTO*P_DIESEL,"")'],
    ['Peajes','=IFERROR(VLOOKUP(B2,DESTINOS!A:P,9,FALSE)*2,"")'],
    ['Estipendios','=IFERROR(IF(VLOOKUP(B2,DESTINOS!A:P,5,FALSE),P_COLACION,P_VIATICO)*B5,"")'],
    ['Total base','=IFERROR(SUM(B12:B14),"")'],['Confirmación','Use el menú Agendar trabajo nuevo; simule y confirme.']
  ]);
  h.getRange('B2:B5').setBackground('#fff2cc');
  h.getRange('B2').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(hoja_('DESTINOS').getRange('A2:A'),true).setAllowInvalid(false).build());
  h.getRange('B4').setNumberFormat('dd-mm-yyyy');
  var tandas='ROUNDUP(B3/B5,0)',primera='ROUNDDOWN((P_JORNADA_DIA-B9)/P_T_INSTALACION,0)',siguientes='ROUNDDOWN(P_JORNADA_DIA/P_T_INSTALACION,0)';
  h.getRange(17,1,10,2).setValues([
    ['Días de instalación','=IFERROR(1+ROUNDUP(MAX(0,'+tandas+'-'+primera+')/'+siguientes+',0),"")'],
    ['Requiere pernoctación','=IFERROR(OR(B7/2>P_UMBRAL_PERNOCTA,B10>P_TOPE_DIA,B7>P_TOPE_CONDUCCION),FALSE)'],
    ['Días del trabajo','=IFERROR(IF(B18,B17+2,1),"")'],
    ['Noches por técnico','=IFERROR(IF(B18,B19-1,0),"")'],
    ['Hotel total','=IFERROR(B20*P_HOTEL*B5,"")'],
    ['Estipendios del trabajo','=IFERROR(B14*B19,"")'],
    ['Base del trabajo','=IFERROR(B12+B13+B21+B22,"")'],
    ['Límite','Disponibilidad de todos los días; confirmar desde diálogo. No incluye reserva.'],
    ['Fecha fin','=IFERROR(WORKDAY(B4,B19-1),"")'],
    ['Revisión de calendario','=IFERROR(IF(B25-B4>B19-1,"Cruza fin de semana: requiere itinerario explícito",IF(B7/2>P_TOPE_CONDUCCION,"Requiere escalas de conducción","Revisar propuesta del menú")),"")']
  ]);
  var previas='IFERROR(SUM(FILTER('+rangoCol_('VISITAS','Equipos')+','+rangoCol_('VISITAS','ID_Destino')+'=B2,ISNUMBER(MATCH('+rangoCol_('VISITAS','ID_Jornada')+',FILTER('+rangoCol_('ORDENES','ID_Jornada')+','+rangoCol_('ORDENES','Fecha')+'<INT(B4)+1,'+rangoCol_('ORDENES','Estado_Orden')+'<>"Cancelada"),0)))),0)';
  h.getRange('B9').setFormulas([['=IF('+previas+'>0,0,P_T_CAP_EFECTIVA*P_CAP_POR_COMUNA)']]);
  h.getRange('B25').setNumberFormat('dd-mm-yyyy');
  h.getRange('D1:F1').setValues([['Técnico disponible','Nombre','Email']]);
  var fechas=rangoCol_('ORDENES','Fecha')+'>=INT($B$4),'+rangoCol_('ORDENES','Fecha')+'<INT($B$25)+1,'+rangoCol_('ORDENES','Estado_Orden')+'<>"Cancelada"';
  h.getRange('D2').setFormulas([['=IFERROR(FILTER(TECNICOS!A2:C,TECNICOS!H2:H=TRUE,ISNA(MATCH(TECNICOS!A2:A,FILTER('+rangoCol_('ORDENES','ID_Tecnico')+','+fechas+'),0))),"Sin técnicos libres")']]);
  h.getRange('H1:J1').setValues([['Vehículo disponible','Patente','Modelo']]);
  h.getRange('H2').setFormulas([['=IFERROR(FILTER(CAMIONETAS!A2:C,((CAMIONETAS!L2:L="Disponible")+(CAMIONETAS!L2:L="Reserva"))>0,ISNA(MATCH(CAMIONETAS!A2:A,FILTER('+rangoCol_('ORDENES','ID_Vehiculo')+','+fechas+'),0))),"Sin camionetas libres")']]);
}
function abrirAgenda() { SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutputFromFile('Agenda').setWidth(600).setHeight(620),'Agendar trabajo nuevo'); }
function datosFormularioAgenda() {
  var d=leerOperacion_(); return {destinos:d.DESTINOS.map(function(x) { return {id:x.ID_Destino,nombre:x.Comuna}; }),tecnicos:d.parametros.P_TEC_POR_CUADRILLA};
}
function nuevaClave_(prefijo,existentes,campo) {
  var props=PropertiesService.getScriptProperties(), n=Number(props.getProperty('SECUENCIA_'+prefijo)||0);
  existentes.forEach(function(o) { var m=String(o[campo]).match(new RegExp('^'+prefijo+'(\\d+)$')); if(m) n=Math.max(n,Number(m[1])); });
  n++; props.setProperty('SECUENCIA_'+prefijo,String(n)); return prefijo+String(n).padStart(6,'0');
}
function simularConDatos_(entrada,datos) {
  var p=datos.parametros, destino=datos.DESTINOS.find(function(d) { return d.ID_Destino===entrada.destino; });
  exigir_(destino,'AGENDAR: destino inexistente');
  var equipos=Number(entrada.equipos), cantidad=Number(entrada.tecnicos), fecha=String(entrada.fecha);
  exigir_(Number.isInteger(equipos)&&equipos>0,'AGENDAR: equipos debe ser entero positivo');
  exigir_(Number.isInteger(cantidad)&&cantidad>0&&cantidad<=p.P_CAPACIDAD_CAMIONETA,'AGENDAR: dotación sobre la capacidad de la camioneta');
  exigir_(/^\d{4}-\d{2}-\d{2}$/.test(fecha),'AGENDAR: fecha inválida');
  var partes=fecha.split('-').map(Number), fechaObjeto=new Date(partes[0],partes[1]-1,partes[2],12);
  exigir_(fechaClave_(fechaObjeto)===fecha && fechaObjeto.getDay()!==0 && fechaObjeto.getDay()!==6,'AGENDAR: elija un día hábil válido');
  var velocidad=destino.Corredor==='URB'?p.P_VEL_URBANA:destino.Corredor==='R78'?p.P_VEL_R78:p.P_VEL_RUTA5;
  var ida=Number(destino.Km_Ida)/velocidad*p.P_FACTOR_HORAS, instalacion=Math.ceil(equipos/cantidad)*p.P_T_INSTALACION;
  var atendida=datos.VISITAS.some(function(v) { return v.ID_Destino===destino.ID_Destino&&Number(v.Equipos)>0&&datos.ORDENES.some(function(o) { return o.ID_Jornada===v.ID_Jornada&&o.Estado_Orden!=='Cancelada'&&fechaClave_(o.Fecha)<=fecha; }); });
  var cap=atendida?0:p.P_CAP_POR_COMUNA*p.P_T_CAP_EFECTIVA, horas=ida*2+instalacion+cap;
  var dias=[];
  if(horas<=p.P_TOPE_DIA&&ida*2<=p.P_TOPE_CONDUCCION&&ida<=p.P_UMBRAL_PERNOCTA) dias.push({equipos:equipos,ida:true,regreso:true,noches:0,horas:horas});
  else {
    exigir_(ida<=p.P_TOPE_CONDUCCION&&ida<=p.P_TOPE_DIA,'AGENDAR: el traslado requiere escalas intermedias; complete un itinerario de tramos antes de agendar');
    dias.push({equipos:0,ida:true,regreso:false,noches:1,horas:ida});
    var pendientes=equipos;
    while(pendientes>0) {
      var capacitacion=pendientes===equipos?cap:0, capacidad=Math.floor((p.P_JORNADA_DIA-capacitacion)/p.P_T_INSTALACION)*cantidad;
      exigir_(capacidad>0,'CONFIG: instalación no cabe en jornada efectiva');
      var instalar=Math.min(pendientes,capacidad); dias.push({equipos:instalar,ida:false,regreso:false,noches:1,horas:Math.ceil(instalar/cantidad)*p.P_T_INSTALACION+capacitacion}); pendientes-=instalar;
      exigir_(dias.length<Number(p.P_MAX_DIAS_AGENDA),'AGENDAR: excede horizonte P_MAX_DIAS_AGENDA');
    }
    dias.push({equipos:0,ida:false,regreso:true,noches:0,horas:ida});
  }
  dias.forEach(function(d,i) { d.fecha=fechaClave_(fechaLaboral_(fechaObjeto,i)); });
  // Un viaje no vuelve a base durante el fin de semana; contar también esas noches y viáticos.
  exigir_(dias.every(function(d,i) { if(!i)return true; var a=d.fecha.split('-').map(Number),b=dias[i-1].fecha.split('-').map(Number); return (Date.UTC(a[0],a[1]-1,a[2])-Date.UTC(b[0],b[1]-1,b[2]))/86400000===1; }),'AGENDAR: el trabajo cruza un fin de semana. Planifique explícitamente estadía y descansos antes de confirmar.');
  var fechas=dias.map(function(d) { return d.fecha; });
  var ocupados=datos.ORDENES.filter(function(o) { return o.Estado_Orden!=='Cancelada'&&fechas.indexOf(fechaClave_(o.Fecha))>=0; });
  var libres=datos.TECNICOS.filter(function(t) { return verdadero_(t.Activo)&&!ocupados.some(function(o) { return o.ID_Tecnico===t.ID_Tecnico; }); });
  var r=calcularPlan(datos), carga={}; r.ordenes.forEach(function(o) { carga[o.ID_Tecnico]=(carga[o.ID_Tecnico]||0)+o.Horas_Totales; });
  libres.sort(function(a,b) { return (a.Licencia==='Clase B'?0:1)-(b.Licencia==='Clase B'?0:1)||(carga[a.ID_Tecnico]||0)-(carga[b.ID_Tecnico]||0)||a.ID_Tecnico.localeCompare(b.ID_Tecnico); });
  var vehiculos=datos.CAMIONETAS.filter(function(v) { return ['Disponible','Reserva'].indexOf(v.Estado)>=0&&!ocupados.some(function(o) { return o.ID_Vehiculo===v.ID_Vehiculo; }); });
  var motivo=libres.length<cantidad?'No hay suficientes técnicos libres todos los días':!libres[0]||libres[0].Licencia!=='Clase B'?'No hay conductor con licencia':!vehiculos.length?'No hay camioneta disponible todos los días':'';
  var combustible=Number(destino.Km_Ida)*2/p.P_RENDIMIENTO*p.P_DIESEL, peaje=Number(destino.Peaje_Ida)*2, estipendio=(verdadero_(destino.En_RM)?p.P_COLACION:p.P_VIATICO)*cantidad*dias.length;
  var noches=dias.reduce(function(a,d) { return a+d.noches; },0),hotel=noches*cantidad*p.P_HOTEL;
  var anticipos=redondearAnticipo_((estipendio+hotel)/cantidad+combustible+peaje,p)+(cantidad-1)*redondearAnticipo_((estipendio+hotel)/cantidad,p);
  var extra=dias.reduce(function(a,d) { return a+Math.max(0,d.horas-p.P_JORNADA_DIA_MAX)*p.P_VALOR_HORA*(1+p.P_RECARGO_EXTRA)*cantidad; },0);
  var desgaste=Number(destino.Km_Ida)*2*p.P_COSTO_KM;
  return {confirmable:!motivo,motivo:motivo,fecha:fecha,destino:destino.ID_Destino,equipos:equipos,tecnicos:libres.slice(0,cantidad).map(function(t) { return t.ID_Tecnico; }),vehiculo:vehiculos[0]?vehiculos[0].ID_Vehiculo:'',horas:horas,horasViaje:ida*2,combustible:combustible,peaje:peaje,estipendio:estipendio,hotel:hotel,noches:noches,dias:dias,subtotal:combustible+peaje+estipendio+hotel,anticipoTrabajo:anticipos,costoOperacion:anticipos+extra+desgaste,horasExtraMonto:extra,requierePernocta:noches>0,disponibles:libres.map(function(t) { return t.Nombre; }),nota:'Reserva redondeada para este trabajo. La nómina global redondea por técnico sobre todo el plan. Revise hotel y fechas antes de confirmar.'};
}
function simularTrabajoNuevo(entrada) { return simularConDatos_(entrada,leerOperacion_()); }
function confirmarTrabajoNuevo(entrada) {
  return conBloqueo_(function() {
    exigir_(/^[a-zA-Z0-9-]{16,64}$/.test(String(entrada.solicitud)),'Falta identificador estable de la solicitud. Abra de nuevo el diálogo.');
    var propiedades=PropertiesService.getScriptProperties(),clave='AGENDA_'+entrada.solicitud, previa=propiedades.getProperty(clave);
    if(previa) return completarAgendaPendiente_(clave,JSON.parse(previa));
    var datos=leerOperacion_(), propuesta=simularConDatos_(entrada,datos);
    exigir_(propuesta.confirmable,propuesta.motivo);
    exigir_(entrada.propuesta && JSON.stringify(propuesta)===JSON.stringify(entrada.propuesta),'La disponibilidad o el costo cambiaron. Simule y confirme nuevamente.');
    var destino=datos.DESTINOS.find(function(d) { return d.ID_Destino===entrada.destino; }),ordenes=[],visitas=[],cuadrilla='N-'+entrada.solicitud;
    propuesta.dias.forEach(function(dia) {
      var jornada=nuevaClave_('J',datos.ORDENES,'ID_Jornada'),partes=dia.fecha.split('-').map(Number),fecha=new Date(partes[0],partes[1]-1,partes[2],12);
      propuesta.tecnicos.forEach(function(id,i) { var t=datos.TECNICOS.find(function(t) { return t.ID_Tecnico===id; }); ordenes.push({ID_Orden:nuevaClave_('O',datos.ORDENES,'ID_Orden'),ID_Jornada:jornada,Dia:'Nuevo',Fecha:fecha,Cuadrilla:cuadrilla,ID_Tecnico:id,ID_Vehiculo:propuesta.vehiculo,Es_Conductor:i===0,ID_Destino:destino.ID_Destino,Estado_Orden:'Planificada',Email:t.Email}); });
      var tramos=[];
      if(dia.ida) tramos.push({ID_Origen:'BASE',ID_Destino:destino.ID_Destino,Km:destino.Km_Ida,Peaje:destino.Peaje_Ida,Equipos:dia.equipos,Noches:dia.noches});
      if(!dia.ida&&!dia.regreso) tramos.push({ID_Origen:destino.ID_Destino,ID_Destino:destino.ID_Destino,Km:0,Peaje:0,Equipos:dia.equipos,Noches:dia.noches});
      if(dia.regreso) tramos.push({ID_Origen:destino.ID_Destino,ID_Destino:'BASE',Km:destino.Km_Ida,Peaje:destino.Peaje_Ida,Equipos:0,Noches:0});
      tramos.forEach(function(t,i) { visitas.push(Object.assign(t,{ID_Visita:nuevaClave_('VI',datos.VISITAS,'ID_Visita'),ID_Jornada:jornada,Secuencia:i+1,Corredor:destino.Corredor,Origen_Dato:'CONFIGURADO'})); });
    });
    var nuevos=Object.assign({},datos,{ORDENES:datos.ORDENES.concat(ordenes),VISITAS:datos.VISITAS.concat(visitas)});
    calcularPlan(nuevos);
    var pendiente={estado:'PREPARADO',ordenes:ordenes,visitas:visitas};
    propiedades.setProperty(clave,JSON.stringify(pendiente));
    return completarAgendaPendiente_(clave,pendiente);
  });
}
function completarAgendaPendiente_(clave,pendiente) {
  if(pendiente.estado==='COMPLETADO') return {ordenes:pendiente.ids};
  var existentes=leerTabla_('ORDENES'),visitas=leerTabla_('VISITAS');
  pendiente.ordenes.forEach(function(o) { if(typeof o.Fecha==='string') o.Fecha=new Date(o.Fecha); });
  anexarObjetos_('ORDENES',pendiente.ordenes.filter(function(o) { return !existentes.some(function(e) { return e.ID_Orden===o.ID_Orden; }); }));
  anexarObjetos_('VISITAS',pendiente.visitas.filter(function(v) { return !visitas.some(function(e) { return e.ID_Visita===v.ID_Visita; }); }));
  regenerarChecklistInterno_(); recalcularInterno_();
  var ids=pendiente.ordenes.map(function(o) { return o.ID_Orden; });
  PropertiesService.getScriptProperties().setProperty(clave,JSON.stringify({estado:'COMPLETADO',ids:ids}));
  return {ordenes:ids};
}
function recuperarAgendasPendientes() { return conBloqueo_(function() { var p=PropertiesService.getScriptProperties().getProperties(); return Object.keys(p).filter(function(k) { return k.indexOf('AGENDA_')===0&&JSON.parse(p[k]).estado==='PREPARADO'; }).map(function(k) { return completarAgendaPendiente_(k,JSON.parse(p[k])); }); }); }
function asignarTecnicoAutomatico(idOrden) {
  var d=leerOperacion_(), orden=d.ORDENES.find(function(o) { return o.ID_Orden===idOrden; });
  exigir_(orden,'ORDENES: ID inexistente '+idOrden);
  exigir_(!orden.Hora_Inicio_Jornada,'ORDENES: no se reasigna una jornada iniciada');
  var candidatos=d.TECNICOS.filter(function(t) { return verdadero_(t.Activo)&&(!verdadero_(orden.Es_Conductor)||t.Licencia==='Clase B')&&!d.ORDENES.some(function(o) { return o.ID_Orden!==idOrden&&o.Estado_Orden!=='Cancelada'&&o.ID_Tecnico===t.ID_Tecnico&&fechaClave_(o.Fecha)===fechaClave_(orden.Fecha); }); });
  var tramos=d.VISITAS.filter(function(v) { return v.ID_Jornada===orden.ID_Jornada; }),corredor=tramos.length?tramos[0].Corredor:'';
  function afinidad(t) {
    var jornadas=d.ORDENES.filter(function(o) { return o.ID_Orden!==idOrden&&o.ID_Tecnico===t.ID_Tecnico&&o.Estado_Orden!=='Cancelada'&&fechaClave_(o.Fecha)<=fechaClave_(orden.Fecha); });
    return d.VISITAS.some(function(v) { return v.Corredor===corredor&&jornadas.some(function(o) { return o.ID_Jornada===v.ID_Jornada; }); })?0:1;
  }
  candidatos.sort(function(a,b) { return afinidad(a)-afinidad(b)||(a.Cuadrilla===orden.Cuadrilla?0:1)-(b.Cuadrilla===orden.Cuadrilla?0:1)||Number(a.Horas_Asignadas||0)-Number(b.Horas_Asignadas||0)||a.ID_Tecnico.localeCompare(b.ID_Tecnico); });
  exigir_(candidatos.length,'No hay técnicos elegibles');
  return {idOrden:idOrden,idTecnico:candidatos[0].ID_Tecnico,nombre:candidatos[0].Nombre,motivo:'Disponible ese día; licencia compatible; prioridad por experiencia planificada en el corredor, cuadrilla habitual y menor carga. No se usa GPS en vivo.'};
}
function menuAsignar() {
  var id=pedir_('ID de la orden'); if(!id) return;
  return informar_(function() {
    var propuesta=asignarTecnicoAutomatico(id);
    if(!confirmar_(propuesta.nombre+'\n'+propuesta.motivo)) return 'Cancelado';
    return conBloqueo_(function() {
      var actual=asignarTecnicoAutomatico(id); exigir_(actual.idTecnico===propuesta.idTecnico,'La disponibilidad cambió. Vuelva a proponer.');
      var d=leerOperacion_(), o=d.ORDENES.find(function(o) { return o.ID_Orden===id; }), t=d.TECNICOS.find(function(t) { return t.ID_Tecnico===actual.idTecnico; });
      exigir_(!d.CHECKLIST.some(function(c) { return c.ID_Orden===id&&verdadero_(c.Marcado); })&&!d.GASTOS.some(function(g) { return g.ID_Orden===id; }),'La orden tiene checklist o gastos; no puede cambiar su propietario');
      o.ID_Tecnico=t.ID_Tecnico; o.Email=t.Email; calcularPlan(d);
      escribirCampos_('ORDENES',d.ORDENES,[o],['ID_Tecnico','Email']);
      var items=d.CHECKLIST.map(function(c) { return c.ID_Orden===id?Object.assign({},c,{ID_Tecnico:t.ID_Tecnico,Email:t.Email}):c; });
      escribirCampos_('CHECKLIST',d.CHECKLIST,items,['ID_Tecnico','Email']);
      return recalcularInterno_();
    });
  });
}
