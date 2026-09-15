/* Regresiones de reglas operativas y financieras: node demo/pruebas-ui.cjs */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('node:assert/strict');
const c = vm.createContext({ console, window: { localStorage: { setItem() {}, removeItem() {}, getItem() {} } } });
for (const file of ['00_datos', '00_comunas', '01_motor', '08_reglas', '02_estado', '03_supervisor', '04_coordinador', '05_tecnico', '07_analitica', '09_escenario']) {
  new vm.Script(fs.readFileSync(path.join(__dirname, 'js', file + '.js'), 'utf8'), {filename:file}).runInContext(c);
}
let casos = 0;
function test(nombre, fn) { c.cargarEstado(); c.sesion = {rol:null,idTecnico:null}; fn(); casos++; console.log('OK', nombre); }
function accion(a, p) { return c.despachar(a, p); }
function rechaza(a, p, texto) {
  const antes = JSON.stringify(c.estado);
  assert.equal(accion(a,p), null, a + ' debio rechazar');
  assert.equal(JSON.stringify(c.estado),antes,'Rechazo atomico');
  if(texto)assert.match(c.ultimoError,texto);
}
function nueva(extra={}) { return {empresa:'Empresa nueva',direccion:'Calle distinta',numero:'123',cliente:'Contacto',mail:'contacto@example.test',region:'Metropolitana de Santiago',comuna:'Macul',fecha:'2026-09-28',equipos:2,km:20,peaje:1000,corredor:'URB',tecnicos:['T07','T08'],conductor:'T07',vehiculo:'V4',...extra}; }
function orden(id) { return c.buscarOrden(id); }
function lista(id) { orden(id).Checklist.forEach(i=>accion('marcarChecklist',{idOrden:id,idImplemento:i.ID_Implemento,marcado:true})); }

test('Catalogo 16 regiones, 346 comunas, Nuble separado',()=>{
 assert.equal(Object.keys(c.REGIONES).length,16); assert.equal(c.COMUNAS_REGION_RAW.length,346);
 assert.equal(c.REGIONES['\u00d1uble'].length,21); assert.equal(c.REGIONES['Biob\u00edo'].length,33);
 assert.equal(new Set(c.COMUNAS_REGION_RAW.map(x=>x.join('|'))).size,346);
});
test('Plan inicial valido',()=>c.validarPlanOperativo(c.estado));
test('Retorno antes de salida',()=>rechaza('moverJornada',{idJornada:'J05',fecha:'2026-09-18'},/Respeta/));
test('Salida despues del destino',()=>rechaza('moverJornada',{idJornada:'J01',fecha:'2026-09-24'}));
test('Doble reserva de tecnico y vehiculo',()=>rechaza('moverJornada',{idJornada:'J12',fecha:'2026-09-21'},/ocupado/));
test('No deja noches sin planificar',()=>rechaza('moverJornada',{idJornada:'J01',fecha:'2026-09-18'},/alojamiento/));
test('Fin de semana y fecha inexistente',()=>{rechaza('moverJornada',{idJornada:'J11',fecha:'2026-09-27'});rechaza('moverJornada',{idJornada:'J11',fecha:'2026-02-30'});});
test('Cambio valido de ida y vuelta independiente',()=>{assert.ok(accion('moverJornada',{idJornada:'J13',fecha:'2026-09-28'}));assert.equal(c.estado.ordenes.find(o=>o.ID_Jornada==='J13').Fecha,'2026-09-28');});
test('Checklist protege reprogramacion y reasignacion',()=>{lista('O0021');rechaza('moverJornada',{idJornada:'J11',fecha:'2026-09-28'});rechaza('asignar',{idJornada:'J11',tecnicos:['T09'],conductor:'T09',vehiculo:'V6'});});
test('Gastos protegen orden de borrado por reasignacion',()=>{c.estado.gastos.push({ID_Orden:'O0021',Monto:1000,Estado:'Pendiente'});rechaza('asignar',{idJornada:'J11',tecnicos:['T09'],conductor:'T09',vehiculo:'V6'});});
test('No conductor sin licencia',()=>rechaza('asignar',{idJornada:'J11',tecnicos:['T07','T08'],conductor:'T08',vehiculo:'V4'}));
test('No equipo duplicado',()=>rechaza('asignar',{idJornada:'J11',tecnicos:['T07','T07'],conductor:'T07',vehiculo:'V4'}));
test('No teletransporta reemplazo a Copiapo',()=>rechaza('asignar',{idJornada:'J03',tecnicos:['T07','T08'],conductor:'T07',vehiculo:'V6'}));
test('No empieza el retorno aunque marque checklist',()=>{lista('O0009');rechaza('iniciarTrabajo',{idOrden:'O0009'},/Primero/);});
test('No inicia sin checklist',()=>rechaza('iniciarTrabajo',{idOrden:'O0021'}));
test('No puede operar orden ajena',()=>{c.sesion={rol:'tecnico',idTecnico:'T01'};rechaza('marcarChecklist',{idOrden:'O0021',idImplemento:'I01',marcado:true});});
test('Cierre protegido y total de cuadrilla no se duplica',()=>{
 for(const id of ['O0021','O0022']){lista(id);assert.ok(accion('iniciarTrabajo',{idOrden:id}));rechaza('marcarChecklist',{idOrden:id,idImplemento:'I01',marcado:false});rechaza('finalizarTrabajo',{idOrden:id,equipos:3});assert.ok(accion('finalizarTrabajo',{idOrden:id,equipos:3,firma:'firma',foto:'foto'}));}
 assert.equal(c.plan.resumen.Equipos_Instalados,3);
 rechaza('finalizarTrabajo',{idOrden:'O0021',equipos:3,firma:'firma',foto:'foto'});
});
test('Cierres de companeros deben coincidir',()=>{for(const id of ['O0021','O0022']){lista(id);accion('iniciarTrabajo',{idOrden:id});}accion('finalizarTrabajo',{idOrden:'O0021',equipos:3,firma:'firma',foto:'foto'});rechaza('finalizarTrabajo',{idOrden:'O0022',equipos:2,firma:'firma',foto:'foto'});});
test('Rechaza montos invalidos y comprobantes repetidos',()=>{
 const g={idOrden:'O0021',idTecnico:'T07',tipo:'Peaje',monto:5000,comprobante:'foto'};
 for(const monto of [NaN,Infinity,-1,0,1.2])rechaza('agregarGasto',{...g,monto});
 rechaza('agregarGasto',{...g,comprobante:null});rechaza('agregarGasto',{...g,idTecnico:'T01'});
 assert.ok(accion('agregarGasto',g));rechaza('agregarGasto',g);
});
test('Rendicion no puede revisarse dos veces',()=>{accion('agregarGasto',{idOrden:'O0021',idTecnico:'T07',tipo:'Peaje',monto:5000,comprobante:'foto'});accion('revisarGasto',{idGasto:'G0001',estado:'Aprobado'});rechaza('revisarGasto',{idGasto:'G0001',estado:'Rechazado'});});
test('Pagos conservan monto al recalcular',()=>{accion('marcarPago',{idTecnico:'T01'});const monto=c.estado.pagos.T01.Monto;accion('parametro',{codigo:'P_DIESEL',valor:2000});assert.equal(c.estado.pagos.T01.Monto,monto);assert.equal(c.plan.nomina[0].Transferido,monto);assert.ok(c.plan.nomina[0].Por_Transferir>0);});
test('Pago repetido no se anula',()=>{accion('marcarPago',{idTecnico:'T01'});rechaza('marcarPago',{idTecnico:'T01'});});
test('Reembolso cubre solo aprobado pendiente y es idempotente',()=>{
 c.cargarEscenarioFinanciero(c.estado);c.recalcular();c.sesion={rol:'supervisor'};
 const pendiente=c.plan.resumen.Por_Reembolsar;assert.ok(pendiente>0);const n=c.plan.nomina.find(n=>n.Por_Reembolsar>0), monto=n.Por_Reembolsar;
 assert.ok(accion('pagarReembolso',{idTecnico:n.ID_Tecnico}));assert.equal(c.plan.resumen.Por_Reembolsar,pendiente-monto);rechaza('pagarReembolso',{idTecnico:n.ID_Tecnico});
});
test('Escenario aditivo sin duplicar registros',()=>{const firma='no tocar';c.estado.ordenes[0].Firma=firma;assert.ok(c.cargarEscenarioFinanciero(c.estado));const e=JSON.stringify(c.estado);assert.equal(c.cargarEscenarioFinanciero(c.estado),false);assert.equal(JSON.stringify(c.estado),e);assert.equal(c.estado.ordenes[0].Firma,firma);assert.ok(c.estado.gastos.some(g=>g.Estado==='Pendiente'));});
test('Division por cero y parametro fuera de rango',()=>{rechaza('parametro',{codigo:'P_RENDIMIENTO',valor:0});rechaza('parametro',{codigo:'P_IMPREVISTOS',valor:2});rechaza('parametro',{codigo:'P_DIESEL',valor:-1});});
test('Formulario valida region comuna y numeros',()=>{rechaza('crearTrabajo',nueva({comuna:'Chillan'}));rechaza('crearTrabajo',nueva({equipos:1.5}));rechaza('crearTrabajo',nueva({mail:'invalido'}));rechaza('crearTrabajo',nueva({km:-2}));rechaza('crearTrabajo',nueva({fecha:'2026-09-27'}));});
test('Simulacion y confirmacion coinciden; nueva direccion no pisa cliente',()=>{
 const d=nueva({comuna:'Maip\u00fa',km:31,peaje:2345});const anterior=JSON.stringify(c.estado.destinos);const sim=c.prepararTrabajo(d,c.estado);const presupuesto=sim.plan.resumen.Costo_Total;
 assert.equal(JSON.stringify(c.estado.destinos),anterior);assert.ok(accion('crearTrabajo',d));assert.equal(c.plan.resumen.Costo_Total,presupuesto);assert.equal(c.estado.destinos.at(-1).Km_Ida,31);assert.equal(JSON.stringify(c.estado.destinos.slice(0,-1)),anterior);
});
test('Confirmar propuesta vieja revalida disponibilidad',()=>{const d=nueva();c.prepararTrabajo(d,c.estado);assert.ok(accion('crearTrabajo',d));rechaza('crearTrabajo',d,/ocupado|duplicarlo/);});
test('Pernocta genera ida y retorno en dias distintos',()=>{const d=nueva({comuna:'Talca',region:'Maule',km:320,corredor:'R5S'});const p=c.prepararTrabajo(d,c.estado);assert.equal(p.jornadas.length,2);assert.notEqual(p.jornadas[0].Fecha,p.jornadas[1].Fecha);assert.equal(p.jornadas[0].Tramos.at(-1).Noches,1);assert.equal(p.jornadas.at(-1).Tramos.at(-1).Destino,'BASE');});
test('Viaje largo requiere escala real',()=>rechaza('crearTrabajo',nueva({comuna:'Arica',region:'Arica y Parinacota',km:2000,corredor:'R5N'}),/escala/));
test('Viaje no cruza fin de semana sin planificar',()=>rechaza('crearTrabajo',nueva({comuna:'Talca',region:'Maule',km:320,corredor:'R5S',fecha:'2026-10-02'}),/fin de semana/));
test('No utiliza recursos en taller',()=>{c.estado.flota.find(v=>v.ID_Vehiculo==='V6').Estado='Taller';rechaza('crearTrabajo',nueva({vehiculo:'V6'}),/taller/);});
test('Pantallas financieras con datos sin NaN',()=>{c.cargarEscenarioFinanciero(c.estado);c.recalcular();for(const v of ['resumen','finanzas','desempeno','gastos','nomina','parametros']) assert.ok(!/NaN|undefined/.test(c.panelAnalitico(v)),v);});
test('Prorrateo comunal suma costo total con retorno y reserva',()=>{const suma=Object.values(c.plan.porComuna).reduce((a,b)=>a+b,0);assert.ok(Math.abs(suma-c.plan.resumen.Costo_Total)<0.001);});
test('Reembolso reduce anticipo pendiente sin pagar dos veces',()=>{c.cargarEscenarioFinanciero(c.estado);c.recalcular();c.sesion={rol:'supervisor'};const n=c.plan.nomina.find(n=>n.Por_Reembolsar>0), total=n.Total;accion('pagarReembolso',{idTecnico:n.ID_Tecnico});accion('marcarPago',{idTecnico:n.ID_Tecnico});const despues=c.plan.nomina.find(x=>x.ID_Tecnico===n.ID_Tecnico);assert.equal(despues.Transferido+despues.Reembolsado,total);});
test('No abandona un integrante fuera de base',()=>rechaza('asignar',{idJornada:'J05',tecnicos:['T01'],conductor:'T01',vehiculo:'V1'},/retorno/));
test('No cambia capacitacion tras iniciar el trabajo',()=>{lista('O0021');accion('iniciarTrabajo',{idOrden:'O0021'});rechaza('enviarCapacitacion',{idDestino:'D10',mail:'a@example.test',link:'https://example.test'});});
test('Mantenimiento permite reparar jornadas de forma incremental',()=>{accion('estadoVehiculo',{idVehiculo:'V4',estado:'Taller'});assert.ok(accion('asignar',{idJornada:'J11',tecnicos:['T07','T08'],conductor:'T07',vehiculo:'V6'}));assert.ok(accion('asignar',{idJornada:'J12',tecnicos:['T07','T08'],conductor:'T07',vehiculo:'V6'}));});
test('Horas extra se separan por semana civil',()=>{
 const j=JSON.parse(JSON.stringify(c.estado.jornadas.find(j=>j.ID_Jornada==='J11')));j.Tramos[0].Equipos=7;
 const otra=JSON.parse(JSON.stringify(j));otra.ID_Jornada='J99';otra.Fecha='2026-09-28';c.estado.jornadas=[j,otra];c.estado.parametros.P_HORAS_EXTRA_SEMANA=2;
 const p=c.recalcularPlan(c.estado);assert.ok(p.nomina.find(n=>n.ID_Tecnico==='T07').Horas_Extra>2);assert.ok(!p.alertas.some(a=>a.origen==='T07'));
});
test('Restablecer plan repone escenario financiero de forma estable',()=>{assert.ok(accion('reiniciar',{}));const n=c.estado.gastos.length;assert.equal(n,14);assert.equal(c.cargarEscenarioFinanciero(c.estado),false);assert.equal(c.estado.gastos.length,n);});
console.log(casos + ' escenarios de regresion aprobados.');
