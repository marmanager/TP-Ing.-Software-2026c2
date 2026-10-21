// Correr con: npm run test:unit
//
// La suscripción en el front (src/lib/suscripcion.js): cuándo se bloquea,
// cómo se muestran los planes y cuánto le queda a la prueba.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import {
  agruparPlanes,
  ahorroAnual,
  bloquea,
  diasQueQuedan,
  monto,
  RUTAS_SIN_SUSCRIPCION,
  urlDePago,
} from "../src/lib/suscripcion.js";

const PRECIOS = [
  { id: 1, plan: "Básico", descripcion: "a", periodo: "mensual", usd: 20, ars: 29000 },
  { id: 2, plan: "Básico", descripcion: "a", periodo: "anual", usd: 200, ars: 290000 },
  { id: 3, plan: "Pro", descripcion: "b", periodo: "mensual", usd: 100, ars: null },
  { id: 4, plan: "Pro", descripcion: "b", periodo: "anual", usd: 1000, ars: null },
];

test("se bloquea sólo cuando la API dice que no hay acceso", () => {
  assert.equal(bloquea({ activa: false, motivo: null }), true);
  for (const motivo of ["pago", "prueba", "acceso_libre"]) assert.equal(bloquea({ activa: true, motivo }), false);
});

test("si la API no contestó, se deja pasar", () => {
  assert.equal(bloquea(null), false);
  assert.equal(bloquea(undefined), false);
});

test("sin suscripción se llega a los planes, a la prueba, al perfil y a cambiar de negocio", () => {
  for (const ruta of ["/planes", "/prueba", "/perfil", "/negocios", "/crear-negocio"]) {
    assert.ok(RUTAS_SIN_SUSCRIPCION.includes(ruta), ruta);
  }
  assert.ok(!RUTAS_SIN_SUSCRIPCION.includes("/casos"));
});

test("al pago sólo se va por https", () => {
  assert.equal(urlDePago("https://www.mercadopago.com.ar/x?y=1"), "https://www.mercadopago.com.ar/x?y=1");
  assert.equal(urlDePago("http://mercadopago.test"), null);
  assert.equal(urlDePago("javascript:alert(1)"), null);
  assert.equal(urlDePago(undefined), null);
});

test("los precios se juntan por plan, el más barato primero aunque lleguen al revés", () => {
  const esperado = [["Básico", 1, 2], ["Pro", 3, 4]];
  assert.deepEqual(agruparPlanes(PRECIOS).map((p) => [p.plan, p.mensual.id, p.anual.id]), esperado);
  assert.deepEqual(agruparPlanes([...PRECIOS].reverse()).map((p) => [p.plan, p.mensual.id, p.anual.id]), esperado);
  assert.deepEqual(agruparPlanes(undefined), []);
});

test("el monto va en la moneda elegida; en pesos sin cotización, no hay", () => {
  assert.equal(monto(PRECIOS[0], "USD"), "USD 20");
  assert.equal(monto(PRECIOS[0], "ARS"), "$ 29.000");
  assert.equal(monto(PRECIOS[2], "ARS"), null);
  assert.equal(monto(null, "USD"), null);
});

test("el anual ahorra dos meses frente a pagar mes a mes", () => {
  assert.equal(ahorroAnual(PRECIOS[0], PRECIOS[1], "USD"), "USD 40");
  assert.equal(ahorroAnual(PRECIOS[0], PRECIOS[1], "ARS"), "$ 58.000");
  assert.equal(ahorroAnual(PRECIOS[2], PRECIOS[3], "ARS"), null);
  assert.equal(ahorroAnual(PRECIOS[0], null, "USD"), null);
});

test("los días de prueba se redondean para arriba y nunca son negativos", () => {
  const ahora = Date.parse("2026-10-20T12:00:00Z");
  assert.equal(diasQueQuedan("2026-11-19T12:00:00Z", ahora), 30);
  assert.equal(diasQueQuedan("2026-10-21T00:00:00Z", ahora), 1);
  assert.equal(diasQueQuedan("2026-10-19T12:00:00Z", ahora), 0);
  assert.equal(diasQueQuedan(null, ahora), 0);
});
