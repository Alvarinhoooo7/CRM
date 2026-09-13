# 📖 Manual a Prueba de Tontos: Servicio Técnico en Ruta

¡Hola! Bienvenido al manual definitivo del sistema de **Coordinación y Agendamiento**. 
Este documento está diseñado para que **cualquier persona**, incluso si no tiene conocimientos técnicos, entienda exactamente qué hace este sistema, cómo funciona la conexión entre el Excel (Google Sheets) y la Web, y cómo operarlo en el día a día.

Lee este documento con calma. Si sigues estos pasos, tendrás el control total del sistema.

---

## 🧠 1. El Concepto Básico: ¿Qué es este sistema?

Este sistema administra **33 instalaciones de equipos en 16 localidades distintas de Chile**. Para hacer este trabajo cuentas con **10 técnicos y 6 camionetas**.

El sistema tiene dos partes fundamentales que trabajan juntas:
1. **El Excel (Google Sheets) = Tu Base de Datos 🗄️**: Aquí es donde "viven" los datos. Las hojas de cálculo guardan la lista de técnicos, las direcciones de los clientes, los peajes y las órdenes guardadas. Si quieres cambiar el sueldo de un técnico, lo haces aquí.
2. **La Página Web = Tu Motor de Cálculo ⚙️**: Es la cara bonita e inteligente del sistema. La web lee los datos del Excel, consulta a Google Maps las distancias, hace cálculos matemáticos complejos (como sumar peajes, calcular horas extras y desgaste de camionetas) y te los muestra en gráficos y tablas fáciles de entender.

> [!WARNING]
> **REGLA DE ORO**: La Web **NO SE ACTUALIZA SOLA** en tiempo real si cambias algo en el Excel. Si vas al Excel y le cambias el sueldo a un técnico, tienes que ir a la Web y presionar el botón **Recalcular** para que la Web lea el Excel de nuevo y haga los cálculos con el nuevo sueldo.

---

## 🚀 2. Instalación y Configuración (Se hace UNA SOLA VEZ)

Para que el sistema funcione, necesitas configurar 3 cosas. Solo debes hacerlo la primera vez.

### Paso 2.1: Dar acceso a los correos y crear la contraseña
El sistema no usa tu cuenta de Google normal para entrar, usa una lista de correos que tú autorices y una **contraseña única** que todos compartirán.

1. Abre tu **Google Sheets (El Excel)**.
2. Arriba en el menú, haz clic en **Extensiones > Apps Script**. Se abrirá una nueva pestaña con código.
3. En la barra izquierda de esta nueva pestaña, haz clic en la **Rueda de Engranaje (Configuración del proyecto)**.
4. Baja hasta el final donde dice **Propiedades de la secuencia de comandos**.
5. Agrega dos propiedades:
   * Escribe **`ACCESO_EMAIL`** y al lado pon los correos que quieres que entren, separados por coma (ejemplo: `jefe@empresa.cl, tecnico@empresa.cl`).
   * Escribe **`ACCESO_CLAVE_INICIAL`** y al lado inventa una contraseña (debe tener mínimo 10 letras/números).
6. Presiona **Guardar**.
7. Ahora, vuelve al código haciendo clic en el ícono de `</>` (Editor) a la izquierda.
8. En la lista de archivos, selecciona `06_Api.gs`. Arriba en la barra verás un menú desplegable, elige la opción `configurarAcceso_` y presiona el botón **Ejecutar**.
   * *¿Para qué hicimos esto? Para encriptar tu contraseña y que sea imposible de hackear. ¡Tu acceso ya está listo!*

### Paso 2.2: Conectar Google Maps (Vital para la Camioneta)
> [!IMPORTANT]
> Si la Web no te deja elegir la opción de **Camioneta** en el calendario y solo te ofrece Buses, es porque te saltaste este paso. Al no tener Google Maps conectado, el sistema no sabe a cuántos kilómetros está el cliente y prohíbe usar la camioneta.

1. Vuelve a la **Rueda de Engranaje** (Configuración) en Apps Script.
2. En las Propiedades, agrega dos nuevas:
   * **`MAPS_PROVEEDOR`**: Escribe `ROUTES_API`
   * **`GOOGLE_MAPS_API_KEY`**: Pega aquí tu clave de API de Google Cloud (Asegúrate de que tenga habilitado el servicio *Routes API*).
3. Ve a tu Google Sheets, abre el menú arriba que dice **Servicio Técnico** y haz clic en **Actualizar rutas con Google Maps**. ¡Listo!

### Paso 2.3: Obtener el Link de tu Página Web
1. En el editor de Apps Script, arriba a la derecha hay un botón azul que dice **Implementar (Deploy)**.
2. Elige **Nueva implementación**.
3. En la tuerca de configuración, elige **Aplicación Web**.
4. En "¿Quién tiene acceso?", elige **Cualquier persona**.
5. Dale a Implementar y copia la **URL (Enlace)** que te da. 
   * *Este enlace es el que le enviarás a tu equipo para que entren al sistema.*

---

## 🛠️ 3. ¿Cómo funciona el Excel (Google Sheets)?

Tu archivo tiene varias hojas (pestañas abajo). No tienes que tocar todas, estas son las importantes:

* **CONFIG**: Aquí están las reglas del juego. Sueldos diarios ($25.000), costo de los hoteles ($50.000), rendimiento de las camionetas (20km/L) y el precio de la bencina. Si la bencina sube, la cambias aquí.
* **DESTINOS**: La lista de todas las ciudades donde tienes que ir (Copiapó, Coquimbo, etc.) y cuántos equipos hay que instalar en cada una. 
* **PLAN**: **Esta es la hoja de la planificación actual**. Aquí dice que el "Técnico 1" irá a "Copiapó" en la "Camioneta 1" el "Día 1".
* **AGENDA**: Esta hoja guarda el historial de los trabajos nuevos que tú agendes a futuro usando la página web.
* **PEAJES**: Un catálogo con todos los precios de los pórticos y peajes de Chile.

---

## 🖥️ 4. ¿Cómo operar la Página Web (Dashboard)?

Cuando entras a la URL de la web y pones tu correo y contraseña, verás un menú a la izquierda con muchas opciones. Así se usa en el día a día:

### A. La Pantalla "Resumen" y "Gastos"
* Entras aquí para ver la foto completa. Verás cuánta plata se va a gastar en total en viáticos, peajes, bencina y hoteles según lo que está planificado en el Excel.
* En **Gastos**, verás cuánto dinero exacto hay que transferirle a cada técnico para que pueda sobrevivir el viaje (su viático + plata para bencina).

### B. El "Calendario" (La joya del sistema)
Esta pantalla te muestra qué está haciendo cada técnico. Y lo más importante: **Te permite agendar órdenes nuevas**.

**Paso a paso para agendar una orden:**
1. Haz clic en **+ Nueva orden**.
2. Ingresa los datos del cliente: **Dirección exacta** y **Cantidad de equipos a instalar**.
3. El sistema hará algo mágico: Consultará a Google Maps y te mostrará una comparativa:
   * **Opción Camioneta**: Calcula la bencina, el desgaste, todos los peajes y el viático del técnico en base al tiempo de manejo.
   * **Opción Bus / Avión**: Tú pones cuánto vale el pasaje, y el sistema suma los viáticos y horas extra que implicaría irse en bus.
4. Con estos números en la mesa, tomas una **decisión inteligente**. Haces clic en la opción más barata/rápida y presionas **Agendar**. (Esto se guardará automáticamente en la hoja AGENDA del Excel).

### C. "Planificación" y "Recalcular"
* Si descubriste que un técnico está enfermo o un vehículo se averió, puedes ir a la pantalla de **Planificación** y reasignar los viajes. 
* **No olvides:** Cada vez que hagas un cambio aquí o en el Excel, debes ir al menú principal y presionar el botón **RECALCULAR**. Si no lo haces, la web seguirá mostrándote los costos antiguos.

### D. La "Orden de Servicio"
* Una vez que estás feliz con el plan y los costos, vas a esta pantalla, seleccionas a un Técnico (ej. Técnico 1) y el sistema generará un comprobante (Hoja de ruta). 
* Este comprobante le dice al técnico: "Toma las llaves de la Camioneta V1, este es tu hotel, se te depositaron $250.000, y debes ir a esta dirección". 
* Puedes exportarlo a PDF e imprimírselo.

---

## ⚙️ 5. De dónde salen las Matemáticas (Fórmulas Simples)

Si alguien te pregunta "¿Por qué me sale tan caro este viaje?", aquí está la explicación:

1. **Tiempo en Sitio**: Instalar 1 equipo toma 2 horas. Capacitar a la gente toma 30 minutos. Si mandas 3 técnicos a instalar 3 equipos, terminan en 2 horas porque trabajan en paralelo.
2. **Combustible**: El sistema toma los kilómetros de Google Maps, los divide por el rendimiento (ej. 20 km por Litro) y los multiplica por el precio del diésel.
3. **Desgaste**: Cada kilómetro recorrido de la camioneta suma un costo por desgaste de neumáticos y aceite.
4. **Hotel y Viático**: Por cada noche lejos de casa, suma el valor del hotel. Por cada día que el técnico está trabajando, suma el valor del viático diario (que incluye la comida).

¡Y eso es todo! Si sigues este manual, dominarás la planificación de toda la operación. Si alguna vez el sistema se rompe o los números no cuadran, ve al Excel, presiona **Servicio Técnico > Diagnóstico del sistema** y el sistema te dirá exactamente qué hoja o celda está causando el problema.
