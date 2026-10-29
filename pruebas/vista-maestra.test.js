// Correr con: npm run test:unit
//
// La vista maestra (docs/vista-maestra.md): qué muestra el selector, los
// atajos, y qué se prende o apaga.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import {
  conGrupo, conPrendido, delSelector, estadoDelGrupo, hayUrgencia, motivoParaEntrar,
  mover, moverA, negocioDelAtajo, paraGuardar,
} from "../src/lib/vista-maestra.js";

const A = { id: "a", nombre: "Centro", prendido: true, orden: 1 };
const B = { id: "b", nombre: "Sur", prendido: false, orden: 0 };
const C = { id: "c", nombre: "Norte", prendido: true, orden: 2 };
const tecla = (code, mas = {}) => ({ code, altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, ...mas });
const t = (clave) => clave;

test("el selector: sólo los prendidos, en su orden", () => {
  assert.deepEqual(delSelector([C, B, A]).map((n) => n.id), ["a", "c"]);
});

test("Alt+1 es el primero del selector y Alt+2 el segundo", () => {
  const sel = delSelector([A, B, C]);
  assert.equal(negocioDelAtajo(tecla("Digit1"), sel), "a");
  assert.equal(negocioDelAtajo(tecla("Digit2"), sel), "c");
});

test("sin Alt, con Ctrl, o fuera del selector, nada", () => {
  const sel = delSelector([A, C]);
  assert.equal(negocioDelAtajo(tecla("Digit1", { altKey: false }), sel), null);
  assert.equal(negocioDelAtajo(tecla("Digit1", { ctrlKey: true }), sel), null);
  assert.equal(negocioDelAtajo(tecla("Digit3"), sel), null);
  assert.equal(negocioDelAtajo(tecla("Digit0"), sel), null);
  assert.equal(negocioDelAtajo(tecla("KeyA"), sel), null);
});

test("en la Mac Option+1 escribe '¡', pero el código sigue siendo Digit1", () => {
  assert.equal(negocioDelAtajo({ ...tecla("Digit1"), key: "¡" }, delSelector([A, C])), "a");
});

test("el que se está mirando no se apaga", () => {
  assert.equal(conPrendido([A, C], "a", false, "a").find((n) => n.id === "a").prendido, true);
  assert.equal(conPrendido([A, C], "c", false, "a").find((n) => n.id === "c").prendido, false);
});

test("apagar un grupo deja prendido el que se está mirando", () => {
  const grupo = { id: "g", negocios: ["a", "c"] };
  const r = conGrupo([A, B, C], grupo, false, "a");
  assert.deepEqual(r.map((n) => [n.id, n.prendido]), [["a", true], ["b", false], ["c", false]]);
  assert.deepEqual(conGrupo([A, B, C], { id: "g", negocios: ["b"] }, true, "a").find((n) => n.id === "b").prendido, true);
});

test("estado del grupo", () => {
  assert.equal(estadoDelGrupo([A, C], { negocios: ["a", "c"] }), "prendido");
  assert.equal(estadoDelGrupo([A, B], { negocios: ["a", "b"] }), "mezclado");
  assert.equal(estadoDelGrupo([B], { negocios: ["b"] }), "apagado");
});

test("subir y bajar renumeran el orden y no se pasan de los bordes", () => {
  assert.deepEqual(mover([A, B, C], "a", -1).map((n) => [n.id, n.orden]), [["a", 0], ["b", 1], ["c", 2]]);
  assert.deepEqual(mover([A, B, C], "b", -1).map((n) => n.id), ["b", "a", "c"]);
  assert.deepEqual(mover([A, B, C], "c", 1).map((n) => n.id), ["b", "a", "c"]);
});

test("arrastrar uno encima de otro lo pone en su lugar", () => {
  assert.deepEqual(moverA([A, B, C], "c", "b").map((n) => n.id), ["c", "b", "a"]);
  assert.deepEqual(moverA([A, B, C], "b", "c").map((n) => n.id), ["a", "c", "b"]);
});

test("para guardar: en orden, sólo id y prendido", () => {
  assert.deepEqual(paraGuardar([A, B, C]), [
    { id: "b", prendido: false }, { id: "a", prendido: true }, { id: "c", prendido: true },
  ]);
});

test("por qué no se puede entrar", () => {
  assert.equal(motivoParaEntrar({ enVista: true, cantidad: 3 }, t), "vistaMaestra.yaEstas");
  assert.equal(motivoParaEntrar({ enVista: false, cantidad: 1 }, t), "vistaMaestra.faltanNegocios");
  assert.equal(motivoParaEntrar({ enVista: false, cantidad: 2 }, t), null);
});

test("urgencia", () => {
  assert.equal(hayUrgencia({ casos_atrasados: 0, stock_bajo: 0 }), false);
  assert.equal(hayUrgencia({ casos_atrasados: 1, stock_bajo: 0 }), true);
  assert.equal(hayUrgencia(undefined), false);
});
