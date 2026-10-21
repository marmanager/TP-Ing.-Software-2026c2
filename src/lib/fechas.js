// Fechas en el idioma del mostrador: "Hoy 10:15", "Ayer 16:40",
// "2 de septiembre". Nunca marcas de tiempo técnicas (cartilla, sección 08).

import { tCastellano } from "./idioma.js";

// 24 horas: "15:00" y no "03:00 p. m.", que es como se escribe acá y además
// entra en una columna angosta sin partirse en dos líneas. También en inglés
// (en-US diría "3:00 PM"): h23 y no hour12:false, que a medianoche da "24:05".
//
// Lo que formatea recibe el locale de quien mira (src/lib/idioma.js) como
// último parámetro; sin él sale en castellano, como siempre.
const hora = (d, locale = "es-AR") =>
  new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);

const dia = (d, locale = "es-AR") =>
  new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(d);

const mismoDia = (a, b) => a.toDateString() === b.toDateString();

// Las palabras ("Hoy", "Ayer", "hace 3 días") salen del diccionario
// (fechas.*) con el `t` de quien mira, que va después del locale.
export function cuando(iso, locale = "es-AR", t = tCastellano) {
  const d = new Date(iso);
  const ahora = new Date();
  const ayer = new Date(ahora);
  ayer.setDate(ahora.getDate() - 1);

  if (mismoDia(d, ahora)) return t("fechas.hoyHora", { hora: hora(d, locale) });
  if (mismoDia(d, ayer)) return t("fechas.ayerHora", { hora: hora(d, locale) });
  return dia(d, locale);
}

export function haceCuanto(iso, t = tCastellano) {
  const dias = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (dias <= 0) return t("fechas.abiertoHoy");
  if (dias === 1) return t("fechas.abiertoAyer");
  return t("fechas.abiertoHace", { n: dias });
}

export const horaYMinutos = (iso, locale = "es-AR") => hora(new Date(iso), locale);

export function diaLargo(iso, locale = "es-AR") {
  const d = new Date(iso);
  const ahora = new Date();
  if (mismoDia(d, ahora)) return "Hoy";
  const manana = new Date(ahora);
  manana.setDate(ahora.getDate() + 1);
  if (mismoDia(d, manana)) return "Mañana";
  return new Intl.DateTimeFormat(locale, {
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
export function diaPasado(iso, locale = "es-AR", t = tCastellano) {
  const d = new Date(iso);
  const ahora = new Date();
  if (mismoDia(d, ahora)) return t("fechas.hoy");
  const ayer = new Date(ahora);
  ayer.setDate(ahora.getDate() - 1);
  if (mismoDia(d, ayer)) return t("fechas.ayer");
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

// Un día pasado para meter en medio de una frase: "hoy", "ayer" o "el 2 de
// septiembre". Así se lee "Cliente desde hoy" y "Abierto el 2 de
// septiembre", sin la hora, que en esas frases sobra.
export function elDia(iso, locale = "es-AR") {
  const d = new Date(iso);
  const ahora = new Date();
  if (mismoDia(d, ahora)) return "hoy";
  const ayer = new Date(ahora);
  ayer.setDate(ahora.getDate() - 1);
  if (mismoDia(d, ayer)) return "ayer";
  return `el ${dia(d, locale)}`;
}

// Hace cuánto que pasó algo, para meter en medio de una frase: "hoy", "ayer"
// o "hace 12 días". haceCuanto() dice lo mismo pero ya armado para un caso
// ("Abierto hace 12 días").
export function cuantoHace(iso, t = tCastellano) {
  const dias = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (dias <= 0) return t("fechas.hoyEnFrase");
  if (dias === 1) return t("fechas.ayerEnFrase");
  return t("fechas.haceDias", { n: dias });
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

// "2027-04-13" → "13 de abril de 2027". Con el string, sin Date local: se
// arma el instante a mediodía UTC y se formatea en UTC, así no hay huso que
// corra el día.
export function diaEnPalabras(dia, locale = "es-AR") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia ?? "")) return "";
  const fecha = new Date(`${dia}T12:00:00Z`);
  // 2027-13-45 pasa la forma pero no es un día: Intl se queja, acá se calla.
  if (Number.isNaN(fecha.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(fecha);
}
