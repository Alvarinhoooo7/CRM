# Demo local del CRM en ruta: tres vistas con login

Fecha: 15-09-2026. Rama: `planilla-funcional`.

## Contexto y por que existe este documento

El caso de estudio pide un software para un servicio tecnico que atiende instalaciones a lo
largo de Chile: 10 tecnicos, 6 camionetas Peugeot Partner (20 km/L), 33 equipos repartidos en
16 comunas, 2 h de instalacion por equipo, 30 min de capacitacion, y el calculo completo de
traslados, peajes, alojamiento y viaticos hasta determinar cuanto dinero hay que transferirle
a cada tecnico.

Lo que falta es la capa de presentacion: tres interfaces con login propio — supervisor,
coordinador y tecnico — que se puedan mostrar en una presentacion sin depender de una cuenta
Google ni de conexion.

### Estado del repositorio al escribir este documento

El arbol de trabajo esta vacio: 69 archivos figuran como borrados sin commitear. El usuario
decidio **no restaurarlos**. Todo lo commiteado hasta `ac8264e` sigue en `.git` y de ahi se
leyeron los parametros y la semilla que usa este diseno. Seis archivos que nunca estuvieron
trackeados (`Dashboard.html`, `DialogoAsignar.html`, `DialogoCalendario.html`,
`DialogoConfirmacion.html`, `DialogoDocumentos.html`, `DialogoTaller.html`) se perdieron y no
son recuperables.

En consecuencia, la demo **se construye desde cero en `demo/`** y no depende de ningun
archivo del arbol de trabajo.

### Discrepancia detectada en la documentacion heredada

`docs/ESPECIFICACION_CONCILIADA.md` declara 14 jornadas, 28 ordenes y 476 filas de checklist.
`apps-script/Semilla.gs` define 15 jornadas, que con 2 tecnicos dan 30 ordenes y 510 filas de
checklist. La semilla es codigo y es posterior al documento, asi que **manda la semilla**.
Este diseno usa 15 jornadas como plan inicial.

## Decisiones tomadas

| Decision | Valor | Motivo |
|---|---|---|
| Plataforma | HTML local, doble clic, sin servidor | No depende de cuenta Google, deploy ni internet el dia de la presentacion |
| Estructura | Un `index.html` + scripts clasicos | Un solo store compartido: lo que hace el tecnico se ve en el supervisor |
| Motor | Calculo dinamico real | Crear una orden mueve la nomina y el costo total en vivo |
| Persistencia | `localStorage` con caida a memoria | Sobrevive al F5; si el navegador la bloquea, la demo igual funciona |
| Correos | Bandeja de salida simulada | Sin servidor de correo y sin abrir ventanas ajenas en plena presentacion |
| Asignacion | 10 tecnicos como pool libre | Se eliminan las cuadrillas fijas C1-C5 |
| Google Maps | Solo deep link con coordenadas | Sin API key, sin CORS, sin riesgo de geocodificacion fallida |

### Por que un archivo con tres logins y no tres archivos sueltos

El tecnico marca inicio y fin de trabajo, y el supervisor tiene que ver esa metrica. El
coordinador crea una orden y el tecnico tiene que verla aparecer. Con tres paginas
independientes ese estado compartido no existe y en la presentacion se nota. Un solo store en
memoria con tres vistas encima hace que la demo se sostenga sola.

### Por que scripts clasicos y no modulos ES

Sobre `file://` el navegador bloquea los modulos ES y `fetch`, pero **si** permite
`<script src="...">` clasico hacia un archivo hermano. El orden de carga define los globales,
igual que la convencion de archivos `.gs` numerados del proyecto.

## Arquitectura

```
demo/
  index.html              login + contenedor de las tres vistas
  css/estilos.css         sistema visual compartido
  js/00_datos.js          semilla y parametros P_*
  js/01_motor.js          calculo puro, sin DOM
  js/02_estado.js         store, localStorage, notificacion a las vistas
  js/03_supervisor.js
  js/04_coordinador.js
  js/05_tecnico.js
  js/06_app.js            login, enrutado, arranque
  js/clave.local.js       NO EXISTE y NO SE VERSIONA (ver Seguridad)
  pruebas.cjs             cuadraturas del motor, se corre con node
README.md                 documentacion por pestana (raiz del repo)
```

Flujo de datos, en una direccion:

```
accion en una vista  ->  estado.despachar(accion)
                     ->  motor.recalcularPlan(estado)
                     ->  estado.notificar()
                     ->  las tres vistas se redibujan
                     ->  almacen.guardar()  (localStorage, best-effort)
```

Ninguna vista escribe en el estado directamente ni llama al motor. El motor no toca el DOM ni
`localStorage`. Esa separacion es lo que permite probar el motor con `node`.

### Convenciones de codigo

Se mantienen las del proyecto: espanol en nombres, variables y comentarios; comentarios de
cabecera sin tildes; `var` y funciones globales, sin `const`, `let`, arrow functions ni
clases. Toda constante economica u operacional vive en `PARAMETROS`, nunca cableada en el
calculo.

## Datos semilla

Leidos de `apps-script/Semilla.gs` en `HEAD`. Se conservan tal cual salvo las coordenadas,
que son nuevas.

### Parametros (`PARAMETROS`)

| Codigo | Valor | Unidad |
|---|---:|---|
| `P_RENDIMIENTO` | 20 | km/L |
| `P_DIESEL` | 1381 | $/L |
| `P_COSTO_KM` | 60 | $/km (desgaste) |
| `P_CAMIONETAS` | 6 | unidades |
| `P_CAPACIDAD_CAMIONETA` | 3 | personas |
| `P_TECNICOS` | 10 | personas |
| `P_JORNADA_SEMANAL` | 42 | h |
| `P_COLACION_H` | 5 | h |
| `P_JORNADA_EFECTIVA` | 37 | h (derivado) |
| `P_DIAS_SEMANA` | 5 | dias |
| `P_JORNADA_DIA` | 7,4 | h (derivado) |
| `P_JORNADA_DIA_MAX` | 8,4 | h (derivado) |
| `P_MAX_EXTRA` | 2 | h/dia |
| `P_HORAS_EXTRA_SEMANA` | 10 | h/semana |
| `P_TOPE_DIA` | 10,4 | h (derivado) |
| `P_TOPE_CONDUCCION` | 9 | h/dia |
| `P_VALOR_HORA` | 6500 | $/h |
| `P_RECARGO_EXTRA` | 0,5 | incremento sobre la hora normal |
| `P_T_INSTALACION` | 2 | h/equipo |
| `P_T_CAPACITACION` | 0,5 | h |
| `P_REDUCCION_CAP` | 0,5 | factor si el link ya se envio |
| `P_T_CAP_EFECTIVA` | 0,25 | h (derivado) |
| `P_HOTEL` | 50000 | $/persona/noche |
| `P_VIATICO` | 25000 | $/dia |
| `P_COLACION` | 5000 | $/dia |
| `P_IMPREVISTOS` | 0,1 | reserva de emergencia |
| `P_FACTOR_HORAS` | 1,1 | correccion sobre tiempo puro de Maps |
| `P_VEL_URBANA` | 36 | km/h |
| `P_VEL_R78` | 69 | km/h |
| `P_VEL_RUTA5` | 80 | km/h |
| `P_UMBRAL_PERNOCTA` | 4 | h de ida |
| `P_REDONDEO` | 1000 | $ hacia arriba |
| `P_FECHA_INICIO` | 21-09-2026 | fecha |
| `P_BASE` | INACAP Sede Santiago Sur, Av. Vicuna Mackenna 3864, Macul | direccion |

### Destinos

16 comunas, 33 equipos. Km y peaje vienen de la cache `_RUTAS` del libro original y del
catalogo de plazas MOP 2026.

| ID | Comuna | Region | Corredor | Km ida | Peaje ida | Equipos |
|---|---|---|---|---:|---:|---:|
| D01 | Copiapo | Atacama | R5N | 812,2 | 28.582 | 5 |
| D02 | Coquimbo | Coquimbo | R5N | 469,8 | 15.132 | 2 |
| D03 | La Calera | Valparaiso | R5N | 121,7 | 5.082 | 1 |
| D04 | San Antonio | Valparaiso | R78 | 115,7 | 4.008 | 2 |
| D05 | Melipilla | Metropolitana | R78 | 73,7 | 2.847 | 2 |
| D06 | Lo Barnechea | Metropolitana | URB | 23,9 | 1.498 | 3 |
| D07 | Puente Alto | Metropolitana | URB | 12,6 | 1.005 | 1 |
| D08 | Santiago | Metropolitana | URB | 10,0 | 678 | 3 |
| D09 | Pudahuel | Metropolitana | URB | 18,7 | 1.767 | 3 |
| D10 | Maipu | Metropolitana | URB | 16,9 | 1.206 | 3 |
| D11 | Curico | Maule | R5S | 194,7 | 5.249 | 1 |
| D12 | Talca | Maule | R5S | 258,7 | 5.249 | 3 |
| D13 | San Pedro de la Paz | Biobio | R5S | 508,1 | 16.421 | 1 |
| D14 | Penco | Biobio | R5S | 493,7 | 15.649 | 1 |
| D15 | Santa Juana | Biobio | R5S | 556,3 | 15.649 | 1 |
| D16 | Tome | Biobio | R5S | 507,6 | 15.649 | 1 |

**Coordenadas**: se agrega `Lat` y `Lng` a cada destino y a la base, para armar los enlaces de
Google Maps sin geocodificar. Son aproximadas al centro de la direccion municipal y estan
marcadas como tales en los datos; su unico uso es abrir Maps en el punto correcto.

### Tecnicos

10 tecnicos como **pool individual**. Se conserva el campo `Licencia`: Paulina Herrera (T08) y
Barbara Neira (T10) no tienen licencia y por lo tanto nunca pueden ser conductores.

Se eliminan los campos `Cuadrilla` y `Vehiculo_Habitual`: la asignacion la decide el
coordinador trabajo por trabajo.

Correos: `nombre.apellido@serviciotecnico.cl`, sin tildes.

### Flota

6 Peugeot Partner, `V1` a `V6`. `V6` esta en estado Reserva. Cada una con km inicial, km de
proxima mantencion y vencimientos de revision tecnica, seguro y permiso de circulacion.

### Implementos del checklist

17 items obligatorios, en tres categorias:

- **Bolso (8)**: multimetro y pinza, crimpeadora y tester de red, kit de fibra optica,
  taladro percutor, destornilladores aislados y llaves, notebook de puesta en marcha, equipo
  de reemplazo, cinta y canaletas.
- **Vehiculo (4)**: escalera telescopica, equipos del dia, extension y senaletica, documentos
  del vehiculo y TAG.
- **Persona (5)**: EPP completo, arnes, botiquin y linterna, celular cargado, tarjeta
  corporativa.

### Plan inicial

Las 15 jornadas de la semilla se cargan ya armadas, con sus tramos, km, peajes, equipos y
noches. Con 2 tecnicos por jornada dan 30 ordenes y 510 filas de checklist. Todo es
reasignable desde la vista del coordinador.

## El motor (`01_motor.js`)

Funciones puras portadas de `Motor.gs`. Ninguna lee el DOM ni `localStorage`.

```
horasViaje(km, corredor)   = km / velocidad[corredor] * P_FACTOR_HORAS
                             URB 36 · R78 69 · R5N y R5S 80 km/h

horasInstalacion(equipos, tecnicosEnSitio)
                           = equipos * P_T_INSTALACION / tecnicosEnSitio

horasCapacitacion(sesiones, linkEnviado)
                           = sesiones * (linkEnviado ? 0,25 : 0,5)

combustible(km)            = km / P_RENDIMIENTO * P_DIESEL
peaje                      = suma de tramos, ida y vuelta
desgaste(km)               = km * P_COSTO_KM

estipendio(jornada)        = viatico 25.000 si algun tramo sale de la RM
                             colacion 5.000 si la jornada es integra RM

hotel(noches)              = noches * P_HOTEL   (habitacion individual por tecnico)

horasExtra(horas)          = max(0, horas - P_JORNADA_DIA)
costoHorasExtra(he)        = he * P_VALOR_HORA * (1 + P_RECARGO_EXTRA)
                             tope 2 h/dia y 10 h/semana por tecnico

transferencia(tecnico)     = base * (1 + P_IMPREVISTOS), redondeo arriba al millar
```

### Reglas de negocio que el motor debe respetar

1. Solo el **conductor** de cada vehiculo y jornada recibe combustible y peajes. Un tecnico
   sin licencia nunca es conductor.
2. El **desgaste** de $60/km es costo de empresa: entra al costo total pero **no** se
   transfiere a nadie.
3. El **10%** es reserva de emergencia: se transfiere junto con el viatico, pero se rinde
   aparte y el tecnico solo puede tocarla en emergencia.
4. Viatico y colacion son excluyentes. Los retornos desde region tambien reciben viatico.
5. La instalacion es paralelizable en sitio; la capacitacion no: su duracion se carga a todos
   los asistentes.
6. Nunca se agenda sabado ni domingo.
7. Una jornada que supera `P_TOPE_DIA` (10,4 h) genera alerta, no se descarta sola.
8. Una ida que supera `P_UMBRAL_PERNOCTA` (4 h) obliga a pernoctar.
9. Maximo `P_CAPACIDAD_CAMIONETA` (3) tecnicos por vehiculo.

### Salida

`recalcularPlan(estado)` devuelve `{ordenes, nomina, resumen, alertas}` y se ejecuta completo
en cada cambio. Con 30 ordenes es instantaneo, no hace falta calculo incremental.

## Vista de login

Tres tarjetas. Un clic autocompleta correo y contrasena y solo queda apretar **Ingresar**.
Las credenciales quedan impresas en pantalla para que la presentacion fluya.

| Vista | Correo | Clave |
|---|---|---|
| Supervisor | `supervisor@serviciotecnico.cl` | `123` |
| Coordinador | `coordinador@serviciotecnico.cl` | `123` |
| Tecnico | `alvaro.fuentes@serviciotecnico.cl` | `123` |

Dentro de la vista del tecnico, un desplegable permite entrar como cualquiera de los 10 sin
volver al login.

Esto **no es autenticacion**: es un selector de rol con apariencia de login, para una demo
local. Queda dicho explicitamente en el README para que nadie lo confunda con seguridad.

## Vista supervisor — escritorio

### Pestana Resumen
KPIs: costo presupuestado, transferido, rendido, brecha, equipos `n/33`, avance, horas extra,
alertas abiertas.

### Pestana Finanzas
Costo por comuna, prorrateado por equipos e incluyendo los traslados exclusivos del corredor.
Es un **reparto contable declarado**, no un costo geografico exacto, y el grafico lo dice.
Costo por categoria: combustible, peajes, viaticos, colaciones, hotel, horas extra, desgaste.

### Pestana Desempeno
Por tecnico: horas planificadas vs. reales, desviacion, cumplimiento de checklist,
puntualidad segun los sellos de hora, equipos instalados, gastos rendidos vs. anticipo.

### Pestana Nomina
Tabla T01-T10 con monto base, reserva del 10%, total transferido, rendido y saldo.

### Pestana Gastos
Cola de comprobantes subidos por los tecnicos, con la foto adjunta. Aprobar o rechazar
realimenta el monto rendido y por lo tanto la brecha del resumen.

### Pestana Parametros
Panel tipo CONFIG: diesel, viatico, colacion, hotel, valor hora, costo por km, reserva,
rendimiento. Editar cualquiera recalcula todos los KPI al instante. Demuestra que nada esta
cableado. Boton para volver a los valores de la semilla.

### Exportar
Hoja de estilos `@media print` para que `Ctrl+P` genere un informe limpio con KPIs, nomina y
graficos, servible como anexo de la evaluacion.

### Graficos
SVG dibujado a mano, sin librerias. En `file://` y sin internet ninguna CDN carga, asi que no
se usa ninguna.

## Vista coordinador — escritorio

### Pestana Ordenes
Bandeja de las ordenes con filtro por estado, tecnico, comuna y fecha.

### Pestana Nueva orden
Formulario: Empresa · Region (select) -> Comuna (select dependiente) · Direccion (texto) ·
Numero (texto) · Nombre del cliente · Correo del cliente · Equipos · Fecha.

Flujo en dos pasos: **Simular** muestra horas, itinerario dia a dia, noches de hotel, costo y
a quien le tocaria. Recien entonces se habilita **Confirmar**. Es el flujo que ya tenia
`Agenda.html`.

### Pestana Asignacion
Disponibilidad en vivo de los 10 tecnicos (libre, en ruta, sin licencia, en tope de horas
extra) y de las 6 camionetas. El coordinador arma el equipo del trabajo: 1 tecnico solo, 2, o
hasta 3 por camioneta.

**Autoasignar** propone el equipo segun carga horaria, licencia y vehiculo libre, y **explica
por que eligio ese**. El coordinador acepta o cambia a mano.

Validaciones que bloquean: equipo sin conductor con licencia, tecnico sobre el tope de horas
extra, mas de 3 por camioneta, vehiculo en taller.

### Pestana Calendario
Semana con las jornadas, arrastrables a otro dia. Al soltar, revalida y recalcula.

### Pestana Flota
Estado de las 6 camionetas, km y vencimientos. Marcar una **en taller** muestra que jornadas
quedan sin vehiculo y como se reacomodan con la V6 de reserva. Es la evidencia del argumento
de por que hace falta otra camioneta.

### Pestana Capacitacion
Redactar el correo, previsualizarlo completo con el link, enviar. Queda en **Enviados** con
fecha y estado, y **marca el destino como capacitacion digital enviada**: su tiempo baja de 30
a 15 min y el motor lo recalcula al instante.

### Exportar nomina
Descarga un CSV con tecnico, RUT ficticio, monto y detalle, listo para subir al banco.

## Vista tecnico — telefono

Marco de celular centrado en la pantalla, con la app dentro, completamente usable con mouse.

### Flujo bloqueante
Los **17 items del checklist antes que nada**. Hasta marcarlos todos, la orden y la ruta salen
difuminadas y no se abren. Es el requisito explicito del caso.

### Pantalla Hoy
Ordenes del dia. Estado y hora de cada una.

### Pantalla Checklist
17 items en tres grupos. Contador de progreso. Al completar, se desbloquea la orden.

### Pantalla Orden
Cliente, direccion, equipos a instalar, capacitacion. Botones:
- **Abrir ruta en Maps**: arma el enlace con coordenadas y waypoints encadenados de toda la
  jornada, y lo abre en una pestana nueva.
- **Llamar**: enlace `tel:` al contacto del cliente.
- **Iniciar trabajo** / **Finalizar trabajo**: registran hora y coordenadas del destino, y
  marcan si el tecnico estaba dentro o fuera del sitio.

### Pantalla Cierre
Equipos instalados, **firma del cliente** en canvas con el mouse, y **foto de la instalacion
terminada**. Ambas quedan guardadas en la orden y el supervisor las ve.

### Pantalla Mi plata
Lo que le transfirieron, lo que lleva rendido, lo que le queda y cuanto de eso es la reserva
del 10% que solo puede tocar en emergencia.

### Pantalla Gastos
Subir comprobante de viatico, colacion, peaje o combustible con foto. Se lee a data-URL y
queda como miniatura. Va a la cola de revision del supervisor.

## Google Maps

Solo enlaces profundos, sin API key y sin llamadas de red desde la pagina:

```
https://www.google.com/maps/dir/?api=1
  &origin=-36.8420,-73.1050
  &destination=-37.1720,-72.9420
  &waypoints=-36.7400,-72.9930|-36.6180,-72.9560
  &travelmode=driving
```

Se usan **coordenadas y no texto**: asi Maps no geocodifica y no puede equivocarse de
direccion. La direccion de texto queda solo como etiqueta visible en la interfaz.

No se integra Routes API. Desde `file://` el navegador no manda `Referer`, asi que una key
restringida por referente seria rechazada; una key sin restriccion no debe quedar en un
archivo; y la llamada puede morir en CORS. Ademas, colgar la demo de una llamada de red
significa que sin internet no se ve nada. Los km, peajes y tiempos salen de la semilla, que
son consultas Maps reales ya hechas y guardadas.

## Persistencia

`02_estado.js` expone un `almacen` que intenta `localStorage` y cae a memoria si el navegador
lo bloquea — sobre `file://` el comportamiento varia segun navegador y configuracion. Toda
lectura y escritura va en `try/catch`. Si cae a memoria, la interfaz lo dice y la demo sigue
funcionando; solo se pierde el estado al recargar.

Boton **Reiniciar demo** que vuelve al estado semilla, con confirmacion.

## Seguridad

- `demo/js/clave.local.js` se agrega a `.gitignore`. Hoy no se usa, pero queda reservado para
  que nadie meta una API key en un archivo versionado mas adelante.
- El login **no es autenticacion**. Es un selector de rol con credenciales impresas en
  pantalla, para una demo local. El README lo dice explicitamente.
- No hay datos personales reales: los 10 tecnicos son nombres de demostracion y los telefonos
  son `+569 XXXX XXXX`.

## Validacion

`demo/pruebas.cjs`, que se corre con `node demo/pruebas.cjs`. El motor es JS puro sin DOM, asi
que se puede cargar con `vm.Script` igual que hace `scripts/check-sintaxis.js`.

Cuadraturas que verifica:

1. 33 equipos previstos, 16 comunas, 16 capacitaciones.
2. 15 jornadas, 30 ordenes, 510 filas de checklist.
3. La suma de la nomina individual iguala el total de la nomina.
4. Costo total = nomina con reserva + desgaste + horas extra.
5. Ningun tecnico sin licencia figura como conductor.
6. Ninguna jornada supera `P_TOPE_DIA` sin generar alerta.
7. Ninguna jornada excede `P_CAPACIDAD_CAMIONETA`.
8. Enviar el link de capacitacion reduce las horas de capacitacion exactamente a la mitad.
9. Cambiar `P_DIESEL` mueve el combustible proporcionalmente y no toca peajes ni viaticos.

Estas pruebas verifican **reglas y cuadraturas**, no importes fijos: los valores concretos
cambian si se editan los tramos o los parametros, y eso es correcto.

## Documentacion

`README.md` en la raiz del repositorio, **organizado por pestana**: que hace cada vista, cada
pestana, cada boton y cada campo, y que regla de negocio hay detras. Incluye las credenciales,
como abrir la demo, como reiniciarla y como correr las pruebas.

## Lo que este diseno no incluye

- **Simulador de escenarios** del supervisor (comprar camioneta, contratar tecnicos): el
  usuario lo descarto. El panel de parametros editables cubre parcialmente el caso de "que
  pasa si sube el diesel".
- **Mapa de Chile** con los destinos: descartado por el usuario.
- **Routes API y mapa embebido**: descartados por riesgo en presentacion.
- **La conclusion escrita de la mejora futura** (personal vs. camionetas). La demo entrega los
  datos — costo por corredor, jornadas bloqueadas por falta de vehiculo, horas extra por
  tecnico — pero la justificacion que pide el caso la escribe el usuario, porque depende de lo
  que decida defender en la presentacion.
