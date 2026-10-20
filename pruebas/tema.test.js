import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { CSS_APARIENCIA, DE_FABRICA, limpiar } from "../src/lib/tema.js";

test("lo guardado que no existe más vuelve a lo de fábrica, campo por campo", () => {
  assert.deepEqual(limpiar(null), DE_FABRICA);
  assert.deepEqual(limpiar({ tema: "oscuro", letra: "comic", acento: "verde" }), {
    ...DE_FABRICA,
    tema: "oscuro",
    acento: "verde",
  });
});

test("el color de botones en oscuro devuelve el sólido donde va de fondo lleno", () => {
  assert.match(CSS_APARIENCIA, /\[data-tema="oscuro"\]\[data-acento="verde"\] \.bg-azul\{--color-azul:#1d6b3f\}/);
});
