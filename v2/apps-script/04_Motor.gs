/**
 * ============================================================================
 *  SERVICIO TECNICO EN RUTA · v2 · 04_Motor.gs
 *  Motor de calculo. Puro: recibe datos, devuelve resultados.
 * ============================================================================
 *
 *  NO TOCA SpreadsheetApp. Recibe los datos ya leidos y devuelve un objeto con
 *  todo calculado. Eso lo hace testeable sin abrir Google: se le puede pasar un
 *  plan inventado y verificar que los numeros dan.
 *
 *  ORDEN DE CALCULO
 *   1. Validar la entrada y resolver las referencias entre hojas.
 *   2. Recorrer los tramos: distancia, tiempo, trabajo en sitio, costos.
 *   3. Agrupar por cuadrilla y dia: jornada, semaforo, horas extra.
 *   4. Decidir hotel contra horas extra donde corresponda.
 *   5. Repartir viaticos por tecnico-dia, nunca por tramo.
 *   6. Imputar el gasto a cada localidad.
 *   7. Calcular el monto a transferir a cada tecnico.
 *   8. Correr las validaciones cruzadas y publicar alertas.
 *
 *  REGLA CENTRAL DEL TRABAJO EN SITIO
 *  Solo se ejecuta trabajo la PRIMERA vez que una localidad aparece como
 *  destino. Un paso posterior por la misma ciudad es parada tecnica: 0 equipos
 *  y 0 capacitaciones. La funcion horasEnSitio_() de 00_Esquema.gs es la unica
 *  que sabe cuantas horas toma eso.
 * ============================================================================
 */

/**
 * Calcula el plan completo.
 *
 * @param {Object} datos
 *   @param {Object} datos.parametros  claves P_* ya resueltas
 *   @param {Array}  datos.destinos    filas de DESTINOS como objetos
 *   @param {Array}  datos.tramos      filas de PLAN como objetos
 *   @param {Array}  datos.tecnicos    nomina activa
 *   @param {Array}  datos.flota       vehiculos
 *   @param {Object} datos.rutas       cache de Google Maps
 *   @param {Object} datos.ajustesPeaje correcciones al catalogo MOP
 * @param {string} idEscenario  'OPERACION_REAL' o 'LITERAL_PDF'
 * @return {Object} resultado completo
 */
function calcularPlan_(datos, idEscenario) {
  var p = aplicarEscenario_(datos.parametros, idEscenario || ESQUEMA_ESCENARIOS.activo);

  var ctx = {
    p: p,
    escenario: idEscenario || ESQUEMA_ESCENARIOS.activo,
    destinos: indexarPor_(datos.destinos, 'localidad'),
    tecnicos: indexarPor_(datos.tecnicos, 'codigo'),
    flota: indexarPor_(datos.flota, 'codigo'),
    rutas: datos.rutas || {},
    ajustesPeaje: datos.ajustesPeaje || {},
    alertas: [],
    visitadas: {}
  };

  var tramos = calcularTramos_(datos.tramos, ctx);
  var jornadas = agruparJornadas_(tramos, ctx);
  var tecnicoDias = calcularTecnicoDias_(tramos, jornadas, ctx);
  var localidades = imputarALocalidades_(tramos, tecnicoDias, ctx);
  var transferencias = calcularTransferencias_(tramos, tecnicoDias, jornadas, ctx);
  var totales = consolidarTotales_(tramos, tecnicoDias, jornadas, ctx);
  var porTecnico = resumirPorTecnico_(tramos, tecnicoDias, jornadas, ctx);

  validarPlan_(tramos, jornadas, tecnicoDias, ctx);

  return {
    escenario: ctx.escenario,
    generado: new Date(),
    parametros: p,
    tramos: tramos,
    jornadas: jornadas,
    tecnicoDias: tecnicoDias,
    localidades: localidades,
    transferencias: transferencias,
    porTecnico: porTecnico,
    totales: totales,
    alertas: ctx.alertas
  };
}

/* ==========================================================================
 * 1. TRAMOS
 * ========================================================================== */

function calcularTramos_(filas, ctx) {
  var p = ctx.p;
  var salida = [];

  // Horas que cada cuadrilla lleva acumuladas ese dia. Es imprescindible
  // llevarlas AQUI y no despues: la decision de rodear un peaje depende de
  // cuanta jornada queda libre, y si se decidiera con el dia en blanco se
  // elegiria rodear siempre. Los tramos vienen en orden de ejecucion.
  var acumulado = {};

  // No hay limite de camionetas ni de gente hacia un mismo destino: si a una
  // localidad llegan dos cuadrillas el mismo dia, se reparten el trabajo y lo
  // terminan antes. Esta pasada previa cuenta cuanta gente hay realmente en
  // cada sitio, para que la paralelizacion use el total y no la dotacion de
  // una sola camioneta.
  var cuadrilla = dotacionPorSitio_(filas);

  for (var i = 0; i < filas.length; i++) {
    var f = filas[i];
    if (!f.desde || !f.hasta) continue;

    var claveDia = f.cuadrilla + '|' + f.dia;
    var horasYaUsadas = acumulado[claveDia] || 0;

    var origen = ctx.destinos[f.desde];
    var destino = ctx.destinos[f.hasta];

    if (!origen) {
      ctx.alertas.push(alerta_('LOCALIDAD_INEXISTENTE', 'error',
        'PLAN fila ' + f.fila + ': la localidad de origen "' + f.desde + '" no existe ' +
        'en DESTINOS. Corrijala o agreguela a DESTINOS.'));
      continue;
    }
    if (!destino) {
      ctx.alertas.push(alerta_('LOCALIDAD_INEXISTENTE', 'error',
        'PLAN fila ' + f.fila + ': la localidad de destino "' + f.hasta + '" no existe ' +
        'en DESTINOS. Corrijala o agreguela a DESTINOS.'));
      continue;
    }

    var nTecnicos = f.tecnicos.length;
    if (!nTecnicos) {
      ctx.alertas.push(alerta_('TRAMO_SIN_TECNICOS', 'error',
        'PLAN fila ' + f.fila + ' (' + f.desde + ' -> ' + f.hasta + '): no hay ningun ' +
        'tecnico marcado. Marque las casillas de quienes van.'));
    }

    // En la camioneta caben tres con sus bolsos y viajan comodos. Si hacen
    // falta mas personas en ese destino, se manda otra camioneta: eso si esta
    // permitido y el sistema lo suma solo.
    if ((f.modo || 'Camioneta') === 'Camioneta' && nTecnicos > p.P_CAPACIDAD_CAMIONETA) {
      ctx.alertas.push(alerta_('CAMIONETA_SOBRECARGADA', 'error',
        'PLAN fila ' + f.fila + ': van ' + nTecnicos + ' tecnicos en una sola camioneta y ' +
        'el maximo comodo son ' + p.P_CAPACIDAD_CAMIONETA + '. Reparta la cuadrilla en dos ' +
        'vehiculos: pueden ir varias camionetas al mismo destino y el sistema junta a la ' +
        'gente para calcular el trabajo en el sitio.'));
    }

    // --- Distancia y tiempo: Google Maps, o respaldo declarado ---------
    // Se le pasan los tecnicos y las horas ya gastadas para que la decision
    // de rodear el peaje se tome con la jornada real, no con el dia vacio.
    var viaje = resolverViaje_(f.desde, f.hasta, nTecnicos, horasYaUsadas, ctx);

    // --- Trabajo en el destino ----------------------------------------
    // El trabajo se ejecuta la primera vez que se llega a la localidad. Si ese
    // dia llegan varias cuadrillas, TODAS trabajan: se reparten los equipos y
    // el sitio se termina antes.
    var sitioClave = f.hasta + '|' + f.dia;
    var info = cuadrilla[sitioClave];
    var esJornadaDeTrabajo = !!info && f.hasta !== 'BASE' &&
                             !ctx.visitadas[f.hasta];

    var equipos = 0;
    var sitio = { instalacion: 0, capacitacion: 0, total: 0 };

    if (esJornadaDeTrabajo) {
      var equiposDelSitio = destino.equipos || 0;

      // Las horas dependen de TODA la gente presente, no de esta camioneta.
      sitio = horasEnSitio_(equiposDelSitio, info.tecnicos, true, p);

      // Los equipos se reparten entre las cuadrillas presentes en proporcion a
      // su dotacion, con el resto al primero, para que la suma siempre cuadre.
      equipos = repartirEquipos_(equiposDelSitio, info, f.cuadrilla);

      info.atendidas = (info.atendidas || 0) + 1;
      if (info.atendidas >= info.cuadrillas.length) ctx.visitadas[f.hasta] = true;

      // Un solo aviso por sitio, no uno por cuadrilla que llega.
      if (info.cuadrillas.length > 1 && info.atendidas === 1) {
        ctx.alertas.push(alerta_('SITIO_COMPARTIDO', 'aviso',
          f.hasta + ' el ' + f.dia + ' recibe ' + info.cuadrillas.length + ' cuadrillas (' +
          info.cuadrillas.join(', ') + ') con ' + info.tecnicos + ' tecnicos en total. Se ' +
          'reparten los ' + equiposDelSitio + ' equipos y el sitio se termina en ' +
          redondear_(sitio.total, 2) + ' h en vez de ' +
          redondear_(horasEnSitio_(equiposDelSitio, f.tecnicos.length, true, p).total, 2) +
          ' h con una sola cuadrilla. Verifique que convenga: mas gente reduce el reloj ' +
          'pero puede subir las horas-hombre pagadas.'));
      }
    }

    var primeraVisita = esJornadaDeTrabajo;

    var horasTramo = viaje.horas + sitio.total;
    var horasHombre = horasTramo * nTecnicos;

    // --- Costos del tramo ----------------------------------------------
    var costos = costearTramo_(f, viaje, nTecnicos, ctx);

    salida.push({
      fila: f.fila,
      n: f.n,
      dia: f.dia,
      cuadrilla: f.cuadrilla,
      modo: f.modo,
      vehiculo: f.vehiculo,
      conductor: f.conductor,
      desde: f.desde,
      hasta: f.hasta,
      noches: f.noches || 0,
      tecnicos: f.tecnicos,
      nTecnicos: nTecnicos,

      km: viaje.km,
      horasViaje: viaje.horas,
      fuenteViaje: viaje.fuente,
      rutaElegida: viaje.rutaElegida,
      comparacionRuta: viaje.comparacion,

      primeraVisita: primeraVisita,
      equipos: equipos,
      capacitaciones: primeraVisita ? (p.P_CAP_BASE === 'Por equipo' ? equipos : 1) : 0,
      horasInstalacion: sitio.instalacion,
      horasCapacitacion: sitio.capacitacion,
      horasEnSitio: sitio.total,
      horasTramo: horasTramo,
      horasHombre: horasHombre,

      costos: costos,
      subtotal: costos.subtotal,

      // Localidad a la que se carga el gasto: donde hubo trabajo, o el origen
      // si el tramo fue regreso o parada tecnica.
      imputaA: primeraVisita ? f.hasta : f.desde
    });

    acumulado[claveDia] = horasYaUsadas + horasTramo;
  }

  return salida;
}

/**
 * Resuelve kilometraje y tiempo de un tramo, eligiendo entre la ruta por
 * autopista y la que rodea los peajes segun cual salga mas barata.
 */
function resolverViaje_(desde, hasta, nTecnicos, horasYaUsadas, ctx) {
  var p = ctx.p;

  if (desde === hasta) {
    return { km: 0, horas: 0, fuente: 'Sin desplazamiento', rutaElegida: '—',
             comparacion: null, peaje: 0 };
  }

  var conPeaje = obtenerRuta_(ctx.rutas, desde, hasta, false);
  var sinPeaje = obtenerRuta_(ctx.rutas, desde, hasta, true);

  if (!conPeaje) {
    ctx.alertas.push(alerta_('RUTA_SIN_MAPS', 'aviso',
      'El tramo ' + desde + ' -> ' + hasta + ' no tiene ruta de Google Maps. Se usa el ' +
      'respaldo de kilometraje declarado. Recalcule rutas cuando haya conexion.'));
    var respaldo = respaldoDistancia_(desde, hasta, ctx);
    if (!(respaldo.km > 0) || !(respaldo.horas > 0)) {
      ctx.alertas.push(alerta_('DISTANCIA_NO_VALIDADA', 'error',
        'No hay distancia y tiempo válidos para ' + desde + ' → ' + hasta +
        '. Actualice Maps antes de utilizar el presupuesto.'));
    }
    return { km: respaldo.km, horas: respaldo.horas, fuente: 'Respaldo declarado',
             rutaElegida: 'Sin dato de Maps', comparacion: null, peaje: respaldo.peaje };
  }

  var peaje = calcularPeajeTramo_(desde, hasta, p, ctx.ajustesPeaje);

  var comparacion = compararRutasDelTramo_(conPeaje, sinPeaje, peaje.total,
                                          nTecnicos || 1, horasYaUsadas || 0, p);

  var rodea = (comparacion.recomendada === 'Por fuera, sin peaje') && !!sinPeaje;

  var elegida = rodea
    ? { km: sinPeaje.km, horas: sinPeaje.horas, peaje: 0 }
    : { km: conPeaje.km, horas: conPeaje.horas, peaje: peaje.total };

  if (rodea) {
    ctx.alertas.push(alerta_('RODEO_ELEGIDO', 'aviso',
      desde + ' -> ' + hasta + ': se rodea el peaje. ' + comparacion.explicacion));
  }

  return {
    km: elegida.km,
    horas: elegida.horas,
    peaje: elegida.peaje,
    detallePeaje: peaje.detalle,
    estadoPeaje: peaje.estado,
    fuente: 'Google Maps',
    rutaElegida: comparacion.recomendada,
    comparacion: comparacion
  };
}

/** Respaldo cuando Maps no responde: usa los km declarados en DESTINOS. */
function respaldoDistancia_(desde, hasta, ctx) {
  var o = ctx.destinos[desde] || {};
  var d = ctx.destinos[hasta] || {};
  var mismoCorredor = o.corredor && o.corredor === d.corredor;

  var kmO = Number(o.km) || 0, kmD = Number(d.km) || 0;
  var hO = Number(o.horas) || 0, hD = Number(d.horas) || 0;

  var km = mismoCorredor ? Math.abs(kmD - kmO) : (kmO + kmD);
  var horas = mismoCorredor ? Math.abs(hD - hO) : (hO + hD);

  var peaje = calcularPeajeTramo_(desde, hasta, ctx.p, ctx.ajustesPeaje);
  return { km: km, horas: horas, peaje: peaje.total };
}

/** Costos de un tramo segun su modo de transporte. */
function costearTramo_(f, viaje, nTecnicos, ctx) {
  var p = ctx.p;
  var destino = ctx.destinos[f.hasta] || {};
  var modo = f.modo || 'Camioneta';

  var c = {
    combustible: 0, peajes: 0, desgaste: 0,
    pasajes: 0, flete: 0, arriendo: 0, traslados: 0,
    hotel: 0, litros: 0
  };

  if (modo === 'Camioneta') {
    c.litros = viaje.km / p.P_RENDIMIENTO;
    c.combustible = Math.round(c.litros * p.P_DIESEL);
    c.peajes = Math.round(viaje.peaje || 0);
    c.desgaste = Math.round(viaje.km * p.P_COSTO_KM);

  } else if (modo === 'Bus' || modo === 'Avion') {
    var tarifa = (modo === 'Bus') ? (destino.pasajeBus || 0) : (destino.pasajeAvion || 0);
    if (!tarifa) {
      ctx.alertas.push(alerta_('MODO_NO_HABILITADO', 'error',
        'PLAN fila ' + f.fila + ': el tramo va en ' + modo + ' pero ' + f.hasta +
        ' no tiene tarifa cargada en la tabla TARIFAS DE BUS Y AVION de CONFIG.'));
    }
    c.pasajes = Math.round(tarifa * nTecnicos);

    if (modo === 'Avion') {
      // El bolso de herramientas NO puede ir en cabina: taladros y alicates
      // estan prohibidos por seguridad aerea. Hay que facturar equipaje, y se
      // cobra POR PERSONA y POR TRAMO. Es el costo que mas se olvida al
      // comparar un vuelo contra la camioneta.
      c.flete = Math.round(p.P_EQUIPAJE_BODEGA_AVION * nTecnicos);
      // Dos carreras de taxi por tramo: base al aeropuerto y aeropuerto de
      // destino a la ciudad. No se arrienda vehiculo, se toma taxi.
      c.traslados = Math.round(2 * p.P_KM_TERMINAL_CIUDAD * p.P_TAXI_POR_KM);
    } else {
      // En bus el bolso viaja en la bodega del vehiculo, normalmente gratis.
      c.flete = Math.round(p.P_FLETE_HERRAMIENTAS);
      c.traslados = Math.round(p.P_KM_TERMINAL_CIUDAD * p.P_TAXI_POR_KM);
    }

    // Movilizacion dentro de la ciudad de destino: taxi por kilometro, no
    // arriendo de vehiculo.
    c.arriendo = Math.round(p.P_KM_TAXI_DIA * p.P_TAXI_POR_KM);

    if (!p.P_HERRAMIENTAS_TRANSPORTABLES) {
      ctx.alertas.push(alerta_('HERRAMIENTAS_SIN_VEHICULO', 'error',
        'PLAN fila ' + f.fila + ': el tramo va en ' + modo + ' pero la configuracion dice ' +
        'que las herramientas no pueden separarse de la camioneta. La cuadrilla llegaria ' +
        'sin con que trabajar.'));
    }

  } else if (modo === 'Transporte publico') {
    c.pasajes = Math.round(p.P_TRANSPORTE_PUBLICO * nTecnicos);
  }

  // Hotel: por noche y por tecnico, con opcion de habitacion compartida.
  if (f.noches > 0) {
    var personas = p.P_HABITACION_INDIVIDUAL ? nTecnicos : Math.ceil(nTecnicos / 2);
    c.hotel = Math.round(f.noches * personas * p.P_HOTEL);
  }

  c.subtotal = c.combustible + c.peajes + c.desgaste + c.pasajes +
               c.flete + c.arriendo + c.traslados + c.hotel;
  return c;
}

/* ==========================================================================
 * 2. JORNADAS POR CUADRILLA Y DIA
 * ========================================================================== */

function agruparJornadas_(tramos, ctx) {
  var p = ctx.p;
  var mapa = {};

  for (var i = 0; i < tramos.length; i++) {
    var t = tramos[i];
    var clave = t.cuadrilla + '|' + t.dia;

    if (!mapa[clave]) {
      mapa[clave] = {
        cuadrilla: t.cuadrilla, dia: t.dia,
        horas: 0, horasViaje: 0, horasEnSitio: 0,
        tramos: [], tecnicos: {}, vehiculos: {},
        equipos: 0, noches: 0, costo: 0
      };
    }

    var j = mapa[clave];
    j.horas += t.horasTramo;
    j.horasViaje += t.horasViaje;
    j.horasEnSitio += t.horasEnSitio;
    j.equipos += t.equipos;
    j.noches += t.noches;
    j.costo += t.subtotal;
    j.tramos.push(t.n);
    t.tecnicos.forEach(function (c) { j.tecnicos[c] = true; });
    if (t.vehiculo && t.vehiculo !== '—') j.vehiculos[t.vehiculo] = true;
  }

  // Semaforo y horas extra.
  var salida = [];
  for (var clave2 in mapa) {
    if (!Object.prototype.hasOwnProperty.call(mapa, clave2)) continue;
    var jo = mapa[clave2];

    jo.horas = redondear_(jo.horas, 2);
    jo.horasViaje = redondear_(jo.horasViaje, 2);
    jo.horasEnSitio = redondear_(jo.horasEnSitio, 2);
    jo.nTecnicos = Object.keys(jo.tecnicos).length;

    var topeLegal = p.P_JORNADA_DIA_MAX +
                    (p.P_PERMITE_HORAS_EXTRA ? p.P_HORAS_EXTRA_MAX_DIA : 0);

    if (jo.horas <= p.P_JORNADA_DIA) {
      jo.estado = 'OK';
    } else if (jo.horas <= p.P_JORNADA_DIA_MAX) {
      jo.estado = 'TOLERANCIA';
    } else if (jo.horas <= topeLegal) {
      jo.estado = 'SOBRETIEMPO';
    } else {
      jo.estado = 'FUERA DE LEY';
    }

    jo.horasExtra = Math.max(0, redondear_(jo.horas - p.P_JORNADA_DIA_MAX, 2));
    jo.costoSobretiempo = Math.round(
      jo.horasExtra * jo.nTecnicos * p.P_COSTO_HORA_TECNICO * p.P_RECARGO_HORA_EXTRA);

    salida.push(jo);
  }

  salida.sort(function (a, b) {
    return (a.dia + a.cuadrilla < b.dia + b.cuadrilla) ? -1 : 1;
  });

  evaluarHotelContraExtra_(salida, ctx);

  return salida;
}

/**
 * La decision que pidio la jefatura: estirar la jornada o pagar hotel.
 * Se evalua cada cuadrilla-dia que pernocta y se informa si habria salido mas
 * barato quedarse mas rato y volver.
 */
function evaluarHotelContraExtra_(jornadas, ctx) {
  var p = ctx.p;
  if (!p.P_PERMITE_HORAS_EXTRA) return;

  for (var i = 0; i < jornadas.length; i++) {
    var j = jornadas[i];
    if (!j.noches) continue;

    var costoNoche = j.nTecnicos * p.P_HOTEL + j.nTecnicos * p.P_VIATICO;
    var margen = p.P_JORNADA_DIA_MAX + p.P_HORAS_EXTRA_MAX_DIA - j.horas;
    if (margen <= 0) continue;

    var costoExtra = margen * j.nTecnicos * p.P_COSTO_HORA_TECNICO * p.P_RECARGO_HORA_EXTRA;

    j.alternativaSinHotel = {
      horasDisponibles: redondear_(margen, 2),
      costoHorasExtra: Math.round(costoExtra),
      costoPernoctar: Math.round(costoNoche),
      conviene: costoExtra < costoNoche,
      ahorro: Math.round(Math.abs(costoNoche - costoExtra))
    };

    if (costoExtra < costoNoche) {
      ctx.alertas.push(alerta_('EXTRA_MAS_BARATO_QUE_HOTEL', 'aviso',
        j.cuadrilla + ' el ' + j.dia + ' pernocta con ' + j.nTecnicos + ' tecnicos, lo ' +
        'que cuesta ' + formatearPesos_(costoNoche) + ' entre hotel y viatico del dia ' +
        'siguiente. Quedan ' + margen.toFixed(2) + ' h de margen legal: estirar la ' +
        'jornada costaria ' + formatearPesos_(costoExtra) + '. Revisar si el trabajo ' +
        'alcanza a terminarse: se ahorrarian ' +
        formatearPesos_(costoNoche - costoExtra) + '.'));
    }
  }
}

/* ==========================================================================
 * 3. VIATICOS POR TECNICO-DIA
 * --------------------------------------------------------------------------
 * Nunca por tramo: un tecnico que hace cuatro tramos en un dia recibe UN
 * viatico, no cuatro. El viatico es siempre el mismo monto y ya incluye la
 * colacion, asi que no hay distincion por region.
 * ========================================================================== */

function calcularTecnicoDias_(tramos, jornadas, ctx) {
  var p = ctx.p;
  var mapa = {};

  for (var i = 0; i < tramos.length; i++) {
    var t = tramos[i];
    for (var k = 0; k < t.tecnicos.length; k++) {
      var codigo = t.tecnicos[k];
      var clave = codigo + '|' + t.dia;

      if (!mapa[clave]) {
        mapa[clave] = {
          tecnico: codigo, dia: t.dia,
          horas: 0, horasViaje: 0, horasEnSitio: 0,
          localidades: {}, fueraRM: false, noches: 0,
          cuadrillas: {}, conduce: false
        };
      }

      var td = mapa[clave];
      td.horas += t.horasTramo;
      td.horasViaje += t.horasViaje;
      td.horasEnSitio += t.horasEnSitio;
      td.noches += t.noches;
      td.cuadrillas[t.cuadrilla] = true;
      if (t.conductor === codigo) td.conduce = true;

      var dOrigen = ctx.destinos[t.desde];
      var dDestino = ctx.destinos[t.hasta];
      if (dDestino && t.hasta !== 'BASE') td.localidades[t.hasta] = true;
      // Basta con que el origen O el destino esten fuera de la RM: un dia
      // completo manejando de vuelta desde Tome es un dia fuera de la region.
      if ((dOrigen && dOrigen.enRM === 'No') || (dDestino && dDestino.enRM === 'No')) {
        td.fueraRM = true;
      }
    }
  }

  // --- Viatico -----------------------------------------------------------
  // NO se le paga viatico a todo el mundo todos los dias. Son dos condiciones
  // y se cumplen las dos o no hay viatico:
  //
  //   1. El tecnico esta FUERA de la Region Metropolitana. Quien trabaja en
  //      Maipu almuerza y duerme en su casa.
  //   2. Es un viaje de MAS DE UN DIA. Ir a Talca y volver el mismo dia no
  //      genera viatico: sale y llega a su casa.
  //
  // La segunda condicion se resuelve mirando si ese tecnico pernocta ese dia
  // o si venia pernoctando del dia anterior, que es lo que hace que un dia
  // sea parte de un viaje largo y no una salida de ida y vuelta.
  var pernoctaPorTecnicoDia = {};
  for (var clave3 in mapa) {
    if (!Object.prototype.hasOwnProperty.call(mapa, clave3)) continue;
    if (mapa[clave3].noches > 0) pernoctaPorTecnicoDia[clave3] = true;
  }

  var salida = [];
  for (var clave2 in mapa) {
    if (!Object.prototype.hasOwnProperty.call(mapa, clave2)) continue;
    var x = mapa[clave2];
    x.horas = redondear_(x.horas, 2);
    x.horasViaje = redondear_(x.horasViaje, 2);
    x.horasEnSitio = redondear_(x.horasEnSitio, 2);
    x.nLocalidades = Object.keys(x.localidades).length;

    var numeroDia = Number(String(x.dia).replace(/\D/g, '')) || 0;
    var durmioAnoche = !!pernoctaPorTecnicoDia[x.tecnico + '|D' + (numeroDia - 1)];
    var duermeHoy = x.noches > 0;
    x.viajeLargo = duermeHoy || durmioAnoche;

    var cumpleRegion = !p.P_VIATICO_SOLO_FUERA_RM || x.fueraRM;
    var cumpleDuracion = !p.P_VIATICO_SOLO_CON_PERNOCTACION || x.viajeLargo;

    x.viatico = (cumpleRegion && cumpleDuracion) ? p.P_VIATICO : 0;
    x.motivoViatico = x.viatico
      ? 'Fuera de la RM y en viaje de mas de un dia'
      : (!cumpleRegion ? 'Dentro de la Region Metropolitana: duerme en su casa'
                       : 'Sale y vuelve el mismo dia: no corresponde viatico');

    salida.push(x);
  }
  return salida;
}

/* ==========================================================================
 * 4. IMPUTACION A LOCALIDADES
 * ========================================================================== */

function imputarALocalidades_(tramos, tecnicoDias, ctx) {
  var mapa = {};

  var asegurar = function (nombre) {
    if (!mapa[nombre]) {
      var d = ctx.destinos[nombre] || {};
      mapa[nombre] = {
        localidad: nombre, region: d.region || '', enRM: d.enRM || '',
        equipos: 0, capacitaciones: 0, horasHombre: 0,
        combustible: 0, peajes: 0, desgaste: 0, pasajes: 0,
        flete: 0, arriendo: 0, traslados: 0, hotel: 0, viatico: 0, total: 0
      };
    }
    return mapa[nombre];
  };

  var horasHombreTotales = 0;

  for (var i = 0; i < tramos.length; i++) {
    var t = tramos[i];
    if (t.imputaA === 'BASE') continue;

    var L = asegurar(t.imputaA);
    L.equipos += t.equipos;
    L.capacitaciones += t.capacitaciones;
    L.horasHombre += t.horasHombre;
    L.combustible += t.costos.combustible;
    L.peajes += t.costos.peajes;
    L.desgaste += t.costos.desgaste;
    L.pasajes += t.costos.pasajes;
    L.flete += t.costos.flete;
    L.arriendo += t.costos.arriendo;
    L.traslados += t.costos.traslados;
    L.hotel += t.costos.hotel;
    horasHombreTotales += t.horasHombre;
  }

  // Los viaticos son por persona-dia y no pertenecen a un tramo: se reparten
  // en proporcion a las horas-hombre de cada localidad.
  var viaticoTotal = tecnicoDias.reduce(function (s, x) { return s + x.viatico; }, 0);

  var salida = [];
  for (var nombre in mapa) {
    if (!Object.prototype.hasOwnProperty.call(mapa, nombre)) continue;
    var L = mapa[nombre];
    L.viatico = horasHombreTotales
      ? Math.round(viaticoTotal * (L.horasHombre / horasHombreTotales)) : 0;
    L.horasHombre = redondear_(L.horasHombre, 2);
    L.total = L.combustible + L.peajes + L.desgaste + L.pasajes + L.flete +
              L.arriendo + L.traslados + L.hotel + L.viatico;
    L.costoPorEquipo = L.equipos ? Math.round(L.total / L.equipos) : 0;
    salida.push(L);
  }

  salida.sort(function (a, b) { return b.total - a.total; });
  return salida;
}

/* ==========================================================================
 * 5. TRANSFERENCIA POR TECNICO
 * --------------------------------------------------------------------------
 * Responde la pregunta textual del enunciado: "que monto requiere cada tecnico
 * para realizar la ruta".
 * ========================================================================== */

function calcularTransferencias_(tramos, tecnicoDias, jornadas, ctx) {
  var p = ctx.p;
  var mapa = {};

  var asegurar = function (codigo) {
    if (!mapa[codigo]) {
      var t = ctx.tecnicos[codigo] || {};
      mapa[codigo] = {
        tecnico: codigo, nombre: t.nombre || codigo,
        dias: 0, noches: 0,
        viatico: 0, hotel: 0, combustible: 0, peajes: 0,
        subtotal: 0, imprevistos: 0, total: 0, detalle: []
      };
    }
    return mapa[codigo];
  };

  // Viatico y hotel: por persona.
  for (var i = 0; i < tecnicoDias.length; i++) {
    var td = tecnicoDias[i];
    var r = asegurar(td.tecnico);
    r.dias += 1;
    r.noches += td.noches;
    if (p.P_TRANSFIERE_VIATICO) r.viatico += td.viatico;
  }

  for (var j = 0; j < tramos.length; j++) {
    var t = tramos[j];

    if (p.P_TRANSFIERE_HOTEL && t.costos.hotel) {
      var porPersona = Math.round(t.costos.hotel / Math.max(1, t.nTecnicos));
      for (var k = 0; k < t.tecnicos.length; k++) {
        asegurar(t.tecnicos[k]).hotel += porPersona;
      }
    }

    // Gasto del vehiculo: al conductor, o prorrateado.
    var gastoVehiculo = {
      combustible: p.P_TRANSFIERE_COMBUSTIBLE ? t.costos.combustible : 0,
      peajes: (p.P_PEAJE_MEDIO_PAGO === 'Efectivo del tecnico') ? t.costos.peajes : 0
    };

    if (gastoVehiculo.combustible || gastoVehiculo.peajes) {
      if (p.P_GASTOS_VEHICULO_AL_CONDUCTOR && t.conductor) {
        var rc = asegurar(t.conductor);
        rc.combustible += gastoVehiculo.combustible;
        rc.peajes += gastoVehiculo.peajes;
      } else {
        var porCabeza = Math.max(1, t.nTecnicos);
        for (var m = 0; m < t.tecnicos.length; m++) {
          var rp = asegurar(t.tecnicos[m]);
          rp.combustible += Math.round(gastoVehiculo.combustible / porCabeza);
          rp.peajes += Math.round(gastoVehiculo.peajes / porCabeza);
        }
      }
    }
  }

  var salida = [];
  for (var codigo in mapa) {
    if (!Object.prototype.hasOwnProperty.call(mapa, codigo)) continue;
    var r = mapa[codigo];
    r.subtotal = r.viatico + r.hotel + r.combustible + r.peajes;
    r.imprevistos = Math.round(r.subtotal * p.P_HOLGURA_IMPREVISTOS);

    var bruto = r.subtotal + r.imprevistos;
    var paso = p.P_REDONDEO_TRANSFERENCIA || 1;
    r.total = Math.ceil(bruto / paso) * paso;

    salida.push(r);
  }

  salida.sort(function (a, b) { return b.total - a.total; });
  return salida;
}

/* ==========================================================================
 * 6. RESUMEN POR TECNICO
 * ========================================================================== */

function resumirPorTecnico_(tramos, tecnicoDias, jornadas, ctx) {
  var p = ctx.p;
  var mapa = {};

  for (var codigo in ctx.tecnicos) {
    if (!Object.prototype.hasOwnProperty.call(ctx.tecnicos, codigo)) continue;
    mapa[codigo] = {
      tecnico: codigo,
      nombre: ctx.tecnicos[codigo].nombre,
      licencia: ctx.tecnicos[codigo].licencia,
      horas: 0, horasViaje: 0, horasEnSitio: 0,
      equipos: 0, localidades: {}, dias: 0, noches: 0,
      diasFueraRM: 0, diasConduciendo: 0
    };
  }

  for (var i = 0; i < tramos.length; i++) {
    var t = tramos[i];
    for (var k = 0; k < t.tecnicos.length; k++) {
      var r = mapa[t.tecnicos[k]];
      if (!r) continue;
      r.horas += t.horasTramo;
      r.horasViaje += t.horasViaje;
      r.horasEnSitio += t.horasEnSitio;
      if (t.nTecnicos) r.equipos += t.equipos / t.nTecnicos;
      if (t.hasta !== 'BASE') r.localidades[t.hasta] = true;
    }
  }

  for (var j = 0; j < tecnicoDias.length; j++) {
    var td = tecnicoDias[j];
    var rr = mapa[td.tecnico];
    if (!rr) continue;
    rr.dias += 1;
    rr.noches += td.noches;
    if (td.fueraRM) rr.diasFueraRM += 1;
    if (td.conduce) rr.diasConduciendo += 1;
  }

  // Utilizacion sobre la capacidad efectiva del horizonte planificado.
  var diasPlan = contarDiasDelPlan_(tramos);
  var capacidad = diasPlan * p.P_JORNADA_DIA;

  var salida = [];
  for (var c2 in mapa) {
    if (!Object.prototype.hasOwnProperty.call(mapa, c2)) continue;
    var x = mapa[c2];
    x.horas = redondear_(x.horas, 2);
    x.horasViaje = redondear_(x.horasViaje, 2);
    x.horasEnSitio = redondear_(x.horasEnSitio, 2);
    x.equipos = redondear_(x.equipos, 1);
    x.nLocalidades = Object.keys(x.localidades).length;
    x.capacidad = redondear_(capacidad, 2);
    x.utilizacion = capacidad ? x.horas / capacidad : 0;
    x.diagnostico = diagnosticarUtilizacion_(x.utilizacion);
    salida.push(x);
  }

  salida.sort(function (a, b) { return b.utilizacion - a.utilizacion; });
  return salida;
}

/** Traduce un porcentaje de utilizacion al texto de la tabla DIAGNOSTICO. */
function diagnosticarUtilizacion_(utilizacion) {
  var filas = ESQUEMA_TABLAS.DIAGNOSTICO.filas;
  for (var i = 0; i < filas.length; i++) {
    if (utilizacion >= filas[i][0] && utilizacion < filas[i][1]) {
      return { etiqueta: filas[i][2], texto: filas[i][3] };
    }
  }
  return { etiqueta: 'SIN DATOS', texto: 'No hay horas asignadas en el periodo.' };
}

/* ==========================================================================
 * 7. TOTALES
 * ========================================================================== */

function consolidarTotales_(tramos, tecnicoDias, jornadas, ctx) {
  var p = ctx.p;
  var T = {
    equipos: 0, capacitaciones: 0, localidades: 0,
    km: 0, litros: 0,
    combustible: 0, peajes: 0, desgaste: 0, pasajes: 0,
    flete: 0, arriendo: 0, traslados: 0, hotel: 0, viatico: 0,
    sobretiempo: 0, imprevistos: 0, gastoTotal: 0,
    horasHombre: 0, horasEnSitio: 0, horasViaje: 0,
    nochesPersona: 0, tecnicoDias: tecnicoDias.length,
    diasHabiles: 0, tramos: tramos.length,
    cuadrillasDia: jornadas.length,
    enOK: 0, enTolerancia: 0, enSobretiempo: 0, fueraDeLey: 0
  };

  var localidades = {};

  for (var i = 0; i < tramos.length; i++) {
    var t = tramos[i];
    T.equipos += t.equipos;
    T.capacitaciones += t.capacitaciones;
    T.km += t.km;
    T.litros += t.costos.litros;
    T.combustible += t.costos.combustible;
    T.peajes += t.costos.peajes;
    T.desgaste += t.costos.desgaste;
    T.pasajes += t.costos.pasajes;
    T.flete += t.costos.flete;
    T.arriendo += t.costos.arriendo;
    T.traslados += t.costos.traslados;
    T.hotel += t.costos.hotel;
    T.horasHombre += t.horasHombre;
    T.horasEnSitio += t.horasEnSitio * t.nTecnicos;
    T.horasViaje += t.horasViaje * t.nTecnicos;
    T.nochesPersona += t.noches * t.nTecnicos;
    if (t.equipos > 0) localidades[t.hasta] = true;
  }

  T.viatico = tecnicoDias.reduce(function (s, x) { return s + x.viatico; }, 0);

  for (var j = 0; j < jornadas.length; j++) {
    T.sobretiempo += jornadas[j].costoSobretiempo || 0;
    if (jornadas[j].estado === 'OK') T.enOK++;
    else if (jornadas[j].estado === 'TOLERANCIA') T.enTolerancia++;
    else if (jornadas[j].estado === 'SOBRETIEMPO') T.enSobretiempo++;
    else T.fueraDeLey++;
  }

  var subtotal = T.combustible + T.peajes + T.desgaste + T.pasajes + T.flete +
                 T.arriendo + T.traslados + T.hotel + T.viatico;
  T.imprevistos = Math.round(subtotal * p.P_HOLGURA_IMPREVISTOS);
  T.gastoTotal = subtotal + T.sobretiempo + T.imprevistos;

  T.localidades = Object.keys(localidades).length;
  T.diasHabiles = contarDiasDelPlan_(tramos);
  T.km = redondear_(T.km, 1);
  T.litros = redondear_(T.litros, 1);
  T.horasHombre = redondear_(T.horasHombre, 2);
  T.horasEnSitio = redondear_(T.horasEnSitio, 2);
  T.horasViaje = redondear_(T.horasViaje, 2);
  T.gastoPorEquipo = T.equipos ? Math.round(T.gastoTotal / T.equipos) : 0;

  var capacidad = T.diasHabiles * p.P_JORNADA_DIA * p.P_TECNICOS;
  T.utilizacionGlobal = capacidad ? T.horasHombre / capacidad : 0;
  T.porcentajeProductivo = T.horasHombre ? T.horasEnSitio / T.horasHombre : 0;
  T.porcentajeTraslado = T.horasHombre ? T.horasViaje / T.horasHombre : 0;

  return T;
}

function contarDiasDelPlan_(tramos) {
  var dias = {};
  for (var i = 0; i < tramos.length; i++) dias[tramos[i].dia] = true;
  return Object.keys(dias).length;
}

/* ==========================================================================
 * 8. VALIDACIONES CRUZADAS
 * ========================================================================== */

function validarPlan_(tramos, jornadas, tecnicoDias, ctx) {
  var p = ctx.p;

  // --- Equipos y localidades pendientes -------------------------------
  var instalados = {};
  tramos.forEach(function (t) {
    if (t.equipos) instalados[t.hasta] = (instalados[t.hasta] || 0) + t.equipos;
  });

  for (var nombre in ctx.destinos) {
    if (!Object.prototype.hasOwnProperty.call(ctx.destinos, nombre)) continue;
    var d = ctx.destinos[nombre];
    if (nombre === 'BASE' || !d.equipos) continue;

    if (!instalados[nombre]) {
      ctx.alertas.push(alerta_('LOCALIDAD_SIN_VISITA', 'error',
        nombre + ' tiene ' + d.equipos + ' equipos por instalar y ningun tramo del plan ' +
        'llega ahi. Agregue el tramo o el trabajo queda sin hacer.'));
    } else if (instalados[nombre] !== d.equipos) {
      ctx.alertas.push(alerta_('EQUIPOS_SIN_ATENDER', 'error',
        nombre + ': el plan instala ' + instalados[nombre] + ' equipos y DESTINOS declara ' +
        d.equipos + '.'));
    }
  }

  // --- Jornada ---------------------------------------------------------
  jornadas.forEach(function (j) {
    if (j.estado === 'FUERA DE LEY') {
      ctx.alertas.push(alerta_('FUERA_DE_LEY', 'error',
        j.cuadrilla + ' el ' + j.dia + ' acumula ' + j.horas + ' h, sobre el tope legal ' +
        'de ' + (p.P_JORNADA_DIA_MAX + p.P_HORAS_EXTRA_MAX_DIA) + ' h. Hay que repartir ' +
        'los tramos en otro dia: este limite no se negocia por ahorro.'));
    }
    if (j.estado === 'SOBRETIEMPO' && !p.P_PERMITE_HORAS_EXTRA) {
      ctx.alertas.push(alerta_('SOBRETIEMPO_NO_AUTORIZADO', 'error',
        j.cuadrilla + ' el ' + j.dia + ' requiere ' + j.horasExtra + ' h extra y las horas ' +
        'extra estan deshabilitadas en CONFIG.'));
    }
    // El tamano de la cuadrilla NO es un limite: se manda la gente que haga
    // falta. Solo se avisa si la jefatura pidio estandarizar la dotacion.
    if (p.P_EXIGIR_TAMANO_CUADRILLA && j.nTecnicos !== p.P_TECNICOS_POR_CUADRILLA) {
      ctx.alertas.push(alerta_('CUADRILLA_INCOMPLETA', 'aviso',
        j.cuadrilla + ' el ' + j.dia + ' sale con ' + j.nTecnicos + ' tecnicos y la ' +
        'configuracion pide estandarizar en ' + p.P_TECNICOS_POR_CUADRILLA + '. Si la ' +
        'dotacion distinta es deliberada, apague "Exigir que todas las cuadrillas tengan ' +
        'ese tamano" en CONFIG.'));
    }
  });

  // --- Horas extra semanales por tecnico -------------------------------
  var extraPorTecnico = {};
  jornadas.forEach(function (j) {
    if (!j.horasExtra) return;
    Object.keys(j.tecnicos).forEach(function (c) {
      extraPorTecnico[c] = (extraPorTecnico[c] || 0) + j.horasExtra;
    });
  });
  for (var codigo in extraPorTecnico) {
    if (!Object.prototype.hasOwnProperty.call(extraPorTecnico, codigo)) continue;
    if (extraPorTecnico[codigo] > p.P_HORAS_EXTRA_MAX_SEMANA) {
      ctx.alertas.push(alerta_('EXTRA_SEMANAL_EXCEDIDO', 'error',
        codigo + ' acumula ' + redondear_(extraPorTecnico[codigo], 2) + ' h extra y el ' +
        'tope legal semanal es ' + p.P_HORAS_EXTRA_MAX_SEMANA + ' h.'));
    }
  }

  // --- Cadena de tramos rota -------------------------------------------
  var ultimo = {};
  tramos.forEach(function (t) {
    var clave = t.cuadrilla + '|' + t.dia;
    if (ultimo[clave] && ultimo[clave] !== t.desde) {
      ctx.alertas.push(alerta_('CADENA_ROTA', 'error',
        'PLAN fila ' + t.fila + ': ' + t.cuadrilla + ' el ' + t.dia + ' sale desde "' +
        t.desde + '" pero el tramo anterior la dejo en "' + ultimo[clave] + '". ' +
        'La cuadrilla no puede teletransportarse.'));
    }
    ultimo[clave] = t.hasta;
  });

  // --- Vehiculo en dos cuadrillas el mismo dia -------------------------
  var vehiculoDia = {};
  tramos.forEach(function (t) {
    if (!t.vehiculo || t.vehiculo === '—') return;
    var clave = t.vehiculo + '|' + t.dia;
    if (vehiculoDia[clave] && vehiculoDia[clave] !== t.cuadrilla) {
      ctx.alertas.push(alerta_('VEHICULO_DUPLICADO', 'error',
        'El vehiculo ' + t.vehiculo + ' esta asignado a ' + vehiculoDia[clave] + ' y a ' +
        t.cuadrilla + ' el mismo dia ' + t.dia + '.'));
    }
    vehiculoDia[clave] = t.cuadrilla;
  });

  // --- Conductor sin licencia ------------------------------------------
  tramos.forEach(function (t) {
    if (t.modo !== 'Camioneta') {
      if (t.vehiculo && t.vehiculo !== '—') {
        ctx.alertas.push(alerta_('VEHICULO_EN_MODO_AJENO', 'aviso',
          'PLAN fila ' + t.fila + ': hay un vehiculo asignado a un tramo en modo ' +
          t.modo + '. Esa camioneta queda inmovilizada sin necesidad.'));
      }
      return;
    }
    if (!t.conductor) {
      ctx.alertas.push(alerta_('CONDUCTOR_SIN_LICENCIA', 'error',
        'PLAN fila ' + t.fila + ': tramo en camioneta sin conductor declarado.'));
      return;
    }
    var tec = ctx.tecnicos[t.conductor];
    if (!tec || tec.licencia !== 'Si') {
      ctx.alertas.push(alerta_('CONDUCTOR_SIN_LICENCIA', 'error',
        'PLAN fila ' + t.fila + ': ' + t.conductor +
        (tec ? ' (' + tec.nombre + ') no tiene licencia de conducir.'
             : ' no existe en la nomina.')));
    }
    if (t.tecnicos.indexOf(t.conductor) === -1) {
      ctx.alertas.push(alerta_('CONDUCTOR_SIN_LICENCIA', 'error',
        'PLAN fila ' + t.fila + ': el conductor ' + t.conductor + ' no esta marcado como ' +
        'integrante del tramo.'));
    }
  });

  // --- Tecnico en dos cuadrillas el mismo dia --------------------------
  tecnicoDias.forEach(function (td) {
    var n = Object.keys(td.cuadrillas).length;
    if (n > 1) {
      ctx.alertas.push(alerta_('TECNICO_SOBREASIGNADO', 'error',
        td.tecnico + ' esta en ' + n + ' cuadrillas distintas el ' + td.dia + ': ' +
        Object.keys(td.cuadrillas).join(', ') + '.'));
    }
  });

  // --- Horizonte --------------------------------------------------------
  var dias = contarDiasDelPlan_(tramos);
  if (dias > p.P_HORIZONTE_MAX_DIAS) {
    ctx.alertas.push(alerta_('HORIZONTE_EXCEDIDO', 'error',
      'El plan usa ' + dias + ' dias habiles y el tope es ' + p.P_HORIZONTE_MAX_DIAS +
      '. Alargar para ahorrar es valido, pero con techo.'));
  }

  // --- Capacitacion digital sin enlace ---------------------------------
  // Una sola alerta_ con la lista, no una por localidad: 16 avisos identicos
  // no informan mas que uno y tapan los errores de verdad.
  if (p.P_CAP_DIGITAL_PREVIA && p.P_CAP_ENVIO_OBLIGATORIO) {
    var sinEnlace = [];
    tramos.forEach(function (t) {
      if (!t.primeraVisita || !t.equipos) return;
      var d = ctx.destinos[t.hasta];
      if (d && !d.linkCapacitacion) sinEnlace.push(t.hasta);
    });
    if (sinEnlace.length) {
      ctx.alertas.push(alerta_('CAPACITACION_SIN_ENLACE', 'aviso',
        sinEnlace.length + ' de ' + Object.keys(ctx.visitadas).length + ' localidades no ' +
        'tienen cargado el enlace de la capacitacion: ' + sinEnlace.join(', ') + '. El ' +
        'descuento de ' + Math.round(p.P_REDUCCION_CAP * 100) + '% del tiempo presencial ' +
        'se sostiene en que ese correo salio antes de la visita: sin enlace, la ' +
        'capacitacion vuelve a durar ' + (p.P_T_CAPACITACION * 60) + ' minutos.'));
    }
  }

  // --- Peajes estimados --------------------------------------------------
  var estimadas = rutasEstimadas_();
  if (estimadas.length) {
    ctx.alertas.push(alerta_('PEAJE_POR_RESPALDO', 'aviso',
      'Hay ' + estimadas.length + ' localidades cuya secuencia de plazas de peaje aun no ' +
      'se contrasta contra un total oficial del MOP: ' + estimadas.join(', ') + '. Los ' +
      'montos son estimaciones razonables, no totales auditados. Se corrigen con la ' +
      'primera cartola del TAG desde la tabla AJUSTES DE PEAJE.'));
  }

  // --- Herramientas amarradas -------------------------------------------
  if (!p.P_HERRAMIENTAS_TRANSPORTABLES) {
    ctx.alertas.push(alerta_('HERRAMIENTAS_AMARRADAS', 'aviso',
      'Las herramientas estan amarradas a las camionetas, asi que bus y avion no son ' +
      'ejecutables. El comparador los sigue evaluando para cuantificar cuanto cuesta ' +
      'esa restriccion: es el argumento para comprar sets portatiles.'));
  }
}

/* ==========================================================================
 * UTILIDADES
 * ========================================================================== */

function alerta_(id, nivel, mensaje) {
  return { id: id, nivel: nivel, mensaje: mensaje };
}

/**
 * Dotaciones que vale la pena evaluar para instalar N equipos.
 *
 * Mandar mas gente solo sirve si reduce el numero de vueltas. Para 5 equipos,
 * pasar de 3 a 4 tecnicos no cambia nada: techo(5/3) y techo(5/4) son ambos 2
 * vueltas, o sea 4 horas. La cuarta persona viaja, come y duerme gratis para
 * la empresa sin ahorrar un minuto.
 *
 * Peor todavia con 1 equipo: uno o tres tecnicos tardan exactamente 2 horas,
 * pero tres triplican el hotel, el viatico y los pasajes.
 *
 * Esta funcion devuelve solo las dotaciones que de verdad cambian el tiempo,
 * para que el comparador evalue alternativas reales y no desperdicio.
 *
 * @param {number} equipos  equipos a instalar en el sitio
 * @return {Array<number>} dotaciones utiles, de menor a mayor
 */
function dotacionesUtiles_(equipos) {
  if (equipos <= 0) return [1];

  var utiles = [];
  var vueltasPrevias = null;

  for (var n = 1; n <= equipos; n++) {
    var vueltas = Math.ceil(equipos / n);
    // Solo se agrega si esta persona adicional reduce las vueltas.
    if (vueltasPrevias === null || vueltas < vueltasPrevias) {
      utiles.push(n);
      vueltasPrevias = vueltas;
    }
    if (vueltas === 1) break;   // ya no se puede ir mas rapido
  }
  return utiles;
}

/**
 * Busca la forma MAS BARATA de repartir un viaje completo en dias.
 *
 * Esta es la funcion que hace que el sistema elija de verdad la opcion mas
 * economica, y no la mas comoda. El mismo viaje se puede hacer de varias
 * formas y cada una cuesta distinto:
 *
 *   · Apretar todo en un dia    -> se pagan horas extra con 50% de recargo,
 *                                  pero no se paga hotel ni el viatico del
 *                                  dia siguiente.
 *   · Repartirlo en dos dias    -> no hay horas extra, pero hay que pagar
 *                                  noche de hotel para toda la cuadrilla y un
 *                                  viatico mas por persona.
 *
 * Con tres tecnicos, dos horas extra cuestan $58.500 y una noche cuesta
 * $225.000 entre hotel y viatico. Por eso muchas veces conviene que el equipo
 * se quede hasta tarde, termine el trabajo y se devuelva, en vez de dormir
 * afuera. Lo mismo aplica a volar: a veces sale mas barato mandarlos en avion,
 * que trabajen con sobretiempo y tomen el vuelo de vuelta, que mandarlos en
 * camioneta dos dias.
 *
 * El unico limite que no se cruza es el legal: jornada contractual mas el
 * maximo de horas extra permitidas. Sobre eso la alternativa se descarta,
 * cueste lo que cueste.
 *
 * @param {number} horasTotales   viaje de ida y vuelta mas trabajo en el sitio
 * @param {number} nTecnicos      integrantes de la cuadrilla
 * @param {number} costoTransporte costo del transporte, que no depende de los dias
 * @param {number} costoPorDia    costos que se repiten cada dia, como el arriendo
 * @param {Object} p              parametros resueltos
 * @return {{mejor:Object, alternativas:Array}}
 */
function mejorProgramacion_(horasTotales, nTecnicos, costoTransporte, costoPorDia, p) {
  var jornadaNormal = p.P_JORNADA_DIA_MAX;
  var extraMax = p.P_PERMITE_HORAS_EXTRA ? p.P_HORAS_EXTRA_MAX_DIA : 0;
  var topeLegalDia = jornadaNormal + extraMax;

  var personas = p.P_HABITACION_INDIVIDUAL ? nTecnicos : Math.ceil(nTecnicos / 2);
  var costoHoraExtra = p.P_COSTO_HORA_TECNICO * p.P_RECARGO_HORA_EXTRA;

  var alternativas = [];
  var mejor = null;

  // Se prueba desde apretar todo en un dia hasta repartirlo con holgura.
  var maxDias = Math.max(1, Math.ceil(horasTotales / Math.max(0.5, jornadaNormal)) + 1);

  for (var dias = 1; dias <= maxDias; dias++) {
    // No cabe ni usando todas las horas extra legales: alternativa invalida.
    if (horasTotales > dias * topeLegalDia + 1e-9) continue;

    var horasExtra = Math.max(0, horasTotales - dias * jornadaNormal);
    if (horasExtra > dias * extraMax + 1e-9) continue;

    var noches = dias - 1;
    var hotel = noches * personas * p.P_HOTEL;
    var viatico = dias * nTecnicos * p.P_VIATICO;
    var sobretiempo = horasExtra * nTecnicos * costoHoraExtra;
    var porDia = (costoPorDia || 0) * dias;

    var opcion = {
      dias: dias,
      noches: noches,
      horasExtra: redondear_(horasExtra, 2),
      hotel: Math.round(hotel),
      viatico: Math.round(viatico),
      sobretiempo: Math.round(sobretiempo),
      costoPorDia: Math.round(porDia),
      total: Math.round(costoTransporte + hotel + viatico + sobretiempo + porDia),
      etiqueta: (dias === 1)
        ? 'Ida y vuelta el mismo dia'
        : (dias === 2 ? 'Con una noche fuera' : 'Con ' + noches + ' noches fuera')
    };

    alternativas.push(opcion);
    if (!mejor || opcion.total < mejor.total) mejor = opcion;
  }

  // Si nada calza dentro de la ley, se devuelve la reparticion minima viable
  // para que el plan siga mostrando un numero y la validacion lo marque.
  if (!mejor) {
    var diasMinimos = Math.max(1, Math.ceil(horasTotales / Math.max(0.5, topeLegalDia)));
    mejor = {
      dias: diasMinimos, noches: diasMinimos - 1, horasExtra: 0,
      hotel: Math.round((diasMinimos - 1) * personas * p.P_HOTEL),
      viatico: Math.round(diasMinimos * nTecnicos * p.P_VIATICO),
      sobretiempo: 0, costoPorDia: Math.round((costoPorDia || 0) * diasMinimos),
      total: 0, etiqueta: 'Sin reparticion legal posible'
    };
    mejor.total = Math.round(costoTransporte + mejor.hotel + mejor.viatico + mejor.costoPorDia);
    alternativas.push(mejor);
  }

  // Cuanto se ahorra con la mejor frente a la siguiente: es el argumento.
  var ordenadas = alternativas.slice().sort(function (a, b) { return a.total - b.total; });
  mejor.ahorroFrenteASiguiente = (ordenadas.length > 1)
    ? ordenadas[1].total - ordenadas[0].total : 0;

  return { mejor: mejor, alternativas: ordenadas };
}

/**
 * Cuenta cuanta gente llega a cada sitio en cada dia, sumando TODAS las
 * cuadrillas que coinciden ahi.
 *
 * Existe porque no hay limite de camionetas hacia un destino: si el trabajo
 * conviene hacerlo con seis personas, se mandan dos camionetas de tres y el
 * sitio se termina en la mitad del tiempo. La paralelizacion tiene que mirar
 * el total presente, no la dotacion de un vehiculo.
 *
 * @param {Array} filas  tramos del plan
 * @return {Object} clave "localidad|dia" -> {tecnicos, cuadrillas[], porCuadrilla{}}
 */
function dotacionPorSitio_(filas) {
  var mapa = {};

  for (var i = 0; i < filas.length; i++) {
    var f = filas[i];
    if (!f.hasta || f.hasta === 'BASE') continue;
    if (!f.tecnicos || !f.tecnicos.length) continue;

    var clave = f.hasta + '|' + f.dia;
    if (!mapa[clave]) {
      mapa[clave] = { tecnicos: 0, cuadrillas: [], porCuadrilla: {}, atendidas: 0 };
    }
    var info = mapa[clave];

    // Una cuadrilla puede tener varios tramos que terminan en el mismo sitio
    // el mismo dia; su dotacion se cuenta una sola vez.
    if (info.porCuadrilla[f.cuadrilla] === undefined) {
      info.porCuadrilla[f.cuadrilla] = f.tecnicos.length;
      info.cuadrillas.push(f.cuadrilla);
      info.tecnicos += f.tecnicos.length;
    }
  }
  return mapa;
}

/**
 * Reparte los equipos de un sitio entre las cuadrillas presentes, en
 * proporcion a su dotacion. El resto se le asigna a la primera, de modo que
 * la suma siempre da el total declarado en DESTINOS y ningun equipo se pierde
 * ni se duplica por redondeo.
 */
function repartirEquipos_(equiposDelSitio, info, cuadrillaActual) {
  if (info.cuadrillas.length === 1) return equiposDelSitio;

  var asignado = 0;
  var resultado = {};

  for (var i = 0; i < info.cuadrillas.length; i++) {
    var c = info.cuadrillas[i];
    var parte = Math.floor(equiposDelSitio * info.porCuadrilla[c] / info.tecnicos);
    resultado[c] = parte;
    asignado += parte;
  }

  // El sobrante de la division entera va a la primera cuadrilla.
  resultado[info.cuadrillas[0]] += (equiposDelSitio - asignado);

  return resultado[cuadrillaActual] || 0;
}

function indexarPor_(lista, campo) {
  var mapa = {};
  (lista || []).forEach(function (x) { mapa[x[campo]] = x; });
  return mapa;
}

function redondear_(numero, decimales) {
  var factor = Math.pow(10, decimales);
  return Math.round(numero * factor) / factor;
}

/* ==========================================================================
 * COMPARADOR DE MODOS POR LOCALIDAD
 * --------------------------------------------------------------------------
 * Evalua el viaje completo de ida y vuelta por cada modo, para la dotacion
 * asignada, y dice cual sale mas barato. Alimenta la pestana Transporte.
 * ========================================================================== */

/**
 * Compara TODAS las formas razonables de atender una localidad y devuelve la
 * mas barata de cada modo de transporte.
 *
 * Antes esta funcion asumia una cuadrilla fija de tres personas y por eso
 * entregaba disparates: mandaba tres tecnicos a Tome a instalar UN equipo,
 * pagaba tres hoteles y seis viaticos, y daba $475.060 por un trabajo de dos
 * horas. Con un tecnico en bus el mismo trabajo cuesta menos de la mitad y se
 * demora exactamente lo mismo, porque un equipo lo instala una persona.
 *
 * Ahora, para cada modo, se prueban las dotaciones que de verdad cambian el
 * tiempo (ver dotacionesUtiles_) y se elige la combinacion mas barata de
 * cuanta gente mandar y en que mandarla.
 */
function compararModos_(destino, nTecnicosSugerido, ctx) {
  var p = ctx.p;
  var d = ctx.destinos[destino];
  if (!d || destino === 'BASE') return null;

  var equipos = d.equipos || 0;
  var enRM = String(d.enRM || '').toLowerCase().indexOf('s') === 0;

  var ruta = obtenerRuta_(ctx.rutas, 'BASE', destino, false);
  var km = ruta ? ruta.km : (d.km || 0);
  var horasIda = ruta ? ruta.horas : (d.horas || 0);
  var peaje = calcularPeajeTramo_('BASE', destino, p, ctx.ajustesPeaje).total;

  var dotaciones = dotacionesUtiles_(equipos);

  // Salir de la region con una sola persona deja al tecnico sin respaldo a
  // cientos de kilometros. Si jefatura exige ir de a dos, se descartan las
  // dotaciones menores aunque sean mas baratas.
  var minimoFuera = enRM ? 1 : (p.P_MIN_TECNICOS_FUERA_RM || 1);
  dotaciones = dotaciones.filter(function (n) { return n >= minimoFuera; });
  if (!dotaciones.length) dotaciones = [minimoFuera];

  /**
   * Evalua un modo con una dotacion concreta y devuelve el costo del viaje
   * completo, ya con la reparticion de dias mas barata.
   */
  var evaluar = function (modo, n, horasIdaModo, costoTransporte, costoPorDia,
                          aplicable, nota, desgloseTiempo, desgloseCosto) {
    var sitio = horasEnSitio_(equipos, n, true, p);
    var horasTotales = 2 * horasIdaModo + sitio.total;

    var prog = mejorProgramacion_(horasTotales, n, costoTransporte, costoPorDia, p);
    var m = prog.mejor;

    // REGLA DEL VIATICO: solo fuera de la RM y solo si el viaje dura mas de un
    // dia. Ir y volver a Maipu no genera viatico, y tampoco ir y volver a
    // Talca en el mismo dia: el tecnico llega a dormir a su casa.
    var cumpleRegion = !p.P_VIATICO_SOLO_FUERA_RM || !enRM;
    var cumpleDuracion = !p.P_VIATICO_SOLO_CON_PERNOCTACION || m.dias > 1;
    var viatico = (cumpleRegion && cumpleDuracion) ? m.dias * n * p.P_VIATICO : 0;

    var total = costoTransporte + m.costoPorDia + m.hotel + viatico + m.sobretiempo;

    return {
      modo: modo,
      dotacion: n,
      aplicable: aplicable,
      nota: nota || '',
      dias: m.dias,
      noches: m.noches,
      horasIda: redondear_(horasIdaModo, 2),
      horasTotales: redondear_(horasTotales, 2),
      horasEnSitio: redondear_(sitio.total, 2),
      horasExtra: m.horasExtra,
      sobretiempo: m.sobretiempo,
      programacion: m.etiqueta,
      desgloseTiempo: desgloseTiempo || [],
      desgloseCosto: desgloseCosto || [],
      transporte: Math.round(costoTransporte + m.costoPorDia),
      hotel: m.hotel,
      viatico: Math.round(viatico),
      motivoViatico: viatico
        ? 'Fuera de la RM y con pernoctacion'
        : (!cumpleRegion ? 'Dentro de la RM: el tecnico duerme en su casa'
                         : 'Ida y vuelta el mismo dia: no corresponde'),
      total: Math.round(total)
    };
  };

  /** De todas las dotaciones probadas para un modo, se queda con la barata. */
  var mejorDe = function (candidatas) {
    var validas = candidatas.filter(function (c) { return c; });
    if (!validas.length) return null;
    validas.sort(function (a, b) { return a.total - b.total; });
    var elegida = validas[0];
    elegida.dotacionesEvaluadas = validas.map(function (c) {
      return { dotacion: c.dotacion, total: c.total, dias: c.dias, noches: c.noches };
    });
    return elegida;
  };

  var opciones = [];

  /* --- CAMIONETA ---------------------------------------------------------
   * El vehiculo cuesta lo mismo vaya uno o tres, pero caben
   * P_CAPACIDAD_CAMIONETA personas: mas gente son mas camionetas, y cada una
   * gasta su propio combustible y paga su propio peaje.                   */
  opciones.push(mejorDe(dotaciones.map(function (n) {
    var vehiculos = Math.ceil(n / p.P_CAPACIDAD_CAMIONETA);
    var combustible = vehiculos * (2 * km / p.P_RENDIMIENTO) * p.P_DIESEL;
    var peajes = vehiculos * 2 * peaje;
    var desgaste = vehiculos * 2 * km * p.P_COSTO_KM;

    return evaluar('Camioneta', n, horasIda, combustible + peajes + desgaste, 0,
      km > 0 && horasIda > 0,
      km > 0 && horasIda > 0 ? '' : 'Sin distancia valida. Actualice Maps.',
      [{ concepto: 'Manejar de la base al cliente', horas: redondear_(horasIda, 2),
         detalle: 'Puerta a puerta, ' + redondear_(km, 1) + ' km' }],
      [{ concepto: 'Combustible ida y vuelta', monto: Math.round(combustible),
         detalle: vehiculos + ' camioneta(s), ' +
                  redondear_(vehiculos * 2 * km / p.P_RENDIMIENTO, 1) + ' litros' },
       { concepto: 'Peajes ida y vuelta', monto: Math.round(peajes),
         detalle: vehiculos + ' camioneta(s) por las plazas del trayecto' },
       { concepto: 'Desgaste del vehiculo', monto: Math.round(desgaste),
         detalle: redondear_(vehiculos * 2 * km, 1) + ' km a ' +
                  formatearPesos_(p.P_COSTO_KM) + ' el km' }]);
  })));

  /* --- TRANSPORTE PUBLICO ------------------------------------------------
   * Dentro de Santiago la cuadrilla se mueve en metro o micro con la mochila
   * de herramientas. No se estaba comparando, y en la RM suele ser la opcion
   * mas barata con diferencia.                                            */
  // El pasaje de la Red solo sirve en el Gran Santiago. Melipilla es RM pero
  // esta a 62 km: ahi no llega la micro urbana.
  var alcanceUrbano = km > 0 && km <= (p.P_KM_MAX_TRANSPORTE_PUBLICO || 40);
  if (p.P_PERMITE_TRANSPORTE_PUBLICO && enRM && alcanceUrbano) {
    opciones.push(mejorDe(dotaciones.map(function (n) {
      var pasajes = 2 * n * p.P_TRANSPORTE_PUBLICO;
      var factor = p.P_FACTOR_TRANSPORTE_PUBLICO || 2;
      var horasPublico = horasIda * factor;

      return evaluar('Transporte publico', n, horasPublico, pasajes, 0,
        true,
        'Dentro de la Region Metropolitana, con la mochila de herramientas al hombro.',
        [{ concepto: 'Metro o micro hasta el cliente',
           horas: redondear_(horasPublico, 2),
           detalle: 'Aproximadamente ' + factor + ' veces lo que demora la camioneta' }],
        [{ concepto: 'Pasajes ida y vuelta', monto: Math.round(pasajes),
           detalle: n + ' tecnico(s) x 2 tramos x ' +
                    formatearPesos_(p.P_TRANSPORTE_PUBLICO) },
         { concepto: 'Combustible, peaje y desgaste', monto: 0,
           detalle: 'No aplica: no se usa vehiculo de la empresa' }]);
    })));
  }

  /* --- BUS ---------------------------------------------------------------- */
  if (p.P_PERMITE_BUS && (d.pasajeBus || 0) > 0) {
    opciones.push(mejorDe(dotaciones.map(function (n) {
      var tb = d.pasajeBus;
      var horasBus = (d.horasBus || 0) + p.P_TIEMPO_A_AEROPUERTO_H;
      var pasajes = 2 * tb * n;
      var flete = 2 * p.P_FLETE_HERRAMIENTAS;
      var taxi = 2 * p.P_KM_TERMINAL_CIUDAD * p.P_TAXI_POR_KM;
      var taxiDia = p.P_KM_TAXI_DIA * p.P_TAXI_POR_KM;

      return evaluar('Bus', n, horasBus, pasajes + flete + taxi, taxiDia,
        p.P_HERRAMIENTAS_TRANSPORTABLES,
        p.P_HERRAMIENTAS_TRANSPORTABLES ? ''
          : 'No ejecutable: la configuracion dice que las herramientas no se separan ' +
            'de la camioneta',
        [{ concepto: 'Llegar al terminal',
           horas: redondear_(p.P_TIEMPO_A_AEROPUERTO_H, 2),
           detalle: 'De la base al terminal de buses' },
         { concepto: 'Viaje en bus', horas: redondear_(d.horasBus || 0, 2),
           detalle: 'Recorrido segun la empresa' }],
        [{ concepto: 'Pasajes ida y vuelta', monto: Math.round(pasajes),
           detalle: n + ' tecnico(s) x 2 tramos x ' + formatearPesos_(tb) },
         { concepto: 'Mochilas de herramientas', monto: Math.round(flete),
           detalle: 'En bus la mochila viaja gratis en la bodega del vehiculo' },
         { concepto: 'Taxi del terminal a la ciudad', monto: Math.round(taxi),
           detalle: '2 carreras de ' + p.P_KM_TERMINAL_CIUDAD + ' km' }]);
    })));
  }

  /* --- AVION --------------------------------------------------------------- */
  if (p.P_PERMITE_AVION && (d.pasajeAvion || 0) > 0) {
    opciones.push(mejorDe(dotaciones.map(function (n) {
      var ta = d.pasajeAvion;
      var horasAvion = p.P_TIEMPO_A_AEROPUERTO_H + p.P_CHECKIN_AEROPUERTO_H +
                       (d.horasAvion || 0) + p.P_RETIRO_EQUIPAJE_H +
                       p.P_TIEMPO_A_AEROPUERTO_H;
      var pasajes = 2 * ta * n;
      var equipaje = 2 * p.P_EQUIPAJE_BODEGA_AVION * n;
      var taxi = 4 * p.P_KM_TERMINAL_CIUDAD * p.P_TAXI_POR_KM;
      var taxiDia = p.P_KM_TAXI_DIA * p.P_TAXI_POR_KM;

      return evaluar('Avion', n, horasAvion, pasajes + equipaje + taxi, taxiDia,
        p.P_HERRAMIENTAS_TRANSPORTABLES,
        p.P_HERRAMIENTAS_TRANSPORTABLES ? ''
          : 'No ejecutable: la configuracion dice que las herramientas no se separan ' +
            'de la camioneta',
        [{ concepto: 'De la base al aeropuerto',
           horas: redondear_(p.P_TIEMPO_A_AEROPUERTO_H, 2), detalle: 'Macul a Pudahuel' },
         { concepto: 'Check-in y embarque',
           horas: redondear_(p.P_CHECKIN_AEROPUERTO_H, 2),
           detalle: 'Con equipaje que facturar hay que llegar antes' },
         { concepto: 'Vuelo', horas: redondear_(d.horasAvion || 0, 2),
           detalle: 'Tiempo en el aire' },
         { concepto: 'Retiro de equipaje', horas: redondear_(p.P_RETIRO_EQUIPAJE_H, 2),
           detalle: 'Esperar las mochilas en la cinta' },
         { concepto: 'Del aeropuerto a la ciudad',
           horas: redondear_(p.P_TIEMPO_A_AEROPUERTO_H, 2),
           detalle: 'Los aeropuertos regionales quedan fuera de la ciudad' }],
        [{ concepto: 'Pasajes ida y vuelta', monto: Math.round(pasajes),
           detalle: n + ' tecnico(s) x 2 tramos x ' + formatearPesos_(ta) },
         { concepto: 'Equipaje de bodega', monto: Math.round(equipaje),
           detalle: n + ' mochila(s) x 2 tramos. Las herramientas no van en cabina' },
         { concepto: 'Taxi a los aeropuertos', monto: Math.round(taxi),
           detalle: '4 carreras de ' + p.P_KM_TERMINAL_CIUDAD + ' km' }]);
    })));
  }

  opciones = opciones.filter(function (o) { return o; });

  var ejecutables = opciones.filter(function (o) { return o.aplicable; })
                            .sort(function (a, b) { return a.total - b.total; });
  var todas = opciones.slice().sort(function (a, b) { return a.total - b.total; });
  var masRapido = opciones.slice().sort(function (a, b) {
    return a.horasTotales - b.horasTotales; })[0];

  var mejor = ejecutables.length ? ejecutables[0] : null;

  return {
    localidad: destino,
    equipos: equipos,
    enRM: enRM,
    // La dotacion ya no se impone desde afuera: la elige el costo.
    tecnicos: mejor ? mejor.dotacion : nTecnicosSugerido,
    dotacionesEvaluadas: dotaciones,
    opciones: opciones,
    masEconomico: mejor ? mejor.modo : 'Sin datos suficientes',
    dotacionRecomendada: mejor ? mejor.dotacion : 0,
    costoRecomendado: mejor ? mejor.total : 0,
    masRapido: masRapido ? masRapido.modo : 'Sin datos suficientes',
    masEconomicoTeorico: todas.length ? todas[0].modo : '',
    ahorroSiSeLibera: (todas.length && mejor && todas[0].modo !== mejor.modo)
      ? Math.round(mejor.total - todas[0].total) : 0
  };
}
