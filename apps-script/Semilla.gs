/** SEMILLA DEMOSTRABLE. Los valores de negocio se cargan en CONFIG, nunca se usan como fallback al calcular. */
function definicionParametros_() {
  // nombre, valor inicial o fórmula, unidad, origen, nota
  return [
    ['P_RENDIMIENTO',20,'km/L','PDF',''],['P_DIESEL',1381,'$/L','SUPUESTO','Verificar precio'],['P_COSTO_KM',60,'$/km','SUPUESTO',''],
    ['P_CAMIONETAS',6,'unidades','PDF',''],['P_KM_MANTENCION',10000,'km','JEFATURA',''],['P_AVISO_MANTENCION',1000,'km','JEFATURA',''],
    ['P_TECNICOS',10,'personas','PDF',''],
    ['P_TEC_POR_CUADRILLA',2,'personas','JEFATURA','Dotación por jornada. El libro v2 usaba 3; el plan conciliado fijó 2 para llegar a 14 jornadas y 28 órdenes'],
    ['P_CAPACIDAD_CAMIONETA',3,'personas','JEFATURA','Tope físico del vehículo, distinto de la dotación habitual. Del libro v2'],
    ['P_JORNADA_SEMANAL',42,'h','SUPUESTO',''],['P_COLACION_H',5,'h','JEFATURA',''],['P_JORNADA_EFECTIVA','=P_JORNADA_SEMANAL-P_COLACION_H','h','JEFATURA','Derivado'],
    ['P_DIAS_SEMANA',5,'días','JEFATURA','Calendario lunes a viernes'],['P_JORNADA_DIA','=P_JORNADA_EFECTIVA/P_DIAS_SEMANA','h','JEFATURA','Derivado'],
    ['P_JORNADA_DIA_MAX','=P_JORNADA_SEMANAL/P_DIAS_SEMANA','h','JEFATURA','Derivado'],['P_MAX_EXTRA',2,'h','JEFATURA','Del libro v2: P_HORAS_EXTRA_MAX_DIA'],['P_HORAS_EXTRA_SEMANA',10,'h','JEFATURA','Tope semanal por técnico, del libro v2'],['P_TOPE_DIA','=P_JORNADA_DIA_MAX+P_MAX_EXTRA','h','JEFATURA','Derivado'],
    ['P_TOPE_CONDUCCION',9,'h','SUPUESTO',''],['P_VALOR_HORA',6500,'$/h','SUPUESTO',''],['P_RECARGO_EXTRA',0.5,'%','PDF','Incremento sobre la hora normal: equivale al factor 1,5 del libro v2'],
    ['P_T_INSTALACION',2,'h','PDF',''],['P_T_CAPACITACION',0.5,'h','PDF',''],['P_REDUCCION_CAP',0.5,'%','JEFATURA',''],
    ['P_T_CAP_EFECTIVA','=P_T_CAPACITACION*(1-P_REDUCCION_CAP)','h','JEFATURA','Derivado'],['P_CAP_POR_COMUNA',1,'sesiones','JEFATURA',''],
    ['P_HOTEL',50000,'$/persona','JEFATURA',''],['P_VIATICO',25000,'$/día','JEFATURA','Cualquier tramo fuera RM, incluso regreso'],
    ['P_COLACION',5000,'$/día','JEFATURA','Solo jornada íntegra RM'],['P_IMPREVISTOS',0.1,'%','JEFATURA',''],
    ['P_FACTOR_HORAS',1.1,'factor','JEFATURA','Corrección sobre el tiempo puro de Maps, del libro v2. Las velocidades son la medición cruda'],
    ['P_VEL_URBANA',36,'km/h','MAPS','Ponderada de 10 tramos urbanos de la caché _RUTAS del libro: 182,0 km en 299 min'],
    ['P_VEL_R78',69,'km/h','MAPS','Ponderada de 4 tramos Ruta 78 de la caché _RUTAS: 356,4 km en 311 min'],
    ['P_VEL_RUTA5',80,'km/h','MAPS','Ponderada de Ruta 5 Norte (78,8) y Sur (82,2) en la caché _RUTAS'],
    ['P_UMBRAL_PERNOCTA',4,'h','JEFATURA',''],['P_FECHA_INICIO',new Date(2026,8,21,12),'fecha','JEFATURA',''],
    ['P_BASE','INACAP Sede Santiago Sur, Av. Vicuna Mackenna 3864, Macul, Santiago, Chile','texto','JEFATURA','Dirección completa del libro v2: es la que Maps geocodifica'],['P_MAIL_SUPERVISOR','supervisor@serviciotecnico.cl','texto','JEFATURA','Reemplazar antes de habilitar correos'],
    ['P_AVISO_DOCUMENTOS',30,'días','JEFATURA',''],['P_REDONDEO',1000,'$','JEFATURA','Hacia arriba por técnico'],['P_DIAS_CALENDARIO',10,'días','JEFATURA',''],
    ['P_MAX_DIAS_AGENDA',60,'días','JEFATURA','Máximo horizonte por trabajo nuevo'],
    ['P_DIAS_RENDICION',3,'días','JEFATURA','Plazo desde fecha de gasto'],['P_INTERVALO_APP',5,'minutos','JEFATURA','Valores permitidos por Google: 1, 5, 10, 15, 30'],
    ['P_HORA_FLOTA',7,'hora','JEFATURA','Ventana horaria'],['P_HORA_RECALCULO',20,'hora','JEFATURA','Ventana horaria'],
    ['P_CORREOS_HABILITADOS',false,'booleano','JEFATURA','Activar solo con correos y videos reales'],
    ['P_ESPERADO_EQUIPOS',33,'equipos','PDF','Verificación demo'],['P_ESPERADO_JORNADA',37,'h','JEFATURA','Verificación demo'],['P_ESPERADO_CAP',0.25,'h','JEFATURA','Verificación demo']
  ];
}
function notaOrigen_(origen) {
  var notas = {
    'MAPS':'Km de la caché de Google Maps del libro; peaje del catálogo de plazas MOP 2026',
    'MAPS INVERSO':'Sentido inverso no consultado a Maps: se usa la distancia de ida',
    'MAPS Y PEAJE DERIVADO':'Km de Google Maps; peaje por diferencia de acumulados del corredor',
    'SIN TRASLADO':'Jornada en el mismo sitio: no hay tramo que recorrer',
    'PROMPT':'Distancia del requerimiento; tarifa referencial'
  };
  return notas[origen] || 'Estimación de demostración: validar recorrido real';
}
function datosSemilla_() {
  var p = {};
  definicionParametros_().forEach(function(f) { if (typeof f[1] !== 'string' || f[1][0] !== '=') p[f[0]] = f[1]; });
  p = parametrosDerivados_(p);
  // Km desde la base: ruta rápida de Google Maps, tomada de la caché _RUTAS del libro «Evaluacion 1».
  // Peaje de ida: catálogo de plazas MOP 2026 categoría 1 de la hoja DESTINOS del mismo libro.
  // «verificado» donde la hoja declara la suma de plazas auditada; el resto queda como estimado.
  var lista = [
    ['Copiapó','Atacama','Chacabuco 546',false,'R5N',812.2,28582,5,'Centro de Copiapó'],
    ['Coquimbo','Coquimbo','Bilbao 330',false,'R5N',469.8,15132,2,'Centro de Coquimbo'],
    ['La Calera','Valparaíso','J. J. Pérez 351',false,'R5N',121.7,5082,1,''],
    ['San Antonio','Valparaíso','Av. Barros Luco 1881',false,'R78',115.7,4008,2,''],
    ['Melipilla','Metropolitana','Serrano 1550',true,'R78',73.7,2847,2,''],
    ['Lo Barnechea','Metropolitana','Av. Lo Barnechea 1210',true,'URB',23.9,1498,3,''],
    ['Puente Alto','Metropolitana','Concha y Toro 1820',true,'URB',12.6,1005,1,''],
    ['Santiago','Metropolitana','Plaza de Armas 444',true,'URB',10,678,3,''],
    ['Pudahuel','Metropolitana','Av. San Pablo 8444',true,'URB',18.7,1767,3,''],
    ['Maipú','Metropolitana','Av. 5 de Abril 0260',true,'URB',16.9,1206,3,''],
    ['Curicó','Maule','Carmen 360',false,'R5S',194.7,5249,1,''],
    ['Talca','Maule','1 Sur 835',false,'R5S',258.7,5249,3,'Centro de Talca'],
    ['San Pedro de la Paz','Biobío','Los Álamos 2093',false,'R5S',508.1,16421,1,'Centro de Concepción'],
    ['Penco','Biobío','Freire 545',false,'R5S',493.7,15649,1,'Centro de Concepción'],
    ['Santa Juana','Biobío','Irarrázaval 320',false,'R5S',556.3,15649,1,'Centro de Concepción'],
    ['Tomé','Biobío','Ignacio Serrano 1130',false,'R5S',507.6,15649,1,'Centro de Concepción']
  ];
  var destinos = lista.map(function(d,i) { return { ID_Destino:'D'+String(i+1).padStart(2,'0'), Comuna:d[0], Region:d[1], Direccion_Municipalidad:d[2]+', '+d[0], En_RM:d[3], Corredor:d[4], Km_Ida:d[5], Peaje_Ida:d[6], Equipos_Pendientes:d[7], Equipos_Instalados:0, Hotel_Referencia:d[8] || 'No aplica, retorno en el día', Contacto_Cliente:'Contacto de demostración', Mail_Cliente:'', Link_Capacitacion:'' }; });
  var nombres = ['Álvaro Fuentes','Camila Rojas','Diego Muñoz','Javiera Soto','Matías Contreras','Fernanda Araya','Cristián Vega','Paulina Herrera','Rodrigo Cáceres','Bárbara Neira'];
  var tecnicos = nombres.map(function(n,i) { return { ID_Tecnico:'T'+String(i+1).padStart(2,'0'), Nombre:n, Email:n.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(' ','.')+'@serviciotecnico.cl', Telefono:'+569 XXXX XXXX', Licencia: i===7 || i===9 ? 'No' : 'Clase B', Cuadrilla:'C'+(Math.floor(i/2)+1), Vehiculo_Habitual:'V'+(Math.floor(i/2)+1), Activo:true }; });
  var camionetas = [18900,39500,52000,76000,96000,22000].map(function(k,i) { return { ID_Vehiculo:'V'+(i+1), Patente:'JKLM-'+String(i+1).repeat(2), Modelo:'Peugeot Partner', Km_Inicial:k, Km_Proxima_Mantencion:Math.ceil(k/p.P_KM_MANTENCION)*p.P_KM_MANTENCION, Venc_Revision_Tecnica:new Date(2026,9,1,12), Venc_Seguro:new Date(2027,2,31,12), Venc_Permiso_Circulacion:new Date(2027,2,31,12), Estado:i===5?'Reserva':'Disponible' }; });
  var bolsos = ['Multímetro y pinza amperimétrica','Crimpeadora, conectores RJ45 y tester de red','Kit de fibra óptica con fusionadora y pigtails','Taladro percutor, brocas y tarugos','Destornilladores aislados y llaves','Notebook con software de puesta en marcha','Equipo de reemplazo y repuestos menores','Cinta aisladora, amarras y canaletas'];
  var vehiculo = ['Escalera telescópica','Equipos a instalar del día','Extensión eléctrica, conos y señalética','Documentos del vehículo y TAG al día'];
  var persona = ['Casco, guantes dieléctricos, lentes y zapatos de seguridad','Arnés de seguridad','Botiquín, agua y linterna frontal','Celular con datos y batería cargada','Tarjeta corporativa de combustible y peajes'];
  var implementos = bolsos.concat(vehiculo,persona).map(function(n,i) { var categoria=i<bolsos.length?'Bolso':i<bolsos.length+vehiculo.length?'Vehiculo':'Persona'; return { ID_Implemento:'I'+String(i+1).padStart(2,'0'), Categoria:categoria, Item:n, Obligatorio:true, Viaja_En:categoria }; });
  var visitas=[], ordenes=[];
  // Tramos explícitos. Los kilómetros vienen de la caché _RUTAS del libro «Evaluacion 1»
  // (consulta real a Google Maps, ruta rápida). El peaje viene del catálogo de plazas MOP
  // de la hoja DESTINOS. Cada tramo declara de dónde salió su cifra en Origen_Dato y el
  // motor sigue alertando los que quedan como SUPUESTO.
  function jornada(c,d,tramos) {
    var id='J'+c+'-'+d, miembros=tecnicos.filter(function(t) { return t.Cuadrilla==='C'+c; });
    miembros.forEach(function(t,i) { ordenes.push({ ID_Orden:'O'+String(ordenes.length+1).padStart(4,'0'), Dia:d, Fecha:fechaLaboral_(p.P_FECHA_INICIO,d-1), Cuadrilla:'C'+c, ID_Tecnico:t.ID_Tecnico, ID_Vehiculo:'V'+c, Es_Conductor:i===0, ID_Destino:tramos[0][1], Estado_Orden:'Planificada', ID_Jornada:id, Email:t.Email }); });
    tramos.forEach(function(t,i) { visitas.push({ ID_Visita:'VI'+String(visitas.length+1).padStart(4,'0'), ID_Jornada:id, Secuencia:i+1, ID_Origen:t[0], ID_Destino:t[1], Km:t[2], Peaje:t[3], Equipos:t[4], Noches:t[5], Corredor:t[6], Origen_Dato:t[7] || 'SUPUESTO', Nota:notaOrigen_(t[7]), Equipos_Instalados:0 }); });
  }
  // Los 812,2 km reales hasta Copiapó son 10,15 h al volante y superan P_TOPE_CONDUCCION.
  // La ida se parte en Coquimbo, la misma escala que ya usaba el regreso.
  jornada(1,1,[['BASE','D02',469.8,15132,0,1,'R5N','MAPS']]);
  jornada(1,2,[['D02','D01',346.4,13450,0,1,'R5N','MAPS Y PEAJE DERIVADO']]);
  jornada(1,3,[['D01','D01',0,0,5,1,'URB','SIN TRASLADO']]);
  jornada(1,4,[['D01','D02',347.8,13450,2,1,'R5N','MAPS Y PEAJE DERIVADO']]);
  jornada(1,5,[['D02','D03',352.6,10050,1,0,'R5N','MAPS Y PEAJE DERIVADO'],['D03','BASE',120,5082,0,0,'R5N','MAPS']]);
  // Curicó y Talca comparten corredor: con las distancias reales, Talca de ida y vuelta en
  // un día suma 10,72 h y supera el tope legal. Se encadena el corredor con una pernocta.
  jornada(2,1,[['BASE','D11',194.7,5249,1,1,'R5S','MAPS']]);
  jornada(2,2,[['D11','D12',66.2,0,3,0,'R5S','MAPS Y PEAJE DERIVADO'],['D12','BASE',258.7,5249,0,0,'R5S','MAPS INVERSO']]);
  jornada(3,1,[['BASE','D13',508.1,16421,1,1,'R5S','MAPS']]);
  jornada(3,2,[['D13','D14',20.8,772,1,0,'URB','MAPS Y PEAJE DERIVADO'],['D14','D16',17.5,0,1,0,'URB','MAPS'],['D16','D15',90,0,1,1,'R5S']]);
  jornada(3,3,[['D15','BASE',556.3,15649,0,0,'R5S','MAPS INVERSO']]);
  jornada(4,1,[['BASE','D10',16.9,1206,3,0,'URB','MAPS'],['D10','BASE',16.9,1206,0,0,'URB','MAPS INVERSO']]);
  jornada(4,2,[['BASE','D09',18.7,1767,3,0,'URB','MAPS'],['D09','BASE',24.2,1767,0,0,'URB','MAPS']]);
  jornada(4,3,[['BASE','D08',10,678,3,0,'URB','MAPS'],['D08','BASE',10,678,0,0,'URB','MAPS INVERSO']]);
  jornada(5,1,[['BASE','D06',23.9,1498,3,0,'URB','MAPS'],['D06','D07',40,0,1,0,'URB'],['D07','BASE',18.4,1005,0,0,'URB','MAPS']]);
  jornada(5,2,[['BASE','D05',73.7,2847,2,0,'R78','MAPS'],['D05','D04',49.6,1161,2,0,'R78','MAPS Y PEAJE DERIVADO'],['D04','BASE',117.4,4008,0,0,'R78','MAPS']]);
  var gastos = ordenes.slice(0,5).map(function(o,i) { return { ID_Gasto:'G-DEMO-'+(i+1), ID_Orden:o.ID_Orden, ID_Tecnico:o.ID_Tecnico, Email:o.Email, Fecha:o.Fecha, Tipo:'Colación', Monto: p.P_COLACION, Estado:i===4?'Rechazado':'Pendiente', Comentario:i===4?'Ejemplo rechazado: boleta ilegible':'Gasto ficticio para demostración' }; });
  return { parametros:p, DESTINOS:destinos, TECNICOS:tecnicos, CAMIONETAS:camionetas, IMPLEMENTOS:implementos, ORDENES:ordenes, VISITAS:visitas, GASTOS:gastos, CHECKLIST:[], TRANSFERENCIAS:[] };
}
function cargarDatosEjemplo() {
  var ui=SpreadsheetApp.getUi();
  if (ui.alert('Datos de ejemplo','Solo se permite cargar en tablas operativas vacías. No mezcla ni reemplaza datos reales. ¿Continuar?',ui.ButtonSet.YES_NO)!==ui.Button.YES) return;
  return conBloqueo_(function() {
    var datos=datosSemilla_();
    Object.keys(datos).filter(function(k) { return k!=='parametros'; }).forEach(function(k) { exigir_(hoja_(k).getLastRow()<=1, k+': contiene datos; use una copia vacía para la demostración'); });
    calcularPlan(datos); // Validar antes de escribir.
    Object.keys(datos).filter(function(k) { return k!=='parametros'; }).forEach(function(k) { anexarObjetos_(k,datos[k]); });
    regenerarChecklistInterno_();
    return recalcularInterno_();
  });
}
