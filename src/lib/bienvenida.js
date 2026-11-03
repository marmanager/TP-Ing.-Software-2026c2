// Las secciones 04 (módulos) y 05 (Remi) de la bienvenida: lo que se puede
// decidir sin React (docs/bienvenida-modulos-y-remi.md).

// Los módulos con pantalla de ejemplo, en el orden de la lista: los que se
// entienden de un vistazo. Los otros se nombran al pie.
export const MODULOS_DE_LA_BIENVENIDA = ["agenda", "clientes", "inventario", "ecuaciones", "lienzo", "dashboard"];
export const MODULOS_AL_PIE = ["presupuesto", "equipo", "historial"];

// Qué pestaña elige cada tecla en una lista de `cuantas`, como pide el patrón
// de pestañas: las flechas dan la vuelta, Inicio y Fin van a los extremos.
// null: la tecla no es de la lista y se deja pasar.
const PASO_DE_TECLA = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

export function siguientePestana(actual, tecla, cuantas) {
  if (tecla === "Home") return 0;
  if (tecla === "End") return cuantas - 1;
  const paso = PASO_DE_TECLA[tecla];
  if (!paso) return null;
  return (actual + paso + cuantas) % cuantas;
}

// La charla de Remi es un guion, no una conversación: la API pide sesión y
// negocio, y la landing no tiene ni una ni otro. Cada charla pasa por los
// mismos pasos que una de verdad, y `espera` es cuánto tarda cada uno en
// aparecer después del anterior (ms). El "toque" es la persona apretando el
// botón de la tarjeta: lo que se quiere mostrar es que Remi propone y la
// persona decide.
export const PASOS = [
  { paso: "pregunta", espera: 0 },
  { paso: "pensando", espera: 600 },
  { paso: "respuesta", espera: 1000 },
  { paso: "tarjeta", espera: 500 },
  { paso: "toque", espera: 1500 },
  { paso: "hecho", espera: 700 },
];

// Lo que queda quieta la charla entera antes de la siguiente, para leerla.
const QUIETA = 4000;

export const DURACION_CHARLA = PASOS.reduce((s, p) => s + p.espera, 0) + QUIETA;

// La pregunta y la respuesta de cada una están en
// acceso.landing.remi.charlas.<clave>; la tarjeta, con los textos de la app.
export const CHARLAS_DE_REMI = [
  { clave: "taller", tarjeta: { tipo: "propuesta", prender: ["agenda", "inventario", "equipo"] } },
  { clave: "ecuacion", tarjeta: { tipo: "ecuacion" } },
  { clave: "inventario", tarjeta: { tipo: "propuesta", prender: ["inventario"] } },
];

// Para el tiempo que la charla lleva corriendo (sin contar las pausas), qué
// charla va y cuántos de sus pasos se ven. De la última vuelve a la primera.
export function estadoDeLaCharla(ms, cuantas = CHARLAS_DE_REMI.length) {
  const vuelta = DURACION_CHARLA * cuantas;
  const enLaVuelta = ((ms % vuelta) + vuelta) % vuelta;
  const charla = Math.floor(enLaVuelta / DURACION_CHARLA);
  const enLaCharla = enLaVuelta - charla * DURACION_CHARLA;

  let pasos = 0;
  let desde = 0;
  for (const { espera } of PASOS) {
    desde += espera;
    if (enLaCharla < desde) break;
    pasos++;
  }
  return { charla, pasos };
}
