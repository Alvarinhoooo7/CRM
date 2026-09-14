/**
 * ============================================================================
 *  SERVICIO TECNICO EN RUTA · v2 · 06_Api.gs
 *  Sesion y endpoints que llama la interfaz con google.script.run.
 * ============================================================================
 *
 *  SEGURIDAD DE LA DEMO
 *  El acceso es por correo y clave predefinidos. Dos decisiones importantes:
 *
 *   1. La clave NO viaja al navegador ni vive en el HTML. Se guarda hasheada
 *      con SHA-256 en las Propiedades del script y se compara en el servidor.
 *      Si estuviera en el HTML, cualquiera la veria con "ver codigo fuente".
 *
 *   2. Al entrar se emite un token de sesion con vencimiento, guardado en
 *      CacheService. Cada endpoint lo exige. Sin token valido no se devuelve
 *      ni un dato.
 *
 *  Esto es adecuado para una demostracion, no para produccion: no hay usuarios
 *  individuales, ni bloqueo por intentos fallidos, ni segundo factor. Para
 *  producción se requiere implementar identidad y permisos individuales.
 *  MODO_ACCESO no está conectado al login de esta versión.
 * ============================================================================
 */

var DURACION_SESION_SEGUNDOS = 6 * 60 * 60;   // 6 horas
var PREFIJO_SESION = 'sesion_';

/* ==========================================================================
 * A. SESION
 * ========================================================================== */

/**
 * Define el correo y la clave de acceso. Se ejecuta UNA VEZ desde el editor
 * de Apps Script, nunca desde la interfaz.
 *
 * Para cambiarlos, edite los dos valores y vuelva a ejecutar esta funcion.
 */
function configurarAcceso_() {
  var props = PropertiesService.getScriptProperties();
  var correo = props.getProperty('ACCESO_EMAIL');
  var clave = props.getProperty('ACCESO_CLAVE_INICIAL');
  if (!correo || !clave || clave.length < 10) throw new Error('Configure ACCESO_EMAIL y ACCESO_CLAVE_INICIAL (10 caracteres o más) en Propiedades del script.');
  props.setProperties({ ACCESO_EMAIL: correo.toLowerCase().trim(), ACCESO_HASH: hashClave_(clave), ID_PLANILLA: SpreadsheetApp.getActiveSpreadsheet().getId() });
  props.deleteProperty('ACCESO_CLAVE_INICIAL');
  return 'Acceso configurado. La clave inicial fue eliminada de las propiedades.';
}

/**
 * Función pública visible en el menú desplegable del editor de Apps Script.
 * Ejecutar una sola vez tras definir ACCESO_EMAIL y ACCESO_CLAVE_INICIAL.
 */
function configurarAcceso() {
  return configurarAcceso_();
}

/** SHA-256 en hexadecimal. */
function hashClave_(clave) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
                                      String(clave), Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

/**
 * Valida credenciales y entrega un token de sesion.
 * @return {{ok:boolean, token:string, mensaje:string}}
 */
function iniciarSesion(email, clave) {
  var props = PropertiesService.getScriptProperties();
  var correosPermitidos = (props.getProperty('ACCESO_EMAIL') || '').toLowerCase().split(',').map(function(e) { return e.trim(); });
  var esperadoHash = props.getProperty('ACCESO_HASH');

  if (correosPermitidos.length === 0 || !esperadoHash) {
    return { ok: false, token: '',
             mensaje: 'El acceso no esta configurado. Ejecute configurarAcceso() una vez ' +
                      'desde el editor de Apps Script.' };
  }

  var emailNormalizado = String(email || '').toLowerCase().trim();
  var coincide = (correosPermitidos.indexOf(emailNormalizado) !== -1) &&
                 (hashClave_(clave) === esperadoHash);

  if (!coincide) {
    Utilities.sleep(600);   // frena el ensayo y error a fuerza bruta
    return { ok: false, token: '', mensaje: 'Correo o clave incorrectos.' };
  }

  var token = Utilities.getUuid();
  CacheService.getScriptCache().put(PREFIJO_SESION + token, emailNormalizado,
                                    DURACION_SESION_SEGUNDOS);

  registrarBitacora_(obtenerLibro_(), 'INGRESO', emailNormalizado);
  return { ok: true, token: token, mensaje: 'Bienvenido', email: emailNormalizado };
}

/** Cierra la sesion invalidando el token. */
function cerrarSesion(token) {
  CacheService.getScriptCache().remove(PREFIJO_SESION + token);
  return { ok: true };
}

/**
 * Verifica el token. Lanza si no es valido: ningun endpoint continua sin esto.
 */
function exigirSesion_(token) {
  if (!token) throw new Error('Sesion no iniciada.');
  var email = CacheService.getScriptCache().get(PREFIJO_SESION + token);
  if (!email) throw new Error('La sesion expiro. Vuelva a ingresar.');
  return email;
}

/* ==========================================================================
 * B. TABLERO
 * ========================================================================== */

var CLAVE_CACHE_TABLERO = 'tablero_v2_';

/**
 * Devuelve todo lo que la interfaz necesita para dibujarse.
 * Se cachea por P_... minutos para no recalcular en cada cambio de pestana.
 */
function obtenerTablero(token, escenario, forzar) {
  exigirSesion_(token);

  var id = escenario || ESQUEMA_ESCENARIOS.activo;
  var cache = CacheService.getScriptCache();
  var clave = CLAVE_CACHE_TABLERO + id;

  if (!forzar) {
    var guardado = cache.get(clave);
    if (guardado) {
      var previo = JSON.parse(guardado);
      previo.desdeCache = true;
      return previo;
    }
  }

  var payload = construirTablero_(id);

  try {
    cache.put(clave, JSON.stringify(payload), APP.MINUTOS_CACHE_MOTOR * 60);
  } catch (e) {
    // Si el resultado excede el tope de 100 KB del cache, simplemente no se
    // cachea. Preferible eso a fallar: el usuario espera unos segundos mas.
  }
  return limpiarParaJson_(payload);
}

/** 
 * Permite restaurar las hojas base de Excel directamente desde la UI web.
 * Solo puede invocarse con una sesión válida.
 */
function apiRestaurarHojas(token) {
  exigirSesion_(token);
  try {
    crearHojasBase_();
    return { ok: true, mensaje: 'Hojas base restauradas con éxito. Por favor recarga el sitio.' };
  } catch(e) {
    return { ok: false, mensaje: e.message };
  }
}

/** Arma el payload completo corriendo el motor en los dos escenarios. */
function construirTablero_(idEscenario) {
  var datos = leerDatosDelLibro_();

  // Rutas: se resuelven los pares que el plan necesita, usando la cache.
  var direcciones = {};
  datos.destinos.forEach(function (d) { direcciones[d.localidad] = d.direccion; });

  var pares = datos.tramos.map(function (t) {
    return { origen: t.desde, destino: t.hasta };
  });
  // Ademas, BASE hacia cada localidad, para el comparador de modos.
  datos.destinos.forEach(function (d) {
    if (d.localidad !== 'BASE') pares.push({ origen: 'BASE', destino: d.localidad });
  });

  var resultadoRutas = resolverRutas_(pares, direcciones, datos.parametros, datos.libro);

  var entrada = {
    parametros: datos.parametros,
    destinos: datos.destinos,
    tramos: datos.tramos,
    tecnicos: datos.tecnicos,
    flota: datos.flota,
    rutas: resultadoRutas.rutas,
    ajustesPeaje: datos.ajustesPeaje
  };

  var principal = calcularPlan_(entrada, idEscenario);

  // El otro escenario corre sobre el MISMO plan: la diferencia es la mejora.
  var otroId = (idEscenario === 'OPERACION_REAL') ? 'LITERAL_PDF' : 'OPERACION_REAL';
  var alterno = calcularPlan_(entrada, otroId);

  var fechas = mapearDiasAFechas_(datos.parametros, datos.tablas.FERIADOS);

  // Comparador de modos por localidad.
  var ctx = {
    p: aplicarEscenario_(datos.parametros, idEscenario),
    destinos: indexarPor_(datos.destinos, 'localidad'),
    rutas: resultadoRutas.rutas,
    ajustesPeaje: datos.ajustesPeaje,
    alertas: []
  };
  var comparador = datos.destinos
    .filter(function (d) { return d.localidad !== 'BASE' && d.equipos > 0; })
    .map(function (d) {
      return compararModos_(d.localidad, datos.parametros.P_TECNICOS_POR_CUADRILLA, ctx);
    });

  // Circuitos: agrupar localidades del mismo corredor en una sola salida.
  // Se calcula aqui para que la web muestre el contraste contra ir por
  // separado, que a veces gana y a veces pierde.
  var circuitos = [];
  try {
    circuitosPorCorredor_(ctx).forEach(function (g) {
      var c = compararCircuito_(g.localidades, ctx);
      c.corredor = g.corredor;
      circuitos.push(c);
    });
  } catch (e) {
    circuitos = [];
  }

  return {
    ok: true,
    circuitos: circuitos,
    generado: new Date().toISOString(),
    escenarioActivo: idEscenario,
    escenarios: ESQUEMA_ESCENARIOS.definiciones,
    resultado: limpiarParaJson_(principal),
    comparacionEscenario: compararEscenarios_(principal, alterno, otroId),
    comparadorModos: comparador,
    fechas: fechas,
    checklist: datos.tablas.CHECKLIST,
    tecnicos: datos.tecnicos,
    flota: datos.flota,
    destinos: datos.destinos,
    maps: {
      consultas: resultadoRutas.consultas,
      errores: resultadoRutas.errores
    },
    desdeCache: false
  };
}

/** Diferencia entre los dos escenarios: es el argumento de la mejora. */
function compararEscenarios_(principal, alterno, idAlterno) {
  var a = principal.totales;
  var b = alterno.totales;

  return {
    contra: idAlterno,
    titulo: definicionEscenario_(idAlterno).titulo,
    filas: [
      { concepto: 'Capacitaciones dictadas',
        activo: a.capacitaciones, alterno: b.capacitaciones },
      { concepto: 'Horas-hombre totales',
        activo: a.horasHombre, alterno: b.horasHombre },
      { concepto: 'Dias habiles usados',
        activo: a.diasHabiles, alterno: b.diasHabiles },
      { concepto: 'Gasto total',
        activo: a.gastoTotal, alterno: b.gastoTotal, moneda: true },
      { concepto: 'Gasto por equipo',
        activo: a.gastoPorEquipo, alterno: b.gastoPorEquipo, moneda: true }
    ],
    ahorroHoras: redondear_(b.horasHombre - a.horasHombre, 2),
    ahorroPesos: b.gastoTotal - a.gastoTotal
  };
}

/** Fechas a texto: JSON.stringify las convierte, pero mejor hacerlo explicito. */
function limpiarParaJson_(objeto) {
  return JSON.parse(JSON.stringify(objeto, function (clave, valor) {
    if (valor === Infinity) return 'no ejecutable';
    return valor;
  }));
}

/* ==========================================================================
 * C. ACCIONES
 * ========================================================================== */

/** Recalcula ignorando la cache. Lo llama el boton Recalcular. */
function recalcular(token, escenario) {
  exigirSesion_(token);
  CacheService.getScriptCache().removeAll([
    CLAVE_CACHE_TABLERO + 'OPERACION_REAL',
    CLAVE_CACHE_TABLERO + 'LITERAL_PDF'
  ]);
  var payload = obtenerTablero(token, escenario, true);
  registrarBitacora_(obtenerLibro_(), 'RECALCULO',
    'Escenario ' + payload.escenarioActivo + ', gasto ' +
    payload.resultado.totales.gastoTotal);
  return limpiarParaJson_(payload);
}

/** Borra la cache de rutas y vuelve a consultar Google Maps. */
function actualizarRutas(token) {
  exigirSesion_(token);
  var libro = obtenerLibro_();
  var borradas = invalidarCacheRutas_(libro);
  CacheService.getScriptCache().removeAll([
    CLAVE_CACHE_TABLERO + 'OPERACION_REAL',
    CLAVE_CACHE_TABLERO + 'LITERAL_PDF'
  ]);

  var payload = obtenerTablero(token, null, true);

  // Se dejan los km, horas y peaje a la vista en DESTINOS.
  var datos = leerDatosDelLibro_();
  var direcciones = {};
  datos.destinos.forEach(function (d) { direcciones[d.localidad] = d.direccion; });
  var pares = datos.destinos
    .filter(function (d) { return d.localidad !== 'BASE'; })
    .map(function (d) { return { origen: 'BASE', destino: d.localidad }; });
  var r = resolverRutas_(pares, direcciones, datos.parametros, libro);
  escribirCalculadosEnDestinos_(libro, datos.destinos, r.rutas, datos.parametros,
                               datos.ajustesPeaje);

  registrarBitacora_(libro, 'RUTAS',
    borradas + ' rutas invalidadas, ' + r.consultas + ' consultas nuevas a Maps.');

  payload.maps.invalidadas = borradas;
  return limpiarParaJson_(payload);
}

/**
 * Simula un trabajo nuevo sin escribir nada en las hojas.
 * Responde: cabe en la jornada, cuantas horas ocupa y cuanto cuesta.
 */
function simularTrabajo(token, solicitud) {
  var escenario = solicitud && solicitud.escenario;
  exigirSesion_(token);

  var datos = leerDatosDelLibro_();
  var p = aplicarEscenario_(datos.parametros, escenario || ESQUEMA_ESCENARIOS.activo);
  var destino = datos.destinos.filter(function (d) {
    return d.localidad === solicitud.localidad; })[0];

  if (!destino) {
    return { ok: false, mensaje: 'La localidad "' + solicitud.localidad +
                                 '" no existe en DESTINOS.' };
  }

  var nTecnicos = Number(solicitud.tecnicos);
  var equipos = Number(solicitud.equipos);
  if (!Number.isInteger(equipos) || equipos < 1 || equipos > 99 || !Number.isInteger(nTecnicos) || nTecnicos < 1 || nTecnicos > datos.tecnicos.length || !/^D[1-9]\d*$/.test(solicitud.dia) || Number(solicitud.dia.slice(1)) > p.P_HORIZONTE_MAX_DIAS) throw new Error('Revise equipos, técnicos y día de la simulación.');

  var direcciones = {};
  datos.destinos.forEach(function (d) { direcciones[d.localidad] = d.direccion; });
  var r = resolverRutas_([{ origen: 'BASE', destino: destino.localidad }],
                        direcciones, datos.parametros, datos.libro);
  var ruta = obtenerRuta_(r.rutas, 'BASE', destino.localidad, false);

  var horasIda = ruta ? ruta.horas : destino.horas;
  var km = ruta ? ruta.km : destino.km;
  var sitio = horasEnSitio_(equipos, nTecnicos, true, p);
  var horasTotales = (2 * horasIda) + sitio.total;

  // Cuanto tiene ocupado ese dia la dotacion actual.
  var tablero = obtenerTablero(token, escenario || ESQUEMA_ESCENARIOS.activo, false);
  var ocupadoEseDia = 0;
  (tablero.resultado.jornadas || []).forEach(function (j) {
    if (j.dia === solicitud.dia) ocupadoEseDia = Math.max(ocupadoEseDia, j.horas);
  });

  var topeLegal = p.P_JORNADA_DIA_MAX +
                  (p.P_PERMITE_HORAS_EXTRA ? p.P_HORAS_EXTRA_MAX_DIA : 0);
  var cabeEnUnDia = horasTotales <= topeLegal;
  var dias = Math.max(1, Math.ceil(horasTotales / topeLegal));
  var noches = dias - 1;

  var peaje = calcularPeajeTramo_('BASE', destino.localidad, p, datos.ajustesPeaje);
  var combustible = (2 * km / p.P_RENDIMIENTO) * p.P_DIESEL;
  var desgaste = 2 * km * p.P_COSTO_KM;
  var hotel = noches * nTecnicos * p.P_HOTEL;
  var viatico = dias * nTecnicos * p.P_VIATICO;
  var total = Math.round(combustible + 2 * peaje.total + desgaste + hotel + viatico);

  return {
    ok: true,
    localidad: destino.localidad,
    equipos: equipos,
    tecnicos: nTecnicos,
    dia: solicitud.dia,
    km: redondear_(2 * km, 1),
    horasViaje: redondear_(2 * horasIda, 2),
    horasEnSitio: redondear_(sitio.total, 2),
    horasTotales: redondear_(horasTotales, 2),
    cabeEnUnDia: cabeEnUnDia,
    dias: dias,
    noches: noches,
    jornadaOcupadaEseDia: redondear_(ocupadoEseDia, 2),
    holguraEseDia: redondear_(Math.max(0, p.P_JORNADA_DIA - ocupadoEseDia), 2),
    costos: {
      combustible: Math.round(combustible),
      peajes: Math.round(2 * peaje.total),
      desgaste: Math.round(desgaste),
      hotel: Math.round(hotel),
      viatico: Math.round(viatico)
    },
    total: total,
    costoPorEquipo: equipos ? Math.round(total / equipos) : 0,
    veredicto: 'Estimación independiente desde BASE; no reserva técnicos ni vehículos. ' + (cabeEnUnDia
      ? 'Cabe en un dia de trabajo: ' + redondear_(horasTotales, 2) + ' h contra un tope ' +
        'legal de ' + topeLegal + ' h.'
      : 'No cabe en un dia: requiere ' + dias + ' dias y ' + noches + ' noche(s) de hotel.')
  };
}

/**
 * Hoja de ruta imprimible de un tecnico. Es lo que pide el caso 2 del
 * enunciado: que cada tecnico vea su ruta, implementos, hotel y camioneta.
 */
function obtenerOrdenServicio(token, codigoTecnico, escenario) {
  exigirSesion_(token);

  var tablero = obtenerTablero(token, escenario || ESQUEMA_ESCENARIOS.activo, false);
  var R = tablero.resultado;

  var tecnico = tablero.tecnicos.filter(function (t) {
    return t.codigo === codigoTecnico; })[0];
  if (!tecnico) {
    return { ok: false, mensaje: 'El tecnico ' + codigoTecnico + ' no esta en la nomina.' };
  }

  var destinos = indexarPor_(tablero.destinos, 'localidad');

  var tramos = R.tramos
    .filter(function (t) { return t.tecnicos.indexOf(codigoTecnico) !== -1; })
    .map(function (t) {
      var d = destinos[t.hasta] || {};
      return {
        n: t.n,
        dia: t.dia,
        fecha: tablero.fechas[t.dia] ? new Date(tablero.fechas[t.dia]).toISOString() : '',
        cuadrilla: t.cuadrilla,
        vehiculo: t.vehiculo,
        modo: t.modo,
        conduce: t.conductor === codigoTecnico,
        desde: t.desde,
        hasta: t.hasta,
        direccion: d.direccion || '',
        region: d.region || '',
        equipos: t.equipos,
        capacitaciones: t.capacitaciones,
        horasViaje: t.horasViaje,
        horasEnSitio: t.horasEnSitio,
        horasTramo: t.horasTramo,
        km: t.km,
        rutaElegida: t.rutaElegida,
        noches: t.noches,
        hotel: t.noches ? (d.hotel || 'Por confirmar') : '',
        linkCapacitacion: d.linkCapacitacion || ''
      };
    });

  var transferencia = R.transferencias.filter(function (x) {
    return x.tecnico === codigoTecnico; })[0] || null;
  var resumen = R.porTecnico.filter(function (x) {
    return x.tecnico === codigoTecnico; })[0] || null;

  return {
    ok: true,
    tecnico: tecnico,
    tramos: tramos,
    transferencia: transferencia,
    resumen: resumen,
    checklist: tablero.checklist,
    generado: new Date().toISOString(),
    capacitacionDigital: R.parametros.P_CAP_DIGITAL_PREVIA
  };
}

/** Cambia un parametro de CONFIG desde la interfaz. */
function guardarParametro(token, clave, valor) {
  exigirSesion_(token);

  var def = definicionParametro_(clave);
  if (!def) return { ok: false, mensaje: 'Parametro desconocido: ' + clave };
  if (def.formula || def.fuente === 'PDF') {
    return { ok: false, mensaje: '"' + def.etiqueta + '" es calculado: no se edita a mano.' };
  }

  var libro = obtenerLibro_();
  var rango = libro.getRangeByName(clave);
  if (!rango) return { ok: false, mensaje: 'No existe el rango con nombre ' + clave };

  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var anterior = rango.getValue();
    var reglas = def.validacion || {};
    var nuevo;
    if (reglas.valores) {
      nuevo = reglas.valores.filter(function (v) { return String(v) === String(valor); })[0];
      if (nuevo === undefined) throw new Error('Seleccione un valor permitido.');
    } else if (['numero','entero','moneda','porcentaje'].indexOf(def.tipo) >= 0) {
      nuevo = Number(valor);
      if (String(valor).trim() === '' || !Number.isFinite(nuevo) || (def.tipo === 'entero' && !Number.isInteger(nuevo))) throw new Error('Ingrese un número válido.');
      if ((reglas.min !== undefined && nuevo < reglas.min) || (reglas.max !== undefined && nuevo > reglas.max)) throw new Error('El valor está fuera del rango permitido.');
    } else if (def.tipo === 'fecha') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor))) throw new Error('Ingrese una fecha válida.');
      nuevo = new Date(String(valor) + 'T12:00:00-03:00');
      if (!Number.isFinite(nuevo.getTime()) || Utilities.formatDate(nuevo, APP.ZONA_HORARIA, 'yyyy-MM-dd') !== valor) throw new Error('Fecha inválida.');
    } else nuevo = textoCelda_(valor);
    var actuales = leerParametros_(libro); actuales[clave] = nuevo;
    validarParametros_(actuales);
    rango.setValue(nuevo);
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }

  CacheService.getScriptCache().removeAll([
    CLAVE_CACHE_TABLERO + 'OPERACION_REAL',
    CLAVE_CACHE_TABLERO + 'LITERAL_PDF'
  ]);

  registrarBitacora_(libro, 'PARAMETRO',
    def.etiqueta + ': ' + anterior + ' -> ' + valor +
    (def.critico ? ' (CRITICO: hay que revisar el plan)' : ''));

  return { ok: true, critico: !!def.critico, etiqueta: def.etiqueta };
}

/** Esquema de configuracion para que la interfaz dibuje el formulario sola. */
function obtenerEsquemaConfig(token) {
  exigirSesion_(token);
  return {
    secciones: ESQUEMA_CONFIG.map(function (s) {
      return {
        seccion: s.seccion,
        parametros: s.parametros.map(function (d) {
          return {
            clave: d.clave, etiqueta: d.etiqueta, unidad: d.unidad, tipo: d.tipo,
            nota: d.nota, fuente: d.fuente, critico: !!d.critico,
            calculado: !!d.formula, validacion: d.validacion || null
          };
        })
      };
    }),
    validaciones: ESQUEMA_VALIDACIONES,
    reglasCosteo: REGLAS_COSTEO
  };
}

/** Catalogo de peajes para mostrarlo de forma visual en la interfaz. */
function obtenerCatalogoPeajes(token) {
  exigirSesion_(token);
  return {
    plazas: CATALOGO_PLAZAS,
    rutas: RUTAS_PEAJE,
    estimadas: rutasEstimadas_(),
    sinTarifa: plazasSinTarifa_()
  };
}


/* ==========================================================================
 * D. MANTENCION DESDE LA WEB
 * ========================================================================== */

/** Agrega a CONFIG los parametros nuevos del esquema, sin borrar nada. */
function sincronizarParametrosWeb(token) {
  exigirSesion_(token);
  var r = sincronizarParametros_();
  return { ok: true, mensaje: r.mensaje, agregados: r.agregados };
}

/** Dice si CONFIG esta al dia con el esquema, sin escribir nada. */
function diagnosticarParametrosWeb(token) {
  exigirSesion_(token);
  return diagnosticarParametros_();
}

/* ==========================================================================
 * E. ASISTENTE DE ORDEN
 * --------------------------------------------------------------------------
 * Responde la pregunta con la que parte cualquier coordinador: "me llamaron
 * de Copiapo por 5 equipos, cuanto me sale y a quien mando".
 *
 * No pide tarifas ni kilometrajes: los saca de DESTINOS y del catalogo de
 * peajes. El coordinador solo elige el destino y cuantos equipos son.
 * ========================================================================== */

/**
 * Dado un destino y una cantidad de equipos, devuelve todas las formas de
 * atenderlo con su costo, y cual conviene con el porque escrito.
 *
 * @param {string} token
 * @param {{localidad:string, equipos:number}} solicitud
 */
function asistenteOrden(token, solicitud) {
  exigirSesion_(token);

  var datos = leerDatosDelLibro_();
  var p = aplicarEscenario_(datos.parametros, ESQUEMA_ESCENARIOS.activo);

  var destino = datos.destinos.filter(function (d) {
    return d.localidad === solicitud.localidad; })[0];
  if (!destino) {
    return { ok: false, mensaje: 'La localidad "' + solicitud.localidad +
                                 '" no esta en la hoja DESTINOS.' };
  }

  // Se respeta la cantidad de equipos que pide el coordinador, que puede ser
  // distinta de la que trae DESTINOS: puede ser un trabajo nuevo.
  var equipos = Number(solicitud.equipos);
  if (!(equipos > 0)) equipos = destino.equipos || 1;

  // Rutas: se resuelve el par BASE-destino con la cache.
  var direcciones = {};
  datos.destinos.forEach(function (d) { direcciones[d.localidad] = d.direccion; });
  var r = resolverRutas_([{ origen: 'BASE', destino: destino.localidad }],
                         direcciones, datos.parametros, datos.libro);

  // Se arma un contexto con la cantidad de equipos solicitada.
  var destinosAjustados = {};
  datos.destinos.forEach(function (d) {
    destinosAjustados[d.localidad] = (d.localidad === destino.localidad)
      ? JSON.parse(JSON.stringify(d)) : d;
  });
  destinosAjustados[destino.localidad].equipos = equipos;

  var ctx = {
    p: p,
    destinos: destinosAjustados,
    rutas: r.rutas,
    ajustesPeaje: datos.ajustesPeaje,
    alertas: []
  };

  var comparacion = compararModos_(destino.localidad, p.P_TECNICOS_POR_CUADRILLA, ctx);
  if (!comparacion) {
    return { ok: false, mensaje: 'No se pudo evaluar el destino.' };
  }

  var rec = comparacion.recomendacion;
  var elegida = rec && rec.elegida;

  // Un resumen en una sola frase, que es lo que el coordinador necesita leer.
  var titular = elegida
    ? ('Manda ' + elegida.dotacion + ' tecnico' + (elegida.dotacion > 1 ? 's' : '') +
       ' en ' + elegida.modo.toLowerCase() +
       (elegida.modo === 'Camioneta'
          ? ' (' + Math.ceil(elegida.dotacion / p.P_CAPACIDAD_CAMIONETA) + ' vehiculo' +
            (Math.ceil(elegida.dotacion / p.P_CAPACIDAD_CAMIONETA) > 1 ? 's' : '') + ')'
          : '') +
       '. Sale ' + formatearPesos_(elegida.total) +
       ' y toma ' + elegida.dias + ' dia' + (elegida.dias > 1 ? 's' : '') +
       (elegida.noches ? ' con ' + elegida.noches + ' noche' +
         (elegida.noches > 1 ? 's' : '') + ' de hotel' : ', sin pernoctar') + '.')
    : 'No hay alternativas ejecutables con los datos cargados.';

  return {
    ok: true,
    localidad: destino.localidad,
    direccion: destino.direccion,
    region: destino.region,
    enRM: comparacion.enRM,
    equipos: equipos,
    hotelReferencia: destino.hotel,
    titular: titular,
    recomendacion: rec,
    opciones: comparacion.opciones,
    dotacionesEvaluadas: comparacion.dotacionesEvaluadas,
    parametros: {
      capacidadCamioneta: p.P_CAPACIDAD_CAMIONETA,
      viatico: p.P_VIATICO,
      colacion: p.P_COLACION_RM,
      hotel: p.P_HOTEL
    }
  };
}

/** Lista simple de destinos para llenar el selector del asistente. */
function listarDestinos(token) {
  exigirSesion_(token);
  var datos = leerDatosDelLibro_();
  return datos.destinos
    .filter(function (d) { return d.localidad !== 'BASE'; })
    .map(function (d) {
      return {
        localidad: d.localidad,
        region: d.region,
        direccion: d.direccion,
        equipos: d.equipos,
        enRM: String(d.enRM || '').toLowerCase().indexOf('s') === 0,
        km: d.km,
        hotel: d.hotel
      };
    });
}
