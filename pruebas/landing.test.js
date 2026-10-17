// Correr con: npm run test:unit -- pruebas/landing.test.js
//
// La landing de cada negocio (docs/landing-por-negocio.md): lo que se guarda,
// cómo se completa al leerlo, el orden de las secciones, los colores que se
// leen y lo que se le pasa a Lienzo.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import {
  BLANCO,
  PARTES,
  PRESET,
  TINTA,
  cambiarColor,
  cambiarTexto,
  contraste,
  esDeFabrica,
  estadoDeSecciones,
  moverSeccion,
  normalizarLanding,
  seLee,
  textoRecomendado,
  variablesDeColor,
  variablesDeFuente,
} from "../src/lib/landing.js";

test("una landing que nunca se tocó es la de fábrica", () => {
  assert.deepEqual(normalizarLanding(null), PRESET);
  assert.deepEqual(normalizarLanding(undefined), PRESET);
  assert.deepEqual(normalizarLanding("cualquier cosa"), PRESET);
  assert.equal(esDeFabrica(null), true);
});

test("normalizar no cambia la de fábrica guardada a mano", () => {
  const copia = JSON.parse(JSON.stringify(PRESET));
  assert.deepEqual(normalizarLanding(copia), PRESET);
  assert.equal(esDeFabrica(copia), true);
});

test("un orden viejo suma al final las secciones que faltan y saca las que no existen", () => {
  const { orden } = normalizarLanding({ orden: ["mis_casos", "inventada", "mis_casos"] });
  assert.deepEqual(orden, ["mis_casos", "negocio", "sacar_turno", "mis_turnos"]);
});

test("un color mal escrito o una fuente que no existe caen en la de fábrica", () => {
  const l = normalizarLanding({
    colores: { fondo: { color: "rojo", texto: "#FFD400" } },
    fuente: "comic-sans",
  });
  assert.equal(l.colores.fondo.color, PRESET.colores.fondo.color);
  assert.equal(l.colores.fondo.texto, "#ffd400");
  assert.deepEqual(l.colores.botones, PRESET.colores.botones);
  assert.equal(l.fuente, "fabrica");
  assert.equal(esDeFabrica(l), false);
});

test("subir y bajar una sección; en las puntas no se mueve", () => {
  const orden = ["a", "b", "c"];
  assert.deepEqual(moverSeccion(orden, "b", -1), ["b", "a", "c"]);
  assert.deepEqual(moverSeccion(orden, "b", 1), ["a", "c", "b"]);
  assert.deepEqual(moverSeccion(orden, "a", -1), ["a", "b", "c"]);
  assert.deepEqual(moverSeccion(orden, "c", 1), ["a", "b", "c"]);
  assert.deepEqual(orden, ["a", "b", "c"]);
});

test("sin Agenda, las secciones de turnos no aparecen y dicen por qué", () => {
  const sinAgenda = estadoDeSecciones(PRESET.orden, []);
  const turno = sinAgenda.find((s) => s.clave === "sacar_turno");
  assert.equal(turno.visible, false);
  assert.equal(turno.motivo, "Aparece cuando prendés el módulo Agenda.");
  assert.equal(sinAgenda.find((s) => s.clave === "mis_turnos").visible, false);
  assert.equal(sinAgenda.find((s) => s.clave === "mis_casos").visible, true);
  assert.equal(sinAgenda.find((s) => s.clave === "mis_casos").motivo, null);
  assert.ok(estadoDeSecciones(PRESET.orden, ["agenda"]).every((s) => s.visible));
});

test("las secciones salen en el orden elegido", () => {
  const orden = ["mis_turnos", "mis_casos", "sacar_turno", "negocio"];
  assert.deepEqual(estadoDeSecciones(orden, ["agenda"]).map((s) => s.clave), orden);
});

test("el contraste es el de WCAG: de 1 a 21", () => {
  assert.equal(contraste("#000000", "#ffffff").toFixed(1), "21.0");
  assert.equal(contraste("#ffffff", "#000000").toFixed(1), "21.0");
  assert.equal(contraste("#1f4e8c", "#1f4e8c").toFixed(1), "1.0");
  // Valores del medio: las puntas dan 21 y 1 con cualquier luminancia, aunque
  // le falte la corrección de gamma.
  assert.equal(contraste("#767676", "#ffffff").toFixed(2), "4.54");
  assert.equal(contraste("#1f4e8c", "#ffffff").toFixed(2), "8.31");
});

test("el texto recomendado es el que más se lee", () => {
  assert.equal(textoRecomendado("#ffffff"), TINTA);
  assert.equal(textoRecomendado("#1f4e8c"), BLANCO);
  assert.equal(textoRecomendado("#ffd400"), TINTA);
  assert.equal(textoRecomendado("#112233"), BLANCO);
  // Cerca del cruce: contra negro puro ganaría el oscuro; contra la tinta de
  // la app, que es un poco más clara, gana el blanco.
  assert.equal(textoRecomendado("#767676"), BLANCO);
});

test("se lee desde 4,5:1, el mínimo de WCAG AA", () => {
  assert.equal(seLee("#767676", BLANCO), true);
  assert.equal(seLee("#777777", BLANCO), false);
});

test("en la de fábrica, cada texto es el recomendado y se lee", () => {
  for (const { clave } of PARTES) {
    const { color, texto } = PRESET.colores[clave];
    assert.equal(texto, textoRecomendado(color), clave);
    assert.equal(seLee(color, texto), true, clave);
  }
});

test("blanco sobre amarillo no se lee", () => {
  assert.equal(seLee("#ffd400", BLANCO), false);
  assert.equal(seLee("#ffd400", TINTA), true);
});

test("cambiar un color lleva el texto al recomendado, salvo que el dueño haya elegido otro", () => {
  const oscuro = cambiarColor(PRESET, "fondo", "#112233");
  assert.deepEqual(oscuro.colores.fondo, { color: "#112233", texto: BLANCO });
  assert.equal(PRESET.colores.fondo.color, "#fbf8f4");

  const elegido = cambiarTexto(PRESET, "fondo", "#ff0000");
  assert.deepEqual(cambiarColor(elegido, "fondo", "#112233").colores.fondo, { color: "#112233", texto: "#ff0000" });
});

test("las variables de color pisan las de la app con las del negocio", () => {
  const v = variablesDeColor(PRESET);
  assert.equal(v["--color-fondo"], "#fbf8f4");
  assert.equal(v["--color-tinta"], TINTA);
  assert.equal(v["--color-tarjeta"], "#ffffff");
  assert.equal(v["--lienzo-cajas-texto"], TINTA);
  assert.equal(v["--color-azul"], "#1f4e8c");
  assert.equal(v["--color-white"], BLANCO);
  assert.equal(v["--color-terracota"], "#9a3d1e");
  assert.equal(v["--lienzo-acento-texto"], BLANCO);
  assert.match(v["--color-tinta-suave"], /^color-mix\(in oklab, #241f1b 70%, #fbf8f4\)$/);
});

test("la fuente de fábrica no pisa nada; las otras, títulos y texto", () => {
  assert.deepEqual(variablesDeFuente(PRESET), {});
  const lora = variablesDeFuente({ ...PRESET, fuente: "lora" });
  assert.equal(lora["--font-titulo"], 'var(--fuente-landing), "Segoe UI", system-ui, sans-serif');
  assert.equal(lora["--font-cuerpo"], lora["--font-titulo"]);
});
