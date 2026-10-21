// Correr con: npm run test:unit
//
// Qué negocios se ofrecen para vincular como sedes (docs/red-de-sedes.md).
// La base vuelve a verificar todo; esto es para no ofrecer lo que va a
// rechazar.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { candidatosParaVincular } from "../src/lib/sedes.js";

const negocios = [
  { id: "a", nombre: "Centro", es_duenio: true, permisos: [] },
  { id: "b", nombre: "Norte", es_duenio: true, permisos: [] },
  { id: "c", nombre: "Sur", es_duenio: false, permisos: ["ver_agenda"] },
  { id: "d", nombre: "Oeste", es_duenio: true, permisos: [] },
];

test("ofrece los otros negocios donde puede vincular", () => {
  assert.deepEqual(candidatosParaVincular(negocios, [], "a").map((n) => n.id), ["b", "d"]);
});

test("no ofrece los que ya están en la red", () => {
  const sedes = [{ id: "a" }, { id: "b" }];
  assert.deepEqual(candidatosParaVincular(negocios, sedes, "a").map((n) => n.id), ["d"]);
});

test("sin otros negocios, nada", () => {
  assert.deepEqual(candidatosParaVincular([negocios[0]], [], "a"), []);
});
