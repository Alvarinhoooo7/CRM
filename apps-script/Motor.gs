/** MOTOR PURO. No usa servicios de Google ni modifica los argumentos. */
function exigir_(condicion, mensaje) { if (!condicion) throw new Error(mensaje); }
function numero_(valor, etiqueta) {
  exigir_(valor !== '' && valor !== null && valor !== undefined && Number.isFinite(Number(valor)), etiqueta + ': falta un número válido');
  return Number(valor);
}
function verdadero_(valor) { return valor === true || /^(sí|si|true)$/i.test(String(valor)); }
function indice_(filas, clave, tabla) {
  var salida = {};
  filas.forEach(function(fila, i) {
    var id = fila[clave];
    exigir_(id && !salida[id], tabla + ', fila ' + (i + 2) + ': ID vacío o duplicado ' + id);
    salida[id] = fila;
  });
  return salida;
}
function fechaClave_(fecha) {
  if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
  exigir_(fecha instanceof Date && !isNaN(fecha.getTime()), 'Fecha inválida: ' + fecha);
  // Fecha civil, independiente de la zona del equipo de pruebas.
  return fecha.getFullYear() + '-' + String(fecha.getMonth() + 1).padStart(2, '0') + '-' + String(fecha.getDate()).padStart(2, '0');
}
function lunesDe_(fecha) {
  var partes = fechaClave_(fecha).split('-').map(Number);
  var dia = new Date(partes[0], partes[1] - 1, partes[2], 12);
  dia.setDate(dia.getDate() - ((dia.getDay() + 6) % 7));
  return fechaClave_(dia);
}
function fechaLaboral_(inicio, desplazamiento) {
  var partes = fechaClave_(inicio).split('-').map(Number);
  var fecha = new Date(partes[0], partes[1] - 1, partes[2], 12);
  while (fecha.getDay() === 0 || fecha.getDay() === 6) fecha.setDate(fecha.getDate() + 1);
  while (desplazamiento > 0) {
    fecha.setDate(fecha.getDate() + 1);
    if (fecha.getDay() !== 0 && fecha.getDay() !== 6) desplazamiento--;
  }
  return fecha;
}
function parametrosDerivados_(p) {
  var salida = Object.assign({}, p);
  salida.P_JORNADA_EFECTIVA = p.P_JORNADA_SEMANAL - p.P_COLACION_H;
  salida.P_JORNADA_DIA = salida.P_JORNADA_EFECTIVA / p.P_DIAS_SEMANA;
  salida.P_JORNADA_DIA_MAX = p.P_JORNADA_SEMANAL / p.P_DIAS_SEMANA;
  salida.P_TOPE_DIA = salida.P_JORNADA_DIA_MAX + p.P_MAX_EXTRA;
  salida.P_T_CAP_EFECTIVA = p.P_T_CAPACITACION * (1 - p.P_REDUCCION_CAP);
  return salida;
}
function redondearAnticipo_(base,p) {
  var unidades=base*(1+p.P_IMPREVISTOS)/p.P_REDONDEO;
  return Math.ceil(unidades-Number.EPSILON*Math.max(1,Math.abs(unidades))*4)*p.P_REDONDEO;
}
function calcularPlan(datos) {
  var p = parametrosDerivados_(datos.parametros);
  ['P_RENDIMIENTO','P_DIAS_SEMANA','P_TEC_POR_CUADRILLA','P_CAPACIDAD_CAMIONETA','P_REDONDEO','P_FACTOR_HORAS','P_VEL_URBANA','P_VEL_R78','P_VEL_RUTA5'].forEach(function(k) {
    exigir_(numero_(p[k], 'CONFIG ' + k) > 0, 'CONFIG ' + k + ': debe ser positivo');
  });
  Object.keys(p).forEach(function(k) { if (typeof p[k] === 'number') exigir_(Number.isFinite(p[k]) && p[k] >= 0, 'CONFIG ' + k + ': valor fuera de rango'); });
  exigir_(p.P_REDUCCION_CAP <= 1 && p.P_IMPREVISTOS <= 1 && p.P_COLACION_H < p.P_JORNADA_SEMANAL, 'CONFIG: porcentajes o jornada inválidos');
  var destinos = indice_(datos.DESTINOS, 'ID_Destino', 'DESTINOS');
  var tecnicos = indice_(datos.TECNICOS, 'ID_Tecnico', 'TECNICOS');
  var vehiculos = indice_(datos.CAMIONETAS, 'ID_Vehiculo', 'CAMIONETAS');
  indice_(datos.ORDENES, 'ID_Orden', 'ORDENES');
  indice_(datos.VISITAS, 'ID_Visita', 'VISITAS');
  var jornadas = {}, alertas = [], vistos = {}, ocupaciones = {}, usoVehiculo = {};
  var filas = datos.ORDENES.filter(function(o) { return o.Estado_Orden !== 'Cancelada'; });
  filas.forEach(function(o) {
    var t = tecnicos[o.ID_Tecnico], v = vehiculos[o.ID_Vehiculo];
    exigir_(t, 'ORDENES ' + o.ID_Orden + ': técnico inexistente ' + o.ID_Tecnico);
    exigir_(v, 'ORDENES ' + o.ID_Orden + ': vehículo inexistente ' + o.ID_Vehiculo);
    var fecha = fechaClave_(o.Fecha), clave = o.ID_Jornada;
    exigir_(clave, 'ORDENES ' + o.ID_Orden + ': falta ID_Jornada');
    exigir_(!ocupaciones[o.ID_Tecnico + fecha], 'ORDENES ' + o.ID_Orden + ': técnico asignado dos veces el ' + fecha);
    ocupaciones[o.ID_Tecnico + fecha] = true;
    if (!verdadero_(t.Activo)) alertas.push('Técnico inactivo: ' + o.ID_Tecnico);
    if (v.Estado === 'En taller') alertas.push('Vehículo en taller: ' + v.ID_Vehiculo);
    if (verdadero_(o.Es_Conductor) && t.Licencia !== 'Clase B') alertas.push('Conductor sin licencia: ' + t.ID_Tecnico);
    if (!jornadas[clave]) jornadas[clave] = { id: clave, fecha: fecha, cuadrilla: o.Cuadrilla, vehiculo: o.ID_Vehiculo, ordenes: [], visitas: [], km: 0, viaje: 0, peaje: 0, instalacion: 0, capacitacion: 0, equipos: 0, noches: 0, fuera: false };
    var j = jornadas[clave];
    exigir_(j.fecha === fecha && j.cuadrilla === o.Cuadrilla && j.vehiculo === o.ID_Vehiculo, 'ORDENES ' + o.ID_Orden + ': jornada inconsistente');
    j.ordenes.push(o);
    var uso = o.ID_Vehiculo + fecha;
    if (usoVehiculo[uso] && usoVehiculo[uso] !== clave) alertas.push('Vehículo asignado a dos jornadas: ' + o.ID_Vehiculo + ' ' + fecha);
    usoVehiculo[uso] = clave;
  });
  datos.VISITAS.forEach(function(v) {
    if (!jornadas[v.ID_Jornada]) {
      exigir_(datos.ORDENES.some(function(o) { return o.ID_Jornada === v.ID_Jornada && o.Estado_Orden === 'Cancelada'; }), 'VISITAS ' + v.ID_Visita + ': jornada inexistente');
      return;
    }
    jornadas[v.ID_Jornada].visitas.push(v);
  });
  var resultadosVisitas = [], resultados = [], flota = {}, transferencias = {}, sesiones = 0;
  Object.values(jornadas).sort(function(a,b) { return a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id); }).forEach(function(j) {
    exigir_(j.visitas.length, 'VISITAS: faltan tramos para ' + j.id);
    var conductores = j.ordenes.filter(function(o) { return verdadero_(o.Es_Conductor); });
    exigir_(conductores.length === 1, 'ORDENES ' + j.id + ': debe haber exactamente un conductor');
    exigir_(j.ordenes.length <= p.P_TEC_POR_CUADRILLA, 'ORDENES ' + j.id + ': excede capacidad de cuadrilla');
    var secuencias = {}, anterior;
    j.visitas.sort(function(a,b) { return Number(a.Secuencia) - Number(b.Secuencia); }).forEach(function(v) {
      var destino = v.ID_Destino === 'BASE' ? { En_RM: true, Comuna: 'Base', Direccion_Municipalidad: p.P_BASE } : destinos[v.ID_Destino];
      var origen = v.ID_Origen === 'BASE' ? { En_RM: true } : destinos[v.ID_Origen];
      exigir_(destino && origen, 'VISITAS ' + v.ID_Visita + ': origen o destino inexistente');
      exigir_(!secuencias[v.Secuencia] && Number(v.Secuencia) > 0, 'VISITAS ' + v.ID_Visita + ': secuencia duplicada o inválida');
      secuencias[v.Secuencia] = true;
      exigir_(!anterior || anterior === v.ID_Origen, 'VISITAS ' + v.ID_Visita + ': el tramo no continúa desde el destino anterior');
      anterior = v.ID_Destino;
      var km = numero_(v.Km, 'VISITAS ' + v.ID_Visita + ' Km'), peaje = numero_(v.Peaje, 'VISITAS ' + v.ID_Visita + ' Peaje');
      var equipos = numero_(v.Equipos, 'VISITAS ' + v.ID_Visita + ' Equipos'), noches = numero_(v.Noches, 'VISITAS ' + v.ID_Visita + ' Noches');
      exigir_(km >= 0 && peaje >= 0 && Number.isInteger(equipos) && equipos >= 0 && Number.isInteger(noches) && noches >= 0, 'VISITAS ' + v.ID_Visita + ': cantidades negativas o fraccionarias');
      exigir_(v.ID_Destino !== 'BASE' || equipos === 0, 'VISITAS ' + v.ID_Visita + ': no se instala en la base');
      var velocidad = v.Corredor === 'URB' ? p.P_VEL_URBANA : v.Corredor === 'R78' ? p.P_VEL_R78 : /^(R5N|R5S)$/.test(v.Corredor) ? p.P_VEL_RUTA5 : null;
      exigir_(velocidad, 'VISITAS ' + v.ID_Visita + ': corredor inválido');
      var cap = equipos > 0 && !vistos[v.ID_Destino] ? p.P_CAP_POR_COMUNA * p.P_T_CAP_EFECTIVA : 0;
      if (equipos > 0 && !vistos[v.ID_Destino]) { sesiones += p.P_CAP_POR_COMUNA; vistos[v.ID_Destino] = true; }
      var instalacion = equipos ? Math.ceil(equipos / j.ordenes.length) * p.P_T_INSTALACION : 0;
      var horasTramo = km / velocidad * p.P_FACTOR_HORAS;
      j.km += km; j.peaje += peaje; j.viaje += horasTramo; j.instalacion += instalacion; j.capacitacion += cap; j.equipos += equipos; j.noches += noches;
      j.fuera = j.fuera || !verdadero_(destino.En_RM) || !verdadero_(origen.En_RM);
      resultadosVisitas.push(Object.assign({}, v, { Horas_Viaje: horasTramo, Horas_Instalacion: instalacion, Horas_Capacitacion: cap, Comuna: destino.Comuna, Direccion: destino.Direccion_Municipalidad }));
      if (!v.Origen_Dato || v.Origen_Dato === 'SUPUESTO') alertas.push('Ruta estimada: ' + v.ID_Visita);
    });
    exigir_(j.noches <= 1, 'VISITAS ' + j.id + ': solo una pernoctación por jornada');
    j.horas = j.viaje + j.instalacion + j.capacitacion;
    j.estado = j.horas <= p.P_JORNADA_DIA ? 'OK' : j.horas <= p.P_JORNADA_DIA_MAX ? 'TOLERANCIA' : j.horas <= p.P_TOPE_DIA ? 'SOBRETIEMPO' : 'FUERA DE LEY';
    if (j.estado === 'FUERA DE LEY') alertas.push('Jornada sobre tope: ' + j.id);
    if (j.viaje > p.P_TOPE_CONDUCCION) alertas.push('Conducción sobre tope: ' + j.id);
    var comunas = j.visitas.filter(function(v) { return Number(v.Equipos) > 0; }).map(function(v) { return destinos[v.ID_Destino].Comuna; });
    j.ordenes.forEach(function(o) {
      var conductor = verdadero_(o.Es_Conductor), tecnico = tecnicos[o.ID_Tecnico];
      var extra = Math.max(0, j.horas - p.P_JORNADA_DIA_MAX);
      var combustible = conductor ? j.km / p.P_RENDIMIENTO * p.P_DIESEL : 0;
      var estipendio = j.fuera ? p.P_VIATICO : p.P_COLACION;
      var fila = Object.assign({}, o, { Nombre_Tecnico: tecnico.Nombre, Email: tecnico.Email,
        Comuna: comunas.join(', ') || 'Traslado', Direccion: j.visitas.map(function(v) { return v.ID_Destino === 'BASE' ? p.P_BASE : destinos[v.ID_Destino].Direccion_Municipalidad; }).join(' → '),
        Equipos: j.equipos, Tecnicos_En_Sitio: j.ordenes.length, Horas_Viaje: j.viaje, Horas_Instalacion: j.instalacion, Horas_Capacitacion: j.capacitacion,
        Horas_Totales: j.horas, Estado_Jornada: j.estado, Horas_Extra: extra, Costo_Horas_Extra: extra * p.P_VALOR_HORA * (1 + p.P_RECARGO_EXTRA),
        Km_Dia: conductor ? j.km : 0, Peaje: conductor ? j.peaje : 0, Combustible: combustible, Desgaste: conductor ? j.km * p.P_COSTO_KM : 0,
        Tipo_Estipendio: j.fuera ? 'Viatico' : 'Colacion', Estipendio: estipendio, Noches: j.noches, Hotel_Monto: j.noches * p.P_HOTEL,
        Total_Transferencia: estipendio + j.noches * p.P_HOTEL + (conductor ? j.peaje : 0) + combustible });
      resultados.push(fila);
      var t = transferencias[o.ID_Tecnico] || { ID_Tecnico: o.ID_Tecnico, Nombre: tecnico.Nombre, Base: 0, Dias_Fuera: 0, Dias_RM: 0, Noches: 0 };
      t.Base += fila.Total_Transferencia; t.Dias_Fuera += j.fuera ? 1 : 0; t.Dias_RM += j.fuera ? 0 : 1; t.Noches += j.noches;
      transferencias[o.ID_Tecnico] = t;
    });
    var f = flota[j.vehiculo] || { ID_Vehiculo: j.vehiculo, Km_Recorridos_Plan: 0, Gasto_Peajes: 0 };
    f.Km_Recorridos_Plan += j.km; f.Gasto_Peajes += j.peaje; flota[j.vehiculo] = f;
  });
  // Tope semanal de horas extra por técnico: la semana civil arranca el lunes.
  var extraSemanal = {};
  resultados.forEach(function(o) {
    var clave = o.ID_Tecnico + '|' + lunesDe_(o.Fecha);
    extraSemanal[clave] = (extraSemanal[clave] || 0) + o.Horas_Extra;
  });
  Object.keys(extraSemanal).forEach(function(clave) {
    if (extraSemanal[clave] > p.P_HORAS_EXTRA_SEMANA + 0.000001) {
      var partes = clave.split('|');
      alertas.push('Horas extra sobre el tope semanal: ' + partes[0] + ' acumula ' + extraSemanal[clave].toFixed(2) + ' h en la semana del ' + partes[1]);
    }
  });
  Object.values(transferencias).forEach(function(t) {
    // Tolerancia de representación binaria, no redondeo prematuro de costos.
    t.Monto_A_Transferir = redondearAnticipo_(t.Base,p);
    t.Reserva = t.Monto_A_Transferir - t.Base;
    t.Detalle = t.Dias_Fuera + ' días fuera RM + ' + t.Dias_RM + ' días RM + ' + t.Noches + ' noches; gastos de vehículo solo conductor; reserva y redondeo incluidos';
  });
  function suma(campo) { return resultados.reduce(function(a,o) { return a + o[campo]; }, 0); }
  var total = Object.values(transferencias).reduce(function(a,t) { return a + t.Monto_A_Transferir; }, 0);
  var resumen = { Equipos_Planificados: resultadosVisitas.reduce(function(a,v) { return a + Number(v.Equipos); },0), Comunas_Planificadas: Object.keys(vistos).length,
    Capacitaciones_Planificadas: sesiones, Ordenes: resultados.length, Dias_Habiles: new Set(resultados.map(function(o) { return fechaClave_(o.Fecha); })).size,
    Km: suma('Km_Dia'), Combustible: suma('Combustible'), Peajes: suma('Peaje'), Estipendios: suma('Estipendio'), Hotel: suma('Hotel_Monto'),
    Subtotal: suma('Total_Transferencia'), Total_A_Transferir: total, Desgaste: suma('Desgaste'), Horas_Extra: suma('Costo_Horas_Extra'),
    Costo_Operacion: total + suma('Desgaste') + suma('Costo_Horas_Extra') };
  return { ordenes: resultados, visitas: resultadosVisitas, jornadas: Object.values(jornadas), flota: Object.values(flota), transferencias: Object.values(transferencias), resumen: resumen, alertas: Array.from(new Set(alertas)) };
}
