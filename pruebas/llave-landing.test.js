// Correr con: npm run test:unit -- pruebas/llave-landing.test.js
//
// La llave con la que el cliente de un negocio vuelve a ver lo suyo en la
// landing (src/lib/llave-landing.js): se guarda en el navegador por código de
// landing, vence sola y un storage bloqueado se comporta como uno vacío.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { borrarLlave, guardarLlave, leerLlave } from "../src/lib/llave-landing.js";

// Un sessionStorage de mentira: un Map con la misma cara.
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

const AHORA = Date.parse("2026-10-18T12:00:00Z");
const EN_UNA_HORA = "2026-10-18T13:00:00+00:00";
const HACE_UNA_HORA = "2026-10-18T11:00:00+00:00";

test("lo guardado se lee de vuelta", () => {
  const storage = storageFalso();
  guardarLlave("abc12345", { llave: "L".repeat(64), vence_en: EN_UNA_HORA }, { storage });
  assert.equal(leerLlave("abc12345", { storage, ahora: AHORA }), "L".repeat(64));
});

test("se guarda con la clave del código de la landing", () => {
  const storage = storageFalso();
  guardarLlave("abc12345", { llave: "L1", vence_en: EN_UNA_HORA }, { storage });
  assert.deepEqual([...storage.m.keys()], ["marmanager.landing.abc12345"]);
});

test("cada landing tiene la suya: entrar en una no abre la otra", () => {
  const storage = storageFalso();
  guardarLlave("abc12345", { llave: "L1", vence_en: EN_UNA_HORA }, { storage });
  guardarLlave("zzz98765", { llave: "L2", vence_en: EN_UNA_HORA }, { storage });
  assert.equal(leerLlave("abc12345", { storage, ahora: AHORA }), "L1");
  assert.equal(leerLlave("zzz98765", { storage, ahora: AHORA }), "L2");
  borrarLlave("abc12345", { storage });
  assert.equal(leerLlave("abc12345", { storage, ahora: AHORA }), null);
  assert.equal(leerLlave("zzz98765", { storage, ahora: AHORA }), "L2");
});

test("sin nada guardado no hay llave", () => {
  assert.equal(leerLlave("abc12345", { storage: storageFalso(), ahora: AHORA }), null);
});

test("una llave vencida no se devuelve, ni justo en el instante en que vence", () => {
  const storage = storageFalso();
  guardarLlave("abc12345", { llave: "L1", vence_en: HACE_UNA_HORA }, { storage });
  assert.equal(leerLlave("abc12345", { storage, ahora: AHORA }), null);

  guardarLlave("abc12345", { llave: "L1", vence_en: "2026-10-18T12:00:00+00:00" }, { storage });
  assert.equal(leerLlave("abc12345", { storage, ahora: AHORA }), null);
  assert.equal(leerLlave("abc12345", { storage, ahora: AHORA - 1 }), "L1");
});

test("una fecha de vencimiento que no se entiende cuenta como vencida", () => {
  const storage = storageFalso();
  guardarLlave("abc12345", { llave: "L1", vence_en: "cuando sea" }, { storage });
  assert.equal(leerLlave("abc12345", { storage, ahora: AHORA }), null);
});

test("borrar saca la llave y borrar sin nada no molesta", () => {
  const storage = storageFalso();
  guardarLlave("abc12345", { llave: "L1", vence_en: EN_UNA_HORA }, { storage });
  borrarLlave("abc12345", { storage });
  assert.equal(storage.m.size, 0);
  borrarLlave("abc12345", { storage });
});

test("guardar de nuevo pisa la anterior", () => {
  const storage = storageFalso();
  guardarLlave("abc12345", { llave: "vieja", vence_en: EN_UNA_HORA }, { storage });
  guardarLlave("abc12345", { llave: "nueva", vence_en: EN_UNA_HORA }, { storage });
  assert.equal(leerLlave("abc12345", { storage, ahora: AHORA }), "nueva");
});

test("sin llave no se guarda nada", () => {
  const storage = storageFalso();
  assert.equal(guardarLlave("abc12345", { vence_en: EN_UNA_HORA }, { storage }), false);
  assert.equal(guardarLlave("abc12345", undefined, { storage }), false);
  assert.equal(storage.m.size, 0);
});

test("lo guardado que está roto no tumba nada: es como no tener llave", () => {
  for (const crudo of ["{no es json", "null", "42", '{"llave":42,"vence_en":"2099-01-01"}']) {
    const storage = storageFalso({ "marmanager.landing.abc12345": crudo });
    assert.equal(leerLlave("abc12345", { storage, ahora: AHORA }), null, crudo);
  }
});

test("un storage bloqueado se comporta como uno vacío", () => {
  assert.equal(leerLlave("abc12345", { storage: roto, ahora: AHORA }), null);
  assert.equal(guardarLlave("abc12345", { llave: "L1", vence_en: EN_UNA_HORA }, { storage: roto }), false);
  assert.doesNotThrow(() => borrarLlave("abc12345", { storage: roto }));
});

test("sin sessionStorage (el servidor, un navegador sin permisos) tampoco explota", () => {
  assert.equal(leerLlave("abc12345"), null);
  assert.equal(guardarLlave("abc12345", { llave: "L1", vence_en: EN_UNA_HORA }), false);
  assert.doesNotThrow(() => borrarLlave("abc12345"));
});
