# Guion de presentación · cuatro integrantes · 15 minutos

Leer junto al [README principal](../../README.md). Reemplazar «integrante» por los nombres reales del equipo. Todos deben poder abrir la web y explicar una transferencia, aunque cada uno tenga una sección asignada.

## Distribución y transiciones

| Tiempo | Responsable | Pantalla | Qué debe demostrar |
| --- | --- | --- | --- |
| 0:00–3:00 | Integrante 1 | Resumen | Problema, alcance, requisitos y supuestos |
| 3:00–7:00 | Integrante 2 | Rutas y flota → Calendario | Recorridos, recursos y jornada |
| 7:00–11:00 | Integrante 3 | Gastos → Transporte/Peajes | Fórmulas, transferencia y fuentes |
| 11:00–15:00 | Integrante 4 | Orden → Resumen | Experiencia del técnico, mejora y conclusión |

### Integrante 1: problema y alcance

«Planificamos la instalación de 33 equipos distribuidos en 16 localidades. Disponemos de 10 técnicos y seis camionetas con rendimiento de 20 km/L. Cada instalación necesita dos horas y el escenario literal conserva 30 minutos de capacitación por equipo.»

Mostrar el selector en **Literal del enunciado** y explicar que los indicadores representan trabajo planificado. Mencionar que la base, los valores de hotel y la organización en cuadrillas de tres son decisiones del equipo. No atribuir esas decisiones al PDF.

Explicar la plataforma en una frase: «Sheets guarda el plan, Apps Script calcula y la web permite consultarlo y editarlo».

Transición: «Ahora veremos cómo se distribuyen esos recursos en el territorio».

### Integrante 2: rutas, flota y calendario

Abrir **Rutas y flota**. Identificar C1 norte, C2 sur y C3 RM/Ruta 78. Mostrar que las camionetas V1–V3 están asignadas y que T10 queda de reserva. La disponibilidad de V4–V6 permite explicar por qué no se justifica comprar otra camioneta solo por este caso.

Buscar `Copiapó`, explicar origen, destino, conductor, vehículo, equipos, viaje y noche. Aclarar que volver por Coquimbo no repite la instalación. Abrir un enlace de Maps solo si hay tiempo y conectividad.

Pasar a **Calendario**. Explicar que el color se deriva de horas de viaje y sitio. Si hay una alerta de exceso, señalar qué tramo debe moverse; no ocultarla cambiando de escenario. Los límites son parámetros del modelo, no una certificación legal.

Mostrar brevemente **Planificación**: los tramos se editan y guardan, y **Recalcular** vuelve a evaluar. El sistema no decide automáticamente la ruta óptima ni cambia los hoteles sugeridos.

Transición: «Esta agenda determina cuánto hay que financiar para que los técnicos puedan realizarla».

### Integrante 3: costos y transferencias

Abrir **Gastos**, explicar primero combustible y luego hotel/viático:

```text
Ejemplo aritmético, no cotización:
200 km / 20 km/L = 10 L
10 L × $1.400/L = $14.000 de combustible del vehículo

Una noche de tres técnicos a $50.000 = $150.000 de hotel
Un día de tres técnicos a $25.000 = $75.000 de viático
```

El combustible se cuenta por camioneta, no tres veces por tener tres pasajeros. El viático se cuenta una vez por técnico-día, aunque ese día tenga varios tramos.

Elegir una fila de transferencias y leer sus conceptos. Explicar que conductor y acompañante pueden recibir distinto dinero porque alguien paga el combustible. Si la empresa paga TAG, el peaje no se adelanta al técnico. Reserva y redondeo completan la propuesta.

Mostrar **Peajes**: una plaza tiene tarifa y una localidad tiene una secuencia. El estado ESTIMADO indica que falta contrastar el recorrido. El catálogo no elimina el cobro al volver a cruzar una plaza.

En **Transporte**, mencionar que bus/avión requieren cotizar y resolver herramientas. La comparación no modifica el plan ni representa una reserva.

Transición: «Con el presupuesto definido, esta es la información que recibe cada técnico».

### Integrante 4: técnico, mejora y cierre

Abrir **Orden de servicio**, seleccionar T01 y mostrar vehículo, conductor, hotel, tramo e implementos. Exportar a PDF si los permisos ya se probaron. La exportación conserva el escenario seleccionado. Las casillas de checklist son de revisión en pantalla; no registran una entrega en inventario.

Volver a **Resumen** y seleccionar **Mejora propuesta: capacitación digital**. Explicar:

- Literal: 33 sesiones × 30 minutos = 16,5 horas de sesiones.
- Propuesta: 16 sesiones × 15 minutos = 4 horas.
- Diferencia: 12,5 horas de sesiones; 37,5 horas-persona si toda la cuadrilla de tres permanece asignada.

La propuesta requiere material útil, entrega previa y aceptación de la reducción de capacitación. El programa no envía el correo ni demuestra aprendizaje del cliente.

Conclusión sugerida: «Antes de ampliar la flota, proponemos medir tiempos reales, mejorar la agrupación de visitas y validar capacitación previa. La web permite comparar esos supuestos y entregar a cada técnico una ruta y un presupuesto trazables».

## Preguntas que cualquiera debe responder

| Pregunta del docente | Respuesta esperada |
| --- | --- |
| ¿Tres técnicos reducen cinco instalaciones a 3,33 horas? | No. Son tandas completas: techo(5/3) × 2 = 4 horas, bajo el supuesto de trabajo independiente. |
| ¿El sistema calcula el óptimo? | Evalúa el plan ingresado y aplica comparaciones locales; no prueba óptimo global. |
| ¿Por qué la capacitación sigue sumándose? | Se realiza después de la instalación y ocupa tiempo de la cuadrilla. |
| ¿Dónde está el décimo técnico? | Reserva, sin servicios asignados ni adelanto de viáticos en la siembra. |
| ¿El costo total es lo que se transfiere? | No: incluye conceptos empresariales, sobretiempo y desgaste; el adelanto personal tiene sus reglas y redondeo. |
| ¿El hotel está reservado? | No, es una referencia cargada por coordinación. |
| ¿Los km vienen del PDF? | No: se consultan a Maps o se usan respaldos identificados. |
| ¿Los peajes son exactos? | La tarifa procede del catálogo; muchas secuencias requieren validar ruta y horario. |
| ¿Qué ocurre al cambiar una dirección? | Se guarda, se invalida la caché de rutas y se recalcula antes de usar el nuevo presupuesto. |
| ¿El simulador asigna un trabajo? | No. Estima una visita independiente desde base; no reserva personas ni vehículos. |
| ¿Cada técnico tiene un usuario? | Esta demo tiene acceso compartido; el selector de técnico es un filtro. |
| ¿Dónde se guardan los datos? | CONFIG, DESTINOS y PLAN; auxiliares ocultas para rutas y bitácora. |
| ¿Subir con clasp cambia el libro? | Sube código. Las funciones ejecutadas posteriormente leen o escriben las hojas. |

## Ensayo y contingencia

Antes de exponer, usar una copia de la hoja para practicar ediciones. Preparar el login, cargar rutas y verificar el PDF una vez. Tener un PDF ya generado y un CSV del plan permite explicar la operación si se interrumpe internet; indicar la fecha de esos resultados.

La vista previa local usa rutas sintéticas: sirve para enseñar navegación, pero no debe reemplazar cifras del plan de Google sin aclararlo. La entrega del informe sigue pendiente del equipo; la documentación no es un informe PDF terminado ni una presentación PPT.

El PDF pide texto legible y poco cargado en diapositivas. Para el informe indica papel carta, márgenes de 2,5 cm, Arial o Calibri, cuerpo 11, subtítulos 12 y títulos 14 en negrita, texto justificado e interlineado sencillo. Contrastar los detalles directamente con el documento antes de exportar.
