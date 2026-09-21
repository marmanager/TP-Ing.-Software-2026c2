// Correr con: npm test
//
// El avance del trabajo dentro de un caso (flujo, punto 7).
//
// Hasta acá un paso decía qué contestó el cliente —esperando, aprobado,
// rechazado— pero no si el trabajo se hizo. Son dos cosas distintas y por eso
// son dos columnas: "estado" es del cliente y "hecho_en" es del negocio.
//
// Esta es la cuenta de la que dependen tres cosas de la pantalla: el "2 de 3
// hechos", el ofrecimiento de pasar a control final, y el avance que ve el
// cliente en su link. Por eso vive suelta y con test, como totalesDeCaso().

import { test } from "node:test";
import assert from "node:assert/strict";
import { avanceDePasos, sePuedeMarcarHecho } from "../src/lib/estados.js";

const paso = (estado, hecho_en = null, monto = 1000) => ({ estado, hecho_en, monto });

// ------------------------------------------------------------
// La cuenta
// ------------------------------------------------------------

test("cuenta los aprobados hechos y los que faltan", () => {
  const a = avanceDePasos([
    paso("aprobado", "2026-09-13T10:00:00.000Z"),
    paso("aprobado", "2026-09-13T11:00:00.000Z"),
    paso("aprobado"),
  ]);

  assert.equal(a.aprobados, 3);
  assert.equal(a.hechos, 2);
  assert.equal(a.faltan, 1);
  assert.equal(a.todoHecho, false);
});

test("lo que el cliente todavía no contestó no es trabajo pendiente", () => {
  // Tres pasos esperando respuesta no son tres cosas por hacer: son una
  // propuesta. Si contaran, un presupuesto recién mandado se vería como un
  // caso con el trabajo atrasado.
  const a = avanceDePasos([paso("esperando"), paso("esperando"), paso("aprobado")]);

  assert.equal(a.aprobados, 1);
  assert.equal(a.hechos, 0);
  assert.equal(a.faltan, 1);
});

test("lo rechazado tampoco cuenta, ni siquiera para el total", () => {
  const a = avanceDePasos([paso("rechazado"), paso("aprobado", "2026-09-13T10:00:00.000Z")]);

  assert.equal(a.aprobados, 1);
  assert.equal(a.hechos, 1);
  assert.equal(a.todoHecho, true);
});

test("con todo hecho, lo dice", () => {
  const a = avanceDePasos([
    paso("aprobado", "2026-09-13T10:00:00.000Z"),
    paso("aprobado", "2026-09-13T11:00:00.000Z"),
  ]);

  assert.equal(a.faltan, 0);
  assert.equal(a.todoHecho, true);
});

test("un caso sin pasos aprobados NO está todo hecho", () => {
  // Es la trampa de este cálculo: cero de cero da cero, y "0 === 0" sería
  // true. Un caso recién abierto ofrecería pasar a control final sin que
  // nadie haya tocado el auto.
  assert.equal(avanceDePasos([]).todoHecho, false);
  assert.equal(avanceDePasos([paso("esperando")]).todoHecho, false);
  assert.equal(avanceDePasos([paso("rechazado")]).todoHecho, false);
});

test("sin pasos, la cuenta es cero y no explota", () => {
  assert.deepEqual(avanceDePasos(), { aprobados: 0, hechos: 0, faltan: 0, todoHecho: false });
  assert.deepEqual(avanceDePasos([]), { aprobados: 0, hechos: 0, faltan: 0, todoHecho: false });
});

test("cualquier fecha alcanza para estar hecho: no se mira cuál", () => {
  // La hora en que se tocó el botón no cambia ninguna cuenta, y marcar dos
  // veces no puede mover el resultado.
  const temprano = avanceDePasos([paso("aprobado", "2020-01-01T00:00:00.000Z")]);
  const tarde = avanceDePasos([paso("aprobado", "2030-01-01T00:00:00.000Z")]);
  assert.deepEqual(temprano, tarde);
});

// ------------------------------------------------------------
// Qué se puede marcar
// ------------------------------------------------------------

test("sólo se marca lo que el cliente aprobó", () => {
  const abierto = { estado: "en_proceso" };
  assert.equal(sePuedeMarcarHecho(paso("aprobado"), abierto), true);
  assert.equal(sePuedeMarcarHecho(paso("esperando"), abierto), false);
  assert.equal(sePuedeMarcarHecho(paso("rechazado"), abierto), false);
});

test("sobre un caso entregado no se marca nada", () => {
  // Un caso cerrado es el registro de lo que pasó, no un borrador. Para
  // corregirlo se vuelve a abrir, que es una acción sola y queda escrita.
  assert.equal(sePuedeMarcarHecho(paso("aprobado"), { estado: "completado" }), false);
});

test("marcar y desmarcar son la misma puerta: lo ya hecho se sigue pudiendo tocar", () => {
  const hecho = paso("aprobado", "2026-09-13T10:00:00.000Z");
  assert.equal(sePuedeMarcarHecho(hecho, { estado: "en_proceso" }), true);
});

test("sin paso o sin caso no se ofrece nada", () => {
  assert.equal(sePuedeMarcarHecho(null, { estado: "en_proceso" }), false);
  assert.equal(sePuedeMarcarHecho(paso("aprobado"), null), false);
});
