/**
 * ============================================================================
 *  SERVICIO TECNICO EN RUTA · v2 · 01_Peajes.gs
 *  Catalogo MOP 2026 de plazas y porticos, perfil CAMIONETA (Categoria 1).
 * ============================================================================
 *
 *  FUENTE: "Guia Ejecutiva de Peajes y Porticos 2026 - Perfil: CAMIONETA" y
 *  "Tarifas Oficiales de Peajes y Porticos de Chile 2026", Ministerio de Obras
 *  Publicas, Direccion General de Concesiones. Vigencia 01-01-2026 a 31-12-2026.
 *
 *  POR QUE ESTA EN EL CODIGO Y NO EN UNA HOJA
 *  Son ~200 filas de datos de referencia que no cambian durante la operacion:
 *  se reajustan una vez al ano. Meterlas en CONFIG llenaria de ruido la unica
 *  hoja que el jefe de servicio edita a diario. La web app las muestra de forma
 *  visual y la tabla AJUSTES DE PEAJE de CONFIG permite corregir un valor
 *  puntual sin tocar codigo.
 *
 *  MODELO DE COBRO
 *  Hay dos formas de cobrar en Chile y el catalogo soporta las dos:
 *   · 'Paso'  -> tarifa fija cada vez que se cruza la plaza o el portico.
 *                Es el caso de troncales, laterales y free flow interurbano.
 *   · 'PorKm' -> tarifa base por kilometro multiplicada por los km recorridos
 *                dentro de la autopista. Es el caso de las urbanas de Santiago.
 *
 *  HORARIOS: normal (TBFP), punta (TBP) y saturacion (TS). El plan corre de
 *  lunes a viernes con salida temprano, asi que P_PEAJE_TARIFA_HORARIO viene
 *  en 'Normal'. Cambiarlo recalcula el plan completo.
 *
 *  VALIDACION DEL MODELO: la suma de los 8 porticos de la Ruta 78 hasta San
 *  Antonio da $4.008 y la guia MOP declara ~$4.010 para ese destino. La suma
 *  plaza por plaza reproduce el total oficial.
 * ============================================================================
 */

/* ==========================================================================
 * A. CATALOGO DE PLAZAS Y PORTICOS · CATEGORIA 1 (auto y camioneta)
 * --------------------------------------------------------------------------
 *   codigo        clave unica, la usa DESTINOS para declarar su ruta
 *   tipo          Troncal | Lateral | Portico TAG
 *   cobro         Paso | PorKm
 *   tarifa        { normal, punta, saturacion } en pesos, categoria 1
 *   tarifaKm      { normal, punta, saturacion } en $/km, solo si cobro PorKm
 *   km            km del tramo, solo si cobro PorKm
 *   ambosSentidos true si cobra al pasar en cada direccion
 *   fuente        seccion de la guia MOP de la que sale el dato
 * ========================================================================== */

var CATALOGO_PLAZAS = [

  /* ---------------------------------------------------------------------
   * RUTA 5 NORTE · Santiago - Los Vilos (MOP 3.1)
   * Porticos free flow de la salida norte, mas plazas troncales.
   * ------------------------------------------------------------------ */
  { codigo: 'R5N_LMA', nombre: 'Portico Lo Marcoleta', concesion: 'Santiago - Los Vilos',
    ruta: 'R5N', tipo: 'Portico TAG', cobro: 'Paso', region: 'Metropolitana', km: 18,
    tarifa: { normal: 181, punta: 362, saturacion: 362 },
    ambosSentidos: true, fuente: 'MOP 3.1' },

  { codigo: 'R5N_BUE', nombre: 'Portico Buenaventura', concesion: 'Santiago - Los Vilos',
    ruta: 'R5N', tipo: 'Portico TAG', cobro: 'Paso', region: 'Metropolitana', km: 24,
    tarifa: { normal: 218, punta: 436, saturacion: 436 },
    ambosSentidos: true, fuente: 'MOP 3.1' },

  { codigo: 'R5N_LMO', nombre: 'Portico La Montana', concesion: 'Santiago - Los Vilos',
    ruta: 'R5N', tipo: 'Portico TAG', cobro: 'Paso', region: 'Metropolitana', km: 33,
    tarifa: { normal: 397, punta: 794, saturacion: 794 },
    ambosSentidos: true, fuente: 'MOP 3.1' },

  { codigo: 'R5N_LPI', nombre: 'Portico Lo Pinto', concesion: 'Santiago - Los Vilos',
    ruta: 'R5N', tipo: 'Portico TAG', cobro: 'Paso', region: 'Metropolitana', km: 40,
    tarifa: { normal: 486, punta: 972, saturacion: 972 },
    ambosSentidos: true, fuente: 'MOP 3.1' },

  { codigo: 'R5N_LAM', nombre: 'Troncal Lampa', concesion: 'Santiago - Los Vilos',
    ruta: 'R5N', tipo: 'Troncal', cobro: 'Paso', region: 'Metropolitana', km: 45,
    tarifa: { normal: 900, punta: 900, saturacion: 900 },
    ambosSentidos: true, fuente: 'MOP 3.1' },

  { codigo: 'R5N_LVE', nombre: 'Troncal Las Vegas', concesion: 'Santiago - Los Vilos',
    ruta: 'R5N', tipo: 'Troncal', cobro: 'Paso', region: 'Valparaiso', km: 85,
    tarifa: { normal: 2900, punta: 2900, saturacion: 2900 },
    ambosSentidos: true, fuente: 'MOP 3.1' },

  { codigo: 'R5N_MEL', nombre: 'Tunel El Melon', concesion: 'Santiago - Los Vilos',
    ruta: 'R5N', tipo: 'Troncal', cobro: 'Paso', region: 'Valparaiso', km: 125,
    tarifa: { normal: 2900, punta: 2900, saturacion: 2900 },
    ambosSentidos: true, fuente: 'MOP 3.1' },

  { codigo: 'R5N_PIC', nombre: 'Troncal Pichidangui', concesion: 'Santiago - Los Vilos',
    ruta: 'R5N', tipo: 'Troncal', cobro: 'Paso', region: 'Coquimbo', km: 195,
    tarifa: { normal: 2900, punta: 2900, saturacion: 2900 },
    ambosSentidos: true, fuente: 'MOP 3.1' },

  /* RUTA 5 NORTE · Los Vilos - La Serena (MOP 3.2) */
  { codigo: 'R5N_ELQ_S', nombre: 'Troncal Sur (Elqui)', concesion: 'Los Vilos - La Serena',
    ruta: 'R5N', tipo: 'Troncal', cobro: 'Paso', region: 'Coquimbo', km: 330,
    tarifa: { normal: 4250, punta: 4250, saturacion: 4250 },
    ambosSentidos: true, fuente: 'MOP 3.2' },

  { codigo: 'R5N_ELQ_N', nombre: 'Troncal Norte (Elqui)', concesion: 'Los Vilos - La Serena',
    ruta: 'R5N', tipo: 'Troncal', cobro: 'Paso', region: 'Coquimbo', km: 490,
    tarifa: { normal: 4250, punta: 4250, saturacion: 4250 },
    ambosSentidos: true, fuente: 'MOP 3.2' },

  { codigo: 'R5N_LAT_CQ', nombre: 'Laterales Combarbala / Ovalle / Tongoy / Guanaqueros',
    concesion: 'Los Vilos - La Serena', ruta: 'R5N', tipo: 'Lateral', cobro: 'Paso',
    region: 'Coquimbo', km: 400,
    tarifa: { normal: 1100, punta: 1100, saturacion: 1100 },
    ambosSentidos: true, fuente: 'MOP 3.2' },

  /* RUTA 5 NORTE · La Serena - Vallenar (MOP 3.3) */
  { codigo: 'R5N_PCO', nombre: 'Troncal Punta Colorada', concesion: 'La Serena - Vallenar',
    ruta: 'R5N', tipo: 'Troncal', cobro: 'Paso', region: 'Coquimbo', km: 560,
    tarifa: { normal: 3150, punta: 3150, saturacion: 3150 },
    ambosSentidos: true, fuente: 'MOP 3.3' },

  { codigo: 'R5N_CAC', nombre: 'Troncal Cachiyuyo', concesion: 'La Serena - Vallenar',
    ruta: 'R5N', tipo: 'Troncal', cobro: 'Paso', region: 'Atacama', km: 650,
    tarifa: { normal: 3150, punta: 3150, saturacion: 3150 },
    ambosSentidos: true, fuente: 'MOP 3.3' },

  /* RUTA 5 NORTE · Vallenar - Caldera (MOP 3.4) */
  { codigo: 'R5N_TOT', nombre: 'Troncal Totoral', concesion: 'Vallenar - Caldera',
    ruta: 'R5N', tipo: 'Troncal', cobro: 'Paso', region: 'Atacama', km: 745,
    tarifa: { normal: 2900, punta: 2900, saturacion: 2900 },
    ambosSentidos: true, fuente: 'MOP 3.4' },

  { codigo: 'R5N_PVI', nombre: 'Troncal Puerto Viejo', concesion: 'Vallenar - Caldera',
    ruta: 'R5N', tipo: 'Troncal', cobro: 'Paso', region: 'Atacama', km: 845,
    tarifa: { normal: 1750, punta: 1750, saturacion: 1750 },
    ambosSentidos: true, fuente: 'MOP 3.4' },

  /* ---------------------------------------------------------------------
   * RUTA 5 SUR · Santiago - Talca (MOP 4.1)
   * ------------------------------------------------------------------ */
  { codigo: 'R5S_TOC', nombre: 'Troncal Tocornal', concesion: 'Santiago - Talca',
    ruta: 'R5S', tipo: 'Troncal', cobro: 'Paso', region: 'Metropolitana', km: 12,
    tarifa: { normal: 207, punta: 207, saturacion: 207 },
    ambosSentidos: true, fuente: 'MOP 4.1' },

  { codigo: 'R5S_GAB', nombre: 'Troncal Gabriela', concesion: 'Santiago - Talca',
    ruta: 'R5S', tipo: 'Troncal', cobro: 'Paso', region: 'Metropolitana', km: 18,
    tarifa: { normal: 621, punta: 621, saturacion: 621 },
    ambosSentidos: true, fuente: 'MOP 4.1' },

  { codigo: 'R5S_RMA', nombre: 'Troncal Rio Maipo', concesion: 'Santiago - Talca',
    ruta: 'R5S', tipo: 'Troncal', cobro: 'Paso', region: 'Metropolitana', km: 25,
    tarifa: { normal: 621, punta: 621, saturacion: 621 },
    ambosSentidos: true, fuente: 'MOP 4.1' },

  { codigo: 'R5S_ANG', nombre: 'Troncal Nueva Angostura', concesion: 'Santiago - Talca',
    ruta: 'R5S', tipo: 'Troncal', cobro: 'Paso', region: 'Metropolitana', km: 60,
    tarifa: { normal: 3800, punta: 3800, saturacion: 3800 },
    ambosSentidos: true, fuente: 'MOP 4.1' },

  { codigo: 'R5S_LAT', nombre: 'Lateral Ruta 5 Sur', concesion: 'Santiago - Talca',
    ruta: 'R5S', tipo: 'Lateral', cobro: 'Paso', region: 'Maule', km: 170,
    tarifa: { normal: 900, punta: 900, saturacion: 900 },
    ambosSentidos: true, fuente: 'MOP 4.1' },

  /* RUTA 5 SUR · Talca - Chillan (MOP 4.2) */
  { codigo: 'R5S_RCL', nombre: 'Troncal Rio Claro', concesion: 'Talca - Chillan',
    ruta: 'R5S', tipo: 'Troncal', cobro: 'Paso', region: 'Maule', km: 290,
    tarifa: { normal: 3300, punta: 3300, saturacion: 3300 },
    ambosSentidos: true, fuente: 'MOP 4.2' },

  { codigo: 'R5S_LAT_TCH', nombre: 'Laterales Talca - Chillan', concesion: 'Talca - Chillan',
    ruta: 'R5S', tipo: 'Lateral', cobro: 'Paso', region: 'Maule', km: 300,
    tarifa: { normal: 800, punta: 800, saturacion: 800 },
    ambosSentidos: true, fuente: 'MOP 4.2' },

  /* RUTA 5 SUR · Chillan - Collipulli (MOP 4.3) */
  { codigo: 'R5S_SCL', nombre: 'Troncal Santa Clara', concesion: 'Chillan - Collipulli',
    ruta: 'R5S', tipo: 'Troncal', cobro: 'Paso', region: 'Nuble', km: 440,
    tarifa: { normal: 3400, punta: 3400, saturacion: 3400 },
    ambosSentidos: true, fuente: 'MOP 4.3' },

  /* RUTA 5 SUR · tramos al sur de Collipulli (MOP 4.4 a 4.7) */
  { codigo: 'R5S_PUA', nombre: 'Troncal Pua', concesion: 'Collipulli - Temuco',
    ruta: 'R5S', tipo: 'Troncal', cobro: 'Paso', region: 'Araucania', km: 580,
    tarifa: { normal: 3600, punta: 3600, saturacion: 3600 },
    ambosSentidos: true, fuente: 'MOP 4.4' },

  { codigo: 'R5S_QUE', nombre: 'Troncal Quepe', concesion: 'Temuco - Rio Bueno',
    ruta: 'R5S', tipo: 'Troncal', cobro: 'Paso', region: 'Araucania', km: 700,
    tarifa: { normal: 3600, punta: 3600, saturacion: 3600 },
    ambosSentidos: true, fuente: 'MOP 4.5' },

  { codigo: 'R5S_LLA', nombre: 'Troncal La Laja', concesion: 'Rio Bueno - Puerto Montt',
    ruta: 'R5S', tipo: 'Troncal', cobro: 'Paso', region: 'Los Lagos', km: 900,
    tarifa: { normal: 3600, punta: 3600, saturacion: 3600 },
    ambosSentidos: true, fuente: 'MOP 4.6' },

  { codigo: 'R5S_TRA', nombre: 'Troncal Trapen', concesion: 'Puerto Montt - Pargua',
    ruta: 'R5S', tipo: 'Troncal', cobro: 'Paso', region: 'Los Lagos', km: 1030,
    tarifa: { normal: 3100, punta: 3100, saturacion: 3100 },
    ambosSentidos: true, fuente: 'MOP 4.7' },

  /* ---------------------------------------------------------------------
   * RUTA 78 · Autopista del Sol, free flow (MOP 5.10)
   * Se cobra cada portico que se cruza. Suma hasta San Antonio: $4.008,
   * que es el total oficial declarado por el MOP (~$4.010).
   * ------------------------------------------------------------------ */
  { codigo: 'R78_AVE', nombre: 'Portico Americo Vespucio', concesion: 'Ruta 78',
    ruta: 'R78', tipo: 'Portico TAG', cobro: 'Paso', region: 'Metropolitana', km: 8,
    tarifa: { normal: 718, punta: 1077, saturacion: 1077 },
    ambosSentidos: true, fuente: 'MOP 5.10' },

  { codigo: 'R78_RIN', nombre: 'Portico Rinconada', concesion: 'Ruta 78',
    ruta: 'R78', tipo: 'Portico TAG', cobro: 'Paso', region: 'Metropolitana', km: 14,
    tarifa: { normal: 330, punta: 495, saturacion: 495 },
    ambosSentidos: true, fuente: 'MOP 5.10' },

  { codigo: 'R78_PHU', nombre: 'Portico Padre Hurtado', concesion: 'Ruta 78',
    ruta: 'R78', tipo: 'Portico TAG', cobro: 'Paso', region: 'Metropolitana', km: 20,
    tarifa: { normal: 225, punta: 337.5, saturacion: 337.5 },
    ambosSentidos: true, fuente: 'MOP 5.10' },

  { codigo: 'R78_MAL', nombre: 'Portico Malloco', concesion: 'Ruta 78',
    ruta: 'R78', tipo: 'Portico TAG', cobro: 'Paso', region: 'Metropolitana', km: 26,
    tarifa: { normal: 225, punta: 337.5, saturacion: 337.5 },
    ambosSentidos: true, fuente: 'MOP 5.10' },

  { codigo: 'R78_TAL', nombre: 'Portico Talagante', concesion: 'Ruta 78',
    ruta: 'R78', tipo: 'Portico TAG', cobro: 'Paso', region: 'Metropolitana', km: 33,
    tarifa: { normal: 375, punta: 562.5, saturacion: 562.5 },
    ambosSentidos: true, fuente: 'MOP 5.10' },

  { codigo: 'R78_PAI', nombre: 'Portico El Paico', concesion: 'Ruta 78',
    ruta: 'R78', tipo: 'Portico TAG', cobro: 'Paso', region: 'Metropolitana', km: 41,
    tarifa: { normal: 375, punta: 562.5, saturacion: 562.5 },
    ambosSentidos: true, fuente: 'MOP 5.10' },

  { codigo: 'R78_POM', nombre: 'Portico Pomaire / Melipilla', concesion: 'Ruta 78',
    ruta: 'R78', tipo: 'Portico TAG', cobro: 'Paso', region: 'Metropolitana', km: 50,
    tarifa: { normal: 599, punta: 898.5, saturacion: 898.5 },
    ambosSentidos: true, fuente: 'MOP 5.10' },

  { codigo: 'R78_PUA', nombre: 'Portico Puangue', concesion: 'Ruta 78',
    ruta: 'R78', tipo: 'Portico TAG', cobro: 'Paso', region: 'Valparaiso', km: 70,
    tarifa: { normal: 1161, punta: 1741.5, saturacion: 1741.5 },
    ambosSentidos: true, fuente: 'MOP 5.10' },

  { codigo: 'R78_VME', nombre: 'Troncal Variante Melipilla', concesion: 'Variante Melipilla',
    ruta: 'R78', tipo: 'Troncal', cobro: 'Paso', region: 'Metropolitana', km: 52,
    tarifa: { normal: 3900, punta: 3900, saturacion: 3900 },
    ambosSentidos: true, fuente: 'MOP 5.11',
    nota: 'Circunvalacion de Melipilla. Solo se cruza si se rodea la ciudad, no si ' +
          'se entra a ella. Por eso NO va en la ruta a Melipilla.' },

  /* ---------------------------------------------------------------------
   * RUTA DEL ITATA · acceso norte al Gran Concepcion (MOP 5.14)
   * ------------------------------------------------------------------ */
  { codigo: 'ITA_NAL', nombre: 'Troncal Nueva Aldea', concesion: 'Ruta del Itata',
    ruta: 'BIO', tipo: 'Troncal', cobro: 'Paso', region: 'Nuble', km: 430,
    tarifa: { normal: 1000, punta: 1000, saturacion: 1000 },
    ambosSentidos: true, fuente: 'MOP 5.14' },

  { codigo: 'ITA_RAF', nombre: 'Troncal Rafael', concesion: 'Ruta del Itata',
    ruta: 'BIO', tipo: 'Troncal', cobro: 'Paso', region: 'Biobio', km: 460,
    tarifa: { normal: 1700, punta: 1700, saturacion: 1700 },
    ambosSentidos: true, fuente: 'MOP 5.14' },

  { codigo: 'ITA_AAM', nombre: 'Troncal Agua Amarilla', concesion: 'Ruta del Itata',
    ruta: 'BIO', tipo: 'Troncal', cobro: 'Paso', region: 'Biobio', km: 490,
    tarifa: { normal: 4400, punta: 4400, saturacion: 4400 },
    ambosSentidos: true, fuente: 'MOP 5.14',
    nota: 'Acceso norte al Gran Concepcion.' },

  /* CONCEPCION - CABRERO (MOP 5.13) · ruta alternativa por Ruta 5 Sur */
  { codigo: 'CCA_HUI', nombre: 'Troncal 1 Huinanco', concesion: 'Concepcion - Cabrero',
    ruta: 'BIO', tipo: 'Troncal', cobro: 'Paso', region: 'Biobio', km: 500,
    tarifa: { normal: 3900, punta: 3900, saturacion: 3900 },
    ambosSentidos: true, fuente: 'MOP 5.13' },

  { codigo: 'CCA_PNE', nombre: 'Troncal 2 Puentes Negros', concesion: 'Concepcion - Cabrero',
    ruta: 'BIO', tipo: 'Troncal', cobro: 'Paso', region: 'Biobio', km: 530,
    tarifa: { normal: 550, punta: 550, saturacion: 550 },
    ambosSentidos: true, fuente: 'MOP 5.13' },

  /* GRAN CONCEPCION · conexiones locales */
  { codigo: 'BIO_PIN', nombre: 'Puente Industrial (Hualpen - San Pedro)',
    concesion: 'Puente Industrial', ruta: 'BIO', tipo: 'Portico TAG', cobro: 'Paso',
    region: 'Biobio', km: 505,
    tarifa: { normal: 772, punta: 772, saturacion: 772 },
    ambosSentidos: true, fuente: 'MOP 2.6',
    nota: 'Opcional: el Puente Llacolen conecta Concepcion con San Pedro sin peaje, ' +
          'con mas congestion.' },

  { codigo: 'BIO_INP', nombre: 'Ruta Interportuaria · ramal Penco',
    concesion: 'Ruta Interportuaria', ruta: 'BIO', tipo: 'Troncal', cobro: 'Paso',
    region: 'Biobio', km: 510,
    tarifa: { normal: 1750, punta: 2500, saturacion: 2500 },
    ambosSentidos: true, fuente: 'MOP 5.15',
    nota: 'Opcional: se puede llegar a Penco por la costanera sin peaje.' },

  { codigo: 'BIO_CHI', nombre: 'Troncal Chivilingo', concesion: 'Ruta 160',
    ruta: 'BIO', tipo: 'Troncal', cobro: 'Paso', region: 'Biobio', km: 560,
    tarifa: { normal: 2750, punta: 2750, saturacion: 2750 },
    ambosSentidos: true, fuente: 'MOP 5.16' },

  { codigo: 'BIO_PIL', nombre: 'Troncal Pilpilco', concesion: 'Ruta 160',
    ruta: 'BIO', tipo: 'Troncal', cobro: 'Paso', region: 'Biobio', km: 620,
    tarifa: { normal: 600, punta: 600, saturacion: 600 },
    ambosSentidos: true, fuente: 'MOP 5.16' },

  /* ---------------------------------------------------------------------
   * AUTOPISTAS URBANAS DE SANTIAGO · cobro por kilometro recorrido
   * --------------------------------------------------------------------
   * El monto depende del tramo que se use, no de un portico unico. Se modela
   * con la tarifa base por km de la guia MOP multiplicada por los km dentro
   * de la autopista, que se declaran en la ruta de cada localidad.
   * SIEMPRE son evitables: por calle se paga $0 y se demora mas. Por eso la
   * ruta urbana de cada localidad es editable.
   * ------------------------------------------------------------------ */
  { codigo: 'URB_ACE', nombre: 'Autopista Central', concesion: 'Autopista Central',
    ruta: 'URB', tipo: 'Portico TAG', cobro: 'PorKm', region: 'Metropolitana',
    tarifaKm: { normal: 113.07, punta: 226.14, saturacion: 339.21 },
    ambosSentidos: true, fuente: 'MOP 2.3',
    nota: 'Eje Norte-Sur y eje General Velasquez.' },

  { codigo: 'URB_CNO', nombre: 'Costanera Norte', concesion: 'Costanera Norte',
    ruta: 'URB', tipo: 'Portico TAG', cobro: 'PorKm', region: 'Metropolitana',
    tarifaKm: { normal: 107.00, punta: 206.00, saturacion: 312.00 },
    ambosSentidos: true, fuente: 'MOP 2.5',
    nota: 'Conecta Pudahuel con Lo Barnechea por el eje Mapocho / Kennedy.' },

  { codigo: 'URB_VSU', nombre: 'Autopista Vespucio Sur', concesion: 'Vespucio Sur',
    ruta: 'URB', tipo: 'Portico TAG', cobro: 'PorKm', region: 'Metropolitana',
    tarifaKm: { normal: 100.49, punta: 200.98, saturacion: 301.47 },
    ambosSentidos: true, fuente: 'MOP 2.9' },

  { codigo: 'URB_VNO', nombre: 'Vespucio Norte Express', concesion: 'Vespucio Norte',
    ruta: 'URB', tipo: 'Portico TAG', cobro: 'PorKm', region: 'Metropolitana',
    tarifaKm: { normal: 100.49, punta: 200.98, saturacion: 301.47 },
    ambosSentidos: true, fuente: 'MOP 2.8' },

  { codigo: 'URB_AVO1', nombre: 'AVO I · Tunel Vespucio Oriente', concesion: 'AVO I',
    ruta: 'URB', tipo: 'Portico TAG', cobro: 'PorKm', region: 'Metropolitana',
    tarifaKm: { normal: 232.00, punta: 464.00, saturacion: 464.00 },
    ambosSentidos: true, fuente: 'MOP 2.4' },

  { codigo: 'URB_AVO2', nombre: 'AVO I · La Piramide', concesion: 'AVO I',
    ruta: 'URB', tipo: 'Portico TAG', cobro: 'PorKm', region: 'Metropolitana',
    tarifaKm: { normal: 116.00, punta: 232.00, saturacion: 232.00 },
    ambosSentidos: true, fuente: 'MOP 2.4' },

  { codigo: 'URB_TSC', nombre: 'Tunel San Cristobal', concesion: 'Tunel San Cristobal',
    ruta: 'URB', tipo: 'Portico TAG', cobro: 'Paso', region: 'Metropolitana',
    tarifa: { normal: 565, punta: 904, saturacion: 1131 },
    ambosSentidos: true, fuente: 'MOP 2.7' },

  { codigo: 'URB_ANO', nombre: 'Acceso Nororiente', concesion: 'Acceso Nororiente',
    ruta: 'URB', tipo: 'Troncal', cobro: 'Paso', region: 'Metropolitana',
    tarifa: { normal: 4116, punta: 6173, saturacion: 6173 },
    ambosSentidos: true, fuente: 'MOP 2.1',
    nota: 'Chicureo y Vitacura. Camioneta de doble rueda trasera paga categoria 2.' },

  { codigo: 'URB_AMB', nombre: 'Acceso Vial Aeropuerto AMB', concesion: 'Acceso AMB',
    ruta: 'URB', tipo: 'Portico TAG', cobro: 'Paso', region: 'Metropolitana',
    tarifa: { normal: 889, punta: 1800, saturacion: 1800 },
    ambosSentidos: true, fuente: 'MOP 2.2',
    nota: 'Sin TAG el cobro manual en caseta es $1.800.' },

  /* ---------------------------------------------------------------------
   * OTRAS RADIALES Y TRANSVERSALES · fuera del plan actual, disponibles
   * para cuando el servicio atienda esos destinos.
   * ------------------------------------------------------------------ */
  { codigo: 'R68_LPZ', nombre: 'Ruta 68 · Lo Prado + Zapata', concesion: 'Ruta 68',
    ruta: 'R68', tipo: 'Troncal', cobro: 'Paso', region: 'Valparaiso', km: 60,
    tarifa: { normal: 5400, punta: 8000, saturacion: 8000 },
    ambosSentidos: true, fuente: 'MOP 5.9',
    nota: 'Valparaiso y Vina del Mar. Son dos plazas de $2.700 cada una.' },

  { codigo: 'LIB_CHA', nombre: 'Troncal Chacabuco', concesion: 'Autopista Los Libertadores',
    ruta: 'R57', tipo: 'Troncal', cobro: 'Paso', region: 'Metropolitana', km: 55,
    tarifa: { normal: 3300, punta: 3300, saturacion: 3300 },
    ambosSentidos: true, fuente: 'MOP 5.5',
    nota: 'Los Andes y San Felipe.' },

  { codigo: 'R66_ARA', nombre: 'Troncal Las Aranas', concesion: 'Ruta 66 Camino de la Fruta',
    ruta: 'R66', tipo: 'Troncal', cobro: 'Paso', region: "O'Higgins", km: 80,
    tarifa: { normal: 2050, punta: 2050, saturacion: 2050 },
    ambosSentidos: true, fuente: 'MOP 5.12', nota: 'Sin TAG: $2.550.' },

  { codigo: 'R66_SPE', nombre: 'Troncal San Pedro', concesion: 'Ruta 66 Camino de la Fruta',
    ruta: 'R66', tipo: 'Troncal', cobro: 'Paso', region: "O'Higgins", km: 110,
    tarifa: { normal: 1100, punta: 1100, saturacion: 1100 },
    ambosSentidos: true, fuente: 'MOP 5.12', nota: 'Sin TAG: $1.400.' },

  { codigo: 'R60_QUI', nombre: 'Ruta 60 CH · Troncal Quillota', concesion: 'Ruta 60 CH',
    ruta: 'R60', tipo: 'Troncal', cobro: 'Paso', region: 'Valparaiso', km: 100,
    tarifa: { normal: 5350, punta: 8050, saturacion: 8050 },
    ambosSentidos: true, fuente: 'MOP 5.7',
    nota: 'Camioneta de doble rueda trasera paga categoria 2 en esta ruta.' },

  { codigo: 'R43_CAR', nombre: 'Ruta 43 · Troncal Las Cardas', concesion: 'Ruta 43',
    ruta: 'R43', tipo: 'Troncal', cobro: 'Paso', region: 'Coquimbo', km: 480,
    tarifa: { normal: 3700, punta: 3700, saturacion: 3700 },
    ambosSentidos: true, fuente: 'MOP 5.4', nota: 'La Serena - Ovalle.' },

  { codigo: 'IQQ_R1', nombre: 'Acceso Iquique · Troncal Ruta 1', concesion: 'Acceso Iquique',
    ruta: 'NOR', tipo: 'Troncal', cobro: 'Paso', region: 'Tarapaca', km: 1780,
    tarifa: { normal: 1550, punta: 1550, saturacion: 1550 },
    ambosSentidos: true, fuente: 'MOP 5.1' },

  { codigo: 'IQQ_R16', nombre: 'Acceso Iquique · Troncal Ruta 16', concesion: 'Acceso Iquique',
    ruta: 'NOR', tipo: 'Troncal', cobro: 'Paso', region: 'Tarapaca', km: 1790,
    tarifa: { normal: 2350, punta: 2350, saturacion: 2350 },
    ambosSentidos: true, fuente: 'MOP 5.1' },

  { codigo: 'ANF_R5', nombre: 'Autopista Antofagasta · Troncal Ruta 5',
    concesion: 'Autopista Antofagasta', ruta: 'NOR', tipo: 'Troncal', cobro: 'Paso',
    region: 'Antofagasta', km: 1360,
    tarifa: { normal: 2850, punta: 2850, saturacion: 2850 },
    ambosSentidos: true, fuente: 'MOP 5.2' },

  { codigo: 'ANF_R1', nombre: 'Autopista Antofagasta · Troncal Ruta 1',
    concesion: 'Autopista Antofagasta', ruta: 'NOR', tipo: 'Troncal', cobro: 'Paso',
    region: 'Antofagasta', km: 1370,
    tarifa: { normal: 1700, punta: 1700, saturacion: 1700 },
    ambosSentidos: true, fuente: 'MOP 5.2' },

  { codigo: 'LOA_CAL', nombre: 'Rutas del Loa · Carmen Alto - Calama', concesion: 'Rutas del Loa',
    ruta: 'NOR', tipo: 'Troncal', cobro: 'Paso', region: 'Antofagasta', km: 1500,
    tarifa: { normal: 3350, punta: 3350, saturacion: 3350 },
    ambosSentidos: true, fuente: 'MOP 5.3' }
];

/* ==========================================================================
 * B. RUTAS DE PEAJE POR LOCALIDAD
 * --------------------------------------------------------------------------
 * Secuencia de plazas que se cruzan desde la BASE hasta cada localidad, en
 * orden. De aqui sale la totalidad del peaje, y el encadenamiento de tramos
 * intermedios (Talca -> Curico) es la diferencia entre dos secuencias.
 *
 *   corredor  agrupa localidades del mismo eje
 *   plazas    codigos del catalogo, en orden desde la base
 *   kmUrbano  km dentro de cada autopista urbana de cobro por km
 *   estado    VERIFICADO  -> contrastado contra un total oficial del MOP
 *             ESTIMADO    -> secuencia armada por geografia, hay que validarla
 *                            en terreno con la primera cartola del TAG
 *
 * El estado viaja hasta el dashboard: un total ESTIMADO nunca se presenta
 * como si fuera auditado.
 * ========================================================================== */

var RUTAS_PEAJE = {

  /* --- Region Metropolitana ------------------------------------------
   * Desde la base en Macul. Los montos urbanos son evitables: por calle se
   * paga $0 y se demora mas. Se asume uso de autopista para cumplir la
   * jornada. Los km de autopista son aproximados y se ajustan con la
   * cartola real del TAG.                                              */
  'BASE':        { corredor: 'URB', plazas: [], kmUrbano: {}, estado: 'VERIFICADO' },

  'Maipu':       { corredor: 'URB', plazas: ['URB_VSU'], kmUrbano: { URB_VSU: 12 },
                   estado: 'ESTIMADO' },

  'Pudahuel':    { corredor: 'URB', plazas: ['URB_VSU', 'URB_CNO'],
                   kmUrbano: { URB_VSU: 8, URB_CNO: 9 }, estado: 'ESTIMADO' },

  'Santiago':    { corredor: 'URB', plazas: ['URB_ACE'], kmUrbano: { URB_ACE: 6 },
                   estado: 'ESTIMADO' },

  'Puente Alto': { corredor: 'URB', plazas: ['URB_VSU'], kmUrbano: { URB_VSU: 10 },
                   estado: 'ESTIMADO' },

  'Lo Barnechea':{ corredor: 'URB', plazas: ['URB_CNO'], kmUrbano: { URB_CNO: 14 },
                   estado: 'ESTIMADO' },

  /* --- Ruta 78 · Autopista del Sol ----------------------------------- */
  'Melipilla':   { corredor: 'R78',
                   plazas: ['R78_AVE', 'R78_RIN', 'R78_PHU', 'R78_MAL', 'R78_TAL',
                            'R78_PAI', 'R78_POM'],
                   kmUrbano: {}, estado: 'VERIFICADO',
                   nota: 'Entra a Melipilla por Pomaire, sin tomar la Variante.' },

  'San Antonio': { corredor: 'R78',
                   plazas: ['R78_AVE', 'R78_RIN', 'R78_PHU', 'R78_MAL', 'R78_TAL',
                            'R78_PAI', 'R78_POM', 'R78_PUA'],
                   kmUrbano: {}, estado: 'VERIFICADO',
                   nota: 'Suma $4.008. El MOP declara ~$4.010 para este destino: la ' +
                         'suma plaza por plaza reproduce el total oficial.' },

  /* --- Ruta 5 Norte --------------------------------------------------- */
  'La Calera':   { corredor: 'R5N',
                   plazas: ['R5N_LMA', 'R5N_BUE', 'R5N_LMO', 'R5N_LPI', 'R5N_LAM',
                            'R5N_LVE'],
                   kmUrbano: {}, estado: 'ESTIMADO' },

  'Coquimbo':    { corredor: 'R5N',
                   plazas: ['R5N_LMA', 'R5N_BUE', 'R5N_LMO', 'R5N_LPI', 'R5N_LAM',
                            'R5N_LVE', 'R5N_MEL', 'R5N_PIC', 'R5N_ELQ_S'],
                   kmUrbano: {}, estado: 'ESTIMADO' },

  'Copiapo':     { corredor: 'R5N',
                   plazas: ['R5N_LMA', 'R5N_BUE', 'R5N_LMO', 'R5N_LPI', 'R5N_LAM',
                            'R5N_LVE', 'R5N_MEL', 'R5N_PIC', 'R5N_ELQ_S', 'R5N_ELQ_N',
                            'R5N_PCO', 'R5N_CAC', 'R5N_TOT'],
                   kmUrbano: {}, estado: 'ESTIMADO',
                   nota: 'Al norte de Copiapo la Ruta 5 sigue con Puerto Viejo, que no ' +
                         'se cruza para llegar a la ciudad.' },

  /* --- Ruta 5 Sur ----------------------------------------------------- */
  'Curico':      { corredor: 'R5S',
                   plazas: ['R5S_TOC', 'R5S_GAB', 'R5S_RMA', 'R5S_ANG'],
                   kmUrbano: {}, estado: 'ESTIMADO' },

  'Talca':       { corredor: 'R5S',
                   plazas: ['R5S_TOC', 'R5S_GAB', 'R5S_RMA', 'R5S_ANG'],
                   kmUrbano: {}, estado: 'ESTIMADO',
                   nota: 'Rio Claro queda al sur de Talca: no se cruza para llegar.' },

  /* --- Biobio · Gran Concepcion, por Ruta 5 Sur y Ruta del Itata ------ */
  'Santa Juana': { corredor: 'R5S',
                   plazas: ['R5S_TOC', 'R5S_GAB', 'R5S_RMA', 'R5S_ANG', 'R5S_RCL',
                            'ITA_NAL', 'ITA_RAF', 'ITA_AAM'],
                   kmUrbano: {}, estado: 'ESTIMADO' },

  'San Pedro de la Paz': { corredor: 'R5S',
                   plazas: ['R5S_TOC', 'R5S_GAB', 'R5S_RMA', 'R5S_ANG', 'R5S_RCL',
                            'ITA_NAL', 'ITA_RAF', 'ITA_AAM', 'BIO_PIN'],
                   kmUrbano: {}, estado: 'ESTIMADO',
                   nota: 'Cruza el Puente Industrial. Por el Puente Llacolen es gratis ' +
                         'pero con mas congestion.' },

  'Penco':       { corredor: 'R5S',
                   plazas: ['R5S_TOC', 'R5S_GAB', 'R5S_RMA', 'R5S_ANG', 'R5S_RCL',
                            'ITA_NAL', 'ITA_RAF', 'ITA_AAM'],
                   kmUrbano: {}, estado: 'ESTIMADO',
                   nota: 'Se llega por la costanera sin tomar la Ruta Interportuaria.' },

  'Tome':        { corredor: 'R5S',
                   plazas: ['R5S_TOC', 'R5S_GAB', 'R5S_RMA', 'R5S_ANG', 'R5S_RCL',
                            'ITA_NAL', 'ITA_RAF', 'ITA_AAM'],
                   kmUrbano: {}, estado: 'ESTIMADO' }
};

/* ==========================================================================
 * C. FUNCIONES DE CALCULO · puras, sin SpreadsheetApp
 * ========================================================================== */

/** Indice del catalogo por codigo. Se arma una vez por ejecucion. */
var _indicePlazas = null;

function indicePlazas_() {
  if (_indicePlazas) return _indicePlazas;
  _indicePlazas = {};
  for (var i = 0; i < CATALOGO_PLAZAS.length; i++) {
    _indicePlazas[CATALOGO_PLAZAS[i].codigo] = CATALOGO_PLAZAS[i];
  }
  return _indicePlazas;
}

/** Traduce el parametro P_PEAJE_TARIFA_HORARIO a la clave del catalogo. */
function claveHorario_(horario) {
  if (horario === 'Punta') return 'punta';
  if (horario === 'Saturacion') return 'saturacion';
  return 'normal';
}

/**
 * Tarifa de una plaza para una pasada, categoria 1.
 * @param {string} codigo   codigo del catalogo
 * @param {string} horario  'Normal' | 'Punta' | 'Saturacion'
 * @param {Object} kmUrbano km dentro de la autopista, si cobra por km
 * @param {Object} ajustes  correcciones manuales por codigo, desde CONFIG
 * @return {number} pesos
 */
function tarifaPlaza_(codigo, horario, kmUrbano, ajustes) {
  if (ajustes && Object.prototype.hasOwnProperty.call(ajustes, codigo)) {
    return Number(ajustes[codigo]) || 0;
  }

  var plaza = indicePlazas_()[codigo];
  if (!plaza) {
    throw new Error('Plaza de peaje desconocida: "' + codigo + '". Revise la ruta de ' +
                    'la localidad o agregue la plaza al catalogo MOP.');
  }

  var clave = claveHorario_(horario);

  if (plaza.cobro === 'PorKm') {
    var km = (kmUrbano && kmUrbano[codigo]) ? Number(kmUrbano[codigo]) : 0;
    return Math.round(plaza.tarifaKm[clave] * km);
  }
  return Math.round(plaza.tarifa[clave]);
}

/** Ruta de peaje de una localidad. Lanza error claro si no esta declarada. */
function rutaPeaje_(localidad) {
  var ruta = RUTAS_PEAJE[localidad];
  if (!ruta) {
    throw new Error('La localidad "' + localidad + '" no tiene ruta de peaje declarada ' +
                    'en RUTAS_PEAJE. Agreguela indicando corredor y plazas.');
  }
  return ruta;
}

/**
 * Peaje de UN TRAMO entre dos localidades, sumando plaza por plaza.
 *
 * Regla de encadenamiento: si ambas localidades estan en el mismo corredor, se
 * cruzan solo las plazas que las separan, es decir la diferencia entre las dos
 * secuencias. Si estan en corredores distintos, el trayecto pasa por Santiago
 * y se pagan las plazas de salida de una mas las de entrada de la otra.
 *
 * Asi un circuito como Talca -> Curico no vuelve a pagar Angostura, y el
 * regreso Copiapo -> Coquimbo paga solo el tramo norte.
 *
 * @param {string} origen   localidad de origen
 * @param {string} destino  localidad de destino
 * @param {Object} p        parametros resueltos de CONFIG
 * @param {Object} ajustes  correcciones manuales por codigo
 * @return {{total:number, detalle:Array, estado:string}}
 */
function calcularPeajeTramo_(origen, destino, p, ajustes) {
  if (origen === destino) return { total: 0, detalle: [], estado: 'VERIFICADO' };

  var rutaOrigen = rutaPeaje_(origen);
  var rutaDestino = rutaPeaje_(destino);
  var horario = p.P_PEAJE_TARIFA_HORARIO || 'Normal';

  var codigos = [];
  var kmUrbano = {};

  if (rutaOrigen.corredor === rutaDestino.corredor) {
    // Mismo eje: solo las plazas que NO comparten. Las comunes ya se pagaron
    // al llegar al primero de los dos, o no se vuelven a cruzar.
    var enOrigen = {};
    for (var i = 0; i < rutaOrigen.plazas.length; i++) enOrigen[rutaOrigen.plazas[i]] = true;
    var enDestino = {};
    for (var j = 0; j < rutaDestino.plazas.length; j++) enDestino[rutaDestino.plazas[j]] = true;

    for (var a = 0; a < rutaDestino.plazas.length; a++) {
      if (!enOrigen[rutaDestino.plazas[a]]) codigos.push(rutaDestino.plazas[a]);
    }
    for (var b = 0; b < rutaOrigen.plazas.length; b++) {
      if (!enDestino[rutaOrigen.plazas[b]]) codigos.push(rutaOrigen.plazas[b]);
    }
    kmUrbano = _fusionarKm_(rutaOrigen.kmUrbano, rutaDestino.kmUrbano);

  } else {
    // Corredores distintos: se vuelve a Santiago y se sale por el otro eje.
    codigos = rutaOrigen.plazas.concat(rutaDestino.plazas);
    kmUrbano = _fusionarKm_(rutaOrigen.kmUrbano, rutaDestino.kmUrbano);
  }

  var total = 0;
  var detalle = [];
  for (var k = 0; k < codigos.length; k++) {
    var monto = tarifaPlaza_(codigos[k], horario, kmUrbano, ajustes);
    var plaza = indicePlazas_()[codigos[k]];
    total += monto;
    detalle.push({
      codigo: codigos[k],
      nombre: plaza.nombre,
      concesion: plaza.concesion,
      tipo: plaza.tipo,
      monto: monto,
      fuente: plaza.fuente
    });
  }

  // El estado mas debil manda: si una de las dos rutas es estimada, el total
  // del tramo es estimado.
  var estado = (rutaOrigen.estado === 'VERIFICADO' && rutaDestino.estado === 'VERIFICADO')
    ? 'VERIFICADO' : 'ESTIMADO';

  return { total: total, detalle: detalle, estado: estado };
}

/** Une dos mapas de km urbanos quedandose con el mayor de cada autopista. */
function _fusionarKm_(a, b) {
  var salida = {};
  var clave;
  for (clave in (a || {})) {
    if (Object.prototype.hasOwnProperty.call(a, clave)) salida[clave] = a[clave];
  }
  for (clave in (b || {})) {
    if (Object.prototype.hasOwnProperty.call(b, clave)) {
      salida[clave] = Math.max(salida[clave] || 0, b[clave]);
    }
  }
  return salida;
}

/** Peaje de ida desde la base hasta una localidad. Alimenta DESTINOS. */
function peajeDesdeBase_(localidad, p, ajustes) {
  return calcularPeajeTramo_('BASE', localidad, p, ajustes);
}

/** Todas las plazas del catalogo que tienen tarifa 0 o fuente pendiente. */
function plazasSinTarifa_() {
  var salida = [];
  for (var i = 0; i < CATALOGO_PLAZAS.length; i++) {
    var pl = CATALOGO_PLAZAS[i];
    var monto = (pl.cobro === 'PorKm') ? pl.tarifaKm.normal : pl.tarifa.normal;
    if (!monto) salida.push(pl.codigo);
  }
  return salida;
}

/** Localidades cuya secuencia de plazas aun no se contrasta con el MOP. */
function rutasEstimadas_() {
  var salida = [];
  for (var localidad in RUTAS_PEAJE) {
    if (Object.prototype.hasOwnProperty.call(RUTAS_PEAJE, localidad)) {
      if (RUTAS_PEAJE[localidad].estado !== 'VERIFICADO') salida.push(localidad);
    }
  }
  return salida;
}
