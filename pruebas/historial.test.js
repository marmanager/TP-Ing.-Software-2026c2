// Correr con: npm test
//
// El historial del negocio (SCRUM-75): qué eventos entran en cada filtro,
// en qué orden, cómo se agrupan por día y qué cuenta el resumen.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LISTA_TIPOS,
  agruparPorDia,
  desdeDelPeriodo,
  filtrarHistorial,
  resumirHistorial,
} from "../src/lib/historial.js";

// Un miércoles cualquiera al mediodía, hora local.
const AHORA = new Date(2026, 8, 16, 12, 0, 0);

const haceDias = (dias, horas = 10) => {
  const d = new Date(AHORA);
  d.setDate(d.getDate() - dias);
  d.setHours(horas, 0, 0, 0);
  return d.toISOString();
};

const evento = (id, tipo, ocurrido_en, extra = {}) => ({
  id,
  caso_id: "k1",
  tipo,
  titulo: id,
  ocurrido_en,
  ...extra,
});

test("los tipos son los cinco que acepta la base", () => {
  assert.deepEqual(
    LISTA_TIPOS.map((t) => t.clave),
    ["entro", "estado", "entrega", "plata", "nota"]
  );
});

test("van del más nuevo al más viejo", () => {
  const eventos = [
    evento("viejo", "entro", haceDias(3)),
    evento("nuevo", "estado", haceDias(0)),
    evento("medio", "nota", haceDias(1)),
  ];
  assert.deepEqual(
    filtrarHistorial(eventos, { ahora: AHORA }).map((e) => e.id),
    ["nuevo", "medio", "viejo"]
  );
});

test("filtrar por tipo deja sólo ese tipo", () => {
  const eventos = [
    evento("a", "entro", haceDias(0)),
    evento("b", "plata", haceDias(0), { monto: 45000 }),
    evento("c", "plata", haceDias(1), { monto: 12000 }),
  ];
  assert.deepEqual(
    filtrarHistorial(eventos, { tipo: "plata", ahora: AHORA }).map((e) => e.id),
    ["b", "c"]
  );
});

test("un evento de antes de la columna tipo se ve en «Todo» y en ningún filtro", () => {
  const eventos = [evento("sin-tipo", undefined, haceDias(0))];
  assert.equal(filtrarHistorial(eventos, { tipo: "todo", ahora: AHORA }).length, 1);
  for (const t of LISTA_TIPOS) {
    assert.equal(
      filtrarHistorial(eventos, { tipo: t.clave, ahora: AHORA }).length,
      0,
      `apareció en ${t.clave}`
    );
  }
});

test("los últimos 7 días incluyen la mañana de hace seis días entera", () => {
  const desde = desdeDelPeriodo("semana", AHORA);
  assert.equal(desde.getHours(), 0);
  assert.equal(desde.getDate(), 10);

  const eventos = [
    evento("adentro", "entro", haceDias(6, 0)),
    evento("afuera", "entro", haceDias(7, 23)),
  ];
  assert.deepEqual(
    filtrarHistorial(eventos, { periodo: "semana", ahora: AHORA }).map((e) => e.id),
    ["adentro"]
  );
});

test("«Todo» no tiene límite de fecha", () => {
  assert.equal(desdeDelPeriodo("todo", AHORA), null);
  const eventos = [evento("hace-un-año", "entro", haceDias(365))];
  assert.equal(filtrarHistorial(eventos, { periodo: "todo", ahora: AHORA }).length, 1);
});

test("se agrupan por día local, en el orden en que vienen", () => {
  const eventos = filtrarHistorial(
    [
      evento("hoy-temprano", "entro", haceDias(0, 9)),
      evento("hoy-tarde", "estado", haceDias(0, 11)),
      evento("ayer", "nota", haceDias(1, 22)),
    ],
    { ahora: AHORA }
  );
  const grupos = agruparPorDia(eventos);
  assert.equal(grupos.length, 2);
  assert.deepEqual(grupos[0].eventos.map((e) => e.id), ["hoy-tarde", "hoy-temprano"]);
  assert.deepEqual(grupos[1].eventos.map((e) => e.id), ["ayer"]);
});

test("el resumen cuenta entradas, entregas y movimientos de plata", () => {
  const eventos = [
    evento("1", "entro", haceDias(0)),
    evento("2", "entro", haceDias(1)),
    evento("3", "entrega", haceDias(0)),
    evento("4", "plata", haceDias(0), { monto: 45000 }),
    evento("5", "estado", haceDias(0)),
    evento("6", undefined, haceDias(0)),
  ];
  assert.deepEqual(resumirHistorial(eventos), {
    entraron: 2,
    entregados: 1,
    movimientosDePlata: 1,
  });
});
