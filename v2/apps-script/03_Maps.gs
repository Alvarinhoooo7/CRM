/**
 * ============================================================================
 *  SERVICIO TECNICO EN RUTA · v2 · 03_Maps.gs
 *  Consulta de rutas a Google Maps y eleccion economica del trayecto.
 * ============================================================================
 *
 *  LA PREGUNTA QUE RESUELVE ESTE ARCHIVO
 *  "Si me demoro 30 minutos o una hora mas, conviene irme por fuera y no pagar
 *  peaje?" La respuesta no es una corazonada: se calcula.
 *
 *  COMO
 *  Cada par origen-destino se consulta DOS veces:
 *    1. Ruta normal      -> Google elige la mas rapida, normalmente autopista.
 *    2. Ruta sin peajes  -> se pide avoid=tolls y Google rutea por fuera.
 *  De cada una se obtiene kilometraje y duracion. Con eso se comparan en pesos:
 *
 *    costo_ruta = km/P_RENDIMIENTO*P_DIESEL + km*P_COSTO_KM + peaje + tiempo
 *
 *  EL PUNTO FINO: CUANTO VALE LA HORA DE RODEO
 *  Una hora de mas no siempre cuesta plata. Si el tecnico igual estaba dentro
 *  de su jornada, esa hora ya esta pagada y rodear es ahorro limpio. Si lo
 *  empuja sobre la jornada, cuesta hora extra con recargo. Y si lo obliga a
 *  pernoctar, cuesta hotel mas viatico del dia siguiente. Por eso el costo del
 *  tiempo depende de P_VALORA_TIEMPO_TECNICO y de cuanta jornada queda libre
 *  ese dia, no de un valor fijo.
 *
 *  QUE AUTOPISTA SE USA
 *  Google devuelve los pasos de la ruta con el nombre de cada via. Cruzando
 *  esos nombres contra el catalogo MOP se deduce que plazas se cruzan de
 *  verdad, en vez de suponerlo. Eso convierte una ruta ESTIMADO en DETECTADO.
 *
 *  SERVICIO USADO
 *  Maps nativo de Apps Script (Maps.newDirectionFinder), que no requiere clave
 *  ni facturacion. Cuota aproximada de 1.000 consultas diarias por cuenta, por
 *  eso todo queda cacheado en la hoja _RUTAS segun P_MAPS_CACHE_DIAS.
 * ============================================================================
 */

/* ==========================================================================
 * A. PALABRAS CLAVE PARA DETECTAR CONCESIONES EN LOS PASOS DE LA RUTA
 * --------------------------------------------------------------------------
 * Google describe cada paso con texto como "Continua por Autopista Central" o
 * "Toma Ruta 5 Sur". Estas son las marcas que delatan cada concesion. Se
 * comparan en minusculas y sin tildes.
 * ========================================================================== */

var MARCAS_CONCESION = [
  { clave: 'AUTOPISTA_CENTRAL', codigos: ['URB_ACE'],
    marcas: ['autopista central', 'general velasquez', 'ruta 5 norte sur', 'panamericana norte'] },
  { clave: 'COSTANERA_NORTE', codigos: ['URB_CNO'],
    marcas: ['costanera norte', 'autopista costanera', 'kennedy'] },
  { clave: 'VESPUCIO_SUR', codigos: ['URB_VSU'],
    marcas: ['vespucio sur', 'americo vespucio sur'] },
  { clave: 'VESPUCIO_NORTE', codigos: ['URB_VNO'],
    marcas: ['vespucio norte', 'americo vespucio norte'] },
  { clave: 'AVO', codigos: ['URB_AVO1', 'URB_AVO2'],
    marcas: ['vespucio oriente', 'avo', 'la piramide'] },
  { clave: 'TUNEL_SAN_CRISTOBAL', codigos: ['URB_TSC'],
    marcas: ['tunel san cristobal'] },
  { clave: 'ACCESO_NORORIENTE', codigos: ['URB_ANO'],
    marcas: ['acceso nororiente', 'chicureo'] },
  { clave: 'RUTA_78', codigos: ['R78_AVE', 'R78_RIN', 'R78_PHU', 'R78_MAL',
                                'R78_TAL', 'R78_PAI', 'R78_POM', 'R78_PUA'],
    marcas: ['ruta 78', 'autopista del sol'] },
  { clave: 'VARIANTE_MELIPILLA', codigos: ['R78_VME'],
    marcas: ['variante melipilla'] },
  { clave: 'RUTA_5_NORTE', codigos: ['R5N_LMA', 'R5N_BUE', 'R5N_LMO', 'R5N_LPI',
                                     'R5N_LAM', 'R5N_LVE', 'R5N_MEL', 'R5N_PIC'],
    marcas: ['ruta 5 norte', 'panamericana'] },
  { clave: 'RUTA_5_SUR', codigos: ['R5S_TOC', 'R5S_GAB', 'R5S_RMA', 'R5S_ANG'],
    marcas: ['ruta 5 sur', 'autopista del maipo', 'acceso sur'] },
  { clave: 'RUTA_68', codigos: ['R68_LPZ'],
    marcas: ['ruta 68', 'lo prado', 'zapata'] },
  { clave: 'RUTA_ITATA', codigos: ['ITA_NAL', 'ITA_RAF', 'ITA_AAM'],
    marcas: ['ruta del itata', 'ruta 152'] },
  { clave: 'PUENTE_INDUSTRIAL', codigos: ['BIO_PIN'],
    marcas: ['puente industrial'] },
  { clave: 'INTERPORTUARIA', codigos: ['BIO_INP'],
    marcas: ['interportuaria'] },
  { clave: 'LOS_LIBERTADORES', codigos: ['LIB_CHA'],
    marcas: ['los libertadores', 'chacabuco'] },
  { clave: 'RUTA_66', codigos: ['R66_ARA', 'R66_SPE'],
    marcas: ['ruta 66', 'camino de la fruta'] }
];

/* ==========================================================================
 * B. CONSULTA A GOOGLE MAPS
 * ========================================================================== */

/** Normaliza texto para comparar: minusculas, sin tildes, sin etiquetas HTML. */
function normalizarTexto_(texto) {
  return String(texto || '')
    .replace(/<[^>]*>/g, ' ')
    .toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Consulta una ruta a Google Maps.
 *
 * @param {string} direccionOrigen  direccion completa de origen
 * @param {string} direccionDestino direccion completa de destino
 * @param {boolean} evitarPeajes    true para pedir la ruta que rodea los peajes
 * @param {Object} p                parametros resueltos de CONFIG
 * @return {{km:number, horas:number, pasos:Array, ok:boolean, error:string}}
 */
function consultarRutaMaps_(direccionOrigen, direccionDestino, evitarPeajes, p) {
  try {
    var conexion = conexionMaps_();
    if (conexion.proveedor === 'ROUTES_API') return consultarRoutesApi_(direccionOrigen, direccionDestino, evitarPeajes, p, conexion.clave);
    var buscador = Maps.newDirectionFinder()
      .setOrigin(direccionOrigen)
      .setDestination(direccionDestino)
      .setMode(Maps.DirectionFinder.Mode.DRIVING)
      .setRegion('cl')
      .setLanguage('es');

    if (evitarPeajes) buscador.setAvoid(Maps.DirectionFinder.Avoid.TOLLS);

    // Hora de salida de referencia, para que la duracion considere el trafico
    // tipico de esa franja y no el de este instante.
    // Duración estática: no inventar una hora de salida distinta de la orden.

    var respuesta = buscador.getDirections();

    if (!respuesta || !respuesta.routes || !respuesta.routes.length) {
      return { ok: false, km: 0, horas: 0, pasos: [],
               error: (respuesta && respuesta.status ? respuesta.status + ': ' : '') + 'Google no devolvio ninguna ruta entre "' + direccionOrigen +
                      '" y "' + direccionDestino + '". Revise que ambas direcciones ' +
                      'incluyan comuna y pais.' };
    }

    var ruta = respuesta.routes[0];
    var metros = 0;
    var segundos = 0;
    var pasos = [];

    for (var i = 0; i < ruta.legs.length; i++) {
      var tramo = ruta.legs[i];
      metros += tramo.distance.value;
      segundos += tramo.duration.value;
      for (var j = 0; j < tramo.steps.length; j++) {
        pasos.push(normalizarTexto_(tramo.steps[j].html_instructions));
      }
    }

    var horasCrudas = segundos / 3600;

    return {
      ok: true,
      km: Math.round(metros / 1000 * 10) / 10,
      // El factor de correccion existe porque Maps cronometra un auto liviano
      // sin paradas. La camioneta va cargada y para a cargar y a comer.
      horas: Math.round(horasCrudas * p.P_FACTOR_HORAS * 100) / 100,
      horasCrudas: Math.round(horasCrudas * 100) / 100,
      pasos: pasos,
      fuente: 'Google Maps · Apps Script',
      error: ''
    };

  } catch (e) {
    return { ok: false, km: 0, horas: 0, pasos: [],
             error: 'Error consultando Google Maps: ' + e.message };
  }
}

/** Proxima fecha habil a la hora de salida configurada, para estimar trafico. */
function proximaSalida_(p) {
  var hhmm = String(p.P_MAPS_HORA_SALIDA || '08:00').split(':');
  var fecha = new Date();
  fecha.setDate(fecha.getDate() + 1);
  while (fecha.getDay() === 0 || fecha.getDay() === 6) {
    fecha.setDate(fecha.getDate() + 1);
  }
  fecha.setHours(Number(hhmm[0]) || 8, Number(hhmm[1]) || 0, 0, 0);
  return fecha;
}

/* ==========================================================================
 * C. DETECCION DE PLAZAS A PARTIR DE LOS PASOS DE LA RUTA
 * ========================================================================== */

/**
 * Deduce que concesiones atraviesa una ruta leyendo los nombres de las vias
 * que devolvio Google, y con eso propone la lista de plazas.
 *
 * Es una PROPUESTA, no una verdad: Google nombra la via, no la plaza. Sirve
 * para detectar que una ruta entra a la Autopista Central cuando la ruta
 * declarada decia que iba por calle. El motor la usa para levantar una alerta_
 * de discrepancia, no para reemplazar en silencio lo declarado.
 *
 * @param {Array<string>} pasos pasos normalizados de la ruta
 * @return {{concesiones:Array<string>, codigosPropuestos:Array<string>}}
 */
function detectarConcesiones_(pasos) {
  var texto = pasos.join(' | ');
  var concesiones = [];
  var codigos = [];

  for (var i = 0; i < MARCAS_CONCESION.length; i++) {
    var entrada = MARCAS_CONCESION[i];
    for (var j = 0; j < entrada.marcas.length; j++) {
      if (texto.indexOf(entrada.marcas[j]) !== -1) {
        concesiones.push(entrada.clave);
        codigos = codigos.concat(entrada.codigos);
        break;
      }
    }
  }
  return { concesiones: concesiones, codigosPropuestos: codigos };
}

/* ==========================================================================
 * D. VALORIZACION DEL TIEMPO DE VIAJE
 * ========================================================================== */

/**
 * Cuanto cuesta, en pesos, que un tramo se demore X horas de mas.
 *
 * Esta es la funcion que responde de verdad "conviene rodear?". El costo de
 * una hora extra de viaje depende de donde cae esa hora:
 *
 *   · Dentro de la jornada  -> $0. El tecnico ya estaba contratado ese dia.
 *   · Sobre la jornada      -> hora extra con recargo, por cada tecnico.
 *   · Sobre el tope legal   -> no hay precio: el plan es inviable y se
 *                              devuelve Infinity para que nunca se elija.
 *
 * @param {number} horasAdicionales  cuanto mas demora la alternativa
 * @param {number} horasYaUsadas     horas que la cuadrilla lleva ese dia
 * @param {number} tecnicos          integrantes de la cuadrilla
 * @param {Object} p                 parametros resueltos
 * @return {{costo:number, horasExtra:number, motivo:string}}
 */
function costoDelTiempo_(horasAdicionales, horasYaUsadas, tecnicos, p) {
  if (horasAdicionales <= 0) {
    return { costo: 0, horasExtra: 0, motivo: 'No agrega tiempo' };
  }

  if (p.P_VALORA_TIEMPO_TECNICO === 'Nunca') {
    return { costo: 0, horasExtra: 0,
             motivo: 'Configurado para no valorizar el tiempo de viaje' };
  }

  var costoHoraExtra = p.P_COSTO_HORA_TECNICO * p.P_RECARGO_HORA_EXTRA;

  if (p.P_VALORA_TIEMPO_TECNICO === 'Siempre') {
    return {
      costo: horasAdicionales * tecnicos * p.P_COSTO_HORA_TECNICO,
      horasExtra: 0,
      motivo: 'Toda hora de viaje se valoriza al costo empresa'
    };
  }

  // 'Solo si genera sobretiempo': el criterio economicamente correcto.
  var jornadaNormal = p.P_JORNADA_DIA_MAX;
  var topeLegal = jornadaNormal + (p.P_PERMITE_HORAS_EXTRA ? p.P_HORAS_EXTRA_MAX_DIA : 0);
  var horasFinales = horasYaUsadas + horasAdicionales;

  if (horasFinales > topeLegal) {
    return {
      costo: Infinity,
      horasExtra: 0,
      motivo: 'La alternativa deja la jornada en ' + horasFinales.toFixed(2) +
              ' h y el tope legal es ' + topeLegal.toFixed(2) + ' h. No es ejecutable.'
    };
  }

  if (horasFinales <= jornadaNormal) {
    return {
      costo: 0,
      horasExtra: 0,
      motivo: 'Las ' + horasAdicionales.toFixed(2) + ' h adicionales caben dentro de la ' +
              'jornada: ya estan pagadas y no agregan costo.'
    };
  }

  var horasExtra = horasFinales - Math.max(jornadaNormal, horasYaUsadas);
  return {
    costo: horasExtra * tecnicos * costoHoraExtra,
    horasExtra: horasExtra,
    motivo: horasExtra.toFixed(2) + ' h sobre la jornada, pagadas con recargo a ' +
            tecnicos + ' tecnicos.'
  };
}

/* ==========================================================================
 * E. COMPARADOR DE RUTAS · con peaje contra sin peaje
 * ========================================================================== */

/**
 * Compara las dos formas de hacer el mismo tramo y elige la mas barata.
 *
 * @param {Object} rutaConPeaje  {km, horas} de la ruta rapida
 * @param {Object} rutaSinPeaje  {km, horas} de la ruta que rodea, o null
 * @param {number} peaje         peaje del tramo, ya calculado plaza por plaza
 * @param {number} tecnicos      integrantes de la cuadrilla
 * @param {number} horasYaUsadas horas que la cuadrilla lleva ese dia
 * @param {Object} p             parametros resueltos
 * @return {Object} comparacion completa, lista para mostrar en la UI
 */
function compararRutasDelTramo_(rutaConPeaje, rutaSinPeaje, peaje, tecnicos,
                               horasYaUsadas, p) {

  var costoVariable = function (km) {
    return (km / p.P_RENDIMIENTO) * p.P_DIESEL + km * p.P_COSTO_KM;
  };

  var conPeaje = {
    nombre: 'Por autopista',
    km: rutaConPeaje.km,
    horas: rutaConPeaje.horas,
    combustible: Math.round((rutaConPeaje.km / p.P_RENDIMIENTO) * p.P_DIESEL),
    desgaste: Math.round(rutaConPeaje.km * p.P_COSTO_KM),
    peaje: Math.round(peaje),
    costoTiempo: 0,
    horasExtra: 0,
    motivoTiempo: 'Es la ruta de referencia'
  };
  conPeaje.total = conPeaje.combustible + conPeaje.desgaste + conPeaje.peaje;

  if (!rutaSinPeaje || !rutaSinPeaje.km) {
    return {
      conPeaje: conPeaje,
      sinPeaje: null,
      recomendada: 'Por autopista',
      ahorro: 0,
      explicacion: 'No se consulto o no existe una ruta alternativa sin peajes para ' +
                   'este tramo.'
    };
  }

  var horasAdicionales = Math.round((rutaSinPeaje.horas - rutaConPeaje.horas) * 100) / 100;

  // FRENO DE SEGURIDAD, antes que cualquier calculo de pesos.
  // Un rodeo largo en ruta interurbana no es una linea de Excel: es carretera
  // secundaria, sin doble via ni bencineras, con una camioneta cargada. Sobre
  // el tope configurado se descarta, por barato que se vea.
  var topeRodeo = (typeof p.P_RODEO_MAX_HORAS === 'number') ? p.P_RODEO_MAX_HORAS : 0.75;
  if (horasAdicionales > topeRodeo) {
    return {
      conPeaje: conPeaje,
      sinPeaje: null,
      recomendada: 'Por autopista',
      ahorro: 0,
      horasAdicionales: horasAdicionales,
      descartadoPorSeguridad: true,
      explicacion: 'La ruta sin peaje agrega ' + horasAdicionales.toFixed(2) + ' h y el ' +
                   'tope de rodeo es ' + topeRodeo.toFixed(2) + ' h. Se descarta por ' +
                   'seguridad: un desvio asi en ruta interurbana no se hace con la ' +
                   'camioneta cargada. Se paga el peaje de ' +
                   formatearPesos_(conPeaje.peaje) + '.'
    };
  }

  var tiempo = costoDelTiempo_(horasAdicionales, horasYaUsadas, tecnicos, p);

  var sinPeaje = {
    nombre: 'Por fuera, sin peaje',
    km: rutaSinPeaje.km,
    horas: rutaSinPeaje.horas,
    combustible: Math.round((rutaSinPeaje.km / p.P_RENDIMIENTO) * p.P_DIESEL),
    desgaste: Math.round(rutaSinPeaje.km * p.P_COSTO_KM),
    peaje: 0,
    costoTiempo: (tiempo.costo === Infinity) ? Infinity : Math.round(tiempo.costo),
    horasExtra: tiempo.horasExtra,
    motivoTiempo: tiempo.motivo
  };
  sinPeaje.total = (tiempo.costo === Infinity)
    ? Infinity
    : sinPeaje.combustible + sinPeaje.desgaste + sinPeaje.costoTiempo;

  var ahorro = Math.abs(conPeaje.total - sinPeaje.total);
  var minimo = (typeof p.P_RODEO_AHORRO_MINIMO === 'number') ? p.P_RODEO_AHORRO_MINIMO : 0;

  // Gana solo si es mas barata Y el ahorro justifica complicar la ruta.
  var ganaSinPeaje = (sinPeaje.total < conPeaje.total) && (ahorro >= minimo);

  var explicacion;
  if (sinPeaje.total < conPeaje.total && ahorro < minimo) {
    explicacion = 'Rodear ahorraria ' + formatearPesos_(ahorro) + ', bajo el minimo de ' +
                  formatearPesos_(minimo) + ' que justifica complicar la ruta. Se va por ' +
                  'autopista.';
  } else if (sinPeaje.total === Infinity) {
    explicacion = 'Rodear agrega ' + horasAdicionales.toFixed(2) + ' h y deja la jornada ' +
                  'sobre el tope legal. Se va por autopista aunque el peaje cueste ' +
                  formatearPesos_(conPeaje.peaje) + '.';
  } else if (ganaSinPeaje) {
    explicacion = 'Rodear agrega ' + horasAdicionales.toFixed(2) + ' h y ' +
                  Math.round(sinPeaje.km - conPeaje.km) + ' km, pero ahorra ' +
                  formatearPesos_(conPeaje.peaje) + ' de peaje. ' + tiempo.motivo +
                  ' Conviene ir por fuera: se ahorran ' + formatearPesos_(ahorro) + '.';
  } else {
    explicacion = 'Rodear agrega ' + horasAdicionales.toFixed(2) + ' h y ' +
                  Math.round(sinPeaje.km - conPeaje.km) + ' km. ' + tiempo.motivo +
                  ' El peaje de ' + formatearPesos_(conPeaje.peaje) + ' sale mas barato ' +
                  'que el rodeo: se ahorran ' + formatearPesos_(ahorro) + ' yendo por autopista.';
  }

  return {
    conPeaje: conPeaje,
    sinPeaje: sinPeaje,
    recomendada: ganaSinPeaje ? 'Por fuera, sin peaje' : 'Por autopista',
    ahorro: ahorro,
    horasAdicionales: horasAdicionales,
    kmAdicionales: Math.round(sinPeaje.km - conPeaje.km),
    explicacion: explicacion
  };
}

/** Formato de pesos chilenos sin decimales. */
function formatearPesos_(monto) {
  if (monto === Infinity) return 'no ejecutable';
  return '$' + Math.round(monto).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/* ==========================================================================
 * F. CACHE EN LA HOJA _RUTAS
 * --------------------------------------------------------------------------
 * Se lee una sola vez y se trabaja en memoria. Las escrituras se acumulan y
 * se vuelcan de una sola vez al terminar.
 * ========================================================================== */

/** Clave unica de una consulta. */
function claveRuta_(origen, destino, evitarPeajes) {
  return origen + '|' + destino + '|' + (evitarPeajes ? 'SIN_PEAJE' : 'NORMAL');
}

/** Carga la cache completa de _RUTAS a un mapa en memoria. */
function cargarCacheRutas_(libro, p) {
  var hoja = libro.getSheetByName(HOJAS.RUTAS.nombre);
  if (!hoja) return { mapa: {}, hoja: null };

  var datos = hoja.getDataRange().getValues();
  var mapa = {};
  var ahora = new Date().getTime();
  var vigenciaMs = p.P_MAPS_CACHE_DIAS * 24 * 60 * 60 * 1000;

  for (var i = 1; i < datos.length; i++) {
    var fila = datos[i];
    if (!fila[0]) continue;

    var consultado = fila[5] ? new Date(fila[5]).getTime() : 0;
    if (!Number.isFinite(consultado) || ahora - consultado > vigenciaMs || fila[6] !== 'OK') continue;

    mapa[claveRuta_(fila[0], fila[1], fila[4] === true || fila[4] === 'Si')] = {
      km: Number(fila[2]) || 0,
      horas: (Number(fila[3]) || 0) / 60,
      ok: fila[6] === 'OK',
      pasos: String(fila[7] || '').split(' | '),
      desdeCache: true
    };
  }
  return { mapa: mapa, hoja: hoja };
}

/** Agrega una fila a la cache. Se acumulan y se escriben en bloque. */
function filaCacheRuta_(origen, destino, evitarPeajes, resultado) {
  return [
    origen,
    destino,
    resultado.km,
    Math.round(resultado.horas * 60),
    evitarPeajes ? 'Si' : 'No',
    new Date(),
    resultado.ok ? 'OK' : 'ERROR',
    resultado.ok ? resultado.pasos.join(' | ').substring(0, 45000) : resultado.error
  ];
}

/* ==========================================================================
 * G. ORQUESTADOR · resuelve todos los tramos que el plan necesita
 * ========================================================================== */

/**
 * Resuelve km y horas de una lista de pares origen-destino, usando la cache
 * cuando esta vigente y consultando a Google solo lo que falta.
 *
 * @param {Array<{origen:string, destino:string}>} pares  tramos a resolver
 * @param {Object} direcciones  mapa localidad -> direccion completa
 * @param {Object} p            parametros resueltos
 * @param {Spreadsheet} libro   libro de trabajo
 * @return {{rutas:Object, consultas:number, errores:Array}}
 */
function resolverRutas_(pares, direcciones, p, libro) {
  var cache = cargarCacheRutas_(libro, p);
  var rutas = cache.mapa;
  var nuevas = [];
  var errores = [];
  var consultas = 0;
  var iniciado = Date.now();

  var variantes = p.P_MAPS_COMPARA_SIN_PEAJE ? [false, true] : [false];

  resolver: for (var i = 0; i < pares.length; i++) {
    var origen = pares[i].origen;
    var destino = pares[i].destino;
    if (origen === destino) continue;

    for (var v = 0; v < variantes.length; v++) {
      var evitar = variantes[v];
      var clave = claveRuta_(origen, destino, evitar);
      if (rutas[clave]) continue;  // ya estaba en cache vigente

      if (consultas >= Math.min(p.P_MAPS_MAX_CONSULTAS, 20) || Date.now() - iniciado > 45000) {
        errores.push('Se alcanzo el tope de ' + p.P_MAPS_MAX_CONSULTAS + ' consultas a ' +
                     'Maps en esta ejecucion. Quedan tramos sin resolver: vuelva a ' +
                     'recalcular o suba P_MAPS_MAX_CONSULTAS.');
        break resolver;
      }

      var dirOrigen = direcciones[origen];
      var dirDestino = direcciones[destino];
      if (!dirOrigen || !dirDestino) {
        errores.push('Falta la direccion exacta de "' + (dirOrigen ? destino : origen) +
                     '" en la hoja DESTINOS. Sin direccion no se puede rutear.');
        continue;
      }

      var resultado = consultarRutaMaps_(dirOrigen, dirDestino, evitar, p);
      consultas++;

      if (!resultado.ok) {
        errores.push(origen + ' -> ' + destino +
                     (evitar ? ' (sin peaje)' : '') + ': ' + resultado.error);
      }

      rutas[clave] = resultado;
      nuevas.push(filaCacheRuta_(origen, destino, evitar, resultado));
    }
  }

  if (nuevas.length && cache.hoja) {
    cache.hoja.getRange(cache.hoja.getLastRow() + 1, 1, nuevas.length, nuevas[0].length)
      .setValues(nuevas);
  }

  return { rutas: rutas, consultas: consultas, errores: errores, nuevas: nuevas };
}

/** Recupera una ruta ya resuelta. Devuelve null si no esta. */
function obtenerRuta_(rutas, origen, destino, evitarPeajes) {
  var r = rutas[claveRuta_(origen, destino, evitarPeajes)];
  return (r && r.ok) ? r : null;
}

/** Vacia la cache de rutas. Se llama cuando cambia P_BASE o una direccion. */
function invalidarCacheRutas_(libro) {
  var hoja = libro.getSheetByName(HOJAS.RUTAS.nombre);
  if (!hoja) return 0;
  var filas = hoja.getLastRow() - 1;
  if (filas > 0) hoja.getRange(2, 1, filas, hoja.getLastColumn()).clearContent();
  return filas;
}
