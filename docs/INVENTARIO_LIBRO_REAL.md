# Inventario del libro real «Evaluacion 1»

Levantado el 14-09-2026 leyendo el spreadsheet directamente, no desde supuestos.

## Cómo se obtuvo

Por dos vías que se complementan:

1. El propietario (`alvarovillena7@gmail.com`) compartió el libro con
   `alvarovillena8@gmail.com`, la cuenta del conector de Drive de esta sesión. Eso dio
   lectura de los valores.
2. El propietario ejecutó `prepararMigracionPlanillaFuncional` el 14-09-2026 a las 10:12.
   Creó la copia de respaldo, la verificó celda por celda contra el original y exportó
   `inventario.json`, que trae lo que la exportación de texto no puede dar: **fórmulas,
   rangos con nombre y activadores**.

La lectura por Drive venía incompleta en la hoja que más importa: capturó 185 de las 305
filas de CONFIG. El `inventario.json` es la fuente autorizada y es la que se usó para la
conciliación de parámetros.

`clasp run` sigue sin servir (`NOT_FOUND`: el proyecto usa el cliente OAuth genérico de
clasp, sin proyecto GCP propio ni despliegue de API ejecutable), así que **instalar la
aplicación nueva sigue requiriendo que el propietario ejecute desde el editor**.

## Qué contiene el libro: 25 hojas

Dos sistemas conviven en el mismo archivo.

### A. Las 5 hojas de la aplicación v2 activa

| Hoja | Filas | Qué tiene |
|---|---:|---|
| CONFIG | 305 | 97 parámetros `P_*` y 16 tablas con nombre: plazas MOP, peajes, tarifas, corredores, feriados, checklist, categorías, semáforo y diagnóstico |
| DESTINOS | 18 | 17 localidades con dirección exacta, corredor, plazas de peaje y km de Maps |
| PLAN | 84 | Tramos del plan con una casilla por técnico |
| _RUTAS | 134 | Caché de consultas a Google Maps |
| _BITACORA | 23 | Auditoría de instalaciones, ingresos, recálculos y sincronizaciones |

Esta parte **sí es trabajo del usuario**: la bitácora registra instalaciones, ingresos y dos
sincronizaciones que agregaron 9 y 12 parámetros a CONFIG los días 12 y 13 de septiembre.

### B. Las 20 hojas del CRM v1 anterior

TECNICOS (10), VEHICULOS (6), MATRIZ_DISTANCIAS (240), REQUERIMIENTOS (16), CUADRILLAS (8),
ORDENES_TRABAJO (25), ITINERARIO (22), CALENDARIO (137), GASTOS (60), VIATICOS (30),
MARCAS_TIEMPO (0), MATERIALES (0), HOTELES (11), CAPACITACIONES (25), KPI_TECNICO (10),
KPI_SEMANAL (28), RENTABILIDAD (14), TARIFAS_AEREAS (0), PRECIOS_COMBUSTIBLE (0), LOG (16).

Los conteos son filas de datos, sin encabezado, y cuadran uno a uno con los que devolvió el
puente de respaldo.

**Son datos de demostración, no operación real.** Evidencia: los nombres, RUT y correos
(`Sebastian Munoz Cortes`, `smunoz@servitec.cl`), el cliente único
`Telecomunicaciones Andes S.A.` y las 16 comunas coinciden uno a uno con
`.local-backup/05_Seed.js`, la semilla del CRM v1. Todas las fechas de solicitud son
11-09-2026, el mismo día en que se creó el archivo.

Consecuencia para la migración: **no hay histórico operativo que preservar en estas 20
hojas**. Lo que sí hay que conservar es la configuración de la parte A.

## Defectos encontrados en el libro en producción

1. **66 de 134 consultas de Maps fallaron** con
   `Cannot read properties of undefined (reading 'DRIVING')`. Por eso DESTINOS tiene la
   columna «Km desde base» vacía en 11 de 16 localidades. Las 68 consultas que sí
   respondieron son datos válidos y se aprovecharon (ver abajo).
2. **Dos celdas de CONFIG muestran `#ERROR!`**: «Capacitacion presencial efectiva» y
   «Tope diario absoluto con horas extra». Son parámetros derivados que el resto del
   modelo usa.
3. **El catálogo de plazas no pasa de Curicó**: Talca aparece con el mismo peaje de ida que
   Curicó ($5.249), y Santa Juana, Penco y Tomé comparten $15.649. La hoja lo rotula
   «estimado», pero conviene completarlo con la cartola del TAG antes de presentar cifras.

La causa del punto 2 quedó identificada: las dos fórmulas hacen `IF()` sobre un parámetro
que contiene el texto `"Si"`, y Sheets no convierte texto a booleano; falta el `="Si"`. El
detalle está en `docs/CONCILIACION_PARAMETROS.md`.

El respaldo no encontró **ningún activador instalado** en el proyecto, así que no hay
disparadores antiguos que desactivar durante el corte.

## Qué se incorporó a la implementación nueva

| Dato | Antes (supuesto) | Ahora (libro real) |
|---|---|---|
| `P_VEL_URBANA` | 28 km/h | 36 km/h — 182,0 km en 299 min, 10 tramos |
| `P_VEL_R78` | 80 km/h | 69 km/h — 356,4 km en 311 min, 4 tramos |
| `P_VEL_RUTA5` | 90 km/h | 80 km/h — ponderada de R5 Norte (78,8) y Sur (82,2) |
| `P_FACTOR_HORAS` | no existía | 1,1 — corrección del libro sobre el tiempo puro de Maps |
| `P_BASE` | «Av. Vicuña Mackenna 3864, Macul» | dirección completa del libro, geocodificable |
| `P_CAPACIDAD_CAMIONETA` | no existía | 3 — `AGENDAR` validaba contra el tamaño de cuadrilla |
| `P_HORAS_EXTRA_SEMANA` | no existía | 10 — no había control semanal de horas extra |
| Km de las 16 comunas | estimados radiales | ruta rápida de Maps, caché `_RUTAS` |
| Peaje de ida | referencial | catálogo de plazas MOP 2026 de DESTINOS |
| Tramos intercomunales | «SUPUESTO» | `Origen_Dato` declara MAPS, MAPS INVERSO o MAPS Y PEAJE DERIVADO |

La conciliación parámetro por parámetro de los 97 códigos `P_*` del libro está en
`docs/CONCILIACION_PARAMETROS.md`, con cuatro puntos que necesitan tu decisión.

Quedan dos tramos sin dato de Maps, y el motor los sigue alertando como ruta estimada:
Lo Barnechea → Puente Alto y Tomé → Santa Juana.

## Dos correcciones al plan de demostración que obligaron los datos reales

Con los kilómetros verdaderos, el itinerario que antes cerraba dejó de ser legal:

1. **Santiago → Copiapó no se puede hacer en un día.** Son 812,2 km reales, 10,15 h al
   volante, sobre el tope de 9 h (`P_TOPE_CONDUCCION`). La ida se parte con pernocta en
   Coquimbo, la misma escala que el regreso ya usaba. El plan pasa de 4 a 5 días hábiles.
2. **Talca de ida y vuelta en el día sumaba 10,72 h**, sobre el tope de 10,4 h. Se encadena
   con Curicó, que comparte el corredor R5S, tal como ordena el propio parámetro
   «Agrupar localidades del mismo corredor» de CONFIG.

`AGENDAR` ahora rechaza Copiapó como traslado directo y exige un itinerario de tramos
explícito. Es el comportamiento correcto, y hay una prueba que lo fija.

## Efecto en las cifras del caso

| Concepto | Antes | Ahora |
|---|---:|---:|
| Kilómetros | 4.083 | 3.768,6 |
| Peajes | $147.800 | $118.325 |
| Combustible | $281.931 | $260.222 |
| Viáticos y colación | $540.000 | $590.000 |
| Hotel | $500.000 | $700.000 |
| Nómina a transferir | $1.620.000 | $1.840.000 |
| Desgaste | — | $226.116 |
| Horas extra | $9.533 | $56.053 |
| Costo de operación | $1.942.810 | $2.122.169 |

Baja el kilometraje porque los supuestos radiales exageraban las distancias. Sube el
alojamiento porque el plan real necesita dos noches más, y suben las horas extra porque el
factor de corrección de 1,1 sobre el tiempo de Maps empuja cinco jornadas a sobretiempo.
Ninguna queda fuera de ley ni sobre el tope de conducción.

## Lo que sigue pendiente de Google

- Ejecutar la instalación en una copia de ensayo y comprobar formatos, protecciones y
  evaluación numérica de las fórmulas.
- Completar el catálogo de plazas más allá de Curicó.
- Consultar a Maps los dos tramos que siguen como supuesto.
- Revisar por qué falló la mitad de las consultas de Maps antes de reutilizar ese módulo.
