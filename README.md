# CRM de instalaciones · presentación

Demo en Google Sheets + Apps Script: operación simulada, direcciones exactas con Google Maps, presupuesto de viáticos y botones para iniciar/terminar instalaciones. No necesita una configuración extensa para presentar el caso.

Base: **INACAP Santiago Sur, Av. Vicuña Mackenna 3864, Macul**, según la [dirección oficial de INACAP](https://portal.inacap.cl/sede-santiago-sur). Se corrigió la antigua dirección de San Miguel. Las coordenadas iniciales son aproximadas; las consultas nuevas a Maps usan la dirección escrita.

## Ejecutar la presentación

1. En el libro vinculado, abra **Extensiones → Apps Script**.
2. Seleccione el archivo `15_Presentacion.gs`, elija **`prepararDemo`** en la lista de funciones y pulse **Ejecutar**. Autorice los permisos. Si no aparece la función, guarde y recargue el editor; seleccione un `.gs`, no un HTML.
3. Se crea/repara la estructura, se carga el caso y se planifica si no hay órdenes. Después se abre la UI. No registra instalaciones realizadas ni transfiere dinero.
4. Recargue el libro. En el menú **CRM Servicio Tecnico**, use **Abrir presentación** para volver al panel.
5. Para guardar desde la UI, use **Ver token para UI / AppSheet** en el menú y péguelo en **Acceso de coordinación**. Solo se conserva mientras esa página está abierta.

El panel funciona como ventana del libro, sin publicar una web. Opcionalmente puede implementar una aplicación web para usuarios Google: `doGet` abre la misma presentación. **`clasp push` actualiza el código, no ejecuta funciones ni modifica las hojas.** Tampoco actualiza una URL de implementación con versión fija: para esa URL seleccione una nueva versión en **Implementar → Administrar implementaciones**.

| Función ejecutable sin parámetros | Resultado |
| --- | --- |
| `prepararDemo` | Instala, completa el caso y planifica si no hay OT |
| `abrirPresentacion` | Abre la UI dentro del libro |
| `instalarCRM` | Repara estructura y carga tablas vacías |
| `aplicarVistaSimple` | Muestra solo las seis hojas de trabajo |
| `mostrarHojasAuxiliares` | Muestra tablas internas |
| `verTokenIntegracion` | Muestra el token al coordinador |
| `menuPlanificar` | Recalcula el plan con confirmación |

## Caso: 33 equipos y capacitación por equipo

| Región | Localidad | Equipos |
| --- | --- | ---: |
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

Nombres, contactos, direcciones de clientes, hoteles, tarifas y dotación son ejemplos, no reservas ni cotizaciones vigentes. La carga inicial supone 10 técnicos y 6 camionetas, una en mantención. Las órdenes se distribuyen por técnico; no hay necesariamente una OT por equipo.

`prepararDemo` completa requerimientos con IDs faltantes sin sobrescribir los existentes. Si ya hay plan, lo conserva; use **Planificar / actualizar presupuesto** para regenerarlo antes de comenzar la ejecución. No use «Reinstalar desde cero» sobre datos que quiera conservar.

## Hojas y configuración

Quedan visibles **CONFIG, REQUERIMIENTOS, ORDENES_TRABAJO, ITINERARIO, VIATICOS y GASTOS**. Las otras 16 hojas se ocultan, no se eliminan: el motor original usa esas tablas auxiliares. Puede mostrarlas desde el menú. No se generan materiales ni se usan pesos para elegir transporte.

`CONFIG` conserva diez ajustes: semana, minutos de instalación, minutos de capacitación, alojamiento, colación con y sin pernoctación, reserva, diésel, pasaje micro/metro y tarifa bus por km. Importes en CLP; la reserva usa factor (`0.15` = 15%). Los ajustes avanzados anteriores se conservan en la propiedad `CONFIG_AVANZADA`; el resto utiliza los valores de `00_Config.gs`. Claves y token quedan en el servidor.

**Guardar no recalcula automáticamente.** Cambiar ajustes o direcciones afecta el próximo cálculo. «Actualizar vista» solo lee. «Planificar / actualizar presupuesto» reconstruye órdenes, trayectos y viáticos. Con una instalación iniciada, un viático transferido o un gasto real, se bloquea la reconstrucción; use un libro de demo nuevo para otro escenario. Esta versión mantiene un único plan operativo, no un histórico.

Edite cantidades en `REQUERIMIENTOS`. Para cambiar disponibilidad, muestre las auxiliares y edite `TECNICOS.ACTIVO` o `VEHICULOS.ESTADO`. No comparta ni versione propiedades del script.

## Direcciones exactas y Google Maps

1. En **Direcciones y Maps**, seleccione localidad e ingrese calle, número, comuna y Chile, o coordenadas. No pegue un enlace acortado.
2. Pulse **Calcular ruta con Google Maps**. Se consultan ida y regreso por separado desde la base.
3. Revise kilómetros, minutos, fuente y **Revisar ubicación en Google Maps**. La vista previa no modifica el sitio.
4. Pulse **Confirmar punto y guardar ruta**. La vista previa vence a los diez minutos; editar la dirección invalida la confirmación anterior.
5. Pulse **Planificar / actualizar presupuesto** para aplicar el cambio a agenda y viáticos.

Sin clave se utiliza el [servicio Maps de Apps Script](https://developers.google.com/apps-script/reference/maps/direction-finder), sujeto a cuotas y permisos. Para usar clave propia, habilite Routes API y facturación en Google Cloud y pegue su clave en **Conexión Google Maps**. La integración usa [Routes API: computeRoutes](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes), con direcciones y campos de distancia, duración y coordenadas. La clave no se devuelve al navegador.

Si falla Google o no encuentra ruta, aparece un error y se conserva la dirección anterior. No se presenta una estimación como dato real. La consulta es **por carretera**, con duración estimada sin tráfico en vivo; no es un itinerario real de micro/metro ni un vuelo. Tarifas, tiempos de transporte público y peajes siguen siendo supuestos. Cambiar un sitio invalida sus enlaces con otras localidades, que se estiman geográficamente hasta recalcularlos.

La actualización masiva del menú es una función heredada de Distance Matrix. Para la presentación y claves nuevas de Routes API, use el formulario: consulta solo las dos rutas necesarias por localidad.

## Presupuesto y decisiones

Se comparan camioneta disponible, avión con bus/micro de conexión, bus interurbano y micro/metro urbano. En **Direcciones y Maps → Comparar transportes** puede elegir técnicos y días para evaluar un destino individual. Los circuitos de varias localidades se planifican por tierra en esta demo; el modelo aéreo individual no cubre vuelos entre varios aeropuertos. **Uber, pesos, fletes y costos de materiales están excluidos.** La comparación considera desembolso, alojamiento, colación y horas de viaje. Es una heurística para presentar decisiones, no una prueba de óptimo global ni una verificación de horarios comerciales.

El plan incluye salida, llegada, instalación, capacitación, colación y regreso. La transferencia propuesta por técnico suma:

`alojamiento + colación + pasajes y conexiones + combustible + peajes + reserva`, redondeada hacia arriba a miles de pesos.

Combustible y peajes se asignan una sola vez por cuadrilla al conductor/líder. Los pasajes se reparten y **sí se suman al total a transferir**. Marcar «transferido» es un registro administrativo; no hay integración bancaria. Mano de obra y costos de rentabilidad no son dinero de viáticos. El costo de oportunidad compara opciones y no se suma otra vez a la transferencia.

Amadeus y CNE siguen como integraciones opcionales heredadas; no son necesarias para la demo. El retorno de Amadeus se estima a partir de una tarifa de ida y se identifica como tal.

**Propuesta para exponer:** agrupar visitas por zona; comparar avión/bus en viajes largos y micro/metro en ciudad; aprovechar camionetas para circuitos con varias visitas. No comprar otra camioneta basándose solo en estos 33 equipos. Medir duraciones reales y pendientes durante varias operaciones: si faltan horas técnicas, evaluar apoyo temporal; si hay técnicos disponibles pero falta movilidad, comparar arriendo puntual con compra. La UI muestra la justificación de cada despacho y los equipos sin asignar.

## Técnico y AppSheet

La pestaña **Técnico** permite elegir técnico → iniciar → confirmar capacitación → terminar. Guarda inicio y término reales, duración, estado y marcas. Repetir inicio/cierre no reemplaza la primera marca. Rechaza cierre sin inicio o sin capacitación y valida que el técnico coincida con la OT. Es una vista de coordinación con token compartido, no autenticación individual.

Para una demo sencilla en AppSheet, conecte `ORDENES_TRABAJO` (clave `OT_ID`), `TECNICOS` (clave `TECNICO_ID`) y `VIATICOS` (clave `VIATICO_ID`). Configure correos reales en `TECNICOS.EMAIL`, inicio de sesión y filtro de seguridad para órdenes:

```text
[TECNICO_ID] = LOOKUP(USEREMAIL(), "TECNICOS", "EMAIL", "TECNICO_ID")
```

Cree dos acciones **Data: set the values of some columns in this row**:

| Acción | Condición de visibilidad | Valores |
| --- | --- | --- |
| Iniciar instalación | `AND(IN([ESTADO], {"PLANIFICADA", "ASIGNADA"}), ISBLANK([HORA_INICIO_REAL]))` | `HORA_INICIO_REAL = NOW()`, `ESTADO = "EN_EJECUCION"` |
| Terminar instalación | `AND([ESTADO] = "EN_EJECUCION", ISNOTBLANK([HORA_INICIO_REAL]), [CAPACITACION_OK] = "SI")` | `HORA_FIN_REAL = NOW()`, `DURACION_REAL_MIN = TOTALMINUTES(NOW() - [HORA_INICIO_REAL])`, `ESTADO = "COMPLETADA"`, `ACTUALIZADO = NOW()` |

Permita confirmar `CAPACITACION_OK` antes del cierre. Las acciones directas sirven para la presentación; no generan `MARCAS_TIEMPO` ni cierre automático del requerimiento. No combine escrituras directas y llamadas al backend para la misma acción.

Para el flujo completo, configure un bot con [webhook JSON POST de AppSheet](https://support.google.com/appsheet/answer/11511244?hl=en) hacia una implementación accesible por ese bot, sin cambiar previamente el estado de la OT:

```json
{"accion":"iniciarOT","token":"TOKEN_DEL_SERVIDOR","otId":"<<[OT_ID]>>","tecnicoId":"<<[TECNICO_ID]>>"}
```

```json
{"accion":"finalizarOT","token":"TOKEN_DEL_SERVIDOR","otId":"<<[OT_ID]>>","tecnicoId":"<<[TECNICO_ID]>>","realizada":true,"capacitacionOk":true}
```

Dispare el segundo bot solo tras confirmar capacitación. Guarde el token en el bot, no en filas descargables por técnicos. Verifique `datos.ok` y `datos.mensaje`: ContentService no establece códigos HTTP personalizados. Una web con inicio de sesión Google no admite automáticamente un webhook sin sesión; configure un endpoint separado o puente autorizado, sin hacer público el panel. [Call a script](https://support.google.com/appsheet/answer/11997142?hl=en) requiere proyecto independiente: esa tarea no admite scripts vinculados a hojas. El bot, permisos y sincronización se configuran en AppSheet; el repositorio no los crea.

## Validación y sincronización

```powershell
node tests/demo.cjs
cd apps-script
clasp status
clasp push
```

La prueba verifica sintaxis `.gs`/HTML, los 33 equipos asignados, capacitación, pasajes en transferencias, replanificación, inicio/cierre, token y confirmación/invalidez de rutas con proveedor simulado. No consume APIs ni sustituye probar en Google. El escenario base probado (2026-W38) produce 10 despachos, 23 OT y $1.648.000 de transferencias referenciales. Cambia al ajustar rutas, tarifas y dotación.

`apps-script/.clasp.json` guarda la vinculación local y no se versiona. `.local-backup/` conserva el código remoto anterior cuando se realiza respaldo; tampoco se publica.
