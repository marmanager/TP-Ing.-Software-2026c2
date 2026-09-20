// Correr con: npm test
//
// El único test del Sprint 1, y a propósito: el cálculo de la plata es la
// única lógica del sistema donde un bug se ve en pantalla y con guita.
// Todo lo demás se verifica mirando la pantalla.

import { test } from "node:test";
import assert from "node:assert/strict";
import { casosPorAprobar, quienLoTieneEnPalabras, totalesDeCaso } from "../src/lib/estados.js";

// Los cinco pasos del caso 248, textuales de la sección 09 de la cartilla.
const caso248 = [
  { nombre: "Revisión completa", monto: 74000, estado: "aprobado" },
  { nombre: "Cambio de la pieza principal", monto: 22000, estado: "aprobado" },
  { nombre: "Reemplazo de las dos piezas de apoyo", monto: 58500, estado: "esperando" },
  { nombre: "Mantenimiento de rutina", monto: 18000, estado: "esperando" },
  { nombre: "Control final y ajuste", monto: 12000, estado: "esperando" },
];

test("da los números que la cartilla muestra en la pantalla del caso 248", () => {
  const t = totalesDeCaso(caso248);
  assert.equal(t.aprobado, 96000);
  assert.equal(t.esperando, 88500);
  assert.equal(t.todo, 184500);
  assert.equal(t.cuantosEsperan, 3);
});

test("aprobar un paso lo mueve de esperando a aprobado sin mover el total", () => {
  const antes = totalesDeCaso(caso248);
  const despues = totalesDeCaso(
    caso248.map((p) => (p.monto === 58500 ? { ...p, estado: "aprobado" } : p))
  );

  assert.equal(despues.aprobado, 154500);
  assert.equal(despues.esperando, 30000);
  assert.equal(despues.todo, antes.todo, "el total del caso no se mueve al aprobar");
  assert.equal(despues.cuantosEsperan, 2);
});

test("lo rechazado no se cobra: sale del total", () => {
  const t = totalesDeCaso(
    caso248.map((p) => (p.monto === 58500 ? { ...p, estado: "rechazado" } : p))
  );

  assert.equal(t.aprobado, 96000);
  assert.equal(t.esperando, 30000);
  assert.equal(t.todo, 126000, "el paso que el cliente no quiere no suma en ningún lado");
});

test("un caso sin pasos todavía da todo en cero, no NaN", () => {
  const t = totalesDeCaso([]);
  assert.deepEqual(t, { aprobado: 0, esperando: 0, todo: 0, cuantosEsperan: 0 });
});

test("los montos que vienen como texto desde la base se suman como números", () => {
  // Postgres devuelve numeric como string a través de PostgREST.
  const t = totalesDeCaso([
    { monto: "74000.00", estado: "aprobado" },
    { monto: "22000.00", estado: "aprobado" },
  ]);
  assert.equal(t.aprobado, 96000, "si se concatenaran daría 74000.0022000.00");
});

// ---------------------------------------------------------------
// "A aprobar": qué casos entran y con cuánta plata
// ---------------------------------------------------------------
// Misma razón que arriba: el número que sale acá es el que alguien mira
// para saber cuánto tiene esperando respuesta.

const pasosDe = (casoId, ...estados) =>
  estados.map((estado, i) => ({
    id: `${casoId}-${i}`,
    caso_id: casoId,
    nombre: `Paso ${i}`,
    monto: 1000 * (i + 1),
    estado,
  }));

test("un caso cerrado no cuenta, aunque le hayan quedado pasos sin contestar", () => {
  const casos = [
    { id: "a", estado: "en_proceso" },
    { id: "b", estado: "completado" },
  ];
  const pasos = [...pasosDe("a", "esperando"), ...pasosDe("b", "esperando")];

  const salida = casosPorAprobar(casos, pasos);

  assert.deepEqual(
    salida.map((x) => x.caso.id),
    ["a"]
  );
  assert.equal(salida[0].plata, 1000);
});

test("sólo entran los casos que tienen algo sin contestar", () => {
  const casos = [
    { id: "a", estado: "en_proceso" },
    { id: "b", estado: "nuevo" },
    { id: "c", estado: "esperando" },
  ];
  const pasos = [
    ...pasosDe("a", "aprobado", "rechazado"),
    ...pasosDe("c", "esperando"),
  ];

  assert.deepEqual(
    casosPorAprobar(casos, pasos).map((x) => x.caso.id),
    ["c"]
  );
});

test("van ordenados por lo que hay en juego, no por fecha", () => {
  const casos = [
    { id: "poco", estado: "en_proceso" },
    { id: "mucho", estado: "en_proceso" },
  ];
  const pasos = [
    { id: "1", caso_id: "poco", monto: 5000, estado: "esperando" },
    { id: "2", caso_id: "mucho", monto: 90000, estado: "esperando" },
  ];

  const salida = casosPorAprobar(casos, pasos);
  assert.deepEqual(
    salida.map((x) => x.caso.id),
    ["mucho", "poco"]
  );
  assert.equal(salida[0].cuantos, 1);
});

test("los montos que vienen como texto desde la base también se suman bien", () => {
  const casos = [{ id: "a", estado: "en_proceso" }];
  const pasos = [
    { id: "1", caso_id: "a", monto: "58500.00", estado: "esperando" },
    { id: "2", caso_id: "a", monto: "18000.00", estado: "esperando" },
  ];

  assert.equal(casosPorAprobar(casos, pasos)[0].plata, 76500);
});

// ---------------------------------------------------------------
// Quién lo tiene, dicho en la cabecera del caso
// ---------------------------------------------------------------

test("la cabecera dice quién tiene el caso con una frase, no con un nombre suelto", () => {
  const empleados = [{ id: "e1", nombre: "Diego" }];
  const decir = (caso) => quienLoTieneEnPalabras(caso, empleados);

  assert.equal(decir({ estado: "en_proceso", responsable_id: "e1" }), "Lo tiene Diego");
  assert.equal(decir({ estado: "nuevo", responsable_id: null }), "Todavía no lo tiene nadie");
  assert.equal(decir({ estado: "esperando", responsable_id: null }), "Lo tiene el proveedor");
  assert.equal(decir({ estado: "completado", responsable_id: null }), "Ya se entregó");
});

// ---------------------------------------------------------------
// Desde cuándo espera respuesta un caso
// ---------------------------------------------------------------
// Es lo que se mira para decidir a quién llamar, así que tiene que salir del
// paso sin contestar más viejo y no de cuándo se abrió el caso.

test("espera desde el paso sin contestar más viejo", () => {
  const casos = [{ id: "a", estado: "en_proceso", abierto_en: "2026-01-01T10:00:00.000Z" }];
  const pasos = [
    { id: "1", caso_id: "a", monto: 1000, estado: "esperando", creado_en: "2026-02-10T10:00:00.000Z" },
    { id: "2", caso_id: "a", monto: 2000, estado: "esperando", creado_en: "2026-02-03T10:00:00.000Z" },
    // Ya contestado: no cuenta para "desde cuándo espera".
    { id: "3", caso_id: "a", monto: 5000, estado: "aprobado", creado_en: "2026-01-02T10:00:00.000Z" },
  ];

  assert.equal(casosPorAprobar(casos, pasos)[0].esperandoDesde, "2026-02-03T10:00:00.000Z");
});

test("un paso sin fecha cae en la fecha del caso", () => {
  const casos = [{ id: "a", estado: "en_proceso", abierto_en: "2026-01-01T10:00:00.000Z" }];
  const pasos = [{ id: "1", caso_id: "a", monto: 1000, estado: "esperando" }];

  assert.equal(casosPorAprobar(casos, pasos)[0].esperandoDesde, "2026-01-01T10:00:00.000Z");
});
