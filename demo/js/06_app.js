/* ARRANQUE. Login, enrutado entre las tres vistas y avisos.
   El login NO es autenticacion: es un selector de rol con las credenciales a la vista,
   para que la demostracion fluya. No protege nada. */

var CLAVE_DEMO = '123';

var ROLES = [
  {
    id: 'supervisor',
    titulo: 'Supervisor',
    resumen: 'Métricas, finanzas, nómina y desempeño de los 10 técnicos.',
    correo: 'supervisor@serviciotecnico.cl'
  },
  {
    id: 'coordinador',
    titulo: 'Coordinador',
    resumen: 'Recibe trabajos, arma equipos, agenda y avisa al cliente.',
    correo: 'coordinador@serviciotecnico.cl'
  },
  {
    id: 'tecnico',
    titulo: 'Técnico',
    resumen: 'Checklist, orden de trabajo, ruta y comprobantes. En el teléfono.',
    correo: 'alvaro.fuentes@serviciotecnico.cl'
  }
];

var rolElegido = 'supervisor';

function iniciar() {
  cargarEstado();
  suscribir(function () {
    if (sesion.rol === 'supervisor') { dibujarPestanaSupervisor(); }
    else if (sesion.rol === 'coordinador') { dibujarPestanaCoordinador(); }
    else if (sesion.rol === 'tecnico') { dibujarPantallaTecnico(); }
  });
  dibujarAcceso();
}

/* ---------- Login ---------- */

function dibujarAcceso() {
  var raiz = el('#aplicacion');
  raiz.className = '';
  raiz.innerHTML =
    '<div class="pantalla-acceso"><div class="acceso">'
    + '<div class="acceso-titulo">'
    + '<h1>Servicio técnico en ruta</h1>'
    + '<p>Planificación, ejecución y rendición de instalaciones a lo largo de Chile. '
    + '33 equipos en 16 comunas, 10 técnicos y 6 camionetas.</p>'
    + '</div>'
    + '<div class="roles">'
    + ROLES.map(function (r) {
      return '<button class="rol" data-rol="' + esc(r.id) + '" aria-pressed="' + (r.id === rolElegido) + '">'
        + '<h3>' + esc(r.titulo) + '</h3>'
        + '<span>' + esc(r.resumen) + '</span>'
        + '<code>' + esc(r.correo) + ' · ' + esc(CLAVE_DEMO) + '</code>'
        + '</button>';
    }).join('')
    + '</div>'
    + '<form class="formulario-acceso" id="form-acceso">'
    + '<div class="rejilla-campos">'
    + '<label class="campo"><span>Correo</span><input type="email" name="correo" autocomplete="off" value="'
    + esc(correoDelRol(rolElegido)) + '"></label>'
    + '<label class="campo"><span>Contraseña</span><input type="password" name="clave" autocomplete="off" value="'
    + esc(CLAVE_DEMO) + '"></label>'
    + '<div class="campo"><span>&nbsp;</span><button type="submit" class="boton">Ingresar</button></div>'
    + '</div>'
    + '<div id="error-acceso"></div>'
    + '<div class="aviso-demo">Demostración local. Los tres accesos usan la contraseña <strong>'
    + esc(CLAVE_DEMO) + '</strong> y vienen autocompletados: solo aprieta Ingresar. '
    + 'Esto no es un sistema de autenticación y no protege ningún dato.'
    + (almacen.disponible() ? '' : ' El navegador bloqueo el almacenamiento local, asi que al recargar la página se pierde lo que hagas.')
    + '</div>'
    + '</form>'
    + '</div></div>';

  todos('.rol').forEach(function (boton) {
    boton.addEventListener('click', function () {
      rolElegido = boton.getAttribute('data-rol');
      dibujarAcceso();
    });
  });

  el('#form-acceso').addEventListener('submit', function (evento) {
    evento.preventDefault();
    intentarAcceso();
  });
}

function correoDelRol(id) {
  var r = ROLES.filter(function (x) { return x.id === id; })[0];
  return r ? r.correo : '';
}

function intentarAcceso() {
  var datos = leerFormulario('#form-acceso');
  var correo = String(datos.correo || '').trim().toLowerCase();
  var clave = String(datos.clave || '');

  if (clave !== CLAVE_DEMO) {
    el('#error-acceso').innerHTML = '<p class="error-acceso">La contraseña de la demostración es ' + esc(CLAVE_DEMO) + '.</p>';
    return;
  }

  if (correo === 'supervisor@serviciotecnico.cl') {
    abrirVista('supervisor', correo, null);
    return;
  }
  if (correo === 'coordinador@serviciotecnico.cl') {
    abrirVista('coordinador', correo, null);
    return;
  }

  var tecnico = estado.tecnicos.filter(function (t) { return t.Email.toLowerCase() === correo; })[0];
  if (tecnico) {
    abrirVista('tecnico', correo, tecnico.ID_Tecnico);
    return;
  }

  el('#error-acceso').innerHTML = '<p class="error-acceso">Ese correo no existe. '
    + 'Usa uno de los tres de arriba, o el correo de cualquiera de los 10 técnicos.</p>';
}

function abrirVista(rol, correo, idTecnico) {
  sesion = { rol: rol, correo: correo, idTecnico: idTecnico };
  var raiz = el('#aplicacion');
  raiz.innerHTML = '';
  if (rol === 'supervisor') { pestanaSupervisor = 'resumen'; dibujarSupervisor(raiz); }
  else if (rol === 'coordinador') { pestanaCoordinador = 'ordenes'; dibujarCoordinador(raiz); }
  else { pantallaTecnico = 'hoy'; ordenActiva = null; dibujarTecnico(raiz); }
}

function cerrarSesion() {
  sesion = { rol: null, correo: null, idTecnico: null };
  dibujarAcceso();
}

/* ---------- Reinicio ---------- */

/* Sin confirm() del navegador: un dialogo modal nativo congela la pagina y arruina la demostracion. */
function pedirReinicio() {
  var caja = el('#confirmacion');
  caja.innerHTML = '<div class="modal-fondo"><div class="modal">'
    + '<h2>Reiniciar la demostración</h2>'
    + '<p>Vuelve al plan inicial: 15 jornadas, 30 órdenes y 33 equipos por instalar. '
    + 'Se borran los hitos, los comprobantes, los correos enviados y los cambios de parámetros.</p>'
    + '<div style="display:flex;gap:.5rem;justify-content:flex-end">'
    + '<button class="boton secundario" data-confirmar="no">Cancelar</button>'
    + '<button class="boton peligro" data-confirmar="si">Reiniciar</button>'
    + '</div></div></div>';
  caja.classList.remove('oculto');

  caja.addEventListener('click', function manejar(evento) {
    var boton = evento.target.closest('[data-confirmar]');
    if (!boton) { return; }
    caja.removeEventListener('click', manejar);
    caja.classList.add('oculto');
    caja.innerHTML = '';
    if (boton.getAttribute('data-confirmar') === 'si') {
      despachar('reiniciar', {});
      ordenActiva = null;
      propuestaActual = null;
      seleccionAsignacion = { jornada: null, tecnicos: [], conductor: null, vehiculo: null };
      abrirVista(sesion.rol, sesion.correo, sesion.idTecnico);
      alertaSuave('Demostración reiniciada.', 'ruta');
    }
  });
}

/* ---------- Avisos ---------- */

var temporizadorAviso = null;

function alertaSuave(texto, tono) {
  var caja = el('#avisos');
  caja.className = 'mensaje ' + (tono || '');
  caja.textContent = texto;
  caja.classList.remove('oculto');
  if (temporizadorAviso) { clearTimeout(temporizadorAviso); }
  temporizadorAviso = setTimeout(function () {
    caja.classList.add('oculto');
  }, 6000);
}

document.addEventListener('DOMContentLoaded', iniciar);
