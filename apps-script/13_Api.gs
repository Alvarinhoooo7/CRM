/**
 * ============================================================================
 *  13_Api.gs  ·  Web app, endpoint REST e integraciones externas.
 * ============================================================================
 *  doGet  -> sirve el dashboard HTML y responde consultas JSON.
 *  doPost -> recibe eventos desde AppSheet (check-in, gastos, cierre de OT).
 *
 *  Seguridad: toda llamada JSON exige el parametro ?token= que debe coincidir
 *  con WEBHOOK_SECRET de la hoja CONFIG. La vista HTML requiere inicio de
 *  sesion de Google; las operaciones de escritura solo se exponen por POST
 *  autenticado, no mediante google.script.run.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
//  Enrutamiento
// ---------------------------------------------------------------------------
function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};

  // Sin accion: se sirve el dashboard.
  if (!p.accion) return _servirHtml('Index', 'Panel de Control - ' + APP.NOMBRE, p);
  if (p.accion === 'tecnico') return _servirHtml('Tecnico', 'Mi Ruta - ' + APP.NOMBRE, p);

  if (!_tokenValido(p.token)) return _json({ ok: false, error: 'Token invalido.' }, 401);

  try {
    var datos = _despachar(p.accion, p);
    return _json({ ok: true, accion: p.accion, datos: datos });
  } catch (err) {
    log('ERROR', 'Api', p.accion + ': ' + err.message);
    return _json({ ok: false, error: err.message, accion: p.accion }, 500);
  }
}

function doPost(e) {
  var cuerpo = {};
  try {
    cuerpo = (e && e.postData && e.postData.contents) ? JSON.parse(e.postData.contents) : {};
  } catch (err) {
    return _json({ ok: false, error: 'JSON invalido.' }, 400);
  }
  var token = cuerpo.token || (e && e.parameter ? e.parameter.token : '');
  if (!_tokenValido(token)) return _json({ ok: false, error: 'Token invalido.' }, 401);

  try {
    var datos = _despacharEscritura(cuerpo.accion, cuerpo);
    return _json({ ok: true, accion: cuerpo.accion, datos: datos });
  } catch (err) {
    log('ERROR', 'Api', 'POST ' + cuerpo.accion + ': ' + err.message);
    return _json({ ok: false, error: err.message }, 500);
  }
}

function _despachar(accion, p) {
  switch (accion) {
    case 'dashboard':       return datosDashboard(p.semana);
    case 'calendario':      return calendarioGrupo(p.semana);
    case 'agenda':          return agendaTecnico(p.tecnicoId, p.semana);
    case 'panel':           return panelTecnico(p.tecnicoId);
    case 'tecnicos':        return dbLeer(SH.TECNICOS).filter(function (t) { return esSi(t.ACTIVO); });
    case 'destinos':        return dbLeer(SH.DESTINOS);
    case 'ot':              return p.tecnicoId ? dbBuscar(SH.OT, { TECNICO_ID: p.tecnicoId }) : dbLeer(SH.OT);
    case 'itinerario':      return dbLeer(SH.ITINERARIO);
    case 'cuadrillas':      return dbLeer(SH.CUADRILLAS);
    case 'gastos':          return p.tecnicoId ? dbBuscar(SH.GASTOS, { TECNICO_ID: p.tecnicoId }) : dbLeer(SH.GASTOS);
    case 'viaticos':        return dbBuscar(SH.VIATICOS, { SEMANA: p.semana || cfg('SEMANA_PLANIFICACION') });
    case 'tesoreria':       return resumenTesoreria(p.semana);
    case 'ficha':           return fichaTecnico(p.tecnicoId, p.semana);
    case 'rentabilidad':    return analisisRentabilidad(p.semana, p.destinoId);
    case 'factibilidad':    return verificarFactibilidad(p.tecnicoId, p.destinoId, p.fechaHora);
    case 'sugerirTecnico':  return sugerirTecnico(p.destinoId, p.fechaHora);
    case 'siguiente':       return sugerirSiguienteServicio(p.tecnicoId, p.destinoId, p.desde);
    case 'transporte':      return evaluarModosTransporte({
                              destinoId: p.destinoId,
                              nTecnicos: Number(p.nTecnicos) || 1,
                              equipos: Number(p.equipos) || 1,
                              diasEnDestino: Number(p.dias) || 1
                            });
    case 'checklist':       return checklistCarga(p.cuadrillaId);
    case 'config':          return _configPublica();
    case 'ping':            return { version: APP.VERSION, hora: new Date(), semana: cfg('SEMANA_PLANIFICACION') };
    default: throw new Error('Accion desconocida: ' + accion);
  }
}

function _despacharEscritura(accion, c) {
  switch (accion) {
    case 'iniciarJornada':  return iniciarJornada(c.tecnicoId, c.lat, c.lng);
    case 'finalizarJornada':return finalizarJornada(c.tecnicoId, c.lat, c.lng);
    case 'marcar':          return marcar(c.tipo, c.tecnicoId, c);
    case 'iniciarOT':       return iniciarOT(c.otId, c.tecnicoId, c.lat, c.lng);
    case 'finalizarOT':     return finalizarOT(c);
    case 'registrarGasto':  return registrarGasto(c);
    case 'asignar':         return asignarServicioEnCaliente(c.reqId, c.tecnicoId, c.fechaHora);
    case 'reprogramar':     return reprogramarOT(c.otId, c.fechaHora, c.tecnicoId);
    case 'planificar':      return planificarSemana(c.semana);
    case 'recalcular':      return recalcularKPIs(c.semana);
    case 'aprobarGasto':    return _aprobarGasto(c.gastoId, c.aprobado, c.comentario);
    case 'setConfig':       return setCfg(c.clave, c.valor);
    default: throw new Error('Accion de escritura desconocida: ' + accion);
  }
}

function _aprobarGasto(gastoId, aprobado, comentario) {
  var usuario = '';
  try { usuario = Session.getActiveUser().getEmail(); } catch (e) { usuario = 'sistema'; }
  dbActualizar(SH.GASTOS, 'GASTO_ID', gastoId, {
    ESTADO: aprobado ? 'APROBADO' : 'RECHAZADO',
    APROBADO_POR: usuario,
    COMENTARIO: comentario || ''
  });
  return { gastoId: gastoId, estado: aprobado ? 'APROBADO' : 'RECHAZADO' };
}

function _tokenValido(token) {
  var esperado = String(cfg('WEBHOOK_SECRET', '')).trim();
  return esperado && String(token || '').trim() === esperado;
}

function _json(obj, codigo) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _servirHtml(archivo, titulo, parametros) {
  var plantilla = HtmlService.createTemplateFromFile(archivo);
  plantilla.tecnicoInicial = parametros && parametros.tecnicoId ? String(parametros.tecnicoId) : '';
  return plantilla
    .evaluate()
    .setTitle(titulo)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Permite incluir CSS/JS parciales desde las plantillas HTML. */
function include(archivo) {
  return HtmlService.createHtmlOutputFromFile(archivo).getContent();
}

/** Subconjunto de CONFIG seguro para exponer al front. */
function _configPublica() {
  var publica = {};
  CONFIG_DEFAULTS.forEach(function (d) {
    if (d[2] === 'secret') return;
    publica[d[0]] = cfg(d[0]);
  });
  publica.BASE_NOMBRE = APP.BASE_NOMBRE;
  publica.VERSION = APP.VERSION;
  return publica;
}

/** URL publicada de la web app, para compartir con los tecnicos. */
function urlWebApp() {
  try { return ScriptApp.getService().getUrl(); } catch (e) { return ''; }
}

// ---------------------------------------------------------------------------
//  Funciones invocadas directamente por el front (google.script.run)
// ---------------------------------------------------------------------------
function apiDashboard(semana) { return datosDashboard(semana); }
function apiCalendario(semana) { return calendarioGrupo(semana); }
function apiPanelTecnico(tecnicoId) { return panelTecnico(tecnicoId); }
function apiAgenda(tecnicoId, semana) { return agendaTecnico(tecnicoId, semana); }
function apiFicha(tecnicoId, semana) { return fichaTecnico(tecnicoId, semana); }
function apiRentabilidad(semana) { return analisisRentabilidad(semana); }
function apiTesoreria(semana) { return resumenTesoreria(semana); }
function apiTecnicos() {
  return dbLeer(SH.TECNICOS).filter(function (t) { return esSi(t.ACTIVO); })
    .map(function (t) { return { id: t.TECNICO_ID, nombre: t.NOMBRE, cargo: t.CARGO }; });
}
function apiDestinos() {
  return dbLeer(SH.DESTINOS).map(function (d) {
    return { id: d.DESTINO_ID, comuna: d.COMUNA, region: d.REGION, km: Number(d.KM_DESDE_BASE), zona: d.ZONA };
  });
}
function apiComparadorTransporte(destinoId, nTecnicos, equipos, dias) {
  return evaluarModosTransporte({
    destinoId: destinoId,
    nTecnicos: Number(nTecnicos) || 1,
    equipos: Number(equipos) || 1,
    diasEnDestino: Number(dias) || 1
  });
}
function apiFactibilidad(tecnicoId, destinoId, fechaHora) {
  return verificarFactibilidad(tecnicoId, destinoId, fechaHora);
}
function apiSugerirTecnico(destinoId, fechaHora) { return sugerirTecnico(destinoId, fechaHora); }
function apiSemanaActual() { return cfg('SEMANA_PLANIFICACION') || semanaISO(new Date()); }

// ---------------------------------------------------------------------------
//  API Comision Nacional de Energia: precios reales de combustible
// ---------------------------------------------------------------------------
/**
 * Actualiza PRECIOS_COMBUSTIBLE y el precio de referencia de CONFIG con datos
 * de la API publica de la CNE (bencineras de Chile).
 * Documentacion: https://api.cne.cl/v4/combustibles/vehicular/estaciones
 */
function actualizarPreciosCombustible() {
  var token = String(cfg('CNE_API_TOKEN', '')).trim();
  if (!token) return 'Sin CNE_API_TOKEN configurado. Se mantienen los precios manuales de CONFIG.';

  try {
    var url = 'https://api.cne.cl/api/listaInformacionEstacion?token=' + encodeURIComponent(token);
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) {
      return 'API CNE respondio HTTP ' + resp.getResponseCode() + '. Se mantienen los precios manuales.';
    }
    var data = JSON.parse(resp.getContentText());
    var estaciones = data.data || data;
    if (!estaciones || !estaciones.length) return 'La API CNE no devolvio estaciones.';

    var filas = [];
    var sumaDiesel = 0, nDiesel = 0;
    var ahora = new Date();

    estaciones.slice(0, 500).forEach(function (est) {
      var precios = est.precios || {};
      var diesel = Number(precios.die || precios.diesel || 0);
      var g93 = Number(precios.g93 || 0);
      var g95 = Number(precios.g95 || 0);
      if (diesel > 0) { sumaDiesel += diesel; nDiesel++; }
      filas.push({
        REGION: (est.ubicacion && est.ubicacion.nombre_region) || est.region || '',
        COMUNA: (est.ubicacion && est.ubicacion.nombre_comuna) || est.comuna || '',
        DISTRIBUIDOR: (est.distribuidor && est.distribuidor.marca) || est.marca || '',
        DIRECCION: (est.ubicacion && est.ubicacion.direccion) || est.direccion || '',
        DIESEL: diesel, GASOLINA_93: g93, GASOLINA_95: g95,
        ACTUALIZADO: ahora
      });
    });

    dbReemplazar(SH.COMBUSTIBLE, filas);

    if (nDiesel && cfgBool('ACTUALIZAR_PRECIO_COMB_AUTO')) {
      var promedio = Math.round(sumaDiesel / nDiesel);
      setCfg('PRECIO_DIESEL_LTS', promedio);
      log('INFO', 'Combustible', 'Precio diesel actualizado a ' + clp(promedio) + ' (promedio de ' + nDiesel + ' estaciones).');
      return 'Precios actualizados. Diesel promedio: ' + clp(promedio) + ' sobre ' + nDiesel + ' estaciones.';
    }
    return 'Estaciones cargadas: ' + filas.length;
  } catch (e) {
    log('ERROR', 'Combustible', e.message);
    return 'Error consultando la API CNE: ' + e.message;
  }
}

/** Bencinera mas barata cerca de un destino, para instruir al conductor. */
function bencineraMasBarata(comuna) {
  var filas = dbLeer(SH.COMBUSTIBLE).filter(function (f) {
    return normalizar(f.COMUNA) === normalizar(comuna) && Number(f.DIESEL) > 0;
  });
  if (!filas.length) return null;
  filas.sort(function (a, b) { return Number(a.DIESEL) - Number(b.DIESEL); });
  return {
    distribuidor: filas[0].DISTRIBUIDOR,
    direccion: filas[0].DIRECCION,
    comuna: filas[0].COMUNA,
    diesel: Number(filas[0].DIESEL),
    ahorroPorLitro: Math.round(cfgNum('PRECIO_DIESEL_LTS') - Number(filas[0].DIESEL))
  };
}
