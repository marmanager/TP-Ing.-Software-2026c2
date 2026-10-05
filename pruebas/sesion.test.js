// Correr con: npm run test:unit
//
// El almacén propio de la sesión (src/lib/sesion.js): leer la sesión que
// Supabase deja en el fragmento de la URL, guardarla en el navegador sin que
// un storage roto tumbe la pantalla, y renovar el token una sola vez aunque
// lo pidan varias partes de la pantalla a la vez.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import {
  LLAVE,
  borrar,
  guardar,
  leer,
  sesionDeRespuesta,
  sesionDelFragmento,
  sesionParaLaApp,
  tokenVigente,
} from "../src/lib/sesion.js";

// Un localStorage de mentira: un Map con la misma cara.
function storageFalso(inicial = {}) {
  const m = new Map(Object.entries(inicial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    m,
  };
}

const roto = {
  getItem() {
    throw new Error("SecurityError");
  },
  setItem() {
    throw new Error("QuotaExceededError");
  },
  removeItem() {
    throw new Error("SecurityError");
  },
};

// ------------------------------------------------------------
// El fragmento
// ------------------------------------------------------------

test("del fragmento sale la sesión, sin el token de Google", () => {
  const s = sesionDelFragmento("#access_token=a&refresh_token=r&expires_at=100&type=recovery&provider_token=p");
  assert.deepEqual(s, { token: "a", refresh_token: "r", vence_en: 100, recuperando: true });
});

test("un fragmento que no es de recuperación no marca recuperando", () => {
  const s = sesionDelFragmento("#access_token=a&refresh_token=r&expires_at=100&type=signup");
  assert.equal(s.recuperando, false);
});

test("sin access_token no hay sesión", () => {
  assert.equal(sesionDelFragmento("#refresh_token=r&expires_at=100"), null);
  assert.equal(sesionDelFragmento(""), null);
});

test("un fragmento con error no es una sesión", () => {
  assert.equal(sesionDelFragmento("#error=access_denied"), null);
  assert.equal(sesionDelFragmento("#access_token=a&error=access_denied"), null);
});

test("adapta la respuesta de la API a la forma que usa la aplicación", () => {
  const propia = sesionDeRespuesta({
    token: "a",
    refresh_token: "r",
    vence_en: 100,
    auth_usuario: { id: "u1", email: "ana@ejemplo.com" },
  });
  assert.deepEqual(sesionParaLaApp(propia), {
    access_token: "a",
    refresh_token: "r",
    expires_at: 100,
    user: { id: "u1", email: "ana@ejemplo.com" },
  });
});

// ------------------------------------------------------------
// Guardar y leer
// ------------------------------------------------------------

test("lo que se guarda se lee igual", () => {
  const storage = storageFalso();
  const s = { token: "a", refresh_token: "r", vence_en: 100 };
  guardar(storage, s);
  assert.deepEqual(leer(storage), s);
  assert.ok(storage.m.has(LLAVE));
});

test("sin nada guardado, leer da null", () => {
  assert.equal(leer(storageFalso()), null);
});

test("borrar deja el storage sin sesión", () => {
  const storage = storageFalso();
  guardar(storage, { token: "a" });
  borrar(storage);
  assert.equal(leer(storage), null);
});

test("un storage que tira no explota: leer da null", () => {
  assert.equal(leer(roto), null);
  assert.equal(guardar(roto, { token: "a" }), null);
  assert.equal(borrar(roto), null);
});

test("algo guardado que no es JSON se lee como null", () => {
  assert.equal(leer(storageFalso({ [LLAVE]: "{roto" })), null);
});

// ------------------------------------------------------------
// El token vigente
// ------------------------------------------------------------

const AHORA = 1000;

function renovarFalso(resultado) {
  const llamadas = [];
  const renovar = async (refresh) => {
    llamadas.push(refresh);
    await new Promise((r) => setTimeout(r, 5));
    return resultado;
  };
  return { renovar, llamadas };
}

test("con el token vigente no se renueva", async () => {
  const storage = storageFalso();
  guardar(storage, { token: "a", refresh_token: "r", vence_en: AHORA + 3600 });
  const { renovar, llamadas } = renovarFalso({ ok: true, datos: { token: "b", refresh_token: "r2", vence_en: AHORA + 7200 } });

  assert.equal(await tokenVigente({ storage, ahora: AHORA, renovar }), "a");
  assert.equal(llamadas.length, 0);
});

test("por vencer, tres pedidos a la vez renuevan una sola vez y reciben el token nuevo", async () => {
  const storage = storageFalso();
  guardar(storage, { token: "a", refresh_token: "r", vence_en: AHORA + 30 });
  const nueva = { token: "b", refresh_token: "r2", vence_en: AHORA + 3600 };
  const { renovar, llamadas } = renovarFalso({ ok: true, datos: nueva });

  const tokens = await Promise.all([1, 2, 3].map(() => tokenVigente({ storage, ahora: AHORA, renovar })));

  assert.deepEqual(tokens, ["b", "b", "b"]);
  assert.deepEqual(llamadas, ["r"]);
  assert.deepEqual(leer(storage), { token: "b", refresh_token: "r2", vence_en: AHORA + 3600 });
});

test("al renovar conserva el usuario y que la sesión era de recuperación", async () => {
  const storage = storageFalso();
  guardar(storage, {
    token: "a", refresh_token: "r", vence_en: AHORA - 1,
    auth_usuario: { id: "u1" }, recuperando: true,
  });
  const { renovar } = renovarFalso({
    ok: true,
    datos: { token: "b", refresh_token: "r2", vence_en: AHORA + 3600 },
  });

  assert.equal(await tokenVigente({ storage, ahora: AHORA, renovar }), "b");
  assert.deepEqual(leer(storage), {
    token: "b", refresh_token: "r2", vence_en: AHORA + 3600,
    auth_usuario: { id: "u1" }, recuperando: true,
  });
});

test("si renovar falla, no hay token y el storage queda vacío", async () => {
  const storage = storageFalso();
  guardar(storage, { token: "a", refresh_token: "r", vence_en: AHORA - 10 });
  const { renovar } = renovarFalso({ ok: false, error: { codigo: "sesion_vencida", mensaje: "Tu sesión venció." } });

  assert.equal(await tokenVigente({ storage, ahora: AHORA, renovar }), null);
  assert.equal(storage.getItem(LLAVE), null);
});

test("lee el storage en cada pedido: usa lo que renovó otra pestaña", async () => {
  const storage = storageFalso();
  guardar(storage, { token: "a", refresh_token: "r", vence_en: AHORA + 3600 });
  assert.equal(await tokenVigente({ storage, ahora: AHORA }), "a");

  guardar(storage, { token: "b", refresh_token: "r2", vence_en: AHORA + 3600 });
  assert.equal(await tokenVigente({ storage, ahora: AHORA }), "b");
});

test("sin sesión guardada no hay token ni renovación", async () => {
  const { renovar, llamadas } = renovarFalso({ ok: true, datos: { token: "b" } });
  assert.equal(await tokenVigente({ storage: storageFalso(), ahora: AHORA, renovar }), null);
  assert.equal(llamadas.length, 0);
});
