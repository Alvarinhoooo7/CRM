/** MENU Y RECALCULO. Los procesos automáticos no abren diálogos. */
function onOpen() {
  var ui=SpreadsheetApp.getUi();
  ui.createMenu('⚙ Servicio Técnico')
    .addItem('🔄 Recalcular plan completo','menuRecalcular').addItem('📊 Ir al tablero de control','irAlTablero').addSeparator()
    .addItem('➕ Agendar trabajo nuevo…','abrirAgenda').addItem('🤖 Asignar técnico automáticamente…','menuAsignar').addSeparator()
    .addSubMenu(ui.createMenu('📄 Documentos').addItem('Generar orden de servicio en PDF…','menuPDF').addItem('Generar todas las órdenes del plan','generarTodasOrdenes').addItem('Enviar capacitación al cliente…','menuCapacitacion'))
    .addSubMenu(ui.createMenu('💰 Dinero').addItem('Preparar nómina de transferencias','menuNomina').addItem('Revisar gastos pendientes','revisarGastosPendientes').addItem('Cerrar la semana','menuCerrarSemana'))
    .addSubMenu(ui.createMenu('🚐 Flota').addItem('Revisar mantenciones y vencimientos','menuFlota').addItem('Marcar camioneta en taller…','menuTaller')).addSeparator()
    .addSubMenu(ui.createMenu('📱 AppSheet').addItem('Preparar hojas para la app','menuPrepararApp').addItem('Regenerar checklist de las órdenes','regenerarChecklist').addItem('Procesar lo que envió la app','menuProcesarApp')).addSeparator()
    .addSubMenu(ui.createMenu('🛠 Instalación').addItem('Crear o restaurar las hojas base','crearHojasBase').addItem('Cargar datos de ejemplo','cargarDatosEjemplo').addItem('Ejecutar pruebas del sistema','ejecutarPruebas')).addItem('❓ Acerca de y supuestos','acercaDe').addToUi();
}
function informar_(accion) { try { var resultado=accion(); SpreadsheetApp.getUi().alert(typeof resultado==='string'?resultado:JSON.stringify(resultado,null,2)); return resultado; } catch(e) { SpreadsheetApp.getUi().alert('No se completó: '+e.message); throw e; } }
function pedir_(titulo) { var ui=SpreadsheetApp.getUi(), r=ui.prompt(titulo,ui.ButtonSet.OK_CANCEL); return r.getSelectedButton()===ui.Button.OK?r.getResponseText().trim():null; }
function confirmar_(texto) { var ui=SpreadsheetApp.getUi(); return ui.alert('Confirmar',texto,ui.ButtonSet.YES_NO)===ui.Button.YES; }
function irAlTablero() { var h=hoja_('TABLERO'); libro_().setActiveSheet(h); h.setActiveRange(h.getRange('A1')); }
function acercaDe() { SpreadsheetApp.getUi().alert('Planilla funcional: 28 órdenes y 476 checklist para el itinerario conciliado. Rutas intercomunales son supuestos editables. Totales se calculan, no se fuerzan. Instalaciones y transferencias previstas no equivalen a ejecutadas. Ver LEEME_APPSHEET y CONFIG.'); }
function menuRecalcular() { return informar_(recalcularPlan); }
function recalcularPlan() { return conBloqueo_(recalcularInterno_); }
function recalcularInterno_() {
  var inicio=Date.now(), datos=leerOperacion_(), resultado=calcularPlan(datos);
  // Toda validación del motor termina antes de la primera escritura.
  var campos=['Nombre_Tecnico','Comuna','Direccion','Equipos','Tecnicos_En_Sitio','Horas_Viaje','Horas_Instalacion','Horas_Capacitacion','Horas_Totales','Estado_Jornada','Horas_Extra','Costo_Horas_Extra','Km_Dia','Peaje','Combustible','Tipo_Estipendio','Estipendio','Noches','Hotel_Monto','Total_Transferencia','Email','Desgaste'];
  var calculadas=resultado.ordenes.concat(datos.ORDENES.filter(function(o) { return o.Estado_Orden==='Cancelada'; }).map(function(o) {
    var r=Object.assign({},o); campos.forEach(function(c) { r[c]=typeof o[c]==='number'?0:o[c]; }); r.Estado_Jornada='Cancelada'; return r;
  }));
  escribirCampos_('ORDENES',datos.ORDENES,calculadas,campos);
  escribirCampos_('VISITAS',datos.VISITAS,resultado.visitas,['Horas_Viaje','Horas_Instalacion','Horas_Capacitacion','Comuna','Direccion']);
  actualizarNomina_(datos,resultado);
  actualizarFormulas_(datos);
  actualizarFlota_(datos,resultado);
  actualizarCalendario_(datos);
  actualizarTablero_(datos,resultado);
  SpreadsheetApp.flush();
  var duracion=(Date.now()-inicio)/1000;
  libro_().toast('Transferencias '+clp_(resultado.resumen.Total_A_Transferir)+' · '+resultado.resumen.Equipos_Planificados+' equipos previstos · '+resultado.alertas.length+' alertas · '+duracion+' s','Plan recalculado');
  return {resumen:resultado.resumen,alertas:resultado.alertas,segundos:duracion};
}
function clp_(monto) { return '$'+Math.round(Number(monto)||0).toLocaleString('es-CL'); }
function actualizarNomina_(datos,resultado) {
  var existentes=indice_(datos.TRANSFERENCIAS,'ID_Tecnico','TRANSFERENCIAS'), nuevas=[];
  var porTecnico=indice_(resultado.transferencias,'ID_Tecnico','transferencias calculadas');
  var filas=datos.TECNICOS.map(function(t) {
    var r=porTecnico[t.ID_Tecnico]||{ID_Tecnico:t.ID_Tecnico,Nombre:t.Nombre,Monto_A_Transferir:0,Reserva:0,Detalle:'Sin asignaciones activas'};
    if(!existentes[t.ID_Tecnico]) nuevas.push(Object.assign({Estado:'Pendiente',Monto_Transferido:0},r));
    return r;
  });
  escribirCampos_('TRANSFERENCIAS',datos.TRANSFERENCIAS,filas,['Nombre','Monto_A_Transferir','Detalle','Reserva']);
  anexarObjetos_('TRANSFERENCIAS',nuevas);
  var todas=datos.TRANSFERENCIAS.concat(nuevas), h=hoja_('TRANSFERENCIAS');
  if(todas.length) {
    h.getRange(2,columnas_('TRANSFERENCIAS').indexOf('Monto_Rendido')+1,todas.length,3).setFormulas(todas.map(function(t,i) {
      var f=i+2,id=celda_('TRANSFERENCIAS','ID_Tecnico',f),pagado=celda_('TRANSFERENCIAS','Monto_Transferido',f),rendido=celda_('TRANSFERENCIAS','Monto_Rendido',f);
      return ['=SUMIFS('+rangoCol_('GASTOS','Monto')+','+rangoCol_('GASTOS','ID_Tecnico')+','+id+','+rangoCol_('GASTOS','Estado')+',"Revisado",'+rangoCol_('GASTOS','Error_Validacion')+',"")','='+pagado+'-'+rendido,'=IF('+pagado+'<'+rendido+',"Rendido supera anticipo","")'];
    }));
  }
}
function actualizarFormulas_(datos) {
  var h=hoja_('ORDENES');
  if(datos.ORDENES.length) h.getRange(2,columnas_('ORDENES').indexOf('Horas_Reales')+1,datos.ORDENES.length,3).setFormulas(datos.ORDENES.map(function(o,i) {
    var f=i+2,ini=celda_('ORDENES','Hora_Inicio_Jornada',f),fin=celda_('ORDENES','Hora_Fin_Jornada',f),real=celda_('ORDENES','Horas_Reales',f),estimado=celda_('ORDENES','Horas_Totales',f);
    var hitos=['Hora_Inicio_Jornada','Hora_Salida_Ruta','Hora_Inicio_Instalacion','Hora_Fin_Instalacion','Hora_Fin_Capacitacion','Hora_Fin_Jornada'];
    var suma=hitos.map(function(c) { return 'N('+celda_('ORDENES',c,f)+'<>"")'; }).concat(['N('+celda_('ORDENES','Checklist_Completo',f)+'=TRUE)']).join('+');
    var traslado='N('+ini+'<>"")+N('+celda_('ORDENES','Checklist_Completo',f)+'=TRUE)+N('+celda_('ORDENES','Hora_Salida_Ruta',f)+'<>"")+N('+fin+'<>"")';
    var sinCap=hitos.filter(function(c) { return c!=='Hora_Fin_Capacitacion'; }).map(function(c) { return 'N('+celda_('ORDENES',c,f)+'<>"")'; }).concat(['N('+celda_('ORDENES','Checklist_Completo',f)+'=TRUE)']).join('+');
    return ['=IF(OR('+ini+'="",'+fin+'=""),"",('+fin+'-'+ini+')*24)','=IF('+real+'="","",'+real+'-'+estimado+')','=IF('+celda_('ORDENES','Equipos',f)+'=0,('+traslado+')/4,IF('+celda_('ORDENES','Horas_Capacitacion',f)+'=0,('+sinCap+')/6,('+suma+')/7))'];
  }));
  if(datos.DESTINOS.length) {
    hoja_('DESTINOS').getRange(2,columnas_('DESTINOS').indexOf('Horas_Ida')+1,datos.DESTINOS.length,1).setFormulas(datos.DESTINOS.map(function(d,i) { var f=i+2,c=celda_('DESTINOS','Corredor',f); return ['='+celda_('DESTINOS','Km_Ida',f)+'/IF('+c+'="URB",P_VEL_URBANA,IF('+c+'="R78",P_VEL_R78,P_VEL_RUTA5))']; }));
    hoja_('DESTINOS').getRange(2,columnas_('DESTINOS').indexOf('Equipos_Instalados')+1,datos.DESTINOS.length,1).setFormulas(datos.DESTINOS.map(function(d,i) { return ['=SUMIF('+rangoCol_('VISITAS','ID_Destino')+','+celda_('DESTINOS','ID_Destino',i+2)+','+rangoCol_('VISITAS','Equipos_Instalados')+')']; }));
    hoja_('DESTINOS').getRange(2,columnas_('DESTINOS').indexOf('Equipos_Pendientes')+1,datos.DESTINOS.length,1).setFormulas(datos.DESTINOS.map(function(d,i) {
      var f=i+2,activos='ISNUMBER(MATCH('+rangoCol_('VISITAS','ID_Jornada')+',FILTER('+rangoCol_('ORDENES','ID_Jornada')+','+rangoCol_('ORDENES','Estado_Orden')+'<>"Cancelada"),0))';
      return ['=MAX(0,IFERROR(SUM(FILTER('+rangoCol_('VISITAS','Equipos')+','+rangoCol_('VISITAS','ID_Destino')+'='+celda_('DESTINOS','ID_Destino',f)+','+activos+')),0)-'+celda_('DESTINOS','Equipos_Instalados',f)+')'];
    }));
  }
  if(datos.TECNICOS.length) hoja_('TECNICOS').getRange(2,9,datos.TECNICOS.length,12).setFormulas(datos.TECNICOS.map(function(t,i) {
    var f=i+2,id='A'+f,criterio=rangoCol_('ORDENES','ID_Tecnico')+','+id+','+rangoCol_('ORDENES','Estado_Orden')+',"<>Cancelada"';
    function sumar(c) { return 'SUMIFS('+rangoCol_('ORDENES',c)+','+criterio+')'; }
    var rendido='SUMIFS('+rangoCol_('GASTOS','Monto')+','+rangoCol_('GASTOS','ID_Tecnico')+','+id+','+rangoCol_('GASTOS','Estado')+',"Revisado",'+rangoCol_('GASTOS','Error_Validacion')+',"")';
    // Los equipos personales muestran participación; el total operativo se cuenta únicamente en VISITAS.
    return ['='+sumar('Horas_Totales'),'=MAX(0,P_JORNADA_EFECTIVA-I'+f+')','=IFERROR(I'+f+'/P_JORNADA_EFECTIVA,0)',
      '=IFERROR(SUM(FILTER('+rangoCol_('VISITAS','Equipos_Instalados')+',ISNUMBER(MATCH('+rangoCol_('VISITAS','ID_Jornada')+',FILTER('+rangoCol_('ORDENES','ID_Jornada')+','+rangoCol_('ORDENES','ID_Tecnico')+'='+id+'),0)))),0)',
      '=IFERROR(COUNTUNIQUE(FILTER('+rangoCol_('VISITAS','ID_Destino')+','+rangoCol_('VISITAS','Equipos_Instalados')+'>0,ISNUMBER(MATCH('+rangoCol_('VISITAS','ID_Jornada')+',FILTER('+rangoCol_('ORDENES','ID_Jornada')+','+rangoCol_('ORDENES','ID_Tecnico')+'='+id+'),0)))),0)',
      '=COUNTIFS('+criterio+','+rangoCol_('ORDENES','Tipo_Estipendio')+',"Viatico")','=COUNTIFS('+criterio+','+rangoCol_('ORDENES','Tipo_Estipendio')+',"Colacion")','='+sumar('Noches'),
      '=SUMIF('+rangoCol_('TRANSFERENCIAS','ID_Tecnico')+','+id+','+rangoCol_('TRANSFERENCIAS','Monto_Transferido')+')','='+rendido,'=Q'+f+'-R'+f,
      '=COUNTIFS('+rangoCol_('GASTOS','ID_Tecnico')+','+id+','+rangoCol_('GASTOS','Estado')+',"Pendiente",'+rangoCol_('GASTOS','Fecha')+',"<"&TODAY()-P_DIAS_RENDICION)'];
  }));
}
function actualizarCalendario_(datos) {
  var h=hoja_('CALENDARIO'), n=Number(datos.parametros.P_DIAS_CALENDARIO), filas=[];
  var cabecera=['Técnico']; for(var d=0;d<n;d++) cabecera.push(fechaLaboral_(datos.parametros.P_FECHA_INICIO,d));
  filas.push(cabecera);
  ['Horas comprometidas','Horas libres','Días fuera RM','Días dentro RM'].forEach(function(bloque) {
    filas.push([bloque].concat(Array(n).fill('')));
    datos.TECNICOS.forEach(function(t) {
      var f=filas.length+1;
      var fila=[t.ID_Tecnico+' · '+t.Nombre];
      for(var d=0;d<n;d++) {
        var fecha=letra_(d+1)+'$1',criterio=rangoCol_('ORDENES','ID_Tecnico')+',"'+t.ID_Tecnico+'",'+rangoCol_('ORDENES','Fecha')+',">="&INT('+fecha+'),'+rangoCol_('ORDENES','Fecha')+',"<"&INT('+fecha+')+1,'+rangoCol_('ORDENES','Estado_Orden')+',"<>Cancelada"';
        var suma='SUMIFS('+rangoCol_('ORDENES','Horas_Totales')+','+criterio+')';
        fila.push(bloque==='Horas comprometidas'?'='+suma:bloque==='Horas libres'?'=MAX(0,P_JORNADA_DIA-'+suma+')':'=N(COUNTIFS('+criterio+','+rangoCol_('ORDENES','Tipo_Estipendio')+',"'+(bloque==='Días fuera RM'?'Viatico':'Colacion')+'")>0)');
      }
      filas.push(fila);
    });
    if(bloque==='Horas libres') {
      var fin=filas.length,inicio=fin-datos.TECNICOS.length+1,total=['Capacidad libre total'];
      for(var d=0;d<n;d++) total.push('=SUM('+letra_(d+1)+inicio+':'+letra_(d+1)+fin+')');
      filas.push(total);
    }
  });
  asegurarTamano_(h,filas.length,n+1); h.clearContents(); h.getRange(1,1,filas.length,n+1).setValues(filas); h.getRange(1,2,1,n).setNumberFormat('dd-mm-yyyy');
  var rango=h.getRange(3,2,Math.max(1,datos.TECNICOS.length),n);
  h.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=B3<=P_JORNADA_DIA').setBackground('#d9ead3').setRanges([rango]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND(B3>P_JORNADA_DIA,B3<=P_JORNADA_DIA_MAX)').setBackground('#fff2cc').setRanges([rango]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND(B3>P_JORNADA_DIA_MAX,B3<=P_TOPE_DIA)').setBackground('#f9cb9c').setRanges([rango]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=B3>P_TOPE_DIA').setBackground('#ea9999').setRanges([rango]).build()
  ]);
}
function actualizarTablero_(datos,r) {
  var h=hoja_('TABLERO'), filas=[['Indicador','Valor']];
  Object.keys(r.resumen).forEach(function(k) { filas.push([k,r.resumen[k]]); });
  filas.push(['Equipos instalados reales','=SUM('+rangoCol_('VISITAS','Equipos_Instalados')+')'],['Comunas atendidas reales','=IFERROR(COUNTUNIQUE(FILTER('+rangoCol_('VISITAS','ID_Destino')+','+rangoCol_('VISITAS','Equipos_Instalados')+'>0)),0)'],['Transferido real','=SUM('+rangoCol_('TRANSFERENCIAS','Monto_Transferido')+')'],['Rendiciones atrasadas','=SUM('+rangoCol_('TECNICOS','Rendiciones_Atrasadas')+')'],['ALERTAS','']);
  filas.push(['Jornadas sobre tope','=COUNTIF('+rangoCol_('ORDENES','Horas_Totales')+',">"&P_TOPE_DIA)'],['Órdenes sin técnico','=COUNTIFS('+rangoCol_('ORDENES','ID_Orden')+',"<>",'+rangoCol_('ORDENES','ID_Tecnico')+',"",'+rangoCol_('ORDENES','Estado_Orden')+',"<>Cancelada")'],['Datos de campo inválidos','=COUNTIF('+rangoCol_('ORDENES','Error_Validacion')+',"?*")']);
  r.alertas.forEach(function(a) { filas.push([a,'REVISAR']); });
  filas.push(['Alertas de flota','=IFERROR(TEXTJOIN(CHAR(10),TRUE,FILTER('+rangoCol_('CAMIONETAS','Alerta')+','+rangoCol_('CAMIONETAS','Alerta')+'<>"")),"Sin alertas")']);
  asegurarTamano_(h,filas.length,18); h.clearContents(); h.getRange(1,1,filas.length,2).setValues(filas);
  var rubros=[['Rubro','Monto'],['Viáticos',r.ordenes.filter(function(o) { return o.Tipo_Estipendio==='Viatico'; }).reduce(function(a,o) { return a+o.Estipendio; },0)],['Colación',r.ordenes.filter(function(o) { return o.Tipo_Estipendio==='Colacion'; }).reduce(function(a,o) { return a+o.Estipendio; },0)],['Hotel',r.resumen.Hotel],['Peajes',r.resumen.Peajes],['Combustible',r.resumen.Combustible]];
  var cuadrillas={},baseTecnico={}; r.ordenes.forEach(function(o) { baseTecnico[o.ID_Tecnico]=(baseTecnico[o.ID_Tecnico]||0)+o.Total_Transferencia; });
  var nomina=indice_(r.transferencias,'ID_Tecnico','nómina');
  r.ordenes.forEach(function(o) { var anticipo=baseTecnico[o.ID_Tecnico]?nomina[o.ID_Tecnico].Monto_A_Transferir*o.Total_Transferencia/baseTecnico[o.ID_Tecnico]:0; cuadrillas[o.Cuadrilla]=(cuadrillas[o.Cuadrilla]||0)+anticipo+o.Desgaste+o.Costo_Horas_Extra; });
  var porCuadrilla=[['Cuadrilla','Costo operación']].concat(Object.keys(cuadrillas).map(function(c) { return [c,cuadrillas[c]]; }));
  var equiposCuadrilla={}; r.jornadas.forEach(function(j) { equiposCuadrilla[j.cuadrilla]=(equiposCuadrilla[j.cuadrilla]||0)+j.equipos; });
  var porComuna=[['Comuna','Costo operación por equipo']];
  datos.DESTINOS.forEach(function(d) {
    var costo=0,equipos=0;
    r.jornadas.forEach(function(j) {
      var locales=j.visitas.filter(function(v) { return v.ID_Destino===d.ID_Destino && Number(v.Equipos)>0; });
      locales.forEach(function(v) { equipos+=Number(v.Equipos); costo+=cuadrillas[j.cuadrilla]*Number(v.Equipos)/equiposCuadrilla[j.cuadrilla]; });
    });
    if(equipos) porComuna.push([d.Comuna,costo/equipos]);
  });
  var dias={}; r.ordenes.forEach(function(o) { var d=fechaClave_(o.Fecha); dias[d]=(dias[d]||0)+o.Horas_Totales; });
  var capacidad=[['Día','Horas comprometidas','Capacidad']].concat(Object.keys(dias).sort().map(function(d) { return [d,dias[d],datos.TECNICOS.filter(function(t) { return verdadero_(t.Activo); }).length*datos.parametros.P_JORNADA_DIA]; }));
  [rubros,porCuadrilla,porComuna,capacidad].forEach(function(tabla,i) { h.getRange(1,4+i*4,tabla.length,tabla[0].length).setValues(tabla); });
  h.getCharts().forEach(function(c) { h.removeChart(c); });
  [rubros,porCuadrilla,porComuna,capacidad].forEach(function(tabla,i) { h.insertChart(h.newChart().setChartType(i===0?Charts.ChartType.PIE:i===3?Charts.ChartType.COLUMN:Charts.ChartType.BAR).addRange(h.getRange(1,4+i*4,tabla.length,tabla[0].length)).setNumHeaders(1).setPosition(22+Math.floor(i/2)*18,4+(i%2)*7,0,0).setOption('title',['Composición del presupuesto base','Costo operación por cuadrilla','Costo por equipo (prorrateo del corredor, incluye traslados)','Horas contra capacidad'][i]).build()); });
}
