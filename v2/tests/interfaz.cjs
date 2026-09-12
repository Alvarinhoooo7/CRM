// Verificación del renderizado y acciones con DOM y RPC simulados. No sustituye un navegador.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {fixture,root}=require('./fixture.cjs');const {ctx,datos}=fixture();
const html=fs.readFileSync(path.join(root,'Index.html'),'utf8');
const nodes=new Map();
function node(id,cls=''){
 const classes=new Set(cls.split(' ').filter(Boolean));let markup='',value='';
 return {id,dataset:{},style:{},options:[],children:[],textContent:'',disabled:false,offsetParent:null,
  classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)},
  get innerHTML(){return markup;},set innerHTML(s){markup=s;this.options=[...s.matchAll(/<option(?: value="([^"]*)")?[^>]*>(.*?)<\/option>/g)].map(m=>({value:m[1]||m[2]}));if(this.options.length)value=this.options[0].value;},
  get value(){return value;},set value(v){value=v;},
  appendChild(n){this.options.push(n);if(!value)value=n.value;},addEventListener(){},
 };
}
for(const m of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)){assert.ok(!nodes.has(m[1]),'ID repetido: '+m[1]);const cls=m[0].match(/class="([^"]*)"/);nodes.set(m[1],node(m[1],cls?.[1]||''));}
const buttons=[...html.matchAll(/<button[^>]+data-vista="([^"]+)"[^>]*>/g)].map(m=>{const n=node('tab-'+m[1],'pestana');n.dataset.vista=m[1];return n;});
const document={body:{dataset:{vista:'orden',tecnico:'T01'}},
 getElementById:id=>{if(!nodes.has(id))throw Error('ID ausente: '+id);return nodes.get(id);},
 createElement:()=>node('op'),addEventListener(){},
 querySelectorAll:s=>s==='.vista'?[...nodes.values()].filter(n=>n.id.startsWith('vista-')):s==='.pestana'?buttons:[],
 querySelector:s=>buttons.find(b=>s.includes('"'+b.dataset.vista+'"'))||null};
const apis={
 obtenerTablero:(_,e)=>ctx.obtenerTablero('test',e||'LITERAL_PDF',true),recalcular:(_,e)=>ctx.obtenerTablero('test',e||'LITERAL_PDF',true),
 obtenerOrdenServicio:(_,c,e)=>ctx.obtenerOrdenServicio('test',c,e),obtenerCatalogoPeajes:()=>ctx.obtenerCatalogoPeajes('test'),
 simularTrabajo:(_,s)=>ctx.simularTrabajo('test',s),
 obtenerEditor:()=>({destinos:ctx.SIEMBRA_DESTINOS,plan:datos.tramos.map(t=>[t.n,t.dia,t.cuadrilla,t.modo,t.vehiculo,t.desde,t.hasta,t.noches,t.conductor].concat(datos.tecnicos.map(x=>t.tecnicos.includes(x.codigo)))),encabezadosPlan:ctx.ESQUEMA_PLAN.columnas.map(c=>c.titulo).concat(datos.tecnicos.map(t=>t.codigo)),parametros:datos.parametros,esquema:ctx.obtenerEsquemaConfig('test')})};
const rpc=(ok,fail)=>new Proxy({},{get:(_,name)=>name==='withSuccessHandler'?f=>rpc(f,fail):name==='withFailureHandler'?f=>rpc(ok,f):(...args)=>{try{const r=apis[name](...args);if(ok)ok(r);}catch(e){if(fail)fail(e);else throw e;}}});
const ui=vm.createContext({console,document,google:{script:{run:rpc()}},window:{addEventListener(){}},setTimeout:()=>{},clearTimeout(){},Date,Math,Number,String,Object,Array,URL,Blob,alert(){}});
for(const file of ['Scripts.html','Editor.html'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8').replace(/^<script>\s*/,'').replace(/<\/script>\s*$/,''),ui,{filename:file});
ui.TOKEN='test';ui.cargarTablero(false);
assert.ok(!nodes.get('errorGeneral').innerHTML,nodes.get('errorGeneral').innerHTML);
assert.ok(nodes.get('kpis').innerHTML.includes('33'));
assert.ok(nodes.get('vista-orden').classList.contains('activa'));
assert.ok(nodes.get('contenidoOrden').innerHTML.includes('T01'));
for(const vista of ['resumen','operacion','gastos','tecnicos','calendario','transporte','peajes','orden','gestion','guia']){
 ui.mostrar(vista);assert.ok(nodes.get('vista-'+vista).classList.contains('activa'));console.log('OK render',vista);
}
assert.ok(nodes.get('editorConfig').innerHTML.includes('P_DIESEL'));
assert.equal((nodes.get('editorPlan').innerHTML.match(/<tr>/g)||[]).length,24);
nodes.get('filtroRuta').value='copiapó';ui.dibujarOperacion();assert.ok(nodes.get('tablaItinerario').innerHTML.includes('Copiapo'));
nodes.get('filtroRuta').value='no-existe';ui.dibujarOperacion();assert.ok(nodes.get('tablaItinerario').innerHTML.includes('No hay tramos'));
nodes.get('selectorOrden').value='T10';ui.cargarOrden();assert.ok(nodes.get('contenidoOrden').innerHTML.includes('T10'));
ui.cargarTablero(false,'OPERACION_REAL');assert.equal(ui.DATOS.escenarioActivo,'OPERACION_REAL');
ui.agregarTramo();assert.equal(ui.EDITOR.plan.length,24);ui.quitarTramo(23);assert.equal(ui.EDITOR.plan.length,23);
assert.ok(!nodes.get('notificacion').textContent.includes('Error'));
console.log('OK enlace directo, 23 tramos, configuración, búsqueda con tildes, estado vacío, reserva y cambio de escenario. DOM/RPC simulados.');
