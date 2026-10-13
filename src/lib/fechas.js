// Fechas en el idioma del mostrador: "Hoy 10:15", "Ayer 16:40",
// "2 de septiembre". Nunca marcas de tiempo técnicas (cartilla, sección 08).

// 24 horas: "15:00" y no "03:00 p. m.", que es como se escribe acá y además
// entra en una columna angosta sin partirse en dos líneas.
const hora = (d) =>
  new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);

const dia = (d) =>
  new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long" }).format(d);

const mismoDia = (a, b) => a.toDateString() === b.toDateString();

export function cuando(iso) {
  const d = new Date(iso);
  const ahora = new Date();
  const ayer = new Date(ahora);
  ayer.setDate(ahora.getDate() - 1);

  if (mismoDia(d, ahora)) return `Hoy ${hora(d)}`;
  if (mismoDia(d, ayer)) return `Ayer ${hora(d)}`;
  return dia(d);
}

export function haceCuanto(iso) {
  const dias = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (dias <= 0) return "Abierto hoy";
  if (dias === 1) return "Abierto ayer";
  return `Abierto hace ${dias} días`;
}

export const horaYMinutos = (iso) => hora(new Date(iso));

export function diaLargo(iso) {
  const d = new Date(iso);
  const ahora = new Date();
  if (mismoDia(d, ahora)) return "Hoy";
  const manana = new Date(ahora);
  manana.setDate(ahora.getDate() + 1);
  if (mismoDia(d, manana)) return "Mañana";
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

export const paraInput = (d = new Date()) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

// Para lo que ya pasó: "Hoy", "Ayer", o el día con su nombre. diaLargo() es
// para la agenda, que mira hacia adelante y dice "Mañana".
export function diaPasado(iso) {
  const d = new Date(iso);
  const ahora = new Date();
  if (mismoDia(d, ahora)) return "Hoy";
  const ayer = new Date(ahora);
  ayer.setDate(ahora.getDate() - 1);
  if (mismoDia(d, ayer)) return "Ayer";
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

// Un día pasado para meter en medio de una frase: "hoy", "ayer" o "el 2 de
// septiembre". Así se lee "Cliente desde hoy" y "Abierto el 2 de
// septiembre", sin la hora, que en esas frases sobra.
export function elDia(iso) {
  const d = new Date(iso);
  const ahora = new Date();
  if (mismoDia(d, ahora)) return "hoy";
  const ayer = new Date(ahora);
  ayer.setDate(ahora.getDate() - 1);
  if (mismoDia(d, ayer)) return "ayer";
  return `el ${dia(d)}`;
}

// Hace cuánto que pasó algo, para meter en medio de una frase: "hoy", "ayer"
// o "hace 12 días". haceCuanto() dice lo mismo pero ya armado para un caso
// ("Abierto hace 12 días").
export function cuantoHace(iso) {
  const dias = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  return `hace ${dias} días`;
}

// Cuántos días pasaron, para decidir si algo se está atrasando.
export const diasDesde = (iso) => Math.floor((Date.now() - new Date(iso)) / 86400000);

// ------------------------------------------------------------
// Días del calendario ("2026-10-13"), para cuándo le toca volver
// ------------------------------------------------------------
// Un día del calendario no es un instante: no se pasa por toISOString(),
// que lo corre a UTC y manda lo de las 22 h al día siguiente. El día es el
// de Argentina, el mismo que usa la API para decidir qué es "hoy".

const DIA_ARGENTINA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// El día de un instante de la API (abierto_en), o de ahora si no se pasa nada.
export const diaDeArgentina = (iso = Date.now()) => DIA_ARGENTINA.format(new Date(iso));

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// "2027-04-13" → "13 de abril de 2027". Con el string, sin Date: así no hay
// huso que corra el día.
export function diaEnPalabras(dia) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia ?? "");
  return m ? `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}` : "";
}
