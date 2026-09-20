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

export const ORDEN_ESTADOS_TURNO = ["agendado", "confirmado", "cancelado", "atendido"];

export const ESTADOS_TURNO = {
  agendado: {
    clave: "agendado",
    palabra: "Sin confirmar",
    icono: "reloj",
    texto: "text-tinta-media",
    significado: "Está anotado, pero la persona todavía no confirmó que viene.",
  },
  confirmado: {
    clave: "confirmado",
    palabra: "Confirmado",
    icono: "listo",
    texto: "text-completo",
    significado: "La persona dijo que viene.",
  },
  cancelado: {
    clave: "cancelado",
    palabra: "Cancelado",
    icono: "cruz",
    texto: "text-tinta-suave line-through",
    significado: "No va a venir. Queda en la agenda para que se sepa que estaba.",
  },
  atendido: {
    clave: "atendido",
    palabra: "Ya vino",
    icono: "persona-check",
    texto: "text-tinta-suave",
    significado:
      "Vino y se la atendió. Si traía un trabajo, el turno queda apuntando al caso que salió de él.",
  },
};

export const estadoDeTurno = (estado) => ESTADOS_TURNO[estado] ?? ESTADOS_TURNO.agendado;

// Un turno está en pie mientras no se canceló ni se atendió: son los que
// todavía esperan algo de alguien.
export const turnoEnPie = (turno) =>
  turno.estado !== "cancelado" && turno.estado !== "atendido";
