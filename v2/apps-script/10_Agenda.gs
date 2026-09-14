/** Agenda operativa: una fila por orden, decisión humana y almacenamiento en Sheets. */
var COLUMNAS_AGENDA = ['ID','REVISION','ESTADO','CLIENTE','DIRECCION','EQUIPOS','FECHA_INICIO','HORA_SALIDA','FECHA_FIN','HORA_FIN','TECNICOS','MODO','VEHICULO','CONDUCTOR','HOTEL','TOTAL','DETALLE_JSON','ACTUALIZADO'];

function hojaAgenda_(libro, crear) {
  var h = libro.getSheetByName('AGENDA');
  if (!h && crear) {
    h = libro.insertSheet('AGENDA');
    h.getRange(1,1,1,COLUMNAS_AGENDA.length).setValues([COLUMNAS_AGENDA]).setFontWeight('bold');
    h.setFrozenRows(1);
  }
  if (h && h.getLastRow() && JSON.stringify(h.getRange(1,1,1,COLUMNAS_AGENDA.length).getValues()[0]) !== JSON.stringify(COLUMNAS_AGENDA)) throw new Error('La hoja AGENDA tiene una estructura distinta. No se modificó; revise sus encabezados.');
  return h;
}
function leerAgenda_(libro) {
  var h = hojaAgenda_(libro, false);
  if (!h || h.getLastRow() < 2) return [];
  return h.getRange(2,1,h.getLastRow()-1,COLUMNAS_AGENDA.length).getValues().filter(function(f){return f[0];}).map(function(f){
    try { var o=JSON.parse(f[16]); o.id=String(f[0]); o.revision=Number(f[1]); o.estado=String(f[2]); return o; }
    catch(e){throw new Error('No se puede leer la orden '+f[0]+'. Revise DETALLE_JSON antes de guardar.');}
  });
}
function obtenerAgenda(token) {
  exigirSesion_(token);
  var libro=obtenerLibro_(), p=leerParametros_(libro), tablas=leerTablas_(libro);
  return limpiarParaJson_({ok:true, ordenes:leerAgenda_(libro), tecnicos:tablas.TECNICOS, flota:tablas.FLOTA,
    fechaHoy:Utilities.formatDate(new Date(),APP.ZONA_HORARIA,'yyyy-MM-dd'), jornada:p.P_JORNADA_DIA,
    actualizado:new Date().toISOString()});
}
function fechaISOAgenda_(texto) {
  texto=String(texto||'');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) throw new Error('Seleccione una fecha válida.');
  var f=new Date(texto+'T12:00:00Z');
  if (!Number.isFinite(f.getTime()) || f.toISOString().slice(0,10)!==texto) throw new Error('Fecha inexistente.');
  return texto;
}
function minutosAgenda_(hora) {
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(hora))) throw new Error('Ingrese una hora válida.');
  var h=hora.split(':');return Number(h[0])*60+Number(h[1]);
}
function horaAgenda_(minutos) { return ('0'+Math.floor(minutos/60)).slice(-2)+':'+('0'+(minutos%60)).slice(-2); }
function numeroAgenda_(valor, nombre, maximo) {
  if (valor === '' || valor == null || !Number.isFinite(Number(valor)) || Number(valor)<0 || Number(valor)>(maximo||100000000)) throw new Error('Revise '+nombre+'.');
  return Number(valor);
}
function normalizarSolicitudAgenda_(s, datos) {
  if (!s) throw new Error('Faltan datos de la orden.');
  var cliente=textoCelda_(s.cliente,120), direccion=textoCelda_(s.direccion,500);
  var equipos=numeroAgenda_(s.equipos,'cantidad de equipos',100), dias=numeroAgenda_(s.dias,'días reservados',20);
  if(!cliente || direccion.length<12 || !Number.isInteger(equipos)||equipos<1||!Number.isInteger(dias)||dias<1) throw new Error('Complete cliente, dirección exacta, equipos y días enteros positivos.');
  var tecnicos=Array.isArray(s.tecnicos)?s.tecnicos.map(String):[];
  var activos=indexarPor_(datos.tecnicos,'codigo');
  if(!tecnicos.length || new Set(tecnicos).size!==tecnicos.length || tecnicos.some(function(t){return !activos[t];})) throw new Error('Seleccione técnicos activos, sin repetir.');
  var hora=String(s.hora);minutosAgenda_(hora);
  if(minutosAgenda_(hora)<360 || minutosAgenda_(hora)>1080) throw new Error('La salida debe quedar entre 06:00 y 18:00.');
  var hotel=textoCelda_(s.hotel,1000);
  if(dias>1&&!hotel) throw new Error('Indique los alojamientos previstos para una salida de varios días.');
  return {id:s.id?textoCelda_(s.id,80):'',revision:Number(s.revision)||0,cliente:cliente,direccion:direccion,equipos:equipos,
    fecha:fechaISOAgenda_(s.fecha),hora:hora,dias:dias,tecnicos:tecnicos,hotel:hotel,
    vehiculo:String(s.vehiculo||''),conductor:String(s.conductor||''),
    escenario:'LITERAL_PDF', // Nuevas órdenes cumplen 30 min de capacitación por equipo.
    peajes:s.peajes, bus:s.bus||{}, avion:s.avion||{}, publico:s.publico||{},
    herramientas:s.herramientas===true, notas:textoCelda_(s.notas,1000)};
}
function bloquesAgenda_(s,p,feriados,horas) {
  var cursor=new Date(s.fecha+'T12:00:00Z'), bloqueados={};
  (feriados||[]).forEach(function(f){var key=f.fecha instanceof Date?Utilities.formatDate(f.fecha,APP.ZONA_HORARIA,'yyyy-MM-dd'):String(f.fecha).slice(0,10);bloqueados[key]=true;});
  var bloques=[], jornada=Math.round(p.P_JORNADA_DIA*60), restantes=Math.ceil(horas*60);
  if(restantes>s.dias*jornada) throw new Error('Se necesitan al menos '+Math.ceil(restantes/jornada)+' días con la jornada configurada. Ajuste la reserva y vuelva a comparar.');
  for(var i=0;i<s.dias;i++){
    var fecha=cursor.toISOString().slice(0,10);
    if ((p.P_OMITIR_FIN_SEMANA && [0,6].indexOf(cursor.getUTCDay())>=0)||bloqueados[fecha]) throw new Error('La reserva incluye '+fecha+', día no laborable. Ajuste la fecha o el número de días.');
    var inicio=i===0?minutosAgenda_(s.hora):480;
    // Días intermedios reservados completos; no se inventa itinerario entre hoteles.
    var minutos=s.dias===1?restantes:(i===s.dias-1?Math.max(30,restantes):jornada);
    if(inicio+minutos>1440)throw new Error('El bloque termina después de medianoche. Adelante la salida o amplíe los días.');
    bloques.push({fecha:fecha,inicio:horaAgenda_(inicio),fin:horaAgenda_(inicio+minutos),minutos:minutos});
    restantes=Math.max(0,restantes-minutos);cursor.setUTCDate(cursor.getUTCDate()+1);
  }
  return bloques;
}
function compararOrdenAgenda_(s,datos,ida,regreso) {
  var p=datos.parametros, n=s.tecnicos.length, sitio=horasEnSitio_(s.equipos,n,true,aplicarEscenario_(p,'LITERAL_PDF'));
  var rutasOK=ida.ok&&regreso.ok, km=rutasOK?ida.km+regreso.km:null;
  var hotel=(s.dias-1)*(p.P_HABITACION_INDIVIDUAL?n:Math.ceil(n/2))*p.P_HOTEL;
  var viatico=s.dias*n*p.P_VIATICO, opciones=[];
  var evaluar=function(modo,viaje,costos,faltantes){
    var horas=viaje==null?null:viaje+sitio.total;
    var bloques=[];
    if(horas!=null){try{bloques=bloquesAgenda_(s,p,datos.tablas.FERIADOS,horas);}catch(e){faltantes.push(e.message);}}
    costos.hotel=hotel;costos.viatico=viatico;
    var subtotal=Object.keys(costos).reduce(function(a,k){return a+costos[k];},0);
    var reserva=Math.round(subtotal*p.P_HOLGURA_IMPREVISTOS);
    var efectivo=subtotal-(costos.desgaste||0),personal=[];
    var compartidos=(costos.combustible||0)+(costos.peajes||0)+(costos.flete||0)+(costos.conexiones||0);
    var porPersona=(hotel+viatico+(costos.pasajes||0))/n;
    var responsable=modo==='Camioneta'?s.conductor:s.tecnicos[0];
    s.tecnicos.forEach(function(t){var base=Math.round(porPersona+(t===responsable?compartidos:0));var bruto=base+Math.round(base*p.P_HOLGURA_IMPREVISTOS);personal.push({tecnico:t,base:base,total:Math.ceil(bruto/(p.P_REDONDEO_TRANSFERENCIA||1))*(p.P_REDONDEO_TRANSFERENCIA||1)});});
    opciones.push({modo:modo,completa:!faltantes.length,pendientes:faltantes,horasViaje:viaje,horasSitio:sitio.total,
      horasInstalacion:sitio.instalacion,horasCapacitacion:sitio.capacitacion,horasTotales:horas,km:km,
      costos:costos,subtotal:Math.round(subtotal),reserva:reserva,total:Math.round(subtotal)+reserva,
      anticipoSinReserva:Math.round(efectivo),transferencias:personal,bloques:bloques,
      noches:s.dias-1,fuente:modo==='Camioneta'?'Google Maps (carretera) + peajes declarados':'Cotización y tiempo declarados por coordinación'});
  };
  var faltantes=[],flota=indexarPor_(datos.flota,'codigo'),tecnicos=indexarPor_(datos.tecnicos,'codigo');
  if(!rutasOK)faltantes.push('No hay ruta de ida y regreso confirmada: '+[ida.error,regreso.error].filter(Boolean).join(' / '));
  if(!flota[s.vehiculo]||flota[s.vehiculo].estado!=='Disponible')faltantes.push('Seleccione una camioneta disponible.');
  if(s.tecnicos.indexOf(s.conductor)<0||!tecnicos[s.conductor]||tecnicos[s.conductor].licencia!=='Si')faltantes.push('Seleccione un conductor asignado con licencia.');
  var peajes=0;try{peajes=numeroAgenda_(s.peajes,'peajes de ida y vuelta');}catch(e){faltantes.push('Declare peajes ida y vuelta, incluso si son $0.');}
  evaluar('Camioneta',rutasOK?ida.horas+regreso.horas:null,{combustible:rutasOK?Math.round(km/p.P_RENDIMIENTO*p.P_DIESEL):0,peajes:peajes,desgaste:rutasOK?Math.round(km*p.P_COSTO_KM):0,pasajes:0,flete:0,conexiones:0},faltantes);
  [['Bus',s.bus],['Avion',s.avion],['Transporte publico',s.publico]].forEach(function(par){
    var q=par[1], faltan=[],pasaje=0,horas=null,conexiones=0,flete=0;
    try{pasaje=numeroAgenda_(q.pasaje,'pasaje ida y vuelta');if(pasaje<=0)throw new Error();}catch(e){faltan.push('Falta pasaje ida y vuelta por persona.');}
    try{horas=numeroAgenda_(q.horas,'horas totales de traslado',200);if(horas<=0)throw new Error();}catch(e){horas=null;faltan.push('Falta tiempo total de viaje, esperas y conexiones.');}
    try{conexiones=numeroAgenda_(q.conexiones,'conexiones para la cuadrilla');flete=numeroAgenda_(q.flete,'flete de herramientas');}catch(e){faltan.push('Declare conexiones y flete (pueden ser $0).');}
    if(!s.herramientas)faltan.push('Confirme cómo viajarán los equipos y herramientas.');
    evaluar(par[0],horas,{combustible:0,peajes:0,desgaste:0,pasajes:Math.round(pasaje*n),flete:flete,conexiones:conexiones},faltan);
  });
  return opciones;
}
function firmaContextoAgenda_(datos) {
  return hashClave_(JSON.stringify({p:datos.parametros,t:datos.tecnicos,v:datos.flota,feriados:datos.tablas.FERIADOS,base:datos.destinos.filter(function(d){return d.localidad==='BASE';})}));
}
function previsualizarOrden(token,solicitud) {
  exigirSesion_(token);
  var datos=leerDatosDelLibro_(),s=normalizarSolicitudAgenda_(solicitud,datos);
  var base=datos.destinos.filter(function(d){return d.localidad==='BASE';})[0];
  var ida=consultarRutaMaps_(base.direccion,s.direccion,false,datos.parametros);
  var regreso=consultarRutaMaps_(s.direccion,base.direccion,false,datos.parametros);
  var opciones=compararOrdenAgenda_(s,datos,ida,regreso),id=Utilities.getUuid();
  CacheService.getScriptCache().put('agenda_previa_'+id,JSON.stringify({token:hashClave_(token),solicitud:s,opciones:opciones,
    contexto:firmaContextoAgenda_(datos),creado:Date.now(),idOrden:s.id||'OT-'+Utilities.getUuid()}),600);
  return {ok:true,previa:id,opciones:opciones,rutas:{ida:ida,regreso:regreso},
    mensaje:'Comparación lista. Seleccione la alternativa y confirme la reserva; aún no se ha guardado una orden.'};
}
function conflictosAgenda_(orden,otras,datos) {
  var problemas=[];
  var comparte=function(o){return orden.tecnicos.some(function(t){return o.tecnicos.indexOf(t)>=0;}) || (orden.modo==='Camioneta'&&o.modo==='Camioneta'&&orden.vehiculo===o.vehiculo);};
  otras.filter(function(o){return o.id!==orden.id&&o.estado!=='CANCELADA';}).forEach(function(o){
    if(!comparte(o))return;
    // En salida de varios días los recursos siguen fuera de base durante las noches.
    var largo=orden.bloques.length>1||o.bloques.length>1;
    if(largo){var ini=orden.bloques[0],fin=orden.bloques[orden.bloques.length-1],oi=o.bloques[0],of=o.bloques[o.bloques.length-1];
      if(ini.fecha+'T'+ini.inicio<of.fecha+'T'+of.fin && oi.fecha+'T'+oi.inicio<fin.fecha+'T'+fin.fin)problemas.push('Recursos en salida de varios días: '+o.id+'.');return;}
    orden.bloques.forEach(function(b){(o.bloques||[]).forEach(function(c){if(b.fecha===c.fecha&&b.inicio<c.fin&&c.inicio<b.fin)problemas.push('Cruce con '+o.id+' el '+b.fecha+'.');});});
  });
  var fechas=mapearDiasAFechas_(datos.parametros,datos.tablas.FERIADOS);
  // PLAN no contiene horas exactas: reserva conservadoramente el día completo.
  datos.tramos.forEach(function(t){
    if(!fechas[t.dia])return;
    var fecha=Utilities.formatDate(new Date(fechas[t.dia]),APP.ZONA_HORARIA,'yyyy-MM-dd');
    if(orden.bloques.some(function(b){return b.fecha===fecha;}) && comparte(t))problemas.push('Recursos ya asignados en PLAN ('+t.cuadrilla+', '+fecha+').');
  });
  return Array.from(new Set(problemas));
}
function escribirOrdenAgenda_(libro,orden) {
  var h=hojaAgenda_(libro,true), filas=h.getDataRange().getValues(),pos=filas.findIndex(function(f){return String(f[0])===orden.id;});
  var fila=pos<0?h.getLastRow()+1:pos+1,b=orden.bloques,ultimo=b[b.length-1];
  var valores=[orden.id,orden.revision,orden.estado,orden.cliente,orden.direccion,orden.equipos,orden.fecha,orden.hora,ultimo.fecha,ultimo.fin,
    orden.tecnicos.join(', '),orden.modo,orden.vehiculo,orden.conductor,orden.hotel,orden.presupuesto.total,JSON.stringify(orden),new Date().toISOString()];
  h.getRange(fila,1,1,valores.length).setNumberFormat('@').setValues([valores]);
  return orden;
}
function guardarOrdenAgenda(token,previa,modo) {
  exigirSesion_(token);
  var crudo=CacheService.getScriptCache().get('agenda_previa_'+previa);
  if(!crudo)throw new Error('La comparación venció. Compare nuevamente antes de guardar.');
  var q=JSON.parse(crudo);
  if(q.token!==hashClave_(token)||Date.now()-q.creado>600000)throw new Error('Comparación inválida o vencida.');
  var alternativa=q.opciones.filter(function(o){return o.modo===modo;})[0];
  if(!alternativa||!alternativa.completa)throw new Error('Complete la cotización de la alternativa elegida.');
  var lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    var datos=leerDatosDelLibro_(),otras=leerAgenda_(datos.libro);
    var existente=otras.filter(function(o){return o.id===q.idOrden;})[0];
    if(existente&&existente.previa===previa)return {ok:true,orden:existente,mensaje:'La orden ya estaba guardada; no se duplicó.'};
    if(existente&&(existente.revision!==q.solicitud.revision||existente.estado!=='AGENDADA'))throw new Error('La orden cambió. Recargue antes de editar.');
    if(q.solicitud.id&&!existente)throw new Error('La orden que intenta editar ya no existe.');
    if(q.contexto!==firmaContextoAgenda_(datos))throw new Error('Cambiaron los parámetros o recursos. Compare otra vez con datos vigentes.');
    var orden=Object.assign({},q.solicitud,{id:q.idOrden,revision:(existente?existente.revision:0)+1,estado:'AGENDADA',modo:modo,
      vehiculo:modo==='Camioneta'?q.solicitud.vehiculo:'',conductor:modo==='Camioneta'?q.solicitud.conductor:'',
      bloques:alternativa.bloques,presupuesto:alternativa,alternativas:q.opciones,previa:previa,actualizado:new Date().toISOString()});
    var conflictos=conflictosAgenda_(orden,otras,datos);
    if(conflictos.length)throw new Error(conflictos.join(' '));
    escribirOrdenAgenda_(datos.libro,orden);
    registrarBitacora_(datos.libro,'ORDEN_AGENDADA',orden.id+' · '+modo);
    return {ok:true,orden:orden,mensaje:'Orden guardada en Sheets: '+orden.id};
  }finally{lock.releaseLock();}
}
function cambiarEstadoAgenda(token,id,revision,estado) {
  exigirSesion_(token);
  var transiciones={AGENDADA:['EN_CURSO','CANCELADA'],EN_CURSO:['COMPLETADA','CANCELADA'],COMPLETADA:[],CANCELADA:[]};
  var lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    var libro=obtenerLibro_(),o=leerAgenda_(libro).filter(function(x){return x.id===id;})[0];
    if(!o||o.revision!==Number(revision))throw new Error('La orden cambió. Recargue la agenda.');
    if(!transiciones[o.estado]||transiciones[o.estado].indexOf(estado)<0)throw new Error('Transición de estado no permitida.');
    o.estado=estado;o.revision++;o.actualizado=new Date().toISOString();
    escribirOrdenAgenda_(libro,o);registrarBitacora_(libro,'ESTADO_ORDEN',id+' → '+estado);
    return {ok:true,mensaje:'Estado guardado: '+estado};
  }finally{lock.releaseLock();}
}
