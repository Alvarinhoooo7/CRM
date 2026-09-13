/**
 * ============================================================================
 *  SERVICIO TECNICO EN RUTA · v2 · 05_Datos.gs
 *  Lectura del libro. Unico archivo que traduce celdas a objetos.
 * ============================================================================
 *
 *  REGLA DE RENDIMIENTO: cada hoja se lee UNA SOLA VEZ con getDataRange() y
 *  todo el resto ocurre en memoria. Nunca un getValue() dentro de un bucle:
 *  en Apps Script cada llamada al servicio de hojas cuesta cientos de
 *  milisegundos y un plan de 60 tramos se volveria inusable.
 *
 *  Los parametros se leen por NAMED RANGE, no por coordenada. Asi el jefe de
 *  servicio puede insertar filas en CONFIG sin romper el motor.
 * ============================================================================
 */

/**
 * Lee todo lo que el motor necesita, en el menor numero de llamadas posible.
 * @return {Object} datos listos para calcularPlan_()
 */
function leerDatosDelLibro_() {
  var libro = obtenerLibro_();

  var faltantes = [];
  [HOJAS.CONFIG, HOJAS.DESTINOS, HOJAS.PLAN].forEach(function (h) {
    if (!libro.getSheetByName(h.nombre)) faltantes.push(h.nombre);
  });
  if (faltantes.length) {
    throw new Error('Faltan hojas en el libro: ' + faltantes.join(', ') + '. ' +
                    'Use el menu "Servicio Tecnico" y ejecute "Crear o restaurar ' +
                    'hojas base".');
  }

  var parametros = leerParametros_(libro);
  var tablas = leerTablas_(libro);
  var destinos = leerDestinos_(libro, tablas);
  var tramos = leerPlan_(libro, tablas.TECNICOS);

  return {
    libro: libro,
    parametros: parametros,
    destinos: destinos,
    tramos: tramos,
    tecnicos: tablas.TECNICOS,
    flota: tablas.FLOTA,
    tarifas: tablas.TARIFAS_TRANSPORTE,
    ajustesPeaje: tablas.AJUSTES_PEAJE_MAPA,
    tablas: tablas
  };
}

/* ==========================================================================
 * PARAMETROS
 * ========================================================================== */

/** Lee los 76 parametros por named range y los devuelve tipados. */
function leerParametros_(libro) {
  var salida = {};
  var sinDefinir = [];

  listarParametros_().forEach(function (entrada) {
    var def = entrada.definicion;
    var rango = libro.getRangeByName(def.clave);

    if (!rango) {
      sinDefinir.push(def.clave);
      salida[def.clave] = def.valor;   // se cae al valor de siembra
      return;
    }
    salida[def.clave] = convertirValor_(rango.getValue(), def);
  });

  if (sinDefinir.length) {
    // Esto pasa cuando el sistema incorpora parametros nuevos y la hoja CONFIG
    // se creo antes. La solucion NO es reinstalar, que borraria el plan: hay
    // una accion que agrega solo lo que falta y conserva todo lo demas.
    throw new Error(
      'A la hoja CONFIG le faltan ' + sinDefinir.length + ' parametros que el sistema ' +
      'necesita: ' + sinDefinir.join(', ') + '. ' +
      'Pasa cuando se agregan funciones nuevas y la hoja se creo antes. NO reinstale: ' +
      'perderia el plan. ' +
      'SOLUCION: en la pestana Configuracion de esta aplicacion presione "Actualizar ' +
      'CONFIG con parametros nuevos". Tambien esta en el menu de la planilla, en ' +
      'Servicio Tecnico. Agrega solo lo que falta y no toca ningun valor existente.');
  }

  validarParametros_(salida);
  return salida;
}

/** Convierte lo que devuelve la celda al tipo que espera el motor. */
function convertirValor_(crudo, def) {
  if (def.tipo === 'lista' && def.validacion && def.validacion.valores &&
      typeof def.validacion.valores[0] === 'boolean') {
    var texto = String(crudo).trim().toLowerCase();
    return (texto === 'si' || texto === 'sí' || texto === 'true' || crudo === true);
  }
  if (def.tipo === 'numero' || def.tipo === 'entero' ||
      def.tipo === 'moneda' || def.tipo === 'porcentaje') {
    var n = Number(crudo);
    return isNaN(n) ? def.valor : n;
  }
  if (def.tipo === 'fecha') {
    return (crudo instanceof Date) ? crudo : new Date(crudo);
  }
  return crudo;
}

/**
 * Verifica los parametros contra su propia definicion antes de calcular nada.
 * Un error aqui se reporta con el nombre humano del parametro, no con la clave
 * tecnica: el que lo va a corregir es el jefe de servicio, no un programador.
 */
function validarParametros_(valores) {
  var problemas = [];

  listarParametros_().forEach(function (entrada) {
    var def = entrada.definicion;
    var v = valores[def.clave];
    var reglas = def.validacion;
    if (!reglas) return;

    if (typeof reglas.min === 'number' && typeof v === 'number') {
      if (v < reglas.min || v > reglas.max) {
        problemas.push('"' + def.etiqueta + '" vale ' + v + ' ' + def.unidad +
                       ' y debe estar entre ' + reglas.min + ' y ' + reglas.max + '.');
      }
    }
    if (reglas.valores && typeof reglas.valores[0] === 'string') {
      if (reglas.valores.indexOf(v) === -1) {
        problemas.push('"' + def.etiqueta + '" vale "' + v + '" y solo admite: ' +
                       reglas.valores.join(', ') + '.');
      }
    }
  });

  // Coherencias que ninguna celda puede validar sola.
  if (valores.P_JORNADA_DIA > valores.P_JORNADA_DIA_MAX) {
    problemas.push('La jornada diaria efectiva (' + valores.P_JORNADA_DIA + ' h) no puede ' +
                   'superar la contractual (' + valores.P_JORNADA_DIA_MAX + ' h).');
  }

  if (problemas.length) {
    throw new Error('Hay ' + problemas.length + ' parametros fuera de rango en CONFIG:\n\n' +
                    problemas.join('\n'));
  }
}

/* ==========================================================================
 * TABLAS MAESTRAS
 * ========================================================================== */

/** Lee todas las tablas de CONFIG por named range, en una pasada. */
function leerTablas_(libro) {
  var salida = {};

  var mapear = function (clave, campos) {
    var def = ESQUEMA_TABLAS[clave];
    var rango = libro.getRangeByName(def.rango);
    if (!rango) return [];

    return rango.getValues()
      .filter(function (f) { return String(f[0] || '').trim() !== ''; })
      .map(function (f) {
        var obj = {};
        campos.forEach(function (campo, i) { obj[campo] = f[i]; });
        return obj;
      });
  };

  salida.TECNICOS = mapear('TECNICOS',
    ['codigo', 'nombre', 'licencia', 'activo', 'email', 'telefono'])
    .filter(function (t) { return t.activo === 'Si'; });

  salida.FLOTA = mapear('FLOTA',
    ['codigo', 'modelo', 'patente', 'estado', 'herramientas']);

  salida.TARIFAS_TRANSPORTE = mapear('TARIFAS_TRANSPORTE',
    ['localidad', 'pasajeBus', 'horasBus', 'pasajeAvion', 'horasAvion',
     'terminal', 'vigencia']);

  salida.CHECKLIST = mapear('CHECKLIST', ['orden', 'item', 'categoria']);

  salida.FERIADOS = mapear('FERIADOS', ['fecha', 'motivo']);

  var ajustes = mapear('AJUSTES_PEAJE', ['codigo', 'monto', 'motivo']);
  salida.AJUSTES_PEAJE = ajustes;
  salida.AJUSTES_PEAJE_MAPA = {};
  ajustes.forEach(function (a) {
    if (a.codigo && a.monto !== '') salida.AJUSTES_PEAJE_MAPA[a.codigo] = Number(a.monto);
  });

  return salida;
}

/* ==========================================================================
 * DESTINOS
 * ========================================================================== */

function leerDestinos_(libro, tablas) {
  var hoja = libro.getSheetByName(HOJAS.DESTINOS.nombre);
  var datos = hoja.getDataRange().getValues();

  var tarifas = {};
  (tablas.TARIFAS_TRANSPORTE || []).forEach(function (t) { tarifas[t.localidad] = t; });

  var salida = [];
  var vistos = {};

  // Fila 1 titulo, fila 2 encabezados, datos desde la 3.
  for (var i = 2; i < datos.length; i++) {
    var f = datos[i];
    var localidad = String(f[0] || '').trim();
    if (!localidad) continue;

    if (vistos[localidad]) {
      throw new Error('La localidad "' + localidad + '" esta repetida en DESTINOS ' +
                      '(fila ' + (i + 1) + '). Cada localidad debe aparecer una sola vez.');
    }
    vistos[localidad] = true;

    var tar = tarifas[localidad] || {};

    salida.push({
      fila: i + 1,
      localidad: localidad,
      region: String(f[1] || '').trim(),
      direccion: String(f[2] || '').trim(),
      enRM: String(f[3] || '').trim(),
      equipos: Number(f[4]) || 0,
      hotel: String(f[5] || '').trim(),
      linkCapacitacion: String(f[6] || '').trim(),
      corredor: String(f[7] || '').trim(),
      plazas: String(f[8] || '').trim(),
      km: Number(f[9]) || 0,
      horas: Number(f[10]) || 0,
      peaje: Number(f[11]) || 0,
      fuentePeaje: String(f[12] || '').trim(),
      actualizado: f[13] || '',
      pasajeBus: Number(tar.pasajeBus) || 0,
      horasBus: Number(tar.horasBus) || 0,
      pasajeAvion: Number(tar.pasajeAvion) || 0,
      horasAvion: Number(tar.horasAvion) || 0,
      terminal: tar.terminal || ''
    });
  }

  if (!vistos['BASE']) {
    throw new Error('Falta la fila BASE en DESTINOS. Es el origen de todo trayecto: ' +
                    'sin ella no se puede calcular ninguna ruta.');
  }

  var sinDireccion = salida.filter(function (d) { return !d.direccion; });
  if (sinDireccion.length) {
    throw new Error('Estas localidades no tienen direccion exacta en DESTINOS: ' +
                    sinDireccion.map(function (d) { return d.localidad; }).join(', ') +
                    '. Sin direccion, Google Maps no puede calcular el trayecto.');
  }

  return salida;
}

/* ==========================================================================
 * PLAN
 * ========================================================================== */

function leerPlan_(libro, tecnicos) {
  var hoja = libro.getSheetByName(HOJAS.PLAN.nombre);
  var datos = hoja.getDataRange().getValues();

  var nFijas = ESQUEMA_PLAN.columnas.length;
  var codigos = (datos[1] || []).slice(nFijas).map(String);
  var activos = tecnicos.map(function (t) { return t.codigo; });
  var salida = [];

  for (var i = 2; i < datos.length; i++) {
    var f = datos[i];
    var desde = String(f[5] || '').trim();
    var hasta = String(f[6] || '').trim();
    if (!desde && !hasta) continue;   // fila vacia de las que se dejan listas

    var marcados = [];
    for (var t = 0; t < codigos.length; t++) {
      if (f[nFijas + t] === true) {
        if (activos.indexOf(codigos[t]) < 0) throw new Error('PLAN asigna un técnico inactivo: ' + codigos[t]);
        marcados.push(codigos[t]);
      }
    }

    salida.push({
      fila: i + 1,
      n: Number(f[0]) || (salida.length + 1),
      dia: String(f[1] || '').trim(),
      cuadrilla: String(f[2] || '').trim(),
      modo: String(f[3] || 'Camioneta').trim(),
      vehiculo: String(f[4] || '').trim(),
      desde: desde,
      hasta: hasta,
      noches: Number(f[7]) || 0,
      conductor: String(f[8] || '').trim(),
      tecnicos: marcados
    });
  }

  if (!salida.length) {
    throw new Error('La hoja PLAN no tiene ningun tramo. Agregue al menos una fila con ' +
                    'Desde y Hasta, o restaure el plan de referencia desde el menu.');
  }

  // Los tramos se procesan en el orden en que estan: el orden importa porque
  // la decision de rodear un peaje depende de las horas ya gastadas ese dia.
  salida.sort(function (a, b) {
    if (a.dia !== b.dia) return a.dia.localeCompare(b.dia, 'es', { numeric: true });
    if (a.cuadrilla !== b.cuadrilla) return a.cuadrilla.localeCompare(b.cuadrilla);
    return a.n - b.n;
  });

  return salida;
}

/* ==========================================================================
 * ESCRITURA · columnas que llena el sistema
 * ========================================================================== */

/**
 * Vuelca a DESTINOS los km, las horas y el peaje calculados. Se escribe de una
 * sola vez con setValues, no celda por celda.
 */
function escribirCalculadosEnDestinos_(libro, destinos, rutas, p, ajustes) {
  var hoja = libro.getSheetByName(HOJAS.DESTINOS.nombre);
  if (!destinos.length) return 0;

  var filaInicio = destinos[0].fila;
  var matriz = destinos.map(function (d) {
    if (d.localidad === 'BASE') return [0, 0, 0, '—', new Date()];

    var ruta = obtenerRuta_(rutas, 'BASE', d.localidad, false);
    var peaje = calcularPeajeTramo_('BASE', d.localidad, p, ajustes);

    return [
      ruta ? ruta.km : '',
      ruta ? ruta.horas : '',
      peaje.total,
      peaje.estado === 'VERIFICADO' ? 'PLAZAS · verificado' : 'PLAZAS · estimado',
      new Date()
    ];
  });

  hoja.getRange(filaInicio, 10, matriz.length, 5).setValues(matriz);
  return matriz.length;
}

/** Calcula la fecha real de cada dia del plan, saltando fines de semana y feriados. */
function mapearDiasAFechas_(p, feriados) {
  var bloqueados = {};
  (feriados || []).forEach(function (f) {
    if (f.fecha instanceof Date) bloqueados[claveFecha_(f.fecha)] = f.motivo;
  });

  var fechas = {};
  var cursor = new Date(p.P_FECHA_INICIO);
  var total = p.P_HORIZONTE_MAX_DIAS;

  for (var i = 1; i <= total; i++) {
    while (esInhabil_(cursor, bloqueados, p)) {
      cursor.setDate(cursor.getDate() + 1);
    }
    fechas['D' + i] = new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }
  return fechas;
}

function esInhabil_(fecha, bloqueados, p) {
  if (p.P_OMITIR_FIN_SEMANA && (fecha.getDay() === 0 || fecha.getDay() === 6)) return true;
  return !!bloqueados[claveFecha_(fecha)];
}

function claveFecha_(fecha) {
  return fecha.getFullYear() + '-' + (fecha.getMonth() + 1) + '-' + fecha.getDate();
}
