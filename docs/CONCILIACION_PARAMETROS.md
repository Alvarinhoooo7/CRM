# Conciliación de parámetros: libro «Evaluacion 1» contra la implementación nueva

Levantada el 14-09-2026 desde el `inventario.json` del respaldo verificado, que sí trae los
113 rangos con nombre del libro. Sin ellos no había forma de saber qué código `P_*`
corresponde a cada fila de CONFIG: la exportación de texto de Drive solo entrega la etiqueta
en español, y además venía incompleta (185 de las 305 filas).

**Los 97 parámetros del libro están clasificados, ninguno quedó fuera.** El script que
genera estas tablas falla si algún parámetro queda sin clasificar.

## Resumen

| Categoría | Cuántos | Qué significa |
|---|---:|---|
| Coincide | 18 | Mismo nombre y mismo valor |
| Coincide con otro nombre | 7 | Mismo efecto, nombre distinto |
| Incorporado ahora | 4 | Traído del libro en esta sesión |
| Roto en el libro | 2 | Devuelve `#ERROR!`; la implementación nueva lo calcula bien |
| Superado por el plan conciliado | 4 | Decisión posterior documentada — **requiere tu confirmación** |
| Regla cableada | 12 | Se cumple, pero está en el código y no en CONFIG |
| Sin implementar | 13 | Criterio del libro que todavía no se aplica |
| No aplica | 16 | Política de Maps en línea y del catálogo de plazas |
| Fuera de alcance | 18 | Bus, avión y taxi: el plan autorizó eliminarlos |
| Análisis | 3 | Costos de mejora futura |

## Lo que hay que decidir

Cuatro parámetros del libro dicen una cosa y el plan conciliado dice otra. Mantuve lo que
manda el plan, porque es la decisión más reciente y deriva del enunciado, pero son tuyos y
conviene que los confirmes:

1. **`P_TECNICOS_POR_CUADRILLA` = 3** en el libro; la implementación usa **2**.
   `PLAN_ACCION_PLANILLA_FUNCIONAL.md` fijó 2 para llegar a 14 jornadas y 28 órdenes. Cambiar
   a 3 rehace el itinerario completo: con 10 técnicos salen 3 cuadrillas y un técnico de
   holgura, y las jornadas habría que redistribuirlas.
2. **`P_TRANSFIERE_COMBUSTIBLE` = No** en el libro, pero `docs/ESPECIFICACION_CONCILIADA.md`
   dice que el conductor recibe combustible y peajes, y así está implementado. Es la
   diferencia entre transferirle ~$260.000 al conductor o pagarlos con tarjeta corporativa.
3. **`P_VIATICO_SOLO_CON_PERNOCTACION` = Si** en el libro; la especificación conciliada paga
   viático también en jornadas mixtas y de retorno, sin pernoctar.
4. **`P_HORIZONTE_MAX_DIAS` = 20** en el libro frente a `P_MAX_DIAS_AGENDA` = 60. No son lo
   mismo: el primero limita el plan completo y el segundo un trabajo agendado. Falta el tope
   del plan completo.

## El defecto de las dos celdas `#ERROR!`

```
P_T_CAP_EFECTIVA   = IF(P_CAP_DIGITAL_PREVIA, P_T_CAPACITACION*(1-P_REDUCCION_CAP), P_T_CAPACITACION)
P_JORNADA_DIA_TOPE = P_JORNADA_DIA_MAX + IF(P_PERMITE_HORAS_EXTRA, P_HORAS_EXTRA_MAX_DIA, 0)
```

Ambos `IF()` reciben un parámetro que contiene el **texto** `"Si"`, y Sheets no convierte
texto a booleano. Falta comparar: `IF(P_CAP_DIGITAL_PREVIA="Si", …)`. El error se propaga a
la tabla `T_SEMAFORO`, cuya celda del tope diario también aparece rota.

La implementación nueva no reproduce este defecto porque sus parámetros booleanos son
casillas de verificación reales, no texto `Si`/`No`.

## Qué se incorporó en esta sesión

- **`P_BASE`**: se adopta la dirección completa del libro, que es la que Maps geocodifica.
- **`P_FACTOR_HORAS` = 1,1**: el libro corrige el tiempo puro de Maps en 10 %. Las
  velocidades calibradas son la medición cruda, así que el factor va aparte y queda visible
  como parámetro, en vez de quedar escondido dentro de la velocidad.
- **`P_CAPACIDAD_CAMIONETA` = 3**: `AGENDAR` validaba la dotación contra el tamaño de la
  cuadrilla, que es una cosa distinta del tope físico del vehículo. Ahora valida contra la
  capacidad real.
- **`P_HORAS_EXTRA_SEMANA` = 10**: no existía control semanal de horas extra. El motor ahora
  acumula por técnico y semana civil y alerta cuando se pasa.

### Coincide (18)

> Mismo nombre y mismo valor

| Parámetro del libro | Valor | Qué dice |
|---|---|---|
| `P_CAMIONETAS` | 6 | Camionetas disponibles |
| `P_COLACION_H` | 5 | Horas de colacion por semana |
| `P_COSTO_KM` | 60 | Costo de desgaste y mantencion |
| `P_DIAS_SEMANA` | 5 | Dias laborales por semana |
| `P_DIESEL` | 1381 | Precio del diesel |
| `P_FECHA_INICIO` | 21-09-2026 | Fecha de inicio del plan |
| `P_HOTEL` | 50000 | Hotel u hostal por noche por persona |
| `P_JORNADA_DIA` | 7.4 | Jornada diaria efectiva |
| `P_JORNADA_DIA_MAX` | 8.4 | Jornada diaria contractual |
| `P_JORNADA_EFECTIVA` | 37 | Jornada semanal efectiva |
| `P_JORNADA_SEMANAL` | 42 | Jornada semanal contractual |
| `P_REDUCCION_CAP` | 0.5 | Reduccion de tiempo por capacitacion digital previa |
| `P_RENDIMIENTO` | 20 | Rendimiento camioneta Peugeot Partner |
| `P_TECNICOS` | 10 | Tecnicos disponibles |
| `P_T_CAPACITACION` | 0.5 | Tiempo de capacitacion |
| `P_T_INSTALACION` | 2 | Tiempo de instalacion por equipo |
| `P_UMBRAL_PERNOCTA` | 4 | Umbral de horas de ida para pernoctar |
| `P_VIATICO` | 25000 | Viatico diario por tecnico desplegado |

### Coincide con otro nombre (7)

> Mismo concepto y mismo efecto, nombre distinto

| Parámetro del libro | Valor | Qué dice |
|---|---|---|
| `P_COLACION_RM` | 5000 | Colacion por dia trabajando dentro de la RM |
| `P_CONDUCCION_MAX_DIA` | 9 | Maximo de horas al volante por dia |
| `P_COSTO_HORA_TECNICO` | 6500 | Costo empresa por hora-tecnico |
| `P_HOLGURA_IMPREVISTOS` | 0.1 | Holgura para imprevistos |
| `P_HORAS_EXTRA_MAX_DIA` | 2 | Maximo de horas extra por dia |
| `P_RECARGO_HORA_EXTRA` | 1.5 | Recargo legal de la hora extra |
| `P_REDONDEO_TRANSFERENCIA` | 1000 | Redondear la transferencia hacia arriba a |

### Incorporado ahora (4)

> Se trajo del libro a la implementacion nueva

| Parámetro del libro | Valor | Qué dice |
|---|---|---|
| `P_BASE` | INACAP Sede Santiago Sur, Av. Vicuna Mackenna 3864, Macul, Chile | Direccion de la base de operaciones |
| `P_CAPACIDAD_CAMIONETA` | 3 | Maximo de tecnicos por camioneta |
| `P_FACTOR_HORAS` | 1.1 | Factor de correccion sobre el tiempo de Maps |
| `P_HORAS_EXTRA_MAX_SEMANA` | 10 | Maximo de horas extra por semana |

### Roto en el libro (2)

> Devuelve #ERROR!: IF() sobre un parametro de texto Si/No. La implementacion nueva lo calcula bien

| Parámetro del libro | Valor | Qué dice |
|---|---|---|
| `P_JORNADA_DIA_TOPE` | #ERROR! | Tope diario absoluto con horas extra |
| `P_T_CAP_EFECTIVA` | #ERROR! | Capacitacion presencial efectiva |

### Superado por el plan conciliado (4)

> Decision posterior documentada; requiere confirmacion explicita

| Parámetro del libro | Valor | Qué dice |
|---|---|---|
| `P_HORIZONTE_MAX_DIAS` | 20 | Tope de dias habiles del plan |
| `P_TECNICOS_POR_CUADRILLA` | 3 | Tecnicos por cuadrilla |
| `P_TRANSFIERE_COMBUSTIBLE` | No | La transferencia incluye el combustible |
| `P_VIATICO_SOLO_CON_PERNOCTACION` | Si | El viatico se paga solo en viajes de mas de un dia |

### Regla cableada (12)

> La regla se cumple, pero esta escrita en el codigo y no es editable desde CONFIG

| Parámetro del libro | Valor | Qué dice |
|---|---|---|
| `P_AGRUPA_POR_CORREDOR` | Si | Agrupar localidades del mismo corredor |
| `P_CAP_BASE` | Por localidad | Base de la capacitacion |
| `P_CAP_DIGITAL_PREVIA` | Si | Se envia la capacitacion digital antes de la visita |
| `P_GASTOS_VEHICULO_AL_CONDUCTOR` | Si | Combustible y peaje se cargan solo al conductor |
| `P_HABITACION_INDIVIDUAL` | Si | Una habitacion por tecnico |
| `P_OMITIR_FIN_SEMANA` | Si | Nunca agendar sabado ni domingo |
| `P_PARALELIZA_INSTALACION` | Si | Instalacion paralelizable en el sitio |
| `P_PERMITE_HORAS_EXTRA` | Si | Se autorizan horas extra |
| `P_TECNICOS_RESIDEN_RM` | Si | Todos los tecnicos viven en la Region Metropolitana |
| `P_TRANSFIERE_HOTEL` | Si | La transferencia incluye el hotel |
| `P_TRANSFIERE_VIATICO` | Si | La transferencia incluye el viatico |
| `P_VIATICO_SOLO_FUERA_RM` | Si | El viatico se paga solo fuera de la Region Metropolitana |

### Sin implementar (13)

> Criterio del libro que la implementacion nueva todavia no aplica

| Parámetro del libro | Valor | Qué dice |
|---|---|---|
| `P_CAP_ENVIO_OBLIGATORIO` | Si | Exigir confirmacion del envio del enlace |
| `P_DIAS_FUERA_INCOMODOS` | 3 | Dias fuera de casa desde los que se marca desgaste |
| `P_EQUIPOS_MIN_RESPALDO` | 3 | Equipos desde los que conviene ir con respaldo |
| `P_ESTRATEGIA_RUTEO` | Periferia primero | Orden de atencion de las localidades |
| `P_EXIGIR_TAMANO_CUADRILLA` | No | Exigir que todas las cuadrillas tengan ese tamano |
| `P_HORAS_MANEJO_SOLO_MAX` | 5 | Maximo de horas manejando sin acompanante |
| `P_MIN_TECNICOS_FUERA_RM` | 1 | Minimo de tecnicos para salir de la Region Metropolitana |
| `P_OBJETIVO` | Costo minimo | Que optimiza el planificador |
| `P_PREFIERE_EXTRA_SOBRE_HOTEL` | Si | Preferir horas extra antes que pernoctar |
| `P_SEMANAS` | 2 | Semanas del horizonte de plan |
| `P_SOBRECOSTO_ACEPTABLE` | 0.7 | Sobrecosto que se acepta por bajar el riesgo |
| `P_TECNICOS_MAX_POR_SITIO` | 0 | Maximo de tecnicos trabajando a la vez en un sitio |
| `P_VALORA_TIEMPO_TECNICO` | Solo si genera sobretiempo | Como se valoriza el tiempo de viaje extra |

### No aplica (16)

> Politica de consulta en linea a Maps; la implementacion nueva usa kilometros ya fijados

| Parámetro del libro | Valor | Qué dice |
|---|---|---|
| `P_MAPS_ALCANCE` | Km y tiempo | Que se le pide a Google Maps |
| `P_MAPS_CACHE_DIAS` | 30 | Vigencia de la cache de rutas |
| `P_MAPS_COMPARA_SIN_PEAJE` | Si | Consultar tambien la ruta sin peajes |
| `P_MAPS_EVITAR_PEAJES` | No | Pedir a Maps rutas sin peaje |
| `P_MAPS_HORA_SALIDA` | 08:00 | Hora de salida de referencia |
| `P_MAPS_MAX_CONSULTAS` | 120 | Tope de consultas por ejecucion |
| `P_MAPS_MODO` | DRIVE | Medio de transporte consultado a Maps |
| `P_MAPS_PREFERENCIA` | TRAFFIC_AWARE | Preferencia de calculo de ruta |
| `P_PEAJE_AMBOS_SENTIDOS` | Si | Cobrar peaje en ida y en regreso |
| `P_PEAJE_CATEGORIA` | Categoria 1 · auto y camioneta | Categoria de vehiculo para el peaje |
| `P_PEAJE_FUENTE` | PLAZAS | Origen del valor de peaje |
| `P_PEAJE_MEDIO_PAGO` | TAG corporativo | Medio de pago del peaje |
| `P_PEAJE_TARIFA_HORARIO` | Normal | Horario tarifario aplicado |
| `P_PEAJE_TARIFA_VIGENCIA` | 2026 | Vigencia de las tarifas cargadas |
| `P_RODEO_AHORRO_MINIMO` | 3000 | Ahorro minimo para justificar un rodeo |
| `P_RODEO_MAX_HORAS` | 0.75 | Maximo de tiempo adicional aceptable por rodear |

### Fuera de alcance (18)

> Comparadores de bus, avion y taxi: el plan autorizo eliminarlos

| Parámetro del libro | Valor | Qué dice |
|---|---|---|
| `P_ARRIENDO` | 45000 | Arriendo de vehiculo en destino |
| `P_CHECKIN_AEROPUERTO_H` | 1.5 | Tiempo previo al vuelo |
| `P_EQUIPAJE_BODEGA_AVION` | 18000 | Equipaje de bodega en avion, por tecnico y por tramo |
| `P_FACTOR_TRANSPORTE_PUBLICO` | 2 | Cuanto mas lento es el metro o la micro |
| `P_FLETE_HERRAMIENTAS` | 35000 | Costo de trasladar el set de herramientas |
| `P_HERRAMIENTAS_TRANSPORTABLES` | Si | Las herramientas pueden viajar sin camioneta |
| `P_KM_MAX_TRANSPORTE_PUBLICO` | 40 | Alcance del metro y la micro desde la base |
| `P_KM_TAXI_DIA` | 20 | Kilometros de taxi por dia en el destino |
| `P_KM_TERMINAL_CIUDAD` | 12 | Kilometros del aeropuerto o terminal a la ciudad |
| `P_PAGA_PASAJE_TRANSPORTE_PUBLICO` | Si | Se le reembolsa el pasaje de micro o metro |
| `P_PERMITE_AVION` | Si | Avion habilitado |
| `P_PERMITE_BUS` | Si | Bus interurbano habilitado |
| `P_PERMITE_TRANSPORTE_PUBLICO` | Si | Metro y micro habilitados |
| `P_RETIRO_EQUIPAJE_H` | 0.5 | Tiempo de desembarque y retiro de equipaje |
| `P_TAXI_POR_KM` | 1000 | Tarifa promedio de taxi |
| `P_TIEMPO_A_AEROPUERTO_H` | 0.75 | Tiempo de la base al aeropuerto o terminal |
| `P_TRANSPORTE_PUBLICO` | 1500 | Pasaje de metro o micro por tramo |
| `P_TRASLADO_AEROPUERTO` | 25000 | Traslado terminal - ciudad por trayecto |

### Analisis (3)

> Costos de mejora futura, no del plan operativo

| Parámetro del libro | Valor | Qué dice |
|---|---|---|
| `P_COSTO_CAMIONETA_NUEVA` | 16500000 | Costo de una camioneta adicional |
| `P_COSTO_SET_HERRAMIENTAS` | 2800000 | Costo de un set de herramientas portatil |
| `P_COSTO_TECNICO_MES` | 1400000 | Costo mensual de un tecnico adicional |
