import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { CSS_APARIENCIA, DE_FABRICA, limpiar, pintar } from "../src/lib/tema.js";

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

test("cajas y rebordes: lo inválido vuelve a de fábrica, y el reborde en degradé va detrás del interior", () => {
  const ap = limpiar({ caja: { modo: "degrade", c1: "azul", c2: "fucsia", patron: "radial" }, reborde: { modo: "base", c1: "verde" } });
  assert.equal(ap.caja.c2, "violeta");
  assert.equal(ap.reborde.modo, "base");

  const raiz = { attrs: {}, vars: {} };
  raiz.setAttribute = (k, v) => (raiz.attrs[k] = v);
  raiz.removeAttribute = (k) => delete raiz.attrs[k];
  raiz.style = { setProperty: (k, v) => (raiz.vars[k] = v), removeProperty: (k) => delete raiz.vars[k] };
  pintar(ap, raiz);
  assert.equal(raiz.attrs["data-cajas"], "reborde");
  assert.match(raiz.vars["--caja"], /^radial-gradient\(.*14%.*\) padding-box, .* padding-box, linear-gradient\(135deg, #2f9e5f, #2f9e5f\) border-box$/);

  pintar(DE_FABRICA, raiz);
  assert.equal(raiz.attrs["data-cajas"], undefined);
});
