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
  nombreInicial,
  subtituloDelCaso,
  tituloDelCaso,
} from "../src/lib/nombres.js";
import { casoPublico } from "../src/lib/seguimiento.js";

const alta = { cliente: "Hugo Peralta", identificador: "AB 123 CD", servicio: "Frenos" };

// ---------------------------------------------------------------
// Con qué nombre nace el caso
// ---------------------------------------------------------------

test("por número, el caso nace sin nombre y se ve con su número", () => {
  assert.equal(nombreInicial("numero", alta), null);
});

test("por cliente, por patente o por motivo, nace con ese dato", () => {
  assert.equal(nombreInicial("cliente", alta), "Hugo Peralta");
  assert.equal(nombreInicial("identificador", alta), "AB 123 CD");
  assert.equal(nombreInicial("servicio", alta), "Frenos");
});

test("se recortan los espacios de lo que escribió el mostrador", () => {
  assert.equal(nombreInicial("cliente", { cliente: "  Hugo Peralta  " }), "Hugo Peralta");
});

test("si el dato elegido está vacío, nace sin nombre en vez de con uno en blanco", () => {
  assert.equal(nombreInicial("identificador", { ...alta, identificador: "" }), null);
  assert.equal(nombreInicial("identificador", { ...alta, identificador: "   " }), null);
  assert.equal(nombreInicial("cliente", {}), null);
});

test("un negocio de antes de esta opción, sin nada elegido, sigue como siempre", () => {
  // La columna nace con "numero" por defecto, pero un negocio del modo de
  // ejemplo guardado antes no la tiene: llega undefined.
  assert.equal(nombreInicial(undefined, alta), null);
  assert.equal(nombreInicial("cualquier-cosa", alta), null);
});

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
// El nombre es interno: el cliente no lo ve
// ---------------------------------------------------------------

test("el link de seguimiento no le muestra al cliente el nombre del caso", () => {
  // Alguien del negocio le puede poner al caso un nombre que no es para el
  // cliente. Lo que sale en el link es una lista cerrada de campos
  // (CAMPOS_PUBLICOS), y el nombre no está: sigue viendo "Caso 271".
  const publico = casoPublico({
    codigo: "abc123",
    negocio: { id: "n1", nombre: "Taller Sur", rubro: "taller" },
    casos: [
      {
        id: "c1",
        negocio_id: "n1",
        numero: 271,
        nombre: "El cliente que nunca paga",
        cliente_id: "k1",
        servicio: "Frenos",
        estado: "en_proceso",
        seguimiento_codigo: "abc123",
      },
    ],
    clientes: [{ id: "k1", nombre: "Hugo Peralta" }],
  });

  assert.equal(publico.sirve, true);
  assert.equal(publico.numero, 271);
  assert.equal("nombre" in publico, false);
  assert.equal(JSON.stringify(publico).includes("El cliente que nunca paga"), false);
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
