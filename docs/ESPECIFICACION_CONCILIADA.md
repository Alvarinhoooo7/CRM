# Especificación conciliada y resultados de referencia

El documento rector es el prompt original. Se adoptan las correcciones del plan autorizado; esta especificación no presenta sus totales contradictorios como criterios válidos.

## Modelo y propiedad

`Setup.gs` contiene el diccionario ejecutable ESQUEMA, usado por instalación, lectura, escritura y exportación. Son 15 hojas: las 12 funcionales, LEEME_APPSHEET, VISITAS y ENVIOS. ENVIOS es un registro técnico para evitar correos duplicados y recuperar envíos cuyo resultado sea incierto. No es una tabla móvil.

| Datos | Propietario de escritura |
|---|---|
| CONFIG y datos maestros | Supervisor; valores iniciales de Semilla.gs |
| Asignación, fechas, Estado_Orden administrativo, recorridos de VISITAS | Supervisor / agenda confirmada |
| Costos, horas previstas, nombres derivados y Email de ORDENES | Motor |
| Hitos, firma, foto, observaciones y GPS de ORDENES | Técnico; el motor nunca escribe estos campos |
| Equipos instalados y evidencia de VISITAS | Conductor asignado |
| Marcado y Hora_Marcado de CHECKLIST | Técnico |
| Alta de GASTOS | Técnico con clave local estable; folio correlativo posterior |
| Revisión de GASTOS, pagos realmente efectuados | Supervisor |
| Error_Validacion, Recibido_Servidor, estado derivado de hitos | Procesador AppSheet |
| ENVIOS | Apps Script |
| Fórmulas y tablas de supervisión | Apps Script genera fórmulas; Sheets las evalúa |

Las constantes de negocio de la semilla se copian a CONFIG. Los datos de rutas pertenecen a VISITAS/DESTINOS y son editables. Índices de columnas, conversiones de tiempo y tolerancias de representación numérica son constantes técnicas, no tarifas ocultas.

## Decisiones aplicadas

- 14 jornadas de cuadrilla × 2 técnicos = 28 órdenes. Dos jornadas de traslado puro = cuatro órdenes personales. Checklist: 28 × 17 = 476 filas.
- Una VISITA por tramo ordenado permite varias comunas en un día, contando una sola vez equipos y sesiones. La duración de la capacitación se carga a ambos asistentes.
- Jornada mixta o con origen fuera de la RM: viático. Jornada íntegramente RM: colación. Los retornos desde región también reciben viático.
- Un conductor por vehículo/jornada recibe combustible y peajes; desgaste es costo de empresa. No alternar conductores sin cambiar explícitamente las asignaciones.
- Importe individual: base × (1 + reserva), redondeado hacia arriba al millar con tolerancia de precisión binaria. La nómina suma importes individuales.
- El costo presupuestado de operación suma nómina con reserva, desgaste y horas extra. Los pagos reales permanecen separados.
- Los gráficos por comuna prorratean el costo completo del corredor según equipos, incluidos los traslados exclusivos. Es un reparto contable declarado, no un costo geográfico exacto.
- La semilla empieza con cero instalaciones reales y cero transferencias realizadas; los gastos de demo están rotulados y sin comprobantes reales.
- La agenda simula ida/vuelta en un día cuando cabe. Si requiere pernoctación, separa traslado, servicio y regreso, comprueba disponibilidad en todos los días y muestra hotel/viáticos. Los viajes con escalas obligatorias o fines de semana requieren plan explícito antes de confirmar.
- Horas y fotos capturadas por teléfono no se consideran certificación del servidor. La primera recepción queda registrada aparte.

## Rutas intercomunales de demostración

Las siguientes cifras son SUPUESTOS, pendientes de validar contra recorrido real. No provienen de una consulta Maps ni de una cartola TAG. No se obtuvieron restando distancias desde Santiago.

| Tramo | Km | Peajes |
|---|---:|---:|
| Copiapó → Coquimbo | 335 | $7.400 |
| Coquimbo → La Calera | 365 | $14.200 |
| San Pedro de la Paz → Penco | 27 | $0 |
| Penco → Tomé | 14 | $0 |
| Tomé → Santa Juana | 90 | $0 |
| Lo Barnechea → Puente Alto | 40 | $0 |
| Melipilla → San Antonio | 45 | $2.800 |

Los tramos base/destino usan las distancias y peajes referenciales del prompt. Todas las pernoctaciones son referencias; no reservas.

## Referencia reproducible de la semilla

Resultado local de `node tests/planilla.cjs`; falta validar fórmulas y rendimiento en Google:

| Indicador | Resultado |
|---|---:|
| Equipos previstos / comunas / capacitaciones | 33 / 16 / 16 |
| Órdenes / checklist / días hábiles | 28 / 476 / 4 |
| Kilómetros | 4.083 |
| Combustible | $281.931,15 |
| Peajes | $147.800 |
| Viáticos | $500.000 (20 técnico-días) |
| Colaciones | $40.000 (8 técnico-días) |
| Hotel | $500.000 (10 noches personales) |
| Subtotal | $1.469.731,15 |
| Nómina con reserva y redondeo | $1.620.000 |
| Desgaste | $244.980 |
| Horas extra | $77.829,76 |
| Costo presupuestado total | $1.942.809,76 |
| Jornadas sobre tope absoluto | 0 |

Nómina: T01 $454.000; T02 $275.000; T03 $165.000; T04 $55.000; T05 $327.000; T06 $193.000; T07 $27.000; T08 $17.000; T09 $74.000; T10 $33.000.

No fijar estos importes si cambian los tramos o CONFIG. Las verificaciones duraderas deben probar reglas y cuadraturas; los valores de esta tabla solo identifican esta semilla.
