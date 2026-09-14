/** PRUEBAS COMPARTIDAS: locales y desde Apps Script. No envían correos. */
function pruebasMotor_() {
  var realizadas=[];
  function prueba(nombre,accion) { accion(); realizadas.push(nombre); }
  function igual(a,b) { exigir_(a===b,'Esperado '+b+', recibido '+a); }
  function cerca(a,b) { exigir_(Math.abs(a-b)<0.000001,'Esperado aproximadamente '+b+', recibido '+a); }
  function falla(accion,texto) { var error; try { accion(); } catch(e) { error=e; } exigir_(error&&error.message.indexOf(texto)>=0,'Se esperaba error que contenga '+texto); }
  var datos=datosSemilla_(), original=JSON.stringify(datos), r=calcularPlan(datos);
  prueba('Motor no modifica argumentos',function() { igual(JSON.stringify(datos),original); });
  prueba('33 equipos, 16 comunas y 16 capacitaciones',function() { igual(r.resumen.Equipos_Planificados,33); igual(r.resumen.Comunas_Planificadas,16); igual(r.resumen.Capacitaciones_Planificadas,16); });
  prueba('30 órdenes, 5 días y 6 órdenes de traslado',function() { igual(r.ordenes.length,30); igual(r.resumen.Dias_Habiles,5); igual(r.ordenes.filter(function(o) { return o.Equipos===0; }).length,6); });
  prueba('Checklist 510 y regeneración conserva marcas',function() { var items=construirChecklist_(datos.ORDENES,datos.IMPLEMENTOS,[]); igual(items.length,510); items[0].Marcado=true; igual(construirChecklist_(datos.ORDENES,datos.IMPLEMENTOS,items).length,0); igual(items[0].Marcado,true); });
  prueba('Copiapó: cinco equipos en tres tandas, capacitación por sesión',function() { var j=r.jornadas.find(function(j) { return j.id==='J1-3'; }); cerca(j.instalacion,6); cerca(j.capacitacion,0.25); });
  prueba('Tres comunas requieren tres capacitaciones y un vehículo',function() { var j=r.jornadas.find(function(j) { return j.id==='J3-2'; }); cerca(j.capacitacion,0.75); var o=r.ordenes.filter(function(o) { return o.ID_Jornada===j.id; }); cerca(o[0].Combustible+o[1].Combustible,j.km/datos.parametros.P_RENDIMIENTO*datos.parametros.P_DIESEL); });
  prueba('Viático por jornada mixta y retorno desde región',function() { r.ordenes.filter(function(o) { return o.ID_Jornada==='J5-2'||o.ID_Jornada==='J3-3'; }).forEach(function(o) { igual(o.Estipendio,25000); }); });
  prueba('Hotel catorce noches personales',function() { cerca(r.resumen.Hotel,700000); });
  prueba('Nómina suma redondeos individuales',function() { var suma=r.transferencias.reduce(function(a,t) { igual(t.Monto_A_Transferir%1000,0); exigir_(t.Monto_A_Transferir+0.000001>=t.Base*1.1,'Reserva insuficiente'); return a+t.Monto_A_Transferir; },0); igual(suma,r.resumen.Total_A_Transferir); cerca(r.resumen.Costo_Operacion,suma+r.resumen.Desgaste+r.resumen.Horas_Extra); });
  prueba('El error binario no añade un millar al anticipo',function() { var p=datos.parametros; igual(redondearAnticipo_(50000,p),55000); igual(redondearAnticipo_(70000,p),77000); igual(redondearAnticipo_(50001,p),56000); });
  prueba('Ninguna jornada sobre tope diario',function() { igual(r.ordenes.filter(function(o) { return o.Estado_Jornada==='FUERA DE LEY'; }).length,0); });
  prueba('El factor de corrección de Maps se aplica al tiempo de viaje',function() { var d=datosSemilla_(); d.parametros.P_FACTOR_HORAS=1; var x=calcularPlan(d); var a=r.jornadas.find(function(j) { return j.id==='J1-1'; }), b=x.jornadas.find(function(j) { return j.id==='J1-1'; }); cerca(a.viaje,b.viaje*1.1); });
  prueba('Horas extra sobre el tope semanal generan alerta',function() { var d=datosSemilla_(); d.parametros.P_HORAS_EXTRA_SEMANA=0.5; var x=calcularPlan(d); exigir_(x.alertas.some(function(a) { return a.indexOf('tope semanal')>=0; }),'Falta alerta de tope semanal'); exigir_(!r.alertas.some(function(a) { return a.indexOf('tope semanal')>=0; }),'El plan base no debe superar el tope semanal'); });
  prueba('Duplicar técnico el mismo día se rechaza',function() { var d=datosSemilla_(); d.ORDENES[2].Fecha=d.ORDENES[0].Fecha; falla(function() { calcularPlan(d); },'técnico asignado dos veces'); });
  prueba('Referencia y secuencia inválidas se rechazan',function() { var d=datosSemilla_(); d.VISITAS[0].ID_Destino='NO_EXISTE'; falla(function() { calcularPlan(d); },'destino inexistente'); d=datosSemilla_(); d.VISITAS[5].ID_Origen='BASE'; falla(function() { calcularPlan(d); },'no continúa'); });
  prueba('Conductor sin licencia y vehículo en taller generan alerta',function() { var d=datosSemilla_(); d.TECNICOS[0].Licencia='No'; d.CAMIONETAS[0].Estado='En taller'; var x=calcularPlan(d); exigir_(x.alertas.some(function(a) { return a.indexOf('sin licencia')>=0; }),'Falta alerta licencia'); exigir_(x.alertas.some(function(a) { return a.indexOf('en taller')>=0; }),'Falta alerta taller'); });
  prueba('Cancelar una cuadrilla no deja costos activos',function() { var d=datosSemilla_(); d.ORDENES.forEach(function(o) { if(o.Cuadrilla==='C1') o.Estado_Orden='Cancelada'; }); var x=calcularPlan(d); igual(x.ordenes.length,20); igual(x.transferencias.some(function(t) { return t.ID_Tecnico==='T01'; }),false); });
  prueba('Cero rendimiento y cantidades fraccionarias se rechazan',function() { var d=datosSemilla_(); d.parametros.P_RENDIMIENTO=0; falla(function() { calcularPlan(d); },'positivo'); d=datosSemilla_(); d.VISITAS[2].Equipos=1.5; falla(function() { calcularPlan(d); },'fraccionarias'); });
  prueba('Semilla no inventa ejecución',function() { igual(datos.VISITAS.reduce(function(a,v) { return a+v.Equipos_Instalados; },0),0); igual(datos.ORDENES.some(function(o) { return o.Hora_Inicio_Jornada; }),false); });
  prueba('Fecha hábil salta fin de semana',function() { igual(fechaClave_(fechaLaboral_(new Date(2026,8,25,12),1)),'2026-09-28'); });
  prueba('Salida sin checklist detectada; traslado no requiere firma',function() {
    var o={Equipos:0,Hora_Inicio_Jornada:new Date(2026,8,21,8),Hora_Salida_Ruta:new Date(2026,8,21,9),Hora_Fin_Jornada:new Date(2026,8,21,17),Checklist_Completo:true};
    exigir_(validarHitos_(o,[],[]).length>0,'Salida sin items aceptada'); igual(validarHitos_(o,[{Obligatorio:true,Marcado:true}],[]).length,0);
  });
  prueba('CSV neutraliza fórmulas y escapa comillas',function() { var csv=csvSeguro_([['=1+1','a"b']]); exigir_(csv.indexOf("'=1+1")>=0&&csv.indexOf('a""b')>=0,'CSV inseguro'); });
  prueba('HTML escapa contenido de usuario',function() { igual(escaparHtml_('<script>'),'&lt;script&gt;'); });
  return {pruebas:realizadas.length,detalle:realizadas,resumen:r.resumen,transferencias:r.transferencias};
}
function ejecutarPruebas() {
  var motor=pruebasMotor_(), estructura=prepararHojasAppSheet();
  var d=leerOperacion_(),r=calcularPlan(d);
  var erroresFormulas=[];
  ['CONFIG','ORDENES','TECNICOS','CAMIONETAS','TRANSFERENCIAS','CALENDARIO','TABLERO','AGENDAR'].forEach(function(n) { hoja_(n).getDataRange().getDisplayValues().forEach(function(f,i) { f.forEach(function(v,j) { if(/^#(REF|ERROR|VALUE|DIV|NAME|N\/A|NUM)/.test(v)) erroresFormulas.push(n+' '+letra_(j)+(i+1)+': '+v); }); }); });
  exigir_(!erroresFormulas.length,erroresFormulas.join('\n'));
  var reporte={motor:motor.pruebas,estructura:estructura.resultado,operacion:r.resumen,alertas:r.alertas};
  Logger.log(JSON.stringify(reporte)); SpreadsheetApp.getUi().alert(JSON.stringify(reporte,null,2)); return reporte;
}

