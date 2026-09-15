/* MOTOR DE CALCULO. Funciones puras: no leen el DOM ni localStorage.
   Toda constante economica sale de estado.parametros, ninguna esta cableada aqui. */

function velocidadCorredor(corredor, p) {
  if (corredor === 'URB') { return p.P_VEL_URBANA; }
  if (corredor === 'R78') { return p.P_VEL_R78; }
  return p.P_VEL_RUTA5;
}

function indicePor(lista, clave) {
  var mapa = {};
  lista.forEach(function (x) { mapa[x[clave]] = x; });
  return mapa;
}

function redondearArriba(monto, multiplo) {
  /* La tolerancia evita que 55000.0000001 suba al millar siguiente. */
  return Math.ceil((monto - 1e-6) / multiplo) * multiplo;
}

function esRM(idDestino, destinosPorId) {
  if (idDestino === 'BASE') { return true; }
  var d = destinosPorId[idDestino];
  return d ? d.En_RM : true;
}

/* Calcula una jornada completa. Devuelve un objeto nuevo, no muta la entrada. */
function calcularJornada(jornada, estado) {
  var p = estado.parametros;
  var destinosPorId = indicePor(estado.destinos, 'ID_Destino');
  var tecnicosPorId = indicePor(estado.tecnicos, 'ID_Tecnico');
  var flotaPorId = indicePor(estado.flota, 'ID_Vehiculo');

  var km = 0, peaje = 0, equipos = 0, noches = 0, horasViaje = 0;
  var fueraRM = false;
  var sesiones = [];
  var comunas = [];

  jornada.Tramos.forEach(function (t) {
    km += t.Km;
    peaje += t.Peaje;
    equipos += t.Equipos;
    noches += t.Noches;
    horasViaje += (t.Km / velocidadCorredor(t.Corredor, p)) * p.P_FACTOR_HORAS;
    if (!esRM(t.Origen, destinosPorId) || !esRM(t.Destino, destinosPorId)) { fueraRM = true; }
    if (t.Equipos > 0 && sesiones.indexOf(t.Destino) === -1) { sesiones.push(t.Destino); }
    if (t.Destino !== 'BASE' && comunas.indexOf(t.Destino) === -1) { comunas.push(t.Destino); }
  });

  var nTecnicos = jornada.Tecnicos.length;
  /* La instalacion es paralelizable en sitio: mas tecnicos, menos horas cada uno.
     La capacitacion no lo es: su duracion se carga completa a todos los asistentes. */
  var horasInstalacion = nTecnicos > 0 ? (equipos * p.P_T_INSTALACION) / nTecnicos : 0;
  var horasCapacitacion = 0;
  sesiones.forEach(function (idDestino) {
    var d = destinosPorId[idDestino];
    horasCapacitacion += (d && d.Link_Enviado) ? p.P_T_CAP_EFECTIVA : p.P_T_CAPACITACION;
  });

  var horasTotales = horasViaje + horasInstalacion + horasCapacitacion;
  var horasExtraBrutas = Math.max(0, horasTotales - p.P_JORNADA_DIA);
  var horasExtra = Math.min(horasExtraBrutas, p.P_MAX_EXTRA);

  var combustible = (km / p.P_RENDIMIENTO) * p.P_DIESEL;
  var desgaste = km * p.P_COSTO_KM;
  var estipendioTipo = fueraRM ? 'Viático' : 'Colación';
  var estipendioMonto = fueraRM ? p.P_VIATICO : p.P_COLACION;
  var hotelPorTecnico = noches * p.P_HOTEL;
  var costoHorasExtraPorTecnico = horasExtra * p.P_VALOR_HORA * (1 + p.P_RECARGO_EXTRA);

  var vehiculo = flotaPorId[jornada.ID_Vehiculo];
  var conductor = tecnicosPorId[jornada.Conductor];

  var alertas = [];
  if (horasTotales > p.P_TOPE_DIA) {
    alertas.push({ nivel: 'alto', texto: 'Supera el tope diario de ' + formatoHoras(p.P_TOPE_DIA) + ': ' + formatoHoras(horasTotales) });
  }
  if (horasViaje > p.P_TOPE_CONDUCCION) {
    alertas.push({ nivel: 'alto', texto: 'Supera el máximo de conducción de ' + formatoHoras(p.P_TOPE_CONDUCCION) + ': ' + formatoHoras(horasViaje) });
  }
  if (nTecnicos > p.P_CAPACIDAD_CAMIONETA) {
    alertas.push({ nivel: 'alto', texto: nTecnicos + ' técnicos en una camioneta de ' + p.P_CAPACIDAD_CAMIONETA });
  }
  if (nTecnicos === 0) {
    alertas.push({ nivel: 'alto', texto: 'Jornada sin técnicos asignados' });
  }
  if (!conductor) {
    alertas.push({ nivel: 'alto', texto: 'Jornada sin conductor asignado' });
  } else if (!conductor.Licencia) {
    alertas.push({ nivel: 'alto', texto: conductor.Nombre + ' no tiene licencia y figura como conductor' });
  } else if (jornada.Tecnicos.indexOf(jornada.Conductor) === -1) {
    alertas.push({ nivel: 'alto', texto: 'El conductor no está en el equipo de la jornada' });
  }
  if (vehiculo && vehiculo.Estado === 'Taller') {
    alertas.push({ nivel: 'alto', texto: vehiculo.ID_Vehiculo + ' está en taller' });
  }
  if (horasExtraBrutas > p.P_MAX_EXTRA) {
    alertas.push({ nivel: 'medio', texto: 'Excede el tope de horas extra: se pagan ' + formatoHoras(p.P_MAX_EXTRA) + ' de ' + formatoHoras(horasExtraBrutas) });
  }
  if (noches === 0 && horasViaje / 2 > p.P_UMBRAL_PERNOCTA) {
    alertas.push({ nivel: 'medio', texto: 'La ida supera ' + formatoHoras(p.P_UMBRAL_PERNOCTA) + ' y no hay pernoctación planificada' });
  }

  return {
    ID_Jornada: jornada.ID_Jornada,
    Dia: jornada.Dia,
    Fecha: jornada.Fecha,
    ID_Vehiculo: jornada.ID_Vehiculo,
    Tecnicos: jornada.Tecnicos.slice(),
    Conductor: jornada.Conductor,
    Tramos: jornada.Tramos,
    Comunas: comunas,
    Km: km,
    Peaje: peaje,
    Equipos: equipos,
    Noches: noches,
    Sesiones: sesiones,
    Fuera_RM: fueraRM,
    Horas_Viaje: horasViaje,
    Horas_Instalacion: horasInstalacion,
    Horas_Capacitacion: horasCapacitacion,
    Horas_Totales: horasTotales,
    Horas_Extra: horasExtra,
    Horas_Extra_Brutas: horasExtraBrutas,
    Combustible: combustible,
    Desgaste: desgaste,
    Estipendio_Tipo: estipendioTipo,
    Estipendio: estipendioMonto,
    Hotel: hotelPorTecnico,
    Costo_Horas_Extra: costoHorasExtraPorTecnico,
    Alertas: alertas
  };
}

/* Recalcula el plan completo. Se ejecuta entero en cada cambio: con 30 ordenes es instantaneo. */
function recalcularPlan(estado) {
  var p = estado.parametros;
  var tecnicosPorId = indicePor(estado.tecnicos, 'ID_Tecnico');
  var destinosPorId = indicePor(estado.destinos, 'ID_Destino');

  var jornadas = estado.jornadas.map(function (j) { return calcularJornada(j, estado); });
  var jornadasPorId = indicePor(jornadas, 'ID_Jornada');

  /* Nómina por tecnico. Solo el conductor recibe combustible y peajes. */
  var nomina = estado.tecnicos.map(function (t) {
    var base = 0, viatico = 0, colacion = 0, hotel = 0, combustible = 0, peaje = 0;
    var horas = 0, horasExtra = 0, jornadasAsignadas = 0;

    jornadas.forEach(function (j) {
      if (j.Tecnicos.indexOf(t.ID_Tecnico) === -1) { return; }
      jornadasAsignadas++;
      horas += j.Horas_Totales;
      horasExtra += j.Horas_Extra;
      if (j.Estipendio_Tipo === 'Viático') { viatico += j.Estipendio; } else { colacion += j.Estipendio; }
      hotel += j.Hotel;
      if (j.Conductor === t.ID_Tecnico) {
        combustible += j.Combustible;
        peaje += j.Peaje;
      }
    });

    base = viatico + colacion + hotel + combustible + peaje;
    var reserva = base * p.P_IMPREVISTOS;
    var total = base > 0 ? redondearArriba(base + reserva, p.P_REDONDEO) : 0;

    return {
      ID_Tecnico: t.ID_Tecnico,
      Nombre: t.Nombre,
      Email: t.Email,
      Licencia: t.Licencia,
      Jornadas: jornadasAsignadas,
      Horas: horas,
      Horas_Extra: horasExtra,
      Viatico: viatico,
      Colacion: colacion,
      Hotel: hotel,
      Combustible: combustible,
      Peaje: peaje,
      Base: base,
      Reserva: total - base,
      Total: total
    };
  });

  /* Ejecución real reportada por los tecnicos desde el telefono. */
  var equiposInstalados = 0, ordenesCerradas = 0, ordenesIniciadas = 0, horasReales = 0;
  var checklistCompletos = 0;
  estado.ordenes.forEach(function (o) {
    equiposInstalados += o.Equipos_Instalados || 0;
    if (o.Hora_Inicio) { ordenesIniciadas++; }
    if (o.Hora_Fin) { ordenesCerradas++; }
    if (o.Hora_Inicio && o.Hora_Fin) {
      horasReales += (new Date(o.Hora_Fin) - new Date(o.Hora_Inicio)) / 3600000;
    }
    if (checklistCompleto(o)) { checklistCompletos++; }
  });

  var rendido = 0, rendidoPorTecnico = {};
  estado.gastos.forEach(function (g) {
    if (g.Estado !== 'Aprobado') { return; }
    rendido += g.Monto;
    rendidoPorTecnico[g.ID_Tecnico] = (rendidoPorTecnico[g.ID_Tecnico] || 0) + g.Monto;
  });

  var pagos = estado.pagos || {};
  var transferido = 0;
  nomina.forEach(function (n) {
    n.Transferido = pagos[n.ID_Tecnico] ? n.Total : 0;
    n.Rendido = rendidoPorTecnico[n.ID_Tecnico] || 0;
    n.Saldo = n.Transferido - n.Rendido;
    transferido += n.Transferido;
  });

  /* Totales del plan. El desgaste es costo de empresa y no se transfiere a nadie. */
  var resumen = {
    Km: 0, Combustible: 0, Peajes: 0, Viaticos: 0, Colaciones: 0, Hotel: 0,
    Desgaste: 0, Costo_Horas_Extra: 0, Horas_Extra: 0, Horas_Plan: 0,
    Equipos_Previstos: 0, Capacitaciones: 0, Noches_Persona: 0
  };

  jornadas.forEach(function (j) {
    var n = j.Tecnicos.length;
    resumen.Km += j.Km;
    resumen.Combustible += j.Combustible;
    resumen.Peajes += j.Peaje;
    resumen.Desgaste += j.Desgaste;
    resumen.Equipos_Previstos += j.Equipos;
    resumen.Capacitaciones += j.Sesiones.length;
    resumen.Noches_Persona += j.Noches * n;
    resumen.Horas_Plan += j.Horas_Totales * n;
    resumen.Horas_Extra += j.Horas_Extra * n;
    resumen.Costo_Horas_Extra += j.Costo_Horas_Extra * n;
    if (j.Estipendio_Tipo === 'Viático') { resumen.Viaticos += j.Estipendio * n; } else { resumen.Colaciones += j.Estipendio * n; }
    resumen.Hotel += j.Hotel * n;
  });

  resumen.Subtotal = resumen.Combustible + resumen.Peajes + resumen.Viaticos + resumen.Colaciones + resumen.Hotel;
  resumen.Nomina = nomina.reduce(function (a, n) { return a + n.Total; }, 0);
  resumen.Reserva = nomina.reduce(function (a, n) { return a + n.Reserva; }, 0);
  resumen.Costo_Total = resumen.Nomina + resumen.Desgaste + resumen.Costo_Horas_Extra;
  resumen.Transferido = transferido;
  resumen.Rendido = rendido;
  resumen.Brecha = transferido - rendido;
  resumen.Equipos_Instalados = equiposInstalados;
  resumen.Ordenes = estado.ordenes.length;
  resumen.Ordenes_Iniciadas = ordenesIniciadas;
  resumen.Ordenes_Cerradas = ordenesCerradas;
  resumen.Checklist_Completos = checklistCompletos;
  resumen.Horas_Reales = horasReales;
  resumen.Jornadas = jornadas.length;
  resumen.Avance = resumen.Equipos_Previstos > 0 ? equiposInstalados / resumen.Equipos_Previstos : 0;

  /* Alertas de jornada mas el control semanal de horas extra por tecnico. */
  var alertas = [];
  jornadas.forEach(function (j) {
    j.Alertas.forEach(function (a) {
      alertas.push({ nivel: a.nivel, origen: j.ID_Jornada, fecha: j.Fecha, texto: a.texto });
    });
  });
  nomina.forEach(function (n) {
    if (n.Horas_Extra > p.P_HORAS_EXTRA_SEMANA) {
      alertas.push({
        nivel: 'alto', origen: n.ID_Tecnico, fecha: '',
        texto: n.Nombre + ' acumula ' + formatoHoras(n.Horas_Extra) + ' extra, sobre el tope semanal de ' + formatoHoras(p.P_HORAS_EXTRA_SEMANA)
      });
    }
  });
  /* Una sola alerta agrupada: 16 lineas identicas no informan mas que una. */
  var sinLink = estado.destinos.filter(function (d) { return d.Equipos > 0 && !d.Link_Enviado; });
  if (sinLink.length) {
    alertas.push({
      nivel: 'bajo', origen: 'Capacitación', fecha: '',
      texto: sinLink.length + ' comuna(s) sin link de capacitación enviado: '
        + sinLink.map(function (d) { return d.Comuna; }).join(', ')
        + '. Cada una se cobra ' + formatoHoras(p.P_T_CAPACITACION)
        + ' en vez de ' + formatoHoras(p.P_T_CAP_EFECTIVA) + '.'
    });
  }

  /* Costo por comuna: prorrateo contable del corredor segun equipos, traslados incluidos.
     No es un costo geografico exacto y la interfaz lo declara. */
  var porComuna = {};
  jornadas.forEach(function (j) {
    var n = j.Tecnicos.length;
    var costo = j.Combustible + j.Peaje + j.Desgaste
      + (j.Estipendio * n) + (j.Hotel * n) + (j.Costo_Horas_Extra * n);
    var destinosConEquipos = j.Sesiones.length ? j.Sesiones : j.Comunas;
    if (!destinosConEquipos.length) { return; }
    var equiposJornada = j.Equipos || destinosConEquipos.length;
    destinosConEquipos.forEach(function (idDestino) {
      var d = destinosPorId[idDestino];
      if (!d) { return; }
      var equiposDestino = 0;
      j.Tramos.forEach(function (t) { if (t.Destino === idDestino) { equiposDestino += t.Equipos; } });
      var peso = equiposJornada > 0 ? (equiposDestino || 1) / equiposJornada : 1 / destinosConEquipos.length;
      porComuna[d.Comuna] = (porComuna[d.Comuna] || 0) + costo * peso;
    });
  });

  return {
    jornadas: jornadas,
    jornadasPorId: jornadasPorId,
    nomina: nomina,
    resumen: resumen,
    alertas: alertas,
    porComuna: porComuna,
    tecnicosPorId: tecnicosPorId,
    destinosPorId: destinosPorId
  };
}

function checklistCompleto(orden) {
  return orden.Checklist.length > 0 && orden.Checklist.every(function (c) { return c.Marcado; });
}

/* Arma el enlace de Google Maps con coordenadas, nunca con texto: asi Maps no geocodifica
   y no puede equivocarse de direccion. Encadena toda la jornada como una sola ruta. */
function enlaceMaps(jornada, estado) {
  var destinosPorId = indicePor(estado.destinos, 'ID_Destino');
  function punto(id) {
    if (id === 'BASE') { return BASE_OPERACIONES.Lat + ',' + BASE_OPERACIONES.Lng; }
    var d = destinosPorId[id];
    return d ? d.Lat + ',' + d.Lng : null;
  }
  var secuencia = [];
  jornada.Tramos.forEach(function (t, i) {
    if (i === 0) { secuencia.push(t.Origen); }
    if (secuencia[secuencia.length - 1] !== t.Destino) { secuencia.push(t.Destino); }
  });
  var puntos = secuencia.map(punto).filter(function (x) { return x; });
  if (puntos.length < 2) { return null; }

  var url = 'https://www.google.com/maps/dir/?api=1'
    + '&origin=' + encodeURIComponent(puntos[0])
    + '&destination=' + encodeURIComponent(puntos[puntos.length - 1])
    + '&travelmode=driving';
  var intermedios = puntos.slice(1, -1);
  if (intermedios.length) {
    url += '&waypoints=' + encodeURIComponent(intermedios.join('|'));
  }
  return url;
}

/* Propone el mejor equipo disponible y explica por que lo eligio. */
function autoasignar(estado, plan, fecha, cantidadTecnicos) {
  var ocupados = {}, vehiculosOcupados = {};
  plan.jornadas.forEach(function (j) {
    if (j.Fecha !== fecha) { return; }
    j.Tecnicos.forEach(function (id) { ocupados[id] = j.ID_Jornada; });
    vehiculosOcupados[j.ID_Vehiculo] = j.ID_Jornada;
  });

  var cargaPorTecnico = {};
  plan.nomina.forEach(function (n) { cargaPorTecnico[n.ID_Tecnico] = n.Horas; });

  var libres = estado.tecnicos.filter(function (t) { return t.Activo && !ocupados[t.ID_Tecnico]; });
  libres.sort(function (a, b) { return (cargaPorTecnico[a.ID_Tecnico] || 0) - (cargaPorTecnico[b.ID_Tecnico] || 0); });

  var conLicencia = libres.filter(function (t) { return t.Licencia; });
  if (!conLicencia.length) {
    return { ok: false, motivo: 'No queda ningún técnico con licencia libre el ' + fecha + '.' };
  }

  var equipo = [conLicencia[0]];
  libres.forEach(function (t) {
    if (equipo.length >= cantidadTecnicos) { return; }
    if (equipo.indexOf(t) === -1) { equipo.push(t); }
  });
  if (equipo.length < cantidadTecnicos) {
    return { ok: false, motivo: 'Solo hay ' + equipo.length + ' técnico(s) libre(s) el ' + fecha + ', se pidieron ' + cantidadTecnicos + '.' };
  }

  var vehiculo = estado.flota.filter(function (v) {
    return v.Estado !== 'Taller' && !vehiculosOcupados[v.ID_Vehiculo];
  })[0];
  if (!vehiculo) {
    return { ok: false, motivo: 'No queda ninguna camioneta libre el ' + fecha + '.' };
  }

  var motivo = equipo[0].Nombre + ' conduce porque tiene licencia y es quien menos horas acumula ('
    + formatoHoras(cargaPorTecnico[equipo[0].ID_Tecnico] || 0) + ').';
  if (equipo.length > 1) {
    motivo += ' Lo acompaña ' + equipo.slice(1).map(function (t) { return t.Nombre; }).join(' y ') + '.';
  }
  motivo += ' Se toma ' + vehiculo.ID_Vehiculo + ' (' + vehiculo.Patente + ')'
    + (vehiculo.Estado === 'Reserva' ? ', que es la de reserva.' : '.');

  return {
    ok: true,
    tecnicos: equipo.map(function (t) { return t.ID_Tecnico; }),
    conductor: equipo[0].ID_Tecnico,
    vehiculo: vehiculo.ID_Vehiculo,
    motivo: motivo
  };
}

function formatoHoras(h) {
  var total = Math.round(h * 60);
  var horas = Math.floor(total / 60);
  var minutos = total % 60;
  return horas + ' h ' + (minutos < 10 ? '0' : '') + minutos + ' min';
}

function clp(monto) {
  var n = Math.round(Number(monto) || 0);
  return '$' + n.toLocaleString('es-CL');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    recalcularPlan: recalcularPlan,
    calcularJornada: calcularJornada,
    enlaceMaps: enlaceMaps,
    autoasignar: autoasignar,
    checklistCompleto: checklistCompleto,
    redondearArriba: redondearArriba,
    velocidadCorredor: velocidadCorredor,
    formatoHoras: formatoHoras,
    clp: clp
  };
}
