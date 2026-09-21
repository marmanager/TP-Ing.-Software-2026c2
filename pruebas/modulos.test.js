// Correr con: npm run test:unit
//
// Los submódulos de la Agenda: Turnos y Calendario.
//
// La regla que más importa es la de compatibilidad. Los negocios que ya
// existen tienen "agenda" en la lista y ningún hijo escrito, y eso tiene que
// seguir queriendo decir "la Agenda entera", no "la Agenda vacía".

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import {
  LISTA_MODULOS,
  LISTA_SUBMODULOS,
  MODULOS,
  SUBMODULOS,
  alternarModulo,
  hijosActivos,
  hijosDe,
  motivoParaNoApagar,
} from "../src/lib/modulos.js";

const claves = (lista) => lista.map((m) => m.clave).sort();

// ---------- el catálogo ----------

test("los submódulos no ensucian la lista de módulos", () => {
  // De LISTA_MODULOS salen el contador de "Mi negocio" y lo que recomienda
  // cada preset. Si los hijos entraran ahí, esos números cambiarían solos.
  assert.deepEqual(claves(LISTA_MODULOS), ["agenda", "equipo", "inventario", "presupuesto"]);
});

test("cada submódulo cuelga de un módulo que existe", () => {
  for (const s of LISTA_SUBMODULOS) {
    assert.ok(MODULOS[s.padre], `${s.clave} cuelga de un módulo desconocido: ${s.padre}`);
  }
});

test("la Agenda tiene Turnos y Calendario", () => {
  assert.deepEqual(claves(hijosDe("agenda")), ["calendario", "turnos"]);
});

test("los otros módulos no tienen hijos", () => {
  for (const clave of ["inventario", "equipo", "presupuesto"]) {
    assert.deepEqual(hijosDe(clave), []);
  }
});

test("cada submódulo tiene lo que la pantalla del módulo apagado necesita", () => {
  for (const s of LISTA_SUBMODULOS) {
    assert.ok(s.nombre, `${s.clave} sin nombre`);
    assert.ok(s.descripcion, `${s.clave} sin descripción`);
    assert.ok(s.ruta?.startsWith("/"), `${s.clave} sin ruta`);
  }
});

// ---------- qué hijos están prendidos ----------

test("con la Agenda apagada no hay ningún hijo prendido", () => {
  assert.deepEqual(hijosActivos("agenda", ["inventario"]), []);
});

test("un negocio de antes de los submódulos tiene los dos", () => {
  // Es el caso de toda cuenta creada hasta hoy: "agenda" sí, hijos no.
  assert.deepEqual(claves(hijosActivos("agenda", ["agenda", "inventario"])), [
    "calendario",
    "turnos",
  ]);
});

test("con un hijo escrito valen sólo los escritos", () => {
  assert.deepEqual(claves(hijosActivos("agenda", ["agenda", "calendario"])), ["calendario"]);
});

// ---------- prender y apagar ----------

test("prender la Agenda prende sus dos pantallas", () => {
  const despues = alternarModulo("agenda", []);
  assert.ok(despues.includes("agenda"));
  assert.deepEqual(claves(hijosActivos("agenda", despues)), ["calendario", "turnos"]);
});

test("apagar la Agenda se lleva a los hijos", () => {
  const despues = alternarModulo("agenda", ["agenda", "turnos", "calendario", "equipo"]);
  assert.deepEqual(despues, ["equipo"]);
});

test("apagar un hijo de un negocio viejo deja escrito al hermano", () => {
  // Sin materializar al hermano, filtrar "turnos" de una lista donde no está
  // no cambiaría nada y el interruptor no haría nada.
  const despues = alternarModulo("turnos", ["agenda"]);
  assert.deepEqual(claves(hijosActivos("agenda", despues)), ["calendario"]);
  assert.ok(despues.includes("agenda"), "la Agenda sigue prendida");
});

test("volver a prender el hijo apagado deja los dos", () => {
  const sinTurnos = alternarModulo("turnos", ["agenda"]);
  const despues = alternarModulo("turnos", sinTurnos);
  assert.deepEqual(claves(hijosActivos("agenda", despues)), ["calendario", "turnos"]);
});

test("prender y apagar un módulo sin hijos no toca a los demás", () => {
  assert.deepEqual(alternarModulo("inventario", ["agenda"]).sort(), ["agenda", "inventario"]);
  assert.deepEqual(alternarModulo("inventario", ["agenda", "inventario"]), ["agenda"]);
});

// ---------- la última pantalla no se apaga ----------

test("el último hijo prendido no se puede apagar, y el botón dice por qué", () => {
  const soloCalendario = ["agenda", "calendario"];
  assert.equal(motivoParaNoApagar("calendario", soloCalendario), "apagá Agenda");
});

test("con los dos prendidos, cualquiera de los dos se puede apagar", () => {
  const losDos = ["agenda", "turnos", "calendario"];
  assert.equal(motivoParaNoApagar("turnos", losDos), null);
  assert.equal(motivoParaNoApagar("calendario", losDos), null);
});

test("un negocio viejo puede apagar cualquiera de los dos", () => {
  assert.equal(motivoParaNoApagar("turnos", ["agenda"]), null);
  assert.equal(motivoParaNoApagar("calendario", ["agenda"]), null);
});

test("un módulo que no es hijo nunca tiene motivo", () => {
  assert.equal(motivoParaNoApagar("agenda", ["agenda"]), null);
  assert.equal(motivoParaNoApagar("inventario", ["inventario"]), null);
});

// ---------- la invariante que sostiene todo ----------

test("nunca queda la Agenda prendida sin ninguna pantalla adentro", () => {
  // Se recorre todo lo que se puede tocar desde la pantalla de módulos, y en
  // ningún estado alcanzable la Agenda queda prendida y vacía.
  const partidas = [
    ["agenda"],
    ["agenda", "turnos", "calendario"],
    ["agenda", "turnos"],
    ["agenda", "calendario"],
  ];
  for (const activos of partidas) {
    for (const clave of Object.keys(SUBMODULOS)) {
      if (motivoParaNoApagar(clave, activos)) continue;
      const despues = alternarModulo(clave, activos);
      if (!despues.includes("agenda")) continue;
      assert.ok(
        hijosActivos("agenda", despues).length > 0,
        `apagar ${clave} desde [${activos}] dejó la Agenda vacía`
      );
    }
  }
});
