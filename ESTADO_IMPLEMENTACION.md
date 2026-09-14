# Continuidad — implementación de la planilla funcional

Actualizado: 14-09-2026. Estado: IMPLEMENTACIÓN LOCAL PREPARADA Y AJUSTADA CON DATOS REALES DEL LIBRO; MIGRACIÓN REAL PENDIENTE DE RESPALDO/AUTORIZACIÓN GOOGLE.

**Leer antes de actuar:** la nueva aplicación NO está desplegada. El proyecto remoto conserva v2 más una función temporal de respaldo. No ejecutar `clasp push` desde `apps-script/` todavía. No se han borrado hojas, datos ni versiones anteriores. El respaldo YA está hecho y verificado: el propietario ejecutó el puente el 14-09-2026 a las 10:12 y la copia pasó la comparación celda por celda.

## Autorización y reglas

- El usuario pidió ejecutar `PLAN_ACCION_PLANILLA_FUNCIONAL.md`, retirar lo incompatible y mantener este checklist detallado para continuidad.
- No declarar operativo en Google lo probado solo localmente. No eliminar el sistema anterior hasta respaldo y migración verificados.
- Preservar los cambios del usuario en CLAUDE.md y .obsidian. No versionar credenciales ni identificadores remotos.
- No enviar correos reales durante pruebas. Los envíos son acciones operativas con confirmación o configuración explícita.

## A. Requerimiento, inventario y respaldo

- [x] Leer prompt y plan autorizado; conciliar 28 órdenes, 476 checklist, 4 órdenes personales de traslado y 15 hojas totales.
- [x] Documentar decisiones y cifras en `docs/ESPECIFICACION_CONCILIADA.md`.
- [x] Identificar el proyecto remoto como «Evaluacion 1» con parentId de spreadsheet mediante Apps Script API. IDs privados en configuración local y `.local-backup/migracion-20260914/google.json`.
- [x] Enumerar siete despliegues existentes con `clasp deployments`; no eliminarlos aún.
- [x] Respaldar los 19 archivos remotos en `.local-backup/migracion-20260914/remoto/` mediante `clasp pull`.
- [x] Guardar CLAUDE.md del usuario en `.local-backup/migracion-20260914/CLAUDE.usuario.md`.
- [x] Crear `scripts/inventario-google.cjs`: usa sesión clasp sin imprimir tokens; intenta inventario y respaldo.
- [x] Comprobar límites reales: Sheets API devuelve 403 (API del cliente OAuth no habilitada); Drive devuelve 403 (sesión sin acceso concedido al archivo); `clasp run inventariarLibro` devuelve NOT_FOUND.
- [x] Crear `scripts/PrepararMigracion.gs`: función ejecutable desde el editor que copia el libro, exporta valores/fórmulas/rangos/activadores y compara la copia.
- [x] Subir únicamente el puente temporal junto al código original desde `.local-backup/migracion-20260914/preparacion/`. Se ampliaron scopes Drive y script.scriptapp; no se creó una nueva versión web.
- [x] Verificar por otra descarga a `verificacion-remota/` que los archivos originales siguen idénticos y el puente remoto coincide con el archivo local.
- [x] Recibir ejecución exitosa de `prepararMigracionPlanillaFuncional`. Ejecutada por el propietario el 14-09-2026 10:12: copia de respaldo verificada celda por celda, `inventario.json` exportado y carpeta creada. Enlaces en `.local-backup`. `clasp run` sigue sin servir (NOT_FOUND: cliente OAuth genérico, sin proyecto GCP ni despliegue de API ejecutable), así que toda ejecución futura también es manual.
- [x] Obtener y revisar el inventario completo. 25 hojas, 113 rangos con nombre y 0 activadores. La lectura por Drive venía incompleta en CONFIG (185 de 305 filas); el `inventario.json` del respaldo es la fuente autorizada. Documentado en `docs/INVENTARIO_LIBRO_REAL.md`.
- [x] Conciliar los 97 parámetros `P_*` del libro contra los de la implementación: `docs/CONCILIACION_PARAMETROS.md`. Los 97 quedan clasificados y el generador falla si alguno queda fuera. 4 parámetros incorporados, 2 defectos del libro diagnosticados, 4 decisiones a confirmar con el usuario y 13 criterios del libro todavía sin implementar.
- [ ] Identificar AppSheet existente, usuarios, licencia, carpetas de evidencias y activadores de otros propietarios.
- [x] Construir el mapeo real. Conviven dos sistemas: 5 hojas de la aplicación v2 con configuración del usuario (185 filas de CONFIG, 17 destinos, 84 tramos, 134 rutas en caché, 23 de bitácora) y 20 hojas del CRM v1 cuyo contenido coincide fila por fila con `.local-backup/05_Seed.js`. Esas 20 son demostración y está acreditado con evidencia, no supuesto. Lo que hay que conservar es la configuración de la parte v2.

## B. Base local y semilla

- [x] Crear once módulos GS + Agenda.html + appsscript.json en `apps-script/`.
- [x] Definir ESQUEMA central en Setup.gs: 12 hojas funcionales + VISITAS, ENVIOS y LEEME_APPSHEET.
- [x] Definir CONFIG con rangos por nombre, parámetros derivados, redondeo, plazos, calendario y activadores.
- [x] Implementar instalación que rechaza un esquema antiguo antes de escribir y conserva datos en instalaciones repetidas.
- [x] Implementar formatos CLP/fechas, validaciones, encabezados, filtros de tablas y protección de IDs.
- [x] Corregir checkbox: aplicar validación sin reinicializar valores. Corregir conservación del encabezado dinámico de CALENDARIO.
- [x] Sembrar 16 destinos/33 equipos, 10 técnicos, 6 vehículos (V6 reserva), 17 implementos y 14 jornadas de cuadrilla.
- [x] Usar tramos intercomunales explícitos rotulados SUPUESTO. Documentar cada estimación; no simular consulta Maps.
- [x] Sembrar gastos ficticios claramente rotulados, uno rechazado; correos deshabilitados y sin cuentas bancarias inventadas.
- [x] Rechazar carga de demo sobre tablas con datos.
- [ ] Comprobar en Sheets real protecciones, formatos, rangos, fórmulas y valores de casillas tras instalación repetida.
- [x] Sustituir los kilómetros y peajes supuestos por los del libro: caché `_RUTAS` de Google Maps y catálogo de plazas MOP de DESTINOS. `P_VEL_URBANA` 28→36, `P_VEL_R78` 80→69, `P_VEL_RUTA5` 90→80, calibradas con esa caché. Cada tramo declara su origen en `Origen_Dato`.
- [x] Incorporar `P_BASE` completa, `P_FACTOR_HORAS`=1,1, `P_CAPACIDAD_CAMIONETA`=3 y `P_HORAS_EXTRA_SEMANA`=10 desde el libro. `AGENDAR` ya no confunde dotación con capacidad del vehículo, y el motor alerta el tope semanal de horas extra por técnico.
- [ ] Completar el catálogo de plazas más allá de Curicó (Talca repite el peaje de Curicó; Santa Juana, Penco y Tomé comparten cifra) y consultar los dos tramos que siguen como SUPUESTO: Lo Barnechea → Puente Alto y Tomé → Santa Juana.
- [ ] Resolver con el usuario las 4 decisiones abiertas de `docs/CONCILIACION_PARAMETROS.md`: tamaño de cuadrilla (3 del libro contra 2 del plan), si la transferencia incluye combustible, si el viático exige pernoctación y el tope de días del plan completo.
- [ ] Decidir si los 13 criterios «sin implementar» y los 12 «cableados» del libro deben pasar a CONFIG, como manda CLAUDE.md.

## C. Motor, presupuesto y conservación

- [x] Motor puro sin servicios Google y sin mutar entrada: Motor.gs.
- [x] Validar IDs, cantidades, referencias, secuencias de tramos, conductor único y solapamiento de técnicos.
- [x] Alertar licencia ausente, vehículo en taller, doble uso de vehículo, exceso de jornada/conducción y rutas supuestas.
- [x] Calcular instalación paralela y capacitación una vez por comuna, imputando horas a ambos asistentes.
- [x] Cobrar vehículo una vez; viático por jornada fuera/mixta/regreso y hotel por persona.
- [x] Redondear nómina por técnico. Corregir caso de representación binaria que añadía un millar a $50.000 × 1,1.
- [x] Separar presupuesto, reserva, desgaste, horas extra, pagos realizados y rendiciones aprobadas.
- [x] Adaptador escribe únicamente columnas calculadas; conserva firmas, fotos, hitos, observaciones, estados y montos de pagos.
- [x] Generar fórmulas de ORDENES, TECNICOS, DESTINOS, flota y TRANSFERENCIAS.
- [x] Actualizar equipos pendientes/instalados desde VISITAS sin duplicar por técnico; verificación CONFIG rotulada como demo.
- [x] CALENDARIO con horas, disponibilidad, RM/fuera RM y capacidad libre diaria; comparación por día civil.
- [x] TABLERO con previsto frente a ejecutado, alertas y cuatro gráficos; costos por comuna incluyen prorrateo de traslados exclusivos.
- [ ] Evaluar numéricamente las fórmulas en Sheets y comparar sus sumas contra el motor.
- [ ] Medir recálculo real menor a 30 segundos; mocks locales no prueban rendimiento de Google.

## D. Flujos del supervisor

- [x] Menú con todos los ítems del prompt y despachadores.
- [x] AGENDAR en celdas: parámetros de entrada, fórmulas de tiempos/costos/pernocta y listas de técnicos/vehículos libres.
- [x] Diálogo Agenda.html: simular sin escribir, mostrar itinerario/costo/noches/recursos y confirmar explícitamente.
- [x] Agenda de varios días: separar traslado, instalación y regreso; verificar recursos en todas las fechas.
- [x] Rechazar viajes con escalas obligatorias o fines de semana hasta planificarlos expresamente.
- [x] Revalidar propuesta al confirmar. Registrar solicitud e IDs preparados para recuperar fallos sin duplicar órdenes/visitas/checklist.
- [x] Exponer `recuperarAgendasPendientes()` para completar escrituras parciales.
- [x] Proponer técnico por disponibilidad, licencia, afinidad de corredor planificado y carga; confirmar y conservar propiedad coherente del checklist.
- [x] PDF privado por técnico y lote, con rutas, vehículo, hotel, checklist y presupuesto.
- [x] CSV de nómina con escape de fórmulas; no marca transferencias como pagadas.
- [x] Revisión de flota, marcado en taller, alerta diaria con prevención de duplicación diaria.
- [x] Capacitación manual/automática con configuración explícita y registro ENVIOS. Resultado incierto no se reintenta ciegamente.
- [x] Cierre por semana indicada, validación de hitos, snapshot y protección; no sobrescribir cierres existentes.
- [ ] Verificar PDF generado y enlaces privados en Drive, descarga CSV y operación visual del menú/diálogo en Google.
- [ ] Probar una entrega real de correo a destinatario de prueba autorizado y reintentos con resultado incierto.
- [ ] Verificar cierres reales y definir/implementar ajustes posteriores antes de usar cierres recurrentes con rendiciones tardías.

## E. AppSheet

- [x] Validación de tablas planas, IDs y Email coherente en ORDENES/CHECKLIST/GASTOS.
- [x] Checklist estable por orden/implemento, conservando marcas al regenerar.
- [x] Procesador periódico con validación de secuencia, montos, comprobantes, propietario, folio y primera recepción del servidor.
- [x] Excepciones de hitos para traslado puro y ausencia de nueva capacitación; cierre de servicio verifica evidencias de cada visita.
- [x] Instalar tres activadores propios sin duplicarlos; no depender de onChange para escrituras API.
- [x] Generar LEEME_APPSHEET y redactar `appsheet/CONFIGURACION_FUNCIONAL.md` con claves, filtros, permisos, expresiones, acciones y vistas.
- [x] Separar hora de dispositivo y primera recepción del servidor, saldo de presupuesto y anticipo efectivamente pagado.
- [ ] Aplicar configuración en la cuenta AppSheet. No existe una app nueva creada/verificada por esta sesión.
- [ ] Comprobar filtros dependientes de VISITAS/ORDENES y protección de datos privados con dos cuentas reales.
- [ ] Configurar acciones secuenciales, vistas y almacenamiento de fotos/firmas en el editor.
- [ ] Probar tres comunas, conductor/acompañante, traslado sin firma, captura offline y sincronización.
- [ ] Verificar escrituras simultáneas reales. LockService NO bloquea a AppSheet; la protección proviene también de la propiedad de columnas.

## F. Pruebas y documentación

- [x] `node scripts/check-sintaxis.js`: 11/11 GS válidos.
- [x] `node tests/planilla.cjs`: 23 pruebas compartidas del motor y reglas; adaptador conserva campos; simulación sin escritura y tres días para viaje largo; estructura de 258 fórmulas principales.
- [x] `node tests/hojas.cjs`: instalación repetida, semilla no destructiva, recálculo/checklist conservan firmas/hitos/pagos, cuatro gráficos sin duplicados.
- [x] Inyectar fallo entre escritura de órdenes y visitas: reintento recupera seis órdenes originales sin duplicar y genera 612 checklist para 36 órdenes.
- [x] Revisar estructura de 791 fórmulas escritas en todas las hojas por el doble de Sheets.
- [x] Validar JavaScript del HTML, puente temporal y JSON del manifiesto.
- [x] `git diff --check` pasa; solo advertencias habituales LF/CRLF en archivos existentes.
- [x] Crear AGENTS.md de continuidad; actualizar README y appsheet/README con aviso de migración y rutas a documentación nueva.
- [x] Documentar operación/ensayo/corte/reversión en `docs/OPERACION_Y_MIGRACION.md`.
- [ ] Ejecutar `ejecutarPruebas()` en una copia real y guardar resultados.
- [ ] Las pruebas locales no evalúan la semántica de fórmulas Sheets ni permisos, conversiones PDF o filtros de AppSheet.

## G. Corte y eliminación — aún no ejecutados

- [ ] Crear copia de ensayo separada del respaldo verificado. El respaldo ya existe y está verificado; falta la copia donde se instalará la aplicación nueva.
- [x] Comprobar activadores antiguos: el inventario no encontró ninguno instalado, así que no hay disparadores que desactivar en el corte.
- [ ] Aplicar mapeo de migración real; conciliar datos e históricos contra origen.
- [ ] Probar todas las operaciones en copia con dos usuarios móviles.
- [ ] Preparar ventana de corte y respaldo final.
- [ ] Aplicar migración al spreadsheet que continuará en uso y subir implementación canónica.
- [ ] Autorizar servicios y conectar AppSheet definitivo.
- [ ] Desactivar activadores viejos y retirar despliegues web anteriores.
- [ ] Eliminar v2, generador/CSV y documentos/presentaciones incompatibles tras asegurar recuperación.
- [ ] Eliminar hojas obsoletas tras migración verificada. Todavía no hay inventario que permita decidir qué datos descartar.
- [ ] Sustituir la documentación histórica restante y actualizar CLAUDE.md sin perder cambios del usuario.
- [ ] Registrar aceptación y reversión comprobada. No marcar el plan completo mientras falte cualquiera de estas puertas.

## Próximo punto de continuación

1. El inventario y el mapeo ya están hechos con el libro real: ver `docs/INVENTARIO_LIBRO_REAL.md`. No volver a levantarlos ni tratar el contenido del libro como incógnita.
2. Sigue faltando **ejecución** en Google, no lectura. El propietario debe ejecutar `prepararMigracionPlanillaFuncional` desde el editor de Apps Script y autorizar los permisos nuevos. La función YA está subida: no pedir que la copie ni volver a subir toda la aplicación. `clasp run` no sirve mientras el proyecto no tenga proyecto GCP propio y despliegue de API ejecutable.
3. Con el respaldo verificado, crear la copia de ensayo, instalar ahí la aplicación nueva y recién entonces comprobar formatos, protecciones y evaluación numérica de las fórmulas.
4. Completar los datos que siguen incompletos en el libro: catálogo de plazas más allá de Curicó y los dos tramos sin consulta a Maps. No presentar esas cifras como verificadas.
5. Actualizar este checklist antes de compactar/finalizar, sin reiniciar el trabajo ya probado ni asumir éxito remoto.

## Evidencia y límites

- `git status` inicial: CLAUDE.md modificado por usuario; .obsidian/, prompt y plan sin seguimiento.
- No se ha modificado el contenido del spreadsheet ni enviado la implementación nueva. Solo se envió el puente temporal de respaldo, conservando v2.
- El itinerario original carece de distancias/peajes intercomunales. La demo deberá identificarlos como supuestos editables; no prometer los totales inconsistentes del prompt.
- Semilla actual, ya con datos del libro: 3.768,6 km, $118.325 peajes, $260.221,83 combustible, $590.000 viáticos y colación, $700.000 hotel, nómina $1.840.000 y costo total $2.088.077,88. Los kilómetros vienen de la caché de Maps del libro y los peajes del catálogo de plazas MOP; quedan dos tramos como supuesto. El problema de redondeo flotante está corregido y su regresión ahora prueba `redondearAnticipo_` directamente, sin depender de qué técnico tenga esa base.
- Los datos reales obligaron a corregir el itinerario de demostración: Copiapó son 812,2 km reales, 10,15 h al volante, sobre el tope de 9 h, y la ida se parte con pernocta en Coquimbo; Talca de ida y vuelta sumaba 10,72 h y se encadena con Curicó. El plan pasa de 4 a 5 días hábiles y de 28 a 30 órdenes.
- El libro en producción tiene tres defectos documentados: 66 de 134 consultas de Maps fallaron con `Cannot read properties of undefined (reading 'DRIVING')`, dos celdas de CONFIG muestran `#ERROR!`, y el catálogo de plazas no pasa de Curicó.
- `clasp deployments` funciona con regla aprobada; `clasp pull` necesitó escalamiento de red (aprobado). No se han borrado despliegues anteriores.
- La primera subida del puente se omitió por cambio de manifiesto; `--force` falló por BOM UTF-8 de PowerShell. Se reserializó con Node sin BOM, se subieron 20 archivos y se verificaron por descarga. Ese incidente está resuelto.
- No hay sesiones Codex Document Control conectadas. No se envió ningún correo real.
- No se creó commit; el trabajo está en el árbol local. No incluir `.local-backup`, `.clasp.json` ni .obsidian en un commit de implementación.
