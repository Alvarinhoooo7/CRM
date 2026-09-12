# Servicio Técnico en Ruta

Web de planificación para **33 equipos en 16 localidades**, con **10 técnicos y 6 camionetas Peugeot Partner**. Google Sheets guarda los datos y Apps Script calcula trayectos, jornadas, costos y órdenes de servicio.

**Versión vigente: `v2/apps-script/`, versión 2.1.0.** Se depuró la raíz eliminando las carpetas heredadas de v1 (`apps-script/`, `docs/`, `tests/`) para evitar conflictos de sincronización y mantener una base limpia.

Esta guía está escrita para los cuatro expositores. Leer primero las secciones 1–5 y luego practicar con el **[guion de presentación](v2/docs/PRESENTACION.md)**. Para entender el código, consultar la [arquitectura](v2/docs/ARQUITECTURA.md).

## 1. Qué pide el caso

Fuente: [Estudio de caso 1.pdf](Estudio%20de%20caso%201.pdf). El nombre del archivo dice «1», pero contiene la planificación inicial y el **caso 2 de gestión tecnológica**. La última página permite cuatro expositores, establece una presentación de 15 minutos y pide informe PDF para el 14-09-2026.

| Requisito | Dónde se demuestra |
| --- | --- |
| Asignar 10 técnicos y 6 camionetas | Planificación, Rutas y flota, Técnicos |
| Instalación de 2 horas por equipo | Motor de trabajo en sitio e itinerario |
| Capacitación de 30 minutos por equipo | Escenario inicial **Literal del enunciado** |
| Rendimiento de 20 km/L | Presupuesto de combustible |
| Calcular trayectos y peajes | Maps, catálogo y desglose de plazas |
| Considerar alojamiento y alimentación | Noches por tramo, hotel y viático diario |
| Determinar dinero necesario por técnico | Gastos → Transferencia por técnico |
| Consultar ruta, implementos, hotel y camioneta | Orden de servicio y PDF |
| Proponer y justificar una mejora | Comparación de escenarios y transporte |

**Los grupos de tres del enunciado corresponden al trabajo académico.** Organizar también a los técnicos en cuadrillas de tres es una decisión nuestra; no es una exigencia textual sobre la dotación. Los cuatro estudiantes presentan una operación de diez técnicos: son grupos distintos.

| Localidad | Equipos | Localidad | Equipos |
| --- | ---: | --- | ---: |
| Copiapó | 5 | Pudahuel | 3 |
| Coquimbo | 2 | Maipú | 3 |
| La Calera | 1 | Curicó | 1 |
| San Antonio | 2 | Talca | 3 |
| Melipilla | 2 | San Pedro de la Paz | 1 |
| Lo Barnechea | 3 | Penco | 1 |
| Puente Alto | 1 | Tomé | 1 |
| Santiago | 3 | Santa Juana | 1 |
| **Total** | **33** | **Localidades** | **16** |

Las claves internas de algunas localidades no llevan tildes: `Copiapo`, `Maipu`, `Tome`. Se conservan para relacionar las tablas; la búsqueda admite tildes.

## 2. Funcionamiento de principio a fin

La coordinación ingresa un plan, revisa sus resultados y entrega una orden a cada técnico. **El motor evalúa las filas ingresadas; no genera automáticamente un óptimo global.** Las comparaciones de transporte y hotel/sobretiempo no cambian por sí solas el plan.

1. Ingresar con el correo y clave de demostración configurados en el servidor.
2. Abrir **Planificación** y revisar direcciones, hotel, material de capacitación, tramos y parámetros.
3. Guardar el formulario modificado. Guardar cambia las hojas; los resultados todavía muestran el cálculo anterior.
4. Pulsar **Recalcular**. Se leen las hojas, se resuelven rutas y se ejecutan ambos escenarios.
5. Revisar **Resumen** y corregir las alertas de error antes de comprometer la salida.
6. Revisar **Gastos**: total de operación y monto propuesto para cada técnico.
7. Abrir **Orden de servicio**, seleccionar técnico y revisar ruta, vehículo, hotel y checklist.
8. Exportar el PDF en Drive o descargar el itinerario CSV en **Rutas y flota**.

### Las diez pantallas

| Pantalla | Información y acciones |
| --- | --- |
| Resumen | Equipos planificados, gasto, días, utilización, km, hotel, alertas y comparación de escenarios |
| Rutas y flota | Cuadrillas, conductor, tramos, fuentes y camionetas; búsqueda por localidad/técnico, filtro diario, enlaces Maps y CSV |
| Gastos | Categorías, localidades, composición del presupuesto y transferencias |
| Técnicos | Tabla ordenable de carga, viaje, trabajo en sitio y ficha individual |
| Calendario | Horas asignadas y holgura por día; simulación de una visita independiente |
| Transporte | Comparación referencial de modos y decisión autopista/desvío |
| Peajes | Catálogo, secuencias por localidad y estado estimado/verificado |
| Orden de servicio | Ruta del técnico, hotel, camioneta, conductor, monto y materiales; exportación a PDF |
| Planificación | Edición de destinos, tramos y parámetros con validación en servidor |
| Guía del equipo | Recorrido de 15 minutos y respuestas a preguntas frecuentes |

El técnico T10 queda de reserva en la siembra. Su orden no inventa tramos ni viáticos. Elegir un técnico es un filtro del panel compartido, **no autenticación individual**.

Las casillas de materiales de la orden sirven para verificar la salida mientras esa vista está abierta. No registran inventario ni entrega persistente: se reinician al regenerar la orden. La web tampoco registra instalaciones finalizadas ni realiza transferencias bancarias.

## 3. Plan inicial y escenarios

La siembra contiene **23 tramos en cinco días de operación**:

| Cuadrilla | Técnicos | Vehículo | Circuito |
| --- | --- | --- | --- |
| C1 | T01–T03 | V1 | Coquimbo → Copiapó → Coquimbo → La Calera → base |
| C2 | T04–T06 | V2 | Curicó → Talca → Santa Juana → San Pedro de la Paz → Penco → Tomé → base |
| C3 | T07–T09 | V3 | RM, Melipilla y San Antonio, con regreso diario |

V4–V6 quedan sin asignación. La base de siembra es INACAP Santiago Sur, Av. Vicuña Mackenna 3864, Macul. Direcciones de clientes y hoteles son referencias demostrativas que deben confirmarse para operar.

La fecha inicial de operación es **21-09-2026**; no debe confundirse con la entrega académica del 14-09-2026. El calendario omite fines de semana cuando está habilitado y los feriados cargados en CONFIG.

| Aspecto | Literal del enunciado | Mejora propuesta |
| --- | --- | --- |
| Identificador | `LITERAL_PDF` | `OPERACION_REAL`, nombre interno heredado |
| Capacitación | 30 minutos por equipo | 15 minutos por localidad |
| Sesiones | 33 | 16 |
| Tiempo de sesiones | 16,5 horas | 4 horas |
| Condición | Requisito base | Preparación digital previa, propuesta por validar |

**La diferencia es 12,5 horas de sesiones, no 12,5 horas-persona.** El motor contabiliza la permanencia de toda la cuadrilla; con tres técnicos, la diferencia es 37,5 horas-persona. No supone que los tres impartan capacitación, sino que permanecen asignados.

Ambos escenarios usan las mismas filas de PLAN. Si el literal supera una jornada, hay que redistribuir los tramos. Elegir la mejora para ocultar esa alerta no demuestra cumplimiento del PDF. Los antiguos totales monetarios del README no se consideran resultados vigentes: dependen de las rutas, el escenario y la hoja actual.

## 4. Fórmulas para explicar el presupuesto

### Trabajo en sitio

Se supone que cada técnico puede instalar un equipo de forma independiente. Es una hipótesis de paralelización del modelo.

```text
Instalación = techo(equipos / técnicos presentes) × 2 horas
Capacitación literal = equipos × 0,5 horas
Tiempo en sitio = instalación + capacitación
Horas del tramo = viaje + tiempo en sitio
Horas-persona = horas del tramo × técnicos presentes
```

Ejemplo: cinco equipos con tres técnicos requieren dos tandas, es decir **4 h de instalación**. La capacitación literal suma **2,5 h**. La visita ocupa **6,5 h**, más viaje. La mejora propuesta reduce esa visita a 4,25 h más viaje.

Solo la **primera visita** a una localidad ejecuta el trabajo. Volver por Coquimbo para dormir o retornar a base no duplica equipos. El modelo no reparte automáticamente una localidad entre varias visitas.

### Traslado, hotel y viático

```text
Litros = km del tramo / 20
Combustible = litros × precio del diésel
Desgaste = km × costo de desgaste por km
Hotel individual = noches × técnicos × tarifa
Hotel compartido = noches × techo(técnicos / 2) × tarifa de habitación
Viático = días desplegados del técnico × tarifa diaria
```

La referencia es **$25.000 por técnico-día, incluida alimentación**, y **$50.000 por noche individual**. Son decisiones del modelo, no cotizaciones. Un técnico con cuatro tramos el mismo día recibe un solo viático.

El peaje usa las plazas del catálogo local 2026 y ajustes. En corredor común se consideran las plazas que diferencian ambos extremos; entre corredores distintos se aproxima pasando por base. **Una plaza pagada de ida no queda gratis al regreso:** cada cruce vuelve a costearse. Un cero entre dos localidades puede significar que el catálogo no incluye una plaza entre ellas y debe contrastarse con la ruta real.

El desvío sin peajes se compara por combustible, desgaste y tiempo adicional, con límites de desvío y ahorro mínimo. Maps y una secuencia estimada no equivalen a una auditoría de TAG.

### Jornada y sobretiempo

Se suman horas por cuadrilla y día. El semáforo usa la jornada efectiva, contractual y extra permitida; los valores de siembra son 7,4 h, 8,4 h y hasta 2 h adicionales. Son umbrales del modelo académico: **no certifican cumplimiento laboral**.

```text
Horas extra = máximo(0, horas de la jornada − jornada contractual)
Costo extra = horas extra × técnicos × costo hora × recargo
```

La comparación con hotel orienta la decisión, pero no cambia las noches de PLAN. El control heredado llamado «semanal» acumula extra sobre el período completo: para períodos de más de una semana debe revisarse por semana real.

### Total operativo frente a transferencia

```text
Subtotal operativo = combustible + peajes + desgaste + pasajes + flete
                  + arriendo + conexiones + hotel + viáticos
Reserva operativa = redondear(subtotal operativo × porcentaje de imprevistos)
Total operativo = subtotal operativo + sobretiempo + reserva operativa

Base personal = viático + hotel + combustible + peajes pagados por el técnico
Reserva personal = redondear(base personal × porcentaje de imprevistos)
Transferencia = techo((base personal + reserva personal) / paso) × paso
```

La configuración decide cuáles de esos conceptos se adelantan al técnico. El TAG pagado por la empresa es costo operativo, pero no dinero que recibe el conductor. El combustible y peaje en efectivo se asignan al conductor o se prorratean. Rotar conductor puede cambiar cuánto recibe cada integrante.

**La suma de transferencias no tiene por qué coincidir con el total operativo:** desgaste, gastos empresariales, sobretiempo y redondeo explican la diferencia. La nómina ordinaria completa no está incluida; el presupuesto no es un estado de resultados contable.

El editor operativo admite **camionetas**. Bus y avión son comparaciones referenciales. El costeo heredado de pasajes entre localidades y sus adelantos no cubre un circuito multimodal completo; no presentar esas alternativas como despachos o reservas ya ejecutables.

## 5. Datos y límites del sistema

| Dato | Origen | Interpretación |
| --- | --- | --- |
| Dotación, equipos, 2 h, 30 min, 20 km/L | PDF | Requisitos base |
| Cuadrillas, jornada, base y viático | Decisiones/supuestos | Deben justificarse |
| Km y tiempo | Maps de Apps Script, con caché | Estimación de viaje |
| Distancia de respaldo | Columnas de DESTINOS | Revisar fuente y alertas |
| Peajes | Catálogo local basado en documentos MOP | Verificar secuencia, horario y categoría |
| Hoteles y pasajes | Datos de referencia | No son reservas confirmadas |
| Horas y montos | Motor JavaScript | Resultados sobre las filas ingresadas |

Consultar la [guía de tarifas de camionetas](GUIA_TARIFAS_CAMIONETAS_2026.md). Los PDF fuente están en `../Valores Porticos, Peajes/`. Esta implementación no renovó cotizaciones comerciales.

La web planifica: **no confirma instalaciones realizadas, no envía capacitación, no controla stock, no reserva hoteles ni mueve dinero**. Las funciones de ejecución y AppSheet de v1 no se trasladaron a v2. Los indicadores dicen «planificados» por esa razón.

## 6. Instalación y sincronización con clasp

### Proyecto ya instalado

```powershell
# Desde CRM
node v2/tests/web.cjs
node v2/tests/interfaz.cjs
Set-Location v2/apps-script
clasp status
clasp push
```

`clasp status` debe incluir `08_Editor.gs` y `Editor.html`. Después de subir, actualizar la URL existente en **Implementar → Administrar implementaciones → Editar → Nueva versión → Implementar**.

`clasp push` sube archivos: no ejecuta funciones, no instala hojas y no actualiza por sí solo una implementación con versión fija. Referencia: [guía oficial de clasp](https://developers.google.com/apps-script/guides/clasp).

### Libro nuevo

1. Elegir la hoja de cálculo y abrir **Extensiones → Apps Script**.
2. Vincular `v2/apps-script/.clasp.json` al proyecto correcto y subir el código. La vinculación está excluida de Git.
3. En **Configuración del proyecto → Propiedades del script**, definir `ACCESO_EMAIL` y `ACCESO_CLAVE_INICIAL`, con una clave elegida de al menos 10 caracteres.
4. Ejecutar `configurarAcceso_`. Guarda el ID del libro, calcula el hash y elimina la propiedad de clave inicial.
5. Recargar la hoja y usar **Servicio Técnico → Crear o restaurar hojas base**.
6. Usar **Actualizar rutas con Google Maps** y **Recalcular y validar plan**. Revisar km, tiempos y alertas.
7. Abrir el panel desde el menú o crear una implementación de aplicación web. Mantener acceso limitado a las cuentas de la presentación cuando Google lo permita.

Subir código conserva la clave existente. No ejecutar la configuración de acceso para actualizar solo la interfaz. No hay una nueva clave predeterminada en el código.

**«Reinstalar desde cero» borra los datos de trabajo.** «Crear o restaurar hojas base» conserva hojas existentes; no garantiza reparar todos los rangos dañados de un libro antiguo. Revisar la estructura antes de reinstalar.

Las funciones internas ahora terminan en `_`, lo que impide su llamada directa desde el navegador. Los menús ya usan los nombres actualizados. Se mantienen tres hojas de trabajo visibles y auxiliares ocultas; consultar la arquitectura para su función.

### Vista previa sin Google

```powershell
node v2/tests/preview.cjs
```

Abrir `http://127.0.0.1:4173` con cualquier correo y clave de prueba. Usa **rutas sintéticas**, sin Google ni datos privados. Permite ensayar pantallas; guardar en Sheets y exportar en Drive están deshabilitados. No presentar esas cifras como el presupuesto real. `Ctrl+C` cierra el servidor.

## 7. Acceso y colaboración

El login entrega un token; cada endpoint de datos/escritura exige sesión. El navegador conserva el token en memoria y el servidor en caché por hasta seis horas. La caché puede expulsarlo antes. Recargar requiere volver a ingresar.

Las funciones internas no se exponen por RPC. Los campos se validan en servidor. El guardado de destinos y plan usa un bloqueo y una revisión del contenido: si otro integrante guardó primero, se rechaza el borrador antiguo. Evitar edición manual simultánea en Sheets: la edición directa de la hoja no respeta el bloqueo del script.

El acceso es compartido para coordinación y demo; no hay roles individuales. La propiedad heredada `MODO_ACCESO` **no implementa** por sí sola identificación Google por técnico. Producción requiere identidad y permisos individuales.

## 8. Verificación y estado de entrega

- `node v2/tests/web.cjs`: 18 comprobaciones del motor, escenarios, fechas serializadas, sesión, simulación y validación de planificación.
- `node v2/tests/interfaz.cjs`: diez pantallas y flujos con DOM/RPC simulados: enlace directo, búsqueda, estado vacío, reserva, escenarios y borrador.
- `ejecutarPruebas_` en Apps Script: diagnóstico contra la hoja vigente y sus rutas. Requiere ejecutarlo en Google.

**Pruebas locales ejecutadas y sincronización completada.** El proyecto se sincronizó exitosamente con Google Apps Script mediante `clasp push` desde `v2/apps-script/` sobre el proyecto vinculado.

Antes de presentar, completar los [pendientes de integración](v2/docs/PENDIENTES.md): login, Maps, guardado, escenarios y PDF en la cuenta del equipo.

## 9. Material para los cuatro integrantes

- [Guion de 15 minutos y preguntas](v2/docs/PRESENTACION.md).
- [Arquitectura y mantenimiento](v2/docs/ARQUITECTURA.md).
- [Pendientes de puesta en marcha](v2/docs/PENDIENTES.md).
