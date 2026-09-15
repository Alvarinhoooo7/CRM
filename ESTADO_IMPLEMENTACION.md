# Estado de implementación

Actualizado: 15-09-2026. Bloque actual: auditoría de validaciones operativas y financieras completada localmente.

## Contexto preservado

- La aplicación actual vive en `demo/`. El diseño vigente está en `docs/superpowers/specs/2026-09-15-demo-local-crm-design.md`.
- Al iniciar, los documentos de migración, `apps-script/`, `scripts/` y las pruebas antiguas figuraban borrados por cambios anteriores. Se leyeron las versiones de HEAD del estado, plan y especificación, sin restaurar los módulos eliminados. Este documento registra la continuidad actual; el checklist histórico íntegro permanece en Git.
- No se modificaron CLAUDE.md, .obsidian, respaldos ni servicios remotos.
- La migración real a Google sigue sin demostrarse completa. La demo no acredita fórmulas Sheets, permisos, AppSheet, correo ni sincronización entre dispositivos.

## Bloque HTML: completado

- [x] Revisar los tres roles y el estado compartido.
- [x] Renovar superficies, tarjetas, formularios, tablas, navegación y estilos adaptables en `demo/css/estilos.css`.
- [x] Reemplazar el marco de teléfono estrecho por una interfaz del técnico que aprovecha escritorio y móvil.
- [x] Añadir prioridad a trabajos en curso, siguiente orden pendiente, filtros pendientes/cerradas/todas y pasos preparación/ruta/trabajo/cierre en `demo/js/05_tecnico.js`.
- [x] Agregar gráficos de estados de órdenes, avance de equipos, órdenes cerradas y carga horaria por técnico; gastos por estado, categoría y fecha en `demo/js/07_analitica.js`, cargado desde `demo/index.html`.
- [x] Rotular alcances de cada métrica, categorías sin registros y estados excluyentes. Los datos proceden del estado local.
- [x] Corregir desviación horaria para comparar trabajos cerrados con su propio plan en `demo/js/03_supervisor.js`.
- [x] Evitar acumulación de manejadores en supervisor, coordinador y técnico; limpiar eventos al cambiar de rol en `demo/js/06_app.js`.
- [x] Bloquear cambios de checklist tras iniciar; validar cantidad instalada, evidencias de instalación y propiedad/monto/comprobante de gastos en `demo/js/02_estado.js`.
- [x] Validar imágenes JPG/PNG/WebP de hasta 2 MB y avisar errores de lectura; usar teléfono del destino cuando exista; mostrar saldos negativos sin ocultar sobregiros.
- [x] Añadir regresiones de estado y agregaciones en `demo/pruebas-ui.cjs`.

## Validación

- [x] `node demo/pruebas.cjs`: 38 pruebas pasadas, 0 fallos.
- [x] `node demo/pruebas-ui.cjs`: bloqueos, cierre con/sin evidencia, gastos inválidos, estados de rendiciones y agregaciones vacías correctos.
- [x] Sintaxis de los ocho archivos JS comprobada con `vm.Script`.
- [x] Chrome automatizado: seis pestañas de supervisor, pestañas de coordinador, cambio de rol, checklist, inicio y rechazo de cierre de instalación sin evidencia; sin errores JS.
- [x] Capturas revisadas en escritorio y móvil 390 × 844; sin desbordamiento horizontal móvil. Contraste de pestañas corregido después de inspección.
- [x] `git diff --check -- demo`: sin errores; advertencias habituales de fin de línea.
- [x] Evidencia local de navegador y script exploratorio en `.tmp-ui/`, excluido de Git.
- Incidentes: inicio de Chrome bloqueado por sandbox (`spawn EPERM`), resuelto con permiso efectivo de ejecución. La primera aserción de cierre seleccionó un traslado puro, que legítimamente no exige evidencia; corregida para probar una instalación. No hubo operaciones ni errores remotos nuevos.
- Las pruebas históricas `scripts/check-sintaxis.js`, `tests/planilla.cjs` y `tests/hojas.cjs` no existen en el árbol actual y no fueron ejecutadas.

## Bloque de validaciones del 15-09-2026: completado

- [x] Catálogo de 16 regiones y 346 comunas en `00_comunas.js`; Ñuble separado por confirmación expresa. Curauma se trata como localidad de Valparaíso, no comuna.
- [x] Reglas centrales `08_reglas.js`: fechas, continuidad por técnico y vehículo, retorno a base, ocupación, licencia, dotación, pernocta, topes y protección de jornadas con registros.
- [x] Escrituras transaccionales en `02_estado.js`: rechazo sin cambios, errores visibles, permisos del rol y mensajes de éxito condicionados al resultado.
- [x] Constructor único de simulación/confirmación, destinos independientes por servicio y respeto a km/peajes ingresados. División ida-trabajo-retorno por fechas. Escalas no documentadas se bloquean.
- [x] Coordinador: formulario conserva borrador, invalida propuestas editadas, revalida al confirmar; calendario por arrastre y campo de fecha accesible; destinatario de capacitación ya no se reinicia al seleccionarlo.
- [x] Ejecución: bloqueo de etapas posteriores, total instalado de cuadrilla sin doble conteo, cierre consistente entre compañeros, duración prevista conservada al iniciar y evidencia protegida.
- [x] Finanzas: pagos con monto fijo, saldos individuales, reembolsos aprobados pendientes/pagados sin doble desembolso, comprobantes duplicados y revisiones repetidas rechazados.
- [x] Motor: horas extra por semana civil, sin recortar costos de excesos; prorrateo por comuna concilia retorno y reserva con total del plan.
- [x] Escenario `09_escenario.js`: 14 rendiciones sintéticas y cuatro anticipos, carga aditiva/idempotente, estados aprobados/pendientes/rechazados y emergencia. No sobreescribe evidencias existentes.
- [x] Retirados mensajes de demo de la interfaz, según instrucción posterior del usuario. Metadatos de origen y documentación conservan que el escenario es sintético.
- [x] Exportación sin RUT inventado y con neutralización de fórmulas CSV. Registro de avisos no envía correos.
- [x] Documentación detallada en `docs/VALIDACIONES_OPERATIVAS.md` y README actualizado.

### Pruebas de este bloque

- [x] `node demo/pruebas.cjs`: 38 aprobadas, cero fallos.
- [x] `node demo/pruebas-ui.cjs`: 40 escenarios aprobados, incluyendo retorno antes de salida sin mutación, abandono fuera de base, doble ocupación, mantenimiento reparable, pagos, reembolsos, semántica semanal, catálogo y reinicio idempotente.
- [x] Sintaxis JS revisada y `git diff --check -- demo` sin errores.
- [x] Chrome: seis pestañas del supervisor, reembolso, datos financieros, calendario inválido sin escritura, selector de 16 regiones y 21 comunas de Ñuble, formulario conservado, propuesta invalidada al editar, confirmación igual a simulación, destinatario de aviso, retorno bloqueado, persistencia y pantalla de 390 px sin desbordamiento horizontal.
- [x] Sin errores JavaScript de página; sin textos de demo en las vistas comprobadas. Capturas en `.tmp-ui/gastos-validado.png`, `calendario-validado.png`, `retorno-bloqueado.png`.
- Incidentes resueltos: una prueba de pernocta usaba 280 km (no superaba el umbral) y se ajustó a 320; una expresión de prueba buscaba NaN sin distinguir mayúsculas y coincidía con 'financiero'. Ambas fueron errores del caso de prueba, corregidos antes de la validación final.
- Chrome requirió ejecución fuera del sandbox con permiso efectivo ya aprobado. No hubo acciones ni errores remotos nuevos.

## Pendiente / límites externos

- [ ] Autenticación real, servidor y sincronización entre dispositivos: siguen fuera de la aplicación HTML local.
- [ ] Ensayo real de migración, fórmulas y permisos Google/AppSheet: pendientes del checklist histórico, no probados por estos cambios.
- [ ] Cámara, GPS y teclado en teléfonos físicos; certificación de marcas horarias y verificación real de rutas.
- [ ] Editor de escalas arbitrarias, transportes especiales y ajustes de revisiones financieras finalizadas. Actualmente esas operaciones se bloquean con explicación.
- No se certifica que toda combinación posible esté libre de defectos: la matriz concreta de reglas y casos está documentada y probada.
- Siguiente acción concreta: revisar `demo/index.html` con el usuario; ante nuevos casos límite, agregar regresión antes de modificar las reglas compartidas. No repetir migración ni restaurar archivos antiguos eliminados por el usuario.
