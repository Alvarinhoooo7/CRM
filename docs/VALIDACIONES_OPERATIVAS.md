# Validaciones operativas del HTML

Actualizado: 15-09-2026. Implementación: `demo/`. Reglas centrales: `demo/js/08_reglas.js`.

## Calendario y recursos

| Operación | Regla |
|---|---|
| Reprogramar | Fecha civil válida, de lunes a viernes. La fecha solo se guarda si pasa la validación completa. |
| Secuencia | Por cada técnico y vehículo, el origen debe coincidir con el término de su jornada anterior; el primer origen y el último destino deben ser BASE. |
| Retorno | No puede adelantar la salida o llegada al destino ni abandonar integrantes fuera de base. |
| Ocupación | Un técnico y un vehículo participan como máximo en una jornada por fecha. |
| Pernoctación | Una noche al terminar fuera de base; cero al retornar. No se permiten días intermedios fuera de base sin jornada/alojamiento. |
| Dotación | Técnicos activos, únicos, dentro de la capacidad. Conductor integrante del equipo con licencia. |
| Mantenimiento | No asignar ni iniciar con vehículo en taller. Las jornadas afectadas pueden repararse una a una. Un vehículo en ruta no cambia de estado. |
| Protección | Checklist marcado, ejecución o rendiciones protegen la jornada contra reprogramación y eliminación de sus órdenes mediante reasignación. |
| Límites | Conducción y jornada diaria según parámetros; horas extra por técnico y semana civil. |

Los controles se ejecutan en `despachar()` sobre una copia. Un rechazo conserva el estado anterior, muestra la causa y evita avisos falsos de éxito. Las inconsistencias de planes guardados anteriormente se muestran como alertas; no se borran evidencias para ocultarlas.

## Órdenes nuevas

- Campos obligatorios, correo válido, equipos/dotación enteros, kilómetros positivos y peajes enteros no negativos. Un peaje vacío no significa cero.
- Región y comuna deben pertenecer al catálogo. El usuario confirmó Ñuble como región independiente.
- Se crean destinos propios por orden de servicio: compartir comuna no permite sobrescribir cliente, dirección ni capacitación de un servicio anterior.
- Simulación y confirmación usan `prepararTrabajo()`. Se conservan los kilómetros y peajes ingresados. Confirmar vuelve a comprobar disponibilidad y restricciones de todas las fechas.
- Editar el formulario invalida la propuesta anterior, conservando el borrador.
- Viajes de uno, dos o tres días según ida, instalación y retorno. No se cobra una noche ficticia en una jornada que vuelve a la base.
- Un traslado cuya ida excede el máximo de conducción requiere una escala explícita; no se inventan ubicaciones o distancias. Una instalación que excede una jornada en sitio debe dividirse antes de confirmarse. No existe todavía un editor de escalas arbitrarias.
- Isla de Pascua, Juan Fernández y Antártica requieren transporte especial; no se confirman como una ruta terrestre desde Santiago.
- Comuna sin referencia: kilómetros y peajes quedan vacíos. Las rutas nuevas usan la dirección ingresada en el enlace de Maps, sin sustituirla por coordenadas de una capital regional. No se consulta una API para verificar carreteras, transbordadores o tiempos.

## Ejecución y rendiciones

- La orden corresponde al técnico del rol activo. Los roles son controles de interfaz local, no autenticación de servidor.
- El inicio exige checklist completo y etapas previas cerradas de los recursos involucrados. Una etapa posterior muestra el bloqueo desde el encabezado de la orden.
- Inicio y cierre no se repiten. El cierre valida cantidad, evidencias y hora de inicio válida, no futura. Al iniciar se conserva la duración planificada para comparar después.
- Los técnicos reportan el total de su cuadrilla: los cierres deben coincidir y el avance lo cuenta una sola vez por jornada.
- Gastos con propietario correcto, tipo permitido, monto entero positivo y comprobante. Se rechaza reutilizar el mismo comprobante de un técnico.
- Una rendición solo pasa de Pendiente a Aprobado o Rechazado. Aprobar sin comprobante está bloqueado. Ajustes de revisiones ya finalizadas requieren un flujo posterior que no está implementado.
- La ubicación mostrada es la planificada; no acredita geolocalización. El campo de desempeño «En sitio» solo toma marcas booleanas verificables y omite la ubicación del plan.
- La fecha de la agenda y la marca horaria de ejecución son datos distintos. Esta aplicación local no certifica hora de servidor ni ubicación física.

## Dinero

- Anticipos guardan monto y fecha. Recalcular el presupuesto no cambia dinero ya transferido; los registros booleanos antiguos se convierten una vez con el importe disponible en ese momento y origen de conversión identificado.
- Se separan anticipo previsto, recibido, pendiente, rendición aprobada, saldo por rendir y reembolso pendiente/pagado. No se compensa el saldo positivo de un técnico contra una deuda a otro.
- Pagar un reembolso reduce el anticipo pendiente: no se vuelve a transferir la misma parte después. Las acciones repetidas sin saldo pendiente se rechazan.
- El costo por comuna prorratea el viaje completo, incluidos retorno, reserva, redondeo y costos de empresa; su suma concilia con el costo del plan.
- El costo conserva todas las horas extra calculadas, aunque un exceso bloquee la confirmación. No se recorta el costo para esconder un itinerario inválido.
- Los parámetros rechazan negativos, no finitos, divisiones por cero y factores porcentuales fuera de rango.

## Catálogo y escenario financiero

`00_comunas.js`: 16 regiones y 346 comunas, a partir de la base del usuario y contraste con el [catálogo de comunas de la CMF](https://www.cmfchile.cl/institucional/seil/certificacion_comunas.php) y los [códigos territoriales de SUBDERE](https://www.subdere.gov.cl/documentacion/c%C3%B3digos-%C3%BAnicos-territoriales-actualizados-al-06-de-septiembre-2018). Se retiró Curauma como comuna, se normalizaron nombres y se reconoció La Calera como alias de Calera.

`09_escenario.js`: 14 rendiciones sintéticas, cuatro anticipos y casos pendientes, aprobados, rechazados y de emergencia. Se cargan una vez de forma aditiva, manteniendo operaciones existentes. Los registros llevan `Simulado: true` como procedencia; no representan pagos reales. Restablecer el plan repone este mismo escenario después de confirmación explícita. Los mensajes de «demo» fueron retirados de la UI a solicitud del usuario.

No se enviaron correos. El formulario registra un aviso realizado por el coordinador; el selector conserva el destinatario y se evita duplicarlo o modificar retroactivamente una capacitación tras iniciar el servicio. La exportación no inventa RUT y neutraliza celdas que podrían interpretarse como fórmulas CSV.

## Verificación

```powershell
node demo/pruebas.cjs
node demo/pruebas-ui.cjs
```

Resultado: 38 pruebas del motor y 40 escenarios de regresión aprobados. Chrome automatizado comprobó roles, rendiciones, reembolso, calendario inválido sin mutación, Ñuble y sus comunas, preservación del formulario, invalidación de propuesta, confirmación consistente, destinatario de capacitación, bloqueo del retorno, persistencia y viewport móvil de 390 px. Evidencias locales en `.tmp-ui/`, excluidas de Git.

Queda fuera de estas pruebas la operación de Google, correo real, autenticación, sincronización entre dispositivos, cámara/GPS de teléfonos físicos y verificación real de rutas.
