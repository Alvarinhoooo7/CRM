# Servicio Técnico en Ruta

> **Migración en curso a planilla funcional + AppSheet (14-09-2026).** La implementación nueva está en `apps-script/`; todavía no reemplaza la operación remota. Para continuar, leer [checklist detallado](ESTADO_IMPLEMENTACION.md), [especificación conciliada](docs/ESPECIFICACION_CONCILIADA.md), [instalación y corte](docs/OPERACION_Y_MIGRACION.md) y [configuración AppSheet](appsheet/CONFIGURACION_FUNCIONAL.md).
>
> Pruebas locales: `node scripts/check-sintaxis.js`, `node tests/planilla.cjs`, `node tests/hojas.cjs`. El proyecto remoto recibió únicamente la función `prepararMigracionPlanillaFuncional` para respaldar el libro; conserva la aplicación anterior. El contenido que sigue documenta esa versión y se retirará al validar el corte.

**Estudio de caso 2 · Tecnología Aplicada a Sistemas Inteligentes · INACAP Sede Santiago Sur**
Entrega: 14-09-2026 · Grupo de 4 integrantes

Sistema de planificación y control de instalaciones en terreno, construido sobre Google
Sheets + Apps Script. La planilla es la base de datos, todo el cálculo ocurre en JavaScript
y la interfaz es una aplicación web a la que cada técnico entra con un enlace.

> **Este documento está escrito para que los cuatro integrantes puedan preparar la
> presentación y el informe sin tener que leer código.** Cada sección indica qué decir,
> con qué números respaldarlo y dónde verlo en pantalla.

---

# PARTE 1 · LO QUE HAY QUE ENTENDER

## 1.1 El problema del caso

Un servicio técnico presta servicio a una empresa de telecomunicaciones con equipos en todo
Chile. Tiene **personal limitado**: 10 técnicos y 6 camionetas Peugeot Partner para cubrir
el territorio nacional.

Debe instalar **33 equipos en 16 localidades**, desde Copiapó por el norte hasta Tomé por el
sur, trabajando en grupos de 3 personas.

| Dato del enunciado | Valor |
|---|---|
| Técnicos disponibles | 10 |
| Camionetas | 6, con sus herramientas |
| Tiempo de instalación | 2 h por equipo |
| Tiempo de capacitación | 30 min |
| Rendimiento de la camioneta | 20 km/L |

Lo que pide textualmente el enunciado:

1. Calcular **trayecto, estadía y todo lo necesario** para la gestión.
2. Determinar **cuánto dinero se requiere** para la planificación.
3. Determinar **qué monto requiere cada técnico** para hacer su ruta.
4. Indicar **cómo se resolvería el problema de la mejor manera**.
5. Tomar **decisión sobre una futura mejora** (personal, camionetas u otro) justificándola.

Y del caso 2: que cada técnico pueda **verificar su ruta, sus implementos, el hotel y la
camioneta** desde una plataforma.

## 1.2 Los 33 equipos

| Región | Localidad | Equipos |
|---|---|---:|
| Atacama | Copiapó | 5 |
| Coquimbo | Coquimbo | 2 |
| Valparaíso | La Calera | 1 |
| Valparaíso | San Antonio | 2 |
| Metropolitana | Melipilla | 2 |
| Metropolitana | Lo Barnechea | 3 |
| Metropolitana | Puente Alto | 1 |
| Metropolitana | Santiago | 3 |
| Metropolitana | Pudahuel | 3 |
| Metropolitana | Maipú | 3 |
| Maule | Curicó | 1 |
| Maule | Talca | 3 |
| Biobío | San Pedro de la Paz | 1 |
| Biobío | Penco | 1 |
| Biobío | Tomé | 1 |
| Biobío | Santa Juana | 1 |
| **Total** | **16 localidades** | **33** |

## 1.3 Las cuatro decisiones que definen el sistema

Si un integrante solo alcanza a leer una sección, que sea esta. Son las cuatro cosas que
distinguen este trabajo de llenar una planilla.

### Decisión 1 · La planilla es mínima a propósito

Solo tres pestañas visibles: `CONFIG`, `DESTINOS` y `PLAN`. Nada de columnas auxiliares ni
fórmulas encadenadas.

**Por qué:** una planilla con 40 columnas de fórmulas no se puede auditar y se rompe cuando
alguien inserta una fila. Acá el motor lee por *rangos con nombre*, así que se pueden mover
filas sin quebrar nada. El cálculo vive en JavaScript, donde se puede probar.

### Decisión 2 · Todo lo configurable vive en un solo archivo

`00_Esquema.gs` tiene **83 parámetros**, 12 tablas maestras y 29 reglas de validación. De
ahí se generan solas la hoja `CONFIG`, las validaciones de celda y los formularios de la web.

Cada parámetro declara su origen:

- **PDF** — textual del enunciado. No se negocia.
- **JEFATURA** — decisión nuestra, documentada.
- **SUPUESTO** — supuesto declarado, hay que defenderlo en el informe.

> Esto es lo que hace defendible el trabajo: cuando el docente pregunte "¿de dónde sacaste
> ese número?", la respuesta está escrita al lado del número.

### Decisión 3 · Se calculan dos escenarios sobre el mismo plan

El enunciado dice que cada equipo lleva "su correspondiente capacitación". Nosotros
proponemos capacitar **al cliente, no al equipo**: se le envía por correo un enlace de Drive
con el material antes de la visita, y en terreno se dicta una sola sesión por sitio para
resolver dudas concretas.

| | Literal del enunciado | Como opera el servicio |
|---|---|---|
| Capacitaciones | 33 sesiones de 30 min | 16 sesiones de 15 min |
| Horas | 16,5 h | 4,0 h |

**Ahorro: 12,5 horas-hombre.** El sistema corre los dos escenarios sobre el mismo plan y
muestra la diferencia. Eso convierte la propuesta en un número, no en una opinión.

### Decisión 4 · El objetivo es costo mínimo, no tiempo mínimo

Esto no es una carrera. Se acepta alargar el plan si eso lo abarata, con techo de 20 días
hábiles. Se atienden primero los destinos lejanos agrupados por corredor, y la Región
Metropolitana al final con días cortos y sin hotel.

---

# PARTE 2 · CÓMO SE CALCULA CADA COSA

Esta parte es el corazón del informe. Cada regla tiene su fórmula y un ejemplo.

## 2.1 Paralelización: la regla que más se malinterpreta

Tres técnicos en un sitio instalan tres equipos **al mismo tiempo**, no uno tras otro.

```
horas_instalación = redondear_hacia_arriba(equipos ÷ técnicos) × 2 h
```

| Situación | Cálculo | Resultado |
|---|---|---|
| 3 equipos, 3 técnicos | techo(3/3) × 2 h | **2 h**, no 6 h |
| 5 equipos, 3 técnicos | techo(5/3) × 2 h | **4 h** (dos vueltas) |
| 5 equipos, 6 técnicos | techo(5/6) × 2 h | **2 h** (una vuelta) |
| 1 equipo, 3 técnicos | techo(1/3) × 2 h | **2 h** (sobran manos) |

Con la capacitación de 15 min, una visita de 3 equipos son **2 h 15 min**.

> **Para la presentación:** este es el punto donde la mayoría se equivoca y multiplica 33
> equipos × 2 h = 66 h. Está mal: depende de cuánta gente se mande.

## 2.2 El trabajo se ejecuta en la primera visita

Una localidad instala **la primera vez** que se llega. Volver a pasar por esa ciudad
(pernocte de regreso, parada técnica) son 0 equipos y 0 capacitaciones.

**Si llegan varias cuadrillas el mismo día, todas trabajan** y se reparten los equipos en
proporción a su dotación. Seis técnicos en Copiapó terminan los 5 equipos en 2,25 h en vez
de 4,25 h.

## 2.3 Cuánta gente mandar

No hay límite de personas ni de camionetas hacia un destino. El **único límite real es de
comodidad: 3 personas por camioneta** con sus bolsos. Si hace falta más gente, se mandan más
camionetas.

Pero mandar más gente no siempre conviene:

| Dotación en Copiapó | Tiempo en sitio | Horas-hombre |
|---|---:|---:|
| 3 técnicos (1 camioneta) | 4,25 h | 40,05 |
| 6 técnicos (2 camionetas) | **2,25 h** | **68,1** |

Baja el reloj, sube el costo. El sistema muestra las dos cifras y avisa para que se decida
con datos.

## 2.4 Horas extra contra hotel

**Esta es la decisión económica central del trabajo.**

```
Pernoctar (3 técnicos):  3 hotel + 3 viáticos del día siguiente = $225.000
2 h extra (3 técnicos):  3 × 2 h × $6.500 × 1,5                 =  $58.500
```

Un ejemplo real que calcula el sistema, destino a 4 h con 3 equipos:

| Alternativa | Sobretiempo | Hotel | Viático | **Total** |
|---|---:|---:|---:|---:|
| **Ida y vuelta el mismo día** | $54.112 | $0 | $75.000 | **$379.113** |
| Con una noche fuera | $0 | $150.000 | $150.000 | $550.000 |
| Con 2 noches fuera | $0 | $300.000 | $225.000 | $775.000 |

**Ahorro por apretar el día: $170.887.**

Por eso `SOBRETIEMPO` no es una falla en el semáforo: es una decisión. La línea roja es
`FUERA DE LEY` a las **10,4 h** (jornada contractual de 8,4 h + 2 h extra legales), y ese
límite no se negocia por ahorro. También se controla el tope de 10 h extra semanales por
técnico.

## 2.5 El semáforo de jornada

| Estado | Límite | Significado |
|---|---|---|
| **OK** | ≤ 7,4 h | Dentro de la jornada efectiva |
| **TOLERANCIA** | ≤ 8,4 h | Se absorbe con el banco de horas |
| **SOBRETIEMPO** | ≤ 10,4 h | Horas extra pagadas con 50% de recargo |
| **FUERA DE LEY** | > 10,4 h | Debe ser cero. Replanificar |

La jornada de 7,4 h sale de: 42 h semanales (Ley 21.561) − 5 h de colación = 37 h efectivas
÷ 5 días.

## 2.6 Peajes: sumados plaza por plaza

El sistema tiene el catálogo MOP 2026 completo: **65 plazas y pórticos**, con la tarifa de
categoría 1 (auto y camioneta). El peaje de un viaje es la **suma de las plazas que se
cruzan**, no una estimación.

**Validación del método:** la suma de los 8 pórticos de la Ruta 78 hasta San Antonio da
**$4.008**, y la guía MOP declara **~$4.010** para ese destino.

Si dos localidades comparten corredor, solo se cobran las plazas que las separan. Por eso
**Talca → Curicó cuesta $0** en peaje: esas plazas ya se pagaron al bajar.

## 2.7 Cuándo conviene rodear un peaje

Cada tramo se consulta **dos veces** a Google Maps: con y sin peajes. La decisión depende de
dónde cae el tiempo adicional:

| Situación | Costo de la hora de rodeo |
|---|---|
| Cabe en la jornada | **$0** — el técnico ya estaba contratado |
| Excede la jornada | Hora extra con recargo, por cada técnico |
| Obliga a pernoctar | Hotel + viático del día siguiente |

Ejemplo del sistema, **mismo tramo a Melipilla**:

- Día recién empezado → **va por fuera**, ahorra $783
- Ya llevan 8 h → **va por autopista**, el rodeo costaría $17.550 en horas extra

Hay dos frenos: `P_RODEO_MAX_HORAS` (0,75 h) descarta rodeos largos aunque sean más baratos,
porque un desvío de tres horas en ruta interurbana es carretera secundaria sin doble vía ni
bencineras, con la camioneta cargada. Y `P_RODEO_AHORRO_MINIMO` ($3.000) evita rodear por
ahorrar $33.

## 2.8 El costo de cada peso

| Concepto | Fórmula | Nota |
|---|---|---|
| Combustible | km ÷ 20 × $1.381 | Rendimiento del enunciado |
| Peajes | suma de plazas cruzadas | Catálogo MOP, categoría 1 |
| Desgaste | km × $60 | Lo paga la empresa, no el técnico |
| Hotel | noches × técnicos × $50.000 | Por persona, cualquier ciudad |
| Viático | días × técnicos × $25.000 | Una vez al día, **incluye colación** |
| Horas extra | horas × técnicos × $6.500 × 1,5 | Recargo legal del 50% |
| Taxi en destino | km × $1.000 | **No se arrienda vehículo** |
| Imprevistos | subtotal × 10% | El "y otros" que pide el enunciado |

---

# PARTE 3 · BUS Y AVIÓN: EL ANÁLISIS QUE MÁS VALE

## 3.1 Las herramientas caben en un bolso

Todo lo que se necesita para instalar cabe en un **bolso de herramientas común, uno por
técnico**: taladro, destornilladores, crimpeadora, multímetro, tester de red y repuestos
menores.

Esto importa porque significa que **la cuadrilla no depende de la camioneta para trabajar**:
puede viajar en bus o en avión. Lo único que no cabe en un bolso es la **escalera
telescópica**; si el trabajo la exige, ese destino se hace en camioneta sí o sí.

El checklist de la orden de servicio está dividido en tres categorías por esa razón:

- **BOLSO** (8 ítems) — viaja en bus o avión sin problema
- **VEHÍCULO** (4) — escalera, conos, documentos del vehículo
- **PERSONAL** (5) — EPP, celular, documentos del cliente

## 3.2 El tiempo de vuelo no es el tiempo del viaje

**Este es el error que comete casi todo el mundo al comparar.**

| Etapa | Horas |
|---|---:|
| De la base al aeropuerto | 0,75 |
| Check-in y embarque | 2,00 |
| **Vuelo** | **1,60** |
| Desembarque y retiro de bolsos | 0,50 |
| Del aeropuerto de destino a la ciudad | 0,75 |
| **Total puerta a puerta** | **5,60** |

Volar a Copiapó son 5,6 h, no 1,6 h. **El vuelo es apenas el 29% del viaje.**

El check-in es de 2 h y no de 1 h porque las herramientas obligan a facturar equipaje, y las
aerolíneas cierran el mostrador 40 minutos antes del vuelo.

## 3.3 El precio del pasaje no es el costo del viaje

Las herramientas **no pueden ir en cabina**: taladros, alicates y destornilladores están
prohibidos en el equipaje de mano por seguridad aérea. Hay que facturar equipaje, y las
tarifas que se ven en internet **no lo incluyen**.

Copiapó, ida y vuelta, cuadrilla de 3:

| Concepto | Monto |
|---|---:|
| Pasajes (3 personas × 2 tramos × $85.000) | $510.000 |
| Equipaje de bodega (3 bolsos × 2 tramos × $18.000) | $108.000 |
| Taxi a los aeropuertos (4 carreras de 12 km) | $48.000 |
| Taxi dentro de la ciudad (2 días × 20 km) | $40.000 |
| **Transporte** | **$706.000** |

Contra **$267.774** de combustible, peaje y desgaste en camioneta.

## 3.4 Resultado: la camioneta gana en los 16 destinos

| Localidad | Eq | Mejor opción | Costo | Programación |
|---|---:|---|---:|---|
| Santiago | 3 | Camioneta | $78.679 | Ida y vuelta el mismo día |
| Maipú | 3 | Camioneta | $81.025 | Ida y vuelta el mismo día |
| Puente Alto | 1 | Camioneta | $81.398 | Ida y vuelta el mismo día |
| Lo Barnechea | 3 | Camioneta | $83.674 | Ida y vuelta el mismo día |
| Pudahuel | 3 | Camioneta | $83.954 | Ida y vuelta el mismo día |
| Melipilla | 2 | Camioneta | $96.696 | Ida y vuelta el mismo día |
| San Antonio | 2 | Camioneta | $109.342 | Ida y vuelta el mismo día |
| La Calera | 1 | Camioneta | $115.620 | Ida y vuelta el mismo día |
| Curicó | 1 | Camioneta | $136.602 | Ida y vuelta el mismo día |
| Talca | 3 | Camioneta | $153.120 | Ida y vuelta el mismo día |
| Coquimbo | 2 | Camioneta | $448.474 | Con una noche fuera |
| Santa Juana | 1 | Camioneta | $461.639 | Con una noche fuera |
| San Pedro de la Paz | 1 | Camioneta | $467.570 | Con una noche fuera |
| Penco | 1 | Camioneta | $470.672 | Con una noche fuera |
| Tomé | 1 | Camioneta | $475.060 | Con una noche fuera |
| Copiapó | 5 | Camioneta | $792.774 | Con 2 noches fuera |

**La razón es simple y vale la pena decirla en la presentación:** el pasaje se multiplica por
cada persona, mientras que el costo de la camioneta es el mismo vayan uno o tres. Con
cuadrillas de 3, el avión parte con una desventaja de 6 pasajes.

**A qué precio cambiaría la respuesta:** el avión a Copiapó gana solo si la tarifa baja de
**$52.462** por persona por tramo. Con tarifas *low cost* compradas con anticipación
($30.000–$40.000 en SKY o JetSMART), **el avión sí ganaría**. Por eso las tarifas de la tabla
están marcadas como *referenciales*: hay que cotizar antes de decidir.

> **Este es el hallazgo más honesto del trabajo:** el sistema no asume que la camioneta es
> mejor, lo calcula. Y entrega el umbral exacto a partir del cual la respuesta cambia.

---

# PARTE 4 · GUION DE LA PRESENTACIÓN (15 MINUTOS)

El PDF pide 15 minutos con descuento por minuto adicional, máximo 4 personas. Propuesta de
reparto, un bloque por integrante.

## Integrante 1 · Caso y enfoque (3 min)

**Qué decir:**
- El problema: 33 equipos, 16 localidades, 10 técnicos, 6 camionetas.
- Por qué no basta una planilla: el cálculo tiene reglas que las fórmulas de celda no
  expresan bien (paralelización, primera visita, viático por técnico-día).
- La decisión de arquitectura: planilla mínima de 3 hojas, cálculo en JavaScript, interfaz
  web para que cada técnico vea lo suyo sin acceso a los datos de todos.

**Qué mostrar:** pestaña **Resumen**, tarjetas de indicadores.

**Número para cerrar:** *"33 equipos, 16 localidades, y el sistema dice exactamente cuánto
cuesta y cuánto hay que transferirle a cada persona."*

## Integrante 2 · Cómo se planifica y se rutea (4 min)

**Qué decir:**
- Los tres corredores: norte (Ruta 5 N), sur (Ruta 5 S) y Región Metropolitana.
- La regla de paralelización con el ejemplo de 3 equipos / 3 técnicos = 2 h, no 6 h.
- Peajes sumados plaza por plaza, con la validación contra el MOP: $4.008 vs $4.010.
- La decisión de rodear o no: el mismo tramo a Melipilla da respuesta distinta según cuánta
  jornada quede libre.

**Qué mostrar:** pestaña **Rutas y flota**, luego **Peajes** con el desglose por localidad.

**Número para cerrar:** *"Talca a Curicó cuesta $0 en peaje, porque el sistema sabe que esas
plazas ya se pagaron."*

## Integrante 3 · La plata (4 min)

**Qué decir:**
- Composición del gasto: hotel y viáticos pesan más que el combustible.
- La decisión horas extra contra hotel, con el ejemplo de $54.112 vs $225.000.
- La transferencia por técnico: qué incluye y qué no, y por qué no coincide con el gasto
  total.
- Bus y avión: por qué se evaluaron en serio, qué cuesta realmente un vuelo y a qué precio
  cambiaría la decisión.

**Qué mostrar:** pestaña **Gastos**, después **Transporte** con el detalle de Copiapó.

**Número para cerrar:** *"Apretar un día de trabajo ahorra $170.887 frente a pagar una noche
de hotel para tres personas."*

## Integrante 4 · El técnico y la mejora futura (4 min)

**Qué decir:**
- La orden de servicio: ruta, dirección exacta, hotel, vehículo, checklist e implementos.
- Exportación a PDF y enlace directo por técnico.
- Los dos escenarios de capacitación y las 12,5 horas de diferencia.
- La decisión de mejora futura, respondiendo lo que pide el enunciado.

**Qué mostrar:** pestaña **Orden de servicio** con T01, exportar el PDF en vivo.

**Número para cerrar:** *"El cuello de botella no es la gente ni los vehículos: es que la
mitad del tiempo pagado se va en la carretera."*

## Recomendaciones de forma (del PDF)

- Verificar contrastes y tamaño de letra.
- No poner grandes cantidades de texto: una idea y un número por lámina.
- Lenguaje técnico y formal.
- No se requiere vestimenta formal.
- **Ensayar con cronómetro:** hay descuento por minuto adicional.

---

# PARTE 5 · ESTRUCTURA DEL INFORME

El PDF pide formato carta, márgenes 2,5 cm, párrafos justificados con interlineado sencillo,
fuente Arial o Calibri, títulos 14 en negrita, subtítulos 12 en negrita, texto 11 normal,
APA7 recomendado, convertido a PDF.

## Índice propuesto

**1. Introducción**
Contexto del servicio técnico, el problema de cobertura nacional con personal limitado y el
objetivo del trabajo.

**2. Descripción del caso**
Los 33 equipos, las 16 localidades, los recursos disponibles. Tabla de requerimientos.

**3. Metodología**

- 3.1 Supuestos declarados y su origen (la tabla de la sección 6.2 de este documento)
- 3.2 Herramienta construida: arquitectura de tres hojas y motor en JavaScript
- 3.3 Fuentes de datos: Google Maps para trayectos, catálogo MOP 2026 para peajes

**4. Planificación de la operación**

- 4.1 Agrupación por corredores
- 4.2 Conformación de cuadrillas y asignación de vehículos
- 4.3 Regla de paralelización y tiempos en sitio
- 4.4 Programación de jornadas y criterio de pernoctación

**5. Análisis de costos**

- 5.1 Composición del gasto total
- 5.2 Costo por localidad y por equipo instalado
- 5.3 Transferencia requerida por técnico
- 5.4 Comparación de modos de transporte
- 5.5 Análisis de sensibilidad: umbral de tarifa aérea

**6. Propuesta de mejora**

- 6.1 Diagnóstico: el traslado como cuello de botella
- 6.2 Capacitación digital previa
- 6.3 Evaluación de alternativas de inversión
- 6.4 Recomendación y justificación

**7. Gestión tecnológica (caso 2)**
La aplicación web, la vista por técnico, la orden de servicio y el checklist.

**8. Conclusiones**

**9. Referencias** (APA7)

**10. Anexos**
Capturas del sistema, tabla completa de peajes, plan detallado por tramo.

## Referencias sugeridas en APA7

```
Ministerio de Obras Públicas, Dirección General de Concesiones. (2026).
    Tarifas de peajes y pórticos 2026. Gobierno de Chile.

Biblioteca del Congreso Nacional de Chile. (2023). Ley 21.561: Reduce la jornada
    laboral a 40 horas semanales. https://www.bcn.cl

Dirección del Trabajo. (2024). Código del Trabajo: jornada ordinaria y horas
    extraordinarias. Gobierno de Chile.

Google. (2026). Google Maps Platform: Routes API documentation.
    https://developers.google.com/maps/documentation/routes
```

---

# PARTE 6 · RESPALDO PARA LAS PREGUNTAS

## 6.1 Preguntas que el docente probablemente haga

**¿Por qué el gasto total no coincide con la suma de las transferencias?**
Porque son cosas distintas. El gasto total incluye lo que paga la empresa directamente:
desgaste del vehículo, peajes con TAG corporativo, horas extra. La transferencia solo
incluye lo que el técnico saca de su bolsillo: viáticos, hotel y una holgura para
imprevistos.

**¿Por qué 3 equipos con 3 técnicos son 2 horas y no 6?**
Porque trabajan en paralelo: cada uno toma un equipo distinto. La fórmula es
`techo(equipos ÷ técnicos) × 2 h`. Con 5 equipos y 3 técnicos son dos vueltas, o sea 4 h.

**¿Los peajes son reales?**
Salen del catálogo MOP 2026 para categoría 1. El método está validado: la suma de los
pórticos de la Ruta 78 reproduce el total oficial que publica el MOP. **Pero 14 de 17 rutas
están marcadas ESTIMADO** porque la secuencia de plazas se armó por geografía y no se ha
contrastado contra una cartola real del TAG. El sistema muestra ese estado y nunca presenta
un estimado como si fuera auditado.

**¿Por qué no usan el avión si es más rápido?**
Se evaluó en serio. El avión ahorra un día entero a Copiapó, pero cuesta $973.000 contra
$792.774 en camioneta, porque el pasaje se multiplica por cada persona y hay que pagar
equipaje de bodega para las herramientas. El sistema calcula el umbral: con tarifas bajo
$52.462 por persona por tramo, el avión ganaría.

**¿Es un óptimo global?**
No, y hay que decirlo. El motor **evalúa** el plan que se le ingresa y elige la
programación más barata para cada viaje, pero no resuelve un problema de ruteo óptimo tipo
VRP. Es una herramienta de decisión, no un solver.

**¿Se instalaron los equipos?**
No. Son equipos planificados, presupuestos estimados y montos referenciales. No hay
instalaciones ejecutadas ni transferencias bancarias reales.

## 6.2 Supuestos que hay que declarar en el informe

| Supuesto | Valor | Justificación |
|---|---|---|
| Precio del diésel | $1.381/L | Promedio nacional. Verificar antes de planificar |
| Desgaste y mantención | $60/km | Neumáticos, aceite, filtros prorrateados |
| Costo hora-técnico | $6.500/h | Sueldo bruto más cargas. **Ajustar al real** |
| Jornada semanal | 42 h | Ley 21.561 vigente en 2026 |
| Tarifa de taxi | $1.000/km | Promedio de referencia para regiones |
| Equipaje de bodega | $18.000 por tramo | Tarifa habitual de cabotaje |
| Factor de corrección de tiempo | 1,10 | Maps cronometra auto liviano sin paradas |
| Tarifas de bus y avión | Referenciales | **Cotizar antes de comprometer** |

Los valores de hotel ($50.000/noche) y viático ($25.000/día) son definidos por jefatura y no
son supuestos.

## 6.3 Lo que el sistema NO sabe

Decirlo en el informe suma, no resta:

1. **Las secuencias de plazas marcadas ESTIMADO** no están contrastadas contra un total
   oficial. Se corrigen con la primera cartola del TAG.
2. **Los peajes urbanos de Santiago** dependen de qué autopista tome el técnico. Se modelan
   por kilómetro recorrido y siempre son evitables: por calle se paga $0.
3. **Las tarifas de bus y avión** son referenciales.
4. **No hay confirmación de disponibilidad** de hoteles, vuelos ni buses.

---

# PARTE 7 · CÓMO USAR EL SISTEMA

## 7.1 Puesta en marcha

1. Abrir la Sheet → **Extensiones → Apps Script**
2. Ejecutar **`configurarAcceso`** una vez (define correo y clave)
3. Autorizar los permisos que pide Google
4. Recargar la hoja. Aparece el menú **⚙ Servicio Técnico**
5. **Crear o restaurar hojas base** → genera `CONFIG`, `DESTINOS` y `PLAN`
6. **Actualizar rutas con Google Maps** → consulta kilómetros y tiempos reales
7. **Recalcular y validar plan** → verifica que no haya errores

## 7.2 Publicar la aplicación web

**Implementar → Nueva implementación → Aplicación web**

- Ejecutar como: **Yo**
- Quién tiene acceso: **Cualquier persona con el enlace**

Así el técnico nunca necesita permisos sobre la planilla. Cada uno puede entrar directo a lo
suyo:

```
<URL>?vista=orden&tecnico=T01
```

## 7.3 Las pestañas de la aplicación

| Pestaña | Para qué sirve |
|---|---|
| **Resumen** | La foto completa: cuánto sale, cuántos equipos, qué alertas hay |
| **Gastos** | En qué se va la plata y cuánto transferirle a cada técnico |
| **Técnicos** | Carga de trabajo y utilización por persona |
| **Calendario** | Quién está ocupado y cuántas horas libres quedan |
| **Transporte** | Camioneta, bus o avión: cuál conviene y por qué |
| **Peajes** | Catálogo MOP y desglose por localidad |
| **Orden de servicio** | La hoja de ruta imprimible de cada técnico |
| **Rutas y flota** | El recorrido completo por cuadrilla |
| **Planificación** | Donde se edita el plan |
| **Guía del equipo** | Manual, glosario y cómo se calcula cada cosa |

> Cada pestaña tiene arriba una tarjeta **"¿Qué es esta pantalla?"** que explica qué se ve,
> cómo leerlo y qué hacer. La pestaña **Guía** tiene el glosario completo de 22 términos.

## 7.4 Verificar que todo funciona

Ejecutar **`ejecutarPruebas`** desde el editor de Apps Script. Comprueba los 33 equipos, las
16 localidades, la regla de paralelización, el peaje contra el MOP y que ningún técnico
quede sin monto de transferencia.

## 7.5 Sincronizar cambios de código

```bash
cd v2/apps-script
clasp push
```

`clasp push` solo actualiza el código: no ejecuta funciones ni modifica las hojas.

Si es la primera vez en este computador:

```bash
npm install -g @google/clasp
clasp login                 # abre el navegador, se inicia sesión con la cuenta de la Sheet
clasp status                # debe listar los 19 archivos de v2/apps-script
clasp push
```

`clasp login` guarda la sesión en `~/.clasprc.json`. Ese archivo **no se versiona** y no debe
compartirse: contiene el token de acceso a la cuenta de Google.

---

# PARTE 7B · LA APLICACIÓN DEL TÉCNICO (APPSHEET)

Es la entrega del **estudio de caso 2**: la plataforma donde cada técnico verifica su ruta,
sus implementos, el hotel y la camioneta. Corre sobre el mismo Google Sheets.

El armado completo, tabla por tabla y fórmula por fórmula, está en
**[`appsheet/README.md`](appsheet/README.md)**. Acá va solo cómo dejarla andando en el celular.

## 7B.1 Generar los datos

```bash
node appsheet/generar.cjs
```

Escribe siete CSV en `appsheet/csv/`. Imprime además la cuadratura contra el PDF (33 equipos,
16 localidades), el itinerario de las cinco cuadrillas y el desglose del dinero. **Si algún
número de la presentación no calza, este comando es la fuente de verdad.**

## 7B.2 Cargar el Sheet y crear la app

1. Drive → nueva hoja de cálculo `Servicio Tecnico en Ruta · App`
2. Por cada CSV: **Archivo → Importar → Subir → Insertar hojas nuevas**. La pestaña debe
   quedar con el mismo nombre del archivo
3. En `TECNICOS` y en `ORDENES`, reemplazar los correos `t01@servicioenruta.cl` por los
   **Gmail reales** de los integrantes. Sin esto el filtro por usuario no se puede demostrar
4. [appsheet.com](https://www.appsheet.com) → **Create → App → Start with existing data** →
   elegir la hoja
5. Seguir `appsheet/README.md` desde la sección 3: tipos de columna, fórmulas, filtro de
   seguridad y vistas

## 7B.3 Instalarla en el celular

**Opción A · aplicación nativa (la que conviene para la presentación)**

1. Instalar **AppSheet** desde Google Play o App Store
2. Abrirla e iniciar sesión **con la misma cuenta de Google** que creó la app
3. La app aparece en la lista. Se abre y queda disponible sin volver a buscarla

**Opción B · sin instalar nada**

En AppSheet, **Share → Copy app link**. Se abre ese enlace en el navegador del celular y se
usa *Añadir a pantalla de inicio*. Queda con ícono propio y pantalla completa, como una app.

> Útil si un compañero no alcanza a instalar nada antes de presentar, o si el teléfono no
> tiene espacio.

## 7B.4 Que la usen los compañeros

En el editor: **Users → Add users**, se agregan los Gmail de los integrantes y se les envía la
invitación. Cada uno entra y, por el filtro de seguridad, ve **solo sus órdenes**.

> **Ojo con la licencia.** El plan gratuito permite construir y usar la app con la cuenta que
> la creó. Compartirla con otros usuarios normalmente requiere plan pago, salvo que la cuenta
> tenga Workspace con AppSheet Core. **Verificarlo el día anterior, no el mismo día.**
>
> Si no da la licencia: **la demostración se hace desde el teléfono del creador** y cumple
> igual. Para mostrar el filtro por usuario basta con cerrar sesión y entrar con otra cuenta.

## 7B.5 Antes de presentar

| Revisar | Cómo |
|---|---|
| La app abre en el celular | Sin wifi de la sala: probar con datos móviles |
| El filtro funciona | Entrar con dos cuentas distintas y comparar lo que ve cada una |
| Las capturas están en la PPT | Los siete marcos punteados de `presentacion/` |
| El respaldo | Exportar una orden a PDF por si falla la conexión |

Si el proyector o la red fallan, se presenta con las capturas de la PPT y la planilla abierta.
**Nunca depender de que haya internet en la sala.**

---

# PARTE 8 · ESTRUCTURA DEL REPOSITORIO

```
CRM/
├── README.md              ← este documento
├── Estudio de caso 1.pdf
├── GUIA_TARIFAS_CAMIONETAS_2026.md
├── apps-script/           ← versión 1, histórica
├── appsheet/              ← CASO 2: la app del técnico
│   ├── README.md              Armado paso a paso en AppSheet
│   ├── generar.cjs            Planifica y escribe los CSV
│   └── csv/                   Las 7 tablas que se importan al Sheet
├── presentacion/
│   ├── generar_ppt.py         Genera la presentación
│   └── Presentacion_Casos_1_y_2.pptx   21 láminas, guion de 13:55
└── v2/
    ├── README.md          ← documentación técnica detallada
    └── apps-script/
        ├── 00_Esquema.gs      Solo datos: 83 parámetros, 12 tablas, validaciones
        ├── 01_Peajes.gs       Catálogo MOP 2026 y cálculo de peaje por tramo
        ├── 02_Setup.gs        Construye las 3 hojas desde el esquema
        ├── 03_Maps.gs         Rutas, comparador autopista vs. rodeo
        ├── 04_Motor.gs        Motor de cálculo puro y testeable
        ├── 05_Datos.gs        Traducción de celdas a objetos
        ├── 06_Api.gs          Sesión y endpoints de la web
        ├── 07_WebApp.gs       doGet, menú, PDF, pruebas
        ├── 08_Editor.gs       Edición del plan desde la web
        ├── 09_ConexionMaps.gs Diagnóstico de Google Maps
        ├── 10_Agenda.gs       Órdenes agendadas
        ├── Index.html         Estructura de la interfaz
        ├── Estilos.html       CSS
        ├── Scripts.html       JavaScript del navegador
        └── Ayuda.html         Capa explicativa y glosario
```

**Regla de oro del proyecto:** si un número, un umbral o una lista aparece escrito en
cualquier archivo que no sea `00_Esquema.gs`, es un error. Todo lo configurable vive en el
esquema.

---

## Aviso académico

Los nombres de técnicos, direcciones de clientes, hoteles, tarifas y dotación son ejemplos
del caso de estudio. No son datos de operación real, reservas confirmadas ni cotizaciones
vigentes. Los montos son presupuestos estimados: no hay transferencias bancarias ni
instalaciones ejecutadas.
