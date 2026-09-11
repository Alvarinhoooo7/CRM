const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
process.env.TZ = 'America/Santiago';
const props = {}, cache = new Map();
const context = vm.createContext({ console, Date, Math, JSON, isFinite,
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k,v) => props[k]=v }) },
  CacheService: { getScriptCache: () => ({ get: k => cache.get(k), put: (k,v) => cache.set(k,v), remove: k => cache.delete(k) }) },
  Utilities: { getUuid: () => 'preview-test', formatDate: (d,tz,f) => {
    const pad=n=>String(n).padStart(2,'0');
    return f.replace('yyyy',d.getFullYear()).replace('MM',pad(d.getMonth()+1)).replace('dd',pad(d.getDate())).replace('HH',pad(d.getHours())).replace('mm',pad(d.getMinutes()));
  } }, Session: { getActiveUser: () => ({ getEmail: () => 'demo@example.com' }) }
});
for (const file of fs.readdirSync('apps-script').filter(f=>f.endsWith('.gs')).sort()) {
  vm.runInContext(fs.readFileSync('apps-script/'+file,'utf8'), context, { filename:file });
}
for (const file of fs.readdirSync('apps-script').filter(f=>f.endsWith('.html'))) {
  for (const match of fs.readFileSync('apps-script/'+file,'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    new vm.Script(match[1].replace(/<\?[\s\S]*?\?>/g, '""'), { filename:file });
  }
}
vm.runInContext(`
var tables = {}, serial=0;
Object.keys(SCHEMA).forEach(function(k){tables[k]=[];});
dbLeer=function(k){return tables[k] || [];};
dbInvalidar=function(){};
dbInsertarVarios=function(k,rows){rows.forEach(function(r){tables[k].push(Object.assign({_fila:tables[k].length+2},r));});return rows;};
dbInsertar=function(k,r){dbInsertarVarios(k,[r]);return r;};
dbActualizar=function(k,key,id,values){var r=tables[k].find(function(x){return x[key]===id;});if(r)Object.assign(r,values);return !!r;};
dbEliminar=function(k,criteria){tables[k]=tables[k].filter(function(r){return !Object.keys(criteria).every(function(p){return String(r[p])===String(criteria[p]);});});};
dbTruncar=function(k){tables[k]=[];};
dbReemplazar=function(k,rows){tables[k]=rows;};
dbNuevoId=function(p){return p+(++serial);};
dbReiniciarSecuencia=function(){};
libro=function(){return {getSheetByName:function(k){return {deleteRow:function(n){tables[k].splice(n-2,1);}};}};};
log=function(){};
_configCache={SEMANA_PLANIFICACION:'2026-W38',WEBHOOK_SECRET:'test'};
sembrarMaestros();
`, context);
const run = code => vm.runInContext(code,context);
assert.equal(run('sumarPor(dbLeer(SH.REQUERIMIENTOS),"EQUIPOS")'),33);
assert.equal(run('dbLeer(SH.REQUERIMIENTOS).length'),16);
assert.equal(run('CONFIG_BASICA.length'),10);
const result=run('planificarSemana()');
console.log('Plan de demo:',JSON.stringify(result));
assert.equal(result.equipos,33, 'Deben quedar planificados los 33 equipos');
assert.equal(run('dbLeer(SH.MATERIALES).length'),0);
assert.equal(run('dbLeer(SH.CAPACITACION).length'),result.ot);
assert.equal(run('dbLeer(SH.ITINERARIO).some(function(t){return t.MODO==="UBER";})'),false);
assert.ok(run('dbLeer(SH.VIATICOS).every(function(v){return v.TOTAL_TRANSFERIR >= v.MONTO_ALOJAMIENTO+v.MONTO_VIATICO+v.MONTO_PASAJES+v.FONDO_COMBUSTIBLE+v.FONDO_PEAJES;})'));
assert.ok(run('resumenTesoreria().totalTransferir')>0);
console.log('Transferencias simuladas:',run('resumenTesoreria().totalTransferir'));
console.log('Modos elegidos:', run('dbLeer(SH.CUADRILLAS).map(function(c){return c.MODO_TRANSPORTE;}).join(", ")'));
assert.equal(run('planificarSemana().equipos'),33,'Replanificar antes de ejecutar conserva demanda');
assert.ok(run('apiPresentacion().requerimientos.length===16'));
run('var first=dbLeer(SH.OT)[0];');
assert.equal(run('finalizarOT({otId:first.OT_ID,tecnicoId:first.TECNICO_ID,capacitacionOk:true}).ok'),false);
assert.equal(run('iniciarOT(first.OT_ID,"OTRO").ok'),false);
assert.equal(run('iniciarOT(first.OT_ID,first.TECNICO_ID).ok'),true);
const start=run('first.HORA_INICIO_REAL.getTime()');
assert.equal(run('iniciarOT(first.OT_ID,first.TECNICO_ID).ok'),true);
assert.equal(run('first.HORA_INICIO_REAL.getTime()'),start);
assert.throws(()=>run('planificarSemana()'),/ejecucion/);
assert.equal(run('finalizarOT({otId:first.OT_ID,tecnicoId:first.TECNICO_ID}).ok'),false);
assert.equal(run('finalizarOT({otId:first.OT_ID,tecnicoId:first.TECNICO_ID,capacitacionOk:true}).ok'),true);
assert.equal(run('finalizarOT({otId:first.OT_ID,tecnicoId:first.TECNICO_ID,capacitacionOk:true}).ok'),true);
assert.throws(()=>run('apiAccionPresentacion("bad","planificar",{})'),/token/);
// Comprueba el contrato real de Routes API y errores HTTP, sin red.
run(`_configCache.GOOGLE_MAPS_API_KEY='fake-key';
var routePayload;
UrlFetchApp={fetch:function(url,options){
  if(url!=='https://routes.googleapis.com/directions/v2:computeRoutes')throw new Error('URL incorrecta');
  routePayload=JSON.parse(options.payload);
  return {getResponseCode:function(){return 200;},getContentText:function(){return JSON.stringify({routes:[{distanceMeters:123400,duration:'5400s',legs:[{endLocation:{latLng:{latitude:-27.3,longitude:-70.3}}}]}]});}};
}};
var routeHttp=consultarRutaExacta_('Base, Chile','Cliente, Chile');`);
assert.equal(run('routeHttp.km'),123.4);
assert.equal(run('routeHttp.min'),90);
assert.equal(run('routePayload.origin.address'),'Base, Chile');
assert.equal(run('routePayload.travelMode'),'DRIVE');
run('UrlFetchApp.fetch=function(){return {getResponseCode:function(){return 403;}};};');
assert.throws(()=>run('consultarRutaExacta_("Base","Cliente")'),/HTTP 403/);
run('_configCache.GOOGLE_MAPS_API_KEY="";');
// Simula proveedor: no consume cuota ni modifica un proyecto de Google.
run(`consultarRutaExacta_=function(a,b){return {km:123,min:90,lat:-27.3,lng:-70.3,direccion:b,fuente:'MAPS_TEST'};};
var anterior=dbUno(SH.DESTINOS,{DESTINO_ID:'D01'}).DIRECCION;
var preview=guardarDireccionYCalcularRuta_({destinoId:'D01',direccion:'Direccion exacta 123, Copiapo, Chile'});`);
assert.equal(run('dbUno(SH.DESTINOS,{DESTINO_ID:"D01"}).DIRECCION'),run('anterior'));
run('confirmarRuta_(preview.previewId)');
assert.equal(run('tramo(BASE_ID,"D01").km'),123);
assert.equal(run('tramo("D01",BASE_ID).km'),123);
assert.equal(run('dbBuscar(SH.MATRIZ,{ORIGEN_ID:"D01"}).length'),1,'Se invalidan rutas del punto anterior');
assert.throws(()=>run('confirmarRuta_(preview.previewId)'),/venci/);
console.log('OK: sintaxis GS/HTML, 33 equipos, viáticos, replanificación, cierre y rutas con proveedor simulado.');
