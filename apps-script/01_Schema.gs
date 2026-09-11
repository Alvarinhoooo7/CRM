/**
 * ============================================================================
 *  01_Schema.gs  ·  Definicion declarativa de todas las hojas del libro.
 * ============================================================================
 *  Cada hoja se declara con sus columnas, ancho, formato y validaciones.
 *  02_Setup.gs consume esta definicion para construir el libro completo.
 *  El resto del codigo accede a columnas SIEMPRE por nombre, nunca por indice,
 *  de modo que agregar una columna aqui no rompe nada.
 * ============================================================================
 */

/** Catalogos usados por las validaciones de datos (listas desplegables). */
var LISTAS = {
  ESTADO_OT:        ['PLANIFICADA', 'ASIGNADA', 'EN_RUTA', 'EN_SITIO', 'EN_EJECUCION', 'PAUSADA', 'COMPLETADA', 'NO_REALIZADA', 'REPROGRAMADA'],
  ESTADO_REQ:       ['PENDIENTE', 'PLANIFICADO', 'EN_CURSO', 'CERRADO', 'ANULADO'],
  MODO_TRANSPORTE:  ['CAMIONETA', 'AVION', 'BUS', 'UBER', 'METRO_MICRO', 'MIXTO', 'A_PIE'],
  CATEGORIA_GASTO:  ['COMBUSTIBLE', 'PEAJE', 'ALOJAMIENTO', 'VIATICO', 'COLACION', 'PASAJE_AEREO', 'PASAJE_BUS', 'TRANSPORTE_APP', 'TRANSPORTE_PUBLICO', 'ESTACIONAMIENTO', 'FLETE', 'MATERIAL', 'IMPREVISTO', 'OTRO'],
  ESTADO_GASTO:     ['BORRADOR', 'ENVIADO', 'APROBADO', 'RECHAZADO', 'REEMBOLSADO'],
  MEDIO_PAGO:       ['EFECTIVO_VIATICO', 'TARJETA_EMPRESA', 'TAG_EMPRESA', 'PERSONAL_REEMBOLSABLE'],
  TIPO_MARCA:       ['INICIO_JORNADA', 'INICIO_VIAJE', 'FIN_VIAJE', 'INICIO_COLACION', 'FIN_COLACION', 'INICIO_OT', 'FIN_OT', 'PAUSA', 'REANUDA', 'FIN_JORNADA'],
  ESTADO_VIATICO:   ['CALCULADO', 'APROBADO', 'TRANSFERIDO', 'RENDIDO', 'CERRADO'],
  ESTADO_VEHICULO:  ['DISPONIBLE', 'EN_RUTA', 'MANTENCION', 'FUERA_SERVICIO'],
  CARGO:            ['TECNICO_INSTALADOR', 'TECNICO_SENIOR', 'SUPERVISOR', 'COORDINADOR'],
  MODO_CAPACITACION:['PRESENCIAL', 'VIDEO_ASINCRONICO', 'MIXTO'],
  PRIORIDAD:        ['BAJA', 'NORMAL', 'ALTA', 'CRITICA'],
  SI_NO:            ['SI', 'NO']
};

/**
 * Definicion de hojas.
 *  n  = nombre de columna (clave de acceso)
 *  t  = tipo logico: text | number | money | date | datetime | time | bool | list | formula | url
 *  w  = ancho en px
 *  l  = nombre de lista en LISTAS (solo t='list')
 *  f  = formula A1 para columnas calculadas (se aplica desde la fila 2)
 */
var SCHEMA = {};

SCHEMA[SH.CONFIG] = {
  titulo: 'Parametros del sistema',
  color: '#1a73e8',
  congelar: 1,
  cols: [
    { n: 'CLAVE',       t: 'text',   w: 260 },
    { n: 'VALOR',       t: 'text',   w: 160 },
    { n: 'TIPO',        t: 'text',   w: 80  },
    { n: 'UNIDAD',      t: 'text',   w: 80  },
    { n: 'DESCRIPCION', t: 'text',   w: 420 },
    { n: 'GRUPO',       t: 'text',   w: 120 }
  ]
};

SCHEMA[SH.TECNICOS] = {
  titulo: 'Dotacion tecnica',
  color: '#188038',
  congelar: 1,
  cols: [
    { n: 'TECNICO_ID',      t: 'text',   w: 90  },
    { n: 'NOMBRE',          t: 'text',   w: 190 },
    { n: 'RUT',             t: 'text',   w: 110 },
    { n: 'CARGO',           t: 'list',   w: 160, l: 'CARGO' },
    { n: 'EMAIL',           t: 'text',   w: 210 },
    { n: 'TELEFONO',        t: 'text',   w: 110 },
    { n: 'COMUNA_RESIDENCIA', t: 'text', w: 140 },
    { n: 'LAT_RESIDENCIA',  t: 'number', w: 90  },
    { n: 'LNG_RESIDENCIA',  t: 'number', w: 90  },
    { n: 'LICENCIA_CONDUCIR', t: 'text', w: 100 },
    { n: 'PUEDE_CONDUCIR',  t: 'list',   w: 100, l: 'SI_NO' },
    { n: 'ESPECIALIDAD',    t: 'text',   w: 170 },
    { n: 'NIVEL',           t: 'number', w: 70  },
    { n: 'COSTO_HORA',      t: 'money',  w: 100 },
    { n: 'DISPONIBLE_VIAJE', t: 'list',  w: 120, l: 'SI_NO' },
    { n: 'ACTIVO',          t: 'list',   w: 80,  l: 'SI_NO' },
    { n: 'FOTO_URL',        t: 'url',    w: 120 }
  ]
};

SCHEMA[SH.VEHICULOS] = {
  titulo: 'Flota',
  color: '#188038',
  congelar: 1,
  cols: [
    { n: 'VEHICULO_ID',     t: 'text',   w: 100 },
    { n: 'PATENTE',         t: 'text',   w: 90  },
    { n: 'MARCA_MODELO',    t: 'text',   w: 170 },
    { n: 'ANIO',            t: 'number', w: 70  },
    { n: 'COMBUSTIBLE',     t: 'text',   w: 100 },
    { n: 'RENDIMIENTO_KM_L', t: 'number', w: 130 },
    { n: 'CAPACIDAD_KG',    t: 'number', w: 110 },
    { n: 'CAPACIDAD_PASAJEROS', t: 'number', w: 120 },
    { n: 'TIENE_TAG',       t: 'list',   w: 90,  l: 'SI_NO' },
    { n: 'ESTADO',          t: 'list',   w: 130, l: 'ESTADO_VEHICULO' },
    { n: 'KM_ACTUAL',       t: 'number', w: 100 },
    { n: 'PROX_MANTENCION_KM', t: 'number', w: 140 },
    { n: 'OBSERVACION',     t: 'text',   w: 240 }
  ]
};

SCHEMA[SH.DESTINOS] = {
  titulo: 'Localidades atendidas',
  color: '#e37400',
  congelar: 1,
  cols: [
    { n: 'DESTINO_ID',      t: 'text',   w: 100 },
    { n: 'REGION',          t: 'text',   w: 190 },
    { n: 'PROVINCIA',       t: 'text',   w: 130 },
    { n: 'COMUNA',          t: 'text',   w: 150 },
    { n: 'DIRECCION',       t: 'text',   w: 280 },
    { n: 'LAT',             t: 'number', w: 95  },
    { n: 'LNG',             t: 'number', w: 95  },
    { n: 'ZONA',            t: 'text',   w: 110 },
    { n: 'KM_DESDE_BASE',   t: 'number', w: 120 },
    { n: 'MIN_DESDE_BASE',  t: 'number', w: 120 },
    { n: 'PEAJE_IDA_CLP',   t: 'money',  w: 120 },
    { n: 'AEROPUERTO_IATA', t: 'text',   w: 110 },
    { n: 'KM_AEROPUERTO_DESTINO', t: 'number', w: 160 },
    { n: 'TIENE_METRO',     t: 'list',   w: 100, l: 'SI_NO' },
    { n: 'REQUIERE_PERNOCTAR', t: 'list', w: 140, l: 'SI_NO' },
    { n: 'CONTACTO_SITIO',  t: 'text',   w: 170 },
    { n: 'TELEFONO_SITIO',  t: 'text',   w: 120 }
  ]
};

SCHEMA[SH.MATRIZ] = {
  titulo: 'Matriz de distancias reales',
  color: '#e37400',
  congelar: 1,
  cols: [
    { n: 'ORIGEN_ID',   t: 'text',   w: 110 },
    { n: 'DESTINO_ID',  t: 'text',   w: 110 },
    { n: 'KM',          t: 'number', w: 90  },
    { n: 'MINUTOS',     t: 'number', w: 90  },
    { n: 'PEAJE_CLP',   t: 'money',  w: 110 },
    { n: 'FUENTE',      t: 'text',   w: 140 },
    { n: 'ACTUALIZADO', t: 'datetime', w: 150 }
  ]
};

SCHEMA[SH.REQUERIMIENTOS] = {
  titulo: 'Requerimientos del cliente',
  color: '#d93025',
  congelar: 1,
  cols: [
    { n: 'REQ_ID',          t: 'text',   w: 100 },
    { n: 'CLIENTE',         t: 'text',   w: 190 },
    { n: 'DESTINO_ID',      t: 'text',   w: 100 },
    { n: 'COMUNA',          t: 'text',   w: 150 },
    { n: 'EQUIPOS',         t: 'number', w: 90  },
    { n: 'TIPO_SERVICIO',   t: 'text',   w: 190 },
    { n: 'REQUIERE_CAPACITACION', t: 'list', w: 160, l: 'SI_NO' },
    { n: 'PRIORIDAD',       t: 'list',   w: 100, l: 'PRIORIDAD' },
    { n: 'FECHA_SOLICITUD', t: 'date',   w: 130 },
    { n: 'SLA_DIAS',        t: 'number', w: 90  },
    { n: 'FECHA_COMPROMISO', t: 'date',  w: 140 },
    { n: 'ESTADO',          t: 'list',   w: 130, l: 'ESTADO_REQ' },
    { n: 'OBSERVACION',     t: 'text',   w: 280 }
  ]
};

SCHEMA[SH.CUADRILLAS] = {
  titulo: 'Despachos (cuadrillas de tamano variable)',
  color: '#9334e6',
  congelar: 1,
  cols: [
    { n: 'CUADRILLA_ID',    t: 'text',   w: 110 },
    { n: 'NOMBRE',          t: 'text',   w: 180 },
    { n: 'ZONA',            t: 'text',   w: 130 },
    { n: 'TECNICOS_IDS',    t: 'text',   w: 190 },
    { n: 'N_TECNICOS',      t: 'number', w: 100 },
    { n: 'LIDER_ID',        t: 'text',   w: 100 },
    { n: 'MODO_TRANSPORTE', t: 'list',   w: 140, l: 'MODO_TRANSPORTE' },
    { n: 'VEHICULO_ID',     t: 'text',   w: 110 },
    { n: 'FECHA_INICIO',    t: 'date',   w: 120 },
    { n: 'FECHA_FIN',       t: 'date',   w: 120 },
    { n: 'EQUIPOS_TOTAL',   t: 'number', w: 120 },
    { n: 'KM_TOTAL',        t: 'number', w: 110 },
    { n: 'NOCHES',          t: 'number', w: 90  },
    { n: 'COSTO_TOTAL',     t: 'money',  w: 130 },
    { n: 'JUSTIFICACION_MODO', t: 'text', w: 400 }
  ]
};

SCHEMA[SH.OT] = {
  titulo: 'Ordenes de trabajo',
  color: '#1a73e8',
  congelar: 1,
  cols: [
    { n: 'OT_ID',           t: 'text',     w: 110 },
    { n: 'REQ_ID',          t: 'text',     w: 100 },
    { n: 'CUADRILLA_ID',    t: 'text',     w: 110 },
    { n: 'TECNICO_ID',      t: 'text',     w: 100 },
    { n: 'TECNICO_NOMBRE',  t: 'text',     w: 170 },
    { n: 'DESTINO_ID',      t: 'text',     w: 100 },
    { n: 'COMUNA',          t: 'text',     w: 140 },
    { n: 'DIRECCION',       t: 'text',     w: 250 },
    { n: 'FECHA',           t: 'date',     w: 110 },
    { n: 'DIA_SEMANA',      t: 'text',     w: 90  },
    { n: 'HORA_INICIO_PLAN', t: 'datetime', w: 145 },
    { n: 'HORA_FIN_PLAN',   t: 'datetime', w: 145 },
    { n: 'DURACION_PLAN_MIN', t: 'number', w: 130 },
    { n: 'EQUIPOS',         t: 'number',   w: 90  },
    { n: 'CAPACITACION_MODO', t: 'list',   w: 160, l: 'MODO_CAPACITACION' },
    { n: 'HORA_INICIO_REAL', t: 'datetime', w: 145 },
    { n: 'HORA_FIN_REAL',   t: 'datetime', w: 145 },
    { n: 'DURACION_REAL_MIN', t: 'number', w: 130 },
    { n: 'DESVIO_MIN',      t: 'number',   w: 100 },
    { n: 'ESTADO',          t: 'list',     w: 140, l: 'ESTADO_OT' },
    { n: 'VEHICULO_ID',     t: 'text',     w: 100 },
    { n: 'MODO_LLEGADA',    t: 'list',     w: 140, l: 'MODO_TRANSPORTE' },
    { n: 'LAT_CHECKIN',     t: 'number',   w: 100 },
    { n: 'LNG_CHECKIN',     t: 'number',   w: 100 },
    { n: 'FOTO_ANTES_URL',  t: 'url',      w: 120 },
    { n: 'FOTO_DESPUES_URL', t: 'url',     w: 120 },
    { n: 'FIRMA_CLIENTE_URL', t: 'url',    w: 120 },
    { n: 'NOMBRE_RECEPTOR', t: 'text',     w: 170 },
    { n: 'CAPACITACION_OK', t: 'list',     w: 130, l: 'SI_NO' },
    { n: 'NOTAS_TECNICO',   t: 'text',     w: 320 },
    { n: 'MOTIVO_NO_REALIZADA', t: 'text', w: 240 },
    { n: 'INGRESO_CLP',     t: 'money',    w: 120 },
    { n: 'ACTUALIZADO',     t: 'datetime', w: 150 }
  ]
};

SCHEMA[SH.ITINERARIO] = {
  titulo: 'Tramos de traslado',
  color: '#9334e6',
  congelar: 1,
  cols: [
    { n: 'TRAMO_ID',        t: 'text',     w: 110 },
    { n: 'CUADRILLA_ID',    t: 'text',     w: 110 },
    { n: 'FECHA',           t: 'date',     w: 110 },
    { n: 'SECUENCIA',       t: 'number',   w: 90  },
    { n: 'ORIGEN_ID',       t: 'text',     w: 110 },
    { n: 'ORIGEN_NOMBRE',   t: 'text',     w: 160 },
    { n: 'DESTINO_ID',      t: 'text',     w: 110 },
    { n: 'DESTINO_NOMBRE',  t: 'text',     w: 160 },
    { n: 'MODO',            t: 'list',     w: 130, l: 'MODO_TRANSPORTE' },
    { n: 'KM',              t: 'number',   w: 90  },
    { n: 'MINUTOS',         t: 'number',   w: 90  },
    { n: 'HORA_SALIDA',     t: 'datetime', w: 145 },
    { n: 'HORA_LLEGADA',    t: 'datetime', w: 145 },
    { n: 'N_PASAJEROS',     t: 'number',   w: 110 },
    { n: 'COSTO_COMBUSTIBLE', t: 'money',  w: 140 },
    { n: 'COSTO_PEAJE',     t: 'money',    w: 110 },
    { n: 'COSTO_PASAJES',   t: 'money',    w: 120 },
    { n: 'COSTO_TOTAL',     t: 'money',    w: 120 },
    { n: 'LLEGADA_NOCTURNA', t: 'list',    w: 140, l: 'SI_NO' },
    { n: 'DESCANSO_REQUERIDO_H', t: 'number', w: 160 },
    { n: 'JUSTIFICACION',   t: 'text',     w: 400 }
  ]
};

SCHEMA[SH.GASTOS] = {
  titulo: 'Rendicion de gastos',
  color: '#c5221f',
  congelar: 1,
  cols: [
    { n: 'GASTO_ID',        t: 'text',     w: 110 },
    { n: 'FECHA',           t: 'date',     w: 110 },
    { n: 'TECNICO_ID',      t: 'text',     w: 100 },
    { n: 'TECNICO_NOMBRE',  t: 'text',     w: 170 },
    { n: 'CUADRILLA_ID',    t: 'text',     w: 110 },
    { n: 'OT_ID',           t: 'text',     w: 110 },
    { n: 'CATEGORIA',       t: 'list',     w: 160, l: 'CATEGORIA_GASTO' },
    { n: 'DESCRIPCION',     t: 'text',     w: 260 },
    { n: 'MONTO_CLP',       t: 'money',    w: 120 },
    { n: 'PRESUPUESTADO_CLP', t: 'money',  w: 140 },
    { n: 'DESVIO_CLP',      t: 'money',    w: 120 },
    { n: 'MEDIO_PAGO',      t: 'list',     w: 180, l: 'MEDIO_PAGO' },
    { n: 'LITROS',          t: 'number',   w: 90  },
    { n: 'KM_ODOMETRO',     t: 'number',   w: 120 },
    { n: 'BOLETA_URL',      t: 'url',      w: 130 },
    { n: 'ESTADO',          t: 'list',     w: 130, l: 'ESTADO_GASTO' },
    { n: 'APROBADO_POR',    t: 'text',     w: 150 },
    { n: 'COMENTARIO',      t: 'text',     w: 260 },
    { n: 'REGISTRADO',      t: 'datetime', w: 150 }
  ]
};

SCHEMA[SH.VIATICOS] = {
  titulo: 'Transferencias de viaticos',
  color: '#c5221f',
  congelar: 1,
  cols: [
    { n: 'VIATICO_ID',      t: 'text',   w: 110 },
    { n: 'SEMANA',          t: 'text',   w: 100 },
    { n: 'TECNICO_ID',      t: 'text',   w: 100 },
    { n: 'TECNICO_NOMBRE',  t: 'text',   w: 170 },
    { n: 'CUADRILLA_ID',    t: 'text',   w: 110 },
    { n: 'DIAS_TERRENO',    t: 'number', w: 110 },
    { n: 'NOCHES',          t: 'number', w: 90  },
    { n: 'MONTO_ALOJAMIENTO', t: 'money', w: 150 },
    { n: 'MONTO_VIATICO',   t: 'money',  w: 130 },
    { n: 'MONTO_PASAJES',   t: 'money',  w: 130 },
    { n: 'FONDO_COMBUSTIBLE', t: 'money', w: 150 },
    { n: 'FONDO_PEAJES',    t: 'money',  w: 130 },
    { n: 'HOLGURA',         t: 'money',  w: 110 },
    { n: 'TOTAL_TRANSFERIR', t: 'money', w: 150 },
    { n: 'ESTADO',          t: 'list',   w: 130, l: 'ESTADO_VIATICO' },
    { n: 'FECHA_TRANSFERENCIA', t: 'date', w: 160 },
    { n: 'RENDIDO_CLP',     t: 'money',  w: 130 },
    { n: 'SALDO_CLP',       t: 'money',  w: 120 },
    { n: 'OBSERVACION',     t: 'text',   w: 260 }
  ]
};

SCHEMA[SH.MARCAS] = {
  titulo: 'Marcas de tiempo (control de jornada)',
  color: '#f9ab00',
  congelar: 1,
  cols: [
    { n: 'MARCA_ID',    t: 'text',     w: 110 },
    { n: 'TECNICO_ID',  t: 'text',     w: 100 },
    { n: 'FECHA',       t: 'date',     w: 110 },
    { n: 'TIPO',        t: 'list',     w: 160, l: 'TIPO_MARCA' },
    { n: 'TIMESTAMP',   t: 'datetime', w: 160 },
    { n: 'OT_ID',       t: 'text',     w: 110 },
    { n: 'TRAMO_ID',    t: 'text',     w: 110 },
    { n: 'LAT',         t: 'number',   w: 100 },
    { n: 'LNG',         t: 'number',   w: 100 },
    { n: 'ORIGEN_DATO', t: 'text',     w: 120 },
    { n: 'COMENTARIO',  t: 'text',     w: 260 }
  ]
};

SCHEMA[SH.MATERIALES] = {
  titulo: 'Materiales e implementos por OT',
  color: '#188038',
  congelar: 1,
  cols: [
    { n: 'MATERIAL_ID',  t: 'text',   w: 110 },
    { n: 'OT_ID',        t: 'text',   w: 110 },
    { n: 'CUADRILLA_ID', t: 'text',   w: 110 },
    { n: 'ITEM',         t: 'text',   w: 240 },
    { n: 'CATEGORIA',    t: 'text',   w: 140 },
    { n: 'CANTIDAD',     t: 'number', w: 90  },
    { n: 'UNIDAD',       t: 'text',   w: 80  },
    { n: 'PESO_KG',      t: 'number', w: 90  },
    { n: 'CARGADO',      t: 'list',   w: 100, l: 'SI_NO' },
    { n: 'UTILIZADO',    t: 'number', w: 100 },
    { n: 'DEVUELTO',     t: 'number', w: 100 },
    { n: 'COSTO_UNITARIO', t: 'money', w: 130 },
    { n: 'OBSERVACION',  t: 'text',   w: 240 }
  ]
};

SCHEMA[SH.HOTELES] = {
  titulo: 'Alojamientos convenidos',
  color: '#e37400',
  congelar: 1,
  cols: [
    { n: 'HOTEL_ID',     t: 'text',   w: 100 },
    { n: 'DESTINO_ID',   t: 'text',   w: 100 },
    { n: 'COMUNA',       t: 'text',   w: 150 },
    { n: 'NOMBRE',       t: 'text',   w: 220 },
    { n: 'DIRECCION',    t: 'text',   w: 280 },
    { n: 'TELEFONO',     t: 'text',   w: 120 },
    { n: 'VALOR_NOCHE',  t: 'money',  w: 120 },
    { n: 'INCLUYE_DESAYUNO', t: 'list', w: 150, l: 'SI_NO' },
    { n: 'ESTACIONAMIENTO', t: 'list', w: 140, l: 'SI_NO' },
    { n: 'RATING',       t: 'number', w: 80  },
    { n: 'KM_AL_SITIO',  t: 'number', w: 110 },
    { n: 'CONVENIO',     t: 'list',   w: 100, l: 'SI_NO' },
    { n: 'RESERVA_URL',  t: 'url',    w: 130 }
  ]
};

SCHEMA[SH.CAPACITACION] = {
  titulo: 'Capacitaciones',
  color: '#9334e6',
  congelar: 1,
  cols: [
    { n: 'CAP_ID',        t: 'text',     w: 110 },
    { n: 'OT_ID',         t: 'text',     w: 110 },
    { n: 'DESTINO_ID',    t: 'text',     w: 110 },
    { n: 'MODO',          t: 'list',     w: 170, l: 'MODO_CAPACITACION' },
    { n: 'VIDEO_URL',     t: 'url',      w: 180 },
    { n: 'ENVIADO_A',     t: 'text',     w: 210 },
    { n: 'FECHA_ENVIO',   t: 'datetime', w: 150 },
    { n: 'VISTO',         t: 'list',     w: 90,  l: 'SI_NO' },
    { n: 'FECHA_VISTO',   t: 'datetime', w: 150 },
    { n: 'DURACION_MIN',  t: 'number',   w: 110 },
    { n: 'EVALUACION_OK', t: 'list',     w: 130, l: 'SI_NO' },
    { n: 'ASISTENTES',    t: 'number',   w: 100 },
    { n: 'OBSERVACION',   t: 'text',     w: 260 }
  ]
};

SCHEMA[SH.TARIFAS_AEREAS] = {
  titulo: 'Cache de tarifas aereas',
  color: '#80868b',
  congelar: 1,
  cols: [
    { n: 'ORIGEN_IATA',  t: 'text',     w: 110 },
    { n: 'DESTINO_IATA', t: 'text',     w: 110 },
    { n: 'FECHA_VUELO',  t: 'date',     w: 120 },
    { n: 'AEROLINEA',    t: 'text',     w: 140 },
    { n: 'PRECIO_IDA',   t: 'money',    w: 120 },
    { n: 'PRECIO_IDA_VUELTA', t: 'money', w: 150 },
    { n: 'DURACION_MIN', t: 'number',   w: 120 },
    { n: 'ESCALAS',      t: 'number',   w: 90  },
    { n: 'FUENTE',       t: 'text',     w: 130 },
    { n: 'CONSULTADO',   t: 'datetime', w: 150 }
  ]
};

SCHEMA[SH.COMBUSTIBLE] = {
  titulo: 'Precios de combustible (API CNE)',
  color: '#80868b',
  congelar: 1,
  cols: [
    { n: 'REGION',       t: 'text',     w: 190 },
    { n: 'COMUNA',       t: 'text',     w: 150 },
    { n: 'DISTRIBUIDOR', t: 'text',     w: 140 },
    { n: 'DIRECCION',    t: 'text',     w: 260 },
    { n: 'DIESEL',       t: 'money',    w: 100 },
    { n: 'GASOLINA_93',  t: 'money',    w: 120 },
    { n: 'GASOLINA_95',  t: 'money',    w: 120 },
    { n: 'ACTUALIZADO',  t: 'datetime', w: 150 }
  ]
};

SCHEMA[SH.KPI_TECNICO] = {
  titulo: 'KPI por tecnico',
  color: '#1a73e8',
  congelar: 1,
  cols: [
    { n: 'SEMANA',            t: 'text',   w: 100 },
    { n: 'TECNICO_ID',        t: 'text',   w: 100 },
    { n: 'NOMBRE',            t: 'text',   w: 180 },
    { n: 'OT_ASIGNADAS',      t: 'number', w: 120 },
    { n: 'OT_COMPLETADAS',    t: 'number', w: 130 },
    { n: 'EQUIPOS_INSTALADOS', t: 'number', w: 140 },
    { n: 'CAPACITACIONES',    t: 'number', w: 120 },
    { n: 'HORAS_EFECTIVAS',   t: 'number', w: 130 },
    { n: 'HORAS_VIAJE',       t: 'number', w: 110 },
    { n: 'HORAS_COLACION',    t: 'number', w: 130 },
    { n: 'HORAS_TOTALES',     t: 'number', w: 130 },
    { n: 'HORAS_EXTRA',       t: 'number', w: 110 },
    { n: 'PCT_UTILIZACION',   t: 'number', w: 130 },
    { n: 'PCT_TIEMPO_VIAJE',  t: 'number', w: 140 },
    { n: 'KM_RECORRIDOS',     t: 'number', w: 130 },
    { n: 'COSTO_GENERADO',    t: 'money',  w: 140 },
    { n: 'INGRESO_GENERADO',  t: 'money',  w: 150 },
    { n: 'MARGEN_CLP',        t: 'money',  w: 130 },
    { n: 'MARGEN_PCT',        t: 'number', w: 110 },
    { n: 'INGRESO_POR_HORA',  t: 'money',  w: 150 },
    { n: 'CUMPLIMIENTO_SLA_PCT', t: 'number', w: 160 },
    { n: 'PUNTUALIDAD_PCT',   t: 'number', w: 130 },
    { n: 'DESVIO_PROMEDIO_MIN', t: 'number', w: 160 },
    { n: 'GASTO_RENDIDO',     t: 'money',  w: 130 },
    { n: 'GASTO_PRESUPUESTADO', t: 'money', w: 160 },
    { n: 'SEMAFORO',          t: 'text',   w: 110 }
  ]
};

SCHEMA[SH.KPI_SEMANAL] = {
  titulo: 'KPI consolidado semanal',
  color: '#1a73e8',
  congelar: 1,
  cols: [
    { n: 'SEMANA',            t: 'text',   w: 100 },
    { n: 'INDICADOR',         t: 'text',   w: 300 },
    { n: 'VALOR',             t: 'number', w: 130 },
    { n: 'UNIDAD',            t: 'text',   w: 100 },
    { n: 'META',              t: 'number', w: 110 },
    { n: 'CUMPLE',            t: 'text',   w: 90  },
    { n: 'GRUPO',             t: 'text',   w: 140 },
    { n: 'DETALLE',           t: 'text',   w: 380 }
  ]
};

SCHEMA[SH.RENTABILIDAD] = {
  titulo: 'Rentabilidad por destino y servicio',
  color: '#188038',
  congelar: 1,
  cols: [
    { n: 'SEMANA',           t: 'text',   w: 100 },
    { n: 'DESTINO_ID',       t: 'text',   w: 110 },
    { n: 'COMUNA',           t: 'text',   w: 150 },
    { n: 'EQUIPOS',          t: 'number', w: 90  },
    { n: 'INGRESO_CLP',      t: 'money',  w: 130 },
    { n: 'COSTO_MANO_OBRA',  t: 'money',  w: 150 },
    { n: 'COSTO_TRASLADO',   t: 'money',  w: 140 },
    { n: 'COSTO_ALOJAMIENTO', t: 'money', w: 150 },
    { n: 'COSTO_VIATICO',    t: 'money',  w: 130 },
    { n: 'COSTO_TOTAL',      t: 'money',  w: 130 },
    { n: 'MARGEN_CLP',       t: 'money',  w: 130 },
    { n: 'MARGEN_PCT',       t: 'number', w: 110 },
    { n: 'COSTO_POR_EQUIPO', t: 'money',  w: 150 },
    { n: 'HORAS_TOTALES',    t: 'number', w: 130 },
    { n: 'VEREDICTO',        t: 'text',   w: 260 }
  ]
};

SCHEMA[SH.CALENDARIO] = {
  titulo: 'Calendario semanal',
  color: '#f9ab00',
  congelar: 1,
  cols: [
    { n: 'SEMANA',      t: 'text',     w: 100 },
    { n: 'FECHA',       t: 'date',     w: 110 },
    { n: 'DIA',         t: 'text',     w: 90  },
    { n: 'TECNICO_ID',  t: 'text',     w: 100 },
    { n: 'TECNICO',     t: 'text',     w: 170 },
    { n: 'CUADRILLA_ID', t: 'text',    w: 110 },
    { n: 'BLOQUE',      t: 'text',     w: 130 },
    { n: 'HORA_INICIO', t: 'datetime', w: 145 },
    { n: 'HORA_FIN',    t: 'datetime', w: 145 },
    { n: 'DURACION_H',  t: 'number',   w: 110 },
    { n: 'DETALLE',     t: 'text',     w: 340 },
    { n: 'UBICACION',   t: 'text',     w: 160 },
    { n: 'REFERENCIA_ID', t: 'text',   w: 120 },
    { n: 'ESTADO',      t: 'text',     w: 130 }
  ]
};

SCHEMA[SH.LOG] = {
  titulo: 'Bitacora del sistema',
  color: '#80868b',
  congelar: 1,
  cols: [
    { n: 'TIMESTAMP', t: 'datetime', w: 165 },
    { n: 'NIVEL',     t: 'text',     w: 90  },
    { n: 'MODULO',    t: 'text',     w: 150 },
    { n: 'MENSAJE',   t: 'text',     w: 520 },
    { n: 'USUARIO',   t: 'text',     w: 200 }
  ]
};

/** Orden de creacion de las hojas en el libro. */
var ORDEN_HOJAS = [
  SH.CONFIG, SH.TECNICOS, SH.VEHICULOS, SH.DESTINOS, SH.MATRIZ,
  SH.REQUERIMIENTOS, SH.CUADRILLAS, SH.OT, SH.ITINERARIO, SH.CALENDARIO,
  SH.GASTOS, SH.VIATICOS, SH.MARCAS, SH.MATERIALES, SH.HOTELES,
  SH.CAPACITACION, SH.KPI_TECNICO, SH.KPI_SEMANAL, SH.RENTABILIDAD,
  SH.TARIFAS_AEREAS, SH.COMBUSTIBLE, SH.LOG
];

/** Devuelve la lista de nombres de columna de una hoja. */
function columnasDe(nombreHoja) {
  var def = SCHEMA[nombreHoja];
  if (!def) throw new Error('Hoja no declarada en SCHEMA: ' + nombreHoja);
  return def.cols.map(function (c) { return c.n; });
}
