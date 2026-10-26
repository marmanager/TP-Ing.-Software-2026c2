// El idioma de la app (docs/idiomas.md): castellano o inglés según quien la
// mira. Decide la cookie "idioma" si la persona eligió en el selector; si no,
// el idioma del navegador; si no, castellano.
//
// Sin JSX a propósito: los tests lo importan directo (jest no transforma).
// El contexto de React vive en useIdioma.js.

import es from "./idiomas/es.js";

export const IDIOMAS = ["es", "en"];

// La moneda y la zona horaria no cambian con el idioma: el negocio está en
// Argentina aunque quien mira lea en inglés.
export const LOCALES = { es: "es-AR", en: "en-US" };

// Cada idioma se nombra en su idioma: quien no lee castellano no busca "Inglés".
export const NOMBRES_IDIOMA = { es: "Castellano", en: "English" };

// "en-GB,en;q=0.9,es;q=0.5" → el primero conocido de mayor peso. La región no
// importa: en-GB y en-US son "en". q=0 quiere decir "éste no".
export function elegirIdioma(cookie, acceptLanguage) {
  if (IDIOMAS.includes(cookie)) return cookie;
  const pedidos = (acceptLanguage ?? "")
    .split(",")
    .map((parte) => {
      const [etiqueta, ...params] = parte.trim().toLowerCase().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { idioma: etiqueta.split("-")[0], q: q ? Number(q.slice(2)) : 1 };
    })
    .filter((p) => p.q > 0)
    .sort((a, b) => b.q - a.q);
  return pedidos.find((p) => IDIOMAS.includes(p.idioma))?.idioma ?? "es";
}

const buscar = (diccionario, clave) => clave.split(".").reduce((o, k) => o?.[k], diccionario);

// "base" es el castellano cuando se mira en inglés: lo que todavía no se
// tradujo se ve en castellano y no como una clave. En castellano es null.
//
// Un texto con plural es { one, other } y elige Intl.PluralRules con vars.n.
export function traducir({ diccionario, base, locale }, clave, vars = {}, siFalta = clave) {
  let texto = buscar(diccionario, clave) ?? buscar(base, clave);
  if (texto == null) return siFalta;
  if (typeof texto === "object") {
    texto = texto[new Intl.PluralRules(locale).select(vars.n ?? 1)] ?? texto.other;
  }
  return texto.replace(/\{(\w+)\}/g, (todo, k) => (k in vars ? String(vars[k]) : todo));
}

// Los errores se traducen por código (src/lib/api.js). Un código que la app
// todavía no conoce muestra el mensaje que vino, en el idioma en que vino.
// Un texto suelto (lo que todavía devuelven equipo.js y sedes.js) se muestra
// tal cual, así una pantalla que mezcla las dos formas no queda en blanco.
//
// El mensaje que la API escribió para una situación concreta (api.js lo marca
// "propio") gana en castellano: es más específico que la frase genérica del
// diccionario ("Su rol no incluye el permiso para esta acción." y no "No tenés
// permiso para hacer eso."). En otro idioma se traduce por código, porque la
// API sólo escribe en castellano.
export function textoDeError(t, error) {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (!error.codigo) return error.mensaje;
  const delDiccionario = t(`errores.${error.codigo}`, {}, error.mensaje);
  const enCastellano = delDiccionario === tCastellano(`errores.${error.codigo}`, {}, error.mensaje);
  return error.propio && enCastellano ? error.mensaje : delDiccionario;
}

export const cookieDeIdioma = (idioma) => `idioma=${idioma}; path=/; max-age=31536000; samesite=lax`;

// El `t` por defecto de las funciones de src/lib/ que devuelven texto para
// mostrar: sin `t` salen en castellano, que es lo que prueban los tests. Las
// pantallas pasan el suyo (useIdioma). No es un `t` global con idioma de
// pedido: este es siempre castellano, así que no mezcla nada en el servidor.
export const tCastellano = (clave, vars, siFalta) =>
  traducir({ diccionario: es, base: null, locale: LOCALES.es }, clave, vars, siFalta);
