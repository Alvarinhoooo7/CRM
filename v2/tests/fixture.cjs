const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../apps-script');
function fixture() {
  const cache = new Map();
  const ctx = vm.createContext({ console, Date, Math, JSON, Number, Object, Array, String, Set,
    Utilities: {getUuid:()=>crypto.randomUUID(), DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},
      computeDigest:(_,s)=>Array.from(crypto.createHash('sha256').update(s).digest()),
      formatDate:(d,z,f)=> f==='yyyy-MM-dd'?d.toISOString().slice(0,10):d.toISOString().slice(0,10),sleep:()=>{}},
    CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k),removeAll:ks=>ks.forEach(k=>cache.delete(k))})}
  });
  for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.gs')).sort()) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
  const parametros=Object.fromEntries(ctx.listarParametros_().map(x=>[x.definicion.clave,x.definicion.valor]));
  parametros.P_FECHA_INICIO=new Date('2026-09-21T12:00:00-03:00');
  const campos=['localidad','region','direccion','enRM','equipos','hotel','linkCapacitacion','corredor','plazas'];
  // Datos sintéticos de prueba, nunca consultas ni cotizaciones reales.
  const km={BASE:0,Maipu:22,Pudahuel:25,Santiago:12,'Puente Alto':20,'Lo Barnechea':30,Melipilla:70,'San Antonio':110,'La Calera':120,Coquimbo:460,Copiapo:800,Curico:190,Talca:250,'Santa Juana':500,'San Pedro de la Paz':510,Penco:525,Tome:550};
  const destinos=ctx.SIEMBRA_DESTINOS.map(f=>({...Object.fromEntries(campos.map((c,i)=>[c,f[i]])),km:km[f[0]],horas:km[f[0]]/85,pasajeBus:12000,horasBus:4,pasajeAvion:65000,horasAvion:2}));
  const tecnicos=ctx.ESQUEMA_TABLAS.TECNICOS.filas.map(f=>({codigo:f[0],nombre:f[1],licencia:f[2],activo:f[3]}));
  const flota=ctx.ESQUEMA_TABLAS.FLOTA.filas.map(f=>({codigo:f[0],modelo:f[1],patente:f[2],estado:f[3],herramientas:f[4]}));
  const tramos=ctx.SIEMBRA_PLAN.map((f,i)=>({n:f[0],dia:f[1],cuadrilla:f[2],modo:f[3],vehiculo:f[4],desde:f[5],hasta:f[6],noches:f[7],conductor:f[8],tecnicos:f[9],fila:i+3}));
  const rutas={};
  for(const o of destinos)for(const d of destinos){
    const k=o.corredor===d.corredor?Math.abs(o.km-d.km):o.km+d.km;
    rutas[ctx.claveRuta_(o.localidad,d.localidad,false)]={ok:true,km:k,horas:k/85};
    rutas[ctx.claveRuta_(o.localidad,d.localidad,true)]={ok:true,km:k+15,horas:k/85+1};
  }
  const tablas={CHECKLIST:ctx.ESQUEMA_TABLAS.CHECKLIST.filas.map(f=>({orden:f[0],item:f[1],categoria:f[2]})),FERIADOS:[]};
  const datos={parametros,destinos,tecnicos,flota,tramos,rutas,ajustesPeaje:{},tablas,libro:{getSheetByName:()=>null}};
  ctx.leerDatosDelLibro_=()=>datos;
  ctx.resolverRutas_=()=>({rutas,consultas:0,errores:[]});
  ctx.registrarBitacora_=()=>{};
  cache.set('sesion_test','demo@example.test');
  const payload=()=>ctx.limpiarParaJson_(ctx.construirTablero_('LITERAL_PDF'));
  return {ctx,datos,payload,cache,root};
}
module.exports={fixture,root};
