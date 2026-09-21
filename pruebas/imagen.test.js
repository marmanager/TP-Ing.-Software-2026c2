// Correr con: npm test
//
// La foto del negocio se achica en el navegador antes de guardarse. El canvas
// y el FileReader no se pueden probar acá, pero la cuenta de cuánto tiene que
// medir la foto sí, y es la que decide cuánto pesa lo que termina en la base.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { medidasPara } from "../src/lib/imagen.js";

test("el lado más largo baja al máximo y el otro acompaña", () => {
  assert.deepEqual(medidasPara(512, 256, 256), { ancho: 256, alto: 128 });
  assert.deepEqual(medidasPara(256, 512, 256), { ancho: 128, alto: 256 });
});

test("una foto cuadrada queda cuadrada", () => {
  assert.deepEqual(medidasPara(1000, 1000, 256), { ancho: 256, alto: 256 });
});

test("una foto más chica que el máximo no se agranda", () => {
  // Agrandarla no sumaría un solo detalle y multiplicaría lo que pesa.
  assert.deepEqual(medidasPara(100, 80, 256), { ancho: 100, alto: 80 });
  assert.deepEqual(medidasPara(256, 256, 256), { ancho: 256, alto: 256 });
});

test("las medidas son enteras: el canvas no dibuja medio píxel", () => {
  const m = medidasPara(333, 100, 256);
  assert.equal(m.ancho, 256);
  assert.equal(m.alto, 77);
  assert.equal(Number.isInteger(m.alto), true);
});

test("una tira muy angosta no se queda en cero de alto", () => {
  // 2000x3 achicado a 256 daría 0.38 de alto, y un canvas de alto 0 no dibuja
  // nada: la foto se guardaría en blanco.
  const m = medidasPara(2000, 3, 256);
  assert.equal(m.ancho, 256);
  assert.equal(m.alto, 1);
});
