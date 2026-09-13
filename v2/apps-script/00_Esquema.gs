/**
 * ============================================================================
 *  SERVICIO TECNICO EN RUTA · v2 · 00_Esquema.gs
 *  CONTRATO DE CONFIGURACION: fuente unica de verdad de TODO lo parametrizable.
 * ============================================================================
 *
 *  FUENTE DEL CASO: "Estudio de caso 2", Tecnologia Aplicada a Sistemas
 *  Inteligentes, INACAP Sede Santiago Sur, entrega 14-09-2026.
 *  Cada parametro que sale textual del enunciado lleva fuente: 'PDF'.
 *  Los que no estan en el enunciado llevan fuente: 'JEFATURA' o 'SUPUESTO' y
 *  son los unicos discutibles.
 *
 *  DECISIONES DE ESTA VERSION:
 *   1. Google Maps calcula SOLO kilometros y tiempo de viaje. DESTINOS ya no
 *      pide kilometrajes a mano: pide la DIRECCION.
 *   2. El peaje NO sale de Maps: sale del catalogo de plazas y porticos del
 *      MOP 2026 que mantiene la jefatura, sumando plaza por plaza la
 *      totalidad del trayecto, tarifa de categoria 1 (auto y camioneta).
 *   3. Hotel: $50.000 por noche por persona, siempre.
 *   4. Viatico: $25.000 por tecnico por dia desplegado, siempre. Cubre la
 *      colacion, asi que NO existe un parametro de colacion aparte.
 *   5. Se calculan DOS escenarios en paralelo: el literal del enunciado y el
 *      de operacion real (capacitacion digital previa, una sesion por sitio).
 *      Ver ESQUEMA_ESCENARIOS.
 *
 *  Este archivo es SOLO DATOS. No toca SpreadsheetApp, no calcula, no escribe.
 *  De el se derivan, sin duplicar nada:
 *    · Setup.gs -> construye CONFIG, formatos, validaciones y named ranges.
 *    · Maps.gs  -> sabe que pedirle a Google y donde cachearlo.
 *    · Motor.gs -> recibe los datos ya leidos y valida contra este esquema.
 *    · Api.gs   -> expone el esquema al front para dibujar el formulario de
 *                  configuracion sin hardcodear ni un campo.
 *
 *  REGLA DE ORO: si un numero, un texto, un umbral o una lista aparece en
 *  cualquier otro archivo del proyecto, es un BUG. Todo vive aqui.
 * ============================================================================
 */

/* ==========================================================================
 * A. IDENTIDAD Y FORMATO
 * ========================================================================== */

var APP = {
  NOMBRE: 'Servicio Tecnico en Ruta',
  VERSION: '3.0.0',
  CASO: 'Estudio de caso 2 · INACAP Santiago Sur · entrega 14-09-2026',
  ZONA_HORARIA: 'America/Santiago',
  LOCALE: 'es-CL',
  MONEDA: 'CLP',
  FORMATO_MONEDA: '$#,##0',
  FORMATO_DECIMAL: '#,##0.00',
  FORMATO_ENTERO: '#,##0',
  FORMATO_PORCENTAJE: '0%',
  FORMATO_FECHA: 'dd-mm-yyyy',
  COLOR_PRIMARIO: '#1F3864',
  COLOR_ACENTO: '#C00000',
  COLOR_OK: '#2E7D32',
  COLOR_TOLERANCIA: '#E8A33D',
  COLOR_ALERTA: '#C00000',
  COLOR_CELDA_EDITABLE: '#FFF2CC',
  COLOR_CELDA_CALCULADA: '#E7E6E6',
  MINUTOS_CACHE_MOTOR: 5
};

/* ==========================================================================
 * B. PROPIEDADES DEL SCRIPT (secretos e infraestructura, nunca en la hoja)
 * ========================================================================== */

var PROPIEDADES_SCRIPT = [
  { clave: 'ID_PLANILLA', obligatoria: true,
    descripcion: 'ID del spreadsheet que actua como base de datos. Imprescindible en ' +
                 'modo web app: doGet() no tiene libro activo.' },

  { clave: 'GOOGLE_MAPS_API_KEY', obligatoria: true,
    descripcion: 'Clave de Google Cloud con Routes API habilitada y facturacion activa. ' +
                 'Es obligatoria porque el trayecto se calcula con Maps. Nunca se ' +
                 'devuelve al navegador.' },

  { clave: 'MODO_ACCESO', obligatoria: true, valorPorDefecto: 'GOOGLE',
    valores: ['GOOGLE', 'TOKEN'],
    descripcion: 'GOOGLE: la web app exige cuenta Google y se identifica al tecnico por ' +
                 'su correo. TOKEN: acceso por enlace con clave compartida, para tecnicos ' +
                 'en terreno sin cuenta corporativa.' },

  { clave: 'TOKEN_COORDINACION', obligatoria: false,
    descripcion: 'Clave compartida de la vista de tecnico. Se genera al instalar.' },

  { clave: 'ID_CARPETA_DRIVE', obligatoria: false,
    descripcion: 'Carpeta donde se guardan las ordenes de servicio en PDF y el material ' +
                 'de capacitacion. Vacia = raiz de Drive.' }
];

/* ==========================================================================
 * C. HOJAS DEL LIBRO
 * --------------------------------------------------------------------------
 * Tres hojas visibles de entrada. Las de sistema van ocultas y nadie las edita:
 * son cache, no datos de trabajo.
 * ========================================================================== */

var HOJAS = {
  CONFIG:   { nombre: 'CONFIG',   rol: 'entrada', visible: true,
              descripcion: 'Parametros, tablas maestras y catalogos.' },
  DESTINOS: { nombre: 'DESTINOS', rol: 'entrada', visible: true,
              descripcion: 'Una fila por localidad mas la fila BASE. Se ingresa la ' +
                           'direccion; los km y horas los trae Maps.' },
  PLAN:     { nombre: 'PLAN',     rol: 'entrada', visible: true,
              descripcion: 'Una fila por tramo Desde -> Hasta. Unica hoja donde se planifica.' },
  RUTAS:    { nombre: '_RUTAS',   rol: 'sistema', visible: false,
              descripcion: 'Cache de respuestas de Google Maps por par origen-destino. ' +
                           'Evita repetir consultas y deja trazabilidad de la fuente.' },
  BITACORA: { nombre: '_BITACORA', rol: 'sistema', visible: false,
              descripcion: 'Registro de ejecuciones del motor y cambios de parametros criticos.' }
};

/* ==========================================================================
 * D. PARAMETROS DE CONFIG
 * --------------------------------------------------------------------------
 *   clave      -> nombre del NAMED RANGE. El motor lee por nombre, jamas por
 *                 coordenada, asi mover filas no rompe nada.
 *   fuente     -> PDF | JEFATURA | SUPUESTO. Lo que dice PDF no se negocia.
 *   formula    -> si existe, la celda es CALCULADA: gris y protegida.
 *   critico    -> un cambio aqui obliga a recalcular todo el plan.
 * ========================================================================== */

var ESQUEMA_CONFIG = [

  {
    seccion: 'DATOS DEL CASO (enunciado, no modificar sin justificar)',
    parametros: [
      { clave: 'P_TECNICOS', etiqueta: 'Tecnicos disponibles',
        valor: 10, unidad: 'personas', tipo: 'entero', fuente: 'PDF', critico: true,
        validacion: { min: 1, max: 100 },
        nota: 'PDF: "Cuenta con una cantidad de 10 tecnicos". Debe coincidir con las ' +
              'filas activas de la tabla NOMINA DE TECNICOS.' },

      { clave: 'P_CAMIONETAS', etiqueta: 'Camionetas disponibles',
        valor: 6, unidad: 'unidades', tipo: 'entero', fuente: 'PDF', critico: true,
        validacion: { min: 1, max: 50 },
        nota: 'PDF: "6 camionetas con sus correspondientes herramientas". Define ' +
              'cuantos vehiculos V1..Vn ofrece la lista de PLAN.' },

      { clave: 'P_TECNICOS_POR_CUADRILLA', etiqueta: 'Tecnicos por cuadrilla, valor de referencia',
        valor: 3, unidad: 'personas', tipo: 'entero', fuente: 'JEFATURA', critico: true,
        validacion: { min: 1, max: 10 },
        nota: 'NO ES UN LIMITE, es solo el valor que se usa para estimar cuando todavia no ' +
              'hay un plan: el comparador de transporte y el simulador necesitan suponer un ' +
              'tamano. Cada cuadrilla del plan puede llevar los tecnicos que haga falta, y ' +
              'a un mismo destino pueden ir varias cuadrillas y varias camionetas si esa ' +
              'es la mejor opcion. Quien decide es el costo, no este numero.' },

      { clave: 'P_CAPACIDAD_CAMIONETA', etiqueta: 'Maximo de tecnicos por camioneta',
        valor: 3, unidad: 'personas', tipo: 'entero', fuente: 'JEFATURA', critico: true,
        validacion: { min: 1, max: 8 },
        nota: 'ESTE SI ES UN LIMITE REAL, y es de comodidad: en una Peugeot Partner van ' +
              'tres personas con sus bolsos de herramientas y viajan bien. No limita ' +
              'cuanta gente puede ir a un destino: si el trabajo conviene hacerlo con seis ' +
              'personas, se mandan DOS camionetas de tres. El sistema suma la gente de ' +
              'todas las cuadrillas que llegan al mismo sitio el mismo dia.' },

      { clave: 'P_EXIGIR_TAMANO_CUADRILLA', etiqueta: 'Exigir que todas las cuadrillas tengan ese tamano',
        valor: false, unidad: 'si/no', tipo: 'lista', fuente: 'JEFATURA', critico: true,
        validacion: { valores: [true, false] },
        nota: 'FALSO por decision de jefatura: no hay limite de tecnicos por cuadrilla ni ' +
              'de camionetas hacia un destino, mientras sea la opcion mas conveniente. ' +
              'Ponerlo en verdadero hace que el sistema avise cada vez que una cuadrilla ' +
              'sale con una dotacion distinta a la de referencia, que es util si alguna vez ' +
              'se quiere estandarizar.' },

      { clave: 'P_TECNICOS_MAX_POR_SITIO', etiqueta: 'Maximo de tecnicos trabajando a la vez en un sitio',
        valor: 0, unidad: 'personas', tipo: 'entero', fuente: 'JEFATURA',
        validacion: { min: 0, max: 50 },
        nota: 'Tope fisico de cuantas personas caben trabajando en paralelo en una misma ' +
              'instalacion. 0 significa sin tope: mandar mas gente siempre reduce el tiempo. ' +
              'Si se pone un numero, la paralelizacion deja de mejorar sobre ese limite, ' +
              'porque diez personas en una sala chica se estorban.' },

      { clave: 'P_RENDIMIENTO', etiqueta: 'Rendimiento camioneta Peugeot Partner',
        valor: 20, unidad: 'km/L', tipo: 'numero', fuente: 'PDF', critico: true,
        validacion: { min: 1, max: 60 },
        nota: 'PDF: "Peugeot Partner rendimiento 20km/lts".' },

      { clave: 'P_T_INSTALACION', etiqueta: 'Tiempo de instalacion por equipo',
        valor: 2, unidad: 'h', tipo: 'numero', fuente: 'PDF', critico: true,
        validacion: { min: 0.1, max: 24 },
        nota: 'PDF: "Cada equipo para instalar toma un tiempo 2 hrs".' },

      { clave: 'P_T_CAPACITACION', etiqueta: 'Tiempo de capacitacion',
        valor: 0.5, unidad: 'h', tipo: 'numero', fuente: 'PDF', critico: true,
        validacion: { min: 0, max: 8 },
        nota: 'PDF: "Cada capacitacion toma un tiempo de 30 min".' },

      { clave: 'P_PARALELIZA_INSTALACION', etiqueta: 'Instalacion paralelizable en el sitio',
        valor: true, unidad: 'si/no', tipo: 'lista', fuente: 'JEFATURA', critico: true,
        validacion: { valores: [true, false] },
        nota: 'ESTE ES EL PUNTO CLAVE DEL MODELO. Verdadero: cada tecnico del sitio ' +
              'instala un equipo distinto al mismo tiempo, asi que 3 equipos con 3 ' +
              'tecnicos son 2 h y no 6 h. La formula es ' +
              'techo(equipos / tecnicos_en_sitio) x P_T_INSTALACION, de modo que 5 ' +
              'equipos con 3 tecnicos son 4 h (dos vueltas). Falso: las 2 h por equipo ' +
              'se suman una tras otra.' }
    ]
  },

  {
    seccion: 'MODELO DE CAPACITACION',
    parametros: [
      { clave: 'P_CAP_BASE', etiqueta: 'Base de la capacitacion',
        valor: 'Por localidad', unidad: 'criterio', tipo: 'lista', fuente: 'JEFATURA', critico: true,
        validacion: { valores: ['Por equipo', 'Por localidad'] },
        nota: 'COMO TRABAJAMOS: una sola sesion por sitio visitado, porque se capacita ' +
              'al cliente, no al equipo. Da igual si en ese sitio se instalan 1 o 5 ' +
              'equipos. "Por equipo" es el modo literal del enunciado (33 sesiones) y ' +
              'se calcula igual, en paralelo, para mostrar la diferencia.' },

      { clave: 'P_CAP_DIGITAL_PREVIA', etiqueta: 'Se envia la capacitacion digital antes de la visita',
        valor: true, unidad: 'si/no', tipo: 'lista', fuente: 'JEFATURA', critico: true,
        validacion: { valores: [true, false] },
        nota: 'NUESTRO METODO: al cliente se le manda por correo un enlace de Drive con ' +
              'la capacitacion en detalle antes de que llegue la cuadrilla. La sesion ' +
              'presencial deja de ser una clase y pasa a ser resolver dudas concretas.' },

      { clave: 'P_REDUCCION_CAP', etiqueta: 'Reduccion de tiempo por capacitacion digital previa',
        valor: 0.5, unidad: '%', tipo: 'porcentaje', fuente: 'JEFATURA', critico: true,
        validacion: { min: 0, max: 1 },
        nota: 'Solo aplica si P_CAP_DIGITAL_PREVIA es verdadero. 50% sobre los 30 min ' +
              'del enunciado.' },

      { clave: 'P_T_CAP_EFECTIVA', etiqueta: 'Capacitacion presencial efectiva',
        valor: 0.25, unidad: 'h', tipo: 'numero',
        formula: '=IF(P_CAP_DIGITAL_PREVIA,P_T_CAPACITACION*(1-P_REDUCCION_CAP),P_T_CAPACITACION)',
        nota: 'Calculado: 15 min presenciales para resolver dudas. Es el tiempo que el ' +
              'motor suma en el sitio.' },

      { clave: 'P_CAP_ENVIO_OBLIGATORIO', etiqueta: 'Exigir confirmacion del envio del enlace',
        valor: true, unidad: 'si/no', tipo: 'lista', fuente: 'JEFATURA',
        validacion: { valores: [true, false] },
        nota: 'Si es verdadero, la orden de servicio del tecnico incluye la casilla de ' +
              'confirmar que el correo con el enlace de Drive salio antes de llegar a la ' +
              'localidad, y el sistema alerta_ si una localidad no tiene enlace cargado.' }
    ]
  },

  {
    seccion: 'TRAYECTO · GOOGLE MAPS (solo kilometros y tiempo)',
    parametros: [
      { clave: 'P_MAPS_ALCANCE', etiqueta: 'Que se le pide a Google Maps',
        valor: 'Km y tiempo', unidad: 'alcance', tipo: 'lista', fuente: 'JEFATURA', critico: true,
        validacion: { valores: ['Km y tiempo', 'Km, tiempo y peajes'] },
        nota: 'Km y tiempo: la distancia y la duracion salen de Maps, y el peaje del ' +
              'catalogo MOP de esta hoja. Es el modo elegido, y funciona con el servicio ' +
              'Maps nativo de Apps Script, sin facturacion. "Km, tiempo y peajes" exige ' +
              'Routes API v2 con clave de Google Cloud y facturacion habilitada.' },

      { clave: 'P_BASE', etiqueta: 'Direccion de la base de operaciones',
        valor: 'INACAP Sede Santiago Sur, Av. Vicuna Mackenna 3864, Macul, Chile',
        unidad: 'direccion', tipo: 'texto', fuente: 'JEFATURA', critico: true,
        validacion: { minLargo: 10 },
        nota: 'Origen de todo trayecto. Se geocodifica con Maps. Si la base cambia, ' +
              'se invalida la cache de rutas completa.' },

      { clave: 'P_MAPS_MODO', etiqueta: 'Medio de transporte consultado a Maps',
        valor: 'DRIVE', unidad: 'modo', tipo: 'lista', fuente: 'PDF',
        validacion: { valores: ['DRIVE', 'TRANSIT', 'WALK'] },
        nota: 'DRIVE: la flota es de camionetas. El PDF no contempla otro medio.' },

      { clave: 'P_MAPS_EVITAR_PEAJES', etiqueta: 'Pedir a Maps rutas sin peaje',
        valor: false, unidad: 'si/no', tipo: 'lista', fuente: 'PDF',
        validacion: { valores: [true, false] },
        nota: 'Falso: el PDF pide "considerar traslados y peajes", asi que se ruta por ' +
              'la via rapida y el peaje se paga. Ponerlo en verdadero permite comparar ' +
              'cuanto se ahorra y cuanto tiempo cuesta esquivarlos.' },

      { clave: 'P_MAPS_PREFERENCIA', etiqueta: 'Preferencia de calculo de ruta',
        valor: 'TRAFFIC_AWARE', unidad: 'modo', tipo: 'lista', fuente: 'SUPUESTO',
        validacion: { valores: ['TRAFFIC_UNAWARE', 'TRAFFIC_AWARE', 'TRAFFIC_AWARE_OPTIMAL'] },
        nota: 'TRAFFIC_AWARE da duraciones realistas con costo de cuota moderado. ' +
              'Se consulta con la hora de salida de referencia, no con trafico en vivo.' },

      { clave: 'P_MAPS_HORA_SALIDA', etiqueta: 'Hora de salida de referencia',
        valor: '08:00', unidad: 'hh:mm', tipo: 'texto', fuente: 'SUPUESTO',
        validacion: { patron: '^([01]\\d|2[0-3]):[0-5]\\d$' },
        nota: 'Se envia a Maps como departureTime para estimar trafico. Tambien es la ' +
              'hora en que arranca la jornada en la agenda.' },

      { clave: 'P_FACTOR_HORAS', etiqueta: 'Factor de correccion sobre el tiempo de Maps',
        valor: 1.10, unidad: 'factor', tipo: 'numero', fuente: 'SUPUESTO',
        validacion: { min: 1, max: 2 },
        nota: 'Maps entrega tiempo puerta a puerta de un auto liviano. La camioneta va ' +
              'cargada y para a cargar combustible y a comer. 1,10 = 10% de holgura.' },

      { clave: 'P_MAPS_COMPARA_SIN_PEAJE', etiqueta: 'Consultar tambien la ruta sin peajes',
        valor: true, unidad: 'si/no', tipo: 'lista', fuente: 'JEFATURA', critico: true,
        validacion: { valores: [true, false] },
        nota: 'Verdadero: cada par origen-destino se consulta DOS veces, con y sin ' +
              'peajes, y el sistema compara en pesos cual conviene. Es la unica forma ' +
              'de responder "conviene rodear?" con un numero en vez de una corazonada. ' +
              'Duplica el consumo de cuota de Maps, por eso la cache es importante.' },

      { clave: 'P_RODEO_MAX_HORAS', etiqueta: 'Maximo de tiempo adicional aceptable por rodear',
        valor: 0.75, unidad: 'h', tipo: 'numero', fuente: 'JEFATURA', critico: true,
        validacion: { min: 0, max: 6 },
        nota: 'FRENO DE SEGURIDAD. Sin este tope, el sistema aceptaria rodear tres horas ' +
              'por caminos rurales con tal de ahorrar el peaje, porque en el papel esas ' +
              'horas "caben en la jornada". En la practica un desvio largo en ruta ' +
              'interurbana significa carretera sin doble via, sin bencineras y de noche: ' +
              'no se hace con una camioneta cargada y tres personas. Sobre este tope el ' +
              'rodeo se descarta por seguridad, cueste lo que cueste el peaje.' },

      { clave: 'P_RODEO_AHORRO_MINIMO', etiqueta: 'Ahorro minimo para justificar un rodeo',
        valor: 3000, unidad: '$', tipo: 'moneda', fuente: 'JEFATURA',
        validacion: { min: 0, max: 100000 },
        nota: 'Por menos de esto no vale la pena complicar la ruta ni exponerse a que el ' +
              'desvio salga mal. Evita que el sistema mande a rodear por ahorrar $33.' },

      { clave: 'P_VALORA_TIEMPO_TECNICO', etiqueta: 'Como se valoriza el tiempo de viaje extra',
        valor: 'Solo si genera sobretiempo', unidad: 'criterio', tipo: 'lista',
        fuente: 'JEFATURA', critico: true,
        validacion: { valores: ['Siempre', 'Solo si genera sobretiempo', 'Nunca'] },
        nota: 'ESTE PARAMETRO DECIDE SI CONVIENE RODEAR. "Solo si genera sobretiempo" es ' +
              'lo economicamente correcto: si el tecnico igual estaba en jornada, esa ' +
              'hora ya esta pagada y rodear para ahorrar peaje es ahorro limpio. Si esa ' +
              'hora lo empuja sobre la jornada, cuesta P_COSTO_HORA_TECNICO con recargo, ' +
              'y si lo obliga a pernoctar cuesta hotel mas viatico. "Siempre" valoriza ' +
              'toda hora al costo empresa y "Nunca" la considera gratis: los dos sesgan ' +
              'la decision y estan para comparar.' },

      { clave: 'P_MAPS_CACHE_DIAS', etiqueta: 'Vigencia de la cache de rutas',
        valor: 30, unidad: 'dias', tipo: 'entero', fuente: 'SUPUESTO',
        validacion: { min: 1, max: 365 },
        nota: 'Pasado ese plazo el tramo se vuelve a consultar. Evita gastar cuota en ' +
              'cada recalculo del plan.' },

      { clave: 'P_MAPS_MAX_CONSULTAS', etiqueta: 'Tope de consultas por ejecucion',
        valor: 120, unidad: 'consultas', tipo: 'entero', fuente: 'SUPUESTO',
        validacion: { min: 1, max: 1000 },
        nota: 'Freno de seguridad: si un cambio masivo invalida la cache, el motor se ' +
              'detiene con aviso en vez de vaciar la cuota facturable.' }
    ]
  },

  {
    seccion: 'PEAJES',
    parametros: [
      { clave: 'P_PEAJE_FUENTE', etiqueta: 'Origen del valor de peaje',
        valor: 'PLAZAS', unidad: 'fuente', tipo: 'lista', fuente: 'JEFATURA', critico: true,
        validacion: { valores: ['PLAZAS', 'ACUMULADO', 'MAPS'] },
        nota: 'PLAZAS: se suma plaza por plaza y portico por portico el catalogo MOP ' +
              '2026 de esta hoja, segun las plazas que atraviesa cada tramo. Es el modo ' +
              'elegido: da la totalidad del peaje y es auditable linea por linea. ' +
              'ACUMULADO: respaldo, usa el total de ida por localidad cuando falta el ' +
              'detalle de plazas. MAPS: exige Routes API con facturacion.' },

      { clave: 'P_PEAJE_TARIFA_VIGENCIA', etiqueta: 'Vigencia de las tarifas cargadas',
        valor: '2026', unidad: 'ano', tipo: 'texto', fuente: 'JEFATURA',
        validacion: { patron: '^\\d{4}$' },
        nota: 'Tarifas del Ministerio de Obras Publicas reajustadas para 2026. Se ' +
              'imprime como fuente en el informe y en la orden de servicio.' },

      { clave: 'P_PEAJE_TARIFA_HORARIO', etiqueta: 'Horario tarifario aplicado',
        valor: 'Normal', unidad: 'horario', tipo: 'lista', fuente: 'JEFATURA', critico: true,
        validacion: { valores: ['Normal', 'Punta', 'Fin de semana'] },
        nota: 'Las concesionarias cobran distinto en horario punta y en fin de semana. ' +
              'El catalogo de plazas trae una columna por horario; este parametro elige ' +
              'cual se usa. El plan corre de lunes a viernes con salida temprano, asi ' +
              'que Normal es lo consistente.' },

      { clave: 'P_PEAJE_CATEGORIA', etiqueta: 'Categoria de vehiculo para el peaje',
        valor: 'Categoria 1 · auto y camioneta', unidad: 'categoria', tipo: 'lista',
        fuente: 'PDF', critico: true,
        validacion: { valores: ['Categoria 1 · auto y camioneta',
                                'Categoria 2 · camioneta con remolque',
                                'Categoria 3 · camion de dos ejes'] },
        nota: 'PDF: la flota es Peugeot Partner, categoria 1 en las concesionarias ' +
              'chilenas. Determina la tarifa de cada plaza.' },

      { clave: 'P_PEAJE_AMBOS_SENTIDOS', etiqueta: 'Cobrar peaje en ida y en regreso',
        valor: true, unidad: 'si/no', tipo: 'lista', fuente: 'SUPUESTO', critico: true,
        validacion: { valores: [true, false] },
        nota: 'Verdadero: las plazas troncales cobran en ambos sentidos. El motor ' +
              'imputa el peaje tramo a tramo, de modo que un circuito de varias ' +
              'localidades no paga dos veces la misma plaza.' },

      { clave: 'P_PEAJE_MEDIO_PAGO', etiqueta: 'Medio de pago del peaje',
        valor: 'TAG corporativo', unidad: 'medio', tipo: 'lista', fuente: 'JEFATURA',
        validacion: { valores: ['TAG corporativo', 'Efectivo del tecnico'] },
        nota: 'Si es TAG corporativo, el peaje NO entra en la transferencia al tecnico: ' +
              'lo paga la empresa. Si es efectivo, se suma a su monto a rendir.' }
    ]
  },

  {
    seccion: 'COMBUSTIBLE Y COSTO DEL VEHICULO',
    parametros: [
      { clave: 'P_DIESEL', etiqueta: 'Precio del diesel',
        valor: 1381, unidad: '$/L', tipo: 'moneda', fuente: 'JEFATURA', critico: true,
        validacion: { min: 0, max: 5000 },
        nota: 'Promedio nacional a la fecha de planificacion. Verificar en ' +
              'bencinaenlinea.cl antes de cada planificacion.' },

      { clave: 'P_COSTO_KM', etiqueta: 'Costo de desgaste y mantencion',
        valor: 60, unidad: '$/km', tipo: 'moneda', fuente: 'JEFATURA', critico: true,
        validacion: { min: 0, max: 2000 },
        nota: 'Neumaticos, aceite, filtros y mantencion preventiva prorrateada por km. ' +
              'Es costo de la empresa, no dinero que se le transfiere al tecnico. ' +
              'Ponerlo en 0 si la jefatura prefiere no imputarlo al plan.' }
    ]
  },

  {
    seccion: 'ESTADIA Y VIATICO',
    parametros: [
      { clave: 'P_HOTEL', etiqueta: 'Hotel u hostal por noche por persona',
        valor: 50000, unidad: '$/noche', tipo: 'moneda', fuente: 'JEFATURA', critico: true,
        validacion: { min: 0, max: 500000 },
        nota: 'Valor fijo definido por jefatura: siempre $50.000 la noche, por persona, ' +
              'en cualquier ciudad.' },

      { clave: 'P_VIATICO', etiqueta: 'Viatico diario por tecnico desplegado',
        valor: 25000, unidad: '$/dia', tipo: 'moneda', fuente: 'JEFATURA', critico: true,
        validacion: { min: 0, max: 200000 },
        nota: 'Valor fijo definido por jefatura: siempre $25.000 al dia. INCLUYE la ' +
              'colacion, por eso el sistema no tiene un parametro de colacion aparte. ' +
              'Se paga por tecnico y por dia con al menos un tramo asignado, dentro o ' +
              'fuera de la Region Metropolitana.' },

      { clave: 'P_VIATICO_SOLO_FUERA_RM', etiqueta: 'El viatico se paga solo fuera de la Region Metropolitana',
        valor: true, unidad: 'si/no', tipo: 'lista', fuente: 'JEFATURA', critico: true,
        validacion: { valores: [true, false] },
        nota: 'REGLA DE JEFATURA. Un tecnico que trabaja en Maipu o en Puente Alto almuerza ' +
              'y duerme en su casa: no hay viatico. El viatico existe para cubrir al que ' +
              'esta lejos y no puede volver.' },

      { clave: 'P_VIATICO_SOLO_CON_PERNOCTACION', etiqueta: 'El viatico se paga solo en viajes de mas de un dia',
        valor: true, unidad: 'si/no', tipo: 'lista', fuente: 'JEFATURA', critico: true,
        validacion: { valores: [true, false] },
        nota: 'REGLA DE JEFATURA. Ir a Talca y volver el mismo dia no genera viatico: el ' +
              'tecnico sale y llega a su casa. El viatico se paga por cada dia de un viaje ' +
              'en que hay que quedarse a dormir fuera.' },

      { clave: 'P_UMBRAL_PERNOCTA', etiqueta: 'Umbral de horas de ida para pernoctar',
        valor: 4, unidad: 'h', tipo: 'numero', fuente: 'SUPUESTO',
        validacion: { min: 0, max: 24 },
        nota: 'Sobre este tiempo de viaje de ida no es viable ir y volver el mismo dia: ' +
              'el planificador propone noche de hotel y el validador lo exige.' },

      { clave: 'P_HABITACION_INDIVIDUAL', etiqueta: 'Una habitacion por tecnico',
        valor: true, unidad: 'si/no', tipo: 'lista', fuente: 'JEFATURA',
        validacion: { valores: [true, false] },
        nota: 'Verdadero: el costo de hotel es noches x tecnicos x P_HOTEL. Falso: se ' +
              'asume habitacion doble y se divide por dos, redondeando hacia arriba.' }
    ]
  },

  {
    seccion: 'OBJETIVO DE LA PLANIFICACION',
    parametros: [
      { clave: 'P_OBJETIVO', etiqueta: 'Que optimiza el planificador',
        valor: 'Costo minimo', unidad: 'criterio', tipo: 'lista', fuente: 'JEFATURA', critico: true,
        validacion: { valores: ['Costo minimo', 'Tiempo minimo', 'Equilibrado'] },
        nota: 'DECISION DE JEFATURA: esto no es una carrera contra el reloj. Se busca ' +
              'el plan mas barato posible aunque tome mas dias. El sistema evalua cada ' +
              'alternativa por su costo total, no por su duracion.' },

      { clave: 'P_ESTRATEGIA_RUTEO', etiqueta: 'Orden de atencion de las localidades',
        valor: 'Periferia primero', unidad: 'criterio', tipo: 'lista', fuente: 'JEFATURA',
        validacion: { valores: ['Periferia primero', 'RM primero', 'Libre'] },
        nota: 'Periferia primero: se agrupan los destinos lejanos en circuitos largos ' +
              'que amortizan el viaje, y la RM se barre al final con dias cortos y sin ' +
              'hotel. Es lo que baja el costo, aunque alargue el calendario.' },

      { clave: 'P_HORIZONTE_MAX_DIAS', etiqueta: 'Tope de dias habiles del plan',
        valor: 20, unidad: 'dias', tipo: 'entero', fuente: 'JEFATURA', critico: true,
        validacion: { min: 1, max: 60 },
        nota: 'Se acepta alargar el plan para ahorrar, pero no indefinidamente: 20 dias ' +
              'habiles son cuatro semanas. Sobre este tope el sistema deja de considerar ' +
              'valida la alternativa aunque sea mas barata.' },

      { clave: 'P_AGRUPA_POR_CORREDOR', etiqueta: 'Agrupar localidades del mismo corredor',
        valor: true, unidad: 'si/no', tipo: 'lista', fuente: 'JEFATURA', critico: true,
        validacion: { valores: [true, false] },
        nota: 'Verdadero: las localidades de un mismo eje se atienden en un solo ' +
              'circuito. Es lo que hace que Talca -> Curico cueste $0 en peaje y que no ' +
              'se repita el viaje largo.' }
    ]
  },

  {
    seccion: 'HORAS EXTRA · alternativa al hotel',
    parametros: [
      { clave: 'P_PERMITE_HORAS_EXTRA', etiqueta: 'Se autorizan horas extra',
        valor: true, unidad: 'si/no', tipo: 'lista', fuente: 'JEFATURA', critico: true,
        validacion: { valores: [true, false] },
        nota: 'DECISION DE JEFATURA: el equipo puede estirar la jornada hasta terminar ' +
              'el trabajo si con eso se evita pagar una noche de hotel. El sistema ' +
              'compara las dos opciones y elige la mas barata, no la mas comoda.' },

      { clave: 'P_COSTO_HORA_TECNICO', etiqueta: 'Costo empresa por hora-tecnico',
        valor: 6500, unidad: '$/h', tipo: 'moneda', fuente: 'SUPUESTO', critico: true,
        validacion: { min: 0, max: 100000 },
        nota: 'Sin este valor la hora extra saldria gratis y el sistema la usaria ' +
              'siempre. Es el sueldo bruto por hora mas cargas. Ajustar al real antes ' +
              'de decidir con esto.' },

      { clave: 'P_RECARGO_HORA_EXTRA', etiqueta: 'Recargo legal de la hora extra',
        valor: 1.5, unidad: 'factor', tipo: 'numero', fuente: 'SUPUESTO', critico: true,
        validacion: { min: 1, max: 3 },
        nota: '50% sobre la hora ordinaria, Codigo del Trabajo. Una hora extra cuesta ' +
              'P_COSTO_HORA_TECNICO x 1,5.' },

      { clave: 'P_HORAS_EXTRA_MAX_DIA', etiqueta: 'Maximo de horas extra por dia',
        valor: 2, unidad: 'h', tipo: 'numero', fuente: 'SUPUESTO', critico: true,
        validacion: { min: 0, max: 4 },
        nota: 'Tope legal de 2 horas extraordinarias diarias. No se negocia: sobre esto ' +
              'el plan es inviable, por barato que parezca.' },

      { clave: 'P_HORAS_EXTRA_MAX_SEMANA', etiqueta: 'Maximo de horas extra por semana',
        valor: 10, unidad: 'h', tipo: 'numero', fuente: 'SUPUESTO', critico: true,
        validacion: { min: 0, max: 20 },
        nota: 'Tope legal semanal por trabajador. El sistema lo controla por tecnico, ' +
              'no por cuadrilla.' },

      { clave: 'P_JORNADA_DIA_TOPE', etiqueta: 'Tope diario absoluto con horas extra',
        valor: 10.4, unidad: 'h', tipo: 'numero',
        formula: '=P_JORNADA_DIA_MAX+IF(P_PERMITE_HORAS_EXTRA,P_HORAS_EXTRA_MAX_DIA,0)',
        nota: 'Calculado. Es la linea roja del semaforo: sobre esto no se planifica ' +
              'nunca, cueste lo que cueste.' },

      { clave: 'P_PREFIERE_EXTRA_SOBRE_HOTEL', etiqueta: 'Preferir horas extra antes que pernoctar',
        valor: true, unidad: 'si/no', tipo: 'lista', fuente: 'JEFATURA', critico: true,
        validacion: { valores: [true, false] },
        nota: 'Verdadero: ante un empate, se estira la jornada en vez de reservar hotel. ' +
              'Ejemplo real: 2 h extra para 3 tecnicos cuestan 3 x 2 x $6.500 x 1,5 = ' +
              '$58.500, mientras que una noche para esos 3 cuesta 3 x $50.000 = $150.000 ' +
              'mas $75.000 de viatico del dia siguiente. El ahorro es evidente y el ' +
              'sistema lo cuantifica tramo por tramo.' }
    ]
  },

  {
    seccion: 'JORNADA Y CALENDARIO',
    parametros: [
      { clave: 'P_JORNADA_SEMANAL', etiqueta: 'Jornada semanal contractual',
        valor: 42, unidad: 'h', tipo: 'numero', fuente: 'SUPUESTO', critico: true,
        validacion: { min: 1, max: 60 },
        nota: 'Ley 21.561 vigente en 2026. El enunciado no fija jornada: es supuesto ' +
              'nuestro y hay que declararlo en el informe.' },

      { clave: 'P_COLACION_H', etiqueta: 'Horas de colacion por semana',
        valor: 5, unidad: 'h', tipo: 'numero', fuente: 'SUPUESTO', critico: true,
        validacion: { min: 0, max: 20 },
        nota: '1 h diaria no imputable a la jornada. Es tiempo, no dinero: el dinero de ' +
              'la colacion ya viene dentro del viatico.' },

      { clave: 'P_JORNADA_EFECTIVA', etiqueta: 'Jornada semanal efectiva',
        valor: 37, unidad: 'h', tipo: 'numero',
        formula: '=P_JORNADA_SEMANAL-P_COLACION_H',
        nota: 'Calculado: 42 - 5.' },

      { clave: 'P_DIAS_SEMANA', etiqueta: 'Dias laborales por semana',
        valor: 5, unidad: 'dias', tipo: 'entero', fuente: 'SUPUESTO', critico: true,
        validacion: { min: 1, max: 7 },
        nota: 'Lunes a viernes.' },

      { clave: 'P_JORNADA_DIA', etiqueta: 'Jornada diaria efectiva',
        valor: 7.4, unidad: 'h', tipo: 'numero',
        formula: '=P_JORNADA_EFECTIVA/P_DIAS_SEMANA',
        nota: 'Calculado: 37 / 5. Limite verde del semaforo.' },

      { clave: 'P_JORNADA_DIA_MAX', etiqueta: 'Jornada diaria contractual',
        valor: 8.4, unidad: 'h', tipo: 'numero',
        formula: '=P_JORNADA_SEMANAL/P_DIAS_SEMANA',
        nota: 'Calculado: 42 / 5. Limite de tolerancia antes de sobretiempo.' },

      { clave: 'P_CONDUCCION_MAX_DIA', etiqueta: 'Maximo de horas al volante por dia',
        valor: 9, unidad: 'h', tipo: 'numero', fuente: 'SUPUESTO',
        validacion: { min: 1, max: 14 },
        nota: 'Tope de seguridad. Copiapo esta a ~9 h de la base: el sistema debe ' +
              'advertir cuando un solo dia de manejo roza el limite.' },

      { clave: 'P_SEMANAS', etiqueta: 'Semanas del horizonte de plan',
        valor: 2, unidad: 'semanas', tipo: 'entero', fuente: 'SUPUESTO', critico: true,
        validacion: { min: 1, max: 12 },
        nota: 'Define cuantos dias ofrece la lista de PLAN: P_SEMANAS x P_DIAS_SEMANA.' },

      { clave: 'P_FECHA_INICIO', etiqueta: 'Fecha de inicio del plan',
        valor: '2026-09-21', unidad: 'fecha', tipo: 'fecha', fuente: 'JEFATURA', critico: true,
        validacion: { soloDiaHabil: true },
        nota: 'Lunes. Se evita la semana del 14-09 porque el 18 y 19 de septiembre son ' +
              'feriados y la entrega del caso es el 14-09.' },

      { clave: 'P_OMITIR_FIN_SEMANA', etiqueta: 'Nunca agendar sabado ni domingo',
        valor: true, unidad: 'si/no', tipo: 'lista', fuente: 'SUPUESTO',
        validacion: { valores: [true, false] },
        nota: 'Si es verdadero, el mapeo D1..Dn salta fines de semana y los feriados de ' +
              'la tabla FERIADOS.' }
    ]
  },

  {
    seccion: 'TRANSFERENCIA DE VIATICOS AL TECNICO',
    parametros: [
      { clave: 'P_TRANSFIERE_HOTEL', etiqueta: 'La transferencia incluye el hotel',
        valor: true, unidad: 'si/no', tipo: 'lista', fuente: 'JEFATURA',
        validacion: { valores: [true, false] },
        nota: 'PDF: "que monto requiere cada tecnico para realizar la ruta". Falso si la ' +
              'empresa reserva y paga el hotel directamente.' },

      { clave: 'P_TRANSFIERE_VIATICO', etiqueta: 'La transferencia incluye el viatico',
        valor: true, unidad: 'si/no', tipo: 'lista', fuente: 'JEFATURA',
        validacion: { valores: [true, false] },
        nota: 'Normalmente verdadero: es dinero de bolsillo del tecnico.' },

      { clave: 'P_TRANSFIERE_COMBUSTIBLE', etiqueta: 'La transferencia incluye el combustible',
        valor: false, unidad: 'si/no', tipo: 'lista', fuente: 'JEFATURA',
        validacion: { valores: [true, false] },
        nota: 'Falso si se usa tarjeta corporativa de combustible. Verdadero si el ' +
              'conductor carga de su bolsillo y rinde.' },

      { clave: 'P_GASTOS_VEHICULO_AL_CONDUCTOR', etiqueta: 'Combustible y peaje se cargan solo al conductor',
        valor: true, unidad: 'si/no', tipo: 'lista', fuente: 'JEFATURA',
        validacion: { valores: [true, false] },
        nota: 'Verdadero: el gasto del vehiculo va integro al conductor de la cuadrilla, ' +
              'no repartido entre los tres. Falso: se prorratea.' },

      { clave: 'P_HOLGURA_IMPREVISTOS', etiqueta: 'Holgura para imprevistos',
        valor: 0.10, unidad: '%', tipo: 'porcentaje', fuente: 'JEFATURA',
        validacion: { min: 0, max: 0.5 },
        nota: 'PDF: la transferencia cubre "estadia, colacion, peajes y otros". Este es ' +
              'el "y otros": estacionamientos, un repuesto menor, una noche que se alarga.' },

      { clave: 'P_REDONDEO_TRANSFERENCIA', etiqueta: 'Redondear la transferencia hacia arriba a',
        valor: 1000, unidad: '$', tipo: 'moneda', fuente: 'JEFATURA',
        validacion: { min: 1, max: 100000 },
        nota: 'Se transfiere en montos limpios. 1000 = al millar superior.' }
    ]
  },

  {
    seccion: 'MODOS DE TRANSPORTE · comparar y decidir manualmente',
    parametros: [
      { clave: 'P_PERMITE_BUS', etiqueta: 'Bus interurbano habilitado',
        valor: true, unidad: 'si/no', tipo: 'lista', fuente: 'JEFATURA', critico: true,
        validacion: { valores: [true, false] },
        nota: 'Se ofrece como alternativa para comparar. Solo se usa si coordinación la selecciona en una orden y confirma pasajes, conexiones y herramientas.' },

      { clave: 'P_PERMITE_AVION', etiqueta: 'Avion habilitado',
        valor: true, unidad: 'si/no', tipo: 'lista', fuente: 'JEFATURA', critico: true,
        validacion: { valores: [true, false] },
        nota: 'Alternativa referencial. La coordinación debe confirmar vuelo, conexiones, herramientas y alojamiento antes de seleccionarla.' },

      { clave: 'P_PERMITE_TRANSPORTE_PUBLICO', etiqueta: 'Metro y micro habilitados',
        valor: true, unidad: 'si/no', tipo: 'lista', fuente: 'JEFATURA',
        validacion: { valores: [true, false] },
        nota: 'Para cuadrillas que trabajan dentro de la RM sin necesidad de camioneta.' },

      { clave: 'P_HERRAMIENTAS_TRANSPORTABLES', etiqueta: 'Las herramientas caben en un bolso y pueden viajar sin camioneta',
        valor: true, unidad: 'si/no', tipo: 'lista', fuente: 'JEFATURA', critico: true,
        validacion: { valores: [true, false] },
        nota: 'SI. Todo lo que se necesita para instalar cabe en un bolso de herramientas ' +
              'comun: taladro, destornilladores, crimpeadora, multimetro, tester y ' +
              'repuestos menores. Un bolso por tecnico. Por eso bus y avion SI son ' +
              'ejecutables y no solo teoricos. Lo que no cabe en un bolso es la escalera ' +
              'telescopica: si el trabajo la exige, ese destino se hace en camioneta.' },

      { clave: 'P_FLETE_HERRAMIENTAS', etiqueta: 'Costo de llevar el bolso en bus',
        valor: 0, unidad: '$/tramo', tipo: 'moneda', fuente: 'JEFATURA', critico: true,
        validacion: { min: 0, max: 500000 },
        nota: 'En bus interurbano el bolso viaja gratis en la bodega del vehiculo, por eso ' +
              'el valor es 0. Se deja configurable por si una empresa cobra encomienda. ' +
              'Para el avion NO se usa este parametro: el equipaje de bodega tiene su ' +
              'propio cobro por persona.' },

      { clave: 'P_EQUIPAJE_BODEGA_AVION', etiqueta: 'Equipaje de bodega en avion, por tecnico y por tramo',
        valor: 18000, unidad: '$/tecnico/tramo', tipo: 'moneda', fuente: 'SUPUESTO', critico: true,
        validacion: { min: 0, max: 200000 },
        nota: 'ESTE ES EL COSTO QUE MAS SE OLVIDA AL COTIZAR UN VUELO. Las herramientas ' +
              'NO pueden ir en cabina: taladros, destornilladores y alicates estan ' +
              'prohibidos en el equipaje de mano por seguridad aerea. El bolso obliga a ' +
              'facturar equipaje, y las tarifas baratas que se ven en internet NO lo ' +
              'incluyen. Son tres bolsos para una cuadrilla de tres, en la ida y en la ' +
              'vuelta: seis cobros por viaje.' },

      { clave: 'P_TAXI_POR_KM', etiqueta: 'Tarifa promedio de taxi',
        valor: 1000, unidad: '$/km', tipo: 'moneda', fuente: 'JEFATURA', critico: true,
        validacion: { min: 0, max: 20000 },
        nota: 'NO SE ARRIENDA VEHICULO. Si la cuadrilla llega en bus o en avion y necesita ' +
              'moverse en el destino, toma taxi. Se presupuesta a un promedio de $1.000 el ' +
              'kilometro, que es la referencia de jefatura para regiones. Todo el costo de ' +
              'movilizacion en destino sale de esta tarifa multiplicada por los kilometros.' },

      { clave: 'P_KM_TERMINAL_CIUDAD', etiqueta: 'Kilometros del aeropuerto o terminal a la ciudad',
        valor: 12, unidad: 'km', tipo: 'numero', fuente: 'SUPUESTO', critico: true,
        validacion: { min: 0, max: 200 },
        nota: 'Un trayecto en taxi. Se paga CUATRO veces en un viaje en avion: base al ' +
              'aeropuerto de Santiago, aeropuerto de destino a la ciudad, y los dos de ' +
              'vuelta. Los aeropuertos regionales suelen quedar mas lejos que este ' +
              'promedio: ajustar por destino si se quiere precision.' },

      { clave: 'P_TIEMPO_A_AEROPUERTO_H', etiqueta: 'Tiempo de la base al aeropuerto o terminal',
        valor: 0.75, unidad: 'h', tipo: 'numero', fuente: 'SUPUESTO',
        validacion: { min: 0, max: 4 },
        nota: 'Desde la base en Macul hasta el aeropuerto de Pudahuel. Es jornada del ' +
              'tecnico y por eso cuenta.' },

      { clave: 'P_CHECKIN_AEROPUERTO_H', etiqueta: 'Tiempo de check-in y embarque',
        valor: 2, unidad: 'h', tipo: 'numero', fuente: 'SUPUESTO',
        validacion: { min: 0, max: 6 },
        nota: 'Dos horas, no una: con equipaje que facturar hay que llegar antes. Las ' +
              'aerolineas cierran el mostrador 40 minutos antes del vuelo en cabotaje.' },

      { clave: 'P_RETIRO_EQUIPAJE_H', etiqueta: 'Tiempo de desembarque y retiro de equipaje',
        valor: 0.5, unidad: 'h', tipo: 'numero', fuente: 'SUPUESTO',
        validacion: { min: 0, max: 3 },
        nota: 'Bajar del avion y esperar los bolsos en la cinta. Se cuenta en cada ' +
              'aterrizaje, ida y vuelta.' },

      { clave: 'P_KM_TAXI_DIA', etiqueta: 'Kilometros de taxi por dia en el destino',
        valor: 20, unidad: 'km/dia', tipo: 'numero', fuente: 'SUPUESTO', critico: true,
        validacion: { min: 0, max: 300 },
        nota: 'Cuanto se mueve la cuadrilla dentro de la ciudad de destino en un dia: del ' +
              'hotel al cliente, entre sitios y de vuelta. Solo aplica cuando se llega sin ' +
              'camioneta. Multiplicado por P_TAXI_POR_KM da el gasto diario de ' +
              'movilizacion, que sustituye al arriendo de vehiculo.' },

      { clave: 'P_KM_MAX_TRANSPORTE_PUBLICO', etiqueta: 'Alcance del metro y la micro desde la base',
        valor: 40, unidad: 'km', tipo: 'numero', fuente: 'JEFATURA', critico: true,
        validacion: { min: 0, max: 200 },
        nota: 'El pasaje de la Red solo sirve dentro del Gran Santiago. Melipilla es Region ' +
              'Metropolitana pero esta a 62 km: ahi no llega la micro urbana, hay que tomar ' +
              'bus interurbano y eso cuesta otra cosa. Sobre este kilometraje el comparador ' +
              'deja de ofrecer transporte publico aunque la localidad sea de la RM.' },

      { clave: 'P_MIN_TECNICOS_FUERA_RM', etiqueta: 'Minimo de tecnicos para salir de la Region Metropolitana',
        valor: 1, unidad: 'personas', tipo: 'entero', fuente: 'JEFATURA', critico: true,
        validacion: { min: 1, max: 5 },
        nota: 'DECISION PENDIENTE DE JEFATURA. En 1 el sistema puede mandar a una persona ' +
              'sola a Copiapo por cuatro dias, que es lo mas barato pero deja al tecnico ' +
              'sin respaldo a 800 km, manejando o cargando equipos solo. Muchas empresas ' +
              'exigen ir de a dos fuera de la region por seguridad. Subirlo a 2 encarece el ' +
              'plan pero lo hace defendible ante una mutual.' },

      { clave: 'P_FACTOR_TRANSPORTE_PUBLICO', etiqueta: 'Cuanto mas lento es el metro o la micro',
        valor: 2, unidad: 'factor', tipo: 'numero', fuente: 'SUPUESTO', critico: true,
        validacion: { min: 1, max: 6 },
        nota: 'Un trayecto que en camioneta toma 30 minutos, en metro y micro con trasbordo ' +
              'toma cerca de una hora. Se multiplica el tiempo de Maps por este factor. ' +
              'Sirve para que el comparador no muestre el transporte publico como si fuera ' +
              'igual de rapido que el vehiculo.' },

      { clave: 'P_TRANSPORTE_PUBLICO', etiqueta: 'Pasaje de metro o micro por tramo',
        valor: 1500, unidad: '$', tipo: 'moneda', fuente: 'SUPUESTO',
        validacion: { min: 0, max: 20000 },
        nota: 'Por tecnico y por tramo dentro de la RM.' }
    ]
  },

  {
    seccion: 'ANALISIS DE MEJORA FUTURA',
    parametros: [
      { clave: 'P_COSTO_CAMIONETA_NUEVA', etiqueta: 'Costo de una camioneta adicional',
        valor: 16500000, unidad: '$', tipo: 'moneda', fuente: 'SUPUESTO',
        validacion: { min: 0, max: 100000000 },
        nota: 'Peugeot Partner nueva, referencial. Se compara contra el costo de un set ' +
              'de herramientas portatiles y contra contratar un tecnico.' },

      { clave: 'P_COSTO_SET_HERRAMIENTAS', etiqueta: 'Costo de un set de herramientas portatil',
        valor: 2800000, unidad: '$', tipo: 'moneda', fuente: 'SUPUESTO',
        validacion: { min: 0, max: 50000000 },
        nota: 'Es la inversion que libera al equipo de la camioneta y habilita bus o ' +
              'avion en los tramos largos.' },

      { clave: 'P_COSTO_TECNICO_MES', etiqueta: 'Costo mensual de un tecnico adicional',
        valor: 1400000, unidad: '$/mes', tipo: 'moneda', fuente: 'SUPUESTO',
        validacion: { min: 0, max: 20000000 },
        nota: 'Sueldo bruto mas cargas, referencial. Tercera alternativa de mejora.' }
    ]
  }
];

/* ==========================================================================
 * E. TABLAS MAESTRAS DENTRO DE CONFIG
 * ========================================================================== */

var ESQUEMA_TABLAS = {

  TECNICOS: {
    rango: 'T_TECNICOS',
    titulo: 'NOMINA DE TECNICOS',
    columnas: ['Codigo', 'Nombre', 'Licencia de conducir', 'Activo', 'Email', 'Telefono'],
    tipos: ['texto', 'texto', 'lista', 'lista', 'texto', 'texto'],
    nota: 'El codigo genera las columnas T01..Tnn de PLAN. Una cuadrilla con vehiculo ' +
          'necesita al menos un tecnico con licencia. El email identifica al tecnico en ' +
          'la web app cuando MODO_ACCESO es GOOGLE.',
    filas: [
      ['T01', 'Alvaro Fuentes',   'Si', 'Si', '', ''],
      ['T02', 'Camila Rojas',     'Si', 'Si', '', ''],
      ['T03', 'Diego Munoz',      'Si', 'Si', '', ''],
      ['T04', 'Javiera Soto',     'Si', 'Si', '', ''],
      ['T05', 'Matias Contreras', 'Si', 'Si', '', ''],
      ['T06', 'Fernanda Araya',   'Si', 'Si', '', ''],
      ['T07', 'Cristian Vega',    'Si', 'Si', '', ''],
      ['T08', 'Paulina Herrera',  'No', 'Si', '', ''],
      ['T09', 'Rodrigo Caceres',  'Si', 'Si', '', ''],
      ['T10', 'Barbara Neira',    'No', 'Si', '', '']
    ]
  },

  FLOTA: {
    rango: 'T_FLOTA',
    titulo: 'FLOTA',
    columnas: ['Codigo', 'Modelo', 'Patente', 'Estado', 'Lleva herramientas'],
    tipos: ['texto', 'texto', 'texto', 'lista', 'lista'],
    nota: 'PDF: "6 camionetas con sus correspondientes herramientas". Esa columna es la ' +
          'restriccion central del caso: si el vehiculo lleva las herramientas, la ' +
          'cuadrilla no puede viajar en bus ni en avion.',
    filas: [
      ['V1', 'Peugeot Partner', '', 'Disponible', 'Si'],
      ['V2', 'Peugeot Partner', '', 'Disponible', 'Si'],
      ['V3', 'Peugeot Partner', '', 'Disponible', 'Si'],
      ['V4', 'Peugeot Partner', '', 'Disponible', 'Si'],
      ['V5', 'Peugeot Partner', '', 'Disponible', 'Si'],
      ['V6', 'Peugeot Partner', '', 'Disponible', 'Si']
    ]
  },

  /* FUENTE PRINCIPAL DEL PEAJE. Catalogo plaza por plaza y portico por portico.
     Aqui se pega la tabla del Ministerio de Obras Publicas 2026. El motor suma
     las plazas que atraviesa cada tramo, por eso puede dar la TOTALIDAD del
     peaje y mostrarla desglosada en la orden de servicio del tecnico. */
  PLAZAS: {
    rango: 'T_PLAZAS',
    titulo: 'CATALOGO DE PLAZAS DE PEAJE Y PORTICOS TAG · MOP 2026 · categoria 1',
    columnas: ['Codigo', 'Nombre de la plaza', 'Ruta o concesion', 'Tipo', 'Region',
               'Km desde Santiago', 'Tarifa normal ($)', 'Tarifa punta ($)',
               'Tarifa fin de semana ($)', 'Cobra en ambos sentidos', 'Fuente'],
    tipos: ['texto', 'texto', 'texto', 'lista', 'texto', 'numero', 'moneda', 'moneda',
            'moneda', 'lista', 'texto'],
    nota: 'DESTINO DE LA TABLA DEL MOP. Tipo: Troncal | Lateral | Portico TAG. Las ' +
          'plazas troncales cobran al pasar en cada sentido; los porticos TAG cobran ' +
          'por paso. "Km desde Santiago" ordena las plazas a lo largo del corredor y es ' +
          'lo que permite calcular un tramo intermedio como Talca -> Curico sin volver ' +
          'a Santiago. Las filas sembradas son las tarifas de referencia conocidas: ' +
          'reemplazar por el catalogo completo del MOP.',
    filas: [
      ['TRM',  'Troncal Rio Maipo',        'Ruta 5 Sur',    'Troncal',     'Metropolitana',  25, 1400, 1400, 1400, 'Si', 'Referencia 2026'],
      ['LAS',  'Lateral Acceso Sur',       'Acceso Sur',    'Lateral',     'Metropolitana',  18,  700,  700,  700, 'Si', 'Referencia 2026'],
      ['TAN',  'Troncal Angostura',        'Ruta 5 Sur',    'Troncal',     'Metropolitana',  60, 3800, 3800, 3800, 'Si', 'Referencia 2026'],
      ['TQU',  'Troncal Quinta',           'Ruta 5 Sur',    'Troncal',     "O'Higgins",     135, 3800, 3800, 3800, 'Si', 'Referencia 2026'],
      ['LR5S', 'Lateral Ruta 5 Sur',       'Ruta 5 Sur',    'Lateral',     'Maule',         170,  900,  900,  900, 'Si', 'Referencia 2026'],
      ['TRC',  'Troncal Rio Claro',        'Ruta 5 Sur',    'Troncal',     'Maule',         215, 3400, 3400, 3400, 'Si', 'Referencia 2026'],
      ['T68',  'Troncal Ruta 68 Lo Prado', 'Ruta 68',       'Troncal',     'Metropolitana',  30, 2700, 2700, 2700, 'Si', 'Referencia 2026'],
      ['PAC',  'Porticos Autopista Central','Autopista Central','Portico TAG','Metropolitana', 0,    0,    0,    0, 'No', 'PENDIENTE MOP'],
      ['PVS',  'Porticos Vespucio Sur',    'Vespucio Sur',  'Portico TAG', 'Metropolitana',   0,    0,    0,    0, 'No', 'PENDIENTE MOP'],
      ['PVN',  'Porticos Vespucio Norte',  'Vespucio Norte','Portico TAG', 'Metropolitana',   0,    0,    0,    0, 'No', 'PENDIENTE MOP'],
      ['PCN',  'Porticos Costanera Norte', 'Costanera Norte','Portico TAG','Metropolitana',   0,    0,    0,    0, 'No', 'PENDIENTE MOP']
    ]
  },

  /* Respaldo: total acumulado de ida por localidad. Se usa cuando
     P_PEAJE_FUENTE es ACUMULADO o cuando falta el detalle de plazas. */
  PEAJES: {
    rango: 'T_PEAJES',
    titulo: 'PEAJE ACUMULADO DE IDA POR LOCALIDAD · respaldo',
    columnas: ['Localidad', 'Peaje ida ($)', 'Plazas del trayecto'],
    tipos: ['texto', 'moneda', 'texto'],
    nota: 'Total de ida desde la base, categoria 1. Es el respaldo mientras el catalogo ' +
          'de plazas no este completo. El motor avisa cada vez que cae en este respaldo, ' +
          'para que nunca se confunda un total auditado con uno estimado.',
    filas: [
      ['Maipu',                   0, 'Vialidad urbana sin porticos'],
      ['Pudahuel',                0, 'Vialidad urbana sin porticos'],
      ['Santiago',             1300, 'Porticos Autopista Central y Vespucio (estimado TAG)'],
      ['Puente Alto',          2200, 'Vespucio Sur y Acceso Sur (estimado TAG)'],
      ['Lo Barnechea',         2400, 'Vespucio Norte y Costanera Norte (estimado TAG)'],
      ['Melipilla',            2800, 'Ruta 78, troncal Talagante'],
      ['San Antonio',          5600, 'Ruta 78, troncales Talagante y Leyda'],
      ['La Calera',            3900, 'Ruta 5 Norte, troncal Las Vegas'],
      ['Coquimbo',            18100, 'Ruta 5 Norte: El Melon, Pichidangui, Los Vilos y laterales'],
      ['Copiapo',             25500, 'Ruta 5 Norte hasta Copiapo'],
      ['Curico',               7600, 'Ruta 5 Sur, troncales Angostura y Quinta'],
      ['Talca',               11000, 'Ruta 5 Sur, troncales Angostura, Quinta y Rio Claro'],
      ['Santa Juana',         20600, 'Ruta 5 Sur hasta Biobio, 11 plazas'],
      ['San Pedro de la Paz', 20600, 'Idem'],
      ['Penco',               20600, 'Idem'],
      ['Tome',                20600, 'Idem']
    ]
  },

  /* Tarifas de los modos alternativos. Van por localidad porque dependen del
     destino, no de un parametro global. Un 0 significa "ese modo no llega
     ahi": el comparador lo marca como no aplicable en vez de inventar. */
  TARIFAS_TRANSPORTE: {
    rango: 'T_TARIFAS',
    titulo: 'TARIFAS DE BUS Y AVION POR LOCALIDAD · ida por persona',
    columnas: ['Localidad', 'Pasaje bus ($)', 'Horas bus', 'Pasaje avion ($)',
               'Horas vuelo', 'Aeropuerto o terminal', 'Vigencia'],
    tipos: ['texto', 'moneda', 'numero', 'moneda', 'numero', 'texto', 'texto'],
    nota: 'Bus y avión son alternativas para evaluar. El plan de referencia usa camionetas; ninguna opción se selecciona automáticamente. Las horas de vuelo no incluyen el check-in. Cotizar antes de comprometer.',
    filas: [
      ['Maipu',                    0,    0,     0,   0,  'No aplica',              ''],
      ['Pudahuel',                 0,    0,     0,   0,  'No aplica',              ''],
      ['Santiago',                 0,    0,     0,   0,  'No aplica',              ''],
      ['Puente Alto',              0,    0,     0,   0,  'No aplica',              ''],
      ['Lo Barnechea',             0,    0,     0,   0,  'No aplica',              ''],
      ['Melipilla',             2500,  1.2,     0,   0,  'Terminal San Borja',     'Referencial'],
      ['San Antonio',           6000,  1.8,     0,   0,  'Terminal San Borja',     'Referencial'],
      ['La Calera',             6000,  1.9,     0,   0,  'Terminal San Borja',     'Referencial'],
      ['Coquimbo',             18000,  6.2, 62000, 1.2, 'Aeropuerto La Florida',  'Referencial'],
      ['Copiapo',              35000, 10.5, 85000, 1.6, 'Aeropuerto Desierto de Atacama', 'Referencial'],
      ['Curico',                9000,  2.7,     0,   0,  'Terminal Alameda',       'Referencial'],
      ['Talca',                12000,  3.6,     0,   0,  'Terminal Alameda',       'Referencial'],
      ['Santa Juana',          22000,  7.0, 58000, 1.1, 'Aeropuerto Carriel Sur',  'Referencial'],
      ['San Pedro de la Paz',  21000,  6.8, 58000, 1.1, 'Aeropuerto Carriel Sur',  'Referencial'],
      ['Penco',                21000,  7.0, 58000, 1.1, 'Aeropuerto Carriel Sur',  'Referencial'],
      ['Tome',                 21500,  7.3, 58000, 1.1, 'Aeropuerto Carriel Sur',  'Referencial']
    ]
  },

  /* Correcciones puntuales al catalogo MOP que vive en 01_Peajes.gs. Permite
     ajustar una tarifa sin tocar codigo cuando llega la cartola real del TAG. */
  AJUSTES_PEAJE: {
    rango: 'T_AJUSTES_PEAJE',
    titulo: 'AJUSTES DE PEAJE · correcciones al catalogo MOP',
    columnas: ['Codigo de plaza', 'Monto real ($)', 'Motivo y fecha'],
    tipos: ['texto', 'moneda', 'texto'],
    nota: 'El monto que se ponga aqui reemplaza al del catalogo para esa plaza. Sirve ' +
          'para corregir con la cartola del TAG sin editar 01_Peajes.gs. Dejar vacia ' +
          'mientras no haya correcciones.',
    filas: []
  },

  CORREDORES: {
    rango: 'T_CORREDORES',
    titulo: 'CORREDORES VIALES',
    columnas: ['Codigo', 'Nombre', 'Descripcion'],
    tipos: ['texto', 'texto', 'texto'],
    nota: 'Agrupa las localidades por eje. El motor lo usa para encadenar tramos: dos ' +
          'localidades del mismo corredor se conectan directo; de corredores distintos, ' +
          'el trayecto pasa por Santiago.',
    filas: [
      ['URB', 'Red urbana RM',     'Comunas dentro del Gran Santiago'],
      ['R78', 'Autopista del Sol', 'Melipilla, San Antonio, litoral central'],
      ['R5N', 'Ruta 5 Norte',      'La Calera, Coquimbo, Copiapo'],
      ['R5S', 'Ruta 5 Sur',        'Curico, Talca, Biobio']
    ]
  },

  FERIADOS: {
    rango: 'T_FERIADOS',
    titulo: 'FERIADOS A EVITAR',
    columnas: ['Fecha', 'Motivo'],
    tipos: ['fecha', 'texto'],
    nota: 'El mapeo de D1..Dn a fechas reales salta estas fechas y los fines de semana.',
    filas: [
      ['2026-09-18', 'Independencia Nacional'],
      ['2026-09-19', 'Dia de las Glorias del Ejercito'],
      ['2026-10-12', 'Encuentro de Dos Mundos'],
      ['2026-10-31', 'Dia de las Iglesias Evangelicas'],
      ['2026-11-01', 'Dia de Todos los Santos'],
      ['2026-12-08', 'Inmaculada Concepcion'],
      ['2026-12-25', 'Navidad']
    ]
  },

  SEMAFORO: {
    rango: 'T_SEMAFORO',
    titulo: 'SEMAFORO DE JORNADA POR CUADRILLA Y DIA',
    columnas: ['Estado', 'Limite superior (h)', 'Color', 'Accion'],
    tipos: ['texto', 'numero', 'texto', 'texto'],
    nota: 'Se evalua la suma de horas de todos los tramos de una cuadrilla en un dia. ' +
          'Los limites son formula para que sigan a los parametros de jornada. ' +
          'SOBRETIEMPO ya no es una falla: es una decision economica que se toma cuando ' +
          'sale mas barato que pagar hotel, y se paga con recargo.',
    filas: [
      ['OK',           '=P_JORNADA_DIA',      '#2E7D32',
       'Dentro de la jornada efectiva. Sin costo adicional'],
      ['TOLERANCIA',   '=P_JORNADA_DIA_MAX',  '#E8A33D',
       'Se absorbe con el banco de horas contractual. Sin costo adicional'],
      ['SOBRETIEMPO',  '=P_JORNADA_DIA_TOPE', '#1F3864',
       'Horas extra autorizadas y pagadas con recargo. Valido si ahorra hotel'],
      ['FUERA DE LEY', '',                    '#C00000',
       'Sobre el tope legal. Debe ser cero, cueste lo que cueste. Replanificar']
    ]
  },

  DIAGNOSTICO: {
    rango: 'T_DIAGNOSTICO',
    titulo: 'DIAGNOSTICO DE UTILIZACION POR TECNICO',
    columnas: ['Desde', 'Hasta', 'Etiqueta', 'Texto del diagnostico'],
    tipos: ['porcentaje', 'porcentaje', 'texto', 'texto'],
    nota: 'Sustenta con datos la respuesta cuando un tecnico pide aumento o cuando hay ' +
          'que decidir si contratar. El texto se muestra tal cual en la ficha.',
    filas: [
      [0.95, 9.99, 'SOBRECARGA',     'Sobrecarga: exige redistribuir trabajos o pagar sobretiempo.'],
      [0.75, 0.95, 'CARGA ALTA',     'Carga alta sostenida. Respalda una solicitud de reajuste.'],
      [0.50, 0.75, 'CARGA ADECUADA', 'Carga adecuada para el periodo.'],
      [0.00, 0.50, 'HOLGURA',        'Holgura disponible: se le pueden asignar mas trabajos.']
    ]
  },

  CATEGORIAS_GASTO: {
    rango: 'T_CATEGORIAS',
    titulo: 'CATEGORIAS DE GASTO',
    columnas: ['Clave', 'Etiqueta', 'Color', 'Base de imputacion', 'Paga'],
    tipos: ['texto', 'texto', 'texto', 'lista', 'lista'],
    nota: 'Base "tramo" se carga a la localidad donde se ejecuto trabajo, o a la de ' +
          'origen si no hubo trabajo. Base "tecnico-dia" se prorratea por horas-hombre. ' +
          'La columna Paga decide que entra en la transferencia al tecnico.',
    filas: [
      ['combustible', 'Combustible',           '#1F3864', 'tramo',       'Empresa'],
      ['peajes',      'Peajes',                '#2E5C9A', 'tramo',       'Empresa'],
      ['desgaste',    'Desgaste y mantencion', '#5B8DD6', 'tramo',       'Empresa'],
      ['hotel',       'Hotel',                 '#C00000', 'tramo',       'Tecnico'],
      ['viatico',     'Viatico (incluye colacion)', '#E8A33D', 'tecnico-dia', 'Tecnico'],
      ['imprevistos', 'Holgura de imprevistos','#F2CC8F', 'tecnico-dia', 'Tecnico']
    ]
  },

  CHECKLIST: {
    rango: 'T_CHECKLIST',
    titulo: 'CHECKLIST DE IMPLEMENTOS Y MATERIALES',
    columnas: ['Orden', 'Item', 'Categoria'],
    tipos: ['entero', 'texto', 'texto'],
    nota: 'PDF caso 2: "cada tecnico pueda verificar su ruta, sus implementos y ' +
          'materiales a utilizar". Se imprime con casillas en la orden de servicio. La ' +
          'CATEGORIA dice donde va cada cosa y es lo que decide si la cuadrilla puede ' +
          'viajar sin camioneta: BOLSO son los implementos que caben en el bolso de ' +
          'herramientas de cada tecnico, y por lo tanto pueden ir en bus o en avion; ' +
          'VEHICULO es lo que solo se puede llevar en camioneta y obliga a ese modo; ' +
          'PERSONAL lo lleva cada uno encima.',
    filas: [
      [ 1, 'Multimetro y pinza amperimetrica calibrados', 'BOLSO'],
      [ 2, 'Crimpeadora, conectores RJ45 y tester de red', 'BOLSO'],
      [ 3, 'Kit de fibra optica: fusionadora, pigtails y alcohol isopropilico', 'BOLSO'],
      [ 4, 'Taladro percutor, brocas y tarugos', 'BOLSO'],
      [ 5, 'Set de destornilladores aislados y llaves ajustables', 'BOLSO'],
      [ 6, 'Amarras, cinta aisladora y canaletas', 'BOLSO'],
      [ 7, 'Equipo de reemplazo ONT/router y repuestos menores', 'BOLSO'],
      [ 8, 'Notebook con software de puesta en marcha y respaldo de configuraciones', 'BOLSO'],
      [ 9, 'Escalera telescopica', 'VEHICULO'],
      [10, 'Extension electrica, conos y senaletica', 'VEHICULO'],
      [11, 'Documentos del vehiculo: permiso de circulacion, revision tecnica, seguro y TAG', 'VEHICULO'],
      [12, 'Tarjeta corporativa de combustible', 'VEHICULO'],
      [13, 'EPP: casco, guantes dielectricos, lentes, zapatos de seguridad y arnes', 'PERSONAL'],
      [14, 'Botiquin, agua y linterna frontal', 'PERSONAL'],
      [15, 'Celular con datos para reportar avance', 'PERSONAL'],
      [16, 'Guia de despacho y acta de conformidad del cliente', 'PERSONAL'],
      [17, 'Material de capacitacion enviado al cliente ANTES de llegar', 'PERSONAL']
    ]
  }
};

/* ==========================================================================
 * F. ESCENARIOS DE CALCULO
 * --------------------------------------------------------------------------
 * El motor corre los dos sobre el MISMO plan y devuelve ambos resultados. El
 * dashboard muestra el activo y, al lado, la diferencia contra el otro: ese
 * delta es exactamente la mejora que se defiende en la presentacion.
 *
 * Cada escenario sobrescribe solo los parametros que declara; el resto los
 * hereda de CONFIG. Asi no hay dos configuraciones que mantener.
 * ========================================================================== */

var ESQUEMA_ESCENARIOS = {
  activo: 'LITERAL_PDF',

  definiciones: [
    {
      id: 'LITERAL_PDF',
      titulo: 'Literal del enunciado',
      descripcion: 'Una capacitacion de 30 minutos por cada equipo instalado, sin ' +
                   'material digital previo. Es la lectura textual del caso y sirve de ' +
                   'linea base contra la cual medir la mejora.',
      sobrescribe: {
        P_CAP_BASE: 'Por equipo',
        P_CAP_DIGITAL_PREVIA: false
      },
      capacitacionesEsperadas: 33
    },
    {
      id: 'OPERACION_REAL',
      titulo: 'Mejora propuesta: capacitación digital',
      descripcion: 'Al cliente se le envia por correo un enlace de Drive con la ' +
                   'capacitacion en detalle antes de la visita. En terreno se dicta una ' +
                   'sola sesion por sitio, de 15 minutos, para resolver dudas concretas. ' +
                   'Se capacita al cliente, no al equipo: da lo mismo si en ese sitio se ' +
                   'instalan 1 o 5 equipos.',
      sobrescribe: {
        P_CAP_BASE: 'Por localidad',
        P_CAP_DIGITAL_PREVIA: true,
        P_REDUCCION_CAP: 0.5
      },
      capacitacionesEsperadas: 16
    }
  ],

  /* Lo que el dashboard contrasta entre ambos escenarios. */
  comparar: [
    'horasCapacitacion',
    'horasHombreTotales',
    'diasHabilesUtilizados',
    'utilizacionGlobal',
    'gastoTotal',
    'gastoPorEquipo'
  ]
};

/* ==========================================================================
 * G. ESTRUCTURA DE LAS HOJAS DE DATOS
 * --------------------------------------------------------------------------
 * origen: 'usuario'  -> celda editable con validacion
 *         'maps'     -> la escribe el motor con la respuesta de Google. Gris,
 *                       protegida, con fecha. Nadie la edita a mano.
 *         'motor'    -> la calcula el motor a partir de CONFIG (por ejemplo el
 *                       peaje sumado plaza por plaza). Gris y protegida.
 *         'generada' -> columna creada dinamicamente desde una tabla maestra
 * ========================================================================== */

var ESQUEMA_DESTINOS = {
  hoja: 'DESTINOS',
  claveUnica: 'Localidad',
  filaObligatoria: 'BASE',
  rangoLocalidades: 'T_LOCALIDADES',
  nota: 'Se ingresa la direccion; los kilometros, las horas y el peaje los trae Google ' +
        'Maps y quedan cacheados en las columnas grises.',
  columnas: [
    { titulo: 'Localidad',            origen: 'usuario', tipo: 'texto',  ancho: 160,
      nota: 'Clave unica. PLAN valida Desde/Hasta contra esta columna.' },
    { titulo: 'Region',               origen: 'usuario', tipo: 'texto',  ancho: 130,
      nota: 'Segun el enunciado: Atacama, Coquimbo, Valparaiso, Santiago, Maule, Concepcion.' },
    { titulo: 'Direccion exacta',     origen: 'usuario', tipo: 'texto',  ancho: 300,
      nota: 'Calle, numero, comuna y Chile. Es lo que se le pide a Maps y lo que se ' +
            'imprime en la orden de servicio del tecnico.' },
    { titulo: 'En RM (Si/No)',        origen: 'usuario', tipo: 'lista',  ancho: 90,
      valores: ['Si', 'No'],
      nota: 'Informativo y de agrupacion. No cambia el viatico: el viatico es siempre ' +
            'el mismo monto.' },
    { titulo: 'Equipos a instalar',   origen: 'usuario', tipo: 'entero', ancho: 120,
      validacion: { min: 0, max: 999 },
      nota: 'Dato del enunciado. La suma debe dar 33.' },
    { titulo: 'Hotel de referencia',  origen: 'usuario', tipo: 'texto',  ancho: 220,
      nota: 'PDF caso 2: "el hotel donde podria hospedar". Se muestra en la ficha del tecnico.' },
    { titulo: 'Link de capacitacion', origen: 'usuario', tipo: 'texto',  ancho: 220,
      nota: 'Enlace de Drive que se le manda al cliente ANTES de la visita. Si ' +
            'P_CAP_ENVIO_OBLIGATORIO esta activo y esta vacio, el sistema alerta_.' },
    { titulo: 'Corredor',             origen: 'usuario', tipo: 'lista',  ancho: 90,
      rangoLista: 'T_CORREDORES',
      nota: 'Permite encadenar tramos como Talca -> Curico sin volver a la base: si dos ' +
            'localidades comparten corredor, la distancia es la diferencia; si no, el ' +
            'trayecto pasa por Santiago.' },
    { titulo: 'Plazas de peaje',      origen: 'usuario', tipo: 'texto',  ancho: 220,
      nota: 'Codigos del catalogo de plazas separados por coma, en orden desde la base. ' +
            'Ej: TRM,TAN,TQU,LR5S,TRC. De aqui sale la totalidad del peaje del tramo.' },
    { titulo: 'Km desde base',        origen: 'maps',    tipo: 'numero', ancho: 110,
      nota: 'Google Maps. No editar.' },
    { titulo: 'Horas desde base',     origen: 'maps',    tipo: 'numero', ancho: 110,
      nota: 'Duracion de Maps x P_FACTOR_HORAS. No editar.' },
    { titulo: 'Peaje ida ($)',        origen: 'motor',   tipo: 'moneda', ancho: 120,
      nota: 'Suma de las plazas declaradas, tarifa de categoria 1 en el horario ' +
            'configurado. No editar.' },
    { titulo: 'Fuente peaje',         origen: 'motor',   tipo: 'texto',  ancho: 110,
      nota: 'PLAZAS si se sumo el catalogo MOP, ACUMULADO si se uso el respaldo.' },
    { titulo: 'Actualizado',          origen: 'maps',    tipo: 'fecha',  ancho: 110,
      nota: 'Fecha de la consulta a Maps. Vence segun P_MAPS_CACHE_DIAS.' }
  ]
};

var ESQUEMA_PLAN = {
  hoja: 'PLAN',
  nota: 'Cada fila es un tramo Desde -> Hasta. Un tramo con destino BASE es el regreso y ' +
        'no ejecuta trabajo. Nada calculado: solo entrada con validacion por lista.',
  columnas: [
    { titulo: 'N',            origen: 'usuario', tipo: 'entero', ancho: 50 },
    { titulo: 'Dia',          origen: 'usuario', tipo: 'lista',  ancho: 70,  lista: 'DIAS' },
    { titulo: 'Cuadrilla',    origen: 'usuario', tipo: 'lista',  ancho: 90,  lista: 'CUADRILLAS' },
    { titulo: 'Modo',         origen: 'usuario', tipo: 'lista',  ancho: 140, lista: 'MODOS',
      nota: 'Camioneta imputa combustible, peaje y desgaste. Bus y Avion imputan pasaje ' +
            'por tecnico mas flete de herramientas y arriendo en destino. Transporte ' +
            'publico imputa pasaje por tecnico. El comparador dice cual conviene; esta ' +
            'celda dice cual se va a usar.' },
    { titulo: 'Vehiculo',     origen: 'usuario', tipo: 'lista',  ancho: 90,  lista: 'VEHICULOS',
      nota: 'Solo aplica en modo Camioneta. En los demas modos va el guion.' },
    { titulo: 'Desde',        origen: 'usuario', tipo: 'lista',  ancho: 170, rangoLista: 'T_LOCALIDADES' },
    { titulo: 'Hasta',        origen: 'usuario', tipo: 'lista',  ancho: 170, rangoLista: 'T_LOCALIDADES' },
    { titulo: 'Noches hotel', origen: 'usuario', tipo: 'entero', ancho: 100, validacion: { min: 0, max: 14 } },
    { titulo: 'Conductor',    origen: 'usuario', tipo: 'lista',  ancho: 100, rangoLista: 'T_TECNICOS',
      nota: 'Debe tener licencia y estar marcado en el tramo. Recibe el combustible y ' +
            'el peaje si P_GASTOS_VEHICULO_AL_CONDUCTOR es verdadero.' }
    // A continuacion, una columna checkbox por cada tecnico activo de T_TECNICOS.
  ],
  columnasTecnicos: { origen: 'generada', desdeTabla: 'TECNICOS', tipo: 'checkbox', ancho: 45 }
};

/* Cache de rutas de Google Maps. Hoja oculta, escrita solo por Maps.gs. */
var ESQUEMA_RUTAS = {
  hoja: '_RUTAS',
  columnas: ['Origen', 'Destino', 'Km', 'Minutos', 'Evita peajes', 'Consultado',
             'Estado', 'Detalle'],
  nota: 'Una fila por par origen-destino consultado. La clave es Origen|Destino|Evita ' +
        'peajes. Se reconsulta cuando vence P_MAPS_CACHE_DIAS o cuando cambia P_BASE. ' +
        'El peaje NO vive aqui: se calcula desde el catalogo de plazas, que no depende ' +
        'de ninguna consulta externa.'
};

/* ==========================================================================
 * H. LISTAS DERIVADAS
 * --------------------------------------------------------------------------
 * No se escriben a mano: se generan desde los parametros y las tablas. Si
 * P_SEMANAS pasa a 3, la lista de dias ofrece D1..D15 sola.
 * ========================================================================== */

var ESQUEMA_LISTAS = {
  DIAS:       { prefijo: 'D', cantidadDesde: ['P_HORIZONTE_MAX_DIAS'],
                nota: 'D1..Dn segun el tope de dias habiles, no segun las semanas: el ' +
                      'plan puede alargarse si eso lo abarata.' },
  CUADRILLAS: { prefijo: 'C', cantidadDesde: ['P_CAMIONETAS'] },
  VEHICULOS:  { prefijo: 'V', cantidadDesde: ['P_CAMIONETAS'], extras: ['—'] },
  MODOS:      { valores: ['Camioneta', 'Bus', 'Avion', 'Transporte publico'],
                habilitadosPor: {
                  'Bus': 'P_PERMITE_BUS',
                  'Avion': 'P_PERMITE_AVION',
                  'Transporte publico': 'P_PERMITE_TRANSPORTE_PUBLICO'
                },
                nota: 'La lista de PLAN solo ofrece los modos habilitados en CONFIG.' }
};

/* ==========================================================================
 * H-bis. REGLAS DE COSTEO POR MODO
 * --------------------------------------------------------------------------
 * Documentacion normativa del motor. Cada modo cuesta distinto y el
 * comparador los evalua con las mismas reglas para que la eleccion sea
 * defendible ante la jefatura.
 *
 *   n  = tecnicos de la cuadrilla en el tramo
 *   km = kilometros del tramo segun Google Maps
 *
 * CAMIONETA
 *   combustible = km / P_RENDIMIENTO * P_DIESEL
 *   peajes      = suma de plazas del tramo (01_Peajes.gs)
 *   desgaste    = km * P_COSTO_KM
 *   pasajes     = 0
 *
 * BUS
 *   pasajes     = tarifa_bus_del_tramo * n
 *   flete       = P_FLETE_HERRAMIENTAS por cuadrilla y tramo
 *   taxi destino= P_KM_TAXI_DIA * P_TAXI_POR_KM por dia de permanencia
 *   traslados   = P_KM_TERMINAL_CIUDAD * P_TAXI_POR_KM por carrera
 *   combustible, peajes y desgaste = 0
 *
 * AVION
 *   pasajes     = tarifa_avion_del_tramo * n
 *   flete       = P_FLETE_HERRAMIENTAS por cuadrilla y tramo
 *   taxi destino= P_KM_TAXI_DIA * P_TAXI_POR_KM por dia de permanencia
 *   traslados   = P_KM_TERMINAL_CIUDAD * P_TAXI_POR_KM por carrera
 *   horas       = horas_vuelo + P_CHECKIN_AEROPUERTO_H
 *
 * TRANSPORTE PUBLICO
 *   pasajes     = P_TRANSPORTE_PUBLICO * n
 *
 * COMUNES A TODOS LOS MODOS
 *   hotel       = noches * n * P_HOTEL   (dividido por 2 si no hay habitacion
 *                                         individual, redondeando hacia arriba)
 *   viatico     = P_VIATICO por tecnico y por dia desplegado
 *   sobretiempo = horas_extra * n * P_COSTO_HORA_TECNICO * P_RECARGO_HORA_EXTRA
 *
 * LA DECISION CLAVE: hotel contra horas extra
 *   Terminar el trabajo el mismo dia estirando la jornada cuesta
 *     horas_extra * n * P_COSTO_HORA_TECNICO * P_RECARGO_HORA_EXTRA
 *   Pernoctar cuesta
 *     n * P_HOTEL  +  n * P_VIATICO del dia siguiente
 *   El motor evalua las dos y elige la barata, respetando P_JORNADA_DIA_TOPE.
 *   Con los valores actuales, 2 h extra para 3 tecnicos son $58.500 y una
 *   noche para esos mismos 3 son $225.000: gana la hora extra por amplio
 *   margen, y esa diferencia es un resultado del analisis, no una opinion.
 * ========================================================================== */

var REGLAS_COSTEO = {
  modos: ['Camioneta', 'Bus', 'Avion', 'Transporte publico'],
  componentesPorModo: {
    'Camioneta':          ['combustible', 'peajes', 'desgaste'],
    'Bus':                ['pasajes', 'flete', 'arriendo', 'traslados'],
    'Avion':              ['pasajes', 'flete', 'arriendo', 'traslados'],
    'Transporte publico': ['pasajes']
  },
  componentesComunes: ['hotel', 'viatico', 'sobretiempo', 'imprevistos'],
  decisionHotelVsExtra: {
    descripcion: 'Se compara el costo de estirar la jornada contra el de pernoctar, ' +
                 'y se elige el menor sin superar P_JORNADA_DIA_TOPE.',
    costoExtra: 'horasExtra * n * P_COSTO_HORA_TECNICO * P_RECARGO_HORA_EXTRA',
    costoNoche: 'n * P_HOTEL + n * P_VIATICO'
  }
};

/* ==========================================================================
 * I. VALIDACIONES CRUZADAS
 * --------------------------------------------------------------------------
 * Reglas que ninguna validacion de celda puede expresar. El motor las corre en
 * cada calculo y las publica como alertas. nivel: error | aviso.
 * ========================================================================== */

var ESQUEMA_VALIDACIONES = [
  { id: 'EQUIPOS_SIN_ATENDER', nivel: 'error',
    descripcion: 'Los 33 equipos del enunciado deben quedar instalados: la suma del plan ' +
                 'debe igualar la columna Equipos a instalar de DESTINOS.' },

  { id: 'LOCALIDAD_SIN_VISITA', nivel: 'error',
    descripcion: 'Las 16 localidades del enunciado deben tener al menos un tramo con ' +
                 'tecnicos asignados.' },

  { id: 'CUADRILLA_INCOMPLETA', nivel: 'aviso',
    descripcion: 'El enunciado pide grupos de 3 personas. Una cuadrilla con mas o menos ' +
                 'tecnicos que P_TECNICOS_POR_CUADRILLA se marca para justificarla.' },

  { id: 'LOCALIDAD_INEXISTENTE', nivel: 'error',
    descripcion: 'Todo Desde/Hasta de PLAN debe existir en DESTINOS. Se informa hoja, ' +
                 'fila y valor a corregir.' },

  { id: 'CADENA_ROTA', nivel: 'error',
    descripcion: 'El Desde de un tramo debe coincidir con el Hasta del tramo anterior de ' +
                 'la misma cuadrilla y dia.' },

  { id: 'FUERA_DE_LEY', nivel: 'error',
    descripcion: 'Ninguna cuadrilla-dia puede superar P_JORNADA_DIA_TOPE, que es la ' +
                 'jornada contractual mas el maximo legal de horas extra. Este limite ' +
                 'no se negocia por ahorro.' },

  { id: 'EXTRA_SEMANAL_EXCEDIDO', nivel: 'error',
    descripcion: 'Ningun tecnico puede acumular mas de P_HORAS_EXTRA_MAX_SEMANA horas ' +
                 'extra en una semana. Se controla por persona, no por cuadrilla.' },

  { id: 'SOBRETIEMPO_NO_AUTORIZADO', nivel: 'error',
    descripcion: 'Hay horas sobre la jornada contractual pero P_PERMITE_HORAS_EXTRA esta ' +
                 'en falso. O se autorizan, o se replanifica el tramo.' },

  { id: 'EXTRA_MAS_CARO_QUE_HOTEL', nivel: 'aviso',
    descripcion: 'Se estan pagando horas extra en un dia en que pernoctar habria salido ' +
                 'mas barato. El sistema informa la diferencia en pesos para que la ' +
                 'jefatura decida.' },

  { id: 'MODO_MAS_CARO_DISPONIBLE', nivel: 'aviso',
    descripcion: 'El tramo usa un modo mas caro que el mejor disponible. Se informa la ' +
                 'diferencia en pesos y el motivo, porque a veces hay razones operativas ' +
                 'para no tomar el mas barato.' },

  { id: 'MODO_NO_HABILITADO', nivel: 'error',
    descripcion: 'El tramo declara un modo que esta deshabilitado en CONFIG, o un modo ' +
                 'sin tarifa cargada para esa localidad.' },

  { id: 'HERRAMIENTAS_SIN_VEHICULO', nivel: 'error',
    descripcion: 'El tramo va en bus o avion con P_HERRAMIENTAS_TRANSPORTABLES en falso. ' +
                 'Sin camioneta la cuadrilla llega sin herramientas y no puede instalar.' },

  { id: 'VEHICULO_EN_MODO_AJENO', nivel: 'aviso',
    descripcion: 'Hay un vehiculo asignado a un tramo que no es de modo Camioneta. Esa ' +
                 'camioneta queda inmovilizada sin necesidad.' },

  { id: 'HORIZONTE_EXCEDIDO', nivel: 'error',
    descripcion: 'El plan usa mas dias habiles que P_HORIZONTE_MAX_DIAS. Alargar para ' +
                 'ahorrar es valido, pero con techo.' },

  { id: 'CONDUCCION_EXCESIVA', nivel: 'error',
    descripcion: 'Ningun conductor puede superar P_CONDUCCION_MAX_DIA horas al volante en ' +
                 'un dia.' },

  { id: 'PERNOCTA_FALTANTE', nivel: 'error',
    descripcion: 'Si el viaje de ida supera P_UMBRAL_PERNOCTA y el tramo no declara ' +
                 'noches de hotel, el regreso el mismo dia no es viable.' },

  { id: 'CAMIONETA_SOBRECARGADA', nivel: 'error',
    descripcion: 'Un tramo en camioneta no puede llevar mas tecnicos que ' +
                 'P_CAPACIDAD_CAMIONETA. La solucion no es apretarse: es mandar otra ' +
                 'camioneta al mismo destino, que si esta permitido.' },

  { id: 'SITIO_COMPARTIDO', nivel: 'aviso',
    descripcion: 'Dos o mas cuadrillas llegan a la misma localidad el mismo dia. No es un ' +
                 'error: se reparten los equipos y el sitio se termina antes. El aviso ' +
                 'informa cuanto tiempo se gana, para contrastarlo con las horas-hombre ' +
                 'adicionales que se pagan.' },

  { id: 'VEHICULO_DUPLICADO', nivel: 'error',
    descripcion: 'Un vehiculo no puede estar asignado a dos cuadrillas el mismo dia.' },

  { id: 'CONDUCTOR_SIN_LICENCIA', nivel: 'error',
    descripcion: 'El conductor declarado debe tener licencia y estar marcado en el tramo.' },

  { id: 'TECNICO_SOBREASIGNADO', nivel: 'error',
    descripcion: 'Un tecnico no puede estar en dos cuadrillas distintas el mismo dia.' },

  { id: 'RUTA_SIN_MAPS', nivel: 'aviso',
    descripcion: 'Un tramo quedo sin respuesta de Google Maps y se esta usando el valor ' +
                 'de respaldo. Revisar la direccion y la clave de API.' },

  { id: 'PLAZA_DESCONOCIDA', nivel: 'error',
    descripcion: 'Una localidad declara un codigo de plaza que no existe en el catalogo ' +
                 'MOP. El peaje del tramo quedaria incompleto.' },

  { id: 'PLAZA_SIN_TARIFA', nivel: 'aviso',
    descripcion: 'Una plaza del catalogo tiene tarifa 0 o fuente PENDIENTE MOP. El total ' +
                 'de peaje esta subestimado hasta cargar el valor real.' },

  { id: 'PEAJE_POR_RESPALDO', nivel: 'aviso',
    descripcion: 'El peaje de un tramo salio del acumulado por localidad y no de la suma ' +
                 'de plazas. Es una estimacion, no un total auditado.' },

  { id: 'CAPACITACION_SIN_ENLACE', nivel: 'aviso',
    descripcion: 'Con P_CAP_DIGITAL_PREVIA activo, toda localidad debe tener cargado el ' +
                 'enlace de Drive de la capacitacion: el descuento de 50% del tiempo ' +
                 'presencial se sostiene en que ese correo salio antes de la visita.' },

  { id: 'HERRAMIENTAS_AMARRADAS', nivel: 'aviso', soloSi: 'P_HERRAMIENTAS_TRANSPORTABLES=false',
    descripcion: 'Con las herramientas amarradas a las camionetas, bus y avion dejan de ' +
                 'ser ejecutables. El comparador sigue mostrandolos y cuantifica cuanto ' +
                 'cuesta esa restriccion al ano: es el argumento para comprar sets ' +
                 'portatiles.' },

  { id: 'DOTACION_COHERENTE', nivel: 'error',
    descripcion: 'P_TECNICOS debe coincidir con los tecnicos activos de T_TECNICOS.' },

  { id: 'PARAMETRO_CRITICO_ALTERADO', nivel: 'aviso',
    descripcion: 'Se modifico un parametro critico: el plan vigente debe recalcularse ' +
                 'antes de transferir dinero.' }
];

/* ==========================================================================
 * J. INVARIANTES DEL CASO
 * --------------------------------------------------------------------------
 * Los consume ejecutarPruebas_(). Son estructurales, no montos: con el trayecto
 * calculado por Maps, los pesos dependen de la ruta real que devuelva Google y
 * no se pueden fijar de antemano.
 * ========================================================================== */

var INVARIANTES_CASO = {
  equiposTotales: 33,
  localidades: 16,
  tecnicos: 10,
  camionetas: 6,
  tecnicosPorCuadrilla: 3,
  horasPorEquipo: 2,
  horasPorCapacitacion: 0.5,
  rendimientoKmL: 20,
  equiposPorLocalidad: {
    'Copiapo': 5, 'Coquimbo': 2, 'La Calera': 1, 'San Antonio': 2,
    'Melipilla': 2, 'Lo Barnechea': 3, 'Puente Alto': 1, 'Santiago': 3,
    'Pudahuel': 3, 'Maipu': 3, 'Curico': 1, 'Talca': 3,
    'San Pedro de la Paz': 1, 'Penco': 1, 'Tome': 1, 'Santa Juana': 1
  },
  capacitacionesPorEscenario: { LITERAL_PDF: 33, OPERACION_REAL: 16 },
  reglas: [
    'La suma de equiposPorLocalidad debe ser 33.',
    'Toda localidad debe quedar visitada al menos una vez.',
    'Ninguna cuadrilla-dia sobre P_JORNADA_DIA_MAX.',
    'Todo tramo debe tener km, horas y peaje con fuente declarada.',
    'Todo tecnico desplegado debe tener un monto de transferencia calculado.',
    'Con 3 tecnicos y 3 equipos en un sitio, las horas de instalacion deben ser 2, no 6.',
    'Con 3 tecnicos y 5 equipos en un sitio, las horas de instalacion deben ser 4.',
    'Una visita de 3 equipos con 3 tecnicos en el escenario de operacion real debe dar ' +
    '2,25 h en sitio: 2 h de instalacion en paralelo mas 15 min de capacitacion.',
    'Los dos escenarios deben correr sobre el mismo plan y diferir solo en capacitacion.'
  ]
};

/* ==========================================================================
 * K. ACCESORES PUROS
 * ========================================================================== */

/** Devuelve la definicion de un parametro por su clave, o null si no existe. */
function definicionParametro_(clave) {
  for (var s = 0; s < ESQUEMA_CONFIG.length; s++) {
    var lista = ESQUEMA_CONFIG[s].parametros;
    for (var p = 0; p < lista.length; p++) {
      if (lista[p].clave === clave) return lista[p];
    }
  }
  return null;
}

/** Lista plana de todos los parametros, en orden de siembra. */
function listarParametros_() {
  var salida = [];
  for (var s = 0; s < ESQUEMA_CONFIG.length; s++) {
    for (var p = 0; p < ESQUEMA_CONFIG[s].parametros.length; p++) {
      salida.push({
        seccion: ESQUEMA_CONFIG[s].seccion,
        definicion: ESQUEMA_CONFIG[s].parametros[p]
      });
    }
  }
  return salida;
}

/** Un parametro es calculado si declara formula: no se edita nunca a mano. */
function esParametroCalculado_(clave) {
  var def = definicionParametro_(clave);
  return !!(def && def.formula);
}

/** Claves cuyo cambio obliga a recalcular el plan completo. */
function listarParametrosCriticos_() {
  return listarParametros_()
    .filter(function (p) { return p.definicion.critico === true; })
    .map(function (p) { return p.definicion.clave; });
}

/** Parametros que provienen textualmente del enunciado: no se negocian. */
function listarParametrosDelEnunciado_() {
  return listarParametros_()
    .filter(function (p) { return p.definicion.fuente === 'PDF'; })
    .map(function (p) { return p.definicion.clave; });
}

/** Definicion de un escenario por su id, o null. */
function definicionEscenario_(id) {
  var lista = ESQUEMA_ESCENARIOS.definiciones;
  for (var i = 0; i < lista.length; i++) {
    if (lista[i].id === id) return lista[i];
  }
  return null;
}

/**
 * Aplica un escenario sobre los parametros ya leidos de CONFIG y devuelve una
 * COPIA. No muta la entrada: el motor necesita correr los dos escenarios sobre
 * los mismos datos base.
 */
function aplicarEscenario_(parametros, idEscenario) {
  var escenario = definicionEscenario_(idEscenario);
  if (!escenario) throw new Error('Escenario desconocido: ' + idEscenario);

  var copia = {};
  for (var clave in parametros) {
    if (Object.prototype.hasOwnProperty.call(parametros, clave)) {
      copia[clave] = parametros[clave];
    }
  }
  for (var sobrescrita in escenario.sobrescribe) {
    if (Object.prototype.hasOwnProperty.call(escenario.sobrescribe, sobrescrita)) {
      copia[sobrescrita] = escenario.sobrescribe[sobrescrita];
    }
  }
  // La capacitacion efectiva es formula en la hoja: al cambiar el escenario hay
  // que recalcularla en memoria, porque la celda sigue con el valor del activo.
  copia.P_T_CAP_EFECTIVA = copia.P_CAP_DIGITAL_PREVIA
    ? copia.P_T_CAPACITACION * (1 - copia.P_REDUCCION_CAP)
    : copia.P_T_CAPACITACION;

  return copia;
}

/**
 * Horas de trabajo en un sitio. Es la regla que mas se malinterpreta del caso,
 * por eso vive aqui y no repartida por el motor.
 *
 *   equipos = 3, tecnicos = 3  ->  techo(3/3) x 2 h = 2 h   (no 6 h)
 *   equipos = 5, tecnicos = 3  ->  techo(5/3) x 2 h = 4 h   (dos vueltas)
 *
 * @param {number} equipos        equipos a instalar en el sitio
 * @param {number} tecnicosEnSitio tecnicos de la cuadrilla presentes
 * @param {boolean} primeraVisita  solo la primera visita ejecuta trabajo
 * @param {Object} p               parametros ya resueltos para el escenario
 * @return {{instalacion:number, capacitacion:number, total:number}} horas
 */
function horasEnSitio_(equipos, tecnicosEnSitio, primeraVisita, p) {
  if (!primeraVisita || equipos <= 0 || tecnicosEnSitio <= 0) {
    return { instalacion: 0, capacitacion: 0, total: 0 };
  }

  // No hay limite de cuanta gente se manda a un destino: mientras mas tecnicos,
  // menos tiempo. El unico tope posible es fisico, si la jefatura declara
  // cuantas personas caben trabajando a la vez en una misma instalacion.
  var enParalelo = tecnicosEnSitio;
  if (p.P_TECNICOS_MAX_POR_SITIO > 0) {
    enParalelo = Math.min(tecnicosEnSitio, p.P_TECNICOS_MAX_POR_SITIO);
  }

  var instalacion = p.P_PARALELIZA_INSTALACION
    ? Math.ceil(equipos / enParalelo) * p.P_T_INSTALACION
    : equipos * p.P_T_INSTALACION;

  // Se capacita al cliente, no al equipo: una sesion por sitio visitado.
  var sesiones = (p.P_CAP_BASE === 'Por equipo') ? equipos : 1;
  var capacitacion = sesiones * p.P_T_CAP_EFECTIVA;

  return {
    instalacion: instalacion,
    capacitacion: capacitacion,
    total: instalacion + capacitacion
  };
}
