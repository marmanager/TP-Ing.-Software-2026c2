// Correr con: npm run test:unit
//
// El vocabulario de cada rubro: las palabras que cambian de un oficio a otro
// en botones, títulos y menús.
//
// Lo que más se cuida es la concordancia. Un "Guardar la repuesto" o un
// "Nuevo pieza" en un botón se ve, y en un sistema que se vende por hablar
// como el mostrador es peor que dejarlo en genérico.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { RUBROS, formas, mayuscula, vocabulario } from "../src/lib/presets.js";

// ---------- cada rubro tiene sus palabras ----------

test("cada rubro nombra lo que tiene en stock", () => {
  for (const r of RUBROS) {
    const a = r.palabras?.articulo;
    assert.ok(a, `${r.clave} no dice cómo se llama lo que tiene en stock`);
    assert.ok(a.uno && a.varios, `${r.clave}: le falta el singular o el plural`);
    assert.ok(["m", "f"].includes(a.genero), `${r.clave}: género inválido "${a.genero}"`);
  }
});

test("todos los rubros tienen las mismas palabras", () => {
  // Si un rubro suma una palabra y otro no, la pantalla que la use se rompe
  // en el que no la tiene.
  const claves = (r) => Object.keys(r.palabras ?? {}).sort().join(",");
  const primero = claves(RUBROS[0]);
  for (const r of RUBROS) {
    assert.equal(claves(r), primero, `${r.clave} tiene palabras distintas que ${RUBROS[0].clave}`);
  }
});

test("un taller tiene productos y un consultorio, insumos", () => {
  assert.equal(vocabulario("taller").articulo.palabra(2), "productos");
  assert.equal(vocabulario("medicina").articulo.palabra(2), "insumos");
  assert.equal(vocabulario("service").articulo.palabra(2), "productos");
});

test("un rubro que no existe cae en el taller, como el resto del preset", () => {
  assert.equal(vocabulario("loquesea").articulo.palabra(), "producto");
  assert.equal(vocabulario(undefined).articulo.palabra(), "producto");
});

// ---------- las formas, con una palabra masculina ----------

const repuesto = formas({ uno: "repuesto", varios: "repuestos", genero: "m" });

test("masculino: con artículo indefinido y definido", () => {
  assert.equal(repuesto.un(), "un repuesto");
  assert.equal(repuesto.el(), "el repuesto");
  assert.equal(repuesto.el(3), "los repuestos");
});

test("masculino: contado", () => {
  assert.equal(repuesto.cuantos(1), "1 repuesto");
  assert.equal(repuesto.cuantos(3), "3 repuestos");
  assert.equal(repuesto.cuantos(0), "0 repuestos");
});

test("masculino: la concordancia elige la primera forma", () => {
  assert.equal(repuesto.segun("Nuevo", "Nueva"), "Nuevo");
});

// ---------- las formas, con una palabra femenina ----------
//
// Ningún preset usa hoy una palabra femenina, y por eso mismo hay que
// probarla: el día que un taller prefiera "pieza", esto no puede salir con
// "un pieza".

const pieza = formas({ uno: "pieza", varios: "piezas", genero: "f" });

test("femenino: con artículo indefinido y definido", () => {
  assert.equal(pieza.un(), "una pieza");
  assert.equal(pieza.el(), "la pieza");
  assert.equal(pieza.el(2), "las piezas");
});

test("femenino: contado", () => {
  assert.equal(pieza.cuantos(1), "1 pieza");
  assert.equal(pieza.cuantos(2), "2 piezas");
});

test("femenino: la concordancia elige la segunda forma", () => {
  assert.equal(pieza.segun("Nuevo", "Nueva"), "Nueva");
  assert.equal(pieza.segun("pedidos", "pedidas"), "pedidas");
});

// ---------- plural irregular ----------

test("el plural es el que está escrito, no uno calculado", () => {
  // "análisis" no cambia en plural; sumarle una "s" daría "análisiss".
  const analisis = formas({ uno: "análisis", varios: "análisis", genero: "m" });
  assert.equal(analisis.cuantos(3), "3 análisis");
  assert.equal(analisis.el(3), "los análisis");
});

// ---------- mayúscula ----------

test("la mayúscula va sólo en la primera letra", () => {
  assert.equal(mayuscula("repuestos en camino"), "Repuestos en camino");
});

test("la mayúscula respeta la tilde", () => {
  assert.equal(mayuscula("órdenes"), "Órdenes");
});

test("la mayúscula de algo vacío no rompe", () => {
  assert.equal(mayuscula(""), "");
  assert.equal(mayuscula(undefined), undefined);
});
