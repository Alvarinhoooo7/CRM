// Vista previa local con proveedor sintético. Nunca accede a Google ni escribe Sheets.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {fixture,root}=require('./fixture.cjs');
const {ctx,datos}=fixture();
const api={
 iniciarSesion:()=>({ok:true,token:'test'}), cerrarSesion:()=>({ok:true}),
 obtenerTablero:(_,esc)=>ctx.obtenerTablero('test',esc||'LITERAL_PDF',true),
 recalcular:(_,esc)=>ctx.obtenerTablero('test',esc||'LITERAL_PDF',true),
 obtenerOrdenServicio:(_,tec,esc)=>ctx.obtenerOrdenServicio('test',tec,esc),
 simularTrabajo:(_,s)=>ctx.simularTrabajo('test',s),
 obtenerCatalogoPeajes:()=>ctx.obtenerCatalogoPeajes('test'),
 obtenerEditor:()=>({ok:true,destinos:ctx.SIEMBRA_DESTINOS,plan:datos.tramos.map(t=>[t.n,t.dia,t.cuadrilla,t.modo,t.vehiculo,t.desde,t.hasta,t.noches,t.conductor].concat(datos.tecnicos.map(x=>t.tecnicos.includes(x.codigo)))),encabezadosPlan:ctx.ESQUEMA_PLAN.columnas.map(c=>c.titulo).concat(datos.tecnicos.map(t=>t.codigo)),parametros:datos.parametros,esquema:ctx.obtenerEsquemaConfig('test'),revisionPlan:'local',revisionDestinos:'local'}),
};
let html=fs.readFileSync(path.join(root,'Index.html'),'utf8').replace(/<\?!= incluir_\('(\w+)'\) \?>/g,(_,f)=>fs.readFileSync(path.join(root,f+'.html'),'utf8')).replace(/<\?= nombreApp \?>/g,'Servicio Técnico en Ruta').replace(/<\?= version \?>/g,'2.1 · LOCAL').replace(/<\?= vistaInicial \?>/g,'resumen').replace(/<\?= tecnicoInicial \?>/g,'').replace(/<script src="https:\/\/www.gstatic.com\/charts\/loader.js"><\/script>/,'');
const mock=`<script>window.google={script:{}};function runner(ok,fail){return new Proxy({}, {get:function(_,name){if(name==='withSuccessHandler')return function(f){return runner(f,fail)};if(name==='withFailureHandler')return function(f){return runner(ok,f)};return function(){fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,args:Array.from(arguments)})}).then(r=>r.json()).then(r=>{if(r.error){if(fail)fail({message:r.error})}else if(ok)ok(r)}).catch(e=>{if(fail)fail(e)})}})}google.script.run=runner();</script>`;
html=html.replace('</head>',mock+'</head>').replace('CASO ACADÉMICO · 33 EQUIPOS / 16 LOCALIDADES','VISTA LOCAL · RUTAS SINTÉTICAS · SIN CONEXIÓN A GOOGLE');
const server=http.createServer(async(req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 if(req.method==='POST'&&req.url==='/rpc'){
  let body='';for await(const part of req){body+=part;if(body.length>1000000){res.writeHead(413);res.end();return;}}
  res.setHeader('Content-Type','application/json');
  try{const {name,args}=JSON.parse(body);if(!Object.hasOwn(api,name))throw new Error('La vista local es de lectura: guardar y exportar a Drive requieren Apps Script.');res.end(JSON.stringify(api[name](...args)));}catch(e){res.end(JSON.stringify({error:e.message}));}return;
 }
 res.end(html);
});
server.listen(4173,'127.0.0.1',()=>console.log('Vista local: http://127.0.0.1:4173 · ingrese cualquier correo y clave de prueba. Ctrl+C para cerrar.'));
