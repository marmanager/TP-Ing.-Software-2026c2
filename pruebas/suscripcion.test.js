// Correr con: npm run test:unit
//
// Cuándo se bloquea el sistema por la suscripción (src/lib/suscripcion.js).

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { bloquea, RUTAS_SIN_SUSCRIPCION, urlDePago } from "../src/lib/suscripcion.js";

test("se bloquea sólo cuando la API dice que no hay acceso", () => {
  assert.equal(bloquea({ activa: false, motivo: null }), true);
  assert.equal(bloquea({ activa: true, motivo: "pago" }), false);
  assert.equal(bloquea({ activa: true, motivo: "acceso_libre" }), false);
});

test("si la API no contestó, se deja pasar", () => {
  assert.equal(bloquea(null), false);
  assert.equal(bloquea(undefined), false);
});

test("sin suscripción se llega a donde se paga y se cambia de negocio", () => {
  assert.deepEqual(RUTAS_SIN_SUSCRIPCION, ["/perfil", "/negocios", "/crear-negocio"]);
});

test("al pago sólo se va por https", () => {
  assert.equal(urlDePago("https://www.mercadopago.com.ar/subscriptions/checkout?x=1"), "https://www.mercadopago.com.ar/subscriptions/checkout?x=1");
  assert.equal(urlDePago("http://mercadopago.test"), null);
  assert.equal(urlDePago("javascript:alert(1)"), null);
  assert.equal(urlDePago(undefined), null);
});
