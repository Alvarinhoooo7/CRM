# Servicio Técnico en Ruta · v2.1

Versión vigente, con código desplegable en `apps-script/`.

La guía completa para los cuatro expositores es el **[README principal](../README.md)**: requisitos del PDF, pantallas, fórmulas, escenarios, instalación y limitaciones. Se mantiene una sola guía vigente para evitar contradicciones.

- [Guion de presentación](docs/PRESENTACION.md).
- [Arquitectura](docs/ARQUITECTURA.md).
- [Pendientes en Google](docs/PENDIENTES.md).

Desde `CRM`:

```powershell
node v2/tests/web.cjs
node v2/tests/interfaz.cjs
node v2/tests/preview.cjs
```

La vista local está en `http://127.0.0.1:4173`, con datos sintéticos y sin escritura a Google. Para sincronizar, usar `clasp status` y `clasp push` desde `v2/apps-script/`.
