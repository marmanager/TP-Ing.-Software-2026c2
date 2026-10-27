import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { crearColaStock } from "../src/lib/cambios-stock.js";

const diferida = () => { let resolver; const promesa = new Promise((r) => { resolver = r; }); return { promesa, resolver }; };

test("ajustes del mismo producto se guardan en orden y esperar aguarda todos", async () => {
  const cola = crearColaStock();
  const puerta = diferida();
  const orden = [];
  let termino = false;
  const uno = cola.encolar("producto", async () => { orden.push(1); await puerta.promesa; orden.push(2); });
  const dos = cola.encolar("producto", async () => { orden.push(3); });
  const espera = cola.esperar().then(() => { termino = true; });
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(orden, [1]);
  assert.equal(termino, false);
  puerta.resolver(); await Promise.all([uno, dos, espera]);
  assert.deepEqual(orden, [1, 2, 3]);
  assert.equal(termino, true);
});

test("productos distintos se pueden guardar en paralelo", async () => {
  const cola = crearColaStock(); const puerta = diferida(); const orden = [];
  const uno = cola.encolar("a", async () => { orden.push("a"); await puerta.promesa; });
  const dos = cola.encolar("b", async () => { orden.push("b"); });
  await dos; assert.deepEqual(orden, ["a", "b"]);
  puerta.resolver(); await uno; await cola.esperar();
});

test("una confirmación vieja no pisa un cambio más reciente", async () => {
  const cola = crearColaStock(); const estados = [];
  const a = cola.encolar("a", async (esUltimo) => { estados.push(esUltimo()); });
  const b = cola.encolar("a", async (esUltimo) => { estados.push(esUltimo()); });
  await Promise.all([a, b]); assert.deepEqual(estados, [false, true]);
});

test("un guardado fallido no bloquea los siguientes ni deja el indicador esperando para siempre", async () => {
  const cola = crearColaStock();
  const uno = cola.encolar("a", async () => { throw new Error("sin conexión"); });
  const rechazo = assert.rejects(uno, /sin conexión/);
  const dos = cola.encolar("a", async () => 42);
  await rechazo; assert.equal(await dos, 42); await cola.esperar();
});

test("esperar incluye nuevos cambios que se encolan mientras se está guardando", async () => {
  const cola = crearColaStock(); const puerta = diferida(); const orden = [];
  const uno = cola.encolar("a", async () => { await puerta.promesa; orden.push(1); });
  const espera = cola.esperar().then(() => orden.push(3));
  const dos = cola.encolar("a", async () => orden.push(2));
  puerta.resolver(); await Promise.all([uno, dos, espera]);
  assert.deepEqual(orden, [1, 2, 3]);
});
