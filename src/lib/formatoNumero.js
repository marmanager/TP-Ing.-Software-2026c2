// Un Intl.NumberFormat por locale y opciones, armado la primera vez que se
// pide: los gráficos del dashboard lo llaman por cada marca de cada eje.
const hechos = new Map();

export function formatoNumero(locale = "es-AR", opciones) {
  const clave = `${locale}|${JSON.stringify(opciones ?? null)}`;
  if (!hechos.has(clave)) hechos.set(clave, new Intl.NumberFormat(locale, opciones));
  return hechos.get(clave);
}
