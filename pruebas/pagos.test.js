// Correr con: npm run test:unit
//
// La puerta hacia la API de pagos (src/lib/pagos.js), probada contra una API
// de mentira: lo que se manda, cómo se autentica y qué se le dice a la
// persona cuando algo sale mal. El contrato está en docs/api-pagos.md.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import {
  apiPagosApuntaAlFrontend,
  pagosEnLinea,
  vueltaDeMercadoPago,
} from "../src/lib/pagos.js";
import { hayPagosEnCamino, mensajeDePago, montoParaPedir, cuentaDelCaso } from "../src/lib/cobros.js";

const API = "https://api.ejemplo";

// ------------------------------------------------------------
// Si se puede pedir un pago
// ------------------------------------------------------------

test("sin API no se puede, y se dice por qué", () => {
  const r = pagosEnLinea({ api: null });
  assert.equal(r.disponible, false);
  assert.ok(r.motivo);
});

test("con la API configurada, es de verdad", () => {
  assert.deepEqual(pagosEnLinea({ api: API }), {
    disponible: true,
    motivo: null,
  });
});

test("una URL de Vercel de la app no se toma por la API de pagos", () => {
  const equivocada = "https://tp-ing-software-2026c2.vercel.app";
  assert.equal(apiPagosApuntaAlFrontend(equivocada), true);
  assert.equal(pagosEnLinea({ api: equivocada }).disponible, false);
  assert.equal(apiPagosApuntaAlFrontend("https://tp-ingesoft-api.onrender.com/payments"), false);
});

// ------------------------------------------------------------
// Lo que usa la pantalla
// ------------------------------------------------------------

test("se ofrece pedir lo que falta, sin volver a pedir lo que ya se está esperando", () => {
  const cuenta = cuentaDelCaso({
    aprobado: 80000,
    cobros: [
      { monto: 20000, estado: "pagado", medio: "efectivo" },
      { monto: 30000, estado: "pendiente", medio: "link" },
    ],
  });
  assert.equal(montoParaPedir(cuenta), 30000);
  assert.equal(montoParaPedir(cuentaDelCaso({ aprobado: 100, cobros: [{ monto: 100, estado: "pagado" }] })), null);
});

test("se pregunta a la base sólo mientras haya un pago en línea esperando", () => {
  assert.equal(hayPagosEnCamino([{ estado: "pendiente", medio: "link" }]), true);
  assert.equal(hayPagosEnCamino([{ estado: "pendiente", medio: "qr" }]), true);
  assert.equal(hayPagosEnCamino([{ estado: "pagado", medio: "link" }]), false);
  assert.equal(hayPagosEnCamino([{ estado: "pagado", medio: "efectivo" }]), false);
  assert.equal(hayPagosEnCamino([]), false);
});

test("el mensaje de WhatsApp dice quién cobra, cuánto y dónde pagar", () => {
  const m = mensajeDePago({ negocio: "Taller Sur", cliente: "Marcela Suárez", monto: 60000, link: "https://pago/x" });
  assert.equal(m, "Hola Marcela. Te escribimos de Taller Sur. Podés pagar los $60.000 desde acá: https://pago/x");
  assert.match(mensajeDePago({ monto: 1, link: "l" }), /^Hola\. Podés pagar/);
});

// ------------------------------------------------------------
// Pagar desde el seguimiento (sin sesión)
// ------------------------------------------------------------


// Mercado Pago, después de vincular, vuelve siempre a /casos?mp=conectado.
// Desde ahí se manda a la persona a donde había tocado "Vincular".
test("quien vinculó desde Mi negocio vuelve a Integraciones", () => {
  assert.equal(vueltaDeMercadoPago("negocio"), "/negocio?mp=conectado#integraciones");
});

test("quien vinculó desde un caso vuelve a los cobros de ese caso", () => {
  const id = "3f2b8c1e-0a4d-4e5f-9b6a-1c2d3e4f5a6b";
  assert.equal(vueltaDeMercadoPago(id), `/casos/${id}?mp=conectado#cobros`);
});

test("sin saber de dónde salió, o con algo raro anotado, se queda en Casos", () => {
  assert.equal(vueltaDeMercadoPago(null), null);
  assert.equal(vueltaDeMercadoPago("//otro-sitio.com"), null);
  assert.equal(vueltaDeMercadoPago("../perfil"), null);
});
