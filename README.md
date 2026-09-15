# Servicio técnico en ruta

Software de planificación, ejecución y rendición para un servicio técnico que instala equipos
de telecomunicaciones a lo largo de Chile. Tres interfaces con acceso propio —supervisor,
coordinador y técnico— sobre un mismo motor de cálculo.

El caso: **33 equipos en 16 comunas**, desde Copiapó hasta Santa Juana, con **10 técnicos** y
**6 camionetas Peugeot Partner**. Cada instalación toma 2 h y cada capacitación 30 min, que
bajan a 15 min si al cliente se le envía el video antes. Hay que calcular traslados, peajes,
alojamiento y viáticos, y terminar sabiendo **cuánto dinero transferirle a cada técnico**.

## Cómo se abre

Doble clic en `demo/index.html`. No necesita servidor, ni instalación, ni internet.

Si tu navegador bloquea el almacenamiento local en archivos (algunos lo hacen), la demo
avisa y sigue funcionando: lo único que se pierde es el estado al recargar. Para evitarlo,
sírvela por HTTP desde la carpeta `demo/`:

```bash
python -m http.server 8777
# luego abre http://localhost:8777/index.html
```

### Accesos

Los tres vienen autocompletados: eliges el rol y aprietas **Ingresar**.

| Vista | Correo | Contraseña |
|---|---|---|
| Supervisor | `supervisor@serviciotecnico.cl` | `123` |
| Coordinador | `coordinador@serviciotecnico.cl` | `123` |
| Técnico | `alvaro.fuentes@serviciotecnico.cl` | `123` |

También entra el correo de cualquiera de los 10 técnicos (`nombre.apellido@serviciotecnico.cl`).

> Esto **no es un sistema de autenticación**. Es un selector de rol con las credenciales
> impresas en pantalla, para que la demostración fluya. No protege ningún dato.

El botón **Reiniciar demo**, en la barra superior, devuelve todo al plan inicial.

## Qué muestra el plan inicial

| Indicador | Valor |
|---|---:|
| Equipos previstos | 33 |
| Comunas / capacitaciones | 16 / 16 |
| Jornadas / órdenes de trabajo | 15 / 30 |
| Filas de checklist | 510 |
| Kilómetros | 3.769 |
| Combustible | $260.222 |
| Peajes | $118.325 |
| Viáticos (22 técnico-días) | $550.000 |
| Colaciones (8 técnico-días) | $40.000 |
| Hotel (14 noches persona) | $700.000 |
| Reserva de emergencia 10% | $171.453 |
| **Nómina a transferir** | **$1.840.000** |
| Desgaste de vehículos | $226.116 |
| Horas extra | $79.035 |
| **Costo presupuestado total** | **$2.145.151** |

Estos montos **no están escritos en el código**: los calcula el motor y cambian en cuanto se
crea una orden, se envía una capacitación o se edita un parámetro.

---

# Vista supervisor

Escritorio. Seis pestañas.

## Pestaña Resumen

Nueve indicadores arriba: costo presupuestado, a transferir, transferido, rendido, brecha por
rendir, equipos instalados sobre 33, avance, horas extra y alertas críticas.

**Cómo se compone el costo** — barras con combustible, peajes, viáticos, colaciones, hotel,
reserva, horas extra y desgaste. El desgaste aparece porque es costo de empresa, pero no se
le transfiere a nadie.

**Estado de la operación** — jornadas, órdenes, checklist completos, órdenes iniciadas y
cerradas, capacitaciones, kilómetros, noches de hotel, horas planificadas y horas reales.
Las horas reales se llenan solas a medida que los técnicos marcan hitos en el teléfono.

**Alertas** — ordenadas por gravedad. Rojo: se pasó un tope. Ámbar: algo que revisar. Gris:
avisos. El motor **no descarta solo** una jornada que se pasa del tope; la deja planificada y
la alerta, para que la decisión sea de una persona.

## Pestaña Finanzas

**Costo por comuna** — el costo completo del corredor se prorratea entre sus comunas según
equipos, incluidos los traslados que no instalan nada. Es un reparto contable declarado, no un
costo geográfico exacto, y la pantalla lo dice.

**Detalle por jornada** — una fila por jornada: recorrido, equipo, km, horas, combustible,
peaje, estipendio (viático o colación), hotel y horas extra. Con totales al pie. El número
rojo junto al identificador es la cantidad de alertas de esa jornada.

## Pestaña Desempeño

Una fila por técnico: jornadas, horas planificadas, horas reales, desviación, checklist
completos, órdenes cerradas, equipos instalados y cuántos hitos se marcaron dentro del sitio.

Debajo, **carga horaria comparada**: barras por técnico, en ámbar las que generan horas extra.
Sirve para ver de un vistazo que la carga está desbalanceada — Álvaro Fuentes hace 5 jornadas
y Rodrigo Cáceres 2.

Las horas reales salen de los hitos que marca el propio técnico. Una hora capturada por
teléfono **no es certificación del servidor**: es lo que declaró el técnico.

## Pestaña Nómina

La tabla que responde la pregunta del caso: cuánto se le transfiere a cada técnico y por qué.
Columnas: viático, colación, hotel, combustible, peaje, base, reserva, total a transferir y
rendido.

- Solo el **conductor** de cada jornada recibe combustible y peajes. Por eso Paulina Herrera
  (T08) y Bárbara Neira (T10), que no tienen licencia, reciben bastante menos.
- El importe individual es **base × 1,10, redondeado hacia arriba al millar**.
- **Marcar pagado** simula la transferencia y mueve el indicador «Transferido» del resumen.
  **Marcar todo** lo hace con los diez de una vez.

Al pie, el cierre del presupuesto: nómina + desgaste + horas extra = costo total.

## Pestaña Gastos

Cola de comprobantes que suben los técnicos, con la foto adjunta. **Aprobar** suma el monto al
rendido del técnico y cierra la brecha del resumen. **Rechazar** lo deja registrado sin sumar.
Los gastos marcados como emergencia se pagan con la reserva del 10% y salen etiquetados.

Al principio está vacía: se llena cuando un técnico sube una boleta desde el teléfono.

## Pestaña Parámetros

Diez parámetros editables: precio del diésel, rendimiento, desgaste por km, viático, colación,
hotel, valor hora técnico, reserva, tiempo de instalación y de capacitación.

Cambiar cualquiera **recalcula el plan completo al instante**. Es la demostración de que nada
está cableado. Sube el diésel al doble y mira moverse el costo total sin que se toquen los
peajes ni los viáticos.

Abajo, los **valores derivados** que se recalculan solos: jornada efectiva, jornada diaria,
tope diario con horas extra, capacitación reducida y velocidades por corredor.

**Volver a los valores de la semilla** deshace los cambios.

## Imprimir informe

El botón de la barra abre el diálogo de impresión con una hoja de estilos propia: sin barra,
sin pestañas, sin botones. Sirve como anexo entregable.

---

# Vista coordinador

Escritorio. Seis pestañas.

## Pestaña Órdenes

Seis indicadores y la tabla completa de las 30 órdenes: fecha, jornada, recorrido, técnico,
si conduce o acompaña, avance del checklist, estado, hora de inicio, hora de fin y equipos
instalados.

**Exportar nómina de transferencias (CSV)** descarga un archivo con técnico, RUT de
demostración, correo, monto, reserva y detalle, listo para subir al banco. Los RUT son
ficticios con dígito verificador válido; no corresponden a ninguna persona.

Abajo, las alertas del plan.

## Pestaña Nueva orden

El formulario del caso:

| Campo | Qué es |
|---|---|
| Empresa | Cliente que contrata |
| Región | Desplegable de 6 regiones |
| Comuna | Desplegable dependiente de la región |
| Calle | Texto libre |
| Número | Texto libre |
| Nombre del cliente | Contacto en terreno |
| Correo del cliente | Para enviarle después la capacitación |
| Equipos a instalar | Cuántos |
| Fecha | Propone el próximo día hábil con holgura |
| Técnicos a enviar | 1, 2 o hasta 3 |
| Km desde la base | Se rellena solo |
| Peaje por trayecto | Se rellena solo |

Si la comuna ya está en la tabla de destinos, los kilómetros y el peaje salen de la consulta
real a Google Maps y del catálogo de plazas MOP que trae la semilla. Si es una comuna nueva,
se propone la referencia de la región y la nota bajo el formulario lo advierte para que la
corrijas.

**El flujo es en dos pasos.**

**Simular** no escribe nada: calcula sobre una copia del estado y muestra recorrido, equipo,
conductor, camioneta, kilómetros, horas de viaje, de instalación y de capacitación, horas
totales, noches de hotel, combustible, peajes, estipendio, hotel y costo de la jornada. Si hay
advertencias, las lista. **Si alguna es crítica, el botón Confirmar queda deshabilitado.**

**Autoasignar equipo** propone la mejor cuadrilla disponible y **explica por qué la eligió**:
quién conduce y por qué, quién acompaña y qué camioneta toca.

**Confirmar y crear órdenes** recién entonces crea la jornada y una orden por técnico, cada una
con sus 17 ítems de checklist sin marcar.

Abajo aparecen los trabajos ingresados en la sesión.

## Pestaña Asignación

A la izquierda, las jornadas. Eliges una y a la derecha se arma su equipo.

**Los 10 técnicos son un pool**, no cuadrillas fijas. Puedes mandar uno solo, dos o hasta tres
por camioneta. Cada ficha muestra si está libre ese día, cuántas horas acumula y si no tiene
licencia. Al hacer clic se suma o se saca del equipo.

**Quién conduce** — solo aparecen los del equipo que tienen licencia. El conductor es quien
recibe combustible y peajes.

**Camioneta** — las seis, con su estado. Las que están en taller no se pueden elegir.

**Guardar equipo** queda deshabilitado mientras haya un problema, y el problema se explica:
equipo vacío, más de tres personas, sin conductor, conductor sin licencia, conductor fuera del
equipo o falta la camioneta.

Al guardar, **las órdenes siguen al equipo**: se borran las de quien salió y se crean las de
quien entró, con checklist limpio.

**Autoasignar** rehace el equipo de esa jornada con el mismo criterio y explica su elección.

Si mandas **un solo técnico** donde iban dos, las horas de instalación se duplican, porque la
instalación es paralelizable. Con 5 equipos eso son 10 h y revienta el tope diario de 10 h 24
min. El motor lo deja hacer y lo alerta.

## Pestaña Calendario

Dos semanas laborales en columnas. Cada jornada es una tarjeta con identificador, camioneta,
recorrido, equipo, horas y noches. Las que tienen alertas van con el borde rojo.

**Arrastra una tarjeta a otro día** para reprogramarla. Al soltarla se revalidan los topes y se
recalcula el plan. Nunca se agenda sábado ni domingo.

## Pestaña Flota

Las seis camionetas: patente, modelo, kilómetros, próxima mantención —con aviso en ámbar si
faltan menos de 1.000 km—, revisión técnica y estado.

Los tres botones cambian el estado: **Disponible**, **Reserva**, **Taller**.

Al marcar una en taller aparece **Jornadas afectadas por el taller**, con las que quedaron sin
vehículo. No se borran ni se reasignan solas: quedan visibles y alertadas para que la decisión
sea explícita. Es la evidencia directa de cuánta holgura hay en la flota — hoy, una sola
camioneta de reserva.

## Pestaña Capacitación

A la izquierda se redacta: destino, correo del cliente, asunto y mensaje. A la derecha, la
**vista previa** del correo tal como le llega al cliente, con el enlace de capacitación, y se
actualiza mientras escribes.

**Enviar capacitación** deja el correo en la bandeja de Enviados y marca ese destino como
capacitación digital enviada. **La sesión presencial baja de 30 a 15 minutos y el plan se
recalcula al instante.**

El panel **Efecto en el plan** dice exactamente cuánto se gana con las que faltan. Enviando
las 16: **8 h menos de trabajo presencial y $26.612 menos de costo**.

Conviene entender por qué esas dos cifras no son proporcionales, porque es la pregunta que
te pueden hacer: el ahorro en dinero sale **solo de las horas extra que se dejan de pagar**.
Viáticos, hotel, combustible y peajes no dependen de cuánto dure la capacitación. Por eso
enviar un link suelto puede no mover el costo ni un peso —si esa jornada no tenía sobretiempo—
mientras que el tiempo del técnico sí se libera siempre.

---

# Vista técnico

Teléfono. Marco de celular centrado, completamente usable con el mouse. Arriba a la derecha,
un desplegable permite entrar como cualquiera de los 10 técnicos sin volver al login.

Cuatro pantallas en el menú inferior.

## Mis órdenes

Las órdenes asignadas a ese técnico, con fecha, estado, si conduce y el avance del checklist.
Al tocar una se abre.

## Orden

**Esta pantalla está bloqueada hasta completar el checklist.** La orden se ve difuminada detrás
de un candado que dice cuántos implementos faltan. Debajo, los 17 ítems en tres grupos:

- **En el bolso (8)** — multímetro, crimpeadora y tester de red, kit de fibra óptica, taladro,
  destornilladores, notebook, equipo de reemplazo, cinta y canaletas.
- **En la camioneta (4)** — escalera, equipos del día, extensión y señalética, documentos y TAG.
- **Sobre la persona (5)** — EPP, arnés, botiquín, celular cargado, tarjeta corporativa.

Cada marca queda con su hora. Al completar los 17 se abre la orden entera:

- Cliente, dirección, contacto, equipos y si la capacitación digital ya se envió.
- Resumen de la jornada: kilómetros, horas de viaje, instalación, capacitación, total y
  pernoctación.
- **Abrir ruta en Google Maps** — arma el enlace con las **coordenadas** de toda la jornada
  encadenadas como waypoints y lo abre en otra pestaña. Se usan coordenadas y no texto para que
  Maps no geocodifique y no pueda equivocarse de dirección.
- **Llamar al cliente** — enlace `tel:`.
- **Iniciar trabajo** — registra la hora y la ubicación.
- Al cerrar: equipos instalados, observaciones, **firma del cliente** dibujada con el mouse y
  **foto de la instalación**. **Finalizar trabajo** registra la hora de término.

Todo esto viaja al store y aparece de inmediato en las métricas del supervisor.

> Para la presentación conviene abrir una orden con equipos. La primera de Álvaro Fuentes
> (`O0001`, Base → Coquimbo) es un día de puro traslado: no tiene instalación ni capacitación.
> La jornada de Copiapó, con 5 equipos, se ve mucho mejor.

## Mi plata

Lo que responde la pregunta del técnico: cuánto le transfieren y de dónde sale.

Monto total arriba, luego el desglose —viáticos, colaciones, hotel, combustible, peajes y
reserva—, después cuánto lleva rendido y aprobado, cuánto está por revisar y cuánto le queda.

Abajo, destacada en ámbar, la **reserva de emergencia**: el 10% que va incluido en la
transferencia y solo se puede usar en una emergencia —una pana, un peaje que no estaba, un
imprevisto en ruta—. A quien no conduce se le explica por qué no recibe combustible ni peajes.

## Gastos

Subir comprobante: orden, tipo (viático, colación, peaje, combustible, hotel, otro), monto,
casilla de emergencia y foto de la boleta. La foto se lee como imagen y queda de miniatura.

Cada comprobante entra como **Pendiente** y va a la cola del supervisor. Abajo se ven todos los
propios con su estado.

---

# Cómo está hecho

```
demo/
  index.html            login y contenedor de las tres vistas
  css/estilos.css       sistema visual
  js/00_datos.js        semilla: destinos, técnicos, flota, implementos, jornadas, parámetros
  js/01_motor.js        cálculo puro, sin DOM
  js/02_estado.js       store, almacenamiento y notificación a las vistas
  js/03_supervisor.js
  js/04_coordinador.js
  js/05_tecnico.js
  js/06_app.js          login, enrutado y arranque
  pruebas.cjs           cuadraturas del motor
```

**Un solo store, tres vistas encima.** Por eso lo que hace el técnico aparece en el supervisor:
no son tres páginas sueltas.

**Scripts clásicos, no módulos ES.** Sobre `file://` el navegador bloquea los módulos y `fetch`,
pero sí permite `<script src>` hacia un archivo hermano. El orden de carga define los globales,
igual que los archivos `.gs` del proyecto original.

**Sin librerías ni CDN.** En `file://` y sin internet no carga nada externo, así que los
gráficos son HTML y CSS, y la tipografía es Bahnschrift, que viene con Windows.

**Flujo en una dirección:** acción → `despachar()` → `recalcularPlan()` → guardar → redibujar.
Ninguna vista escribe en el estado ni llama al motor por su cuenta. El motor no toca el DOM ni
el almacenamiento, y por eso se puede probar con `node`.

## Las reglas que aplica el motor

```
horasViaje   = km / velocidad[corredor] × 1,1     urbano 36 · Ruta 78 69 · Ruta 5 80 km/h
horasInstal  = equipos × 2 / técnicos en sitio     (paralelizable)
horasCapac   = sesiones × (0,5 h → 0,25 h si el link ya se envió)
combustible  = km / 20 × $1.381
desgaste     = km × $60                            costo de empresa, no se transfiere
estipendio   = $25.000 si sale de la RM · $5.000 si la jornada es íntegra RM
hotel        = noches × $50.000 por persona
horasExtra   = max(0, horas − 7,4) × $6.500 × 1,5  tope 2 h/día y 10 h/semana
transferencia = base × 1,10, redondeo hacia arriba al millar
```

Además: solo el conductor recibe combustible y peajes; nadie sin licencia conduce; máximo 3
por camioneta; nunca sábado ni domingo; una ida de más de 4 h obliga a pernoctar; y una jornada
sobre el tope se alerta, no se descarta sola.

## Pruebas

```bash
node demo/pruebas.cjs
node demo/pruebas-ui.cjs
```

38 comprobaciones de **reglas y cuadraturas**, no de montos fijos: que la suma de las
transferencias individuales sea la nómina, que el costo total cierre, que nadie sin licencia
conduzca, que duplicar el diésel duplique el combustible sin tocar peajes ni viáticos, que
enviar el link reduzca la capacitación exactamente a la mitad, y que el enlace de Maps salga
con coordenadas y waypoints.

Los montos concretos cambian si se editan los tramos o los parámetros, y eso es correcto.

Además hay 40 escenarios de regresión para calendario, secuencia de viaje, recursos,
formularios, ejecución, pagos y catálogos. Las reglas y límites se detallan en
[Validaciones operativas](docs/VALIDACIONES_OPERATIVAS.md).

El supervisor carga una vez 14 rendiciones sintéticas y anticipos de ejemplo. La interfaz
incluye las 16 regiones y 346 comunas, con Ñuble separado. Restablecer el plan repone ese
escenario inicial. Los datos guardados por el usuario no se reemplazan al abrir la página.

## Datos

Los kilómetros y peajes vienen de la caché de rutas del libro original —consultas reales a
Google Maps— y del catálogo de plazas MOP 2026 categoría 1. Las coordenadas son aproximadas al
centro de la dirección municipal y su único uso es abrir Maps en el punto correcto.

Las rutas intercomunales de demostración (Copiapó → Coquimbo, Melipilla → San Antonio, el
circuito de Concepción) son **supuestos**, no consultas Maps ni cartolas TAG.

Los 10 técnicos son nombres de demostración y no corresponden a personas reales.

## Lo que este software no hace

Entrega los datos para decidir la mejora futura —costo por corredor, carga por técnico,
jornadas que se quedan sin vehículo cuando una camioneta entra al taller— pero **la
justificación escrita de esa decisión no la genera**. Esa es la parte que se argumenta en la
presentación.

El diseño completo, con las decisiones tomadas y por qué, está en
`docs/superpowers/specs/2026-09-15-demo-local-crm-design.md`.
