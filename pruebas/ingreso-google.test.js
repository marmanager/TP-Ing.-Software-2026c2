// Correr con: npm run test:unit
//
// Entrar con Google (src/lib/ingreso-google.js): de dónde sale el nombre y
// qué se le dice a la persona cuando Google no la deja entrar.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import {
  errorAlSalirHaciaGoogle,
  errorDelIngreso,
  googleActivado,
  nombreDeLaCuenta,
} from "../src/lib/ingreso-google.js";

test("con mail y contraseña, el nombre es el que escribió en el formulario", () => {
  assert.equal(nombreDeLaCuenta({ nombre: "Marcela Suárez", full_name: "Otro" }), "Marcela Suárez");
});

test("con Google, el nombre viene de la cuenta de Google", () => {
  assert.equal(nombreDeLaCuenta({ full_name: "Marcela Suárez" }), "Marcela Suárez");
  assert.equal(nombreDeLaCuenta({ name: "Marcela" }), "Marcela");
});

test("sin nombre, no se inventa uno", () => {
  assert.equal(nombreDeLaCuenta({}), null);
  assert.equal(nombreDeLaCuenta({ full_name: "   " }), null);
  assert.equal(nombreDeLaCuenta(undefined), null);
});

test("una vuelta normal de Google no es un error", () => {
  assert.equal(errorDelIngreso("http://localhost:3000/iniciar-sesion#access_token=abc&type=bearer"), null);
  assert.equal(errorDelIngreso("http://localhost:3000/iniciar-sesion"), null);
});

test("si cancela en Google, se le dice sin tecnicismos", () => {
  const m = errorDelIngreso("http://localhost:3000/iniciar-sesion?error=access_denied&error_description=The+user+denied");
  assert.match(m, /No se completó el ingreso con Google/);
});

test("el error puede venir en el # en vez de en el ?", () => {
  assert.ok(errorDelIngreso("http://localhost:3000/iniciar-sesion#error=server_error&error_description=x"));
});

test("si Google no está activado en Supabase, se dice qué hacer mientras tanto", () => {
  const vuelta = errorDelIngreso(
    "http://localhost:3000/iniciar-sesion?error=validation_failed&error_description=Unsupported+provider%3A+provider+is+not+enabled"
  );
  assert.match(vuelta, /todavía no está activado/);
  assert.match(errorAlSalirHaciaGoogle({ message: "Unsupported provider: provider is not enabled" }), /todavía no está activado/);
});

test("ningún mensaje muestra el texto técnico que manda Supabase", () => {
  const m = errorDelIngreso("http://x/iniciar-sesion?error=server_error&error_description=Database+error+saving+new+user");
  assert.ok(!/Database|server_error/.test(m));
  assert.equal(errorDelIngreso("no es una url"), null);
});


test("el botón aparece sólo si Google está activado en Supabase", () => {
  assert.equal(googleActivado({ google: true, email: true }), true);
  assert.equal(googleActivado({ google: false, email: true }), false);
  assert.equal(googleActivado(null), false, "si no se pudo consultar, no se muestra");
});
