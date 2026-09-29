// Correr con: npm run test:unit
//
// A dónde va una cuenta real al iniciar sesión (docs/multinegocio.md).

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { alEntrar } from "../src/lib/entrada.js";

const A = { id: "a", nombre: "Taller Centro" };
const B = { id: "b", nombre: "Taller Norte" };

test("sin ningún negocio, a crear uno", () => {
  assert.deepEqual(alEntrar({ negocios: [] }), { ir: "crear" });
  assert.deepEqual(alEntrar({ negocios: [], predeterminado: "a", inicioRapido: true }), {
    ir: "crear",
  });
});

test("con Inicio rápido y un predeterminado suyo, entra directo", () => {
  assert.deepEqual(alEntrar({ negocios: [A, B], predeterminado: "b", inicioRapido: true }), {
    ir: "entrar",
    negocio: "b",
  });
});

test("sin Inicio rápido, elige aunque haya predeterminado", () => {
  assert.deepEqual(alEntrar({ negocios: [A, B], predeterminado: "a", inicioRapido: false }), {
    ir: "elegir",
  });
});

test("un predeterminado que ya no es suyo no cuenta: elige", () => {
  assert.deepEqual(alEntrar({ negocios: [A], predeterminado: "b", inicioRapido: true }), {
    ir: "elegir",
  });
});

test("con un solo negocio y sin Inicio rápido, también elige", () => {
  assert.deepEqual(alEntrar({ negocios: [A] }), { ir: "elegir" });
});
