// Correr con: npm test
//
// El único test del Sprint 1, y a propósito: el cálculo de la plata es la
// única lógica del sistema donde un bug se ve en pantalla y con guita.
// Todo lo demás se verifica mirando la pantalla.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { totalesDeCaso } from "../src/lib/estados.js";

// Los cinco pasos del caso 248, textuales de la sección 09 de la cartilla.
const caso248 = [
  { nombre: "Revisión completa", monto: 74000, estado: "aprobado" },
  { nombre: "Cambio de la pieza principal", monto: 22000, estado: "aprobado" },
  { nombre: "Reemplazo de las dos piezas de apoyo", monto: 58500, estado: "esperando" },
  { nombre: "Mantenimiento de rutina", monto: 18000, estado: "esperando" },
  { nombre: "Control final y ajuste", monto: 12000, estado: "esperando" },
];

test("da los números que la cartilla muestra en la pantalla del caso 248", () => {
  const t = totalesDeCaso(caso248);
  assert.equal(t.aprobado, 96000);
  assert.equal(t.esperando, 88500);
  assert.equal(t.todo, 184500);
  assert.equal(t.cuantosEsperan, 3);
});

test("aprobar un paso lo mueve de esperando a aprobado sin mover el total", () => {
  const antes = totalesDeCaso(caso248);
  const despues = totalesDeCaso(
    caso248.map((p) => (p.monto === 58500 ? { ...p, estado: "aprobado" } : p))
  );

  assert.equal(despues.aprobado, 154500);
  assert.equal(despues.esperando, 30000);
  assert.equal(despues.todo, antes.todo, "el total del caso no se mueve al aprobar");
  assert.equal(despues.cuantosEsperan, 2);
});

test("lo rechazado no se cobra: sale del total", () => {
  const t = totalesDeCaso(
    caso248.map((p) => (p.monto === 58500 ? { ...p, estado: "rechazado" } : p))
  );

  assert.equal(t.aprobado, 96000);
  assert.equal(t.esperando, 30000);
  assert.equal(t.todo, 126000, "el paso que el cliente no quiere no suma en ningún lado");
});

test("un caso sin pasos todavía da todo en cero, no NaN", () => {
  const t = totalesDeCaso([]);
  assert.deepEqual(t, { aprobado: 0, esperando: 0, todo: 0, cuantosEsperan: 0 });
});

test("los montos que vienen como texto desde la base se suman como números", () => {
  // Postgres devuelve numeric como string a través de PostgREST.
  const t = totalesDeCaso([
    { monto: "74000.00", estado: "aprobado" },
    { monto: "22000.00", estado: "aprobado" },
  ]);
  assert.equal(t.aprobado, 96000, "si se concatenaran daría 74000.0022000.00");
});
