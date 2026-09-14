# Plan de acción — Planilla funcional con Apps Script y AppSheet

Fecha: 14-09-2026. Documento rector: [PROMPT Planilla Funcional AppsScript AppSheet.md](PROMPT%20Planilla%20Funcional%20AppsScript%20AppSheet.md).

La nueva operación tendrá una sola fuente de datos: el spreadsheet. El supervisor trabajará en sus hojas y en el menú «⚙ Servicio Técnico»; los técnicos trabajarán en AppSheet sobre esas mismas tablas. Todo componente anterior que no contribuya a este funcionamiento se retirará después de migrar y verificar sus datos.

Ejecución iniciada por autorización del usuario. El [checklist detallado de continuidad](ESTADO_IMPLEMENTACION.md) registra lo implementado, las pruebas, los cambios remotos y lo que falta. La nueva implementación está preparada localmente; el proyecto remoto conserva su aplicación anterior más una función temporal para respaldar el libro. El corte y la eliminación esperan inventario y respaldo verificados.

## 1. Resolver primero las contradicciones del requerimiento

No se debe programar un motor que fuerce los números de aceptación. La prioridad propuesta es: reglas de negocio explícitas, itinerario detallado, resultados derivados y, finalmente, cifras de referencia. Registrar las correcciones en una especificación conciliada sin alterar silenciosamente el prompt original.

| Tema | Hallazgo | Decisión propuesta |
|---|---|---|
| Cantidad de hojas | Se anuncian 11, pero se enumeran 12 contando CONFIG. Se exige además LEEME_APPSHEET. | Crear las 12 hojas funcionales y LEEME_APPSHEET; añadir únicamente tablas auxiliares justificadas. |
| Órdenes | El itinerario contiene 14 jornadas de cuadrilla. Con dos técnicos son 28 órdenes, no 36. | Mantener una orden por técnico y día: 28 órdenes y 476 ítems de checklist. Si se requieren 36, primero hay que definir las jornadas que faltan. |
| Traslados | Hay dos jornadas exclusivamente de traslado: C1/D1 y C3/D3. | Son cuatro órdenes personales de traslado, no tres. Admiten cierre sin instalación ni firma de cliente. |
| Varias comunas | Una orden diaria solo tiene un ID_Destino, pero algunas jornadas atienden dos o tres comunas. | Incorporar VISITAS, con ID estable, jornada de cuadrilla, secuencia, origen, destino, equipos, kilómetros, peajes y tiempos. ORDENES resume esa jornada para cada técnico. |
| Rutas | Las distancias desde la base no determinan los trayectos Copiapó–Coquimbo ni los circuitos entre comunas. | Completar una matriz de tramos con origen y procedencia explícitos antes de validar kilómetros y costos. No restar distancias radiales como sustituto de rutas. |
| Combustible | 3.954 / 20 × 1.381 = $273.023,70, no $273.026. | Calcular con precisión completa y redondear únicamente en los puntos definidos. |
| Transferencias | El subtotal publicado × 1,10 da $1.475.128,60, no $1.489.000. Los importes individuales publicados sí suman $1.489.000. | Recalcular cada beneficiario y definir redondeo al millar: propuesta, hacia arriba por técnico; sumar después la nómina. No prometer $1.489.000 sin un desglose que lo produzca. |
| Sobretiempo | Copiapó ocupa 8,888… h a ambos técnicos. La fórmula da dos órdenes con sobretiempo y aproximadamente $9.533,33 en total. | Mostrar una jornada de cuadrilla y dos jornadas personales afectadas. No redondear las horas antes de costear. |
| Capacitación | «Solo primera orden» puede quitar tiempo trabajado al segundo técnico. | Registrar una sesión por visita inicial a la comuna; imputar su duración a los técnicos participantes sin duplicar el contador de sesiones. |
| Planificado y ejecutado | La semilla describe un plan, pero aceptación y tablero hablan de instalaciones ya realizadas. | Separar equipos previstos de equipos realmente instalados y transferencias previstas de transferencias efectuadas. La semilla no debe fingir ejecución. |
| CONFIG | Se prohíben números externos, pero se necesitan semillas, índices y constantes técnicas; también falta el umbral documental de 30 días. | Centralizar parámetros de negocio en CONFIG, incluidos redondeo, calendario y avisos. Catálogos y datos operativos van en sus tablas. Las constantes estructurales no son parámetros económicos. |
| Origen | Solo se permiten PDF/JEFATURA/SUPUESTO, pero se usa «calculado». | Mantener las tres etiquetas y documentar «derivado por fórmula» en Nota, indicando el origen de sus entradas. |

Los nombres del semáforo se pueden conservar por fidelidad al requerimiento. Su cálculo expresa límites configurados; no constituye por sí mismo una certificación de cumplimiento laboral.

**Salida de esta etapa:** diccionario de datos, itinerario por tramos y cuadro de aceptación corregido, con trazabilidad de cada diferencia. Esta etapa bloquea la fijación de totales monetarios definitivos, pero no el diseño de hojas y módulos.

## 2. Qué se conserva, reemplaza y elimina

| Componente actual | Acción y condición |
|---|---|
| `v2/apps-script/04_Motor.gs` | Reutilizar solo funciones puras compatibles después de probarlas. Reemplazar supuestos de dotación, transporte y transferencias que difieran del prompt. |
| Lectura de CONFIG, validaciones, formatos y PDF de `v2/apps-script/` | Adaptar las piezas útiles a los nuevos esquemas. No trasladar módulos completos por comodidad. |
| Datos de destinos, técnicos, flota e implementos | Conciliar con el prompt; importar datos reales existentes con sus identificadores y procedencia. |
| Web de `v2`: Index, Scripts, Estilos, Editor, Ayuda, API, sesiones y agenda web | Retirar al completar el reemplazo por hojas, menú y AppSheet. El único HTML necesario será el diálogo de agenda y las plantillas de documentos. |
| Comparadores de bus, avión, taxi y escenarios alternativos | Eliminar del flujo activo y del código final: no forman parte del alcance pedido. |
| `appsheet/generar.cjs` y `appsheet/csv/` | Retirar como fuente de operación al conectar AppSheet directamente al spreadsheet. Usar únicamente como insumo de contraste durante la migración. |
| `appsheet/README.md` | Reescribir con los nombres, relaciones, permisos, acciones y automatizaciones definitivos. |
| README, CLAUDE.md y documentación de v2 | Sustituir instrucciones incompatibles. CLAUDE.md actualmente describe una arquitectura anterior y tiene cambios locales: conservarlos durante la conciliación. |
| Informes y presentaciones | Regenerar si siguen siendo entregables necesarios; retirar versiones con cifras o arquitectura obsoletas. Conservar el PDF original como evidencia del caso. |
| `.local-backup`, carpetas vacías y restos de versiones | Limpiar después del respaldo y del inventario de dependencias. No tratar configuraciones de herramientas personales como funcionalidad del producto. |
| Configuración local de clasp | Comprobar qué proyecto corresponde al spreadsheet actual antes de sincronizar. No publicar identificadores ni credenciales. |

La eliminación será efectiva en el repositorio y en el sistema publicado, no solo una ocultación de pestañas. Antes se conservará una copia fechada del libro y del código, fuera del despliegue activo. Los datos históricos útiles pasarán a un archivo consultable; no se eliminarán por tener un formato antiguo.

## 3. Arquitectura que se implementará

```text
Supervisor → Hojas + menú + diálogo de agenda
                         ↓
                  Apps Script → Motor puro
                         ↓
                  Google Spreadsheet
                         ↕
                      AppSheet → Técnicos
```

Una única carpeta canónica `apps-script/`, con los once módulos solicitados: `Codigo.gs`, `Setup.gs`, `Semilla.gs`, `Motor.gs`, `Autoasignar.gs`, `Ordenes.gs`, `Correos.gs`, `Flota.gs`, `Cierre.gs`, `AppSheet.gs` y `Pruebas.gs`. Se añadirán `appsscript.json` y el HTML indispensable. Al finalizar no coexistirán motores activos v1/v2/nuevo.

Hojas: CONFIG, DESTINOS, TECNICOS, CAMIONETAS, ORDENES, IMPLEMENTOS, CHECKLIST, GASTOS, CALENDARIO, AGENDAR, TRANSFERENCIAS y TABLERO; LEEME_APPSHEET como guía y VISITAS para resolver los recorridos múltiples. Los cierres históricos se generan aparte. Cualquier tabla técnica adicional deberá tener una necesidad documentada.

Definir por columna quién puede escribir: supervisor, motor, fórmula o técnico. El recálculo escribirá exclusivamente bloques de columnas calculadas; nunca una fila completa que incluya firmas, fotografías, observaciones o hitos. Las fórmulas exigidas en TECNICOS y en las columnas de control se conservarán como fórmulas.

VISITAS será la fuente para contar los 33 equipos y las 16 comunas sin duplicarlos por cada técnico. La capacitación y las evidencias de jornadas con varias comunas se asociarán a la visita correspondiente, con vínculos visibles desde las órdenes.

## 4. Etapas de implementación y puertas de salida

### Etapa A — Inventario y respaldo del sistema real

1. Identificar spreadsheet, proyecto vinculado, despliegues, activadores y aplicación AppSheet existentes.
2. Inventariar hojas, fórmulas, rangos, IDs, filas, permisos, archivos asociados y datos de ejecución.
3. Crear copia fechada del libro y respaldo del código remoto antes de sobrescribir.
4. Preparar un mapeo antiguo → nuevo y clasificar datos migrables, históricos y descartables.

**Se termina cuando:** el respaldo puede abrirse y se conoce el destino de cada conjunto de datos. No basta con tener los archivos locales.

### Etapa B — Hojas base y semilla coherente

1. Construir esquema, CONFIG con rangos por nombre y parámetros derivados.
2. Aplicar locale es-CL, zona America/Santiago, CLP y fechas dd-mm-yyyy.
3. Crear tablas planas con encabezado único, validaciones, filtros y protecciones compatibles con AppSheet.
4. Cargar destinos, diez técnicos, seis vehículos, diecisiete implementos e itinerario conciliado.
5. Separar «instalar lo faltante» de «restaurar datos». Restaurar requiere confirmación; recalcular nunca resembra.

**Se termina cuando:** ejecutar instalación dos veces no duplica hojas, rangos, IDs ni datos, y cargar demo no se confunde con migrar producción.

### Etapa C — Motor y conciliación económica

1. Calcular recorridos, jornadas, instalaciones paralelas y sesiones de capacitación.
2. Validar técnico activo, conductor con licencia, vehículo disponible, ausencia de solapamientos y topes de jornada y conducción.
3. Cobrar vehículo una sola vez por jornada; estipendio y hotel por técnico y día. Definir expresamente jornada mixta RM/fuera RM y días de regreso.
4. Calcular por separado presupuesto, transferencia, reserva, desgaste, horas extra y gasto real; impedir sumar dos veces reserva o anticipos.
5. Actualizar ORDENES, fórmulas de TECNICOS, CALENDARIO, TRANSFERENCIAS y TABLERO sin alterar campos manuales ni ejecución.
6. No convertir recalcular nómina en marcar pagos realizados. Preservar estados, fechas y montos realmente transferidos.

**Se termina cuando:** cada peso y cada hora tienen un desglose reproducible por visita, vehículo y técnico. El cuadro de aceptación deriva del motor y de verificaciones independientes.

### Etapa D — Operación del supervisor

1. Implementar exactamente el menú pedido y los cuatro gráficos nativos.
2. Hacer que AGENDAR y el diálogo consulten las mismas reglas: simular no escribe órdenes; confirmar revalida disponibilidad y crea IDs.
3. Proponer asignaciones con motivo y confirmar antes de aplicarlas; comprobar también el impacto sobre la cuadrilla.
4. Generar PDF por técnico, órdenes en lote y CSV de transferencias. No inventar cuentas bancarias.
5. Implementar revisión de gastos, flota y cierre semanal protegido; impedir cierres duplicados y documentar qué pasa con rendiciones tardías.
6. Implementar correos con destinatario y enlace revisables, registro de envío y prevención de duplicados. Las pruebas usarán destinatarios de prueba, sin enviar a clientes ficticios.

**Se termina cuando:** todos los ítems producen su resultado real y el supervisor puede demostrar la operación desde Sheets.

### Etapa E — AppSheet y procesamiento de cambios

1. Conectar las tablas directamente al mismo libro, con referencias por ID y columnas editables delimitadas.
2. Añadir Email también a GASTOS, además de ORDENES y CHECKLIST. Derivarlo de la asignación; el técnico no puede cambiar propietario ni técnico referenciado.
3. Exigir inicio de sesión y filtros de seguridad por usuario. Revisar TECNICOS: ser de solo lectura no impide revelar horas, saldos o datos de compañeros. Limitar sus filas o exponer un catálogo sin datos privados.
4. Crear las seis vistas, checklist, rendición con boleta, firma y foto; incorporar el detalle de VISITAS con el mismo aislamiento por asignación.
5. Configurar acciones secuenciales, con excepciones expresas para traslado, cancelación y varias instalaciones en el mismo día.
6. Resolver IDs de gastos sin carreras: para captura sin conexión usar una clave estable generada por el cliente y un folio correlativo asignado al sincronizar. Un correlativo calculado como MAX+1 no es seguro para varios teléfonos.
7. Registrar hora capturada en el dispositivo y hora de recepción/validación del servidor cuando sea necesario. No presentar una marca tomada sin conexión como hora certificada del servidor.
8. Regenerar checklist por combinación estable de orden e implemento, conservando marcas ya realizadas.

**Corrección técnica obligatoria:** no confiar en `onChange` para detectar escrituras de AppSheet. Google documenta que las ejecuciones de scripts y solicitudes API no disparan activadores instalables. Propuesta inicial: procesador periódico de pendientes con intervalo en CONFIG y ejecución manual desde el menú; los procesos diarios reutilizan ese procesador. El correo por salida se envía tras sincronizar y procesar, con la demora visible. [Documentación de activadores](https://developers.google.com/apps-script/guides/triggers/installable).

Si el correo debe salir inmediatamente después de sincronizar, evaluar un bot de AppSheet que invoque Apps Script: esa integración requiere un script independiente, no el vinculado al libro. Resolver esa dependencia y la disponibilidad en la cuenta antes de elegirla; evitar duplicar el motor entre proyectos. [Automatización con Apps Script](https://support.google.com/appsheet/answer/11997142?hl=en).

LockService serializará los procesos de Apps Script, pero no bloquea las escrituras externas de AppSheet. Complementarlo con propiedad de columnas, procesamiento idempotente y verificación de cambios. Los activadores diarios operarán en ventanas alrededor de 07:00 y 20:00, sin prometer puntualidad al minuto. La instalación de activadores no creará duplicados.

**Se termina cuando:** dos cuentas reales ven exclusivamente sus datos, sincronizan sin perder evidencias y repetir el procesamiento no duplica correos, gastos ni checklist. [Filtros de seguridad de AppSheet](https://support.google.com/appsheet/answer/10104977?hl=en).

### Etapa F — Validación completa y ensayo

`Pruebas.gs` tendrá pruebas del motor y verificaciones del libro. Las funciones puras también podrán probarse localmente sin dependencias de producción.

| Prueba | Resultado exigido |
|---|---|
| Integridad | 33 equipos previstos, 16 comunas, 10 técnicos, 6 vehículos y 17 implementos; IDs únicos y referencias válidas. |
| Jornadas | 28 órdenes y 476 ítems si se mantiene el itinerario actual; conteos corregidos documentados. |
| Reglas | Primera capacitación, tres comunas en un día, instalación paralela, jornada mixta y traslado puro calculados correctamente. |
| Dinero | Sin duplicación de combustible, peajes, viáticos ni hotel; suma de nómina igual al total mostrado. |
| Restricciones | Detectar doble asignación, conductor sin licencia, vehículo en taller y excesos de jornada/conducción. |
| Conservación | Recalcular y regenerar no cambia firmas, fotos, hitos, revisiones de gastos ni pagos registrados. |
| Recuperación | IDs inexistentes, datos inválidos y fallos parciales producen errores accionables; reintentar no duplica efectos. |
| AppSheet | Dos usuarios, trabajo sin conexión, sincronización, gastos, checklist y retorno correcto al tablero. |
| Rendimiento | Recálculo del caso de demostración menor a 30 segundos en el libro real, medido. |
| Operación | PDF accesible, CSV correcto, alerta real de flota, correo de prueba único y cierre protegido. |

Apps Script no ofrece una transacción global para todas las hojas. Validar antes de escribir, trabajar por bloques y preparar recuperación de una escritura parcial. No prometer atomicidad solo por usar LockService.

### Etapa G — Migración, corte y eliminación

1. Ensayar la migración completa sobre una copia del spreadsheet actual.
2. Comparar conteos, relaciones, ejecución histórica, montos y archivos asociados con el origen.
3. Programar una ventana breve sin ediciones ni sincronizaciones pendientes; tomar respaldo final.
4. Aplicar la migración al spreadsheet que seguirá en uso y reconectar/regenerar el esquema de AppSheet.
5. Desactivar activadores y despliegues anteriores para que no reescriban hojas ni envíen correos duplicados.
6. Ejecutar las pruebas y una jornada completa desde un teléfono.
7. Eliminar hojas, archivos, código, CSV y documentación incompatibles según el inventario. No mantener una segunda arquitectura activa.
8. Reescribir README con instalación, uso diario, recuperación y ubicación del respaldo.

**Reversión:** si falla integridad, aislamiento de usuarios o conservación de ejecución, detener escrituras nuevas, guardar los cambios recibidos durante el corte y restaurar código, datos y conexión previa. Conciliar esos cambios antes de reabrir la operación.

## 5. Orden de trabajo y definición de terminado

Orden: conciliación del requerimiento → inventario/respaldo → hojas/semilla → motor → menú y documentos → AppSheet → ensayo de migración → corte → eliminación final.

No fijar una fecha de entrega sin revisar el libro y la cuenta AppSheet. El trabajo de cálculo y estructura se puede completar localmente; permisos, sincronización móvil, tiempos reales y despliegue requieren validación en Google.

El proyecto estará terminado cuando el spreadsheet actual opere con este modelo, AppSheet complete una jornada real de prueba, la nómina cuadre con su desglose, las pruebas pasen y el sistema anterior haya sido retirado. Los totales contradictorios del prompt deberán quedar corregidos y explicados, nunca disimulados con valores escritos a mano.
