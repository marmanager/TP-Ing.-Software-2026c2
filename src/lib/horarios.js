// Cuándo atiende el negocio, y qué huecos quedan libres.
//
// Es el corazón de que un cliente pueda pedir turno solo: de acá sale la
// lista de horarios que se le ofrecen. Todo lo que se decide acá se ve
// después en una pantalla pública que abre gente de afuera, así que no puede
// ofrecer un hueco que en realidad está ocupado ni uno que ya pasó.
//
// No tiene React ni Supabase adentro a propósito: lo corre `npm run
// test:unit` y lo va a poder usar igual el día que esto se calcule del lado
// de la API en vez del navegador.
//
// UNA COSA QUE NO HACE, Y HAY QUE SABERLO:
// Trabaja en la hora local de quien corre el código. Para un negocio
// argentino está bien —el navegador del taller y el del cliente están en el
// mismo huso, y acá no hay horario de verano— pero un negocio en otro huso
// necesitaría guardar el suyo. El día que pase, el lugar donde se arregla es
// este archivo y no las pantallas.

// Los días, en el orden en que los dice la gente: la semana arranca el lunes.
// getDay() de JavaScript arranca el domingo y devuelve 0, así que la
// traducción vive acá y no en cada pantalla.
export const DIAS = [
  { clave: "lun", nombre: "Lunes", corto: "Lun", diaJs: 1 },
  { clave: "mar", nombre: "Martes", corto: "Mar", diaJs: 2 },
  { clave: "mie", nombre: "Miércoles", corto: "Mié", diaJs: 3 },
  { clave: "jue", nombre: "Jueves", corto: "Jue", diaJs: 4 },
  { clave: "vie", nombre: "Viernes", corto: "Vie", diaJs: 5 },
  { clave: "sab", nombre: "Sábado", corto: "Sáb", diaJs: 6 },
  { clave: "dom", nombre: "Domingo", corto: "Dom", diaJs: 0 },
];

export const diaDe = (fecha) => DIAS.find((d) => d.diaJs === fecha.getDay()) ?? null;

// Cuánto dura cada turno. No es una predicción sobre el trabajo —eso no se
// sabe de antemano y por algo la migración 010 lo sacó— sino cada cuánto da
// turnos el negocio.
export const DURACIONES = [15, 30, 45, 60, 90];

// Con cuánta anticipación mínima se puede pedir. "Sin mínimo" deja pedir
// para dentro de un rato, que a un taller de barrio le sirve y a un
// consultorio no.
export const ANTICIPACIONES = [
  { horas: 0, palabra: "Sin mínimo" },
  { horas: 2, palabra: "2 horas antes" },
  { horas: 24, palabra: "Un día antes" },
  { horas: 48, palabra: "Dos días antes" },
];

// La configuración de fábrica: de lunes a viernes, de 9 a 18, cortando de 13
// a 16. Es el horario del taller de la cartilla, y sirve para que estrenar
// la pantalla no sea empezar de una hoja en blanco.
export const HORARIOS_DE_FABRICA = {
  dias: ["lun", "mar", "mie", "jue", "vie"],
  desde: "09:00",
  hasta: "18:00",
  corte: { desde: "13:00", hasta: "16:00" },
  minutos: 30,
  anticipacionHoras: 2,
};

// Lo que haya guardado puede ser viejo, estar incompleto o no estar. Esto
// devuelve siempre algo con el que se pueda trabajar, sin pisar lo que sí
// esté cargado.
export function normalizarHorarios(horarios) {
  if (!horarios || typeof horarios !== "object") return null;

  const dias = Array.isArray(horarios.dias)
    ? horarios.dias.filter((d) => DIAS.some((x) => x.clave === d))
    : [];

  return {
    dias,
    desde: enHora(horarios.desde) ?? "09:00",
    hasta: enHora(horarios.hasta) ?? "18:00",
    corte:
      horarios.corte && enHora(horarios.corte.desde) && enHora(horarios.corte.hasta)
        ? { desde: enHora(horarios.corte.desde), hasta: enHora(horarios.corte.hasta) }
        : null,
    minutos: DURACIONES.includes(Number(horarios.minutos)) ? Number(horarios.minutos) : 30,
    anticipacionHoras: Number.isFinite(Number(horarios.anticipacionHoras))
      ? Number(horarios.anticipacionHoras)
      : 2,
  };
}

// "9:5" no es una hora. "09:05" sí.
const enHora = (texto) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(texto ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
};

const enMinutos = (hora) => {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
};

// Qué le falta a la configuración para poder abrir la página de turnos.
// Devuelve la lista de problemas, en el orden de la pantalla, o vacío si
// está lista.
export function problemasDeHorarios(horarios) {
  const h = normalizarHorarios(horarios);
  if (!h) return ["Todavía no configuraste tus horarios."];

  const problemas = [];
  if (h.dias.length === 0) problemas.push("Elegí al menos un día.");

  const abre = enMinutos(h.desde);
  const cierra = enMinutos(h.hasta);
  const horarioAlReves = cierra <= abre;
  if (horarioAlReves) problemas.push("La hora de cierre tiene que ser posterior a la de apertura.");

  // Con el horario al revés, avisar además que el corte se cae afuera es
  // ruido: no hay adentro en el que pueda caer. Se arregla lo de arriba y
  // recién ahí tiene sentido mirar el corte.
  if (h.corte && !horarioAlReves) {
    const cd = enMinutos(h.corte.desde);
    const ch = enMinutos(h.corte.hasta);
    if (ch <= cd) problemas.push("El corte del mediodía termina antes de empezar.");
    else if (cd < abre || ch > cierra) problemas.push("El corte tiene que caer adentro del horario.");
  }

  // Sin esto la configuración es válida pero no produce un solo turno, y en
  // la pantalla pública se vería como "no hay horarios" sin que nadie
  // entienda por qué.
  if (problemas.length === 0 && tramosDelDia(h).length === 0) {
    problemas.push(`No entra ningún turno de ${h.minutos} minutos en ese horario.`);
  }

  return problemas;
}

export const horariosListos = (horarios) => problemasDeHorarios(horarios).length === 0;

// Los tramos en los que se atiende un día cualquiera: uno solo, o dos si hay
// corte al mediodía. En minutos desde la medianoche.
//
// Un tramo donde no entra ni un turno entero no es un tramo: si se atiende de
// 9 a 9:20 y los turnos son de media hora, ahí no hay nada que ofrecer.
export function tramosDelDia(horarios) {
  const h = normalizarHorarios(horarios);
  if (!h) return [];

  const abre = enMinutos(h.desde);
  const cierra = enMinutos(h.hasta);
  if (cierra <= abre) return [];

  const tramos = h.corte
    ? [
        [abre, Math.min(enMinutos(h.corte.desde), cierra)],
        [Math.max(enMinutos(h.corte.hasta), abre), cierra],
      ]
    : [[abre, cierra]];

  return tramos.filter(([a, b]) => b - a >= h.minutos);
}

// Los horarios en los que ese día se puede dar turno, como fechas de verdad.
// Todavía sin mirar quién está ocupado ni si ya pasaron.
export function huecosDelDia(fecha, horarios) {
  const h = normalizarHorarios(horarios);
  if (!h) return [];

  const dia = diaDe(fecha);
  if (!dia || !h.dias.includes(dia.clave)) return [];

  const huecos = [];
  for (const [arranca, termina] of tramosDelDia(h)) {
    for (let m = arranca; m + h.minutos <= termina; m += h.minutos) {
      const cuando = new Date(fecha);
      cuando.setHours(0, 0, 0, 0);
      cuando.setMinutes(m);
      huecos.push(cuando);
    }
  }
  return huecos;
}

// Si dos turnos se pisan. Dos turnos que empiezan a la misma hora se pisan
// siempre, y uno que empieza antes se pisa si todavía no terminó.
const sePisan = (unoEmpieza, unoDura, otroEmpieza, otroDura) =>
  unoEmpieza < otroEmpieza + otroDura * 60000 &&
  otroEmpieza < unoEmpieza + unoDura * 60000;

// Los huecos que se le pueden ofrecer a alguien, día por día.
//
// Quedan afuera tres clases de hueco, y las tres importan:
//
//   Los que ya pasaron, y los que están más cerca que la anticipación que
//   pidió el negocio. Ofrecer un turno para dentro de diez minutos es
//   prometer algo que nadie va a poder atender.
//
//   Los ocupados. Un turno cancelado NO ocupa: queda en la agenda para que
//   se sepa que estaba, pero su lugar vuelve a estar libre.
//
//   Los que se pisan con un turno que ya existe aunque no arranquen a la
//   misma hora: el mostrador puede haber cargado uno a las 10:15 a mano.
export function huecosLibres({
  horarios,
  turnos = [],
  desde = new Date(),
  dias = 14,
  ahora = new Date(),
} = {}) {
  const h = normalizarHorarios(horarios);
  if (!h || !horariosListos(h)) return [];

  const noAntesDe = ahora.getTime() + h.anticipacionHoras * 3600000;

  const ocupados = turnos
    .filter((t) => t.estado !== "cancelado")
    .map((t) => ({
      empieza: new Date(t.empieza_en).getTime(),
      // Un turno viejo, de cuando esto no existía, ocupa su hueco y nada
      // más: no se le inventa una duración hacia atrás.
      dura: Number(t.minutos_reservados) > 0 ? Number(t.minutos_reservados) : h.minutos,
    }));

  const porDia = [];
  const cursor = new Date(desde);
  cursor.setHours(0, 0, 0, 0);

  for (let i = 0; i < dias; i++) {
    const fecha = new Date(cursor);
    fecha.setDate(cursor.getDate() + i);

    const libres = huecosDelDia(fecha, h).filter((hueco) => {
      if (hueco.getTime() < noAntesDe) return false;
      return !ocupados.some((o) => sePisan(hueco.getTime(), h.minutos, o.empieza, o.dura));
    });

    if (libres.length > 0) porDia.push({ fecha, huecos: libres });
  }

  return porDia;
}

// Si ese horario exacto sigue libre. Lo usa la reserva antes de escribir:
// entre que el cliente vio la lista y tocó el botón pudo haber pasado
// cualquier cosa, incluida otra persona reservando lo mismo.
export function huecoSigueLibre({ cuando, horarios, turnos = [], ahora = new Date() } = {}) {
  const h = normalizarHorarios(horarios);
  if (!h || !horariosListos(h)) return false;

  const momento = new Date(cuando);
  if (Number.isNaN(momento.getTime())) return false;
  if (momento.getTime() < ahora.getTime() + h.anticipacionHoras * 3600000) return false;

  // Tiene que ser uno de los huecos que el negocio ofrece, no una hora
  // cualquiera: si no, alguien podría reservar a las 3 de la mañana mandando
  // el dato a mano.
  const delDia = huecosDelDia(momento, h);
  if (!delDia.some((x) => x.getTime() === momento.getTime())) return false;

  return !turnos
    .filter((t) => t.estado !== "cancelado")
    .some((t) =>
      sePisan(
        momento.getTime(),
        h.minutos,
        new Date(t.empieza_en).getTime(),
        Number(t.minutos_reservados) > 0 ? Number(t.minutos_reservados) : h.minutos
      )
    );
}
