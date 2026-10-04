// Correr con: npm run test:unit
//
// Los turnos que pidió un cliente por el link y todavía no miró nadie.
//
// Un turno que entró por el mostrador ya lo vio alguien: hubo una llamada o
// una persona enfrente. Uno que entró por el link puede haber caído un
// domingo a la noche, y del lado del negocio nadie se enteró.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { estadoDeTurno, turnoEnPie, turnoParaLaApi, turnosSinVer } from "../src/lib/turnos.js";

const AHORA = new Date("2026-09-21T12:00:00.000Z").getTime();
const enHoras = (h) => new Date(AHORA + h * 3600000).toISOString();

const turno = (extra = {}) => ({
  empieza_en: enHoras(24),
  estado: "agendado",
  origen: "cliente",
  ...extra,
});

test("avisa por el turno que pidió un cliente y nadie confirmó", () => {
  assert.equal(turnosSinVer([turno()], { ahora: AHORA }).length, 1);
});

test("uno que entró por el mostrador no es una novedad", () => {
  // Alguien lo anotó: ya lo vio.
  assert.deepEqual(turnosSinVer([turno({ origen: "mostrador" })], { ahora: AHORA }), []);
});

test("un turno viejo, sin origen, tampoco", () => {
  // Los que se cargaron antes de que existiera la columna.
  const viejo = { empieza_en: enHoras(24), estado: "agendado" };
  assert.deepEqual(turnosSinVer([viejo], { ahora: AHORA }), []);
});

test("desde que alguien lo confirma deja de ser nuevo", () => {
  for (const estado of ["confirmado", "cancelado", "atendido"]) {
    assert.deepEqual(turnosSinVer([turno({ estado })], { ahora: AHORA }), [], estado);
  }
});

test("por uno que ya pasó no se avisa: no hay nada que hacer", () => {
  assert.deepEqual(turnosSinVer([turno({ empieza_en: enHoras(-2) })], { ahora: AHORA }), []);
});

test("el de dentro de un rato sí cuenta", () => {
  assert.equal(turnosSinVer([turno({ empieza_en: enHoras(1) })], { ahora: AHORA }).length, 1);
});

test("sin turnos no explota", () => {
  assert.deepEqual(turnosSinVer(), []);
  assert.deepEqual(turnosSinVer([]), []);
});

// ------------------------------------------------------------
// Lo que ya estaba, que el turno del link no cambió
// ------------------------------------------------------------

test("un turno del link nace sin confirmar, como cualquier otro", () => {
  assert.equal(estadoDeTurno("agendado").palabra, "Sin confirmar");
});

test("y está en pie hasta que se cancela o se atiende", () => {
  assert.equal(turnoEnPie({ estado: "agendado" }), true);
  assert.equal(turnoEnPie({ estado: "confirmado" }), true);
  assert.equal(turnoEnPie({ estado: "cancelado" }), false);
  assert.equal(turnoEnPie({ estado: "atendido" }), false);
});

// ---------- lo que se manda a la API ----------

test("a la API va un cliente que ya está por su id, sin volver a mandar sus datos", () => {
  const t = turnoParaLaApi({ clienteId: "c1", nombreCliente: "Ana", telefono: "11", motivo: "Service", empiezaEn: "2026-10-05T10:00" });
  assert.equal(t.cliente_id, "c1");
  assert.equal(t.cliente, null);
  assert.equal(t.motivo, "Service");
});

test("alguien que todavía no es cliente va como cliente nuevo, sin espacios de más", () => {
  const t = turnoParaLaApi({ clienteId: null, nombreCliente: "  Beto ", telefono: " ", motivo: "x", empiezaEn: "2026-10-05T10:00" });
  assert.equal(t.cliente_id, null);
  assert.deepEqual(t.cliente, { nombre: "Beto", telefono: null });
});

test("sin nadie, el turno va sin cliente", () => {
  const t = turnoParaLaApi({ clienteId: null, nombreCliente: "", motivo: "x", empiezaEn: "2026-10-05T10:00" });
  assert.equal(t.cliente_id, null);
  assert.equal(t.cliente, null);
});

test("la hora del formulario (local) va a la API como instante", () => {
  const t = turnoParaLaApi({ motivo: "x", empiezaEn: "2026-10-05T10:00" });
  assert.equal(t.empieza_en, new Date("2026-10-05T10:00").toISOString());
  assert.match(t.empieza_en, /Z$/);
});
