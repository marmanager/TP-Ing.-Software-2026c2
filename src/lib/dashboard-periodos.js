import { textoPeriodo } from "./dashboard.js";
import { tCastellano } from "./idioma.js";

const DIA = 86_400_000;
const fechaISO = (instante) => new Date(instante).toISOString().slice(0, 10);
// Un par de formatos por locale, armados la primera vez que se piden.
const formatos = {};
const formatosDe = (locale) => formatos[locale] ??= {
  corta: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }),
  mes: new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" }),
};

// Semanas desde el lunes. Los extremos se recortan al período seleccionado.
export function intervalosDashboard(periodo, agrupacion, locale = "es-AR", t = tCastellano) {
  const { corta, mes } = formatosDe(locale);
  const inicio = Date.parse(`${periodo.desde}T00:00:00Z`);
  const fin = Date.parse(`${periodo.hasta}T00:00:00Z`);
  const puntos = [];
  for (let cursor = inicio; cursor <= fin;) {
    const siguiente = new Date(cursor);
    if (agrupacion === "día") siguiente.setUTCDate(siguiente.getUTCDate() + 1);
    else if (agrupacion === "semana") siguiente.setUTCDate(siguiente.getUTCDate() + 7 - (siguiente.getUTCDay() + 6) % 7);
    else if (agrupacion === "mes") { siguiente.setUTCDate(1); siguiente.setUTCMonth(siguiente.getUTCMonth() + 1); }
    else { siguiente.setUTCMonth(0, 1); siguiente.setUTCFullYear(siguiente.getUTCFullYear() + 1); }
    const desde = fechaISO(cursor);
    const hasta = fechaISO(Math.min(fin, siguiente.getTime() - DIA));
    puntos.push({
      desde, hasta,
      etiqueta: agrupacion === "año" ? desde.slice(0, 4) : agrupacion === "mes" ? mes.format(new Date(cursor)) : corta.format(new Date(cursor)),
      detalle: textoPeriodo({ desde, hasta }, locale, t),
    });
    cursor = siguiente.getTime();
  }
  return puntos;
}
