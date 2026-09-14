# App del técnico en AppSheet · Estudio de caso 2

> **Flujo anterior, pendiente de retirar al efectuar la migración.** La nueva aplicación se conecta directamente al spreadsheet y se configura con [CONFIGURACION_FUNCIONAL.md](CONFIGURACION_FUNCIONAL.md). No generar ni importar estos CSV para la nueva implementación. Estado y pendientes: [ESTADO_IMPLEMENTACION.md](../ESTADO_IMPLEMENTACION.md).

Cubre lo que pide el PDF del caso 2, textualmente:

> "cada técnico pueda verificar **su ruta**, **sus implementos y materiales a utilizar**,
> **el hotel** donde podría hospedar, **la camioneta** a utilizar, entre otros. Utilizando
> alguna plataforma a libre elección."

La plataforma elegida es **AppSheet** sobre Google Sheets. El caso 1 (la planificación y los
montos) lo sigue resolviendo el motor de `v2/apps-script`; esta app es la capa que el técnico
usa en terreno.

---

## 1. Qué hay acá

`generar.cjs` construye seis tablas planas desde los mismos datos sembrados en
`00_Esquema.gs` y `02_Setup.gs`. Se regenera con:

```bash
node appsheet/generar.cjs
```

| CSV | Filas | Para qué |
|---|---:|---|
| `ORDENES.csv` | 36 | **Tabla principal.** Una fila = un técnico en una localidad un día. Vienen marcadas `Origen = CASO_1`: son la línea base del enunciado y no se borran |
| `CHECKLIST.csv` | 480 | Los implementos de cada orden, con casilla para marcar en terreno |
| `TECNICOS.csv` | 10 | Nómina. El `Email` es lo que filtra la app |
| `FLOTA.csv` | 6 | Las 6 camionetas del enunciado |
| `DESTINOS.csv` | 16 | Las 16 localidades, para el formulario de orden nueva |
| `IMPLEMENTOS.csv` | 17 | Catálogo maestro del checklist |
| `GASTOS.csv` | 1 | Rendición con foto de boleta. Nace vacía: la llena el técnico en terreno |

Cuadratura contra el PDF: **33 equipos, 16 localidades, 10 técnicos, 6 camionetas**.
El plan dura **4 días hábiles** y usa 5 camionetas; la sexta queda de reserva.

### Las cinco cuadrillas

La Peugeot Partner es furgón de **cabina corta: caben 2 personas** con sus bolsos de
herramientas. Eso fija todo lo demás — 10 técnicos ÷ 2 = **5 cuadrillas**, cada una con un
corredor completo para no cruzar rutas.

| Cuadrilla | Técnicos | Vehículo | Corredor | Días |
|---|---|---|---|---:|
| C1 | T01 + T02 | V1 | Norte · Copiapó, Coquimbo, La Calera | 4 |
| C2 | T03 + T04 | V2 | Maule · Curicó, Talca | 2 |
| C3 | T05 + T06 | V3 | Biobío · San Pedro, Penco, Tomé, Santa Juana | 3 |
| C4 | T07 + T08 | V4 | RM · Maipú, Pudahuel, Santiago | 3 |
| C5 | T09 + T10 | V5 | RM sur y Ruta 78 · Lo Barnechea, Puente Alto, Melipilla, San Antonio | 2 |
| — | — | **V6** | **Reserva** | — |

### Los dos conductores se alternan

**Los 10 técnicos tienen licencia.** Por eso cada cuadrilla lleva dos conductores designados
que se turnan: la columna `Conductor` rota día a día, y `Conduccion_Por_Tecnico` reparte el
volante entre los dos.

Donde esto deja de ser un detalle: **el viaje a Copiapó son 8,9 h de conducción**, contra un
tope de seguridad de 9 h diarias. Con un solo conductor se llega al límite. Alternando, cada
uno maneja 4,45 h. Es la diferencia entre un plan legal y uno que no lo es.

### Horas extra antes que hostal

La regla, en este orden:

1. La jornada se arma hasta las **8,4 h** ordinarias.
2. Al cerrar el día se evalúa el regreso. Si volver cabe en **10,4 h** (o sea, con hasta 2 h
   extra), **se vuelve**.
3. Si ni con horas extra se llega, se pernocta y **se paga el hostal**.

El sustento es aritmético:

| Opción | Cálculo | Costo |
|---|---|---:|
| 2 h extra para 2 técnicos | 2 × 2 × $9.750 | **$39.000** |
| 1 noche para 2 técnicos | 2 × $50.000 + 2 × $25.000 del viático siguiente | **$150.000** |

La hora extra vale $6.500 × 1,5 = $9.750 (recargo del 50%, Código del Trabajo). Volver sale
cuatro veces más barato que dormir fuera — **siempre que se llegue dentro del tope**. Para
Copiapó y Biobío no se llega, y ahí el hostal no es comodidad: es la única opción legal.

### Reparto del dinero

| Concepto | Regla | Total |
|---|---|---:|
| Viático | $25.000 por técnico y por **día** desplegado, días de traslado incluidos · 28 técnico-días | $700.000 |
| Hotel | $50.000 por noche por persona · 10 técnico-noches | $500.000 |
| Peaje | Del recorrido real del día, cargado al **conductor** | $148.000 |
| Combustible | Km efectivos del día ÷ 20 km/L × $1.381, cargado al conductor | $273.026 |
| **Total a transferir** | | **$1.621.026** |

Aparte, **$9.556 de horas extra** (C1 el primer día, llegando a Copiapó). No se transfiere:
es costo de empresa y va en la planilla de sueldos, no en el bolsillo del técnico para la ruta.

Peaje y combustible van al conductor porque son gastos del vehículo, no de la persona. Se
cobran **una sola vez por día**, sobre los kilómetros que la camioneta realmente recorre ese
día (`Km_Dia`) — no ida y vuelta a la base por cada localidad. C3 el día 2 visita Penco, Tomé
y Santa Juana en un solo recorrido: si se cobrara por sitio, el combustible saldría tres veces.

### Los días de traslado también son órdenes

C1 el día 1 solo viaja a Copiapó, y C3 el día 3 solo regresa. No instalan nada, pero el
técnico **está desplegado**: cobra viático, puede dormir fuera, y tiene que ver ese día en su
agenda. Por eso se emite una orden `Traslado a Copiapo` / `Regreso a base` con `Equipos = 0`.
Olvidar esto es el error clásico: son 4 técnico-días y 2 noches, $200.000 que se caen de la
planilla sin que nadie los note.

---

## 2. Armar el Google Sheet (10 min)

1. Drive → **Nueva hoja de cálculo**, nómbrala `Servicio Tecnico en Ruta · App`.
2. Por cada CSV: **Archivo → Importar → Subir**, y elige
   **"Insertar hojas nuevas"**. Renombra cada pestaña igual que el archivo
   (`ORDENES`, `CHECKLIST`, `TECNICOS`, `FLOTA`, `DESTINOS`, `IMPLEMENTOS`).
3. En `TECNICOS`, reemplaza los emails `t01@servicioenruta.cl` por **los Gmail reales
   de ustedes cuatro** en T01–T04. Haz lo mismo en la columna `Email` de `ORDENES`
   (busca y reemplaza). Sin esto el filtro por usuario no se puede demostrar.

---

## 3. Crear la app (15 min)

En [appsheet.com](https://www.appsheet.com) → **Create → App → Start with existing data**
→ elige el Sheet → AppSheet levanta la app sola.

### 3.1 Agregar las tablas

**Data → Add new table** para las cinco restantes. En cada una fija la **Key**:

| Tabla | Key | Permisos |
|---|---|---|
| ORDENES | `ID` | Adds, Updates, Deletes |
| CHECKLIST | `ID` | Updates |
| GASTOS | `ID` | Adds, Updates, Deletes |
| TECNICOS | `Codigo` | Read-only |
| FLOTA | `Codigo` | Read-only |
| DESTINOS | `Localidad` | Read-only |
| IMPLEMENTOS | `Item_ID` | Read-only |

### 3.2 Tipos de columna — esto es lo que hace que se vea bien

En **Data → Columns → ORDENES**:

| Columna | Type | Por qué |
|---|---|---|
| `Origen` | **Enum** → `CASO_1`, `AGENDADA` | Separa las 33 del enunciado del trabajo nuevo |
| `Direccion` | **Address** | Habilita mapa y botón "cómo llegar" |
| `Hotel_Direccion` | **Address** | El hotel en el mapa |
| `Fecha` | **Date** | Permite agrupar y ordenar por día |
| `Vehiculo` | **Ref** → FLOTA | Toca la camioneta y ve su ficha |
| `Tecnico` | **Ref** → TECNICOS | Idem con la nómina |
| `Destino` | **Ref** → DESTINOS | Alimenta el formulario de orden nueva |
| `Viatico`, `Hotel_Monto`, `Peaje`, `Combustible`, `Gastos_Extra`, `Total_Transferencia` | **Price** | Formato $ automático |
| `Estado` | **Enum** → `Pendiente`, `En ruta`, `Completado` | Con *Display mode: Buttons* |
| `Foto_Instalacion` | **Image** | El técnico fotografía la instalación |
| `Firma_Cliente` | **Signature** | Acta de conformidad firmada en el celular |
| `Observaciones` | **LongText** | Columna libre |
| `Horas_Extra`, `Horas_Jornada`, `Conduccion_Dia`, `Conduccion_Por_Tecnico` | **Decimal** | Solo lectura. `Conduccion_Por_Tecnico` es la mitad del día, porque los dos se turnan |
| `Costo_Horas_Extra` | **Price** | Costo de empresa, NO se transfiere al técnico |

En **CHECKLIST**: `Listo` → **Yes/No**, `ID_Orden` → **Ref** a ORDENES
(marca *Is part of* para que aparezca como lista dentro de la orden).

En **GASTOS** (la rendición del técnico en terreno):

| Columna | Type | Notas |
|---|---|---|
| `ID_Orden` | **Ref** → ORDENES | Con *Is part of* marcado |
| `Fecha` | **Date** | Initial value `TODAY()` |
| `Tipo` | **Enum** | `Colacion`, `Peaje`, `Combustible`, `Alojamiento`, `Estacionamiento`, `Otro` |
| `Monto` | **Price** | Lo que el técnico escribe |
| `Boleta` | **Image** | *Abre la cámara del celular directo* |
| `Descripcion` | **LongText** | |
| `Estado_Rendicion` | **Enum** | `Pendiente`, `Aprobado`, `Rechazado` — solo tú lo editas |

`GASTOS.csv` trae una fila de ejemplo para que AppSheet infiera bien los tipos.
**Bórrala en el Sheet** una vez creada la app.

### 3.3 Fórmulas (App formula, en cada columna)

Con esto los montos dejan de ser datos pegados y se recalculan solos:

```
Tandas                CEILING([Equipos] / [Tecnicos_En_Sitio])
Horas_Trabajo         [Tandas] * 2.25
Km_Ida                LOOKUP([Destino], "DESTINOS", "Localidad", "Km_Ida")
Direccion             LOOKUP([Destino], "DESTINOS", "Localidad", "Direccion")
Peaje                 IF([Conductor]="Si", LOOKUP([Destino],"DESTINOS","Localidad","Peaje_Ida") * 2, 0)
Combustible           IF([Conductor]="Si", ROUND([Km_Ida] * 2 / 20 * 1381), 0)
Hotel_Monto           [Noches] * 50000
Total_Transferencia   [Viatico] + [Hotel_Monto] + [Peaje] + [Combustible] + [Gastos_Extra]
```

**De dónde sale el 2,25:**

| | Tiempo | Fuente |
|---|---|---|
| Instalación de un equipo | 2 h | PDF, textual |
| Capacitación | **15 min** | PDF dice 30 min; se reduce al **50%** |
| **Total por equipo, por técnico** | **2,25 h** | |

La capacitación baja a la mitad, **no a cero**, porque al cliente se le envía antes un enlace
de Drive con el video detallado. En terreno solo queda responder las dudas que le quedaron.
Bajarla a cero sería insostenible: alguien tiene que responder esas preguntas.

**Los técnicos instalan en paralelo, uno por equipo.** Por eso `Tandas`: si hay más equipos
que gente en el sitio, se hacen tandas y el sitio demora lo que demora la última. Copiapó con
5 equipos y 2 técnicos son 3 tandas = 6,75 h, no 11,25 h.

`20` km/L y `$1.381`/L salen de `P_RENDIMIENTO` y `P_DIESEL`.

### 3.4 Que cada técnico vea SOLO lo suyo

**Data → Tables → ORDENES → Security filter**:

```
OR(
  [Email] = USEREMAIL(),
  USEREMAIL() = "tucorreo@gmail.com"
)
```

Reemplaza `tucorreo@gmail.com` por el tuyo: tú entras como coordinación y ves las 36
órdenes, tus compañeros entran y ven solo las suyas. **Esta es la demo que hay que mostrar**
— es literalmente "cada técnico puede verificar su ruta".

El mismo filtro en **GASTOS**, para que nadie vea las boletas de otro:

```
OR(
  [Tecnico] = LOOKUP(USEREMAIL(), "TECNICOS", "Email", "Codigo"),
  USEREMAIL() = "tucorreo@gmail.com"
)
```

---

## 4. Las vistas (20 min)

**UX → Views → New View**:

| Vista | Tipo | Config |
|---|---|---|
| **Mi ruta** | Deck | Data: ORDENES · Group by `Fecha` · Primary `Destino` · Secondary `Hotel_Zona` |
| **Mapa** | Map | Data: ORDENES · Column: `Direccion` |
| **Agenda** | Calendar | Start date `Fecha` · Description `Destino` · Ver abajo |
| **Mis gastos** | Table | Data: GASTOS · Group by `Tipo` · con total de `Monto` |
| **Nueva orden** | Form | Ver 5 |
| **Resumen** | Dashboard | Solo para tu vista de coordinación |

### El calendario

Sí, el técnico ve su agenda. **View type: Calendar**, sobre ORDENES:

```
Start date    Fecha
End date      Fecha
Description   Destino
Category      Cuadrilla      (colorea cada cuadrilla distinto)
```

Como el security filter ya está aplicado, **cada técnico ve solo sus días en el calendario**.
Tú, como coordinación, ves los cuatro días con las tres cuadrillas en colores distintos —
esa es la mejor pantalla para proyectar: se entiende el plan completo de un vistazo.

### La rendición de gastos

Sí, y lo correcto es que sea **una tabla hija, no una columna**: un técnico tiene varias
boletas en un mismo día, no una sola.

En la vista detalle de la orden aparece **"Gastos" → botón +**, y el formulario pide:

- **Tipo** (colación, peaje, estacionamiento…) — botones, un toque
- **Monto** — teclado numérico, con formato $
- **Boleta** — toca y **se abre la cámara del celular**; la foto queda guardada en Drive
- **Descripción** — opcional

Para que se vea el total gastado contra lo transferido, agrega a ORDENES dos columnas
**virtuales** (*Data → Columns → ORDENES → Add virtual column*):

```
Gastos_Rendidos    SUM(SELECT(GASTOS[Monto], [ID_Orden] = [_THISROW].[ID]))
Saldo              [Total_Transferencia] - [Gastos_Rendidos]
```

Ambas de tipo **Price**. `Saldo` es lo que el técnico debe devolver, o lo que se le quedó
debiendo. Eso responde directo al enunciado: *"determinar qué monto requiere cada técnico"*,
y además cierra el ciclo mostrando en qué se gastó.

En la vista detalle de una orden, **UX → Views → ORDENES_Detail**, ordena las columnas así
para que la pantalla responda al PDF en orden:

1. `Destino` + `Direccion` (la ruta)
2. La lista relacionada de CHECKLIST (los implementos)
3. `Hotel_Zona` + `Hotel_Direccion` + `Noches` (el hotel)
4. `Vehiculo` (la camioneta)
5. Los montos + `Gastos_Rendidos` + `Saldo`
6. La lista relacionada de GASTOS (las boletas)
7. `Foto_Instalacion`, `Firma_Cliente`, `Estado`

Eso es un checklist visual de la rúbrica. Cuando lo muestres, léelo en ese orden.

---

## 5. Agendar trabajo nuevo con asignación automática

Las 33 instalaciones del caso 1 son la **línea base y no se tocan**. Encima de ellas se puede
agendar trabajo nuevo, que queda marcado `Origen = AGENDADA`.

### 5.1 Proteger las órdenes del caso 1

**Data → Tables → ORDENES → Are deletes allowed?**

```
[Origen] = "AGENDADA"
```

Las 36 órdenes del enunciado se pueden actualizar (marcar estado, subir foto, firmar) pero
**no borrar**. Solo desaparece lo que tú agendaste. Si alguien en la presentación pregunta
"¿y si un técnico borra su ruta?", ahí está la respuesta.

### 5.2 Quién está disponible

Así queda la carga después del caso 1 (sale de `node appsheet/generar.cjs`):

| Cuadrilla | Técnicos | Órdenes | Días ocupados | Disponible |
|---|---|---:|---|---|
| C2 · Maule | T03 + T04 | 2 c/u | 21 y 22 | **23 y 24 de sept** |
| C5 · RM sur | T09 + T10 | 4 c/u | 21 y 22 | **23 y 24 de sept** |
| C4 · RM | T07 + T08 | 3 c/u | 21 al 23 | 24 de sept |
| C3 · Biobío | T05 + T06 | 5 c/u | 21 al 23 | 24 de sept |
| C1 · Norte | T01 + T02 | 4 c/u | 21 al 24 | — |

Ya no hay un técnico de reserva: con cuadrillas de 2 entran los 10. **La reserva ahora es la
camioneta V6**, que queda sin asignar y es la que cubre una avería.

Lo que sí queda libre es tiempo: **C2 y C5 terminan el día 22** y tienen el 23 y el 24
desocupados. Ahí es donde entra el trabajo agendado, y es un argumento mejor que el técnico
ocioso — muestra que el plan dejó capacidad instalada, no gente sobrando.

### 5.3 La regla de asignación

En `ORDENES`, columna `Tecnico` → **Initial value**:

```
INDEX(
  ORDERBY(
    FILTER("TECNICOS", [Activo] = "Si"),
    COUNT(SELECT(ORDENES[ID], [Tecnico] = [Codigo]))
  ),
1)
```

Toma al técnico activo con **menos órdenes asignadas**. Con los datos de arriba, la primera
orden nueva cae sola en **T03 o T04**, la cuadrilla del Maule, que terminó el día 22 y tiene
el 23 y el 24 libres. Se explica en una frase y se ve funcionar en vivo.

Los demás campos, también como **Initial value**:

```
Origen   "AGENDADA"
Fecha    TODAY() + 7
Estado   "Pendiente"
```

En el formulario deja visibles solo: `Destino`, `Equipos`, `Fecha`, `Noches`, `Vehiculo`,
`Gastos_Extra`, `Observaciones`. El técnico, la dirección, los km, el peaje, el combustible,
el hotel y el total los calcula la app con las fórmulas de 3.3.

### 5.4 Versión que además respeta el día ocupado

Si alcanzas a probarla, esta no asigna a alguien que ya tiene trabajo esa fecha:

```
INDEX(
  ORDERBY(
    FILTER("TECNICOS",
      AND(
        [Activo] = "Si",
        COUNT(SELECT(ORDENES[ID],
          AND([Tecnico] = [_THISROW-1].[Codigo],
              [Fecha]   = [_THISROW].[Fecha]))) = 0
      )
    ),
    COUNT(SELECT(ORDENES[ID], [Tecnico] = [Codigo]))
  ),
1)
```

El anidamiento de `[_THISROW-1]` es delicado en AppSheet. **Pruébala antes de casarte con
ella**; si tira error, vuelve a la de 5.3, que cumple igual para la demo.

> **Para asignación real** (por ruta, corredor y jornada legal, no por conteo), el motor ya
> lo hace: `asistenteOrden()` en `v2/apps-script/06_Api.gs:595`. Un bot de AppSheet puede
> llamarlo con **Automation → Task → Call a script**. Es el paso siguiente, no el de mañana.

### 5.5 El guion de la demo, 40 segundos

1. Entras como coordinación: se ven las 36 órdenes del caso 1.
2. Muestras que C2 (T03 + T04) terminó el 22 y tiene el 23 y 24 libres.
3. **Nueva orden** → Destino `Talca`, Equipos `2`, Fecha `28-09`.
4. La app asigna **T03** sola y calcula el total: viático + hotel + peaje + combustible.
5. Entras con el Gmail de un compañero: ve solo lo suyo, no las 36.

---

## 6. Qué decir si el docente pregunta

**"¿Por qué AppSheet y no una planilla?"**
Porque el caso 2 pide que *cada técnico* verifique *lo suyo*. En una planilla compartida todos
ven todo y cualquiera edita cualquier fila. El filtro por `USEREMAIL()` resuelve exactamente
eso, y el técnico lo abre desde el celular en terreno, sin VPN ni instalación.

**"¿Y la planificación?"**
La planilla sigue siendo la base de datos y el motor calcula los dos escenarios. AppSheet no
reemplaza eso: es la capa de consulta y registro en terreno.

**"¿Qué gana el negocio?"**
El técnico marca implementos antes de salir, reporta con foto y firma del cliente, y la
coordinación ve el avance sin llamar por teléfono.

---

## 7. Límites conocidos — decirlos antes de que los pregunten

| Límite | Detalle |
|---|---|
| **Tiempos de viaje** | Derivados de los km referenciales: 90 km/h en carretera, 35 km/h en tramos urbanos. El motor los reemplaza con los tiempos reales de Google Maps, que consideran tráfico. Las jornadas de 8,3 h de C3 tienen poco margen: con tiempos reales podrían pasar a horas extra. |
| **Empaquetado de la jornada** | El planificador llena el día hasta 8,4 h y usa horas extra solo para volver a casa. Es **conservador**: nunca subestima días ni noches, pero puede que `mejorProgramacion_()` en `04_Motor.gs` comprima el plan aún más aceptando algo de sobretiempo. Defender el plan conservador es fácil; el contrario no. |
| **Hotel** | Tarifa **fija de $50.000 por noche y por persona**, decisión de jefatura, igual para todo el país. No se cotiza hotel por hotel: `Hotel_Zona` indica la zona de pernoctación ("Centro de Copiapó") y el monto sale de multiplicar noches × $50.000. Es un supuesto declarado, y como tal se defiende. |
| **Km** | Referenciales por carretera. El motor los reemplaza con Google Maps. |
| **Peajes** | Vienen de `T_PEAJES`, el respaldo acumulado por localidad. Los pórticos TAG de la RM están estimados y marcados `PENDIENTE MOP` en el esquema. |
| **Licencia** | Plan gratuito: se construye y se demuestra con la cuenta creadora. Publicar a los otros tres requiere plan pago o Workspace con AppSheet Core. **Para la presentación basta con demostrarlo desde tu teléfono.** |
