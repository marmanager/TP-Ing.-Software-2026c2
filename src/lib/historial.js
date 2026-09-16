// El historial del negocio (SCRUM-75).
//
// Cada caso ya tenía su historial. Esto junta el de todos: los trabajos que
// entraron, los que cambiaron de estado, los que se entregaron y la plata de
// cada paso del presupuesto, en orden y con quién lo hizo.
//
// Cada evento guarda de qué tipo es (evento.tipo, 013_evento_tipo.sql). No se
// deduce del título a propósito: los títulos son texto para leer, y si un día
// alguien cambia "Entregaron el trabajo" por otra frase, un filtro que
// dependiera de esa frase dejaría de encontrar las entregas sin avisar.
//
// A los eventos que ya existían la migración les puso tipo según su título.
// El que no coincidió con ninguna frase conocida quedó sin tipo: aparece en
// "Todo" y en ningún filtro, porque es mejor no mostrarlo en un filtro que
// mostrarlo en el que no es.
//
// Acá no hay nada de React: son datos y funciones puras, con test.

const TIPOS_EVENTO = {
  entro: { clave: "entro", palabra: "Entraron" },
  estado: { clave: "estado", palabra: "Cambiaron de estado" },
  entrega: { clave: "entrega", palabra: "Se entregaron" },
  plata: { clave: "plata", palabra: "Plata" },
  nota: { clave: "nota", palabra: "Anotaciones" },
};

export const LISTA_TIPOS = Object.values(TIPOS_EVENTO);

// Desde cuándo mirar. "semana" y "mes" cuentan días enteros hacia atrás, no
// horas desde este instante: los últimos 7 días son hoy y los seis
// anteriores, cada uno desde la medianoche.
const PERIODOS = {
  semana: { clave: "semana", palabra: "Últimos 7 días", dias: 7 },
  mes: { clave: "mes", palabra: "Últimos 30 días", dias: 30 },
  todo: { clave: "todo", palabra: "Todo", dias: null },
};

export const LISTA_PERIODOS = Object.values(PERIODOS);

export function desdeDelPeriodo(periodo, ahora = new Date()) {
  const dias = PERIODOS[periodo]?.dias;
  if (!dias) return null;
  const desde = new Date(ahora);
  desde.setHours(0, 0, 0, 0);
  desde.setDate(desde.getDate() - (dias - 1));
  return desde;
}

// Los eventos del período y del tipo pedidos, del más nuevo al más viejo.
// tipo null o "todo" es todo.
export function filtrarHistorial(eventos, { tipo = null, periodo = "todo", ahora = new Date() } = {}) {
  const desde = desdeDelPeriodo(periodo, ahora);
  return eventos
    .filter((e) => !desde || new Date(e.ocurrido_en) >= desde)
    .filter((e) => !tipo || tipo === "todo" || e.tipo === tipo)
    .sort((a, b) => new Date(b.ocurrido_en) - new Date(a.ocurrido_en));
}

// Agrupados por día, en el orden en que vienen. La clave es el día local,
// no el UTC: un evento de las 22 hs de acá no puede caer en el día siguiente.
export function agruparPorDia(eventos) {
  const grupos = [];
  for (const e of eventos) {
    const clave = new Date(e.ocurrido_en).toDateString();
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.clave === clave) ultimo.eventos.push(e);
    else grupos.push({ clave, dia: e.ocurrido_en, eventos: [e] });
  }
  return grupos;
}

// Cuántos casos entraron y cuántos se entregaron, en los eventos que se
// están mirando.
export function resumirHistorial(eventos) {
  const cuantos = (tipo) => eventos.filter((e) => e.tipo === tipo).length;
  return {
    entraron: cuantos("entro"),
    entregados: cuantos("entrega"),
  };
}

// La plata que aprobaron los clientes en el período.
//
// Sale de los pasos y no de los eventos. Un paso aprobado ya no se puede
// volver atrás (014_paso_aprobado_fijo.sql), así que su fecha de aprobación
// es estable y cada uno cuenta una sola vez. Sumar eventos no serviría: en
// una base vieja puede haber aprobaciones que después se deshicieron.
//
// Un paso aprobado sin fecha —de antes de la columna, en el modo de
// ejemplo— no se puede ubicar en un período: cuenta sólo en "Todo".
export function plataAprobada(pasos, { periodo = "todo", ahora = new Date() } = {}) {
  const desde = desdeDelPeriodo(periodo, ahora);
  const aprobados = pasos
    .filter((p) => p.estado === "aprobado")
    .filter((p) => {
      if (!desde) return true;
      return p.aprobado_en && new Date(p.aprobado_en) >= desde;
    });
  return {
    total: aprobados.reduce((suma, p) => suma + Number(p.monto), 0),
    pasos: aprobados.length,
  };
}
