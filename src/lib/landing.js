// La landing de cada negocio (docs/landing-por-negocio.md): qué secciones
// tiene, cómo viene de fábrica, qué colores se leen y cómo se pinta.
//
// Lógica pura, sin React: la usan el editor (/negocio/landing), la vista
// previa y, más adelante, la página pública. Pruebas: pruebas/landing.test.js.
//
// Las claves de SECCIONES y FUENTES están también en la API
// (src/modulos/negocio/esquemas.ts), que no deja guardar otras. Si se suma
// una, se suma en los dos lados.

import { LISTA_MODULOS, estaPrendido } from "./modulos.js";

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

// Los cuatro colores que elige el negocio, cada uno con el de su texto.
export const PARTES = [
  { clave: "fondo", nombre: "Fondo", ayuda: "El color de toda la página." },
  { clave: "cajas", nombre: "Cajas", ayuda: "Donde va cada sección y cada dato." },
  { clave: "botones", nombre: "Botones", ayuda: "Lo que se toca: botones y links." },
  { clave: "acento", nombre: "Acento", ayuda: "Las marcas que llaman la atención, como el estado de un caso." },
];

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
// editor las muestra todas; la vista previa, sólo las visibles.
export function estadoDeSecciones(orden, modulosActivos = []) {
  return normalizarLanding({ orden }).orden.map((clave) => {
    const seccion = SECCIONES.find((s) => s.clave === clave);
    const visible = !seccion.modulo || estaPrendido(seccion.modulo, modulosActivos);
    const modulo = LISTA_MODULOS.find((m) => m.clave === seccion.modulo);
    return {
      ...seccion,
      visible,
      motivo: visible ? null : `Aparece cuando prendés el módulo ${modulo?.nombre ?? seccion.modulo}.`,
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

// Lo que Lienzo pisa en su style. Los tonos que el negocio no elige (el texto
// suave, los bordes, el botón apretado) salen de mezclar los que sí eligió,
// así siguen leyéndose sobre cualquier fondo. Los links (text-azul) toman el
// color de los botones.
const mezcla = (a, b, porcentaje) => `color-mix(in oklab, ${a} ${porcentaje}%, ${b})`;

export function variablesDeColor({ colores: { fondo, cajas, botones, acento } }) {
  return {
    "--color-fondo": fondo.color,
    "--color-tinta": fondo.texto,
    "--color-tinta-media": mezcla(fondo.texto, fondo.color, 85),
    "--color-tinta-suave": mezcla(fondo.texto, fondo.color, 70),
    "--color-superficie": mezcla(fondo.texto, fondo.color, 6),
    "--color-borde": mezcla(fondo.texto, fondo.color, 15),
    "--color-borde-fuerte": mezcla(fondo.texto, fondo.color, 30),
    "--color-tarjeta": cajas.color,
    "--lienzo-cajas-texto": cajas.texto,
    "--color-azul": botones.color,
    "--color-white": botones.texto,
    "--color-azul-apretado": mezcla(botones.color, "#000000", 82),
    "--color-azul-claro": mezcla(botones.color, cajas.color, 14),
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
