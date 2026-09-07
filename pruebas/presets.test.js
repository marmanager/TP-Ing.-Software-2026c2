// Correr con: npm test
//
// Los presets y sus módulos: que cada rubro renombre los cinco estados y que
// los módulos que trae existan en el catálogo. El resto se mira en pantalla.

import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESETS, RUBROS, preset } from "../src/lib/presets.js";
import { MODULOS } from "../src/lib/modulos.js";
import { ORDEN_ESTADOS } from "../src/lib/estados.js";

test("hay tres rubros: taller, medicina y service", () => {
  assert.deepEqual(
    RUBROS.map((r) => r.clave),
    ["taller", "medicina", "service"]
  );
});

test("cada preset renombra los cinco estados con una palabra no vacía", () => {
  for (const r of RUBROS) {
    for (const estado of ORDEN_ESTADOS) {
      assert.equal(typeof r.etiquetas[estado], "string", `${r.clave} sin etiqueta para ${estado}`);
      assert.ok(r.etiquetas[estado].trim().length > 0, `${r.clave}.${estado} está vacío`);
    }
  }
});

test("los módulos que trae cada preset existen en el catálogo", () => {
  for (const r of RUBROS) {
    assert.ok(Array.isArray(r.modulos), `${r.clave} no tiene lista de módulos`);
    assert.ok(r.modulos.length > 0, `${r.clave} no trae ningún módulo`);
    for (const m of r.modulos) {
      assert.ok(MODULOS[m], `${r.clave} trae un módulo desconocido: ${m}`);
    }
  }
});

test("un rubro desconocido o vacío cae en taller", () => {
  assert.equal(preset("no_existe").clave, "taller");
  assert.equal(preset(undefined).clave, "taller");
  assert.equal(preset(null).clave, "taller");
});

test("ya no existe el preset veterinaria", () => {
  assert.equal(PRESETS.veterinaria, undefined);
});
