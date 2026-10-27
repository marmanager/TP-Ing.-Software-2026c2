// Los cuatro estados de un turno de la agenda.
//
// SEGUNDO VOCABULARIO, A PROPÓSITO. Un turno no es un caso: el caso son los
// cinco estados de la cartilla (estados.js), que cuentan cómo avanza un
// trabajo. El turno cuenta otra cosa —si la persona va a venir y si vino— y
// vive en el módulo Agenda, que un negocio puede tener apagado.
//
// Estaban escritos a mano adentro de la pantalla de la agenda, sin definir en
// ningún lado: el próximo que tocara la pantalla iba a inventar otros
// (auditoría, H4). Acá quedan los cuatro, con su palabra, su color y su
// ícono, igual que los cinco estados del caso.
//
// Los colores salen de los tokens de la cartilla y no se inventan. "agendado"
// y "atendido" no llevan color propio: uno todavía no pasó nada y el otro ya
// pasó, así que van en gris. El color queda para lo que pide atención.
//
// Las clases de Tailwind van escritas enteras, igual que en estados.js: el
// escáner lee el código fuente y un `text-${x}` no generaría nada.

import { tCastellano } from "./idioma.js";

export const ESTADOS_TURNO = {
  agendado: {
    clave: "agendado",
    palabra: tCastellano("agenda.estado.agendado.palabra"),
    icono: "reloj",
    texto: "text-tinta-media",
    significado: tCastellano("agenda.estado.agendado.significado"),
  },
  confirmado: {
    clave: "confirmado",
    palabra: tCastellano("agenda.estado.confirmado.palabra"),
    icono: "listo",
    texto: "text-completo",
    significado: tCastellano("agenda.estado.confirmado.significado"),
  },
  cancelado: {
    clave: "cancelado",
    palabra: tCastellano("agenda.estado.cancelado.palabra"),
    icono: "cruz",
    texto: "text-tinta-suave line-through",
    significado: tCastellano("agenda.estado.cancelado.significado"),
  },
  atendido: {
    clave: "atendido",
    palabra: tCastellano("agenda.estado.atendido.palabra"),
    icono: "persona-check",
    texto: "text-tinta-suave",
    significado: tCastellano("agenda.estado.atendido.significado"),
  },
};

// Las palabras salen del diccionario (agenda.estado.*): en ESTADOS_TURNO están
// en castellano, que es lo que leen los tests y los que todavía no pasan `t`;
// estadoDeTurno(estado, t) las da en el idioma de quien mira.
export function estadoDeTurno(estado, t = tCastellano) {
  const e = ESTADOS_TURNO[estado] ?? ESTADOS_TURNO.agendado;
  return {
    ...e,
    palabra: t(`agenda.estado.${e.clave}.palabra`),
    significado: t(`agenda.estado.${e.clave}.significado`),
  };
}

// Los turnos que pidió un cliente por el link y todavía no miró nadie.
//
// Un turno que entró por el mostrador ya lo vio alguien: hubo una llamada o
// una persona enfrente. Uno que entró por el link puede haber caído un
// domingo a la noche, y del lado del negocio nadie se enteró. Mientras siga
// "agendado" es un turno que nadie confirmó.
//
// Sólo los que todavía no pasaron: por uno de la semana pasada ya no hay
// nada que hacer, y avisar por él sería ruido que nunca se apaga.
export function turnosSinVer(turnos = [], { ahora = Date.now() } = {}) {
  return turnos.filter(
    (t) =>
      t.origen === "cliente" &&
      t.estado === "agendado" &&
      new Date(t.empieza_en).getTime() >= ahora
  );
}

// Lo que llega del alta de un turno, con los nombres del contrato de la API
// (POST /v1/turnos). Quién viene: un cliente que ya está (cliente_id), uno
// nuevo que se da de alta con el turno (cliente), o nadie. La hora del
// formulario es hora local ("2026-10-05T10:00"); a la API va como instante.
export const instanteParaLaApi = (horaLocal) => new Date(horaLocal).toISOString();

export function turnoParaLaApi({ clienteId, nombreCliente, telefono, motivo, empiezaEn }) {
  const nuevo = !clienteId && nombreCliente?.trim()
    ? { nombre: nombreCliente.trim(), telefono: telefono?.trim() || null }
    : null;
  return {
    empieza_en: instanteParaLaApi(empiezaEn),
    motivo,
    cliente_id: clienteId || null,
    cliente: nuevo,
  };
}

// Un turno está en pie mientras no se canceló ni se atendió: son los que
// todavía esperan algo de alguien.
export const turnoEnPie = (turno) =>
  turno.estado !== "cancelado" && turno.estado !== "atendido";
