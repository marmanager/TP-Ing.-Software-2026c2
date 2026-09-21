// Correr con: npm run test:unit
//
// La puerta hacia la API de pagos (src/lib/pagos.js), probada contra una API
// de mentira: lo que se manda, cómo se autentica y qué se le dice a la
// persona cuando algo sale mal. El contrato está en docs/api-pagos.md.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import {
  anularPagoEnLinea,
  pagarDesdeSeguimiento,
  pagosEnLinea,
  pedirPagoEnLinea,
} from "../src/lib/pagos.js";
import { hayPagosEnCamino, mensajeDePago, montoParaPedir, cuentaDelCaso } from "../src/lib/cobros.js";

const API = "https://api.ejemplo";

// Una API de mentira que anota lo que le llegó y contesta lo que se le diga.
function apiFalsa(status, cuerpo) {
  const llamadas = [];
  const fetcher = async (url, opciones) => {
    llamadas.push({ url, ...opciones, cuerpo: JSON.parse(opciones.body) });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (cuerpo === undefined) throw new Error("sin cuerpo");
        return cuerpo;
      },
    };
  };
  return { fetcher, llamadas };
}

// ------------------------------------------------------------
// Si se puede pedir un pago
// ------------------------------------------------------------

test("sin API y con Supabase, no se puede, y se dice por qué", () => {
  const r = pagosEnLinea({ esDemo: false, api: null });
  assert.equal(r.disponible, false);
  assert.ok(r.motivo);
});

test("con la API configurada, es de verdad", () => {
  assert.deepEqual(pagosEnLinea({ esDemo: false, api: API }), {
    disponible: true,
    simulado: false,
    motivo: null,
  });
});

test("en el modo de ejemplo se simula, aunque haya API", () => {
  assert.equal(pagosEnLinea({ esDemo: true, api: API }).simulado, true);
  assert.equal(pagosEnLinea({ esDemo: true, api: null }).disponible, true);
});

// ------------------------------------------------------------
// Pedir un pago
// ------------------------------------------------------------

test("pide el pago con la sesión de la persona, no con una clave del servidor", async () => {
  const cobro = { id: "x", estado: "pendiente", link: "https://pago/x" };
  const { fetcher, llamadas } = apiFalsa(201, { ok: true, cobro });
  const r = await pedirPagoEnLinea({ casoId: "c1", monto: "60000", medio: "link", token: "jwt", api: API, fetcher });

  assert.deepEqual(r, { ok: true, cobro });
  assert.equal(llamadas[0].url, `${API}/cobros`);
  assert.equal(llamadas[0].method, "POST");
  assert.equal(llamadas[0].headers.Authorization, "Bearer jwt");
  assert.deepEqual(llamadas[0].cuerpo, { caso_id: "c1", monto: 60000, medio: "link" });
});

test("lo que contesta la API con palabras llega tal cual", async () => {
  const { fetcher } = apiFalsa(422, { ok: false, motivo: "Ese caso ya está cobrado." });
  const r = await pedirPagoEnLinea({ casoId: "c1", monto: 1, medio: "link", token: "t", api: API, fetcher });
  assert.deepEqual(r, { ok: false, error: "Ese caso ya está cobrado." });
});

test("sesión vencida o sin permiso: una frase que diga qué hacer", async () => {
  const vencida = await pedirPagoEnLinea({ casoId: "c1", monto: 1, medio: "link", token: "t", api: API, fetcher: apiFalsa(401).fetcher });
  assert.match(vencida.error, /sesión venció/);
  const sinPermiso = await pedirPagoEnLinea({ casoId: "c1", monto: 1, medio: "link", token: "t", api: API, fetcher: apiFalsa(403).fetcher });
  assert.match(sinPermiso.error, /dueño o el encargado/);
});

test("si la API no contesta, no explota", async () => {
  const caida = async () => {
    throw new Error("red");
  };
  const r = await pedirPagoEnLinea({ casoId: "c1", monto: 1, medio: "qr", token: "t", api: API, fetcher: caida });
  assert.equal(r.ok, false);
  assert.match(r.error, /conexión/);
});

test("un 200 que no dice ok no cuenta como pedido", async () => {
  const r = await pedirPagoEnLinea({ casoId: "c1", monto: 1, medio: "qr", token: "t", api: API, fetcher: apiFalsa(200, {}).fetcher });
  assert.equal(r.ok, false);
});

test("sin API no se llama a nada", async () => {
  const { fetcher, llamadas } = apiFalsa(200, { ok: true });
  const r = await pedirPagoEnLinea({ casoId: "c1", monto: 1, medio: "link", token: "t", api: null, fetcher });
  assert.equal(r.ok, false);
  assert.equal(llamadas.length, 0);
});

test("anular un pedido va a la API, para que el link deje de servir", async () => {
  const { fetcher, llamadas } = apiFalsa(200, { ok: true, cobro: { id: "x/1", estado: "anulado" } });
  const r = await anularPagoEnLinea({ cobroId: "x/1", motivo: "Pagó en efectivo", token: "t", api: API, fetcher });
  assert.equal(r.ok, true);
  assert.equal(llamadas[0].url, `${API}/cobros/x%2F1/anular`);
  assert.deepEqual(llamadas[0].cuerpo, { motivo: "Pagó en efectivo" });
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


test("desde el seguimiento no se manda sesión ni monto: sólo el código", async () => {
  const { fetcher, llamadas } = apiFalsa(200, { ok: true, link: "https://pago/y" });
  const r = await pagarDesdeSeguimiento({ codigo: "abc", api: API, fetcher });
  assert.deepEqual(r, { ok: true, link: "https://pago/y" });
  assert.equal(llamadas[0].url, `${API}/seguimiento/abc/pagos`);
  assert.equal(llamadas[0].headers.Authorization, undefined);
  assert.deepEqual(llamadas[0].cuerpo, {});
});

test("sin API, el cliente lee que puede pagar en el local", async () => {
  const r = await pagarDesdeSeguimiento({ codigo: "abc", api: null });
  assert.equal(r.ok, false);
  assert.match(r.error, /en el local/);
});

test("una respuesta sin link no manda al cliente a ningún lado", async () => {
  const r = await pagarDesdeSeguimiento({ codigo: "abc", api: API, fetcher: apiFalsa(200, { ok: true }).fetcher });
  assert.equal(r.ok, false);
});
