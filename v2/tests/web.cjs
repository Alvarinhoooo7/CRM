const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {fixture,root}=require('./fixture.cjs');
const {ctx,datos,payload}=fixture();
let checks=0;
function test(name,fn){fn();checks++;console.log('OK',name);}
test('Sintaxis de todos los scripts HTML',()=>{
 for(const f of fs.readdirSync(root).filter(f=>f.endsWith('.html'))){
  const s=fs.readFileSync(path.join(root,f),'utf8');
  for(const m of s.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(m[1],{filename:f});
 }
});
const literal=ctx.calcularPlan_(datos,'LITERAL_PDF'), mejora=ctx.calcularPlan_(datos,'OPERACION_REAL');
test('33 equipos y 16 localidades en ambos escenarios',()=>{for(const r of [literal,mejora]){assert.equal(r.totales.equipos,33);assert.equal(r.totales.localidades,16);}});
test('Capacitaciones: 33 literal, 16 mejora',()=>{assert.equal(literal.totales.capacitaciones,33);assert.equal(mejora.totales.capacitaciones,16);});
test('Paralelización y segunda visita sin duplicar',()=>{assert.equal(ctx.horasEnSitio_(5,3,true,literal.parametros).instalacion,4);assert.equal(ctx.horasEnSitio_(5,3,false,literal.parametros).total,0);});
test('Diferencia de sesiones 12,5 h; horas-persona 37,5 h',()=>{const sum=r=>r.tramos.reduce((a,t)=>a+t.horasCapacitacion,0);assert.equal(sum(literal)-sum(mejora),12.5);assert.ok(Math.abs(literal.totales.horasHombre-mejora.totales.horasHombre-37.5)<1e-8);});
test('Viático se calcula una sola vez por técnico y día',()=>{const keys=literal.tecnicoDias.map(x=>x.tecnico+'|'+x.dia);assert.equal(keys.length,new Set(keys).size);assert.equal(literal.totales.viatico,keys.length*literal.parametros.P_VIATICO);});
test('Transferencias reconciliadas y redondeadas',()=>{for(const r of literal.transferencias){assert.equal(r.subtotal,r.viatico+r.hotel+r.combustible+r.peajes);assert.equal(r.total%literal.parametros.P_REDONDEO_TRANSFERENCIA,0);assert.ok(r.total>=r.subtotal+r.imprevistos);}});
test('Escenario literal predeterminado',()=>assert.equal(ctx.ESQUEMA_ESCENARIOS.activo,'LITERAL_PDF'));
test('Payload del tablero no contiene Date ni Infinity',()=>{const p=ctx.obtenerTablero('test','LITERAL_PDF',true);const visit=v=>{assert.ok(!(v instanceof Date));if(v&&typeof v==='object')Object.values(v).forEach(visit);};visit(p);assert.ok(p.fechas.D1.includes('2026'));});
test('Orden conserva el escenario seleccionado',()=>{const o=ctx.obtenerOrdenServicio('test','T01','LITERAL_PDF');assert.equal(o.tramos.reduce((a,t)=>a+t.capacitaciones,0),8);assert.equal(o.capacitacionDigital,false);assert.equal(ctx.obtenerOrdenServicio('test','T01','OPERACION_REAL').capacitacionDigital,true);});
test('Endpoints rechazan una sesión ausente',()=>{for(const name of ['obtenerTablero','obtenerEditor','guardarDestino','guardarPlanWeb','obtenerCatalogoPeajes','obtenerOrdenServicio','guardarParametro','exportarOrdenDesdeApi']) assert.throws(()=>ctx[name](''),/Sesion/);});
test('Simulador rechaza equipos negativos y técnicos fraccionarios',()=>{assert.throws(()=>ctx.simularTrabajo('test',{localidad:'Maipu',equipos:-1,tecnicos:3,dia:'D1'}));assert.throws(()=>ctx.simularTrabajo('test',{localidad:'Maipu',equipos:1,tecnicos:1.5,dia:'D1'}));});
const cab=ctx.ESQUEMA_PLAN.columnas.map(x=>x.titulo).concat(datos.tecnicos.map(t=>t.codigo));
const filas=()=>datos.tramos.map(t=>[t.n,t.dia,t.cuadrilla,t.modo,t.vehiculo,t.desde,t.hasta,t.noches,t.conductor].concat(datos.tecnicos.map(x=>t.tecnicos.includes(x.codigo))));
test('El editor admite el plan completo de referencia',()=>assert.equal(ctx.validarFilasPlan_(filas(),cab,datos).length,23));
test('El editor rechaza conductor sin licencia, ruta rota y doble vehículo',()=>{
 let f=filas();f[0][8]='T08';assert.throws(()=>ctx.validarFilasPlan_(f,cab,datos));
 f=filas();f[1][5]='BASE';assert.throws(()=>ctx.validarFilasPlan_(f,cab,datos),/discontinua/);
 f=filas();f[5][4]='V1';assert.throws(()=>ctx.validarFilasPlan_(f,cab,datos),/camioneta/);
});
test('Texto de celdas no admite fórmulas',()=>assert.throws(()=>ctx.textoCelda_('=IMPORTXML("url")')));
test('Las funciones internas no quedan expuestas por RPC',()=>{
 const permitidas=new Set('doGet onOpen iniciarSesion cerrarSesion obtenerTablero recalcular actualizarRutas simularTrabajo obtenerOrdenServicio guardarParametro obtenerEsquemaConfig obtenerCatalogoPeajes exportarOrdenDesdeApi obtenerEditor guardarDestino guardarPlanWeb'.split(' '));
 for(const f of fs.readdirSync(root).filter(f=>f.endsWith('.gs'))) for(const m of fs.readFileSync(path.join(root,f),'utf8').matchAll(/^function (\w+)\(/gm)) assert.ok(m[1].endsWith('_')||permitidas.has(m[1]),m[1]);
});
test('Técnicos se leen por encabezado aun con columnas reordenadas',()=>{
 const header=cab.slice(0,9).concat(['T02','T01']);
 const row=[1,'D1','C1','Camioneta','V1','BASE','Maipu',0,'T01',false,true];
 const libro={getSheetByName:()=>({getDataRange:()=>({getValues:()=>[[],header,row]})})};
 assert.equal(ctx.leerPlan_(libro,datos.tecnicos)[0].tecnicos[0],'T01');
 assert.throws(()=>ctx.leerPlan_(libro,datos.tecnicos.filter(t=>t.codigo!=='T01')),/inactivo/);
});
test('Sin datos de Maps el plan informa respaldo',()=>{const r=ctx.calcularPlan_({...datos,rutas:{}},'LITERAL_PDF');assert.ok(r.alertas.some(a=>a.id==='RUTA_SIN_MAPS'));});
console.log(`${checks} comprobaciones completadas. Datos de ruta sintéticos; no validan Google ni precios reales.`);
if(process.argv.includes('--fixture'))fs.writeFileSync(path.join(__dirname,'payload.local.json'),JSON.stringify(payload(),null,2));
