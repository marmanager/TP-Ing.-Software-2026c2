// Las cuentas de las formas del Lienzo. Lo demás (el canvas y los punteros)
// vive en la pantalla; acá sólo lo que se puede probar sin navegador.

export const COLORES = ["#111827", "#dc2626", "#ea580c", "#16a34a", "#2563eb", "#7c3aed"];
export const GROSORES = [2, 5, 10, 18];
export const MAX_DESHACER = 20;

// Rectángulo entre dos esquinas, arrastrando hacia donde sea.
export const rectangulo = (a, b) => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.abs(b.x - a.x),
  h: Math.abs(b.y - a.y),
});

// El círculo se arrastra desde el centro: el radio es la distancia al puntero.
export const radio = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

// Las dos puntas de una flecha que termina en b. El largo crece con el
// grosor para que se vea en trazos gruesos, y se achica si la flecha es corta.
export const puntasDeFlecha = (a, b, grosor = 5) => {
  const angulo = Math.atan2(b.y - a.y, b.x - a.x);
  const largo = Math.min(Math.hypot(b.x - a.x, b.y - a.y) / 2, 12 + grosor * 2);
  const punta = (desvio) => ({
    x: b.x - largo * Math.cos(angulo + desvio),
    y: b.y - largo * Math.sin(angulo + desvio),
  });
  return [punta(Math.PI / 6), punta(-Math.PI / 6)];
};

// Agrega una foto a la pila de deshacer sin pasar el tope.
export const apilar = (pila, foto) => [...pila, foto].slice(-MAX_DESHACER);
