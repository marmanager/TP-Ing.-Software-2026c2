// Correr con: npm run test:unit
//
// El calendario del mes: agrupar por día y moverse entre meses y años.
//
// Lo que más se cuida acá es el huso horario. Agrupar por día con
// toISOString() manda los turnos de la noche al día siguiente, y eso en la
// pantalla se ve como un turno dibujado en la casilla equivocada.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import {
  acomodarEnCarriles,
  aniosOfrecidos,
  claveDia,
  deClaveDia,
  duracionDe,
  mesAnterior,
  mesSiguiente,
  minutosDelDia,
  rangoDeHoras,
  semanaDe,
  sumarDias,
  tituloDeSemana,
  turnosPorDia,
} from "../src/lib/calendario.js";

// ---------- la clave del día ----------

test("un turno de la noche queda en su día y no en el siguiente", () => {
  // 21:30 hora local. Pasado por UTC en Argentina esto salta al día de
  // después, que es justo el error que la clave evita.
  const nocturno = new Date(2026, 8, 21, 21, 30);
  assert.equal(claveDia(nocturno), "2026-09-21");
});

test("el mes y el día van con dos dígitos, para que ordenen como texto", () => {
  assert.equal(claveDia(new Date(2026, 0, 5)), "2026-01-05");
});

test("la clave y la fecha son de ida y vuelta", () => {
  const d = deClaveDia("2026-09-21");
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 8);
  assert.equal(d.getDate(), 21);
  assert.equal(claveDia(d), "2026-09-21");
});

// ---------- agrupar ----------

const turno = (fecha, extra = {}) => ({ empieza_en: fecha, ...extra });

test("los turnos se agrupan por día", () => {
  const porDia = turnosPorDia([
    turno(new Date(2026, 8, 21, 9, 0)),
    turno(new Date(2026, 8, 21, 15, 0)),
    turno(new Date(2026, 8, 22, 9, 0)),
  ]);
  assert.equal(porDia.get("2026-09-21").length, 2);
  assert.equal(porDia.get("2026-09-22").length, 1);
});

test("dentro de un día quedan ordenados por hora, aunque vengan al revés", () => {
  const porDia = turnosPorDia([
    turno(new Date(2026, 8, 21, 17, 0), { motivo: "tarde" }),
    turno(new Date(2026, 8, 21, 8, 0), { motivo: "temprano" }),
  ]);
  assert.deepEqual(
    porDia.get("2026-09-21").map((t) => t.motivo),
    ["temprano", "tarde"]
  );
});

test("sin turnos no hay días", () => {
  assert.equal(turnosPorDia([]).size, 0);
  assert.equal(turnosPorDia().size, 0);
});

// ---------- moverse de mes ----------

test("de enero para atrás se va a diciembre del año pasado", () => {
  assert.deepEqual(mesAnterior({ anio: 2026, mes: 0 }), { anio: 2025, mes: 11 });
});

test("de diciembre para adelante se va a enero del que viene", () => {
  assert.deepEqual(mesSiguiente({ anio: 2026, mes: 11 }), { anio: 2027, mes: 0 });
});

test("en el medio del año sólo cambia el mes", () => {
  assert.deepEqual(mesAnterior({ anio: 2026, mes: 8 }), { anio: 2026, mes: 7 });
  assert.deepEqual(mesSiguiente({ anio: 2026, mes: 8 }), { anio: 2026, mes: 9 });
});

// ---------- los años del selector ----------

const HOY = new Date(2026, 8, 21);

test("sin ningún turno se ofrecen el año en curso y el que viene", () => {
  assert.deepEqual(aniosOfrecidos([], HOY), [2026, 2027]);
});

test("un turno viejo agranda la lista para atrás", () => {
  assert.deepEqual(aniosOfrecidos([turno(new Date(2024, 3, 2))], HOY), [
    2024, 2025, 2026, 2027,
  ]);
});

test("un turno lejos agranda la lista para adelante", () => {
  assert.deepEqual(aniosOfrecidos([turno(new Date(2029, 3, 2))], HOY), [
    2026, 2027, 2028, 2029,
  ]);
});

test("los años no se repiten aunque haya muchos turnos del mismo", () => {
  const muchos = [
    turno(new Date(2026, 0, 1)),
    turno(new Date(2026, 5, 1)),
    turno(new Date(2026, 11, 1)),
  ];
  assert.deepEqual(aniosOfrecidos(muchos, HOY), [2026, 2027]);
});

// ---------- sumar días ----------

test("sumar un día cruza el fin de mes", () => {
  assert.equal(claveDia(sumarDias(new Date(2026, 0, 31), 1)), "2026-02-01");
});

test("restar un día cruza el fin de año", () => {
  assert.equal(claveDia(sumarDias(new Date(2026, 0, 1), -1)), "2025-12-31");
});

test("sumar días no toca la fecha original", () => {
  const original = new Date(2026, 8, 21);
  sumarDias(original, 10);
  assert.equal(claveDia(original), "2026-09-21");
});

// ---------- la semana ----------

test("la semana arranca el lunes y termina el domingo", () => {
  // El 21/09/2026 cae lunes.
  const semana = semanaDe(new Date(2026, 8, 21));
  assert.equal(semana.length, 7);
  assert.equal(claveDia(semana[0]), "2026-09-21");
  assert.equal(claveDia(semana[6]), "2026-09-27");
});

test("un domingo pertenece a la semana que arrancó el lunes anterior", () => {
  // El error clásico: con getDay() crudo, el domingo arranca su propia semana.
  const semana = semanaDe(new Date(2026, 8, 27));
  assert.equal(claveDia(semana[0]), "2026-09-21");
  assert.equal(claveDia(semana[6]), "2026-09-27");
});

test("la semana cruza el fin de mes sin saltear días", () => {
  const semana = semanaDe(new Date(2026, 8, 30));
  assert.deepEqual(semana.map(claveDia), [
    "2026-09-28", "2026-09-29", "2026-09-30",
    "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04",
  ]);
});

test("la hora del día no mueve de semana", () => {
  const tarde = new Date(2026, 8, 27, 23, 59);
  assert.equal(claveDia(semanaDe(tarde)[0]), "2026-09-21");
});

// ---------- minutos y duración ----------

test("los minutos se cuentan desde la medianoche, en hora local", () => {
  assert.equal(minutosDelDia(new Date(2026, 8, 21, 9, 30)), 570);
  assert.equal(minutosDelDia(new Date(2026, 8, 21, 0, 0)), 0);
});

test("un turno sin minutos propios ocupa lo que da el negocio", () => {
  assert.equal(duracionDe({ minutos_reservados: null }, 45), 45);
  assert.equal(duracionDe({}, 30), 30);
});

test("un turno con minutos propios ocupa los suyos", () => {
  assert.equal(duracionDe({ minutos_reservados: 90 }, 30), 90);
});

test("un minutos_reservados que viene como texto desde la base se lee igual", () => {
  assert.equal(duracionDe({ minutos_reservados: "60" }, 30), 60);
});

test("un minutos_reservados en cero o negativo cae al del negocio", () => {
  assert.equal(duracionDe({ minutos_reservados: 0 }, 30), 30);
  assert.equal(duracionDe({ minutos_reservados: -5 }, 30), 30);
});

// ---------- el rango de horas de la grilla ----------

const aLas = (h, m = 0) => ({ empieza_en: new Date(2026, 8, 21, h, m) });

test("sin turnos, la grilla es el horario del negocio", () => {
  assert.deepEqual(rangoDeHoras([], { abre: 540, cierra: 1080 }), {
    desde: 540,
    hasta: 1080,
  });
});

test("un turno antes de abrir estira la grilla para atrás", () => {
  // Si no, ese turno no se vería: una agenda que esconde un turno es peor
  // que no tener agenda.
  const r = rangoDeHoras([aLas(7, 30)], { abre: 540, cierra: 1080, porDefecto: 30 });
  assert.equal(r.desde, 420);
});

test("un turno que termina después de cerrar estira la grilla para adelante", () => {
  const r = rangoDeHoras([aLas(17, 45)], { abre: 540, cierra: 1080, porDefecto: 60 });
  assert.equal(r.hasta, 1140);
});

test("el rango cae siempre en horas en punto", () => {
  const r = rangoDeHoras([aLas(7, 10)], { abre: 545, cierra: 1075, porDefecto: 20 });
  assert.equal(r.desde % 60, 0);
  assert.equal(r.hasta % 60, 0);
});

test("la grilla no se pasa de la medianoche", () => {
  const r = rangoDeHoras([aLas(23, 30)], { abre: 540, cierra: 1080, porDefecto: 120 });
  assert.equal(r.hasta, 1440);
});

test("con horarios rotos igual queda una grilla de al menos una hora", () => {
  const r = rangoDeHoras([], { abre: 600, cierra: 600 });
  assert.ok(r.hasta > r.desde);
});

// ---------- los carriles ----------

const turnoDe = (h, m, dura, id) => ({
  id,
  empieza_en: new Date(2026, 8, 21, h, m),
  minutos_reservados: dura,
});

const carrilDe = (puestos, id) => puestos.find((p) => p.turno.id === id);

test("turnos que no se pisan ocupan todo el ancho", () => {
  const puestos = acomodarEnCarriles([turnoDe(9, 0, 30, "a"), turnoDe(11, 0, 30, "b")], 30);
  for (const p of puestos) {
    assert.equal(p.carriles, 1);
    assert.equal(p.carril, 0);
  }
});

test("dos turnos pisados se parten el ancho", () => {
  const puestos = acomodarEnCarriles([turnoDe(9, 0, 60, "a"), turnoDe(9, 30, 30, "b")], 30);
  assert.equal(carrilDe(puestos, "a").carriles, 2);
  assert.equal(carrilDe(puestos, "b").carriles, 2);
  assert.notEqual(carrilDe(puestos, "a").carril, carrilDe(puestos, "b").carril);
});

test("el que arranca cuando el otro termina no se pisa", () => {
  // Pegados no es pisados: 9 a 10 y 10 a 11 conviven en un solo carril.
  const puestos = acomodarEnCarriles([turnoDe(9, 0, 60, "a"), turnoDe(10, 0, 60, "b")], 30);
  assert.equal(carrilDe(puestos, "a").carriles, 1);
  assert.equal(carrilDe(puestos, "b").carriles, 1);
});

test("un tercero encadenado reusa el carril que se liberó", () => {
  // a: 9-10, b: 9:30-10:30, c: 10-11. "c" entra donde estaba "a".
  const puestos = acomodarEnCarriles(
    [turnoDe(9, 0, 60, "a"), turnoDe(9, 30, 60, "b"), turnoDe(10, 0, 60, "c")],
    30
  );
  assert.equal(carrilDe(puestos, "c").carril, carrilDe(puestos, "a").carril);
  for (const id of ["a", "b", "c"]) assert.equal(carrilDe(puestos, id).carriles, 2);
});

test("los carriles se cuentan por grupo y no por día", () => {
  // Dos pisados a la mañana no tienen que angostar al de la tarde.
  const puestos = acomodarEnCarriles(
    [turnoDe(9, 0, 60, "a"), turnoDe(9, 30, 30, "b"), turnoDe(15, 0, 30, "solo")],
    30
  );
  assert.equal(carrilDe(puestos, "solo").carriles, 1);
  assert.equal(carrilDe(puestos, "a").carriles, 2);
});

test("ningún turno se pierde por el camino", () => {
  const turnos = [
    turnoDe(9, 0, 60, "a"),
    turnoDe(9, 0, 30, "b"),
    turnoDe(9, 15, 30, "c"),
    turnoDe(16, 0, 30, "d"),
  ];
  const puestos = acomodarEnCarriles(turnos, 30);
  assert.equal(puestos.length, turnos.length);
  assert.deepEqual(puestos.map((p) => p.turno.id).sort(), ["a", "b", "c", "d"]);
});

test("dos turnos en el mismo carril nunca se superponen en el tiempo", () => {
  // Es la invariante que hace que no se tapen en pantalla.
  const puestos = acomodarEnCarriles(
    [
      turnoDe(9, 0, 60, "a"),
      turnoDe(9, 30, 60, "b"),
      turnoDe(10, 0, 60, "c"),
      turnoDe(10, 30, 60, "d"),
      turnoDe(9, 0, 30, "e"),
    ],
    30
  );
  for (const x of puestos) {
    for (const y of puestos) {
      if (x === y || x.carril !== y.carril) continue;
      assert.ok(
        x.hasta <= y.desde || y.hasta <= x.desde,
        `${x.turno.id} y ${y.turno.id} comparten carril y se pisan`
      );
    }
  }
});

test("sin turnos no hay nada que acomodar", () => {
  assert.deepEqual(acomodarEnCarriles([], 30), []);
  assert.deepEqual(acomodarEnCarriles(), []);
});

// ---------- cómo se lee la semana ----------

test("una semana adentro de un mes se lee con el mes una sola vez", () => {
  assert.equal(tituloDeSemana(semanaDe(new Date(2026, 8, 21))), "21 al 27 de septiembre");
});

test("una semana que cruza el mes nombra los dos meses", () => {
  // "28 al 4 de septiembre" quedaría al revés y sin sentido.
  assert.equal(
    tituloDeSemana(semanaDe(new Date(2026, 8, 30))),
    "28 de septiembre al 4 de octubre"
  );
});

test("una semana que cruza el año nombra los dos años", () => {
  assert.equal(
    tituloDeSemana(semanaDe(new Date(2026, 11, 31))),
    "28 de diciembre de 2026 al 3 de enero de 2027"
  );
});

test("sin días no hay título", () => {
  assert.equal(tituloDeSemana([]), "");
  assert.equal(tituloDeSemana(), "");
});
