// Correr con: npm run test:unit
//
// Los repuestos en camino (SCRUM-113): qué le pasa a un caso cuando se pide
// algo para él, y cuando ese algo llega.
//
// Lo que más importa probar es lo que estaba mal: que llegara una pieza
// pasaba el caso a "en proceso" siempre, aunque faltara otra, aunque el
// cliente no hubiera contestado y aunque el caso estuviera cerrado.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { alLlegarInsumo, alPedirInsumo } from "../src/lib/estados.js";

const CASO = "caso-1";
const caso = (estado, extra = {}) => ({ id: CASO, estado, responsable_id: "e1", ...extra });
const pedido = (nombre, extra = {}) => ({ id: nombre, nombre, caso_id: CASO, estado: "pedido", ...extra });
const enStock = (nombre) => ({ id: nombre, nombre, caso_id: null, estado: "en_stock" });
const pasoSinContestar = { id: "p1", caso_id: CASO, estado: "esperando" };
const cliente = { nombre: "Marcela" };

// ---------- pedir ----------

test("pedir algo para un caso en proceso lo deja esperándolo", () => {
  const r = alPedirInsumo(caso("en_proceso"), {
    rubro: "taller",
    insumos: [pedido("pastillas de freno")],
  });
  assert.equal(r.estado, "esperando");
  assert.equal(r.que_falta, "Que llegue «pastillas de freno»");
  assert.equal(r.cambiaEstado, true);
});

test("pedir algo para un caso recién anotado también lo deja esperando", () => {
  const r = alPedirInsumo(caso("nuevo"), { rubro: "taller", insumos: [pedido("correa")] });
  assert.equal(r.estado, "esperando");
  assert.equal(r.que_falta, "Que llegue «correa»");
});

test("si el cliente todavía no contestó, eso sigue siendo lo que falta", () => {
  // Un pedido nuevo no puede tapar que la pelota es del cliente.
  const r = alPedirInsumo(caso("esperando"), {
    rubro: "taller",
    pasos: [pasoSinContestar],
    insumos: [pedido("correa")],
    cliente,
  });
  assert.equal(r.estado, "esperando");
  assert.equal(r.que_falta, "Que Marcela apruebe 1 paso");
  assert.equal(r.cambiaEstado, false, "ya estaba esperando: no es un cambio de estado");
});

test("pedir para un caso cerrado no lo toca", () => {
  assert.equal(alPedirInsumo(caso("completado"), { insumos: [pedido("x")] }), null);
});

test("sin caso no hay nada que hacer", () => {
  assert.equal(alPedirInsumo(null, {}), null);
  assert.equal(alPedirInsumo(undefined, {}), null);
});

// ---------- llegar ----------

test("si llega lo único que faltaba, el caso vuelve a moverse", () => {
  const r = alLlegarInsumo(caso("esperando"), {
    rubro: "taller",
    insumos: [enStock("pastillas de freno")],
  });
  assert.equal(r.estado, "en_proceso");
  assert.equal(r.que_falta, "Está en el taller");
  assert.equal(r.cambiaEstado, true);
});

test("el texto de 'en proceso' es el del rubro", () => {
  const r = alLlegarInsumo(caso("esperando"), { rubro: "medicina", insumos: [] });
  assert.equal(r.que_falta, "En consulta");
});

test("si llega una pieza de dos, el caso sigue esperando la otra", () => {
  // Éste es el error que había: la primera de dos lo destrababa.
  const r = alLlegarInsumo(caso("esperando"), {
    rubro: "taller",
    insumos: [enStock("pastillas"), pedido("disco")],
  });
  assert.equal(r.estado, "esperando");
  assert.equal(r.que_falta, "Que llegue «disco»");
  assert.equal(r.cambiaEstado, false);
});

test("si llega la pieza pero el cliente no contestó, sigue esperando al cliente", () => {
  const r = alLlegarInsumo(caso("esperando"), {
    rubro: "taller",
    pasos: [pasoSinContestar],
    insumos: [enStock("correa")],
    cliente,
  });
  assert.equal(r.estado, "esperando");
  assert.equal(r.que_falta, "Que Marcela apruebe 1 paso");
});

test("que llegue una pieza no reabre un caso cerrado", () => {
  assert.equal(alLlegarInsumo(caso("completado"), { insumos: [] }), null);
});

test("que llegue una pieza no saca un caso de control final", () => {
  assert.equal(alLlegarInsumo(caso("revision_final"), { insumos: [] }), null);
});

test("que llegue una pieza no mueve un caso que ya está en proceso", () => {
  assert.equal(alLlegarInsumo(caso("en_proceso"), { insumos: [] }), null);
});

test("las piezas de otro caso no traban a éste", () => {
  const deOtro = { ...pedido("filtro"), caso_id: "otro-caso" };
  const r = alLlegarInsumo(caso("esperando"), { rubro: "taller", insumos: [deOtro] });
  assert.equal(r.estado, "en_proceso");
});

// ---------- ida y vuelta ----------

test("pedir dos, llegar de a una: sólo la última destraba", () => {
  const c = caso("en_proceso");
  const conDos = [pedido("pastillas"), pedido("disco")];

  const alPedir = alPedirInsumo(c, { rubro: "taller", insumos: conDos });
  assert.equal(alPedir.estado, "esperando");

  const esperando = { ...c, estado: "esperando" };
  const llegoUna = [enStock("pastillas"), pedido("disco")];
  assert.equal(alLlegarInsumo(esperando, { rubro: "taller", insumos: llegoUna }).estado, "esperando");

  const llegaronLasDos = [enStock("pastillas"), enStock("disco")];
  assert.equal(
    alLlegarInsumo(esperando, { rubro: "taller", insumos: llegaronLasDos }).estado,
    "en_proceso"
  );
});
