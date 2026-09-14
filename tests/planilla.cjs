/* node tests/planilla.cjs — ejecución del mismo Motor/Pruebas que Apps Script. */
var fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
var contexto=vm.createContext({console:console,Date:Date,Set:Set,Number:Number});
fs.readdirSync(path.join(__dirname,'../apps-script')).filter(function(f){return f.endsWith('.gs');}).sort().forEach(function(f){vm.runInContext(fs.readFileSync(path.join(__dirname,'../apps-script',f),'utf8'),contexto,{filename:f});});
var reporte=contexto.pruebasMotor_();
console.log(JSON.stringify(reporte,null,2));
// Verifica el límite real de escritura del adaptador: campos móviles permanecen intactos.
var columnas=contexto.columnas_('ORDENES'), fila=columnas.map(function(c){return c==='ID_Orden'?'O1':c==='Firma_Cliente'?'firma.png':c==='Observaciones'?'Texto del técnico':c==='Horas_Totales'?1:'';});
contexto.hoja_=function(){return {getRange:function(inicio,columna,cantidad,ancho){assert.equal(inicio,2);assert.equal(cantidad,1);return {setValues:function(valores){for(var i=0;i<ancho;i++)fila[columna-1+i]=valores[0][i];}};}};};
contexto.escribirCampos_('ORDENES',[{ID_Orden:'O1',Horas_Totales:1}],[{ID_Orden:'O1',Horas_Totales:9,Firma_Cliente:'BORRAR',Observaciones:'BORRAR'}],['Horas_Totales']);
assert.equal(fila[columnas.indexOf('Horas_Totales')],9);assert.equal(fila[columnas.indexOf('Firma_Cliente')],'firma.png');assert.equal(fila[columnas.indexOf('Observaciones')],'Texto del técnico');
console.log('OK adaptador: conserva firma y observaciones aunque el resultado incluya valores distintos.');
// Simular no requiere ningún servicio Google y no cambia los datos de entrada.
var datos=contexto.datosSemilla_(),original=JSON.stringify(datos);
var simulacion=contexto.simularConDatos_({destino:'D10',equipos:1,tecnicos:2,fecha:'2026-09-28'},datos);
assert.equal(simulacion.confirmable,true);assert.equal(JSON.stringify(datos),original);
var larga=contexto.simularConDatos_({destino:'D13',equipos:5,tecnicos:2,fecha:'2026-09-28'},datos);
assert.equal(larga.confirmable,true);assert.equal(larga.dias.length,3);assert.equal(larga.noches,2);
assert.throws(function(){contexto.simularConDatos_({destino:'D13',equipos:5,tecnicos:2,fecha:'2026-10-02'},datos);},/fin de semana/);
// Con los kilómetros reales, Copiapó son 10,15 h al volante: AGENDAR no puede resolverlo solo.
assert.throws(function(){contexto.simularConDatos_({destino:'D01',equipos:5,tecnicos:2,fecha:'2026-09-28'},datos);},/escalas intermedias/);
console.log('OK agenda: simulación sin escritura, viaje largo en tres días, fin de semana y traslado con escalas exigen planificación explícita.');
// Captura las fórmulas de producción y comprueba estructura antes de probar en Sheets.
var formulas=[];
contexto.hoja_=function(nombre){return {getRange:function(){return {setFormulas:function(filas){filas.forEach(function(f){f.forEach(function(x){formulas.push({hoja:nombre,formula:x});});});}};}};};
contexto.actualizarFormulas_(datos);
formulas.forEach(function(x){var profundidad=0,comillas=false;for(var i=0;i<x.formula.length;i++){var c=x.formula[i];if(c==='"')comillas=!comillas;else if(!comillas){if(c==='(')profundidad++;if(c===')')profundidad--;assert.ok(profundidad>=0,JSON.stringify(x));}}assert.equal(profundidad,0,JSON.stringify(x));assert.equal(comillas,false,JSON.stringify(x));});
console.log('OK estructura de '+formulas.length+' fórmulas (no sustituye evaluación en Google Sheets).');
