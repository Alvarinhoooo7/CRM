/**
 * ============================================================================
 *  SERVICIO TECNICO EN RUTA · v2 · 11_Comunas.gs
 *  Catalogo de las 346 comunas de Chile, agrupadas por region.
 * ============================================================================
 *
 *  PARA QUE SIRVE
 *  El formulario de agendar deja elegir cualquier comuna del pais, no solo las
 *  16 del caso. Se elige la region, despues la comuna, y el sistema arma solo
 *  la direccion de la municipalidad y le pregunta a Google Maps cuanto hay.
 *
 *  POR QUE NO SE CALCULAN LAS 346 DE UNA
 *  Una formula personalizada en cada celda (=DISTANCIA_MAPS(...)) parece comoda
 *  pero no aguanta: las funciones personalizadas se re-evaluan al abrir el
 *  archivo, al editar cualquier celda y al recargar. Son 346 consultas cada
 *  vez, contra un tope de unas 1.000 diarias por cuenta. A la segunda o tercera
 *  recarga la mayoria devuelve "Error", y ademas no guarda nada: al dia
 *  siguiente vuelve a preguntar lo mismo.
 *
 *  Aca la distancia se consulta SOLO de la comuna que se elige, y queda
 *  guardada en la hoja _RUTAS. La primera vez cuesta una consulta; despues,
 *  ninguna. Con eso el mismo presupuesto diario alcanza para operar meses.
 *
 *  LA DIRECCION
 *  No se guardan 346 direcciones a mano, que seria imposible de mantener y
 *  facil de equivocar. Se arma la consulta como
 *  "Ilustre Municipalidad de <comuna>, <region>, Chile", que es lo que Google
 *  geocodifica bien y apunta justo al edificio municipal. Si una comuna
 *  resuelve mal, se corrige su direccion en la hoja DESTINOS al agendarla.
 *
 *  VERIFICACION
 *  Chile tiene 346 comunas en 16 regiones. verificarComunas_() cuenta el
 *  catalogo y avisa si no cuadra. Antes de usarlo en produccion conviene
 *  contrastar la lista contra la fuente oficial (BCN o SUBDERE): esta cargada
 *  de memoria y puede tener alguna diferencia de nombre o de grafia.
 * ============================================================================
 */

var COMUNAS_CHILE = [
  { numero: 15, region: 'Arica y Parinacota', comunas: [
    'Arica', 'Camarones', 'Putre', 'General Lagos'] },

  { numero: 1, region: 'Tarapaca', comunas: [
    'Iquique', 'Alto Hospicio', 'Pozo Almonte', 'Camina', 'Colchane', 'Huara',
    'Pica'] },

  { numero: 2, region: 'Antofagasta', comunas: [
    'Antofagasta', 'Mejillones', 'Sierra Gorda', 'Taltal', 'Calama', 'Ollague',
    'San Pedro de Atacama', 'Tocopilla', 'Maria Elena'] },

  { numero: 3, region: 'Atacama', comunas: [
    'Copiapo', 'Caldera', 'Tierra Amarilla', 'Chanaral', 'Diego de Almagro',
    'Vallenar', 'Alto del Carmen', 'Freirina', 'Huasco'] },

  { numero: 4, region: 'Coquimbo', comunas: [
    'La Serena', 'Coquimbo', 'Andacollo', 'La Higuera', 'Paiguano', 'Vicuna',
    'Illapel', 'Canela', 'Los Vilos', 'Salamanca', 'Ovalle', 'Combarbala',
    'Monte Patria', 'Punitaqui', 'Rio Hurtado'] },

  { numero: 5, region: 'Valparaiso', comunas: [
    'Valparaiso', 'Casablanca', 'Concon', 'Juan Fernandez', 'Puchuncavi',
    'Quintero', 'Vina del Mar', 'Isla de Pascua', 'Los Andes', 'Calle Larga',
    'Rinconada', 'San Esteban', 'La Ligua', 'Cabildo', 'Papudo', 'Petorca',
    'Zapallar', 'Quillota', 'La Calera', 'Hijuelas', 'La Cruz', 'Nogales',
    'San Antonio', 'Algarrobo', 'Cartagena', 'El Quisco', 'El Tabo',
    'Santo Domingo', 'San Felipe', 'Catemu', 'Llaillay', 'Panquehue',
    'Putaendo', 'Santa Maria', 'Quilpue', 'Limache', 'Olmue',
    'Villa Alemana'] },

  { numero: 13, region: 'Metropolitana de Santiago', comunas: [
    'Santiago', 'Cerrillos', 'Cerro Navia', 'Conchali', 'El Bosque',
    'Estacion Central', 'Huechuraba', 'Independencia', 'La Cisterna',
    'La Florida', 'La Granja', 'La Pintana', 'La Reina', 'Las Condes',
    'Lo Barnechea', 'Lo Espejo', 'Lo Prado', 'Macul', 'Maipu', 'Nunoa',
    'Pedro Aguirre Cerda', 'Penalolen', 'Providencia', 'Pudahuel', 'Quilicura',
    'Quinta Normal', 'Recoleta', 'Renca', 'San Joaquin', 'San Miguel',
    'San Ramon', 'Vitacura', 'Puente Alto', 'Pirque', 'San Jose de Maipo',
    'Colina', 'Lampa', 'Tiltil', 'San Bernardo', 'Buin', 'Calera de Tango',
    'Paine', 'Melipilla', 'Alhue', 'Curacavi', 'Maria Pinto', 'San Pedro',
    'Talagante', 'El Monte', 'Isla de Maipo', 'Padre Hurtado', 'Penaflor'] },

  { numero: 6, region: "Libertador General Bernardo O'Higgins", comunas: [
    'Rancagua', 'Codegua', 'Coinco', 'Coltauco', 'Donihue', 'Graneros',
    'Las Cabras', 'Machali', 'Malloa', 'Mostazal', 'Olivar', 'Peumo',
    'Pichidegua', 'Quinta de Tilcoco', 'Rengo', 'Requinoa', 'San Vicente',
    'Pichilemu', 'La Estrella', 'Litueche', 'Marchihue', 'Navidad',
    'Paredones', 'San Fernando', 'Chepica', 'Chimbarongo', 'Lolol',
    'Nancagua', 'Palmilla', 'Peralillo', 'Placilla', 'Pumanque',
    'Santa Cruz'] },

  { numero: 7, region: 'Maule', comunas: [
    'Talca', 'Constitucion', 'Curepto', 'Empedrado', 'Maule', 'Pelarco',
    'Pencahue', 'Rio Claro', 'San Clemente', 'San Rafael', 'Cauquenes',
    'Chanco', 'Pelluhue', 'Curico', 'Hualane', 'Licanten', 'Molina',
    'Rauco', 'Romeral', 'Sagrada Familia', 'Teno', 'Vichuquen', 'Linares',
    'Colbun', 'Longavi', 'Parral', 'Retiro', 'San Javier', 'Villa Alegre',
    'Yerbas Buenas'] },

  { numero: 16, region: 'Nuble', comunas: [
    'Chillan', 'Bulnes', 'Chillan Viejo', 'El Carmen', 'Pemuco', 'Pinto',
    'Quillon', 'San Ignacio', 'Yungay', 'Quirihue', 'Cobquecura', 'Coelemu',
    'Ninhue', 'Portezuelo', 'Ranquil', 'Treguaco', 'San Carlos', 'Coihueco',
    'Niquen', 'San Fabian', 'San Nicolas'] },

  { numero: 8, region: 'Biobio', comunas: [
    'Concepcion', 'Coronel', 'Chiguayante', 'Florida', 'Hualqui', 'Lota',
    'Penco', 'San Pedro de la Paz', 'Santa Juana', 'Talcahuano', 'Tome',
    'Hualpen', 'Lebu', 'Arauco', 'Canete', 'Contulmo', 'Curanilahue',
    'Los Alamos', 'Tirua', 'Los Angeles', 'Antuco', 'Cabrero', 'Laja',
    'Mulchen', 'Nacimiento', 'Negrete', 'Quilaco', 'Quilleco', 'San Rosendo',
    'Santa Barbara', 'Tucapel', 'Yumbel', 'Alto Biobio'] },

  { numero: 9, region: 'La Araucania', comunas: [
    'Temuco', 'Carahue', 'Cunco', 'Curarrehue', 'Freire', 'Galvarino',
    'Gorbea', 'Lautaro', 'Loncoche', 'Melipeuco', 'Nueva Imperial',
    'Padre Las Casas', 'Perquenco', 'Pitrufquen', 'Pucon', 'Saavedra',
    'Teodoro Schmidt', 'Tolten', 'Vilcun', 'Villarrica', 'Cholchol',
    'Angol', 'Collipulli', 'Curacautin', 'Ercilla', 'Lonquimay',
    'Los Sauces', 'Lumaco', 'Puren', 'Renaico', 'Traiguen', 'Victoria'] },

  { numero: 14, region: 'Los Rios', comunas: [
    'Valdivia', 'Corral', 'Lanco', 'Los Lagos', 'Mafil', 'Mariquina',
    'Paillaco', 'Panguipulli', 'La Union', 'Futrono', 'Lago Ranco',
    'Rio Bueno'] },

  { numero: 10, region: 'Los Lagos', comunas: [
    'Puerto Montt', 'Calbuco', 'Cochamo', 'Fresia', 'Frutillar',
    'Los Muermos', 'Llanquihue', 'Maullin', 'Puerto Varas', 'Castro',
    'Ancud', 'Chonchi', 'Curaco de Velez', 'Dalcahue', 'Puqueldon',
    'Queilen', 'Quellon', 'Quemchi', 'Quinchao', 'Osorno',
    'Puerto Octay', 'Purranque', 'Puyehue', 'Rio Negro', 'San Juan de la Costa',
    'San Pablo', 'Chaiten', 'Futaleufu', 'Hualaihue', 'Palena'] },

  { numero: 11, region: 'Aysen del General Carlos Ibanez del Campo', comunas: [
    'Coyhaique', 'Lago Verde', 'Aysen', 'Cisnes', 'Guaitecas',
    'Cochrane', "O'Higgins", 'Tortel', 'Chile Chico', 'Rio Ibanez'] },

  { numero: 12, region: 'Magallanes y de la Antartica Chilena', comunas: [
    'Punta Arenas', 'Laguna Blanca', 'Rio Verde', 'San Gregorio', 'Cabo de Hornos',
    'Antartica', 'Porvenir', 'Primavera', 'Timaukel', 'Natales', 'Torres del Paine'] }
];

/* ==========================================================================
 * FUNCIONES
 * ========================================================================== */

/**
 * Arma la consulta que se le manda a Google Maps para una comuna.
 * Apunta al edificio municipal, que es donde se hace el tramite.
 */
function direccionMunicipalidad_(comuna, region) {
  return 'Ilustre Municipalidad de ' + comuna + ', ' + region + ', Chile';
}

/** Lista plana de las 346, con su region. Util para buscadores. */
function listarComunas_() {
  var salida = [];
  COMUNAS_CHILE.forEach(function (r) {
    r.comunas.forEach(function (c) {
      salida.push({
        comuna: c,
        region: r.region,
        numeroRegion: r.numero,
        direccion: direccionMunicipalidad_(c, r.region),
        enRM: r.numero === 13
      });
    });
  });
  return salida;
}

/**
 * Verifica que el catalogo cuadre con la division administrativa vigente.
 * Chile tiene 346 comunas en 16 regiones.
 */
function verificarComunas_() {
  var total = 0;
  var detalle = COMUNAS_CHILE.map(function (r) {
    total += r.comunas.length;
    return r.region + ': ' + r.comunas.length;
  });

  var duplicadas = {};
  var repetidas = [];
  listarComunas_().forEach(function (c) {
    var clave = c.comuna.toLowerCase();
    if (duplicadas[clave]) repetidas.push(c.comuna + ' (' + c.region + ')');
    duplicadas[clave] = true;
  });

  return {
    total: total,
    regiones: COMUNAS_CHILE.length,
    cuadra: total === 346 && COMUNAS_CHILE.length === 16,
    repetidas: repetidas,
    detalle: detalle,
    mensaje: (total === 346 && COMUNAS_CHILE.length === 16)
      ? 'El catalogo tiene las 346 comunas en 16 regiones.'
      : 'ATENCION: el catalogo tiene ' + total + ' comunas en ' +
        COMUNAS_CHILE.length + ' regiones, y deberian ser 346 en 16. ' +
        'Contraste la lista contra la fuente oficial de la BCN.'
  };
}

/* ==========================================================================
 * ENDPOINTS PARA LA WEB
 * ========================================================================== */

/** Regiones y sus comunas, para llenar los dos selectores del formulario. */
function listarComunasWeb(token) {
  exigirSesion_(token);
  var verificacion = verificarComunas_();
  return {
    regiones: COMUNAS_CHILE.map(function (r) {
      return { region: r.region, numero: r.numero, comunas: r.comunas };
    }),
    total: verificacion.total,
    cuadra: verificacion.cuadra,
    aviso: verificacion.cuadra ? '' : verificacion.mensaje
  };
}

/**
 * Calcula cuanto sale atender una comuna cualquiera del pais.
 *
 * Si la comuna ya esta en DESTINOS se usa esa fila, con su direccion exacta y
 * sus tarifas. Si no, se resuelve contra Maps y se evalua con lo que haya:
 * camioneta siempre, y transporte publico si esta dentro del alcance urbano.
 * Bus y avion quedan fuera porque no hay tarifa cargada para esa comuna, y el
 * sistema lo dice en vez de inventarla.
 *
 * @param {string} token
 * @param {{comuna:string, region:string, equipos:number}} solicitud
 */
function cotizarComuna(token, solicitud) {
  exigirSesion_(token);

  var comuna = String(solicitud.comuna || '').trim();
  var region = String(solicitud.region || '').trim();
  var equipos = Number(solicitud.equipos) || 1;

  if (!comuna) return { ok: false, mensaje: 'Elija una comuna.' };

  var datos = leerDatosDelLibro_();
  var p = aplicarEscenario_(datos.parametros, ESQUEMA_ESCENARIOS.activo);

  // Si ya esta en DESTINOS, se usa esa fila: tiene direccion exacta, tarifas
  // de bus y avion, y plazas de peaje declaradas.
  var yaCargada = datos.destinos.filter(function (d) {
    return d.localidad.toLowerCase() === comuna.toLowerCase(); })[0];

  if (yaCargada) {
    var r = asistenteOrden(token, { localidad: yaCargada.localidad, equipos: equipos });
    r.origenDato = 'Esta comuna ya esta en DESTINOS, con su direccion y tarifas cargadas.';
    return r;
  }

  // Comuna nueva: se le pregunta a Maps por la municipalidad.
  var direccion = direccionMunicipalidad_(comuna, region);
  var direcciones = {};
  datos.destinos.forEach(function (d) { direcciones[d.localidad] = d.direccion; });
  direcciones[comuna] = direccion;

  var rutas = resolverRutas_([{ origen: 'BASE', destino: comuna }],
                             direcciones, datos.parametros, datos.libro);
  var ruta = obtenerRuta_(rutas.rutas, 'BASE', comuna, false);

  if (!ruta) {
    return {
      ok: false,
      mensaje: 'Google Maps no encontro ruta hasta "' + direccion + '". Puede ser una ' +
               'comuna insular o sin acceso por carretera, como Juan Fernandez, Isla de ' +
               'Pascua o la Antartica. Para esos destinos hay que cotizar el transporte ' +
               'aparte.'
    };
  }

  var enRM = (region.toLowerCase().indexOf('metropolitana') !== -1);

  // Se arma un destino temporal, sin tarifas de bus ni avion porque no las hay.
  var destinoTemporal = {
    localidad: comuna, region: region, direccion: direccion,
    enRM: enRM ? 'Si' : 'No', equipos: equipos,
    km: ruta.km, horas: ruta.horas, corredor: '',
    pasajeBus: 0, horasBus: 0, pasajeAvion: 0, horasAvion: 0, hotel: ''
  };

  var mapaDestinos = { 'BASE': { localidad: 'BASE', km: 0, horas: 0, equipos: 0 } };
  mapaDestinos[comuna] = destinoTemporal;

  var ctx = {
    p: p, destinos: mapaDestinos, rutas: rutas.rutas,
    ajustesPeaje: datos.ajustesPeaje, alertas: []
  };

  var comparacion = compararModos_(comuna, p.P_TECNICOS_POR_CUADRILLA, ctx);
  if (!comparacion) return { ok: false, mensaje: 'No se pudo evaluar la comuna.' };

  var rec = comparacion.recomendacion;
  var elegida = rec && rec.elegida;

  var titular = elegida
    ? ('Manda ' + elegida.dotacion + ' tecnico' + (elegida.dotacion > 1 ? 's' : '') +
       ' en ' + elegida.modo.toLowerCase() + '. Sale ' + formatearPesos_(elegida.total) +
       ' y toma ' + elegida.dias + ' dia' + (elegida.dias > 1 ? 's' : '') +
       (elegida.noches ? ' con ' + elegida.noches + ' noche' +
         (elegida.noches > 1 ? 's' : '') + ' de hotel' : ', sin pernoctar') + '.')
    : 'No hay alternativas ejecutables para esta comuna.';

  return {
    ok: true,
    localidad: comuna,
    direccion: direccion,
    region: region,
    enRM: enRM,
    equipos: equipos,
    km: ruta.km,
    horas: ruta.horas,
    hotelReferencia: '',
    titular: titular,
    recomendacion: rec,
    opciones: comparacion.opciones,
    dotacionesEvaluadas: comparacion.dotacionesEvaluadas,
    origenDato: 'Comuna nueva: la distancia la resolvio Google Maps contra la ' +
                'municipalidad. El peaje no esta calculado plaza por plaza porque no ' +
                'hay corredor declarado, y no hay tarifas de bus ni avion cargadas.',
    advertencias: [
      'El peaje de esta comuna no esta en el catalogo MOP: el costo mostrado no lo ' +
      'incluye y el viaje real puede salir mas caro.',
      'Bus y avion no aparecen porque no hay tarifa cargada para este destino. Si ' +
      'existe servicio, hay que cotizarlo y agregarlo.'
    ],
    parametros: {
      capacidadCamioneta: p.P_CAPACIDAD_CAMIONETA,
      viatico: p.P_VIATICO,
      colacion: p.P_COLACION_RM,
      hotel: p.P_HOTEL
    }
  };
}
