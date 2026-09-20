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
  montoCobrado,
  cobroValido,
  faltantesDelAlta,
  motivoDeFaltantes,
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

// El cobro no se valida con montoValido: ese exige mayor que cero, porque un
// paso del presupuesto que no cuesta nada no es un paso. El cobro juega
// distinto, y la diferencia es la que importa en SCRUM-74:
//
//   vacío → no se registró cobro acá (se cobra afuera, o todavía no se cobró)
//   cero  → se entregó y no se cobró nada (garantía, cortesía, obra social)
//
// Guardar las dos como 0 borraría esa diferencia, y es plata.
test("el campo vacío no registra ningún cobro", () => {
  assert.equal(montoCobrado(""), null);
  assert.equal(montoCobrado("   "), null, "espacios sueltos tampoco son un cobro");
});

test("cobrar cero no es lo mismo que no registrar nada", () => {
  assert.equal(montoCobrado("0"), 0);
});

test("el monto cobrado se guarda como número", () => {
  assert.equal(montoCobrado("120000"), 120000);
  assert.equal(montoCobrado(" 74000 "), 74000, "se recortan los espacios");
});

test("el cobro acepta que no haya monto, pero no acepta cualquier cosa", () => {
  assert.equal(cobroValido(""), true, "entregar sin registrar cobro se puede");
  assert.equal(cobroValido("0"), true);
  assert.equal(cobroValido("120000"), true);
  assert.equal(cobroValido("120.000"), false, "sin puntos, como el resto del sistema");
  assert.equal(cobroValido("-500"), false);
  assert.equal(cobroValido("ciento veinte mil"), false);
});

// ---------------------------------------------------------------
// Qué falta en el alta de un caso
// ---------------------------------------------------------------

const completo = {
  nombre: "Marcela Suárez",
  telefono: "341 456 7890",
  identificador: "AB 123 CD",
  servicio: "Frenos",
};

test("con todo cargado no falta nada y el botón se prende", () => {
  const faltan = faltantesDelAlta(completo, "la patente");
  assert.deepEqual(faltan, []);
  assert.equal(motivoDeFaltantes(faltan), null);
});

test("si falta uno solo, el botón dice cuál", () => {
  const faltan = faltantesDelAlta({ ...completo, identificador: "" }, "el DNI");
  assert.equal(motivoDeFaltantes(faltan), "falta el DNI");
});

test("si faltan varios, el botón dice cuántos y se sabe cuáles marcar", () => {
  const faltan = faltantesDelAlta({ nombre: "", telefono: "", identificador: "", servicio: "" }, "la patente");
  assert.equal(motivoDeFaltantes(faltan), "faltan 4 datos");
  assert.deepEqual(
    faltan.map((f) => f.campo),
    ["cliente", "telefono", "identificador", "servicio"]
  );
});

test("un teléfono mal escrito cuenta como faltante", () => {
  const faltan = faltantesDelAlta({ ...completo, telefono: "0341 15 456" }, "la patente");
  assert.equal(motivoDeFaltantes(faltan), "falta el teléfono");
});

test("los espacios solos no cuentan como dato", () => {
  const faltan = faltantesDelAlta({ ...completo, nombre: "   " }, "la patente");
  assert.equal(motivoDeFaltantes(faltan), "falta el nombre");
});
