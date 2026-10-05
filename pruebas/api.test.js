// Correr con: npm run test:unit
//
// La frontera con la API (src/lib/api.js), probada contra una API de
// mentira: qué se manda, qué se devuelve y, sobre todo, qué se le dice a la
// persona cuando algo sale mal. El contrato está en docs/api.md.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import {
  alVencerLaSesion,
  api,
  mandar,
  nuevaClave,
  parchar,
  quitar,
  raizDeLaApi,
  reemplazar,
  recursosPrendidos,
  traer,
  usaLaApi,
} from "../src/lib/api.js";

const BASE = "https://api.ejemplo/v1";

// Una API de mentira: anota lo que le llegó y contesta lo que se le diga.
function apiFalsa(estado, cuerpo, { cabeceras = {}, sinJson = false } = {}) {
  const llamadas = [];
  const fetcher = async (url, opciones) => {
    llamadas.push({ url, ...opciones, cuerpo: opciones.body ? JSON.parse(opciones.body) : undefined });
    return {
      ok: estado >= 200 && estado < 300,
      status: estado,
      headers: { get: (n) => cabeceras[n] ?? null },
      json: async () => {
        if (sinJson) throw new Error("no es json");
        return cuerpo;
      },
    };
  };
  return { fetcher, llamadas };
}

const ok = (datos, extra = {}) => ({ ok: true, datos, ...extra });

// ------------------------------------------------------------
// Lo que se manda
// ------------------------------------------------------------

test("manda el método, el cuerpo y la sesión de la persona", async () => {
  const { fetcher, llamadas } = apiFalsa(201, ok({ id: "i1" }));
  const r = await mandar("/insumos", { nombre: "Filtro", cantidad: 2 }, "jwt", { base: BASE, fetcher });

  assert.deepEqual(r, { ok: true, datos: { id: "i1" } });
  assert.equal(llamadas[0].url, `${BASE}/insumos`);
  assert.equal(llamadas[0].method, "POST");
  assert.equal(llamadas[0].headers.Authorization, "Bearer jwt");
  assert.deepEqual(llamadas[0].cuerpo, { nombre: "Filtro", cantidad: 2 });
});

test("sin sesión no manda la cabecera vacía", async () => {
  const { fetcher, llamadas } = apiFalsa(200, ok({}));
  await api("/publico/seguimiento/abc", { base: BASE, fetcher });
  assert.equal(llamadas[0].headers.Authorization, undefined);
});

test("la clave de idempotencia viaja sólo si se la pasan", async () => {
  const { fetcher, llamadas } = apiFalsa(200, ok({}));
  await mandar("/cobros", { monto: 1 }, "t", { base: BASE, fetcher, idempotencia: "clave-1" });
  await mandar("/cobros", { monto: 1 }, "t", { base: BASE, fetcher });
  assert.equal(llamadas[0].headers["Idempotency-Key"], "clave-1");
  assert.equal(llamadas[1].headers["Idempotency-Key"], undefined);
});

test("cada clave de idempotencia es distinta", () => {
  assert.notEqual(nuevaClave(), nuevaClave());
});

test("traer, parchar y quitar usan el método que corresponde", async () => {
  const { fetcher, llamadas } = apiFalsa(200, ok({}));
  await traer("/casos", "t", { base: BASE, fetcher });
  await parchar("/casos/1", { nombre: "x" }, "t", { base: BASE, fetcher });
  await quitar("/insumos/1", "t", { base: BASE, fetcher });
  assert.equal(llamadas[0].method, "GET");
  assert.equal(llamadas[1].method, "PATCH");
  assert.equal(llamadas[2].method, "DELETE");
  await reemplazar("/negocio/horarios", { dias: ["lun"] }, "t", { base: BASE, fetcher });
  assert.equal(llamadas[3].method, "PUT");
  assert.deepEqual(llamadas[3].cuerpo, { dias: ["lun"] });
  assert.equal(llamadas[2].body, undefined);
  assert.equal(llamadas[2].headers.Authorization, "Bearer t");
});

// ------------------------------------------------------------
// La dirección y el interruptor
// ------------------------------------------------------------

test("la raíz sale igual con /payments, /v1 o con la raíz", () => {
  const raiz = "https://tp-ingesoft-api.onrender.com";
  assert.equal(raizDeLaApi(`${raiz}/payments`), raiz);
  assert.equal(raizDeLaApi(`${raiz}/payments/`), raiz);
  assert.equal(raizDeLaApi(`${raiz}/v1`), raiz);
  assert.equal(raizDeLaApi(`${raiz}/v1/`), raiz);
  assert.equal(raizDeLaApi(` ${raiz}/ `), raiz);
  assert.equal(raizDeLaApi(raiz), raiz);
});

test("sin dirección no hay raíz", () => {
  assert.equal(raizDeLaApi(""), null);
  assert.equal(raizDeLaApi(undefined), null);
});

test("los recursos prendidos se leen de una lista, sin importar mayúsculas ni espacios", () => {
  assert.deepEqual([...recursosPrendidos(" Inventario , turnos,,")], ["inventario", "turnos"]);
  assert.equal(recursosPrendidos("").size, 0);
  assert.equal(recursosPrendidos(undefined).size, 0);
});

test("un recurso pasa por la API sólo si está prendido y hay dirección", () => {
  const prendidos = recursosPrendidos("inventario");
  assert.equal(usaLaApi("inventario", { prendidos, base: BASE }), true);
  assert.equal(usaLaApi("turnos", { prendidos, base: BASE }), false);
  assert.equal(usaLaApi("inventario", { prendidos, base: null }), false);
});

// ------------------------------------------------------------
// Lo que se devuelve
// ------------------------------------------------------------

test("una lista viaja con su cursor para pedir la página siguiente", async () => {
  const { fetcher } = apiFalsa(200, { ok: true, datos: [{ id: "a" }], siguiente: "cursor-1" });
  const r = await traer("/casos?limite=1", "t", { base: BASE, fetcher });
  assert.deepEqual(r, { ok: true, datos: [{ id: "a" }], siguiente: "cursor-1" });
});

test("los campos que no conocemos no molestan: la API puede agregar sin romper nada", async () => {
  const { fetcher } = apiFalsa(200, ok({ id: "c1", prioridad: "alta", lo_que_venga: 1 }));
  const r = await traer("/casos/c1", "t", { base: BASE, fetcher });
  assert.equal(r.datos.prioridad, "alta");
});

test("nunca devuelve 'reintentable': eso es cosa de adentro", async () => {
  const { fetcher } = apiFalsa(500, null);
  const r = await traer("/casos", "t", { base: BASE, fetcher, reintentar: false });
  assert.deepEqual(Object.keys(r).sort(), ["error", "ok"]);
});

// ------------------------------------------------------------
// Los errores
// ------------------------------------------------------------

test("el mensaje que escribió la API llega tal cual, con su código y su campo", async () => {
  const { fetcher } = apiFalsa(422, {
    ok: false,
    error: { codigo: "monto_invalido", mensaje: "El monto va con números, sin puntos, y mayor que cero.", campo: "monto" },
  });
  const r = await mandar("/cobros", {}, "t", { base: BASE, fetcher });
  assert.equal(r.ok, false);
  assert.equal(r.error.codigo, "monto_invalido");
  assert.equal(r.error.mensaje, "El monto va con números, sin puntos, y mayor que cero.");
  assert.equal(r.error.campo, "monto");
});

test("los detalles de una validación con varios campos también viajan", async () => {
  const { fetcher } = apiFalsa(422, {
    ok: false,
    error: {
      codigo: "faltan_datos",
      mensaje: "Faltan 2 datos.",
      detalles: [{ campo: "nombre", mensaje: "Falta tu nombre." }, { campo: "telefono", mensaje: "Falta el teléfono." }],
    },
  });
  const r = await mandar("/clientes", {}, "t", { base: BASE, fetcher });
  assert.equal(r.error.detalles.length, 2);
});

test("si la API no explica nada, la frase la pone el front según el código", async () => {
  const casos = [
    [401, /sesión venció/],
    [403, /permiso/],
    [404, /ya no está/],
    [409, /Alguien más/],
    [429, /un minuto/],
    [500, /Probá de nuevo en un rato/],
  ];
  for (const [estado, esperado] of casos) {
    const { fetcher } = apiFalsa(estado, null);
    const r = await api("/casos", { base: BASE, fetcher, reintentar: false });
    assert.match(r.error.mensaje, esperado, `estado ${estado}`);
  }
});

test("una respuesta que no es JSON —un error de un proxy— no rompe nada", async () => {
  const { fetcher } = apiFalsa(502, null, { sinJson: true });
  const r = await api("/casos", { base: BASE, fetcher, reintentar: false });
  assert.equal(r.ok, false);
  assert.match(r.error.mensaje, /Probá de nuevo/);
});

test("un 200 que no dice ok no cuenta como bueno", async () => {
  const { fetcher } = apiFalsa(200, { datos: { id: "x" } });
  const r = await traer("/casos/x", "t", { base: BASE, fetcher });
  assert.equal(r.ok, false);
});

test("sin internet se dice qué hacer, no qué pasó", async () => {
  const caida = async () => {
    throw new Error("Failed to fetch");
  };
  const r = await traer("/casos", "t", { base: BASE, fetcher: caida });
  assert.equal(r.error.codigo, "sin_conexion");
  assert.match(r.error.mensaje, /internet/);
});

test("el identificador del pedido se guarda, para poder rastrear el problema", async () => {
  const { fetcher } = apiFalsa(500, null, { cabeceras: { "x-request-id": "abc-123" } });
  const r = await api("/casos", { base: BASE, fetcher, reintentar: false });
  assert.equal(r.error.pedido, "abc-123");
});

test("sin API configurada no se llama a nada y se dice por qué", async () => {
  const { fetcher, llamadas } = apiFalsa(200, ok({}));
  const r = await traer("/casos", "t", { base: null, fetcher });
  assert.equal(r.error.codigo, "sin_api");
  assert.equal(llamadas.length, 0);
});

// ------------------------------------------------------------
// Reintentos: lo que se puede repetir y lo que no
// ------------------------------------------------------------

test("un GET perdido se repite una sola vez", async () => {
  let intentos = 0;
  const fetcher = async () => {
    intentos++;
    throw new Error("red");
  };
  await traer("/casos", "t", { base: BASE, fetcher });
  assert.equal(intentos, 2);
});

test("un POST sin clave de idempotencia NO se repite: podría cobrar dos veces", async () => {
  let intentos = 0;
  const fetcher = async () => {
    intentos++;
    throw new Error("red");
  };
  await mandar("/cobros", { monto: 60000 }, "t", { base: BASE, fetcher });
  assert.equal(intentos, 1);
});

test("con clave de idempotencia sí se repite: la API devuelve lo mismo", async () => {
  let intentos = 0;
  const fetcher = async () => {
    intentos++;
    throw new Error("red");
  };
  await mandar("/cobros", { monto: 60000 }, "t", { base: BASE, fetcher, idempotencia: "clave-1" });
  assert.equal(intentos, 2);
});

test("un pedido mal hecho no se repite: daría el mismo error", async () => {
  const { fetcher, llamadas } = apiFalsa(422, { ok: false, error: { codigo: "x", mensaje: "Mal." } });
  await traer("/casos", "t", { base: BASE, fetcher });
  assert.equal(llamadas.length, 1);
});

// ------------------------------------------------------------
// La sesión vencida
// ------------------------------------------------------------

test("un 401 avisa una vez para que la aplicación cierre la sesión", async () => {
  let avisos = 0;
  alVencerLaSesion(() => avisos++);
  const { fetcher } = apiFalsa(401, { ok: false, error: { codigo: "sesion_vencida", mensaje: "Tu sesión venció." } });
  await traer("/casos", "t", { base: BASE, fetcher });
  assert.equal(avisos, 1);
  alVencerLaSesion(null);
});

test("sin nadie enganchado, un 401 no explota", async () => {
  const { fetcher } = apiFalsa(401, null);
  const r = await traer("/casos", "t", { base: BASE, fetcher });
  assert.equal(r.ok, false);
});
