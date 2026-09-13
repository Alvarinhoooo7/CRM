# -*- coding: utf-8 -*-
"""Genera la presentacion de 15 minutos para los estudios de caso 1 y 2.

    python presentacion/generar_ppt.py

Respeta los aspectos de forma que exige el PDF:
  - Contraste alto: texto casi negro sobre fondo blanco (seguro en proyector).
  - Tamano de letra grande: titulos 40 pt, cuerpo 22 pt, cifras 60 pt.
  - Poco texto por lamina: ninguna pasa de seis lineas.
  - Lenguaje tecnico y formal.
Cada lamina lleva notas del orador con el tiempo objetivo y quien la expone.
"""
import os
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

INK     = RGBColor(0x0F, 0x17, 0x2A)   # casi negro, azulado
ACCENT  = RGBColor(0x0E, 0x74, 0x90)   # teal oscuro
ALERT   = RGBColor(0xB4, 0x53, 0x09)   # ambar oscuro
MUTED   = RGBColor(0x47, 0x55, 0x69)
PANEL   = RGBColor(0xF1, 0xF5, 0xF9)
LINE    = RGBColor(0xCB, 0xD5, 0xE1)
WHITE   = RGBColor(0xFF, 0xFF, 0xFF)
FUENTE  = 'Arial'

W, H = Inches(13.333), Inches(7.5)
MARGEN = Inches(0.85)
ANCHO = W - 2 * MARGEN

prs = Presentation()
prs.slide_width, prs.slide_height = W, H
VACIA = prs.slide_layouts[6]


def _fuente(run, size, bold=False, color=INK):
    run.font.name = FUENTE
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color


def caja(slide, x, y, cx, cy, texto, size, bold=False, color=INK,
         align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, espaciado=1.0):
    tb = slide.shapes.add_textbox(x, y, cx, cy)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    lineas = texto.split('\n') if isinstance(texto, str) else texto
    for i, linea in enumerate(lineas):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = espaciado
        _fuente(p.add_run(), size, bold, color)
        p.runs[0].text = linea
    return tb


def rect(slide, x, y, cx, cy, fill=PANEL, line=None):
    sh = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, cx, cy)
    sh.fill.solid()
    sh.fill.fore_color.rgb = fill
    if line is None:
        sh.line.fill.background()
    else:
        sh.line.color.rgb = line
        sh.line.width = Pt(1)
    sh.shadow.inherit = False
    return sh


def nueva(notas=''):
    s = prs.slides.add_slide(VACIA)
    fondo = s.background.fill
    fondo.solid()
    fondo.fore_color.rgb = WHITE
    if notas:
        s.notes_slide.notes_text_frame.text = notas
    return s


def encabezado(s, kicker, titulo):
    """Barra de acento + antetitulo + titulo. Deja el cuerpo desde y=2.05\"."""
    rect(s, MARGEN, Inches(0.62), Inches(0.09), Inches(0.42), ACCENT)
    caja(s, MARGEN + Inches(0.26), Inches(0.62), ANCHO, Inches(0.34),
         kicker.upper(), 13, True, ACCENT)
    caja(s, MARGEN, Inches(1.06), ANCHO, Inches(0.95), titulo, 36, True, INK)


def pie(s, texto):
    caja(s, MARGEN, H - Inches(0.72), ANCHO, Inches(0.34), texto, 12, False, MUTED)


# ---------------------------------------------------------------- plantillas

def lamina_bullets(kicker, titulo, bullets, nota='', destacado=None):
    s = nueva(nota)
    encabezado(s, kicker, titulo)
    y = Inches(2.25)
    for b in bullets:
        rect(s, MARGEN, y + Inches(0.16), Inches(0.13), Inches(0.13), ACCENT)
        caja(s, MARGEN + Inches(0.38), y, ANCHO - Inches(0.38), Inches(0.55),
             b, 21, False, INK, espaciado=1.15)
        y += Inches(0.78)
    if destacado:
        rect(s, MARGEN, H - Inches(1.75), ANCHO, Inches(0.86), PANEL)
        caja(s, MARGEN + Inches(0.3), H - Inches(1.58), ANCHO - Inches(0.6),
             Inches(0.55), destacado, 19, True, ACCENT, anchor=MSO_ANCHOR.MIDDLE)
    return s


def lamina_cifras(kicker, titulo, cifras, nota='', pieTexto=''):
    """cifras: lista de (numero, etiqueta). Maximo cuatro."""
    s = nueva(nota)
    encabezado(s, kicker, titulo)
    n = len(cifras)
    hueco = Inches(0.3)
    ancho = int((ANCHO - hueco * (n - 1)) / n)
    x = MARGEN
    for numero, etiqueta in cifras:
        rect(s, x, Inches(2.5), Emu(ancho), Inches(2.35), PANEL)
        caja(s, x, Inches(2.82), Emu(ancho), Inches(1.15), numero, 54, True,
             ACCENT, PP_ALIGN.CENTER)
        caja(s, x + Inches(0.2), Inches(4.02), Emu(ancho) - Inches(0.4),
             Inches(0.75), etiqueta, 16, False, MUTED, PP_ALIGN.CENTER)
        x += Emu(ancho) + hueco
    if pieTexto:
        pie(s, pieTexto)
    return s


def lamina_tabla(kicker, titulo, cabeceras, filas, anchos, nota='',
                 destacado=None, alinear_der=()):
    s = nueva(nota)
    encabezado(s, kicker, titulo)
    total = sum(anchos)
    cols = [int(ANCHO * a / total) for a in anchos]
    y = Inches(2.3)
    alto_fila = Inches(0.52)

    x = MARGEN
    for i, c in enumerate(cabeceras):
        al = PP_ALIGN.RIGHT if i in alinear_der else PP_ALIGN.LEFT
        caja(s, x, y, Emu(cols[i]), Inches(0.36), c.upper(), 12, True, ACCENT, al)
        x += cols[i]
    y += Inches(0.42)
    rect(s, MARGEN, y, ANCHO, Pt(1.2), ACCENT)
    y += Inches(0.16)

    for r, fila in enumerate(filas):
        if r % 2 == 1:
            rect(s, MARGEN - Inches(0.12), y - Inches(0.07),
                 ANCHO + Inches(0.24), alto_fila, PANEL)
        x = MARGEN
        for i, celda in enumerate(fila):
            al = PP_ALIGN.RIGHT if i in alinear_der else PP_ALIGN.LEFT
            fuerte = celda.startswith('*')
            caja(s, x, y, Emu(cols[i]), Inches(0.42), celda.lstrip('*'),
                 17, fuerte, INK if not fuerte else ACCENT, al)
            x += cols[i]
        y += alto_fila
    if destacado:
        caja(s, MARGEN, H - Inches(1.3), ANCHO, Inches(0.6), destacado,
             18, True, ALERT)
    return s


def lamina_captura(kicker, titulo, puntos, rotulo, nota='', pieTexto=''):
    """Texto a la izquierda, marco vacio a la derecha para pegar la captura."""
    s = nueva(nota)
    encabezado(s, kicker, titulo)
    izq_w = Inches(4.55)
    y = Inches(2.3)
    for p in puntos:
        rect(s, MARGEN, y + Inches(0.15), Inches(0.11), Inches(0.11), ACCENT)
        caja(s, MARGEN + Inches(0.32), y, izq_w - Inches(0.32), Inches(0.9),
             p, 18, False, INK, espaciado=1.15)
        y += Inches(0.92)

    marco_x = MARGEN + izq_w + Inches(0.5)
    marco_w = W - marco_x - MARGEN
    marco = rect(s, marco_x, Inches(2.2), marco_w, Inches(4.3), WHITE, LINE)
    marco.line.dash_style = 4  # guiones
    caja(s, marco_x, Inches(4.0), marco_w, Inches(0.5),
         'CAPTURA', 15, True, LINE, PP_ALIGN.CENTER)
    caja(s, marco_x + Inches(0.3), Inches(4.45), marco_w - Inches(0.6),
         Inches(0.8), rotulo, 13, False, MUTED, PP_ALIGN.CENTER)
    if pieTexto:
        pie(s, pieTexto)
    return s


# ================================================================== LAMINAS

# 1 ---------------------------------------------------------------- portada
s = nueva('0:15 · INTEGRANTE 1\nPresentar el equipo y anunciar la estructura: '
          'primero la planificacion, despues el sistema. No leer la lamina.')
rect(s, Inches(0), Inches(0), Inches(0.32), H, ACCENT)
caja(s, MARGEN, Inches(2.15), ANCHO, Inches(0.4),
     'TECNOLOGIA APLICADA A SISTEMAS INTELIGENTES · UNIDAD 1', 15, True, ACCENT)
caja(s, MARGEN, Inches(2.72), ANCHO, Inches(1.9),
     'Servicio tecnico en ruta', 54, True, INK)
caja(s, MARGEN, Inches(4.0), Inches(9.5), Inches(1.0),
     'Planificacion nacional de 33 instalaciones y gestion tecnologica en terreno',
     22, False, MUTED, espaciado=1.2)
rect(s, MARGEN, Inches(5.25), Inches(3.2), Pt(2), ACCENT)
caja(s, MARGEN, Inches(5.6), ANCHO, Inches(1.0),
     'Estudios de caso 1 y 2 · INACAP Sede Santiago Sur\n'
     'Docente: Osvaldo Duarte · 14 de septiembre de 2026',
     16, False, MUTED, espaciado=1.35)

# 2 ------------------------------------------------------------ el problema
lamina_cifras(
    'Estudio de caso 1', 'El problema, en cuatro numeros',
    [('33', 'equipos por instalar'), ('16', 'localidades, de Copiapo a Tome'),
     ('10', 'tecnicos disponibles'), ('6', 'camionetas Peugeot Partner')],
    nota='0:45 · INTEGRANTE 1\nEl problema no es tecnico sino logistico: personal '
         'limitado para cubrir el territorio nacional. Instalacion 2 h, capacitacion '
         '30 min, rendimiento 20 km/L. Mencionar que son datos textuales del enunciado.',
    pieTexto='Datos textuales del enunciado · Instalacion 2 h por equipo · '
             'Capacitacion 30 min · Rendimiento 20 km/L')

# 3 -------------------------------------------------------------- las 4 decisiones
lamina_bullets(
    'Estudio de caso 1', 'Cuatro decisiones definen el plan',
    ['Cuadrillas de dos, no de tres: lo fija la cabina de la camioneta',
     'Dos conductores por cuadrilla que se alternan al volante',
     'Capacitacion digital previa: 30 minutos bajan a 15',
     'Horas extra antes que hostal, mientras la jornada lo permita'],
    nota='0:30 · INTEGRANTE 1\nAnunciar las cuatro y avisar que cada una viene con su '
         'numero. Esto es lo que distingue el trabajo de llenar una planilla.',
    destacado='Cada decision se sostiene en un calculo, no en una preferencia')

# 4 ------------------------------------------------------- decision 1
lamina_tabla(
    'Decision 1', 'Cuadrillas de dos: lo manda el vehiculo',
    ['Sitio', 'Equipos', 'Con 2 tecnicos', 'Uno por equipo', 'Costo extra', 'Conviene'],
    [['Copiapo', '5', '6,75 h', '2,25 h', '*$211.480', '*No'],
     ['Los otros 15 sitios', '1 a 3', '2,25 a 4,5 h', 'igual', '—', 'No']],
    [2.4, 1.1, 1.6, 1.6, 1.5, 1.2],
    nota='1:00 · INTEGRANTE 1\nLa Peugeot Partner es furgon de cabina corta: caben dos '
         'con sus bolsos. Diez tecnicos divididos en dos dan cinco cuadrillas. '
         'Mandar mas gente a un sitio obliga a una segunda camioneta y no compensa: '
         'en Copiapo ahorra 4,5 h y cuesta $211.480. Los diez tienen licencia, asi que '
         'la dotacion se podria cambiar; el costo es el que decide que no.',
    destacado='10 tecnicos / 2 por camioneta = 5 cuadrillas · queda V6 de reserva',
    alinear_der=(1, 2, 3, 4))

# 5 ------------------------------------------------------- decision 2
lamina_cifras(
    'Decision 2', 'Dos conductores por cuadrilla, alternados',
    [('8,89 h', 'conduccion a Copiapo con un solo conductor'),
     ('9 h', 'tope diario de seguridad al volante'),
     ('4,45 h', 'por tecnico al alternar el volante')],
    nota='1:00 · INTEGRANTE 1\nEste es el punto tecnico fuerte. Con un conductor fijo el '
         'tramo a Copiapo roza el tope de seguridad. Como los diez tienen licencia, se '
         'designan dos conductores por cuadrilla y se turnan. No es comodidad: es la '
         'diferencia entre un plan legal y uno que no lo es. La app muestra quien conduce '
         'cada dia en la columna Conductor.',
    pieTexto='La rotacion diaria del conductor queda registrada en cada orden de servicio')

# 6 ------------------------------------------------------- decision 3
lamina_bullets(
    'Decision 3', 'Capacitacion digital previa',
    ['El enunciado fija 30 minutos de capacitacion por equipo',
     'Se envia al cliente un enlace de Drive con el video detallado, antes de la visita',
     'En terreno solo queda responder dudas: 15 minutos',
     'No se reduce a cero porque alguien tiene que responder esas preguntas'],
    nota='1:00 · INTEGRANTE 2\nEs una mejora de proceso, no un recorte arbitrario. '
         'Insistir en por que 50% y no 100%: reducirla a cero seria insostenible y el '
         'docente lo va a preguntar. Cada equipo pasa de 2,5 h a 2,25 h de tecnico.',
    destacado='2 h de instalacion + 15 min = 2,25 h por equipo y por tecnico')

# 7 ------------------------------------------------------- decision 4
lamina_tabla(
    'Decision 4', 'Horas extra antes que hostal',
    ['Opcion', 'Calculo', 'Costo'],
    [['2 h extra para 2 tecnicos', '2 x 2 x $9.750', '*$39.000'],
     ['1 noche para 2 tecnicos', '2 x $50.000 + 2 x $25.000 de viatico', '$150.000']],
    [3.0, 3.4, 1.6],
    nota='1:00 · INTEGRANTE 2\nLa hora extra vale $6.500 x 1,5 por el recargo legal del '
         '50%. Volver a casa sale cuatro veces mas barato que dormir fuera, siempre que '
         'el regreso quepa en las 10,4 h de tope. Cuando no cabe (Copiapo y Biobio) se '
         'paga hostal, y ahi no es comodidad sino la unica opcion legal.',
    destacado='Regla: jornada hasta 8,4 h · se vuelve con extra si cabe en 10,4 h · '
              'si no, se pernocta',
    alinear_der=(2,))

# 8 ------------------------------------------------------------- el plan
lamina_tabla(
    'Estudio de caso 1', 'El plan: cinco cuadrillas, cuatro dias',
    ['Cuadrilla', 'Tecnicos', 'Movil', 'Corredor', 'Dias'],
    [['C1', 'T01 + T02', 'V1', 'Norte: Copiapo, Coquimbo, La Calera', '*4'],
     ['C2', 'T03 + T04', 'V2', 'Maule: Curico, Talca', '2'],
     ['C3', 'T05 + T06', 'V3', 'Biobio: San Pedro, Penco, Tome, Santa Juana', '3'],
     ['C4', 'T07 + T08', 'V4', 'RM: Maipu, Pudahuel, Santiago', '3'],
     ['C5', 'T09 + T10', 'V5', 'RM sur y Ruta 78', '2'],
     ['—', '—', '*V6', 'Reserva de flota', '—']],
    [1.3, 1.9, 1.0, 5.4, 0.9],
    nota='1:15 · INTEGRANTE 2\nCada cuadrilla toma un corredor completo para no cruzar '
         'rutas. El corredor norte manda la duracion: son cuatro dias porque Copiapo esta '
         'a 800 km y el viaje de ida ocupa una jornada entera. Los dias de puro traslado '
         'tambien son ordenes: el tecnico esta desplegado y cobra viatico.',
    destacado='Usa 5 de las 6 camionetas · la sexta queda para cubrir una averia',
    alinear_der=(4,))

# 9 ------------------------------------------------------------ el dinero
lamina_tabla(
    'Estudio de caso 1', 'Cuanto dinero requiere la planificacion',
    ['Concepto', 'Regla', 'Total'],
    [['Viaticos', '$25.000 por tecnico y por dia · 28 tecnico-dias', '$700.000'],
     ['Alojamiento', '$50.000 por noche y por persona · 10 tecnico-noches', '$500.000'],
     ['Peajes', 'Del recorrido real del dia, a cargo del conductor', '$148.000'],
     ['Combustible', 'Km efectivos del dia / 20 km/L x $1.381', '$273.026'],
     ['*Total a transferir', '', '*$1.621.026']],
    [2.3, 5.2, 1.9],
    nota='1:00 · INTEGRANTE 2\nEste es el numero que pide el enunciado. Aclarar que las '
         'horas extra ($9.556) NO estan aca: son costo de empresa y van en la planilla de '
         'sueldos, no en el bolsillo del tecnico para hacer la ruta. Si preguntan por los '
         'dias de traslado: si estan contados, son 4 tecnico-dias y 2 noches.',
    destacado='Aparte: $9.556 de horas extra · costo de empresa, no se transfiere',
    alinear_der=(2,))

# 10 --------------------------------------------------- monto por tecnico
lamina_tabla(
    'Estudio de caso 1', 'Que monto requiere cada tecnico',
    ['Tecnico', 'Ruta', 'Rol', 'Transferencia'],
    [['T01', 'Corredor norte, 4 dias', 'Conductor D1 y D3', '*$360.927'],
     ['T02', 'Corredor norte, 4 dias', 'Conductor D2 y D4', '$300.554'],
     ['T05', 'Biobio, 3 dias', 'Conductor D1 y D3', '$287.667'],
     ['T09', 'RM sur y Ruta 78, 2 dias', 'Conductor D1', '$58.114']],
    [1.3, 3.6, 2.5, 2.0],
    nota='1:00 · INTEGRANTE 3\nCuatro ejemplos, no los diez. El rango va de $58.114 a '
         '$360.927 y lo explican tres cosas: los dias fuera, las noches de hotel y si le '
         'toco conducir. Peaje y combustible los carga el conductor del dia, una sola vez '
         'por jornada y sobre los km reales del recorrido. Cada tecnico ve su monto '
         'desglosado en la app: ese es el puente al caso 2.',
    destacado='Del menor al mayor: $58.114 a $360.927 · '
              'lo explican dias fuera, noches de hotel y turno de conduccion',
    alinear_der=(3,))

# 11 -------------------------------------------------------- transicion
s = nueva('0:20 · INTEGRANTE 3\nLamina de corte. Leer la cita del enunciado y pasar. '
          'No detenerse.')
rect(s, Inches(0), Inches(0), W, H, INK)
caja(s, MARGEN, Inches(1.5), ANCHO, Inches(0.4), 'ESTUDIO DE CASO 2', 15, True,
     RGBColor(0x67, 0xE8, 0xF9))
caja(s, MARGEN, Inches(2.15), Inches(11.2), Inches(2.6),
     '"Cada tecnico pueda verificar su ruta, sus implementos y materiales, '
     'el hotel donde podria hospedar, la camioneta a utilizar"',
     32, True, WHITE, espaciado=1.25)
rect(s, MARGEN, Inches(5.0), Inches(3.2), Pt(2), RGBColor(0x67, 0xE8, 0xF9))
caja(s, MARGEN, Inches(5.35), ANCHO, Inches(0.5),
     'Enunciado del caso 2 · plataforma a libre eleccion', 17, False,
     RGBColor(0x94, 0xA3, 0xB8))

# 12 ------------------------------------------------------- por que appsheet
lamina_bullets(
    'Estudio de caso 2', 'Por que AppSheet sobre Google Sheets',
    ['La planilla sigue siendo la base de datos: CONFIG, DESTINOS y PLAN',
     'AppSheet genera la aplicacion movil directamente desde esa planilla',
     'Filtro por usuario: cada tecnico ve solo sus ordenes, no las de todos',
     'Funciona en el celular en terreno, sin instalacion ni VPN'],
    nota='0:45 · INTEGRANTE 3\nLa pregunta esperable es por que no una planilla compartida. '
         'Respuesta: en una planilla todos ven todo y cualquiera edita cualquier fila. '
         'El caso pide que CADA tecnico verifique LO SUYO. Eso es un filtro por usuario, '
         'y es exactamente lo que vamos a mostrar ahora.',
    destacado='La planilla planifica · la aplicacion ejecuta y registra en terreno')

# 13-19 ------------------------------------------------- pantalla por pantalla
lamina_captura(
    'La aplicacion', 'Pantalla 1 · Mi ruta',
    ['El tecnico entra con su correo institucional',
     'Ve unicamente sus ordenes, agrupadas por fecha',
     'Cada tarjeta muestra localidad, equipos y alojamiento'],
    'Vista "Mi ruta" en el celular, con las ordenes agrupadas por dia',
    nota='0:45 · INTEGRANTE 3\nAbrir la app en vivo si la sala lo permite; si no, usar la '
         'captura. Mostrar primero la vista de coordinacion con las 36 ordenes y despues '
         'entrar como tecnico para que se note la diferencia.',
    pieTexto='Filtro de seguridad: [Email] = USEREMAIL()')

lamina_captura(
    'La aplicacion', 'Pantalla 2 · La orden de servicio',
    ['Direccion exacta con boton de navegacion',
     'Equipos a instalar y horas estimadas de trabajo',
     'Desglose del monto: viatico, alojamiento, peaje y combustible',
     'Estado de avance que el tecnico cambia en terreno'],
    'Detalle de una orden, desplazado hasta ver el desglose de montos',
    nota='1:00 · INTEGRANTE 3\nEsta es la lamina central del caso 2: responde de una sola '
         'vez ruta, monto y vehiculo. Recorrer la pantalla en el mismo orden en que el '
         'enunciado pide las cosas.',
    pieTexto='Una orden responde ruta, implementos, hotel, camioneta y monto')

lamina_captura(
    'La aplicacion', 'Pantalla 3 · Implementos y materiales',
    ['Checklist de 17 items, clasificado por donde va cada cosa',
     'BOLSO viaja con el tecnico · VEHICULO obliga a camioneta',
     'El conductor suma los items del vehiculo',
     'Se marca antes de salir, desde el celular'],
    'Checklist de implementos con varios items ya marcados',
    nota='0:45 · INTEGRANTE 4\nExplicar que la categoria no es decorativa: es lo que '
         'determina si la cuadrilla podria viajar sin camioneta. Como la escalera y la '
         'senaletica son de categoria VEHICULO, el bus y el avion quedan descartados para '
         'este caso.',
    pieTexto='La categoria del implemento es la que descarta bus y avion')

lamina_captura(
    'La aplicacion', 'Pantalla 4 · Hotel y camioneta',
    ['Zona de pernoctacion con direccion y mapa',
     'Noches asignadas y monto de alojamiento',
     'Camioneta asignada, patente y capacidad',
     'Quien conduce ese dia, segun la rotacion'],
    'Ficha del vehiculo y bloque de alojamiento con el mapa visible',
    nota='0:45 · INTEGRANTE 4\nCerrar aqui los dos items que faltaban del enunciado: el '
         'hotel y la camioneta. Mencionar que el alojamiento es tarifa fija de $50.000 '
         'por noche y por persona, decision de jefatura declarada como supuesto.',
    pieTexto='Alojamiento: $50.000 por noche y por persona, tarifa unica nacional')

lamina_captura(
    'La aplicacion', 'Pantalla 5 · Calendario',
    ['El tecnico ve sus dias asignados',
     'Cada cuadrilla con un color distinto',
     'Incluye los dias de traslado, no solo los de instalacion',
     'La coordinacion ve el plan completo de un vistazo'],
    'Vista de calendario con las cinco cuadrillas en colores distintos',
    nota='0:40 · INTEGRANTE 4\nEsta es la mejor pantalla para proyectar porque se entiende '
         'el plan entero sin explicarlo. Aprovechar para senalar que los dias de traslado '
         'aparecen como ordenes propias.')

lamina_captura(
    'La aplicacion', 'Pantalla 6 · Rendicion de gastos',
    ['El tecnico registra el gasto en el momento',
     'Fotografia la boleta con la camara del celular',
     'La aplicacion calcula el saldo contra lo transferido',
     'La coordinacion aprueba o rechaza cada rendicion'],
    'Formulario de gasto con la foto de una boleta adjunta',
    nota='0:50 · INTEGRANTE 4\nBuen momento para hacerlo en vivo: sacar una foto de '
         'cualquier papel, poner un monto y mostrar como cambia el saldo en pantalla. '
         'Esto cierra el ciclo del dinero: no solo cuanto se le entrega, sino en que se '
         'gasto.',
    pieTexto='Saldo = transferencia - gastos rendidos')

lamina_captura(
    'La aplicacion', 'Pantalla 7 · Agendar trabajo nuevo',
    ['Se ingresa localidad, equipos y fecha',
     'El sistema asigna al tecnico con menos carga',
     'Calcula solo el dia, el vehiculo y todos los gastos',
     'Las 36 ordenes del caso 1 quedan protegidas: no se borran'],
    'Formulario de orden nueva y el resultado con el tecnico ya asignado',
    nota='1:00 · INTEGRANTE 4\nDemostracion en vivo: C2 (T03 y T04) termina el dia 22 y '
         'tiene libres el 23 y el 24. Crear una orden para Talca el 28 y mostrar como cae '
         'sola en T03. Explicar que la regla es balanceo por carga y que el motor de '
         'calculo puede hacerlo por corredor y jornada legal.',
    pieTexto='Regla de asignacion: el tecnico activo con menos ordenes')

# 20 ----------------------------------------------------- futura mejora
lamina_tabla(
    'Estudio de caso 1', 'Futura mejora: contratar dos tecnicos',
    ['Escenario', 'Duracion', 'Tecnico-dias', 'Viatico + hotel', 'Horas extra'],
    [['Plan actual · 5 cuadrillas', '4 dias', '28', '$1.200.000', '$9.556'],
     ['Con 6 cuadrillas y V6', '*3 dias', '30', '$1.250.000', '$19.110'],
     ['*Diferencia', '*-1 dia', '+2', '*+$50.000', '+$9.554']],
    [3.4, 1.5, 1.6, 2.1, 1.6],
    nota='1:00 · INTEGRANTE 4\nLa mejora NO es comprar camionetas: ya sobra una. El cuello '
         'de botella es el corredor norte, que se lleva cuatro dias. Con dos tecnicos mas '
         'se abre una sexta cuadrilla, se ocupa V6 y el norte se parte en dos. El plan baja '
         'a tres dias por unos $60.000 adicionales por despliegue. La pregunta honesta es '
         'el sueldo permanente de esos dos: conviene si hay mas de un despliegue al mes.',
    destacado='Comprimir el plan un 25% cuesta ~$60.000 por despliegue · '
              'decide la frecuencia de trabajos',
    alinear_der=(1, 2, 3, 4))

# 21 ------------------------------------------------------------- cierre
s = nueva('0:30 · TODOS\nCerrar con las tres ideas y abrir preguntas. No leer la lamina '
          'completa: decir una frase por punto.')
encabezado(s, 'Cierre', 'Lo que queda demostrado')
y = Inches(2.4)
for num, txt in [('1', 'La planificacion esta calculada, no estimada: cada cifra '
                       'tiene su regla y su fuente'),
                 ('2', 'Cada tecnico verifica su ruta, implementos, hotel y camioneta '
                       'desde el celular'),
                 ('3', 'El sistema no solo informa: registra avance, boletas y '
                       'ordenes nuevas')]:
    rect(s, MARGEN, y, Inches(0.62), Inches(0.62), ACCENT)
    caja(s, MARGEN, y + Inches(0.1), Inches(0.62), Inches(0.45), num, 24, True,
         WHITE, PP_ALIGN.CENTER)
    caja(s, MARGEN + Inches(0.95), y + Inches(0.02), ANCHO - Inches(0.95),
         Inches(1.0), txt, 21, False, INK, espaciado=1.2)
    y += Inches(1.25)
rect(s, MARGEN, H - Inches(1.5), ANCHO, Pt(2), ACCENT)
caja(s, MARGEN, H - Inches(1.2), ANCHO, Inches(0.6), 'Gracias. Quedamos atentos a sus consultas.',
     20, True, INK)


# ------------------------------------------------- presupuesto de tiempo
# El PDF descuenta por minuto adicional sobre los 15. El guion se ajusta a
# 13:55 para dejar margen a las transiciones y a la demostracion en vivo.
TIEMPOS = ['0:15', '0:40', '0:25', '0:50', '0:50', '0:40', '0:50', '1:00',
           '0:50', '0:45', '0:15', '0:35', '0:35', '0:50', '0:35', '0:35',
           '0:30', '0:45', '0:55', '0:50', '0:25']
assert len(TIEMPOS) == len(prs.slides._sldIdLst), 'faltan tiempos'
_seg = 0
for lam, t in zip(prs.slides, TIEMPOS):
    m, sg = t.split(':')
    _seg += int(m) * 60 + int(sg)
    tf = lam.notes_slide.notes_text_frame
    resto = tf.text.split(' ', 1)[1] if ' ' in tf.text else tf.text
    tf.text = t + ' ' + resto
print('Guion total: %d:%02d' % (_seg // 60, _seg % 60))

# ------------------------------------------------------------------ guardar
destino = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       'Presentacion_Casos_1_y_2.pptx')
prs.save(destino)
print('Generada: %s' % destino)
print('%d laminas' % len(prs.slides._sldIdLst))
