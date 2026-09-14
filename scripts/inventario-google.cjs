/* Inventario y respaldo remoto con la sesión local de clasp. Nunca imprime tokens.
 * node scripts/inventario-google.cjs [inventario|respaldo]
 * Salida privada en .local-backup/migracion-20260914/google.json.
 */
var fs=require('fs'),path=require('path'),os=require('os');
async function principal(){
  var ruta=path.resolve(__dirname,'../.local-backup/migracion-20260914');
  var config=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../apps-script/.clasp.json'),'utf8'));
  var auth=JSON.parse(fs.readFileSync(path.join(os.homedir(),'.clasprc.json'),'utf8'));
  var cred=auth.tokens ? auth.tokens.default : auth;
  if(!cred||!cred.refresh_token) throw new Error('No se encontró sesión clasp compatible');
  var refresco=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:cred.client_id||auth.clientId,client_secret:cred.client_secret||auth.clientSecret,refresh_token:cred.refresh_token,grant_type:'refresh_token'})});
  var sesion=await refresco.json(); if(!sesion.access_token) throw new Error('No se pudo renovar la sesión: '+(sesion.error||refresco.status));
  async function api(url,opciones){
    var respuesta=await fetch(url,Object.assign({},opciones,{headers:Object.assign({'Authorization':'Bearer '+sesion.access_token,'Content-Type':'application/json'},opciones&&opciones.headers)}));
    var cuerpo=await respuesta.json(); if(!respuesta.ok) throw new Error('Google '+respuesta.status+': '+(cuerpo.error&&cuerpo.error.message||'Error API')); return cuerpo;
  }
  var proyecto=await api('https://script.googleapis.com/v1/projects/'+encodeURIComponent(config.scriptId));
  var reporte={fecha:new Date().toISOString(),proyecto:proyecto};
  fs.mkdirSync(ruta,{recursive:true});
  fs.writeFileSync(path.join(ruta,'google.json'),JSON.stringify(reporte,null,2));
  console.log('Proyecto identificado: '+proyecto.title+'. Vinculado a contenedor: '+Boolean(proyecto.parentId));
  if(!proyecto.parentId) throw new Error('Proyecto sin parentId; identificar spreadsheet antes de migrar');
  if(process.argv[2]==='respaldo') {
    reporte.archivo=await api('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(proyecto.parentId)+'?fields=id,name,mimeType,webViewLink');
    reporte.copia=await api('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(proyecto.parentId)+'/copy?fields=id,name,webViewLink',{method:'POST',body:JSON.stringify({name:reporte.archivo.name+' RESPALDO '+new Date().toISOString().replace(/[:.]/g,'-')})});
    fs.writeFileSync(path.join(ruta,'google.json'),JSON.stringify(reporte,null,2));
    console.log('Copia del libro creada en Drive: '+reporte.copia.name);
  }
  try {
    reporte.libro=await api('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(proyecto.parentId)+'?includeGridData=false');
    console.log('Libro: '+reporte.libro.properties.title+'. Hojas: '+reporte.libro.sheets.map(function(h){return h.properties.title;}).join(', '));
    if(process.argv[2]==='respaldo') {
      var nombres=reporte.libro.sheets.map(function(h){return "'"+h.properties.title.replace(/'/g,"''")+"'";});
      reporte.valores=await api('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(proyecto.parentId)+'/values:batchGet?valueRenderOption=FORMULA&'+nombres.map(function(n){return 'ranges='+encodeURIComponent(n);}).join('&'));
      console.log('Respaldo creado en Drive y datos exportados localmente.');
    }
  } finally {fs.writeFileSync(path.join(ruta,'google.json'),JSON.stringify(reporte,null,2));}
}
principal().catch(function(e){console.error(e.message);process.exitCode=1;});
