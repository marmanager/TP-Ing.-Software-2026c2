// Correr con: npm test
//
// El castellano es la fuente: el inglés no puede tener claves que el
// castellano no tenga (serían textos que nadie ve), y un plural tiene que
// traer "one" y "other".

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import es from "../src/lib/idiomas/es.js";
import en from "../src/lib/idiomas/en.js";

const esPlural = (v) => v && typeof v === "object" && "other" in v;

function claves(o, prefijo = "") {
  return Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" && !esPlural(v) ? claves(v, `${prefijo}${k}.`) : [`${prefijo}${k}`]
  );
}

function valor(o, clave) {
  return clave.split(".").reduce((x, k) => x?.[k], o);
}

test("toda clave en inglés existe en castellano", () => {
  const deEs = new Set(claves(es));
  const sobran = claves(en).filter((c) => !deEs.has(c));
  assert.deepEqual(sobran, []);
});

test("cada plural trae one y other, en los dos idiomas", () => {
  for (const dicc of [es, en]) {
    for (const c of claves(dicc)) {
      const v = valor(dicc, c);
      if (typeof v === "object") {
        assert.equal(typeof v.one, "string", `${c} sin one`);
        assert.equal(typeof v.other, "string", `${c} sin other`);
      }
    }
  }
});

test("los códigos de error de api.js están en los dos idiomas", () => {
  for (const codigo of ["sesion_vencida", "sin_permiso", "no_esta", "choque", "datos_invalidos", "muchos_intentos", "sin_conexion", "error_interno", "sin_api"]) {
    assert.equal(typeof es.errores[codigo], "string", `es sin ${codigo}`);
    assert.equal(typeof en.errores[codigo], "string", `en sin ${codigo}`);
  }
});
