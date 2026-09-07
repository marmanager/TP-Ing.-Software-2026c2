// Correr con: npm test
//
// Los permisos de la interfaz. Tienen que decir lo mismo que las políticas de
// supabase/007_permisos.sql: si acá sobra un permiso, se ofrece un botón que
// la base va a rechazar; si falta, se esconde algo que sí se podía hacer.
//
// Un typo en una clave devolvería "false" en silencio, que es justo lo que
// estas pruebas tienen que atajar.

import { test } from "node:test";
import assert from "node:assert/strict";
import { PERMISOS, puede } from "../src/lib/permisos.js";

const ROLES = ["duenio", "encargado", "tecnico"];
const ACCIONES = ["configurarNegocio", "manejarEquipo", "verTodosLosCasos", "cargarDatos"];

test("los tres roles definen las cuatro acciones", () => {
  for (const rol of ROLES) {
    for (const accion of ACCIONES) {
      assert.equal(
        typeof PERMISOS[rol][accion],
        "boolean",
        `falta ${rol}.${accion}`
      );
    }
  }
});

test("el dueño puede todo", () => {
  for (const accion of ACCIONES) {
    assert.equal(puede("duenio", accion), true, `el dueño debería poder ${accion}`);
  }
});

test("el encargado trabaja pero no configura ni suma gente", () => {
  assert.equal(puede("encargado", "cargarDatos"), true);
  assert.equal(puede("encargado", "verTodosLosCasos"), true);
  assert.equal(puede("encargado", "configurarNegocio"), false);
  assert.equal(puede("encargado", "manejarEquipo"), false);
});

test("el técnico sólo ve lo suyo y no carga nada", () => {
  for (const accion of ACCIONES) {
    assert.equal(puede("tecnico", accion), false, `el técnico no debería poder ${accion}`);
  }
});

// El modo de ejemplo no tiene cuenta: es un sandbox para recorrer todo.
test("sin rol se juega como dueño, para el modo de ejemplo", () => {
  assert.equal(puede(undefined, "configurarNegocio"), true);
  assert.equal(puede(null, "manejarEquipo"), true);
});

test("una acción que no existe no habilita nada", () => {
  assert.equal(puede("duenio", "borrarTodo"), false);
  assert.equal(puede("inventado", "cargarDatos"), false);
});
