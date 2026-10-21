// Correr con: npm test
//
// Cómo se elige el idioma (cookie, navegador, castellano) y cómo se busca un
// texto en el diccionario (docs/idiomas.md).

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { elegirIdioma, traducir, textoDeError, cookieDeIdioma } from "../src/lib/idioma.js";

test("la cookie manda si es un idioma conocido", () => {
  assert.equal(elegirIdioma("en", "es-AR,es;q=0.9"), "en");
  assert.equal(elegirIdioma("es", "en-US"), "es");
});

test("una cookie desconocida se ignora", () => {
  assert.equal(elegirIdioma("xx", "en-US,en;q=0.9"), "en");
});

test("sin cookie decide el navegador, por peso q y sin región", () => {
  assert.equal(elegirIdioma(undefined, "en-GB,en;q=0.9"), "en");
  assert.equal(elegirIdioma(undefined, "es-MX"), "es");
  assert.equal(elegirIdioma(undefined, "en;q=0.5,es;q=0.8"), "es");
  assert.equal(elegirIdioma(undefined, "fr-FR,fr;q=0.9,en;q=0.7"), "en");
});

test("sin nada conocido, castellano", () => {
  assert.equal(elegirIdioma(undefined, "fr-FR,fr;q=0.9"), "es");
  assert.equal(elegirIdioma(undefined, null), "es");
  assert.equal(elegirIdioma(undefined, ""), "es");
  assert.equal(elegirIdioma(undefined, "en;q=0"), "es");
});

const es = {
  ingreso: { titulo: "Iniciar sesión", hola: "Hola, {nombre}", soloEs: "Sólo acá" },
  casos: { cuantos: { one: "{n} caso", other: "{n} casos" } },
  errores: { sin_permiso: "No tenés permiso para hacer eso." },
};
const en = {
  ingreso: { titulo: "Sign in", hola: "Hi, {nombre}" },
  casos: { cuantos: { one: "{n} case", other: "{n} cases" } },
};
const enIngles = { diccionario: en, base: es, locale: "en-US" };
const enCastellano = { diccionario: es, base: null, locale: "es-AR" };

test("busca por clave con puntos e interpola", () => {
  assert.equal(traducir(enIngles, "ingreso.titulo"), "Sign in");
  assert.equal(traducir(enIngles, "ingreso.hola", { nombre: "Ana" }), "Hi, Ana");
  assert.equal(traducir(enCastellano, "ingreso.hola", { nombre: "Ana" }), "Hola, Ana");
});

test("una variable que no se pasó queda escrita, no como undefined", () => {
  assert.equal(traducir(enIngles, "ingreso.hola"), "Hi, {nombre}");
});

test("plural según el idioma", () => {
  assert.equal(traducir(enIngles, "casos.cuantos", { n: 1 }), "1 case");
  assert.equal(traducir(enIngles, "casos.cuantos", { n: 3 }), "3 cases");
  assert.equal(traducir(enCastellano, "casos.cuantos", { n: 0 }), "0 casos");
});

test("lo que falta en inglés se ve en castellano", () => {
  assert.equal(traducir(enIngles, "ingreso.soloEs"), "Sólo acá");
});

test("lo que falta en los dos devuelve siFalta, o la clave", () => {
  assert.equal(traducir(enIngles, "no.existe"), "no.existe");
  assert.equal(traducir(enIngles, "no.existe", {}, "Otro texto"), "Otro texto");
});

test("un error se traduce por código y, si no se conoce, muestra su mensaje", () => {
  const t = (clave, vars, siFalta) => traducir(enCastellano, clave, vars, siFalta);
  assert.equal(textoDeError(t, { codigo: "sin_permiso", mensaje: "x" }), "No tenés permiso para hacer eso.");
  assert.equal(textoDeError(t, { codigo: "algo_nuevo", mensaje: "Lo dijo la API" }), "Lo dijo la API");
  assert.equal(textoDeError(t, { mensaje: "Sin código" }), "Sin código");
  assert.equal(textoDeError(t, null), "");
  assert.equal(textoDeError(t, "Texto suelto"), "Texto suelto");
});

test("la cookie dura un año y vale para toda la app", () => {
  assert.equal(cookieDeIdioma("en"), "idioma=en; path=/; max-age=31536000; samesite=lax");
});
