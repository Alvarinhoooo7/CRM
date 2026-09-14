/* Pruebas de integración del adaptador sin Google. No evalúa fórmulas Sheets. */
var fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
var hojas={},rangos={},propiedades={},mensajes=[];
function encadenable(){return new Proxy({}, {get:function(o,k){if(k==='build')return function(){return {};};return function(){return encadenable();};}});}
function Rango(h,f,c,n,m){this.h=h;this.f=f;this.c=c;this.n=n||1;this.m=m||1;}
Rango.prototype.getValues=function(){var r=[];for(var i=0;i<this.n;i++){var fila=[];for(var j=0;j<this.m;j++)fila.push((this.h.datos[this.f-1+i]||[])[this.c-1+j]??'');r.push(fila);}return r;};
Rango.prototype.setValues=function(filas){assert.equal(filas.length,this.n);var self=this;filas.forEach(function(f,i){assert.equal(f.length,self.m);for(var j=0;j<self.m;j++){var r=self.h.datos[self.f-1+i]||(self.h.datos[self.f-1+i]=[]);r[self.c-1+j]=f[j];}});return this;};
Rango.prototype.setFormulas=Rango.prototype.setValues;
Rango.prototype.getDisplayValues=function(){return this.getValues().map(function(f){return f.map(String);});};
Rango.prototype.getRow=function(){return this.f;};Rango.prototype.getColumn=function(){return this.c;};Rango.prototype.getNumRows=function(){return this.n;};Rango.prototype.getNumColumns=function(){return this.m;};Rango.prototype.getSheet=function(){return this.h;};Rango.prototype.getMergedRanges=function(){return [];};
['setFontWeight','setBackground','setFontColor','setNumberFormat','setDataValidation','setBorder','setWrap'].forEach(function(k){Rango.prototype[k]=function(){return this;};});
Rango.prototype.protect=function(){var p=new Proteccion();this.h.protecciones.push(p);return p;};Rango.prototype.createFilter=function(){this.h.filtro=true;return this;};
function Proteccion(){}Proteccion.prototype.getDescription=function(){return this.descripcion;};Proteccion.prototype.setDescription=function(d){this.descripcion=d;return this;};Proteccion.prototype.getEditors=function(){return [];};Proteccion.prototype.canDomainEdit=function(){return false;};['setWarningOnly','addEditor','removeEditor','setDomainEdit'].forEach(function(k){Proteccion.prototype[k]=function(){return this;};});
function Hoja(nombre){this.nombre=nombre;this.datos=[];this.filas=1000;this.columnas=26;this.protecciones=[];this.graficos=[];}
Hoja.prototype.getName=function(){return this.nombre;};Hoja.prototype.getLastRow=function(){var n=this.datos.length;while(n&&!(this.datos[n-1]||[]).some(function(v){return v!==''&&v!==undefined;}))n--;return n;};Hoja.prototype.getLastColumn=function(){return Math.max(1,...this.datos.map(function(f){return f.length;}));};Hoja.prototype.getMaxRows=function(){return this.filas;};Hoja.prototype.getMaxColumns=function(){return this.columnas;};
Hoja.prototype.getRange=function(f,c,n,m){if(typeof f==='string'){var match=f.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d*)?)?$/);assert.ok(match,f);function col(s){return s.split('').reduce(function(a,c){return a*26+c.charCodeAt(0)-64;},0);}var ini=Number(match[2]);return new Rango(this,ini,col(match[1]),match[3]?(match[4]?Number(match[4]):this.filas)-ini+1:1,match[3]?col(match[3])-col(match[1])+1:1);}return new Rango(this,f,c,n,m);};
Hoja.prototype.getDataRange=function(){return this.getRange(1,1,Math.max(1,this.getLastRow()),this.getLastColumn());};Hoja.prototype.getFilter=function(){return this.filtro;};Hoja.prototype.getProtections=function(){return this.protecciones;};Hoja.prototype.insertRowsAfter=function(i,n){this.filas+=n;};Hoja.prototype.insertColumnsAfter=function(i,n){this.columnas+=n;};Hoja.prototype.clearContents=function(){this.datos=[];return this;};Hoja.prototype.getCharts=function(){return this.graficos.slice();};Hoja.prototype.removeChart=function(c){this.graficos=this.graficos.filter(function(x){return x!==c;});};Hoja.prototype.insertChart=function(c){this.graficos.push(c);};Hoja.prototype.newChart=encadenable;
['setFrozenRows','setColumnWidths','setColumnWidth','setConditionalFormatRules','setActiveRange'].forEach(function(k){Hoja.prototype[k]=function(){return this;};});
var libro={getSheetByName:function(n){return hojas[n];},insertSheet:function(n){return hojas[n]=new Hoja(n);},getId:function(){return 'LIBRO_PRUEBA';},setSpreadsheetLocale:function(){},setSpreadsheetTimeZone:function(){},getNamedRanges:function(){return Object.keys(rangos).map(function(n){return {getName:function(){return n;},getRange:function(){return rangos[n];}};});},setNamedRange:function(n,r){rangos[n]=r;},toast:function(s){mensajes.push(s);}};
var ui={ButtonSet:{YES_NO:'YES_NO'},Button:{YES:'YES'},alert:function(){return 'YES';}};
var contexto=vm.createContext({console:console,Date:Date,Set:Set,Number:Number,SpreadsheetApp:{getActiveSpreadsheet:function(){return libro;},getUi:function(){return ui;},newDataValidation:encadenable,newConditionalFormatRule:encadenable,ProtectionType:{RANGE:'RANGE'},flush:function(){}},Session:{getEffectiveUser:function(){return {getEmail:function(){return 'dueno@example.com';}};}},PropertiesService:{getScriptProperties:function(){return {getProperty:function(k){return propiedades[k];},setProperty:function(k,v){propiedades[k]=v;},getProperties:function(){return propiedades;}};}},LockService:{getScriptLock:function(){return {tryLock:function(){return true;},releaseLock:function(){}};}},Charts:{ChartType:{PIE:'PIE',BAR:'BAR',COLUMN:'COLUMN'}}});
fs.readdirSync(path.join(__dirname,'../apps-script')).filter(function(f){return f.endsWith('.gs');}).forEach(function(f){vm.runInContext(fs.readFileSync(path.join(__dirname,'../apps-script',f),'utf8'),contexto,{filename:f});});
contexto.crearHojasBase();assert.equal(Object.keys(hojas).length,15);
// Solo sustituimos lectura de resultados de CONFIG: el doble no calcula fórmulas.
contexto.parametros_=function(){return contexto.datosSemilla_().parametros;};
contexto.cargarDatosEjemplo();
assert.equal(contexto.leerTabla_('ORDENES').length,30);assert.equal(contexto.leerTabla_('CHECKLIST').length,510);assert.equal(hojas.TABLERO.graficos.length,4);
var cols=contexto.columnas_('ORDENES');hojas.ORDENES.datos[1][cols.indexOf('Firma_Cliente')]='firma-real.png';hojas.ORDENES.datos[1][cols.indexOf('Checklist_Completo')]=true;
hojas.CHECKLIST.datos[1][contexto.columnas_('CHECKLIST').indexOf('Marcado')]=true;
var tx=contexto.columnas_('TRANSFERENCIAS');hojas.TRANSFERENCIAS.datos[1][tx.indexOf('Estado')]='Transferido';hojas.TRANSFERENCIAS.datos[1][tx.indexOf('Monto_Transferido')]=123456;
contexto.crearHojasBase();contexto.recalcularPlan();contexto.regenerarChecklist();
assert.equal(contexto.leerTabla_('ORDENES').length,30);assert.equal(contexto.leerTabla_('CHECKLIST').length,510);assert.equal(hojas.ORDENES.datos[1][cols.indexOf('Firma_Cliente')],'firma-real.png');assert.equal(hojas.ORDENES.datos[1][cols.indexOf('Checklist_Completo')],true);assert.equal(hojas.CHECKLIST.datos[1][contexto.columnas_('CHECKLIST').indexOf('Marcado')],true);assert.equal(hojas.TRANSFERENCIAS.datos[1][tx.indexOf('Estado')],'Transferido');assert.equal(hojas.TRANSFERENCIAS.datos[1][tx.indexOf('Monto_Transferido')],123456);assert.equal(hojas.TABLERO.graficos.length,4);
assert.throws(function(){contexto.cargarDatosEjemplo();},/contiene datos/);
console.log('OK integración: instalación repetida, recálculo y checklist conservan firmas, hitos, marcas y pagos; gráficos no se duplican; semilla rechaza sobreescritura.');
// Confirmación idéntica debe retornar las mismas órdenes, sin duplicar aun después de error parcial.
var entrada={destino:'D13',equipos:5,tecnicos:2,fecha:'2026-09-28',solicitud:'prueba-idempotencia-0001'};entrada.propuesta=contexto.simularTrabajoNuevo(entrada);
var visitasHoja=hojas.VISITAS, originalRange=visitasHoja.getRange,fallar=true;
visitasHoja.getRange=function(){var rango=originalRange.apply(this,arguments),set=rango.setValues;rango.setValues=function(f){if(fallar){fallar=false;throw new Error('Fallo simulado al escribir visitas');}return set.call(this,f);};return rango;};
assert.throws(function(){contexto.confirmarTrabajoNuevo(entrada);},/Fallo simulado/);
var confirmado=contexto.confirmarTrabajoNuevo(entrada),reintento=contexto.confirmarTrabajoNuevo(entrada);
assert.equal(confirmado.ordenes.length,6);assert.equal(JSON.stringify(confirmado),JSON.stringify(reintento));assert.equal(contexto.leerTabla_('ORDENES').length,36);
assert.equal(contexto.leerTabla_('CHECKLIST').length,612);
console.log('OK recuperación agenda: fallo entre órdenes y visitas se completa sin duplicar; reintento conserva seis IDs originales.');
var formulas=0;
Object.keys(hojas).forEach(function(n){hojas[n].datos.forEach(function(f,i){f.forEach(function(v,j){if(typeof v!=='string'||v[0]!=='=')return;formulas++;var nivel=0,cita=false;for(var k=0;k<v.length;k++){if(v[k]==='"')cita=!cita;else if(!cita){if(v[k]==='(')nivel++;if(v[k]===')')nivel--;assert.ok(nivel>=0,n+' '+(i+1)+','+(j+1)+' '+v);}}assert.equal(nivel,0,n+' '+v);assert.equal(cita,false,n+' '+v);});});});
console.log('OK estructura de las '+formulas+' fórmulas escritas en todas las hojas (evaluación numérica pendiente en Google).');
