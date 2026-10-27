// La apariencia de la app: tema, letra, color de la letra, bordes y color de
// los botones. Se elige en Mi perfil, sección "Tema".
//
// Vive en el navegador (localStorage) y no en la cuenta: es cómo se ve este
// aparato, y el mismo usuario puede querer el celular oscuro y la compu clara.
//
// Cada elección es un atributo en <html> (data-tema, data-letra, data-tinta,
// data-redondeo, data-acento) y CSS_APARIENCIA redefine los tokens de la
// cartilla según el atributo. Lo de fábrica no pone atributo: se ve como
// manda globals.css, y nadie que ya usaba la app la ve cambiar sola.
//
// Los colores son muestras fijas y no un selector libre: cada una tiene su
// versión para fondo claro y para fondo oscuro, con contraste medido.
//
// `palabra` es el nombre en castellano y queda como dato. Lo que se ve en
// pantalla se traduce por la `clave` de cada opción (cuenta.tema.<grupo>.
// <clave>, ver Tema.js); las letras de marca —Inter, Merriweather, JetBrains
// Mono— no se traducen y se muestran con su `palabra`.

export const TEMAS = [
  { clave: "claro", palabra: "Claro", fondo: "#fbf8f4", tarjeta: "#ffffff", tinta: "#241f1b" },
  { clave: "oscuro", palabra: "Oscuro", fondo: "#171412", tarjeta: "#1e1a17", tinta: "#f2ece4" },
  { clave: "sistema", palabra: "Tema del sistema" },
];

// "variable" es la de next/font en src/app/layout.js.
export const LETRAS = [
  { clave: "clasica", palabra: "Clásica", familia: "var(--fuente-cuerpo)" },
  { clave: "inter", palabra: "Inter", familia: "var(--fuente-inter)" },
  { clave: "serif", palabra: "Merriweather", familia: "var(--fuente-serif)" },
  { clave: "mono", palabra: "JetBrains Mono", familia: "var(--fuente-mono)" },
];

// El color del texto principal. "claro" va sobre fondo claro; "oscuro", sobre
// fondo oscuro. Todos pasan 4,5:1 contra su fondo.
export const TINTAS = [
  { clave: "calida", palabra: "Cálida", claro: "#241f1b", oscuro: "#f2ece4" },
  { clave: "grafito", palabra: "Grafito", claro: "#1f2328", oscuro: "#e6e8eb" },
  { clave: "noche", palabra: "Azul noche", claro: "#1b2a41", oscuro: "#dbe6f5" },
  { clave: "sepia", palabra: "Sepia", claro: "#4a3222", oscuro: "#ecd9c6" },
  { clave: "bosque", palabra: "Bosque", claro: "#1c3326", oscuro: "#d6eedf" },
];

export const REDONDEOS = [
  { clave: "rectos", palabra: "Rectos", campo: 4, tarjeta: 6 },
  { clave: "suaves", palabra: "Suaves", campo: 12, tarjeta: 16 },
  { clave: "redondos", palabra: "Redondos", campo: 20, tarjeta: 28 },
];

// El color de los botones: es el "azul" de la cartilla, el de todo lo
// accionable (botón principal, enlaces, foco). "solido" lleva texto blanco
// encima; "texto" es el mismo color aclarado para leerse sobre fondo oscuro.
export const ACENTOS = [
  { clave: "azul", palabra: "Azul", solido: "#1f4e8c", apretado: "#163c6e", claro: "#e8eff7", texto: "#8cb4ec", textoApretado: "#b3cdf2", claroOscuro: "#1f2c3f" },
  { clave: "verde", palabra: "Verde", solido: "#1d6b3f", apretado: "#14522f", claro: "#e3f2e8", texto: "#7fcf9f", textoApretado: "#a9e0be", claroOscuro: "#183324" },
  { clave: "turquesa", palabra: "Turquesa", solido: "#0e6a73", apretado: "#0a5259", claro: "#e0f2f3", texto: "#6fcfd8", textoApretado: "#9fe0e6", claroOscuro: "#14313a" },
  { clave: "violeta", palabra: "Violeta", solido: "#5b3e8f", apretado: "#452e6e", claro: "#efe8f8", texto: "#c3a8ec", textoApretado: "#d8c6f4", claroOscuro: "#2e2540" },
  { clave: "rosa", palabra: "Rosa", solido: "#a3245e", apretado: "#801c4a", claro: "#f9e6ef", texto: "#ee8ab5", textoApretado: "#f4b0cd", claroOscuro: "#3a1a29" },
  { clave: "terracota", palabra: "Terracota", solido: "#9a3d1e", apretado: "#7a2f16", claro: "#f8e9e2", texto: "#e08a68", textoApretado: "#eeac91", claroOscuro: "#3a2219" },
  { clave: "grafito", palabra: "Grafito", solido: "#3f4b57", apretado: "#2d3741", claro: "#e7eaee", texto: "#b9c3cd", textoApretado: "#d3dae1", claroOscuro: "#2a3038" },
];

// Cajas y rebordes: el interior y el borde de las tarjetas. Cada uno va de
// fábrica, de un color o de dos en degradé. Son tonos medios para que el
// reborde se vea sobre fondo claro y oscuro; el interior los usa traslúcidos
// (MEZCLA_CAJA) encima del color de tarjeta, así el texto sigue legible.
export const COLORES_CAJA = [
  { clave: "azul", palabra: "Azul", color: "#3b6fc4" },
  { clave: "verde", palabra: "Verde", color: "#2f9e5f" },
  { clave: "turquesa", palabra: "Turquesa", color: "#1a9aa6" },
  { clave: "violeta", palabra: "Violeta", color: "#7c5cc4" },
  { clave: "rosa", palabra: "Rosa", color: "#d0457f" },
  { clave: "terracota", palabra: "Terracota", color: "#c8643c" },
  { clave: "ambar", palabra: "Ámbar", color: "#d99a1e" },
  { clave: "grafito", palabra: "Grafito", color: "#6b7785" },
];

export const MODOS_CAJA = [
  { clave: "fabrica", palabra: "De fábrica" },
  { clave: "base", palabra: "Un color" },
  { clave: "degrade", palabra: "Dos colores" },
];

export const PATRONES = [
  { clave: "horizontal", palabra: "Horizontal" },
  { clave: "vertical", palabra: "Vertical" },
  { clave: "diagonal", palabra: "Diagonal" },
  { clave: "radial", palabra: "Radial" },
];

export const MEZCLA_CAJA = "14%";

const CAJA_DE_FABRICA = { modo: "fabrica", c1: "azul", c2: "violeta", patron: "diagonal" };

export const DE_FABRICA = {
  tema: "claro",
  letra: "clasica",
  tinta: "calida",
  redondeo: "suaves",
  acento: "azul",
  caja: CAJA_DE_FABRICA,
  reborde: CAJA_DE_FABRICA,
};

const OPCIONES = { tema: TEMAS, letra: LETRAS, tinta: TINTAS, redondeo: REDONDEOS, acento: ACENTOS };
const OPCIONES_CAJA = { modo: MODOS_CAJA, c1: COLORES_CAJA, c2: COLORES_CAJA, patron: PATRONES };
const MAPA_COLORES = Object.fromEntries(COLORES_CAJA.map((c) => [c.clave, c.color]));

// El dibujo de un degradé (o de un color, con c1 y c2 iguales). Con "alfa",
// los colores van traslúcidos. Es una función suelta, sin nada de afuera,
// porque también se escribe tal cual en el script del <head>.
function degrade(c, colores, alfa) {
  var x = colores[c.c1];
  var y = c.modo === "degrade" ? colores[c.c2] : x;
  if (alfa) {
    x = "color-mix(in srgb, " + x + " " + alfa + ", transparent)";
    y = "color-mix(in srgb, " + y + " " + alfa + ", transparent)";
  }
  if (c.patron === "radial") return "radial-gradient(circle at top left, " + x + ", " + y + ")";
  var dir = c.patron === "horizontal" ? "to right" : c.patron === "vertical" ? "to bottom" : "135deg";
  return "linear-gradient(" + dir + ", " + x + ", " + y + ")";
}

// Pone en <html> el fondo de las tarjetas (--caja) y data-cajas, que la
// regla de CSS_APARIENCIA lee. Suelta por lo mismo que degrade().
function pintarCajas(raiz, a, colores, degrade, alfa) {
  function vale(c) {
    return !!c && (c.modo === "base" || c.modo === "degrade") && !!colores[c.c1] && (c.modo === "base" || !!colores[c.c2]);
  }
  var cj = vale(a.caja) ? a.caja : null;
  var rb = vale(a.reborde) ? a.reborde : null;
  if (!cj && !rb) {
    raiz.removeAttribute("data-cajas");
    raiz.style.removeProperty("--caja");
    return;
  }
  var lleno = "linear-gradient(var(--color-tarjeta), var(--color-tarjeta)) padding-box";
  var borde = rb ? degrade(rb, colores) : "linear-gradient(var(--color-borde), var(--color-borde))";
  raiz.setAttribute("data-cajas", rb ? "reborde" : "caja");
  raiz.style.setProperty("--caja", (cj ? degrade(cj, colores, alfa) + " padding-box, " : "") + lleno + ", " + borde + " border-box");
}

export const pintar = (ap, raiz = document.documentElement) => pintarCajas(raiz, ap, MAPA_COLORES, degrade, MEZCLA_CAJA);

// Para las muestras de la pantalla: el mismo dibujo que va a tener la caja.
export const dibujo = (c, alfa) => degrade(c, MAPA_COLORES, alfa);
const LLAVE = "apariencia";
const OSCURO = "(prefers-color-scheme: dark)";

export const opcion = (campo, clave) => OPCIONES[campo].find((o) => o.clave === clave);

// Lo guardado, campo por campo: lo que falte o no exista más queda de fábrica.
export function limpiar(guardado) {
  const ap = { ...DE_FABRICA };
  for (const campo of Object.keys(OPCIONES)) {
    if (guardado && opcion(campo, guardado[campo])) ap[campo] = guardado[campo];
  }
  for (const campo of ["caja", "reborde"]) {
    const c = { ...CAJA_DE_FABRICA };
    for (const parte of Object.keys(OPCIONES_CAJA)) {
      const valor = guardado?.[campo]?.[parte];
      if (OPCIONES_CAJA[parte].some((o) => o.clave === valor)) c[parte] = valor;
    }
    ap[campo] = c;
  }
  return ap;
}

export function leerApariencia() {
  try {
    return limpiar(JSON.parse(localStorage.getItem(LLAVE)));
  } catch {
    return { ...DE_FABRICA };
  }
}

export function guardarApariencia(ap) {
  try {
    localStorage.setItem(LLAVE, JSON.stringify(ap));
  } catch {}
  aplicarApariencia(ap);
}

export const esOscuro = (tema) => tema === "oscuro" || (tema === "sistema" && matchMedia(OSCURO).matches);

export function aplicarApariencia(ap = leerApariencia()) {
  const raiz = document.documentElement;
  if (esOscuro(ap.tema)) raiz.setAttribute("data-tema", "oscuro");
  else raiz.removeAttribute("data-tema");
  for (const campo of ["letra", "tinta", "redondeo", "acento"]) {
    if (ap[campo] !== DE_FABRICA[campo]) raiz.setAttribute(`data-${campo}`, ap[campo]);
    else raiz.removeAttribute(`data-${campo}`);
  }
  pintar(ap, raiz);
}

// Si eligió "del sistema" y el sistema cambia con la app abierta, la sigue.
export function seguirAlSistema() {
  const mq = matchMedia(OSCURO);
  const alCambiar = () => {
    const ap = leerApariencia();
    if (ap.tema === "sistema") aplicarApariencia(ap);
  };
  mq.addEventListener("change", alCambiar);
  return () => mq.removeEventListener("change", alCambiar);
}

// Lo mismo que aplicarApariencia(leerApariencia()), para correr en el <head>
// antes de que se pinte la pantalla: sin esto, quien eligió oscuro vería un
// destello claro en cada carga. Confía en lo guardado: un valor que no existe
// pone un atributo que ninguna regla de CSS lee, y se ve lo de fábrica.
export const SCRIPT_APARIENCIA = `(function(){try{var a=JSON.parse(localStorage.getItem("${LLAVE}"))||{},r=document.documentElement;if(a.tema==="oscuro"||(a.tema==="sistema"&&matchMedia("${OSCURO}").matches))r.setAttribute("data-tema","oscuro");["letra","tinta","redondeo","acento"].forEach(function(c){if(typeof a[c]==="string")r.setAttribute("data-"+c,a[c])});(${pintarCajas})(r,a,${JSON.stringify(MAPA_COLORES)},${degrade},"${MEZCLA_CAJA}")}catch(e){}})()`;

// Las reglas de cada opción, armadas desde las listas de arriba para no
// escribir dos veces los mismos colores. Va en un <style> del <head>.
function armarCss() {
  const r = [];
  const raiz = (campo, clave) => `:root[data-${campo}="${clave}"]`;
  const oscuro = ':root[data-tema="oscuro"]';

  for (const l of LETRAS.slice(1)) {
    const familia = `${l.familia}, ${l.clave === "serif" ? "Georgia, serif" : l.clave === "mono" ? "monospace" : "system-ui, sans-serif"}`;
    r.push(`${raiz("letra", l.clave)}{--font-cuerpo:${familia};--font-titulo:${familia}}`);
  }
  for (const t of TINTAS) {
    r.push(`${raiz("tinta", t.clave)}{--color-tinta:${t.claro}}`);
    r.push(`${oscuro}${raiz("tinta", t.clave).slice(5)}{--color-tinta:${t.oscuro}}`);
  }
  for (const b of REDONDEOS) {
    r.push(`${raiz("redondeo", b.clave)}{--radius-campo:${b.campo}px;--radius-tarjeta:${b.tarjeta}px}`);
  }
  for (const a of ACENTOS.slice(1)) {
    const sel = raiz("acento", a.clave);
    const selOscuro = `${oscuro}${sel.slice(5)}`;
    r.push(`${sel}{--color-azul:${a.solido};--color-azul-apretado:${a.apretado};--color-azul-claro:${a.claro}}`);
    r.push(`${selOscuro}{--color-azul:${a.texto};--color-azul-apretado:${a.textoApretado};--color-azul-claro:${a.claroOscuro}}`);
    // Ver globals.css: donde el color es fondo lleno vuelve el sólido.
    r.push(`${selOscuro} .bg-azul{--color-azul:${a.solido}}`);
    r.push(`${selOscuro} .hover\\:bg-azul-apretado{--color-azul-apretado:${a.apretado}}`);
  }
  // Cajas y rebordes: sólo las tarjetas (redondeo de tarjeta y fondo de
  // tarjeta), no los botones. El borde es un fondo recortado al border-box
  // detrás del interior: así un borde también puede ser degradé.
  const tarjeta = ".rounded-tarjeta.bg-tarjeta:not(button)";
  r.push(`:root[data-cajas] ${tarjeta}{background:var(--caja);border-color:transparent}`);
  r.push(`:root[data-cajas="reborde"] ${tarjeta}{border-width:2px}`);
  return r.join("\n");
}

export const CSS_APARIENCIA = armarCss();
