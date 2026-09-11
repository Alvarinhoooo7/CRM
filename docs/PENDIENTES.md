# Pendientes de puesta en marcha

La guía vigente de la demo está en el [README principal](../README.md). El proyecto está vinculado con clasp. La lista siguiente corresponde al alcance original; materiales ya no forman parte de la presentación, CONFIG se redujo a diez ajustes y las hojas auxiliares se ocultan. Quedan por validar en las cuentas de Google las consultas reales, permisos, implementación web y configuración de AppSheet.

| Prioridad | Tarea | Responsable | Criterio de cierre |
| --- | --- | --- | --- |
| Alta | Vincular `apps-script/` a un proyecto de Apps Script y ejecutar `instalarCRM`. | Administrador Google | Se crean las 22 hojas, los datos semilla y el menú CRM. |
| Alta | Ejecutar una planificación de prueba y revisar el resultado de OT, itinerario, viáticos, materiales, calendario y KPI. | Coordinación operativa | La semana se planifica sin errores y una segunda ejecución vuelve a usar la flota. |
| Alta | Guardar y distribuir `WEBHOOK_SECRET` por un canal seguro si se usará el endpoint REST. | Administrador de integraciones | Un `POST` autenticado funciona y uno con token inválido es rechazado. |
| Alta | Publicar la aplicación web para usuarios con cuenta de Google. | Administrador Google | El panel y la vista `?accion=tecnico&tecnicoId=T01` cargan datos del libro. |
| Media | Configurar AppSheet contra las hojas `ORDENES_TRABAJO`, `MARCAS_TIEMPO`, `GASTOS`, `MATERIALES` y `VIATICOS`; definir roles de técnico, supervisor y tesorería. | Dueño del proceso | Un técnico solo ve y modifica sus propias filas; un supervisor puede aprobar gastos. |
| Media | Si AppSheet necesita llamar al endpoint directamente, validar el modelo de autenticación de la implementación web. | Administrador Google / AppSheet | Se conserva acceso de Google para el panel y el webhook solo acepta el token secreto, sin exponer el secreto en una app cliente. |
| Media | Cargar direcciones, costos, salarios, vehículos, contactos y requerimientos reales; revisar valores de `CONFIG`. | Operaciones / Finanzas | Los datos semilla fueron reemplazados o aprobados para el piloto. |
| Media | Configurar `GOOGLE_MAPS_API_KEY` y recalcular la matriz. | Administrador de APIs | Las distancias y minutos de rutas críticas tienen fuente Google y fecha de actualización. |
| Baja | Configurar Amadeus, CNE y correo de capacitación si esas integraciones se usarán. | Administrador de APIs | Cada integración devuelve datos reales o queda deshabilitada explícitamente. |

## Restricciones conocidas

- Las fuentes de datos semilla representan el caso de estudio. No son datos de operación ni cotizaciones vigentes.
- La aplicación guarda una planificación operativa a la vez. Al volver a planificar, limpia las entidades derivadas de la planificación anterior y restaura los vehículos `EN_RUTA` al estado `DISPONIBLE` antes de reasignarlos.
- La cobertura real de rutas y la disponibilidad de servicios externos dependen de las cuotas y permisos de Google/terceros.
