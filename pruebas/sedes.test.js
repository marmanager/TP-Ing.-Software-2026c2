// Correr con: npm run test:unit
//
// Qué negocios se ofrecen para vincular como sedes (docs/red-de-sedes.md).
// La base vuelve a verificar todo; esto es para no ofrecer lo que va a
// rechazar.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { candidatosParaVincular, pedidosDeOtrasSedes } from "../src/lib/sedes.js";

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

// ---------- lo pedido en las otras sedes ----------
// "En camino" suma lo que pidieron las otras sedes, con el nombre de la sede
// a la que va. Lo de la sede activa ya está en la pantalla, con su caso.

const sedes = [
  { id: "a", nombre: "Centro" },
  { id: "b", nombre: "Norte" },
];
const fila = (negocio_id, estado, nombre = "Filtro") => ({ negocio_id, estado, nombre, cantidad: 1 });

test("trae sólo lo pedido de las otras sedes, con el nombre de la sede", () => {
  const insumos = [fila("a", "pedido"), fila("b", "pedido", "Bujía"), fila("b", "en_stock")];
  assert.deepEqual(pedidosDeOtrasSedes(insumos, sedes, "a"), [
    { ...fila("b", "pedido", "Bujía"), sede: "Norte" },
  ]);
});

test("una fila de una sede que no está en la lista no se muestra", () => {
  assert.deepEqual(pedidosDeOtrasSedes([fila("z", "pedido")], sedes, "a"), []);
});

test("sin insumos, nada", () => {
  assert.deepEqual(pedidosDeOtrasSedes(undefined, sedes, "a"), []);
});
