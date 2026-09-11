# CRM Servicio Técnico en Ruta

Sistema de planificación y operación para cuadrillas técnicas en Chile. Está implementado como un proyecto de Google Apps Script vinculado a un Google Spreadsheet: el libro actúa como base de datos y la aplicación crea las hojas, carga datos de ejemplo y planifica rutas, costos, viáticos y KPI.

## Qué incluye

- Creación idempotente de 22 hojas con validaciones, formatos y datos semilla del caso.
- Planificador semanal que dimensiona cuadrillas, respeta jornada, descansos, colación, continuidad geográfica y disponibilidad de vehículos.
- Comparador de transporte para camioneta, avión, bus, Uber y transporte público.
- Itinerario, órdenes de trabajo, materiales, capacitaciones, viáticos, gastos y rendición.
- Calendario, KPI, rentabilidad y panel web para coordinación y técnicos.
- Endpoint REST con token para integraciones como AppSheet.

## Instalación

1. Crea un Google Spreadsheet vacío en la cuenta que administrará la operación.
2. Abre **Extensiones → Apps Script** y copia el contenido de `apps-script/` al proyecto, incluidos `Index.html`, `Tecnico.html` y `appsscript.json`.
3. Ejecuta `instalarCRM` una vez desde el editor y concede los permisos solicitados. La función guarda el ID del libro, crea las hojas, carga los datos de ejemplo y genera un `WEBHOOK_SECRET` seguro en `CONFIG`.
4. En el libro, vuelve a cargar la página y usa **CRM Servicio Técnico → Planificar la semana**.
5. Si se requiere la interfaz web, crea una implementación de tipo **Aplicación web**, ejecutada como el propietario y con acceso para usuarios con cuenta de Google. Comparte la URL resultante con coordinación; para la vista de un técnico usa `?accion=tecnico&tecnicoId=T01`.

No se deben versionar claves, IDs de Spreadsheet ni el valor de `WEBHOOK_SECRET`.

## Integraciones opcionales

Las claves se administran en la hoja `CONFIG`:

- `GOOGLE_MAPS_API_KEY`: actualiza la matriz de distancias con rutas reales. Sin ella se usa la matriz semilla y el servicio Maps nativo cuando esté disponible.
- `AMADEUS_CLIENT_ID` y `AMADEUS_CLIENT_SECRET`: permite consultar tarifas aéreas. Sin credenciales se usa un modelo de tarifa estimada.
- `CNE_API_TOKEN`: permite actualizar precios de combustible.
- `CAPACITACION_VIDEO_URL` y `NOTIFICAR_EMAIL`: habilitan los envíos de capacitación no presencial.

Las llamadas REST requieren el valor de `WEBHOOK_SECRET` mediante `token` y las escrituras se realizan por `POST` con un cuerpo JSON que incluya `accion` y `token`. No cambies la aplicación web a acceso anónimo sin revisar el apartado de seguridad de [pendientes](docs/PENDIENTES.md).

## Validación local

La sintaxis de los 15 archivos `.gs` se valida con Node tras tratarlos como JavaScript. La validación funcional se realiza en Google Apps Script, pues depende de `SpreadsheetApp`, `Maps`, `MailApp` y demás servicios de Google.

Consulta [docs/PENDIENTES.md](docs/PENDIENTES.md) para las tareas que requieren una cuenta de Google, credenciales de terceros o una configuración concreta de AppSheet.
