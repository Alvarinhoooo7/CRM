# Instalación, pruebas y corte de la planilla funcional

La nueva implementación está en `apps-script/`. El sistema publicado continúa siendo la versión anterior hasta completar el checklist de corte. No ejecutar una sincronización completa sobre el proyecto actual sin seguir este procedimiento.

## Preparación ya disponible en el proyecto remoto

Se añadió `prepararMigracionPlanillaFuncional` conservando los 19 archivos originales. El manifiesto suma permisos de Drive y gestión de activadores para respaldar e inventariar; no se publicó una nueva aplicación web.

1. Abrir el spreadsheet actual → Extensiones → Apps Script.
2. Seleccionar `prepararMigracionPlanillaFuncional` y ejecutar.
3. Autorizar los permisos de Google con la cuenta propietaria.
4. La función crea una carpeta y copia del libro, exporta inventario con valores/fórmulas/rangos/activadores y compara fórmulas y celdas de entrada con la copia.
5. Guardar el resultado `RESPALDO VERIFICADO`, sus enlaces y el inventario en el registro de continuidad. No modificar ni borrar hojas con este paso.

La sesión clasp puede modificar código, pero en esta sesión no logró acceso de Drive al spreadsheet; Sheets API del cliente OAuth tampoco estaba disponible. `clasp run` devolvió NOT_FOUND. Esos límites requieren ejecución/autorización desde Google; no se resuelven declarando exitoso un `clasp push`.

## Ensayo en una copia

1. Conservar intacta la copia de respaldo. Crear una segunda copia de ensayo para migración.
2. Descargar el inventario y construir el mapa columna antigua → columna nueva, distinguiendo entradas, fórmulas, ejecución histórica y datos de demo. Esto depende del contenido real y sigue pendiente.
3. Crear un proyecto Apps Script vinculado a la copia de ensayo. Conectar clasp a esa copia mediante un archivo local de configuración específico; no cambiar silenciosamente la conexión de producción.
4. Subir los once módulos GS, Agenda.html y appsscript.json de `apps-script/`. No incluir scripts de inventario local, pruebas Node ni v2.
5. Sobre un libro nuevo/vacío, ejecutar `crearHojasBase`; sobre una copia con esquema antiguo la función rechaza sobrescribir. Primero debe aplicarse el mapeo de migración revisado.
6. Para demostrar la semilla en un libro vacío: ejecutar `cargarDatosEjemplo`, confirmar, y luego `ejecutarPruebas`. La semilla rechaza tablas operativas con datos.
7. Verificar visualmente fórmulas, formatos, gráficos y filtros. Recalcular y medir menos de 30 segundos para el caso de prueba.
8. Configurar AppSheet según `appsheet/CONFIGURACION_FUNCIONAL.md` y probar dos usuarios y un teléfono sin conexión.

## Uso diario después del corte

- Editar parámetros en CONFIG mediante los valores amarillos. Los rangos P_* son la referencia del motor; no moverlos a otra hoja.
- Editar asignaciones y recorridos desde las tablas del supervisor o agenda confirmada. Para varias comunas, una VISITA por tramo y una orden diaria por cada técnico.
- Recalcular actualiza solo columnas calculadas, nómina prevista, calendario y tablero. Firmas, fotos y datos reales de pagos se conservan.
- El dinero de combustible/peaje se imputa al conductor una sola vez. Las transferencias se redondean por técnico. Registrar manualmente Estado, Fecha_Transferencia y Monto_Transferido cuando se realice un pago; exportar CSV no marca pagos.
- Revisar GASTOS: solo Revisado sin Error_Validacion cuenta como rendido. La falta de boleta debe corregirse antes de aprobar.
- Si una agenda falla durante escritura, repetir la misma confirmación o ejecutar `recuperarAgendasPendientes`. Los IDs preparados son estables y no se duplican.
- Los registros ENVIANDO en ENVIOS indican resultado incierto. Revisar correo enviado antes de decidir si confirmar ENVIADO o autorizar un nuevo intento; no borrar el registro automáticamente.
- Las alertas de flota usan kilometraje inicial más kilómetros previstos; no sustituyen el odómetro real. Registrar mantenimientos y nueva próxima mantención cuando correspondan.
- Cerrar semana solicita el lunes del período, crea snapshot protegido y no lo sobrescribe. Las correcciones históricas requieren ajuste documentado; el mecanismo automático de ajustes aún debe verificarse antes del uso recurrente.

## Activadores y correo

Después de configurar datos reales, ejecutar `instalarActivadores`. Instala únicamente tres funciones propias: `procesoDiarioFlota`, `procesoDiarioPlan`, `procesarLoQueEnvioApp`. Las ejecuciones diarias son ventanas horarias; el sondeo usa P_INTERVALO_APP.

La instalación no borra activadores anteriores de otras funciones: inventariarlos y desactivarlos durante el corte para que la versión anterior no escriba. Google solo permite listar los activadores del usuario ejecutor; revisar también propietarios anteriores si existieran.

## Corte y retiro definitivo — pendiente

- [ ] Confirmar inventario y respaldo restaurable.
- [ ] Migrar en copia conservando IDs, fechas, gastos, evidencias, pagos e históricos reales.
- [ ] Conciliar conteos y saldos origen/destino; explicar cada descarte.
- [ ] Completar la prueba real del menú, PDF, CSV, correo autorizado, cierre y AppSheet.
- [ ] Cerrar una ventana de edición/sincronización y generar respaldo final.
- [ ] Aplicar mapeo al spreadsheet que continuará en uso.
- [ ] Subir código canónico y conectar AppSheet; autorizar servicios.
- [ ] Desactivar activadores antiguos y retirar despliegues web anteriores.
- [ ] Eliminar hojas y código antiguo después de verificar datos migrados.
- [ ] Retirar v2, CSV, generador AppSheet, documentación y presentaciones incompatibles; preservar fuentes del caso y respaldo fuera del despliegue.
- [ ] Actualizar README y CLAUDE.md definitivo sin perder cambios del usuario.
- [ ] Registrar fecha de corte, verificaciones, cuentas responsables y reversión comprobada.

## Reversión

Detener sincronización y procesos nuevos. Exportar las escrituras recibidas desde el corte. Restaurar el código respaldado desde `.local-backup/migracion-20260914/remoto/` y recuperar datos desde el libro verificado. Restaurar la conexión de AppSheet y los activadores necesarios. Conciliar los cambios recibidos durante el corte antes de reabrir. No eliminar el respaldo al limpiar el proyecto.
