# Continuidad de la migración autorizada

Leer primero `ESTADO_IMPLEMENTACION.md`, luego `PLAN_ACCION_PLANILLA_FUNCIONAL.md` y `docs/ESPECIFICACION_CONCILIADA.md`.

El usuario autorizó ejecutar el plan completo y retirar todo lo incompatible. También pidió mantener un checklist detallado de lo completado y lo pendiente antes de agotar contexto. Actualizar ESTADO_IMPLEMENTACION después de cada bloque significativo y antes de finalizar o compactar; registrar archivos, pruebas, errores remotos y siguiente acción concreta.

La implementación destino vive en `apps-script/`. El sistema remoto todavía puede ser v2: el estado de corte está en el checklist. No mezclar módulos de v2 con los once nuevos, ni ejecutar `clasp push` desde apps-script sin comprobar el estado de respaldo y migración del libro. La autorización de trabajo ya existe; faltan verificaciones y permisos efectivos de Google, no una nueva aprobación genérica del usuario.

Pruebas:

```powershell
node scripts/check-sintaxis.js
node tests/planilla.cjs
node tests/hojas.cjs
```

No confundir los dobles locales con validación de fórmulas, permisos o sincronización real en Google. No declarar completa la migración hasta demostrar esas partes. Todo lo que no se haya comprobado debe quedar sin marcar en el checklist.

Los cambios previos del usuario en CLAUDE.md y .obsidian se preservan. CLAUDE.md describe una arquitectura antigua; en caso de conflicto el prompt, el plan autorizado y estas instrucciones reflejan la dirección actual. El código remoto y una copia del CLAUDE del usuario están en `.local-backup/migracion-20260914/`, excluido de Git. No publicar identificadores, tokens ni inventarios privados.

Las escrituras de Apps Script se serializan con LockService y se limitan por propiedad de columnas. No sobrescribir filas completas que incluyan evidencias móviles. No enviar correos de prueba a clientes ni direcciones ficticias. No borrar versiones antiguas ni datos hasta verificar el respaldo y el ensayo de migración; después, retirarlos efectivamente como pidió el usuario.
