# PROMPT — Planilla de gestión funcional (Google Sheets + Apps Script + AppSheet)

> Copia todo desde "## CONTEXTO" hasta el final y pégalo como un único mensaje.
> Si el modelo se queda sin espacio, pídele que entregue los archivos por tandas en el orden de la sección 3.

---

## CONTEXTO

Actúa como desarrollador senior de Google Apps Script y especialista en logística de servicio técnico en terreno.

Soy jefe de un servicio técnico que instala equipos para una empresa de telecomunicaciones en todo Chile. Necesito una **planilla de Google funcional y demostrable**, que sirva de panel de control para los supervisores y que además sea la base de datos de una aplicación móvil hecha en AppSheet para los técnicos en terreno.

El entregable tiene que poder abrirse y demostrarse en vivo. No quiero un prototipo con celdas vacías: quiero la planilla cargada con un plan real de 33 instalaciones en 16 comunas, los cálculos funcionando, el menú propio operativo y las hojas ya preparadas para conectar AppSheet.

Restricciones técnicas:

- Google Sheets con Apps Script. Sin librerías externas ni dependencias que haya que instalar.
- Locale `es-CL`. Montos en pesos chilenos sin decimales, con punto como separador de miles (`$1.489.000`). Fechas `dd-mm-yyyy`.
- Todo el código y todos los rótulos en español.
- Cero números escritos a mano fuera de la hoja CONFIG. Si un valor aparece en el código o en una fórmula sin venir de CONFIG, es un error.

---

## 1. CONTEXTO DEL NEGOCIO

Base de operaciones: **INACAP Sede Santiago Sur, Av. Vicuña Mackenna 3864, Macul**. Todas las salidas y regresos se miden desde ahí. En cada ciudad el punto de trabajo es la municipalidad de la comuna.

Recursos: **10 técnicos** y **6 camionetas Peugeot Partner** con herramientas a bordo. Rendimiento 20 km por litro.

Tiempos: **2 horas** por equipo instalado y **15 minutos** de capacitación presencial por comuna (no por equipo). La capacitación completa se graba y se envía por correo al cliente antes de la visita; en terreno solo se responden dudas.

El plan se ejecuta con **5 cuadrillas de 2 técnicos**, cada una con una camioneta y un corredor propio. La sexta camioneta queda de reserva.

---

## 2. HOJA CONFIG — parámetros reales

Créala con cinco columnas: **Parámetro | Valor | Unidad | Origen | Nota**. La columna Origen usa tres etiquetas: `PDF` para lo que viene textual del enunciado, `JEFATURA` para decisiones propias y `SUPUESTO` para valores estimados que hay que defender. Celdas de valor con fondo amarillo, borde y validación de datos. **Define un rango con nombre por cada parámetro**, con el nombre que va entre corchetes, y lee siempre por nombre y nunca por coordenada.

### 2.1 Flota y combustible

| Parámetro | Valor | Unidad | Origen |
|---|---|---|---|
| Rendimiento de la camioneta `[P_RENDIMIENTO]` | 20 | km/L | PDF |
| Precio del diésel `[P_DIESEL]` | 1381 | $/L | SUPUESTO |
| Desgaste y mantención `[P_COSTO_KM]` | 60 | $/km | SUPUESTO |
| Camionetas disponibles `[P_CAMIONETAS]` | 6 | unidades | PDF |
| Intervalo de mantención `[P_KM_MANTENCION]` | 10000 | km | JEFATURA |
| Aviso anticipado de mantención `[P_AVISO_MANTENCION]` | 1000 | km | JEFATURA |

### 2.2 Personal y jornada

| Parámetro | Valor | Unidad | Origen |
|---|---|---|---|
| Técnicos disponibles `[P_TECNICOS]` | 10 | personas | PDF |
| Técnicos por cuadrilla `[P_TEC_POR_CUADRILLA]` | 2 | personas | JEFATURA |
| Jornada semanal contractual `[P_JORNADA_SEMANAL]` | 42 | h | SUPUESTO |
| Horas de colación por semana `[P_COLACION_H]` | 5 | h | JEFATURA |
| Jornada semanal efectiva `[P_JORNADA_EFECTIVA]` | =42−5 → 37 | h | calculado |
| Días laborales por semana `[P_DIAS_SEMANA]` | 5 | días | JEFATURA |
| Jornada diaria efectiva `[P_JORNADA_DIA]` | =37÷5 → 7,4 | h | calculado |
| Jornada diaria contractual `[P_JORNADA_DIA_MAX]` | =42÷5 → 8,4 | h | calculado |
| Máximo de horas extra por día `[P_MAX_EXTRA]` | 2 | h | SUPUESTO |
| Tope diario absoluto `[P_TOPE_DIA]` | =8,4+2 → 10,4 | h | calculado |
| Tope de conducción diaria `[P_TOPE_CONDUCCION]` | 9 | h | SUPUESTO |
| Valor hora técnico `[P_VALOR_HORA]` | 6500 | $/h | SUPUESTO |
| Recargo de hora extra `[P_RECARGO_EXTRA]` | 50% | % | PDF (Código del Trabajo) |

### 2.3 Tiempos de servicio

| Parámetro | Valor | Unidad | Origen |
|---|---|---|---|
| Instalación por equipo `[P_T_INSTALACION]` | 2 | h | PDF |
| Capacitación presencial base `[P_T_CAPACITACION]` | 0,5 | h | PDF |
| Reducción por capacitación grabada `[P_REDUCCION_CAP]` | 50% | % | JEFATURA |
| Capacitación efectiva `[P_T_CAP_EFECTIVA]` | =0,5×(1−50%) → 0,25 | h | calculado |
| Capacitaciones por comuna `[P_CAP_POR_COMUNA]` | 1 | sesiones | JEFATURA |

### 2.4 Estadía y alimentación

| Parámetro | Valor | Unidad | Origen |
|---|---|---|---|
| Hotel por noche por persona `[P_HOTEL]` | 50000 | $ | JEFATURA |
| Viático diario fuera de la RM `[P_VIATICO]` | 25000 | $ | JEFATURA |
| Colación diaria dentro de la RM `[P_COLACION]` | 5000 | $ | JEFATURA |
| Reserva de imprevistos `[P_IMPREVISTOS]` | 10% | % | JEFATURA |

### 2.5 Velocidades, umbrales y calendario

| Parámetro | Valor | Unidad | Origen |
|---|---|---|---|
| Velocidad promedio urbana `[P_VEL_URBANA]` | 28 | km/h | SUPUESTO |
| Velocidad promedio Ruta 78 `[P_VEL_R78]` | 80 | km/h | SUPUESTO |
| Velocidad promedio Ruta 5 `[P_VEL_RUTA5]` | 90 | km/h | SUPUESTO |
| Horas de ida sobre las que hay que pernoctar `[P_UMBRAL_PERNOCTA]` | 4 | h | JEFATURA |
| Fecha de inicio del plan `[P_FECHA_INICIO]` | 21-09-2026 | fecha | JEFATURA |
| Dirección de la base `[P_BASE]` | Av. Vicuña Mackenna 3864, Macul | texto | JEFATURA |
| Correo del supervisor `[P_MAIL_SUPERVISOR]` | supervisor@serviciotecnico.cl | texto | JEFATURA |

Al pie de CONFIG, un bloque **VERIFICACIÓN** con tres celdas en fórmula que deben mostrar `OK` en verde: que la jornada efectiva calculada sea 37, que la capacitación efectiva sea 0,25 y que el total de equipos de la hoja DESTINOS sea 33.

---

## 3. ARCHIVOS DE CÓDIGO

Entrégame los archivos completos, cada uno en su bloque, en este orden:

| Archivo | Contenido |
|---|---|
| `Codigo.gs` | `onOpen()` con el menú completo, y los despachadores de cada ítem |
| `Setup.gs` | Creación de las 11 hojas con formato, validaciones, rangos con nombre y formato condicional |
| `Semilla.gs` | Carga de los datos de ejemplo: config, destinos, técnicos, camionetas, implementos y el plan de las 5 cuadrillas |
| `Motor.gs` | Motor de cálculo puro: recibe los datos como argumentos y devuelve un objeto de resultados, sin tocar `SpreadsheetApp` |
| `Autoasignar.gs` | Asignación automática de técnico y la simulación de trabajo nuevo |
| `Ordenes.gs` | Generación de la orden de servicio en PDF y su envío |
| `Correos.gs` | Envío del correo de capacitación al cliente |
| `Flota.gs` | Revisión de mantenciones y vencimientos |
| `Cierre.gs` | Nómina de transferencias y cierre de semana |
| `AppSheet.gs` | Preparación de las hojas planas que consume la app y procesamiento de lo que la app escribe |
| `Pruebas.gs` | `ejecutarPruebas()` que valida los criterios de aceptación de la sección 9 |

---

## 4. MENÚ `onOpen` — esto es lo que se demuestra en vivo

Implementa `onOpen()` con `SpreadsheetApp.getUi()` creando el menú **⚙ Servicio Técnico** con esta estructura exacta, usando `addSubMenu` donde corresponde y `addSeparator()` entre grupos:

```
⚙ Servicio Técnico
├── 🔄 Recalcular plan completo
├── 📊 Ir al tablero de control
├── ─────────────
├── ➕ Agendar trabajo nuevo…
├── 🤖 Asignar técnico automáticamente…
├── ─────────────
├── 📄 Documentos
│   ├── Generar orden de servicio en PDF…
│   ├── Generar todas las órdenes del plan
│   └── Enviar capacitación al cliente…
├── 💰 Dinero
│   ├── Preparar nómina de transferencias
│   ├── Revisar gastos pendientes
│   └── Cerrar la semana
├── 🚐 Flota
│   ├── Revisar mantenciones y vencimientos
│   └── Marcar camioneta en taller…
├── ─────────────
├── 📱 AppSheet
│   ├── Preparar hojas para la app
│   ├── Regenerar checklist de las órdenes
│   └── Procesar lo que envió la app
├── ─────────────
├── 🛠 Instalación
│   ├── Crear o restaurar las hojas base
│   ├── Cargar datos de ejemplo
│   └── Ejecutar pruebas del sistema
└── ❓ Acerca de y supuestos
```

Comportamiento de cada ítem:

- **Recalcular plan completo**: corre el motor, reescribe las columnas calculadas de ÓRDENES, refresca CALENDARIO, TRANSFERENCIAS y TABLERO, y muestra un `toast` con el gasto total, los equipos y la cantidad de alertas. Debe demorar menos de 30 segundos.
- **Ir al tablero**: activa la hoja TABLERO y posiciona el cursor en A1.
- **Agendar trabajo nuevo**: abre un diálogo de `HtmlService` que pide comuna, cantidad de equipos y fecha deseada, y devuelve si cabe en la jornada, qué técnicos están libres, cuánto demoraría y cuánto costaría. Con un botón Confirmar que crea las órdenes. **No escribe nada hasta que el usuario confirme.**
- **Asignar técnico automáticamente**: pide el ID de la orden con `ui.prompt`, propone el técnico y espera confirmación con `ui.alert(YES_NO)`.
- **Generar orden de servicio en PDF**: pide el ID del técnico, arma el PDF en Drive y ofrece el enlace.
- **Enviar capacitación al cliente**: pide la comuna, muestra el destinatario y el enlace que se enviará, pide confirmación y usa `MailApp.sendEmail`. Marca `Capacitacion_Enviada` con fecha y hora.
- **Preparar nómina de transferencias**: recalcula TRANSFERENCIAS y genera un CSV en Drive.
- **Cerrar la semana**: consolida horas trabajadas, gastos rendidos y saldos pendientes en una hoja nueva con la fecha en el nombre, y la deja protegida.
- **Revisar mantenciones**: recorre CAMIONETAS y muestra un cuadro con las que están a menos de 1.000 km de la mantención o con documentos por vencer en 30 días.
- **Crear o restaurar las hojas base**: si la hoja ya existe, pide confirmación antes de sobrescribir. Debe ser idempotente.

Además de `onOpen`, define **tres activadores instalables** con una función `instalarActivadores()`:

1. Diario a las 07:00 — revisar mantenciones y, si hay alertas, enviar correo al supervisor.
2. Diario a las 20:00 — recalcular el plan y refrescar el tablero.
3. `onChange` — cuando AppSheet escribe en las hojas ÓRDENES, GASTOS o CHECKLIST, recalcular solo las columnas afectadas. Usa `LockService` para evitar dos ejecuciones simultáneas.

---

## 5. LAS 11 HOJAS

Regla general: **una sola fila de encabezado, sin celdas combinadas, sin filas en blanco intermedias** en todas las hojas que consume AppSheet (DESTINOS, TECNICOS, CAMIONETAS, ORDENES, CHECKLIST, IMPLEMENTOS, GASTOS). AppSheet no lee celdas combinadas y pierde la referencia si hay huecos. Las hojas CONFIG, CALENDARIO, AGENDAR, TRANSFERENCIAS y TABLERO son solo para el supervisor y ahí sí puedes usar formato libre.

En todas las hojas: primera fila congelada, filtros activados, columnas de ID protegidas contra edición, y ancho de columna ajustado.

### 5.1 `DESTINOS`

`ID_Destino | Comuna | Region | Direccion_Municipalidad | En_RM | Corredor | Km_Ida | Horas_Ida | Peaje_Ida | Equipos_Pendientes | Equipos_Instalados | Capacitacion_Enviada | Hotel_Referencia | Link_Capacitacion | Contacto_Cliente | Mail_Cliente`

Corredores: `URB`, `R78`, `R5N`, `R5S`. `Horas_Ida` se calcula con la velocidad del corredor desde CONFIG.

| ID | Comuna | Región | RM | Corredor | Km ida | Horas ida | Peaje ida | Equipos |
|---|---|---|---|---|---|---|---|---|
| D01 | Copiapó | Atacama | No | R5N | 800 | 8,89 | 25500 | 5 |
| D02 | Coquimbo | Coquimbo | No | R5N | 470 | 5,22 | 18100 | 2 |
| D03 | La Calera | Valparaíso | No | R5N | 110 | 1,22 | 3900 | 1 |
| D04 | San Antonio | Valparaíso | No | R78 | 108 | 1,35 | 5600 | 2 |
| D05 | Melipilla | Metropolitana | Sí | R78 | 68 | 0,85 | 2800 | 2 |
| D06 | Lo Barnechea | Metropolitana | Sí | URB | 22 | 0,79 | 2400 | 3 |
| D07 | Puente Alto | Metropolitana | Sí | URB | 24 | 0,86 | 2200 | 1 |
| D08 | Santiago | Metropolitana | Sí | URB | 10 | 0,36 | 1300 | 3 |
| D09 | Pudahuel | Metropolitana | Sí | URB | 22 | 0,79 | 0 | 3 |
| D10 | Maipú | Metropolitana | Sí | URB | 18 | 0,64 | 0 | 3 |
| D11 | Curicó | Maule | No | R5S | 195 | 2,17 | 7600 | 1 |
| D12 | Talca | Maule | No | R5S | 255 | 2,83 | 11000 | 3 |
| D13 | San Pedro de la Paz | Biobío | No | R5S | 505 | 5,61 | 20600 | 1 |
| D14 | Penco | Biobío | No | R5S | 520 | 5,78 | 20600 | 1 |
| D15 | Santa Juana | Biobío | No | R5S | 530 | 5,89 | 20600 | 1 |
| D16 | Tomé | Biobío | No | R5S | 545 | 6,06 | 20600 | 1 |

Total: 33 equipos en 16 comunas. Direcciones de las municipalidades: Copiapó, Chacabuco 546 · Coquimbo, Bilbao 330 · La Calera, J. J. Pérez 351 · San Antonio, Av. Barros Luco 1881 · Melipilla, Serrano 1550 · Lo Barnechea, Av. Lo Barnechea 1210 · Puente Alto, Concha y Toro 1820 · Santiago, Plaza de Armas 444 · Pudahuel, Av. San Pablo 8444 · Maipú, Av. 5 de Abril 0260 · Curicó, Carmen 360 · Talca, 1 Sur 835 · San Pedro de la Paz, Los Álamos 2093 · Penco, Freire 545 · Santa Juana, Irarrázaval 320 · Tomé, Ignacio Serrano 1130.

Hotel de referencia: «Centro de Copiapó» para D01, «Centro de Coquimbo» para D02, «Centro de Talca» para D12 y «Centro de Concepción» para D13 a D16. El resto, «No aplica, retorno en el día».

### 5.2 `TECNICOS`

`ID_Tecnico | Nombre | Email | Telefono | Licencia | Cuadrilla | Vehiculo_Habitual | Activo | Horas_Asignadas | Horas_Libres | Utilizacion | Equipos_Instalados | Comunas_Visitadas | Dias_Fuera_RM | Dias_En_RM | Noches_Fuera | Monto_Transferido | Monto_Rendido | Saldo | Rendiciones_Atrasadas`

De `Horas_Asignadas` en adelante, todo es fórmula: nunca se escribe a mano.

| ID | Nombre | Licencia | Cuadrilla | Móvil |
|---|---|---|---|---|
| T01 | Álvaro Fuentes | Clase B | C1 | V1 |
| T02 | Camila Rojas | Clase B | C1 | V1 |
| T03 | Diego Muñoz | Clase B | C2 | V2 |
| T04 | Javiera Soto | Clase B | C2 | V2 |
| T05 | Matías Contreras | Clase B | C3 | V3 |
| T06 | Fernanda Araya | Clase B | C3 | V3 |
| T07 | Cristián Vega | Clase B | C4 | V4 |
| T08 | Paulina Herrera | No | C4 | V4 |
| T09 | Rodrigo Cáceres | Clase B | C5 | V5 |
| T10 | Bárbara Neira | No | C5 | V5 |

Correos de ejemplo con el formato `nombre.apellido@serviciotecnico.cl`. Teléfonos ficticios `+569 XXXX XXXX`.

### 5.3 `CAMIONETAS`

`ID_Vehiculo | Patente | Modelo | Km_Inicial | Km_Recorridos_Plan | Km_Acumulado | Km_Proxima_Mantencion | Km_Faltantes | Venc_Revision_Tecnica | Venc_Seguro | Venc_Permiso_Circulacion | Estado | Litros_Consumidos | Gasto_Combustible | Gasto_Peajes | Gasto_Desgaste | Alerta`

Seis filas: V1 a V6, todas Peugeot Partner, patentes ficticias `JKLM-11` a `JKLM-66`. Kilometrajes iniciales distintos entre 18.000 y 96.000 para que las alertas de mantención se disparen de verdad en la demostración: **al menos una camioneta debe quedar en alerta**. `Estado` con validación de lista: `Disponible`, `En ruta`, `En taller`, `Reserva`. V6 arranca como `Reserva`. La columna `Alerta` es fórmula: avisa si faltan menos de 1.000 km para la mantención o si algún documento vence en menos de 30 días.

### 5.4 `ORDENES` — la hoja central

Una fila por técnico y por día. El plan de ejemplo tiene **36 filas**.

Columnas que escribe el supervisor o el motor:
`ID_Orden | Dia | Fecha | Cuadrilla | ID_Tecnico | Nombre_Tecnico | ID_Vehiculo | Es_Conductor | ID_Destino | Comuna | Direccion | Equipos | Tecnicos_En_Sitio | Horas_Viaje | Horas_Instalacion | Horas_Capacitacion | Horas_Totales | Estado_Jornada | Horas_Extra | Costo_Horas_Extra | Km_Dia | Peaje | Combustible | Tipo_Estipendio | Estipendio | Noches | Hotel_Monto | Total_Transferencia | Estado_Orden`

Columnas que escribe la app del técnico y que el motor **nunca** sobrescribe:
`Hora_Inicio_Jornada | Checklist_Completo | Hora_Salida_Ruta | Capacitacion_Enviada | Hora_Inicio_Instalacion | Hora_Fin_Instalacion | Hora_Inicio_Capacitacion | Hora_Fin_Capacitacion | Hora_Fin_Jornada | Firma_Cliente | Foto_Instalacion | Observaciones | Ubicacion_GPS`

Y tres columnas de control en fórmula: `Horas_Reales` (diferencia entre fin e inicio de jornada), `Desvio_vs_Estimado` y `Avance` (porcentaje de hitos marcados).

`Estado_Orden` con validación de lista: `Planificada`, `En curso`, `Completada`, `Reprogramada`, `Cancelada`.

**Plan de ejemplo a cargar** (cada línea genera dos filas, una por técnico de la cuadrilla; las filas de traslado sin instalación también son órdenes):

| Cuadrilla | Día | Destino | Equipos | Noches | Nota |
|---|---|---|---|---|---|
| C1 | D1 | Traslado a Copiapó | 0 | 1 | 800 km, sin instalación |
| C1 | D2 | Copiapó | 5 | 1 | |
| C1 | D3 | Coquimbo | 2 | 1 | |
| C1 | D4 | La Calera | 1 | 0 | regresa a la base |
| C2 | D1 | Curicó | 1 | 0 | ida y vuelta el mismo día |
| C2 | D2 | Talca | 3 | 0 | ida y vuelta el mismo día |
| C3 | D1 | San Pedro de la Paz | 1 | 1 | |
| C3 | D2 | Penco, Tomé y Santa Juana | 3 | 1 | tres comunas el mismo día |
| C3 | D3 | Regreso a la base | 0 | 0 | sin instalación |
| C4 | D1 | Maipú | 3 | 0 | |
| C4 | D2 | Pudahuel | 3 | 0 | |
| C4 | D3 | Santiago | 3 | 0 | |
| C5 | D1 | Lo Barnechea y Puente Alto | 4 | 0 | |
| C5 | D2 | Melipilla y San Antonio | 4 | 0 | |

### 5.5 `IMPLEMENTOS` — catálogo del checklist

`ID_Implemento | Categoria | Item | Obligatorio | Viaja_En`

17 ítems en tres categorías. `Viaja_En` indica `Bolso`, `Vehiculo` o `Persona`, y sirve para saber qué puede viajar en bus o avión y qué obliga a llevar camioneta.

**Bolso (8):** multímetro y pinza amperimétrica · crimpeadora, conectores RJ45 y tester de red · kit de fibra óptica con fusionadora y pigtails · taladro percutor, brocas y tarugos · set de destornilladores aislados y llaves · notebook con software de puesta en marcha · equipo de reemplazo y repuestos menores · cinta aisladora, amarras y canaletas.

**Vehículo (4):** escalera telescópica · equipos a instalar del día · extensión eléctrica, conos y señalética · documentos del vehículo y TAG al día.

**Persona (5):** casco, guantes dieléctricos, lentes y zapatos de seguridad · arnés de seguridad · botiquín, agua y linterna frontal · celular con datos y batería cargada · tarjeta corporativa de combustible y peajes.

### 5.6 `CHECKLIST`

`ID_Item | ID_Orden | ID_Tecnico | Fecha | Categoria | Item | Obligatorio | Marcado | Hora_Marcado`

Se genera por código: una fila por ítem del catálogo y por orden. Con 36 órdenes y 17 ítems son **612 filas**. La app solo escribe `Marcado` y `Hora_Marcado`.

### 5.7 `GASTOS`

`ID_Gasto | ID_Orden | ID_Tecnico | Fecha | Tipo | Monto | Foto_Boleta | Estado | Revisado_Por | Fecha_Revision | Comentario`

`Tipo` con validación de lista: `Bencina`, `Peaje`, `Hotel`, `Colación`, `Estacionamiento`, `Otro`. `Estado` con lista: `Pendiente`, `Revisado`, `Rechazado`. `Foto_Boleta` guarda la URL del archivo en Drive.

Arranca con 4 o 5 filas de ejemplo para que la demostración tenga algo que mostrar, incluida una rechazada con comentario.

### 5.8 `CALENDARIO`

Matriz de 10 filas (técnicos) por 10 columnas (D1 a D10), con las fechas calculadas desde `P_FECHA_INICIO` saltando sábados y domingos. Cada celda muestra las horas comprometidas, sumadas con `SUMIFS` sobre ORDENES.

Debajo, tres bloques más: **horas libres** por técnico y día (`P_JORNADA_DIA` menos las asignadas), **días fuera de la RM** con 1 o 0 por celda, y **días dentro de la RM con despliegue**. Estos dos últimos son la base de cálculo del viático y la colación.

Formato condicional en la matriz de horas: verde hasta 7,4 · amarillo hasta 8,4 · naranja hasta 10,4 · rojo sobre 10,4. Al pie, una fila con la capacidad libre total por día.

### 5.9 `AGENDAR`

Formulario en celdas, no en diálogo, para que también sirva sin el menú:

- Entradas en amarillo: comuna (lista desplegable de DESTINOS), cantidad de equipos, fecha deseada, cantidad de técnicos.
- Salidas en fórmula: horas de viaje ida y vuelta, horas de instalación, horas totales del día, si cabe en la jornada, si obliga a pernoctar, cuántas noches, costo estimado desglosado y costo total.
- Una tabla con los técnicos disponibles ese día, ordenada por horas libres, y otra con las camionetas disponibles.
- Un semáforo grande que diga `CABE EN LA JORNADA`, `NECESITA HORAS EXTRA` o `NO CABE, HAY QUE PERNOCTAR O MOVER ALGO`.

### 5.10 `TRANSFERENCIAS`

`ID_Tecnico | Nombre | Banco | Tipo_Cuenta | Monto_A_Transferir | Detalle | Estado | Fecha_Transferencia | Monto_Rendido | Saldo | Alerta`

Los datos bancarios quedan en blanco o con texto de referencia: **no inventes números de cuenta**. `Detalle` es una fórmula de texto que concatena de dónde sale el monto, por ejemplo «4 días fuera de la RM + 3 noches de hotel + peajes del día conducido». `Estado` con lista: `Pendiente`, `Transferido`, `Devuelto`.

### 5.11 `TABLERO`

Bloque de indicadores arriba: equipos instalados, comunas atendidas, días hábiles usados, kilómetros recorridos, gasto total transferido, costo total de la operación, gasto promedio por equipo, utilización de la dotación, alertas de flota y rendiciones atrasadas.

Cuatro gráficos nativos de Sheets creados por código con `newChart()`:

1. Torta: en qué se va la plata (viáticos, colación, hotel, peajes, bencina).
2. Barras: gasto total por cuadrilla.
3. Barras: gasto por equipo instalado en cada comuna.
4. Columnas: horas comprometidas por día contra la capacidad disponible.

Y un bloque **ALERTAS** en fórmula que liste automáticamente: órdenes con jornada sobre 10,4 horas, órdenes sin técnico asignado, técnicos sin licencia marcados como conductores, camionetas asignadas a dos cuadrillas el mismo día, camionetas con mantención vencida y técnicos con rendiciones atrasadas.

---

## 6. REGLAS DE CÁLCULO

Impleméntalas exactamente así en `Motor.gs`:

```
// tiempos
horas_viaje_ida   = km_ida / velocidad_del_corredor
horas_instalacion = equipos === 0 ? 0 : Math.ceil(equipos / tecnicos_en_sitio) * P_T_INSTALACION
horas_capacitacion= (primera visita a la comuna) ? P_CAP_POR_COMUNA * P_T_CAP_EFECTIVA : 0
horas_totales     = horas_viaje_del_dia + horas_instalacion + horas_capacitacion

// semáforo de jornada
<= P_JORNADA_DIA      -> "OK"
<= P_JORNADA_DIA_MAX  -> "TOLERANCIA"
<= P_TOPE_DIA         -> "SOBRETIEMPO"
>  P_TOPE_DIA         -> "FUERA DE LEY"   // debe ser cero, obliga a replanificar

horas_extra       = Math.max(0, horas_totales - P_JORNADA_DIA_MAX)
costo_horas_extra = horas_extra * P_VALOR_HORA * (1 + P_RECARGO_EXTRA)

// dinero del vehículo: se carga UNA sola vez por día al conductor
combustible = es_conductor ? (km_dia / P_RENDIMIENTO) * P_DIESEL : 0
peaje       = es_conductor ? peaje_del_recorrido_del_dia : 0
desgaste    = es_conductor ? km_dia * P_COSTO_KM : 0   // costo de empresa, NO se transfiere

// estipendio: por técnico y por día, nunca por comuna atendida
si el técnico pasó el día fuera de la RM  -> P_VIATICO   (tipo "Viatico")
si trabajó dentro de la RM                -> P_COLACION  (tipo "Colacion")

hotel = noches * P_HOTEL                  // por persona

total_transferencia_tecnico = estipendio + hotel + peaje + combustible
total_a_transferir = suma de todos * (1 + P_IMPREVISTOS), redondeado al millar
```

Cuatro precisiones que suelen implementarse mal:

1. **La capacitación se dicta una sola vez por comuna**, no una por equipo. Si en una comuna hay tres equipos, la capacitación se carga solo en la primera orden de esa comuna.
2. **El combustible y el peaje se cobran una vez al día al conductor**, sobre los kilómetros que la camioneta recorrió ese día. Si una cuadrilla visita tres comunas en un día, no se rinde el combustible tres veces.
3. **El estipendio es por técnico y por día.** Un técnico que atiende tres comunas en un día recibe un solo viático.
4. **Los días de puro traslado también son órdenes.** El técnico está desplegado, devenga viático y puede dormir fuera, aunque no instale nada. Son 3 de las 36 órdenes del plan.

---

## 7. LAS SEIS FUNCIONES AUTOMÁTICAS

| Función | Qué hace |
|---|---|
| `asignarTecnicoAutomatico(idOrden)` | Filtra técnicos activos, con horas libres ese día, con licencia si la orden requiere conducir, y ordena por cercanía del corredor y por menor carga acumulada. Devuelve el candidato con el motivo de la elección. No escribe hasta que el supervisor confirme. |
| `recalcularPlan()` | Corre el motor completo y reescribe solo las columnas calculadas. Nunca toca las columnas que escribe la app. |
| `generarOrdenPDF(idTecnico)` | Arma la hoja de ruta: días, comunas, direcciones, camioneta, conductor, hotel, checklist y monto a transferir. Exporta a PDF en una carpeta de Drive y devuelve el enlace. |
| `enviarCapacitacion(idDestino)` | Envía al cliente el correo con el enlace del video. Marca `Capacitacion_Enviada` con fecha y hora. Se dispara también cuando la app registra `Hora_Salida_Ruta`. |
| `revisarFlota()` | Recorre CAMIONETAS, detecta mantenciones y vencimientos próximos, escribe la columna `Alerta` y manda correo al supervisor si hay algo crítico. |
| `cerrarSemana()` | Consolida horas reales, gastos rendidos y saldos, crea una hoja `CIERRE_dd-mm-yyyy`, la protege y deja el resumen listo para la planilla de sueldos. |

---

## 8. CAPA APPSHEET

La planilla es la base de datos de la app. Documenta esta parte en una hoja `LEEME_APPSHEET` generada por código, y deja las hojas listas para conectar.

**Tablas que se conectan:** `ORDENES` (lectura y escritura), `CHECKLIST` (lectura y escritura), `GASTOS` (solo agregar), `TECNICOS`, `CAMIONETAS`, `DESTINOS` e `IMPLEMENTOS` (solo lectura).

**Claves:** `ID_Orden`, `ID_Item`, `ID_Gasto`, `ID_Tecnico`, `ID_Vehiculo`, `ID_Destino`, `ID_Implemento`. Todas generadas por código con prefijo y número correlativo, nunca con la fila como clave.

**Filtro de seguridad** en ORDENES, CHECKLIST y GASTOS: `[Email] = USEREMAIL()`. Se aplica en el servidor, así el técnico no necesita permisos sobre la planilla y no ve las órdenes ni los montos de sus compañeros. Para que funcione, ORDENES y CHECKLIST necesitan una columna `Email` traída de TECNICOS.

**Columnas virtuales a definir en AppSheet** (no en la planilla):

- `Gastos_Rendidos` = suma de los montos de GASTOS asociados a la orden.
- `Saldo` = `Total_Transferencia` − `Gastos_Rendidos`.
- `Avance_Hitos` = porcentaje de los siete hitos marcados.
- `Checklist_Pendiente` = cuántos ítems obligatorios siguen sin marcar.
- `Puede_Salir_A_Ruta` = verdadero solo si `Checklist_Pendiente` es cero.

**Vistas de la app:**

1. `Mi ruta` — vista de mazo agrupada por fecha, ordenada por día, con la comuna, la dirección de la municipalidad y las horas estimadas.
2. `Detalle de la orden` — muestra en este orden: la ruta, los implementos, el hotel y la camioneta. Es el orden en que el enunciado pide la información.
3. `Mi jornada` — los siete hitos como botones de acción secuenciales.
4. `Checklist` — los 17 ítems agrupados por categoría, con casillas.
5. `Rendir gasto` — formulario con tipo, monto y foto de la boleta.
6. `Mi saldo` — lo transferido, lo rendido y el saldo.

**Los siete hitos**, implementados como acciones que escriben la hora del servidor y la ubicación:

1. `Iniciar jornada` — siempre disponible.
2. `Completar checklist` — habilita el hito 3.
3. `Salir a ruta` — condicionado a `Puede_Salir_A_Ruta`. Dispara el correo de capacitación al cliente.
4. `Iniciar instalación`.
5. `Terminar instalación`.
6. `Capacitación` — inicio, fin y firma del cliente.
7. `Cerrar jornada` — calcula las horas reales.

Cada acción debe quedar deshabilitada si el hito anterior no está marcado, para que la secuencia no se pueda saltar.

**Tipos de columna en AppSheet:** `Foto_Boleta` y `Foto_Instalacion` como `Image`, `Firma_Cliente` como `Signature`, las horas como `DateTime`, `Ubicacion_GPS` como `LatLong`, los montos como `Price` con moneda CLP.

En `AppSheet.gs` incluye `prepararHojasAppSheet()`, que valida que no haya celdas combinadas ni filas vacías en las tablas conectadas, que todos los ID sean únicos y que la columna `Email` esté poblada, y que informe cualquier problema antes de conectar la app.

---

## 9. CRITERIOS DE ACEPTACIÓN

Con los datos de ejemplo cargados, `ejecutarPruebas()` debe validar estos valores. Si alguno no cuadra, hay un error de implementación:

| Indicador | Valor esperado |
|---|---|
| Equipos instalados | 33 |
| Comunas atendidas | 16 |
| Capacitaciones dictadas | 16 |
| Órdenes de trabajo generadas | 36 |
| Filas de checklist generadas | 612 |
| Días hábiles del plan | 4 |
| Kilómetros recorridos | 3.954 |
| Peajes | $148.000 |
| Combustible | $273.026 |
| Viáticos | $350.000 (14 pagos de $25.000) |
| Colación | $70.000 (14 pagos de $5.000) |
| Alojamiento | $500.000 (10 noches) |
| Subtotal | $1.341.026 |
| **Total a transferir** | **$1.489.000** |
| Desgaste y mantención | $237.240 |
| Costo de horas extra | $9.556 |
| Costo total de la operación | $1.735.796 |
| Jornadas en estado FUERA DE LEY | 0 |
| Jornadas en SOBRETIEMPO | 1 (el traslado a Copiapó, 8,89 h) |

Monto a transferir por técnico: T01 $399.000 · T02 $333.000 · T05 $318.000 · T06 $198.000 · T04 $75.000 · T03 $58.000 · T10 $41.000 · T07 $25.000 · T09 $21.000 · T08 $21.000.

Gasto por cuadrilla: C1 $732.000 · C2 $133.000 · C3 $516.000 · C4 $46.000 · C5 $62.000.

---

## 10. REQUISITOS DE CÓDIGO Y ENTREGA

- Código comentado en español, nombres de función y variable descriptivos, sin abreviaturas crípticas.
- Lee cada hoja **una sola vez** con `getDataRange().getValues()` y trabaja en memoria. Nada de `getValue()` dentro de un bucle, ni `setValue()` celda por celda: usa `setValues()` por bloques.
- `Motor.gs` debe ser puro: recibe los datos como argumentos y devuelve el objeto de resultados, sin tocar `SpreadsheetApp`. Así se puede probar.
- Usa `LockService` en toda función que escriba, para que un recálculo y una escritura de AppSheet no choquen.
- Manejo de errores: si falta una hoja, un rango con nombre o un ID referenciado que no existe, muestra un mensaje que diga la hoja, la fila y qué hay que corregir. Nunca falles en silencio ni dejes la planilla a medio escribir.
- Formato condicional aplicado por código, no a mano, para que sobreviva a un `Crear o restaurar las hojas base`.

Cierra la respuesta con los pasos de instalación numerados: crear la planilla, abrir Extensiones y Apps Script, crear cada archivo, guardar, recargar la planilla, ejecutar `Crear o restaurar las hojas base`, autorizar los permisos de Drive y Gmail, ejecutar `Cargar datos de ejemplo`, ejecutar `Ejecutar pruebas del sistema`, ejecutar `instalarActivadores()` y por último conectar AppSheet.

Empieza confirmando en tres o cuatro líneas cómo vas a estructurar el proyecto, y después entrega los archivos completos.
