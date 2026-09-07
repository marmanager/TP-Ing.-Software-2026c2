// Correr con: npm test
//
// Las validaciones de los formularios de entrada. Son texto plano sin React,
// así que se prueban directo; el resto de las pantallas se mira en pantalla.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  telefonoValido,
  emailValido,
  contrasenaValida,
  montoValido,
} from "../src/lib/validaciones.js";

test("el teléfono va con característica, sin el 0 ni el 15", () => {
  assert.equal(telefonoValido("341 456 7890"), true);
  assert.equal(telefonoValido("3414567890"), true);
  assert.equal(telefonoValido("11 5555 1234"), true);
  assert.equal(telefonoValido("0341 15 456789"), false, "sobran dígitos");
  assert.equal(telefonoValido("456 7890"), false, "faltan dígitos");
  assert.equal(telefonoValido("0111234567"), false, "no arranca en 0");
  assert.equal(telefonoValido(""), false);
});

test("el mail necesita arroba y un punto después", () => {
  assert.equal(emailValido("ana@taller.com"), true);
  assert.equal(emailValido("ana.perez@taller.com.ar"), true);
  assert.equal(emailValido("  ana@taller.com  "), true, "se recortan los espacios");
  assert.equal(emailValido("ana@taller"), false);
  assert.equal(emailValido("ana taller.com"), false);
  assert.equal(emailValido("@taller.com"), false);
  assert.equal(emailValido(""), false);
});

test("la contraseña necesita al menos 8 caracteres", () => {
  assert.equal(contrasenaValida("12345678"), true);
  assert.equal(contrasenaValida("1234567"), false);
  assert.equal(contrasenaValida(""), false);
});

test("el monto va con números y sin puntos", () => {
  assert.equal(montoValido("120000"), true);
  assert.equal(montoValido(" 74000 "), true);
  assert.equal(montoValido("120.000"), false, "con puntos no: la cartilla pide sin puntos");
  assert.equal(montoValido("120,50"), false);
  assert.equal(montoValido("ciento veinte mil"), false);
  assert.equal(montoValido("0"), false, "un paso que no cuesta nada no es un paso");
  assert.equal(montoValido("-500"), false);
  assert.equal(montoValido(""), false);
});
