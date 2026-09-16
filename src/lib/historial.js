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
// Los eventos anteriores a la columna no tienen tipo. Aparecen en "Todo" y en
// ningún filtro: mejor no mostrarlos en un filtro que mostrarlos en el que no
// es.
//
// Acá no hay nada de React: son datos y funciones puras, con test.

export const TIPOS_EVENTO = {
  entro: { clave: "entro", palabra: "Entraron", icono: "carpeta" },
  estado: { clave: "estado", palabra: "Cambiaron de estado", icono: "llave" },
  entrega: { clave: "entrega", palabra: "Se entregaron", icono: "listo" },
  plata: { clave: "plata", palabra: "Plata", icono: "nota" },
  nota: { clave: "nota", palabra: "Anotaciones", icono: "diagnostico" },
};

export const LISTA_TIPOS = Object.values(TIPOS_EVENTO);

// Desde cuándo mirar. "semana" y "mes" cuentan hacia atrás desde hoy a la
// medianoche, no desde este instante: "esta semana" incluye la mañana de hace
// siete días entera.
export const PERIODOS = {
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

// Los tres números de arriba de la pantalla, para lo que se está mirando.
//
// No suma plata a propósito. Un paso aprobado se puede volver atrás, y el
// evento de "volver atrás" no guarda desde qué respuesta volvió: un total
// armado sumando eventos podría contar dos veces una aprobación deshecha. La
// plata se ve paso por paso, que es lo que pide el ticket, y el total real de
// cada caso está en su pantalla de pasos.
export function resumirHistorial(eventos) {
  const cuantos = (tipo) => eventos.filter((e) => e.tipo === tipo).length;
  return {
    entraron: cuantos("entro"),
    entregados: cuantos("entrega"),
    movimientosDePlata: cuantos("plata"),
  };
}
