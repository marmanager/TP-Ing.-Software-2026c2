// Correr con: npm test
//
// Los permisos de la interfaz: el mismo catálogo que la base (053_roles.sql)
// y la API (src/compartido/permisos.ts). Si acá sobra un permiso, se ofrece un
// botón que la base va a rechazar; si falta, se esconde algo que sí se podía.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GRUPOS, PERMISOS, PERMISOS_DE_MIRAR, QUIEN_PUEDE, conImplicados, implicadoPor, puede, queCambiaConElRol, rolPorDefecto, rolesQuePuedeDar } from "../src/lib/permisos.js";

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

test("se ofrecen sólo los roles dentro de lo propio, y Dueño sólo a un Dueño", () => {
  const roles = [
    { id: "d", nombre: "Dueño", es_duenio: true, permisos: [] },
    { id: "c", nombre: "Caja", es_duenio: false, permisos: ["cobrar"] },
    { id: "e", nombre: "Encargado", es_duenio: false, permisos: ["cobrar", "crear_casos"] },
  ];
  const recepcion = { es_duenio: false, permisos: ["manejar_roles", "cobrar"] };
  assert.deepEqual(rolesQuePuedeDar(recepcion, roles).map((r) => r.id), ["c"]);
  assert.deepEqual(rolesQuePuedeDar({ es_duenio: true, permisos: [] }, roles).map((r) => r.id), ["d", "c", "e"]);
});

test("el rol por defecto de un pedido nunca es Dueño: el de menos permisos, o ninguno", () => {
  const d = { id: "d", es_duenio: true, permisos: [] };
  const a = { id: "a", es_duenio: false, permisos: ["cobrar", "crear_casos"] };
  const b = { id: "b", es_duenio: false, permisos: ["cobrar"] };
  const c = { id: "c", es_duenio: false, permisos: ["crear_casos"] };
  assert.equal(rolPorDefecto([d]), null);
  assert.equal(rolPorDefecto([]), null);
  assert.equal(rolPorDefecto(undefined), null);
  assert.equal(rolPorDefecto([d, a, b]), "b");
  assert.equal(rolPorDefecto([a, b, c]), "b");
});

// Algunos permisos no sirven sin el de mirar lo mismo: guardar_rol (056) los
// suma en la base y el editor los prende y explica.
test("conImplicados suma el permiso de mirar que va con cada uno", () => {
  assert.deepEqual(conImplicados(["editar_clientes"]), ["ver_clientes", "editar_clientes"]);
  assert.deepEqual(conImplicados(["crear_casos", "manejar_turnos", "editar_inventario"]),
    ["ver_todos_los_casos", "crear_casos", "ver_agenda", "manejar_turnos", "ver_inventario", "editar_inventario"]);
  assert.deepEqual(conImplicados(["cobrar"]), ["cobrar"]);
  assert.equal(implicadoPor(["editar_clientes", "ver_clientes"], "ver_clientes")?.clave, "editar_clientes");
  assert.equal(implicadoPor(["ver_clientes"], "ver_clientes"), null);
});

test("los implícitos son los mismos que suma guardar_rol en la 056", () => {
  const sql = readFileSync(new URL("../supabase/056_roles_editables.sql", import.meta.url), "utf8");
  const bloque = sql.slice(sql.indexOf("function guardar_rol"), sql.indexOf("i(clave, implicado)"));
  const deLaBase = [...bloque.matchAll(/\('([a-z_]+)', '([a-z_]+)'\)/g)].map((m) => `${m[1]}>${m[2]}`).sort();
  const deAca = PERMISOS.flatMap((p) => (p.implica ?? []).map((i) => `${p.clave}>${i}`)).sort();
  assert.deepEqual(deAca, deLaBase);
});
