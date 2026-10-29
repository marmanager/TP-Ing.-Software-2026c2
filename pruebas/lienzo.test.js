import { apilar, MAX_DESHACER, puntasDeFlecha, radio, rectangulo } from "../src/lib/lienzo.js";

test("el rectángulo sale bien arrastrando hacia arriba o a la izquierda", () => {
  expect(rectangulo({ x: 50, y: 40 }, { x: 10, y: 10 })).toEqual({ x: 10, y: 10, w: 40, h: 30 });
  expect(rectangulo({ x: 0, y: 0 }, { x: 5, y: 7 })).toEqual({ x: 0, y: 0, w: 5, h: 7 });
});

test("el radio es la distancia del centro al puntero", () => {
  expect(radio({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
});

test("las puntas de la flecha quedan detrás del extremo, simétricas", () => {
  const [p, q] = puntasDeFlecha({ x: 0, y: 0 }, { x: 100, y: 0 });
  expect(p.x).toBeLessThan(100);
  expect(p.x).toBeCloseTo(q.x);
  expect(p.y).toBeCloseTo(-q.y);
  // una flecha de largo cero no produce NaN
  const [r] = puntasDeFlecha({ x: 5, y: 5 }, { x: 5, y: 5 });
  expect(Number.isNaN(r.x)).toBe(false);
});

test("la pila de deshacer no pasa el tope y conserva lo último", () => {
  let pila = [];
  for (let i = 0; i < MAX_DESHACER + 5; i++) pila = apilar(pila, i);
  expect(pila).toHaveLength(MAX_DESHACER);
  expect(pila.at(-1)).toBe(MAX_DESHACER + 4);
});
