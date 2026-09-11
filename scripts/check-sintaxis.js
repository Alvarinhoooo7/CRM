#!/usr/bin/env node
/**
 * Valida la sintaxis de los archivos .gs tratandolos como JavaScript.
 * No ejecuta nada: vm.Script solo compila. Los servicios de Google
 * (SpreadsheetApp, Maps, MailApp, UrlFetchApp) no se resuelven aqui.
 *
 *   node scripts/check-sintaxis.js
 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var dir = path.join(__dirname, '..', 'apps-script');
var archivos = fs.readdirSync(dir).filter(function (f) { return f.endsWith('.gs'); }).sort();
var fallos = 0;

archivos.forEach(function (f) {
  var ruta = path.join(dir, f);
  try {
    new vm.Script(fs.readFileSync(ruta, 'utf8'), { filename: ruta });
  } catch (e) {
    fallos++;
    console.error('FALLO ' + f + ' -> ' + e.message);
  }
});

if (fallos) {
  console.error(fallos + ' archivo(s) con errores de sintaxis de ' + archivos.length);
  process.exit(1);
}
console.log(archivos.length + '/' + archivos.length + ' archivos .gs sintacticamente validos');
