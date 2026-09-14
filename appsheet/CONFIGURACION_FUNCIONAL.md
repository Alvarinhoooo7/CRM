# AppSheet — configuración de la planilla funcional

Estado: configuración preparada; todavía no aplicada ni validada en una cuenta AppSheet. Esta guía reemplaza el flujo de importar CSV cuando se efectúe el corte. Usar el mismo spreadsheet de la operación.

## Conexión y propiedad

1. Crear aplicación desde el spreadsheet de ensayo y agregar las ocho tablas listadas debajo.
2. Activar inicio de sesión con Google y agregar las cuentas reales autorizadas. Reemplazar los correos ficticios de TECNICOS antes de probar. Comprobar en la cuenta que su licencia admite los usuarios y filtros requeridos.
3. Establecer claves explícitas; desactivar el uso de `_RowNumber`. No conectar CONFIG, TRANSFERENCIAS, ENVIOS, TABLERO ni cierres a la aplicación móvil.
4. Ejecutar `prepararHojasAppSheet()` antes de agregar usuarios. Toda fórmula de Sheets y todo resultado del motor queda no editable en AppSheet.

| Tabla | Clave | Permisos | Filtro de seguridad |
|---|---|---|---|
| ORDENES | ID_Orden | Updates only | `[Email] = USEREMAIL()` |
| CHECKLIST | ID_Item | Updates only | `[Email] = USEREMAIL()` |
| GASTOS | ID_Gasto | Adds only | `[Email] = USEREMAIL()` |
| TECNICOS | ID_Tecnico | Read-only | `[Email] = USEREMAIL()` |
| CAMIONETAS | ID_Vehiculo | Read-only | `IN([ID_Vehiculo], SELECT(ORDENES[ID_Vehiculo], [Email] = USEREMAIL()))` |
| DESTINOS | ID_Destino | Read-only | `IN([ID_Destino], SELECT(VISITAS[ID_Destino], TRUE))` |
| IMPLEMENTOS | ID_Implemento | Read-only | `TRUE` |
| VISITAS | ID_Visita | Updates only | `IN([ID_Jornada], SELECT(ORDENES[ID_Jornada], [Email] = USEREMAIL()))` |

El filtro de DESTINOS depende de las VISITAS visibles. Verificarlo con dos cuentas; si la cuenta/configuración no permite esa dependencia, usar una expresión directa desde ORDENES y VISITAS y comprobar que no exponga contactos de destinos ajenos. No reemplazar filtros de seguridad por slices. Referencia: [aislamiento de usuarios](https://support.google.com/appsheet/answer/10104977?hl=en).

`ID_Orden` de CHECKLIST/GASTOS es Ref a ORDENES; `ID_Tecnico` es Ref a TECNICOS; `ID_Vehiculo` de ORDENES es Ref a CAMIONETAS; `ID_Implemento` de CHECKLIST es Ref a IMPLEMENTOS. `ID_Origen` y `ID_Destino` de VISITAS admiten el valor especial BASE: usar Text/Enum validado, no Ref obligatorio a DESTINOS sin añadir una fila base que alteraría el conteo de comunas.

En ORDENES solo son editables: hitos de jornada, Checklist_Completo, Firma_Cliente, Foto_Instalacion, Observaciones y Ubicacion_GPS. Estado_Orden, Email, ID_Tecnico, ID_Jornada y columnas de cálculo pertenecen al supervisor/procesador. Excluir formularios generales que permitan saltar la secuencia: los hitos se escriben con acciones.

En CHECKLIST solo `Marcado` y `Hora_Marcado`. Los IDs, el propietario y los textos del catálogo son inmutables. En VISITAS solo evidencia y cantidades reales; ruta, kilómetros, peajes, equipos previstos y cálculos no editables.

## Gastos y claves sin conexión

Configurar valores iniciales, sin Reset on edit:

```appsheet
ID_Gasto: CONCATENATE("G-", UNIQUEID())
Email: USEREMAIL()
ID_Tecnico: [ID_Orden].[ID_Tecnico]
Fecha: TODAY()
Estado: "Pendiente"
```

Valid_If de ID_Orden: `SELECT(ORDENES[ID_Orden], AND([Email] = USEREMAIL(), [Estado_Orden] <> "Cancelada"))`.
Monto debe ser positivo y Foto_Boleta obligatoria. Estado, Revisado_Por, Fecha_Revision, Comentario, Folio, Recibido_Servidor y Error_Validacion son no editables para técnicos. El procesador asigna Folio correlativo después de sincronizar; UNIQUEID protege la clave durante trabajo sin conexión.

Un gasto sin boleta o con propietario incorrecto queda con Error_Validacion y no se cuenta como rendición aprobada. Solo el supervisor revisa y aprueba desde Sheets. Los registros de demo sin foto son deliberadamente incompletos.

## Columnas virtuales de ORDENES

```appsheet
Gastos_Rendidos:
SUM(SELECT(GASTOS[Monto], AND(
  [ID_Orden] = [_THISROW].[ID_Orden],
  [Estado] = "Revisado",
  ISBLANK([Error_Validacion])
)))

Saldo:
[Total_Transferencia] - [Gastos_Rendidos]

Checklist_Pendiente:
COUNT(SELECT(CHECKLIST[ID_Item], AND(
  [ID_Orden] = [_THISROW].[ID_Orden],
  [Obligatorio] = TRUE,
  [Marcado] <> TRUE
)))

Puede_Salir_A_Ruta:
AND(
  COUNT(SELECT(CHECKLIST[ID_Item], [ID_Orden] = [_THISROW].[ID_Orden])) > 0,
  [Checklist_Pendiente] = 0,
  [Checklist_Completo] = TRUE
)

Visitas_Del_Dia:
SELECT(VISITAS[ID_Visita], [ID_Jornada] = [_THISROW].[ID_Jornada])

Visitas_Pendientes:
COUNT(SELECT(VISITAS[ID_Visita], AND(
  [ID_Jornada] = [_THISROW].[ID_Jornada],
  [Equipos] > 0,
  OR(
    [Equipos_Instalados] <> [Equipos],
    ISBLANK([Hora_Fin_Instalacion]),
    ISBLANK([Firma_Cliente]),
    ISBLANK([Foto_Instalacion])
  )
)))
```

`Saldo` representa presupuesto disponible de esa orden, no dinero efectivamente transferido. La vista debe rotularlo «Saldo del presupuesto». Para mostrar anticipo real individual sin exponer TRANSFERENCIAS usar las columnas Monto_Transferido, Monto_Rendido y Saldo de la fila propia de TECNICOS. La reserva se calcula por técnico; no está incluida en cada Total_Transferencia diario.

Para `Avance_Hitos`, se puede mostrar directamente Avance calculado por Sheets tras sincronización. Si se necesita progreso inmediato sin conexión, definir equivalente virtual: 7 hitos para órdenes con instalación/capacitación, 6 si no corresponde una nueva capacitación y 4 para traslado puro. Las ramas deben coincidir con `actualizarFormulas_` y `validarHitos_`.

## Acciones de jornada

Tipo «Data: set the values of some columns in this row». Cada marca horaria usa `NOW()` y GPS `HERE()`. Son hora y ubicación del dispositivo; `Recibido_Servidor` indica la primera recepción en Apps Script, no sustituye cada marca ni certifica su exactitud.

Condición común a todas: `[Email] = USEREMAIL()` y `NOT(IN([Estado_Orden], {"Cancelada", "Completada", "Reprogramada"}))`. Combinar con las condiciones de esta tabla usando AND.

| Acción | Condición adicional | Escritura |
|---|---|---|
| Iniciar jornada | `ISBLANK([Hora_Inicio_Jornada])` | Hora_Inicio_Jornada = NOW(); GPS = HERE() |
| Completar checklist | Inicio no vacío, checklist pendiente cero, al menos un ítem, Checklist_Completo distinto de TRUE | Checklist_Completo = TRUE |
| Salir a ruta | Inicio no vacío, Puede_Salir_A_Ruta, salida vacía | Hora_Salida_Ruta = NOW(); GPS = HERE() |
| Iniciar instalación | Equipos > 0, salida no vacía, inicio instalación vacío | Hora_Inicio_Instalacion = NOW(); GPS = HERE() |
| Terminar instalación | Inicio instalación no vacío y fin vacío | Hora_Fin_Instalacion = NOW(); GPS = HERE() |
| Iniciar capacitación | Horas_Capacitacion > 0, instalación terminada, inicio capacitación vacío | Hora_Inicio_Capacitacion = NOW(); GPS = HERE() |
| Terminar capacitación | Inicio capacitación no vacío, fin vacío y firma capturada | Hora_Fin_Capacitacion = NOW(); GPS = HERE() |
| Cerrar jornada | Fin vacío; traslado: salida no vacía; servicio: instalación finalizada, capacitación finalizada si corresponde y Visitas_Pendientes = 0 | Hora_Fin_Jornada = NOW(); GPS = HERE() |

El hito conceptual «Capacitación» tiene dos acciones. CHECKLIST debe marcar Hora_Marcado junto con Marcado mediante acción, para que el tiempo no quede vacío. Deshabilitar desmarcar después de la salida. El procesador vuelve a validar la secuencia y deja Error_Validacion si no coincide.

Para VISITAS, solo el conductor de la jornada registra evidencia compartida. Editable_If de columnas de evidencia:

```appsheet
IN([ID_Jornada], SELECT(ORDENES[ID_Jornada], AND(
  [Email] = USEREMAIL(),
  [Es_Conductor] = TRUE,
  [Estado_Orden] <> "Cancelada",
  ISNOTBLANK([Hora_Inicio_Jornada]),
  ISBLANK([Hora_Fin_Jornada])
)))
```

Validar Equipos_Instalados entre 0 y Equipos. Si hay tres comunas, registrar firma, foto y tiempos en las tres VISITAS. El acompañante puede ver esa evidencia y cerrar su jornada una vez sincronizada. Un cierre offline antes de recibir la evidencia del conductor no debe habilitarse.

## Tipos y vistas

| Datos | Tipo |
|---|---|
| Hora_* y Recibido_Servidor | DateTime |
| Fecha | Date |
| Foto_Boleta / Foto_Instalacion | Image |
| Firma_Cliente | Signature |
| Ubicacion_GPS | LatLong |
| Montos | Price con CLP |
| Activo, Obligatorio, Marcado, Checklist_Completo | Yes/No |

Crear: Mi ruta (Deck, agrupado por Fecha, orden por Dia); Detalle de la orden (ruta, implementos, hotel y camioneta en ese orden); Mi jornada (acciones secuenciales); Checklist (agrupación por Categoria); Rendir gasto (Form); Mi saldo (Detail de la fila propia de TECNICOS y presupuestos de sus órdenes). Configurar almacenamiento de imágenes y firmas en Drive accesible a la aplicación; no publicar carpetas para cualquiera con el enlace.

## Sincronización y aceptación real

Ejecutar instalarActivadores desde Sheets: revisión diaria de flota, recálculo diario y sondeo cada P_INTERVALO_APP minutos. No usar onChange como receptor de cambios API. Referencia: [restricciones de activadores](https://developers.google.com/apps-script/guides/triggers/installable).

Los correos están deshabilitados en la semilla. Completar destinatarios y videos reales, revisar permisos y activar P_CORREOS_HABILITADOS. El envío por salida ocurre tras sincronizar y procesar; ENVIOS impide reenvío ciego si la respuesta de MailApp es incierta. Un registro ENVIANDO debe revisarse antes de reintentar.

- [ ] Aplicar esta configuración en la cuenta real y guardar aplicación sin errores.
- [ ] Probar dos usuarios distintos: órdenes, gastos, checklist, visitas, maestros y montos privados.
- [ ] Probar inicio → checklist → salida → instalación → capacitación → firma → cierre.
- [ ] Probar jornada de traslado sin instalación/firma.
- [ ] Probar tres visitas en un día, conductor y acompañante.
- [ ] Probar modo avión, captura de gasto y posterior sincronización sin duplicados.
- [ ] Probar captura de boleta, firma y foto desde un teléfono real.
- [ ] Probar correo a un destinatario autorizado y verificar envío único.
- [ ] Recalcular mientras se sincroniza y comprobar conservación de columnas de campo.
- [ ] Documentar usuarios, licencia, configuración efectiva y evidencias antes del corte.
