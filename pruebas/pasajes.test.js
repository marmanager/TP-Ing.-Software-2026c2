// Los pasajes de un estado a otro.
//
// Hasta ahora cada botón de "Cómo sigue" traía a mano su texto de historial.
// Al pasar a un desplegable, cualquier estado puede ir a cualquier otro, así
// que el texto tiene que salir de una tabla y no de un botón.
//
// Lo que se prueba acá es que esa tabla esté completa: si alguien suma un
// estado sexto y se olvida del texto, el historial diría "undefined".
//
// Correr con: npm test

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import {
  AL_PASAR_A,
  estadosAElegir,
  ORDEN_ESTADOS,
} from "../src/lib/estados.js";

test("todos los estados saben qué escribir en el historial", () => {
  for (const estado of ORDEN_ESTADOS) {
    const dice = AL_PASAR_A[estado];
    assert.ok(dice, `falta el texto de historial de "${estado}"`);
    assert.ok(dice.titulo?.trim(), `"${estado}" no tiene título`);
    assert.ok(dice.icono?.trim(), `"${estado}" no tiene ícono`);
  }
});

// Entregar no es un pasaje más.
//
// Cerrar un caso abre el formulario de cobro: escribe "cobrado" y
// "cobrado_en", y es el único momento en que alguien tiene el número
// delante. Si "Completado" fuera una opción del desplegable, habría dos
// formas de cerrar un caso y una de las dos se saltearía la plata.
//
// Por eso el desplegable mueve el caso entre los estados abiertos y nada
// más. Entregar tiene su botón, y reabrir el suyo.
test("el desplegable no ofrece entregar: eso va por el botón que cobra", () => {
  for (const actual of ORDEN_ESTADOS) {
    assert.ok(
      !estadosAElegir(actual).includes("completado"),
      `desde "${actual}" el desplegable ofrece cerrar sin pasar por el cobro`
    );
  }
});

test("desde un caso abierto se puede ir a los otros tres estados abiertos", () => {
  for (const actual of ORDEN_ESTADOS.filter((e) => e !== "completado")) {
    const otros = estadosAElegir(actual);

    assert.equal(otros.length, 3, `desde "${actual}" no son tres opciones`);
    assert.ok(!otros.includes(actual), `"${actual}" se ofrece a sí mismo`);
    assert.equal(new Set(otros).size, otros.length, "hay repetidos");

    // El orden del recorrido se respeta: se lee igual que la sección 02.
    assert.deepEqual(
      otros,
      ORDEN_ESTADOS.filter((e) => e !== actual && e !== "completado")
    );
  }
});
