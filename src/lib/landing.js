// La landing de cada negocio (docs/landing-por-negocio.md): qué secciones
// tiene, cómo viene de fábrica, qué colores se leen y cómo se pinta.
//
// Lógica pura, sin React: la usan el editor (/negocio/landing), la vista
// previa y la página pública (/n/[codigo]). Pruebas: pruebas/landing.test.js.
//
// Las claves de SECCIONES y FUENTES están también en la API
// (src/modulos/negocio/esquemas.ts), que no deja guardar otras. Si se suma
// una, se suma en los dos lados.

import { LISTA_MODULOS, estaPrendido, traducirModulo } from "./modulos.js";
import { tCastellano } from "./idioma.js";
import { ACENTOS } from "./tema.js";

// El modelo fijo: el negocio no crea ni borra secciones, sólo las ordena.
// "modulo" es el módulo sin el cual la sección no tiene sentido: sin Agenda
// no hay turnos que sacar ni que mostrar.
export const SECCIONES = [
  {
    clave: "negocio",
    nombre: "El negocio",
    queMuestra: "Tu nombre, tu teléfono, tus horarios y un botón para escribirte por WhatsApp.",
    modulo: null,
  },
  {
    clave: "sacar_turno",
    nombre: "Sacar turno",
    queMuestra: "Los días y horarios que te quedan libres, para que el cliente se anote solo.",
    modulo: "agenda",
  },
  {
    clave: "mis_casos",
    nombre: "Mis casos",
    queMuestra: "Los casos abiertos del cliente, con cómo viene cada uno.",
    modulo: null,
  },
  {
    clave: "mis_turnos",
    nombre: "Mis turnos",
    queMuestra: "Los próximos turnos que sacó el cliente.",
    modulo: "agenda",
  },
];

// Los textos fijos de la landing (etiquetas de sección, colores, tipografías)
// son de fábrica: salen del diccionario por la clave (landing.secciones.*,
// landing.partes.*, landing.fuentes.*), y sin t en castellano. Lo que el
// negocio escribió (nombre, descripción, teléfono) no pasa por acá.
export const traducirSeccion = (s, t = tCastellano) => ({
  ...s,
  nombre: t(`landing.secciones.${s.clave}.nombre`, {}, s.nombre),
  queMuestra: t(`landing.secciones.${s.clave}.queMuestra`, {}, s.queMuestra),
});

export const traducirParte = (p, t = tCastellano) => ({
  ...p,
  nombre: t(`landing.partes.${p.clave}.nombre`, {}, p.nombre),
  ayuda: t(`landing.partes.${p.clave}.ayuda`, {}, p.ayuda),
});

export const nombreDeFuente = (f, t = tCastellano) => t(`landing.fuentes.${f.clave}`, {}, f.nombre);

// Los cuatro colores que elige el negocio, cada uno con el de su texto.
export const PARTES = [
  { clave: "fondo", nombre: "Fondo", ayuda: "El color de toda la página." },
  { clave: "cajas", nombre: "Cajas", ayuda: "Donde va cada sección y cada dato." },
  { clave: "botones", nombre: "Botones", ayuda: "Lo que se toca: botones y links." },
  { clave: "acento", nombre: "Acento", ayuda: "Las marcas que llaman la atención, como el estado de un caso." },
];

// Los colores que se pueden elegir en cada parte, como en el Tema de Mi perfil:
// muestras fijas, sin selector libre. El texto de cada una sale solo
// (textoRecomendado), así que cualquiera se lee. Los botones y el acento usan
// los mismos colores sólidos que el Tema. La de fábrica está en cada lista.
// El nombre se traduce por la clave (landing.paleta.<clave>).
const MUESTRAS_FONDO = [
  { clave: "crema", palabra: "Crema", color: "#fbf8f4" },
  { clave: "blanco", palabra: "Blanco", color: "#ffffff" },
  { clave: "gris", palabra: "Gris claro", color: "#eef1f4" },
  { clave: "celeste", palabra: "Celeste", color: "#e8eff7" },
  { clave: "menta", palabra: "Menta", color: "#e3f2e8" },
  { clave: "rubor", palabra: "Rubor", color: "#f9e6ef" },
  { clave: "noche", palabra: "Azul noche", color: "#1b2a41" },
  { clave: "carbon", palabra: "Carbón", color: "#171412" },
];
const MUESTRAS_CAJAS = [
  { clave: "blanco", palabra: "Blanco", color: "#ffffff" },
  { clave: "marfil", palabra: "Marfil", color: "#fffaf3" },
  { clave: "bruma", palabra: "Bruma", color: "#f1f6fb" },
  { clave: "menta", palabra: "Menta", color: "#eef7f1" },
  { clave: "carbon", palabra: "Carbón", color: "#1e1a17" },
];
const MUESTRAS_ACENTOS = ACENTOS.map(({ clave, palabra, solido }) => ({ clave, palabra, color: solido }));

export const PALETAS = {
  fondo: MUESTRAS_FONDO,
  cajas: MUESTRAS_CAJAS,
  botones: MUESTRAS_ACENTOS,
  acento: MUESTRAS_ACENTOS,
};

export const nombreDeMuestra = (m, t = tCastellano) => t(`landing.paleta.${m.clave}`, {}, m.palabra);

// "fabrica" es la de la app: Figtree en los títulos y Source Sans 3 en el
// texto. Las otras van en toda la página (src/componentes/landing/fuentes.js).
export const FUENTES = [
  { clave: "fabrica", nombre: "La de la app" },
  { clave: "nunito", nombre: "Nunito" },
  { clave: "montserrat", nombre: "Montserrat" },
  { clave: "lora", nombre: "Lora" },
  { clave: "merriweather", nombre: "Merriweather" },
];

// La tinta de la app y el blanco: entre los dos sale el texto recomendado.
export const TINTA = "#241f1b";
export const BLANCO = "#ffffff";

// WCAG 2.1 AA para texto normal.
export const CONTRASTE_MINIMO = 4.5;

// Los colores y las fuentes de la app (globals.css). En cada parte, el texto
// es el recomendado (hay una prueba que lo cuida).
export const PRESET = {
  orden: SECCIONES.map((s) => s.clave),
  colores: {
    fondo: { color: "#fbf8f4", texto: TINTA },
    cajas: { color: "#ffffff", texto: TINTA },
    botones: { color: "#1f4e8c", texto: BLANCO },
    acento: { color: "#9a3d1e", texto: BLANCO },
  },
  fuente: "fabrica",
};

const esColor = (x) => typeof x === "string" && /^#[0-9a-f]{6}$/i.test(x);

// Lo guardado, completado con la de fábrica donde falte o no se entienda.
// Un valor viejo no rompe nada: el orden suma al final las secciones que se
// agregaron después y saca las que ya no existen.
export function normalizarLanding(guardada) {
  const g = guardada && typeof guardada === "object" ? guardada : {};
  const claves = SECCIONES.map((s) => s.clave);
  const propias = Array.isArray(g.orden)
    ? g.orden.filter((c, i, o) => claves.includes(c) && o.indexOf(c) === i)
    : [];

  const colores = Object.fromEntries(
    PARTES.map(({ clave }) => {
      const parte = g.colores?.[clave] ?? {};
      const fabrica = PRESET.colores[clave];
      return [
        clave,
        {
          color: esColor(parte.color) ? parte.color.toLowerCase() : fabrica.color,
          texto: esColor(parte.texto) ? parte.texto.toLowerCase() : fabrica.texto,
        },
      ];
    })
  );

  return {
    orden: [...propias, ...claves.filter((c) => !propias.includes(c))],
    colores,
    fuente: FUENTES.some((f) => f.clave === g.fuente) ? g.fuente : PRESET.fuente,
  };
}

export const esDeFabrica = (landing) =>
  JSON.stringify(normalizarLanding(landing)) === JSON.stringify(PRESET);

// Sube (paso -1) o baja (paso 1) una sección. En las puntas no hace nada.
export function moverSeccion(orden, clave, paso) {
  const i = orden.indexOf(clave);
  const j = i + paso;
  if (i < 0 || j < 0 || j >= orden.length) return [...orden];
  const nuevo = [...orden];
  [nuevo[i], nuevo[j]] = [nuevo[j], nuevo[i]];
  return nuevo;
}

// Las secciones en el orden elegido, con si aparecen y, si no, por qué. El
// editor las muestra todas; la vista previa y la página pública, sólo las
// visibles.
//
// Las de turnos piden dos cosas: la Agenda prendida y los horarios publicados
// ("horariosListos", que lo decide la API con la misma regla que la agenda
// pública). Sin horarios no hay turnos que ofrecer. Por defecto se da por
// hecho que están, así lo que ya usaba esta función no cambia.
export function estadoDeSecciones(orden, modulosActivos = [], horariosListos = true, t = tCastellano) {
  return normalizarLanding({ orden }).orden.map((clave) => {
    const seccion = SECCIONES.find((s) => s.clave === clave);
    const prendido = !seccion.modulo || estaPrendido(seccion.modulo, modulosActivos ?? []);
    // El módulo apagado manda: avisar que faltan horarios cuando ni siquiera
    // está la Agenda mandaría a la persona a un lugar que todavía no existe.
    const sinHorarios = prendido && seccion.modulo === "agenda" && !horariosListos;
    const visible = prendido && !sinHorarios;
    const modulo = LISTA_MODULOS.find((m) => m.clave === seccion.modulo);
    return {
      ...traducirSeccion(seccion, t),
      visible,
      motivo: visible
        ? null
        : sinHorarios
          ? t("landing.motivo.sinHorarios")
          : t("landing.motivo.modulo", { modulo: traducirModulo(modulo, t)?.nombre ?? seccion.modulo }),
    };
  });
}

// La luminancia relativa y el contraste de WCAG 2.1.
const canal = (valor) => {
  const c = valor / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminancia = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
};

export function contraste(a, b) {
  const [clara, oscura] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (clara + 0.05) / (oscura + 0.05);
}

export const seLee = (color, texto) => contraste(color, texto) >= CONTRASTE_MINIMO;

export const textoRecomendado = (color) =>
  contraste(color, TINTA) >= contraste(color, BLANCO) ? TINTA : BLANCO;

// Cambiar el color de una parte. Si su texto era el recomendado, pasa al
// recomendado del color nuevo; si el dueño eligió otro, se respeta.
export function cambiarColor(landing, parte, color) {
  const actual = landing.colores[parte];
  const texto =
    actual.texto === textoRecomendado(actual.color) ? textoRecomendado(color) : actual.texto;
  return { ...landing, colores: { ...landing.colores, [parte]: { color, texto } } };
}

export const cambiarTexto = (landing, parte, texto) => ({
  ...landing,
  colores: { ...landing.colores, [parte]: { ...landing.colores[parte], texto } },
});

// Mezcla dos colores #rrggbb canal por canal: "porcentaje" es cuánto de "a".
function mezclar(a, b, porcentaje) {
  const p = porcentaje / 100;
  const na = parseInt(a.slice(1), 16);
  const nb = parseInt(b.slice(1), 16);
  const canal = (n, corrimiento) => (n >> corrimiento) & 255;
  return (
    "#" +
    [16, 8, 0]
      .map((c) =>
        Math.round(canal(na, c) * p + canal(nb, c) * (1 - p))
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}

// Un tono de texto más suave que todavía se lee: si la mezcla no llega al
// mínimo, queda el texto elegido.
const textoSuave = (texto, sobre, porcentaje) => {
  const mezcla = mezclar(texto, sobre, porcentaje);
  return seLee(sobre, mezcla) ? mezcla : texto;
};

// Lo que Lienzo pisa en su style. Los tonos que el negocio no elige (el texto
// suave, los bordes, el botón apretado) salen de mezclar los que sí eligió. Los
// tonos suaves no bajan del contraste del texto elegido: si la mezcla no llega
// a 4,5:1, queda el texto elegido (que puede no leerse; el editor lo avisa).
// Se calculan acá y no con color-mix() en el CSS para poder medirlos. Las cajas
// tienen los suyos (--lienzo-cajas-*), que globals.css aplica adentro de cada
// .bg-tarjeta. Los links (text-azul) toman el color de los botones.
export function variablesDeColor({ colores: { fondo, cajas, botones, acento } }) {
  return {
    "--color-fondo": fondo.color,
    "--color-tinta": fondo.texto,
    "--color-tinta-media": textoSuave(fondo.texto, fondo.color, 85),
    "--color-tinta-suave": textoSuave(fondo.texto, fondo.color, 70),
    "--color-superficie": mezclar(fondo.texto, fondo.color, 6),
    "--color-borde": mezclar(fondo.texto, fondo.color, 15),
    "--color-borde-fuerte": mezclar(fondo.texto, fondo.color, 30),
    "--color-tarjeta": cajas.color,
    "--lienzo-cajas-texto": cajas.texto,
    "--lienzo-cajas-tinta-media": textoSuave(cajas.texto, cajas.color, 85),
    "--lienzo-cajas-tinta-suave": textoSuave(cajas.texto, cajas.color, 70),
    "--lienzo-cajas-superficie": mezclar(cajas.texto, cajas.color, 6),
    "--lienzo-cajas-borde": mezclar(cajas.texto, cajas.color, 15),
    "--lienzo-cajas-borde-fuerte": mezclar(cajas.texto, cajas.color, 30),
    "--color-azul": botones.color,
    "--color-white": botones.texto,
    "--color-azul-apretado": mezclar(botones.color, "#000000", 82),
    "--color-azul-claro": mezclar(botones.color, cajas.color, 14),
    "--color-terracota": acento.color,
    "--lienzo-acento-texto": acento.texto,
  };
}

// La de fábrica ya es la de la app. Las otras declaran --fuente-landing
// (fuentes.js), y acá pasa a títulos y texto.
const PILA = '"Segoe UI", system-ui, sans-serif';

export const variablesDeFuente = ({ fuente }) =>
  fuente === "fabrica"
    ? {}
    : {
        "--font-titulo": `var(--fuente-landing), ${PILA}`,
        "--font-cuerpo": `var(--fuente-landing), ${PILA}`,
      };
