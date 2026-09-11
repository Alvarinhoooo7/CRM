/**
 * ============================================================================
 *  14_Menu.gs  ·  Menu del spreadsheet, dialogos y disparadores automaticos.
 * ============================================================================
 */

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('CRM Servicio Tecnico')
    .addItem('1. Instalar / reparar estructura', 'instalarCRM')
    .addSeparator()
    .addSubMenu(ui.createMenu('2. Planificacion')
      .addItem('Planificar la semana', 'menuPlanificar')
      .addItem('Recalcular KPI', 'menuRecalcular')
      .addItem('Reconstruir calendario', 'menuCalendario')
      .addItem('Limpiar planificacion de la semana', 'menuLimpiar'))
    .addSubMenu(ui.createMenu('3. Analisis')
      .addItem('Comparar modos de transporte...', 'menuCompararTransporte')
      .addItem('Verificar factibilidad de asignacion...', 'menuFactibilidad')
      .addItem('Ficha de desempeno de un tecnico...', 'menuFichaTecnico')
      .addItem('Analisis de rentabilidad', 'menuRentabilidad')
      .addItem('Resumen de tesoreria (viaticos)', 'menuTesoreria'))
    .addSubMenu(ui.createMenu('4. Datos externos')
      .addItem('Actualizar distancias con Google Maps', 'menuRecalcularMatriz')
      .addItem('Actualizar precios de combustible (CNE)', 'menuPreciosCombustible')
      .addItem('Geocodificar destinos faltantes', 'geocodificarDestinosFaltantes'))
    .addSubMenu(ui.createMenu('5. Operacion')
      .addItem('Marcar viaticos como transferidos', 'menuMarcarTransferidos')
      .addItem('Enviar videos de capacitacion', 'menuEnviarCapacitaciones')
      .addItem('Abrir panel de control', 'menuAbrirDashboard')
      .addItem('Copiar URL de la web app', 'menuUrlWebApp'))
    .addSeparator()
    .addSubMenu(ui.createMenu('Avanzado')
      .addItem('Instalar disparadores automaticos', 'instalarTriggers')
      .addItem('Eliminar disparadores', 'eliminarTriggers')
      .addItem('Reinstalar desde cero (borra todo)', 'reinstalarDesdeCero'))
    .addToUi();
}

function _ui() { return SpreadsheetApp.getUi(); }
function _alerta(titulo, cuerpo) {
  var html = HtmlService.createHtmlOutput(
    '<div style="font:13px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;padding:4px 8px;white-space:pre-wrap">' +
    String(cuerpo).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</div>'
  ).setWidth(680).setHeight(520);
  _ui().showModalDialog(html, titulo);
}

function menuPlanificar() {
  var semana = cfg('SEMANA_PLANIFICACION') || semanaISO(new Date());
  var r = _ui().alert('Planificar semana ' + semana,
    'Se reemplazara la planificacion existente de esa semana (OT, itinerario, cuadrillas, viaticos).\n\nContinuar?',
    _ui().ButtonSet.YES_NO);
  if (r !== _ui().Button.YES) return;

  var res = planificarSemana(semana);
  var texto =
    'PLANIFICACION COMPLETADA  ·  semana ' + res.semana + '\n' +
    '------------------------------------------------------------\n' +
    'Cuadrillas despachadas : ' + res.misionesPlanificadas + '\n' +
    'Ordenes de trabajo     : ' + res.ot + '\n' +
    'Equipos a instalar     : ' + res.equipos + '\n' +
    'Tramos de viaje        : ' + res.tramos + '\n' +
    'Tiempo de calculo      : ' + res.segundos + ' s\n';
  if (res.misionesRechazadas) {
    texto += '\nNO PLANIFICADO (' + res.misionesRechazadas + '):\n' +
             res.detalleRechazos.map(function (m) { return '  - ' + m; }).join('\n');
  }
  var t = resumenTesoreria(res.semana);
  texto += '\n\nTESORERIA\n' +
           '  Total a transferir a los tecnicos: ' + clp(t.totalTransferir) + '\n' +
           '  Alojamiento ' + clp(t.totalAlojamiento) + ' | Viaticos ' + clp(t.totalViaticos) +
           ' | Fondos a rendir ' + clp(t.totalFondos) + '\n';
  _alerta('Planificacion', texto);
}

function menuRecalcular() {
  var r = recalcularKPIs();
  _ui().alert('KPI recalculados: ' + r.tecnicos + ' tecnicos, ' + r.indicadores + ' indicadores, ' + r.destinos + ' destinos.');
}

function menuCalendario() {
  var n = construirCalendario();
  _ui().alert('Calendario reconstruido: ' + n + ' bloques.');
}

function menuLimpiar() {
  var semana = cfg('SEMANA_PLANIFICACION');
  var r = _ui().alert('Limpiar planificacion', 'Se borrara la planificacion de ' + semana + '. Los datos maestros y los gastos ya rendidos se conservan.\n\nContinuar?', _ui().ButtonSet.YES_NO);
  if (r !== _ui().Button.YES) return;
  _ui().alert(limpiarPlanificacion(semana));
}

function menuCompararTransporte() {
  var destinos = dbLeer(SH.DESTINOS).filter(function (d) { return d.DESTINO_ID !== BASE_ID; });
  var lista = destinos.map(function (d) { return d.DESTINO_ID + ' = ' + d.COMUNA + ' (' + d.KM_DESDE_BASE + ' km)'; }).join('\n');

  var r1 = _ui().prompt('Comparar transporte', 'Destino:\n\n' + lista + '\n\nIngrese el ID (ej: D01):', _ui().ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== _ui().Button.OK) return;
  var destinoId = r1.getResponseText().trim().toUpperCase();

  var r2 = _ui().prompt('Comparar transporte', 'Cuantos tecnicos viajan?', _ui().ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== _ui().Button.OK) return;
  var n = Number(r2.getResponseText()) || 1;

  var req = dbUno(SH.REQUERIMIENTOS, { DESTINO_ID: destinoId });
  var equipos = req ? Number(req.EQUIPOS) : 1;

  _alerta('Comparador de transporte', compararTransporteDestino(destinoId, n, equipos, 1));
}

function menuFactibilidad() {
  var r1 = _ui().prompt('Factibilidad', 'ID del tecnico (ej: T01):', _ui().ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== _ui().Button.OK) return;
  var r2 = _ui().prompt('Factibilidad', 'ID del destino (ej: D12):', _ui().ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== _ui().Button.OK) return;
  var r3 = _ui().prompt('Factibilidad', 'Fecha y hora (formato 2026-09-14 10:00):', _ui().ButtonSet.OK_CANCEL);
  if (r3.getSelectedButton() !== _ui().Button.OK) return;

  var f = verificarFactibilidad(r1.getResponseText().trim().toUpperCase(),
                                r2.getResponseText().trim().toUpperCase(),
                                r3.getResponseText().trim().replace(' ', 'T'));
  var texto =
    (f.factible ? 'ASIGNACION FACTIBLE' : 'ASIGNACION NO FACTIBLE') + '\n' +
    '------------------------------------------------------------\n' +
    f.motivo + '\n\n' +
    'Ubicacion previa      : ' + f.ubicacionPrevia + '\n' +
    'Traslado necesario    : ' + f.kmTraslado + ' km, ' + horasLegibles(f.minutosTraslado / 60) + '\n' +
    'Primera hora factible : ' + ddmmyyyy(f.primeraHoraFactible) + ' ' + hhmm(f.primeraHoraFactible) + '\n' +
    'Horas en la semana    : ' + horasLegibles(f.horasSemana) + ' (holgura ' + horasLegibles(f.holguraSemanal) + ')';
  _alerta('Verificacion de factibilidad', texto);
}

function menuFichaTecnico() {
  var tecnicos = dbLeer(SH.TECNICOS);
  var lista = tecnicos.map(function (t) { return t.TECNICO_ID + ' = ' + t.NOMBRE; }).join('\n');
  var r = _ui().prompt('Ficha de desempeno', lista + '\n\nIngrese el ID:', _ui().ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== _ui().Button.OK) return;

  var f = fichaTecnico(r.getResponseText().trim().toUpperCase());
  if (!f) { _ui().alert('Tecnico no encontrado.'); return; }
  if (f.sinDatos) { _ui().alert('Sin datos para ' + f.nombre + ' en la semana ' + f.semana + '.'); return; }

  var texto =
    'FICHA DE DESEMPENO  ·  ' + f.nombre + '  ·  ' + f.semana + '\n' +
    '============================================================\n' +
    f.cargo + '  |  ' + f.especialidad + '\n\n' +
    f.argumentos.map(function (a) { return '- ' + a; }).join('\n') + '\n\n' +
    'RECOMENDACION\n' + f.recomendacion;
  _alerta('Ficha de desempeno', texto);
}

function menuRentabilidad() {
  var a = analisisRentabilidad();
  if (a.sinDatos) { _ui().alert('Sin datos de rentabilidad. Planifique la semana primero.'); return; }
  var texto =
    'ANALISIS DE RENTABILIDAD  ·  ' + a.semana + '\n' +
    '============================================================\n' +
    a.conclusiones.map(function (c) { return '- ' + c; }).join('\n\n') + '\n\n' +
    'DETALLE POR LOCALIDAD\n' +
    '------------------------------------------------------------\n' +
    a.destinos.map(function (d) {
      return d.COMUNA + '  (' + d.EQUIPOS + ' eq)\n' +
             '   Ingreso ' + clp(d.INGRESO_CLP) + ' | Costo ' + clp(d.COSTO_TOTAL) +
             ' | Margen ' + clp(d.MARGEN_CLP) + ' (' + redondear(Number(d.MARGEN_PCT) * 100, 1) + '%)\n' +
             '   ' + d.VEREDICTO;
    }).join('\n\n');
  _alerta('Rentabilidad', texto);
}

function menuTesoreria() {
  var t = resumenTesoreria();
  var texto =
    'TRANSFERENCIAS DE VIATICOS  ·  ' + t.semana + '\n' +
    '============================================================\n' +
    'TOTAL A TRANSFERIR: ' + clp(t.totalTransferir) + '\n\n' +
    'Alojamiento     ' + clp(t.totalAlojamiento) + '\n' +
    'Viaticos        ' + clp(t.totalViaticos) + '\n' +
    'Pasajes         ' + clp(t.totalPasajes) + '\n' +
    'Fondos a rendir ' + clp(t.totalFondos) + '\n\n' +
    'DETALLE POR TECNICO\n' +
    '------------------------------------------------------------\n' +
    t.tecnicos.map(function (x) {
      return x.nombre + '  (' + x.cuadrilla + ')\n' +
             '   ' + x.dias + ' dia(s), ' + x.noches + ' noche(s)  ->  TRANSFERIR ' + clp(x.total) + '\n' +
             '   Alojamiento ' + clp(x.alojamiento) + ' | Viatico ' + clp(x.viatico) +
             ' | Fondo a rendir ' + clp(x.fondoRendir);
    }).join('\n\n');
  _alerta('Tesoreria', texto);
}

function menuRecalcularMatriz() {
  var r = _ui().alert('Actualizar distancias',
    'Se consultara Google Maps para recalcular la matriz completa. Puede tardar varios minutos y consume cuota de API.\n\nContinuar?',
    _ui().ButtonSet.YES_NO);
  if (r !== _ui().Button.YES) return;
  _ui().alert(recalcularMatrizConMaps());
}

function menuPreciosCombustible() { _ui().alert(actualizarPreciosCombustible()); }
function menuMarcarTransferidos() {
  var n = marcarViaticosTransferidos();
  _ui().alert(n + ' viatico(s) marcados como transferidos.');
}
function menuEnviarCapacitaciones() { _ui().alert(enviarCapacitacionesPendientes()); }

function menuAbrirDashboard() {
  var url = urlWebApp();
  if (!url) {
    _ui().alert('La web app aun no esta publicada.\n\nVaya a Implementar > Nueva implementacion > Aplicacion web.');
    return;
  }
  var html = HtmlService.createHtmlOutput(
    '<div style="font:14px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;padding:16px">' +
    '<p>Panel de control:</p>' +
    '<p><a href="' + url + '" target="_blank" style="font-size:15px">' + url + '</a></p>' +
    '<p style="margin-top:18px">Vista del tecnico:</p>' +
    '<p><a href="' + url + '?accion=tecnico" target="_blank">' + url + '?accion=tecnico</a></p>' +
    '</div>').setWidth(560).setHeight(260);
  _ui().showModalDialog(html, 'Web App');
}

function menuUrlWebApp() {
  var url = urlWebApp() || '(no publicada)';
  _alerta('URL de la web app',
    'Panel de control:\n' + url + '\n\n' +
    'Vista del tecnico:\n' + url + '?accion=tecnico\n\n' +
    'Endpoint REST para AppSheet:\n' + url + '?accion=panel&tecnicoId=T01&token=' + cfg('WEBHOOK_SECRET'));
}
