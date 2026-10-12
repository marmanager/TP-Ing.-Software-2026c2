// Correr con: npm run test:unit
//
// El nombre del caso (SCRUM-119). Cada negocio elige en Mi negocio con qué
// nace el nombre de sus casos: el número de siempre, el cliente, la patente o
// lo que pidió. Después se puede editar a mano.
//
// Lo que más se cuida es que un caso nunca quede sin nada que mostrar: si el
// nombre falta o quedó en blanco, se ve "Caso 271", como siempre.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import {
  casoEnFrase,
  lineaDelCaso,
  subtituloDelCaso,
  tituloDelCaso,
} from "../src/lib/nombres.js";

// ---------------------------------------------------------------
// Cómo se muestra
// ---------------------------------------------------------------

test("con nombre, el nombre es el título y el número queda de subtítulo", () => {
  const caso = { numero: 271, nombre: "Hugo Peralta" };
  assert.equal(tituloDelCaso(caso), "Hugo Peralta");
  assert.equal(subtituloDelCaso(caso), "Caso 271");
});

test("sin nombre, el título es el número y no hay subtítulo que lo repita", () => {
  const caso = { numero: 271, nombre: null };
  assert.equal(tituloDelCaso(caso), "Caso 271");
  assert.equal(subtituloDelCaso(caso), null);
});

test("un nombre que quedó en blanco cuenta como que no hay nombre", () => {
  const caso = { numero: 271, nombre: "   " };
  assert.equal(tituloDelCaso(caso), "Caso 271");
  assert.equal(subtituloDelCaso(caso), null);
});

test("un caso de antes de esta opción, sin la clave nombre, se ve con su número", () => {
  const caso = { numero: 271 };
  assert.equal(tituloDelCaso(caso), "Caso 271");
  assert.equal(subtituloDelCaso(caso), null);
});

// ---------------------------------------------------------------
// El caso adentro de una frase
// ---------------------------------------------------------------

test("en una frase, sin nombre dice el número y con nombre dice el nombre", () => {
  // Para "Listo. El caso 271 quedó entregado." El "el" lo pone la frase.
  assert.equal(casoEnFrase({ numero: 271, nombre: null }), "caso 271");
  assert.equal(casoEnFrase({ numero: 271, nombre: "AB 123 CD" }), "caso AB 123 CD");
});

test("en una frase nunca sale 'caso Caso 271'", () => {
  // Es el error que daría usar tituloDelCaso() adentro de "el caso ...".
  assert.equal(casoEnFrase({ numero: 271 }), "caso 271");
  assert.equal(casoEnFrase({ numero: 271, nombre: "   " }), "caso 271");
});

// ---------------------------------------------------------------
// La línea de abajo del título
// ---------------------------------------------------------------

test("sin nombre, abajo va lo que pidió y el cliente, como siempre", () => {
  const caso = { numero: 271, nombre: null, servicio: "Frenos" };
  assert.equal(lineaDelCaso(caso, "Hugo Peralta"), "Frenos · Hugo Peralta");
});

test("lo que ya dice el título no se repite abajo", () => {
  // Nombrado por cliente: el cliente ya está arriba.
  assert.equal(lineaDelCaso({ numero: 1, nombre: "Hugo Peralta", servicio: "Frenos" }, "Hugo Peralta"), "Frenos");
  // Nombrado por lo que pidió: eso ya está arriba.
  assert.equal(lineaDelCaso({ numero: 1, nombre: "Frenos", servicio: "Frenos" }, "Hugo Peralta"), "Hugo Peralta");
});

test("sin cliente, queda sólo lo que pidió", () => {
  assert.equal(lineaDelCaso({ numero: 1, nombre: null, servicio: "Frenos" }, undefined), "Frenos");
});
