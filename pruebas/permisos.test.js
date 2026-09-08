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
import { PERMISOS, puede, quienEscribe } from "../src/lib/permisos.js";

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

// ---------------------------------------------------------------
// Quién firma el historial
// ---------------------------------------------------------------
// Se testea porque la rama de Supabase no se puede recorrer a mano:
// hace falta una cuenta con ficha de empleado en un negocio real.

test("en el modo de ejemplo firma quien está mirando", () => {
  assert.equal(quienEscribe({ esDemo: true }), "Vos");
});

test("firma con el nombre de la ficha de empleado, que es como lo llama el negocio", () => {
  const nombre = quienEscribe({
    usuario: { id: "u1", email: "diego.perez@gmail.com", nombre: "Diego Pérez López" },
    empleados: [{ id: "e1", usuario_id: "u1", nombre: "Diego" }],
  });
  assert.equal(nombre, "Diego");
});

test("sin ficha vale el nombre de la cuenta: el dueño no necesita ficha", () => {
  const nombre = quienEscribe({
    usuario: { id: "u1", email: "ana@taller.com", nombre: "Ana" },
    empleados: [{ id: "e1", usuario_id: "otro", nombre: "Diego" }],
  });
  assert.equal(nombre, "Ana");
});

test("sin nombre en ningún lado, el mail hasta el arroba", () => {
  const nombre = quienEscribe({ usuario: { id: "u1", email: "marcela.suarez@gmail.com" } });
  assert.equal(nombre, "marcela.suarez");
});

test("nunca firma en blanco: una firma vacía se lee como un olvido del sistema", () => {
  assert.equal(quienEscribe(), "Alguien del negocio");
  assert.equal(quienEscribe({ usuario: { id: "u1" } }), "Alguien del negocio");
  assert.equal(quienEscribe({ usuario: { id: "u1", email: "" } }), "Alguien del negocio");
  assert.equal(
    quienEscribe({
      usuario: { id: "u1", email: "a@b.com", nombre: "   " },
      empleados: [{ usuario_id: "u1", nombre: "  " }],
    }),
    "a"
  );
});
