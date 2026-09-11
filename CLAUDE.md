# CRM Servicio Técnico en Ruta

Proyecto **Google Apps Script** vinculado a un Google Spreadsheet que actúa como base de datos.
No es una app Node: no hay `package.json`, ni bundler, ni `npm test`.

## Arquitectura

`apps-script/` — 16 archivos `.gs` numerados que definen el orden de carga en GAS (globales compartidos, sin `import`/`export`):

| Archivo | Responsabilidad |
|---|---|
| `00_Config.gs` | `APP`, `SH` (nombres canónicos de las 22 hojas), lectura de la hoja `CONFIG` |
| `01_Schema.gs` | Esquema de columnas, validaciones y formatos por hoja |
| `02_Setup.gs` | `instalarCRM()` — creación idempotente de hojas |
| `03_Db.gs` | Capa de acceso: `dbLeer/dbBuscar/dbUno/dbInsertar/dbActualizar/dbUpsert/dbEliminar/dbReemplazar`, IDs con `dbNuevoId(prefijo, ancho)` |
| `04_Utils.gs` | Fechas ISO-semana, aritmética horaria, `clp()`, `haversineKm()` |
| `05_Seed.gs` | Datos de ejemplo del caso |
| `06_Geo.gs` | Matriz de distancias, geocodificación (Maps / `GOOGLE_MAPS_API_KEY`) |
| `07_Transporte.gs` | Comparador camioneta / avión / bus / Uber / transporte público |
| `08_Costos.gs` | Costos, viáticos, combustible |
| `09_Planificador.gs` | Motor de planificación semanal (el archivo más grande, 936 líneas) |
| `10_Calendario.gs` | Itinerario y eventos |
| `11_KPI.gs` | KPI técnico/semanal y rentabilidad |
| `12_Ejecucion.gs` | Órdenes de trabajo, materiales, marcas de tiempo, rendición |
| `13_Api.gs` | Endpoint REST (`doGet`/`doPost`) autenticado por `WEBHOOK_SECRET` |
| `14_Menu.gs` | Menú del spreadsheet |
| `15_Presentacion.gs` | Vista de presentación |

`Index.html` (coordinación), `Tecnico.html` (vista técnico, `?accion=tecnico&tecnicoId=T01`), `Presentacion.html`.
`appsheet/` y `data/` están vacíos. `docs/PENDIENTES.md` lista lo que requiere cuenta Google o credenciales de terceros.

## Convenciones

- **Español en todo**: nombres de funciones, variables, comentarios y commits. Los comentarios de cabecera van sin tildes (`SERVICIO TECNICO`), el resto del texto sí las lleva.
- Estilo GAS clásico: `var`, funciones globales, sin módulos. **No introducir `const`/`let`/arrow functions/clases** sin migrar el proyecto entero — GAS lo soporta, pero el código actual es homogéneo.
- **Toda constante económica u operacional editable vive en la hoja `CONFIG`, no en el código.** `00_Config.gs` solo declara los valores por defecto con los que se siembra esa hoja la primera vez.
- Referirse a las hojas siempre por `SH.*`, nunca por string literal.
- Escribir en hojas solo a través de `03_Db.gs`; no usar `SpreadsheetApp` directo fuera de esa capa y de `02_Setup.gs`.
- Zona horaria `America/Santiago`, moneda `CLP`, semanas en formato ISO.

## Validación

No existe suite de tests. Lo único verificable localmente es la sintaxis, tratando los `.gs` como JavaScript:

```bash
node scripts/check-sintaxis.js
```

(`node --check` **no** sirve: Node 25 rechaza la extensión `.gs` con `ERR_UNKNOWN_FILE_EXTENSION`. El script usa `vm.Script`, que compila sin ejecutar.)

La validación funcional solo ocurre en Google Apps Script, porque depende de `SpreadsheetApp`, `Maps`, `MailApp` y `UrlFetchApp`.
Despliegue con `clasp push` desde `apps-script/` (hay `.clasp.json` local, **no versionado**).

## Seguridad

- **Nunca versionar** `WEBHOOK_SECRET`, `scriptId`, IDs de Spreadsheet ni API keys. `.clasp.json` no va al repo.
- Las claves de integración (`GOOGLE_MAPS_API_KEY`, `AMADEUS_CLIENT_ID/SECRET`, `CNE_API_TOKEN`) se administran en la hoja `CONFIG`, no en el código.
- Las escrituras del endpoint REST son `POST` con `accion` + `token` en el cuerpo JSON.
- No cambiar la aplicación web a acceso anónimo sin revisar el apartado de seguridad de `docs/PENDIENTES.md`.
