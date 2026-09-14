# Memoria técnica · cómo se decidió cada cosa

**Servicio Técnico en Ruta · Estudios de caso 1 y 2**
Tecnología Aplicada a Sistemas Inteligentes · INACAP Sede Santiago Sur

Este documento responde una sola pregunta, repetida para cada número del proyecto:
**¿de dónde salió y por qué ese y no otro?**

No repite el armado de la app (eso está en [`appsheet/README.md`](appsheet/README.md)) ni el
manual de uso (eso está en el [README principal](README.md)). Acá está el razonamiento.

---

## Índice

- [A · El punto de partida](#a--el-punto-de-partida)
- [B · De dónde sale cada kilómetro](#b--de-dónde-sale-cada-kilómetro)
- [C · Todos los parámetros predefinidos](#c--todos-los-parámetros-predefinidos)
- [D · La lógica del despliegue](#d--la-lógica-del-despliegue)
- [E · El resultado](#e--el-resultado)
- [F · Qué hace la aplicación](#f--qué-hace-la-aplicación)
- [G · La mejora futura](#g--la-mejora-futura)
- [H · Lo que el modelo no sabe](#h--lo-que-el-modelo-no-sabe)

---

# A · EL PUNTO DE PARTIDA

## A.1 La base de operaciones

Todo trayecto empieza y termina en:

> **INACAP Sede Santiago Sur**
> Av. Vicuña Mackenna 3864, Macul, Santiago

**Por qué esa y no el centro de Santiago.** El enunciado no dice dónde está el servicio
técnico. Había que elegir un punto y declararlo, porque de él dependen los 3.954 km del plan.
Se tomó la sede porque es el lugar real desde donde se presenta el trabajo, es verificable en
Maps, y está en el eje sur-oriente, que no favorece artificialmente ni al corredor norte ni al
sur. Poner la base en el centro de Santiago habría acortado todos los trayectos al norte y
alargado los del sur.

**Consecuencia práctica:** el técnico que trabaja en Maipú, Pudahuel o Puente Alto duerme en
su casa. Eso es lo que después justifica pagarle colación y no viático.

## A.2 La ubicación exacta de cada punto de trabajo

**El enunciado entrega comunas, no direcciones.** Dice "Copiapó: instalación de 5 equipos",
no dice en qué calle. Sin una dirección exacta, Google Maps no puede calcular nada: geocodifica
el centroide de la comuna, que para Copiapó puede caer en el desierto.

**La decisión: usar la municipalidad de cada localidad como punto de trabajo.**

Se eligió así por cuatro razones:

1. **Es un punto real y verificable.** Cualquiera puede pegar la dirección en Maps y obtener
   el mismo resultado que nosotros. Un centroide de comuna no es reproducible.
2. **Está en el centro urbano.** Los equipos de telecomunicaciones se instalan en zonas
   pobladas, no en el límite comunal. La municipalidad es la mejor aproximación disponible
   al "centro de gravedad" de las instalaciones de esa comuna.
3. **Es neutral.** No favorece ni perjudica ninguna localidad: se aplica el mismo criterio a
   las 16.
4. **Es defendible.** Cuando pregunten "¿por qué este kilometraje?", la respuesta es una
   dirección concreta, no una estimación.

> **Esto es un supuesto declarado, no un dato del enunciado.** En una operación real se
> reemplaza por la dirección del cliente y los kilómetros se recalculan solos: el sistema lee
> la columna `Direccion` de la hoja `DESTINOS`, no tiene direcciones escritas en el código.

## A.3 Las 16 direcciones y su corredor

| Localidad | Región | Dirección | Corredor | Km desde base | Equipos |
|---|---|---|---|---:|---:|
| Santiago | Metropolitana | Plaza de Armas 444, Santiago Centro | URB | 10 | 3 |
| Maipú | Metropolitana | Av. 5 de Abril 0260, Maipú | URB | 18 | 3 |
| Pudahuel | Metropolitana | Av. San Pablo 8444, Pudahuel | URB | 22 | 3 |
| Lo Barnechea | Metropolitana | Av. Lo Barnechea 1210, Lo Barnechea | URB | 22 | 3 |
| Puente Alto | Metropolitana | Concha y Toro 1820, Puente Alto | URB | 24 | 1 |
| Melipilla | Metropolitana | Serrano 1550, Melipilla | R78 | 68 | 2 |
| San Antonio | Valparaíso | Av. Barros Luco 1881, San Antonio | R78 | 108 | 2 |
| La Calera | Valparaíso | J. J. Pérez 351, La Calera | R5N | 110 | 1 |
| Curicó | Maule | Carmen 360, Curicó | R5S | 195 | 1 |
| Talca | Maule | 1 Sur 835, Talca | R5S | 255 | 3 |
| Coquimbo | Coquimbo | Bilbao 330, Coquimbo | R5N | 470 | 2 |
| San Pedro de la Paz | Biobío | Los Álamos 2093, San Pedro de la Paz | R5S | 505 | 1 |
| Penco | Biobío | Penco | R5S | 520 | 1 |
| Santa Juana | Biobío | Irarrázaval 320, Santa Juana | R5S | 530 | 1 |
| Tomé | Biobío | Tomé | R5S | 545 | 1 |
| Copiapó | Atacama | Chacabuco 546, Copiapó | R5N | 800 | 5 |

**Total: 33 equipos en 16 localidades.** Cuadra con el enunciado.

**El corredor** es lo que permite calcular un tramo intermedio sin volver a la base. Dos
localidades del mismo corredor están sobre la misma carretera, así que Talca → Curicó son
`|255 − 195| = 60 km`, no `255 + 195`. Si cambian de corredor, hay que pasar por Santiago y
los kilómetros se suman. Es la misma regla que usa `respaldoDistancia_()` en `04_Motor.gs`.

---

# B · DE DÓNDE SALE CADA KILÓMETRO

## B.1 Qué se le pide a Google Maps

**Solo kilómetros y tiempo de viaje.** Nada más. Maps no decide rutas, no elige cuadrillas y
no calcula costos: eso lo hace el motor en JavaScript, donde se puede auditar y probar.

| Parámetro | Valor | Fuente | Qué significa |
|---|---|---|---|
| `P_MAPS_ALCANCE` | Km y tiempo | JEFATURA | Lo único que se le pide |
| `P_MAPS_MODO` | `DRIVE` | PDF | El enunciado entrega camionetas |
| `P_MAPS_EVITAR_PEAJES` | `false` | PDF | La ruta principal usa autopista |
| `P_MAPS_COMPARA_SIN_PEAJE` | `true` | JEFATURA | Se pide **también** la ruta sin peaje, para comparar |
| `P_MAPS_PREFERENCIA` | `TRAFFIC_AWARE` | SUPUESTO | Considera tráfico histórico |
| `P_MAPS_HORA_SALIDA` | 08:00 | SUPUESTO | Hora de referencia del cálculo |
| `P_FACTOR_HORAS` | 1,10 | SUPUESTO | Corrección sobre el tiempo de Maps |
| `P_MAPS_CACHE_DIAS` | 30 | SUPUESTO | Vigencia de la caché en `_RUTAS` |
| `P_MAPS_MAX_CONSULTAS` | 120 | SUPUESTO | Tope por ejecución |

## B.2 El factor 1,10 · por qué no se usa el tiempo de Maps tal cual

Google entrega el tiempo de un vehículo que no para. Una cuadrilla sí para: baja a comer,
carga combustible, hace un trámite en el peaje, busca estacionamiento al llegar. **Se agrega
un 10 % al tiempo de Maps** para que la jornada planificada se parezca a la real.

Es un supuesto conservador: si sobra tiempo, el técnico llega antes. Al revés —planificar con
el tiempo optimista de Maps— haría que las jornadas se pasen del tope legal sin avisar.

## B.3 Los dos proveedores de ruta

| Proveedor | Archivo | Requiere clave | Cuándo se usa |
|---|---|---|---|
| Maps nativo de Apps Script | `03_Maps.gs` · `Maps.newDirectionFinder()` | No | Por defecto |
| Routes API v2 | `09_ConexionMaps.gs` · `routes.googleapis.com` | Sí | Cuando se configura una clave |

El nativo no necesita clave ni facturación, que es la razón de que sea el predeterminado: el
sistema funciona para cualquier integrante sin configurar nada en Google Cloud.

Las respuestas se guardan en la hoja **`_RUTAS`** por 30 días. Así una segunda corrida no
vuelve a consultar y se respeta el tope de 120 consultas por ejecución.

## B.4 ⚠ Las dos fuentes de distancia · leer antes de presentar

Hay **dos** caminos por los que se calculan kilómetros en este proyecto, y no son el mismo:

| | Motor en Apps Script | Planificador offline |
|---|---|---|
| Archivo | `v2/apps-script/03_Maps.gs` | `appsheet/generar.cjs` |
| Dónde corre | Dentro de Google, sobre la Sheet | En el computador, con Node |
| Distancia | **Google Maps, real** | Kilometraje de referencia por carretera |
| Tiempo | Maps × 1,10 | 90 km/h en carretera, 35 km/h urbano |

**Los CSV que alimentan AppSheet salen del planificador offline, no de Maps.** Se hizo así
porque `generar.cjs` corre sin credenciales de Google y sin conexión, lo que permite recalcular
el plan completo en un segundo cada vez que cambia un supuesto.

**Qué decir si preguntan:** los kilómetros son referenciales por carretera y el sistema está
construido para reemplazarlos con los de Maps en cuanto se ejecute *Actualizar rutas con Google
Maps* desde la planilla. El motor los sobrescribe en la hoja `DESTINOS` y el plan se recalcula.

**Qué NO decir:** que las cifras de la presentación vienen de Maps. Todavía no. Es una
diferencia chica en los totales, pero afirmarlo sería falso y es exactamente el tipo de cosa
que se cae en una pregunta.

---

# C · TODOS LOS PARÁMETROS PREDEFINIDOS

## C.1 El sistema de trazabilidad

Los 89 parámetros viven en un solo archivo, `v2/apps-script/00_Esquema.gs`, y **cada uno
declara de dónde viene**:

| Etiqueta | Significado | Se puede discutir |
|---|---|---|
| **PDF** | Textual del enunciado | No. Es un dato del problema |
| **JEFATURA** | Decisión nuestra, documentada | Sí, y hay que defenderla |
| **SUPUESTO** | Supuesto declarado | Sí, y hay que declararlo en el informe |

Esa etiqueta es la respuesta a "¿de dónde sacaste ese número?": está escrita al lado del
número, no en la memoria de quien presenta.

## C.2 Datos del enunciado · PDF, no se negocian

| Parámetro | Valor | Texto del PDF |
|---|---:|---|
| `P_TECNICOS` | 10 | "Cuenta con una cantidad de 10 técnicos" |
| `P_CAMIONETAS` | 6 | "Cuenta además con 6 camionetas con sus correspondientes herramientas" |
| `P_T_INSTALACION` | 2 h | "Cada equipo para instalar toma un tiempo 2 hrs" |
| `P_T_CAPACITACION` | 0,5 h | "Cada capacitación toma un tiempo de 30 min" |
| `P_RENDIMIENTO` | 20 km/L | "Tipo de camioneta Peugeot Partner rendimiento 20km/lts" |
| `P_PEAJE_CATEGORIA` | Categoría 1 | Auto y camioneta, según tarifario MOP |

## C.3 Jornada y tiempo

| Parámetro | Valor | Fuente | Justificación |
|---|---:|---|---|
| `P_JORNADA_SEMANAL` | 42 h | SUPUESTO | Jornada legal vigente en Chile tras la reducción gradual |
| `P_COLACION_H` | 5 h/semana | SUPUESTO | 1 hora diaria de colación, no imputable a trabajo |
| `P_DIAS_SEMANA` | 5 | SUPUESTO | Lunes a viernes |
| **Jornada diaria efectiva** | **8,4 h** | Calculado | 42 ÷ 5 |
| `P_HORAS_EXTRA_MAX_DIA` | 2 h | SUPUESTO | Máximo legal de horas extraordinarias diarias |
| **Tope diario absoluto** | **10,4 h** | Calculado | 8,4 + 2. Línea roja: sobre esto no se planifica nunca |
| `P_CONDUCCION_MAX_DIA` | 9 h | SUPUESTO | Tope de seguridad al volante |
| `P_HORAS_EXTRA_MAX_SEMANA` | 10 h | SUPUESTO | Tope semanal |
| `P_FECHA_INICIO` | 2026-09-21 | JEFATURA | Lunes siguiente a Fiestas Patrias (18 y 19 son feriados) |
| `P_OMITIR_FIN_SEMANA` | sí | SUPUESTO | No se agenda sábado ni domingo |

**La hora de colación no se descuenta del trabajo, ya está descontada.** Las 42 h semanales
contractuales incluyen las 5 h de colación; las 8,4 h diarias son tiempo efectivamente
disponible para viajar e instalar.

## C.4 El dinero del técnico

| Parámetro | Valor | Fuente | Justificación |
|---|---:|---|---|
| `P_HOTEL` | $50.000 / noche / persona | JEFATURA | Tarifa única nacional, fijada para no cotizar hotel por hotel |
| `P_HABITACION_INDIVIDUAL` | sí | JEFATURA | Una habitación por técnico, no compartida |
| `P_VIATICO` | $25.000 / día | JEFATURA | Cubre alimentación del que está lejos y no puede volver |
| `P_COLACION_RM` | $5.000 / día | JEFATURA | El que trabaja en Santiago almuerza fuera pero duerme en su casa |
| `P_VIATICO_SOLO_FUERA_RM` | sí | JEFATURA | En la RM se paga colación, no viático |
| `P_VIATICO_SOLO_CON_PERNOCTACION` | sí | JEFATURA | El viático existe para el viaje con noche fuera |
| `P_TECNICOS_RESIDEN_RM` | sí | JEFATURA | Los 10 viven en la Región Metropolitana |
| `P_HOLGURA_IMPREVISTOS` | 10 % | JEFATURA | Es el "y otros" que pide el PDF |
| `P_REDONDEO_TRANSFERENCIA` | $1.000 | JEFATURA | Cifra manejable en efectivo |
| `P_TRANSFIERE_HOTEL` | sí | JEFATURA | El técnico paga el hostal y se le adelanta |
| `P_TRANSFIERE_VIATICO` | sí | JEFATURA | |
| `P_TRANSFIERE_COMBUSTIBLE` | no | JEFATURA | Va con tarjeta corporativa, no en efectivo |
| `P_GASTOS_VEHICULO_AL_CONDUCTOR` | sí | JEFATURA | Peaje y combustible los lleva quien maneja |

**La regla del viático, explicada.** El enunciado pide "transferencia de viáticos para gastos
de estadía, colación, peajes y otros". Nosotros distinguimos dos situaciones:

- **El técnico duerme fuera de su casa** → viático de $25.000, que cubre desayuno, almuerzo y
  cena lejos de casa.
- **El técnico vuelve a dormir a su casa** → colación de $5.000, porque solo almuerza fuera.

Pagar $25.000 a alguien que trabaja en Maipú y vuelve a comer a su casa sería sobrecostear el
plan en $20.000 por técnico y por día sin justificación.

## C.5 El vehículo

| Parámetro | Valor | Fuente | Justificación |
|---|---:|---|---|
| `P_CAPACIDAD_CAMIONETA` | **2 personas** | JEFATURA | La Peugeot Partner es furgón de cabina corta: dos personas con sus bolsos |
| `P_RENDIMIENTO` | 20 km/L | PDF | Textual |
| `P_DIESEL` | $1.381 / L | JEFATURA | Precio de referencia |
| `P_COSTO_KM` | $60 / km | JEFATURA | Desgaste y mantención. Costo de empresa, no se transfiere |
| `P_PEAJE_FUENTE` | PLAZAS | JEFATURA | Se suma plaza por plaza, no un valor global |
| `P_PEAJE_AMBOS_SENTIDOS` | sí | SUPUESTO | Las plazas troncales cobran en cada sentido |
| `P_PEAJE_MEDIO_PAGO` | TAG corporativo | JEFATURA | |

**La capacidad de 2 es la restricción que define todo el plan.** No es un detalle: obliga a
cinco cuadrillas, define cuántas camionetas se usan y determina cuántas tandas de instalación
necesita cada sitio.

## C.6 Horas extra

| Parámetro | Valor | Fuente |
|---|---:|---|
| `P_PERMITE_HORAS_EXTRA` | sí | JEFATURA |
| `P_COSTO_HORA_TECNICO` | $6.500 / h | SUPUESTO |
| `P_RECARGO_HORA_EXTRA` | 1,5 | SUPUESTO · 50 % de recargo, Código del Trabajo |
| **Costo de la hora extra** | **$9.750** | Calculado · 6.500 × 1,5 |
| `P_PREFIERE_EXTRA_SOBRE_HOTEL` | sí | JEFATURA |

---

# D · LA LÓGICA DEL DESPLIEGUE

## D.1 Por qué cuadrillas de dos

**El PDF no fija el tamaño de cuadrilla.** La frase "en grupos de 3 personas" del enunciado se
refiere al grupo de alumnos que realiza el trabajo, no a las cuadrillas de técnicos — el mismo
documento fija aparte "máximo 4 personas" para la entrega. Así que el tamaño es **decisión
nuestra y hay que sustentarla**.

El sustento es la cabina: en una Peugeot Partner viajan **dos personas** con sus bolsos de
herramientas. Mandar una tercera obligaría a una segunda camioneta.

**10 técnicos ÷ 2 por camioneta = 5 cuadrillas.** Se usan 5 de las 6 camionetas y la sexta
queda de reserva para cubrir una avería. Eso responde al enunciado usando los 10 técnicos y
dejando respaldo de flota.

## D.2 ¿Conviene mandar más gente a un sitio?

Los 10 técnicos tienen licencia de conducir, así que se podría mandar cualquier dotación a
cualquier punto: 1, 2, 5 o 10. **Lo que decide es el costo, no una regla.**

Los técnicos instalan **en paralelo, uno por equipo**. Si hay más equipos que gente, se hacen
tandas y el sitio demora lo que demora la última:

```
Tandas       = techo(equipos / técnicos en el sitio)
Horas sitio  = tandas × 2,25 h
```

Con cuadrillas de dos, **seis localidades tienen más equipos que técnicos en sitio** y
podrían hacerse más rápido mandando gente. Se evaluaron las seis:

| Sitio | Equipos | Con 2 téc. | Uno por equipo | Ahorra | Móvil extra | Estipendio extra | **Sobrecosto** | Valor del ahorro |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Maipú | 3 | 4,5 h | 2,25 h | 2,25 h | $2.486 | $15.000 | **$17.486** | $0 |
| Pudahuel | 3 | 4,5 h | 2,25 h | 2,25 h | $3.038 | $15.000 | **$18.038** | $0 |
| Santiago | 3 | 4,5 h | 2,25 h | 2,25 h | $3.981 | $15.000 | **$18.981** | $0 |
| Lo Barnechea | 3 | 4,5 h | 2,25 h | 2,25 h | $7.838 | $10.000 | **$17.838** | $0 |
| Talca | 3 | 4,5 h | 2,25 h | 2,25 h | $57.216 | $10.000 | **$67.216** | $0 |
| **Copiapó** | **5** | **6,75 h** | **2,25 h** | **4,5 h** | **$322.960** | **$750.000** | **$1.072.960** | **$0** |

**Por qué el valor del ahorro es cero.** El esquema declara
`P_VALORA_TIEMPO_TECNICO = 'Solo si genera sobretiempo'`. Ahorrar horas de una jornada que ya
cabe dentro de las 8,4 h ordinarias **no ahorra dinero**: el técnico está contratado igual y
simplemente vuelve antes a la base. Solo valdrían las horas que hoy se pagan como extra.

Ninguna de esas seis jornadas pasa de 8,4 h — van de 5,13 h en Santiago a 8,12 h en Lo
Barnechea. **Las horas ahorradas no valen nada; el sobrecosto es real y se paga.**

**Copiapó es el caso extremo:** mandar 5 técnicos exige 2 camionetas adicionales recorriendo
1.600 km cada una, más 3 técnicos por 4 días con viático y hostal. Más de un millón de pesos
para terminar 4,5 h antes un día en que igual no se pasa del tope de jornada.

**Conclusión: la cuadrilla es de dos.** No porque no se pueda mandar más gente —los 10 tienen
licencia y el sistema lo permite— sino porque el costo lo desaconseja en las seis localidades
donde tendría sentido evaluarlo, y está calculado una por una.

## D.3 Por qué se agrupa por corredor

`P_AGRUPA_POR_CORREDOR = true` y `P_ESTRATEGIA_RUTEO = 'Periferia primero'`.

Cada cuadrilla toma **un corredor completo** en vez de repartirse los destinos por cercanía
individual. La razón es aritmética: dos localidades del mismo corredor están sobre la misma
carretera, así que ir de una a otra cuesta la **diferencia** de kilometraje, no la suma.

Si C1 hiciera Copiapó y después Talca, tendría que volver a Santiago en el medio: 800 + 255 km.
Haciendo Copiapó → Coquimbo → La Calera, los tramos intermedios son 330 y 360 km. **Agrupar
por corredor ahorra los regresos a la base.**

| Cuadrilla | Técnicos | Móvil | Corredor | Localidades | Días |
|---|---|---|---|---|---:|
| C1 | T01 + T02 | V1 | R5N · Norte | Copiapó, Coquimbo, La Calera | 4 |
| C2 | T03 + T04 | V2 | R5S · Maule | Curicó, Talca | 2 |
| C3 | T05 + T06 | V3 | R5S · Biobío | San Pedro, Penco, Tomé, Santa Juana | 3 |
| C4 | T07 + T08 | V4 | URB · RM | Maipú, Pudahuel, Santiago | 3 |
| C5 | T09 + T10 | V5 | URB + R78 | Lo Barnechea, Puente Alto, Melipilla, San Antonio | 2 |
| — | — | **V6** | — | **Reserva de flota** | — |

## D.4 Por qué dos conductores designados que se alternan

Los 10 técnicos tienen licencia. Eso permite **designar dos conductores por cuadrilla y
turnarlos**, en vez de dejar a uno fijo al volante.

No es comodidad. El viaje de Santiago a Copiapó son **8,89 h de conducción**, contra un tope
de seguridad de **9 h diarias** (`P_CONDUCCION_MAX_DIA`). Con un conductor fijo se llega al
límite el primer día. Alternando, cada uno maneja **4,45 h**.

La rotación queda registrada: la columna `Conductor` de cada orden dice a quién le toca ese
día, y `Conduccion_Por_Tecnico` reparte las horas entre los dos.

## D.5 Cómo se arma cada jornada

El planificador (`appsheet/generar.cjs`) recorre el corredor de cada cuadrilla y va llenando
días con esta regla, **en este orden**:

1. **La jornada se llena hasta 8,4 h ordinarias.** Se suma el viaje al sitio más el trabajo en
   el sitio. Si el siguiente destino no cabe, se cierra el día.
2. **Al cerrar el día se evalúa el regreso.** Si volver a la base cabe dentro de las 10,4 h
   —es decir, usando hasta 2 h extra— **se vuelve**.
3. **Si ni con horas extra se llega, se pernocta** y se paga el hostal.
4. **Si el viaje por sí solo no deja espacio para trabajar, se genera un día de solo
   traslado.** Es el caso de Copiapó: 8,89 h de ida no dejan margen para 6,75 h de instalación.

**Por qué esa regla y no otra:** llenar la jornada hasta el tope todos los días comprimiría el
plan, pero a costa de horas extra permanentes y de jornadas de 10,4 h cuatro días seguidos.
La regla elegida usa las horas extra solo para **evitar una noche de hotel**, que es donde
realmente se justifican.

## D.6 Horas extra contra hostal · el cálculo

| Opción | Cálculo | Costo |
|---|---|---:|
| 2 h extra para 2 técnicos | 2 × 2 × $9.750 | **$39.000** |
| 1 noche para 2 técnicos | 2 × $50.000 + 2 × $25.000 de viático del día siguiente | **$150.000** |

**Volver a casa sale casi cuatro veces más barato que dormir fuera.** Por eso
`P_PREFIERE_EXTRA_SOBRE_HOTEL = true`.

Pero el tope es infranqueable: cuando el regreso no cabe en 10,4 h, se pernocta. Eso pasa en
Copiapó y en Biobío, donde el hostal **no es comodidad sino la única opción legal**. En este
plan solo se usan **0,49 h extra en total**, el primer día de C1 llegando a Copiapó: $9.556.

## D.7 Por qué el peaje y el combustible los carga el conductor

Son gastos **del vehículo**, no de la persona. Repartirlos entre los dos técnicos obligaría a
que ambos lleven efectivo para el mismo peaje. Se le cargan a quien maneja ese día
(`P_GASTOS_VEHICULO_AL_CONDUCTOR = true`), y como el conductor rota, a lo largo del viaje se
reparten solos.

**Se cobran una sola vez por día, sobre los kilómetros que la camioneta realmente recorre.**
No ida y vuelta a la base por cada localidad: C3 el día 2 visita Penco, Tomé y Santa Juana en
un mismo recorrido de 55 km entre sitios. Cobrarlo por sitio triplicaría el combustible.

## D.8 De qué se compone la transferencia

```
Transferencia = (viático o colación + hotel + peaje del día + combustible del día)
                × 1,10                        ← holgura de imprevistos
                redondeado hacia arriba al millar
```

La holgura del 10 % es el **"y otros"** que menciona el enunciado: estacionamientos, un
repuesto menor, una noche que se alarga. El redondeo al millar deja una cifra manejable en
efectivo.

---

# E · EL RESULTADO

## E.1 El itinerario completo

```
C1 · Norte · V1 · Álvaro Fuentes + Camila Rojas
  D1  lun 21   8,89 h  +0,49 h extra  conduce T01  traslado a Copiapó   [pernocta]
  D2  mar 22   6,75 h                 conduce T02  Copiapó              [pernocta]
  D3  mié 23   5,92 h                 conduce T01  Coquimbo             [pernocta]
  D4  jue 24   7,47 h                 conduce T02  La Calera + regreso

C2 · Maule · V2 · Diego Muñoz + Javiera Soto
  D1  lun 21   6,58 h                 conduce T03  Curicó
  D2  mar 22   8,00 h                 conduce T04  Talca

C3 · Biobío · V3 · Matías Contreras + Fernanda Araya
  D1  lun 21   7,86 h                 conduce T05  San Pedro de la Paz  [pernocta]
  D2  mar 22   8,32 h                 conduce T06  Penco + Tomé + Santa Juana [pernocta]
  D3  mié 23   5,89 h                 conduce T05  regreso a base

C4 · RM · V4 · Cristian Vega + Paulina Herrera
  D1  lun 21   5,53 h                 conduce T07  Maipú
  D2  mar 22   5,24 h                 conduce T08  Pudahuel
  D3  mié 23   5,13 h                 conduce T07  Santiago

C5 · RM sur y Ruta 78 · V5 · Rodrigo Cáceres + Bárbara Neira
  D1  lun 21   8,12 h                 conduce T09  Lo Barnechea + Puente Alto
  D2  mar 22   7,87 h                 conduce T10  Melipilla + San Antonio
```

**4 días hábiles. 33 equipos. 3.954 km.**

## E.2 Cuánto dinero requiere la planificación

| Concepto | Cálculo | Total |
|---|---|---:|
| Viático fuera de la RM | 14 técnico-días × $25.000 | $350.000 |
| Colación en la RM | 14 técnico-días × $5.000 | $70.000 |
| Alojamiento | 10 técnico-noches × $50.000 | $500.000 |
| Peajes | Recorrido real, categoría 1 | $148.000 |
| Combustible | 3.954 km ÷ 20 km/L × $1.381 | $273.026 |
| **Subtotal** | | **$1.341.026** |
| Holgura de imprevistos | 10 % y redondeo al millar | +$147.974 |
| **TOTAL A TRANSFERIR** | | **$1.489.000** |

**Costos de empresa que NO se transfieren al técnico:**

| Concepto | Cálculo | Total |
|---|---|---:|
| Horas extra | 0,49 h × 2 técnicos × $9.750 | $9.556 |
| Desgaste y mantención | 3.954 km × $60 | $237.240 |

## E.3 Qué monto requiere cada técnico

| Técnico | Días | Noches | Conduce | Viático/colación | Hotel | Peaje | Combustible | **Transferencia** |
|---|---:|---:|---|---:|---:|---:|---:|---:|
| T01 Álvaro Fuentes | 4 | 3 | D1, D3 | $100.000 | $150.000 | $32.900 | $78.027 | **$399.000** |
| T02 Camila Rojas | 4 | 3 | D2, D4 | $100.000 | $150.000 | $18.100 | $32.454 | **$333.000** |
| T05 Matías Contreras | 3 | 2 | D1, D3 | $75.000 | $100.000 | $41.200 | $71.467 | **$318.000** |
| T06 Fernanda Araya | 3 | 2 | D2 | $75.000 | $100.000 | — | $3.798 | **$198.000** |
| T04 Javiera Soto | 2 | 0 | D2 | $10.000 | — | $22.000 | $35.216 | **$75.000** |
| T03 Diego Muñoz | 2 | 0 | D1 | $10.000 | — | $15.200 | $26.930 | **$58.000** |
| T10 Bárbara Neira | 2 | 0 | D2 | $10.000 | — | $11.200 | $14.915 | **$41.000** |
| T07 Cristian Vega | 3 | 0 | D1, D3 | $15.000 | — | $2.600 | $3.867 | **$25.000** |
| T08 Paulina Herrera | 3 | 0 | D2 | $15.000 | — | — | $3.038 | **$21.000** |
| T09 Rodrigo Cáceres | 2 | 0 | D1 | $10.000 | — | $4.800 | $3.314 | **$21.000** |
| | | | | | | | | **$1.489.000** |

**El rango va de $21.000 a $399.000**, y la diferencia la explican tres cosas, en este orden:

1. **Las noches fuera.** T01 duerme 3 noches: $150.000 solo en hostal.
2. **Si trabajó fuera de la RM.** T01 recibe viático de $25.000 por día; T07 recibe colación
   de $5.000, porque trabaja en Santiago y vuelve a su casa.
3. **Si le tocó conducir.** El conductor lleva el peaje y el combustible de ese día.

T07 y T08 hacen tres días de trabajo y reciben poco porque instalan en Maipú, Pudahuel y
Santiago: almuerzan fuera y duermen en su casa. Es correcto que reciban menos.

---

# F · QUÉ HACE LA APLICACIÓN

Es la entrega del **caso 2**. Corre en **AppSheet** sobre el mismo Google Sheets.

## F.1 Por qué AppSheet y no una planilla compartida

El enunciado pide que **cada técnico** verifique **lo suyo**. En una planilla compartida todos
ven todo y cualquiera puede editar cualquier fila. AppSheet aplica un filtro por usuario:

```
OR([Email] = USEREMAIL(), USEREMAIL() = "<coordinación>")
```

El técnico entra con su correo y ve **solo sus órdenes**. La coordinación ve las 36.
Además corre en el celular, en terreno, sin instalación ni VPN.

**La planilla sigue siendo la base de datos y el motor sigue calculando.** AppSheet no
reemplaza nada: es la capa de consulta y registro.

## F.2 Las siete tablas

| Tabla | Filas | Qué contiene |
|---|---:|---|
| `ORDENES` | 36 | Una fila = un técnico, en una localidad, un día |
| `CHECKLIST` | 480 | Los implementos de cada orden, con casilla para marcar |
| `IMPLEMENTOS` | 17 | Catálogo maestro, clasificado por BOLSO / VEHÍCULO / PERSONAL |
| `TECNICOS` | 10 | Nómina. El correo es lo que filtra la app |
| `FLOTA` | 6 | Las camionetas, con capacidad y estado |
| `DESTINOS` | 16 | Las localidades, para el formulario de orden nueva |
| `GASTOS` | — | Rendición con foto de boleta. La llena el técnico en terreno |

**Por qué `ORDENES` es una tabla plana y no la hoja `PLAN`.** AppSheet necesita una fila por
persona y por evento para poder filtrar por usuario. La hoja `PLAN` tiene una fila por *tramo*
con casillas por técnico: sirve para calcular, no para consultar. `generar.cjs` traduce de una
a otra.

## F.3 Lo que ve el técnico, pantalla por pantalla

| Pantalla | Qué resuelve del enunciado |
|---|---|
| **Mi ruta** | *"su ruta"* · sus órdenes agrupadas por fecha, con localidad y equipos |
| **La orden** | Dirección con botón de navegación, horas estimadas y desglose del monto |
| **Implementos** | *"sus implementos y materiales"* · checklist de 17 ítems que marca antes de salir |
| **Hotel** | *"el hotel donde podría hospedar"* · zona, dirección en el mapa, noches y monto |
| **Camioneta** | *"la camioneta a utilizar"* · ficha del vehículo y quién conduce ese día |
| **Calendario** | Sus días asignados, incluidos los de traslado |
| **Gastos** | Registra el gasto, fotografía la boleta, ve su saldo |
| **Nueva orden** | La coordinación agenda trabajo nuevo y el sistema asigna solo |

## F.4 Las fórmulas que recalculan solas

No son datos pegados: la app recalcula cuando algo cambia.

```
Tandas               CEILING([Equipos] / [Tecnicos_En_Sitio])
Horas_Trabajo        [Tandas] * 2.25
Km_Ida               LOOKUP([Destino], "DESTINOS", "Localidad", "Km_Ida")
Direccion            LOOKUP([Destino], "DESTINOS", "Localidad", "Direccion")
Peaje                IF([Conductor]="Si", LOOKUP(...,"Peaje_Ida") * 2, 0)
Combustible          IF([Conductor]="Si", ROUND([Km_Dia] / 20 * 1381), 0)
Hotel_Monto          [Noches] * 50000
Total_Transferencia  [Viatico] + [Hotel_Monto] + [Peaje] + [Combustible] + [Gastos_Extra]

Gastos_Rendidos      SUM(SELECT(GASTOS[Monto], [ID_Orden] = [_THISROW].[ID]))
Saldo                [Total_Transferencia] - [Gastos_Rendidos]
```

`Saldo` cierra el ciclo del dinero: no solo cuánto se le entregó al técnico, sino en qué lo
gastó y cuánto debe devolver.

## F.5 El agendamiento automático

Las 36 órdenes del caso 1 están marcadas `Origen = CASO_1` y **no se pueden borrar**
(`Are deletes allowed? → [Origen] = "AGENDADA"`). Encima se agenda trabajo nuevo.

La asignación toma al técnico activo con menos carga:

```
INDEX(ORDERBY(FILTER("TECNICOS", [Activo]="Si"),
      COUNT(SELECT(ORDENES[ID], [Tecnico]=[Codigo]))), 1)
```

Con el plan actual, **C2 y C5 terminan el día 22** y tienen libres el 23 y el 24. Ahí cae el
trabajo nuevo. Es capacidad instalada disponible, no gente ociosa.

> Para asignación real —por corredor, jornada legal y costo— el motor ya la hace:
> `asistenteOrden()` en `06_Api.gs:595`. Un bot de AppSheet puede invocarla.

---

# G · LA MEJORA FUTURA

El enunciado pide **"tomar decisión de una futura mejora (personal, camionetas u otro)
justificando sus decisiones"**.

## G.1 No son camionetas

Ya sobra una: el plan usa 5 de las 6 y V6 queda de reserva. Comprar una séptima
(`P_COSTO_CAMIONETA_NUEVA` = $16.500.000 más $2.800.000 de herramientas) no acortaría nada,
porque no hay una sexta cuadrilla que la ocupe.

## G.2 Es personal, y está cuantificado

El plan dura 4 días **porque el corredor norte dura 4 días**. C2 y C5 terminan en 2. El cuello
de botella es Copiapó: 800 km que consumen un día completo solo en llegar.

Con dos técnicos más se abre una sexta cuadrilla, se ocupa V6 y el norte se parte en dos:
una cuadrilla a Copiapó y otra a Coquimbo + La Calera.

| | Plan actual | Con 6 cuadrillas | Diferencia |
|---|---:|---:|---:|
| Duración | 4 días | **3 días** | **−1 día** |
| Técnico-días | 28 | 30 | +2 |
| Técnico-noches | 10 | 10 | 0 |
| Viático + hotel | $1.200.000 | $1.250.000 | +$50.000 |
| Horas extra | $9.556 | $19.110 | +$9.554 |
| | | | **≈ +$60.000** |

**Comprimir el plan un 25 % cuesta $59.555 por despliegue.**

## G.3 La pregunta honesta

Ese `+$59.555` es el costo **variable** de un despliegue. El costo real de contratar es el
sueldo permanente: `P_COSTO_TECNICO_MES` = $1.400.000, dos técnicos = **$2.800.000 al mes**.

La decisión no la define el ahorro por viaje, sino **la frecuencia de los trabajos**:

- **Un despliegue aislado** → no se contrata. Se paga $2.800.000 mensuales para ahorrar un día.
- **Trabajo sostenido, varios despliegues al mes** → sí se contrata, porque los dos técnicos
  se ocupan de forma permanente y el día ahorrado se multiplica.

**Nuestra recomendación:** no contratar todavía. Primero **medir la demanda real durante tres
meses** usando la aplicación — que ya registra cada orden, su duración y su costo. Si el
promedio supera los dos despliegues mensuales, la contratación se justifica con datos propios
y no con una proyección.

Eso es lo que hace que la gestión tecnológica del caso 2 no sea solo una app de consulta: es
el instrumento que permitirá tomar la decisión del caso 1 con evidencia.

---

# H · LO QUE EL MODELO NO SABE

Decirlo antes de que lo pregunten.

| Límite | Detalle |
|---|---|
| **Los kilómetros son referenciales** | Ver [B.4](#b4--las-dos-fuentes-de-distancia--leer-antes-de-presentar). Vienen del planificador offline, no de Maps. El sistema está hecho para reemplazarlos. |
| **Las direcciones son municipalidades** | No son las direcciones de los clientes, que el enunciado no entrega. |
| **Los hoteles no están reservados** | `Hotel_Zona` indica la zona de pernoctación. La tarifa de $50.000 es una decisión de jefatura, no una cotización. |
| **Los pórticos TAG de la RM están estimados** | Marcados `PENDIENTE MOP` en `T_PLAZAS`. Las plazas troncales sí tienen tarifa de referencia 2026. |
| **El empaquetado de jornada es conservador** | Se llena hasta 8,4 h y solo se usan horas extra para volver a casa. `mejorProgramacion_()` en `04_Motor.gs` puede comprimir más aceptando sobretiempo. |
| **Las jornadas de C3 tienen poco margen** | 8,32 h el día 2. Con tiempos reales de Maps y tráfico, podría pasar a horas extra. |
| **El tráfico urbano está aproximado** | 35 km/h dentro de Santiago, 90 km/h en carretera. Maps con `TRAFFIC_AWARE` lo hace bien; el planificador offline no. |
| **Los nombres son del caso de estudio** | Técnicos, patentes y clientes son ejemplos. No hay datos de operación real. |

---

## Reproducir todos los números de este documento

```bash
node appsheet/generar.cjs
```

Imprime la cuadratura contra el PDF, el itinerario de las cinco cuadrillas, el desglose del
dinero, la carga por técnico y el análisis de la mejora futura. **Si algo de la presentación
no calza con la salida de este comando, manda el comando.**
