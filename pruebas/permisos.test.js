// Correr con: npm test
//
// Los permisos de la interfaz: el mismo catálogo que la base (053_roles.sql)
// y la API (src/compartido/permisos.ts). Si acá sobra un permiso, se ofrece un
// botón que la base va a rechazar; si falta, se esconde algo que sí se podía.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GRUPOS, PERMISOS, PERMISOS_DE_MIRAR, QUIEN_PUEDE, puede, queCambiaConElRol } from "../src/lib/permisos.js";

const claves = PERMISOS.map((p) => p.clave);

test("son las mismas 23 claves que la 053, en el mismo orden", () => {
  const sql = readFileSync(new URL("../supabase/053_roles.sql", import.meta.url), "utf8");
  const bloque = sql.slice(sql.indexOf("function permisos_conocidos()"), sql.indexOf("]::text[]"));
  assert.deepEqual(claves, [...bloque.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));
});

test("cada permiso tiene grupo, nombre, descripción y su frase de por qué no", () => {
  for (const p of PERMISOS) {
    assert.ok(GRUPOS.includes(p.grupo), `${p.clave}: grupo desconocido`);
    assert.ok(p.nombre && p.descripcion, `${p.clave}: falta el texto`);
    assert.ok(QUIEN_PUEDE[p.clave], `${p.clave}: falta QUIEN_PUEDE`);
  }
});

test("los de mirar están en el catálogo", () => {
  for (const c of PERMISOS_DE_MIRAR) assert.ok(claves.includes(c), c);
});

test("el Dueño puede todo, aunque su lista venga vacía", () => {
  for (const c of claves) assert.equal(puede({ es_duenio: true, permisos: [] }, c), true, c);
});

test("los demás, sólo lo de su lista", () => {
  const q = { es_duenio: false, permisos: ["cobrar"] };
  assert.equal(puede(q, "cobrar"), true);
  assert.equal(puede(q, "crear_casos"), false);
});

test("sin usuario (la cuenta todavía no cargó) no se ofrece nada", () => {
  assert.equal(puede(null, "configurar_negocio"), false);
  assert.equal(puede(undefined, "cobrar"), false);
  assert.equal(puede({}, "cobrar"), false);
});

test("una clave que no existe no habilita nada", () => {
  assert.equal(puede({ es_duenio: false, permisos: ["borrar_todo"] }, "borrar_todo"), false);
});

test("qué gana y qué pierde alguien al cambiar de rol", () => {
  const { gana, pierde } = queCambiaConElRol(
    { es_duenio: false, permisos: ["cobrar", "ver_agenda"] },
    { es_duenio: false, permisos: ["ver_agenda", "crear_casos"] }
  );
  assert.deepEqual(gana, [PERMISOS.find((p) => p.clave === "crear_casos").descripcion]);
  assert.deepEqual(pierde, [PERMISOS.find((p) => p.clave === "cobrar").descripcion]);
});

test("pasar a Dueño gana todo lo que no tenía", () => {
  const { gana, pierde } = queCambiaConElRol({ es_duenio: false, permisos: ["cobrar"] }, { es_duenio: true, permisos: [] });
  assert.equal(gana.length, 22);
  assert.equal(pierde.length, 0);
});
