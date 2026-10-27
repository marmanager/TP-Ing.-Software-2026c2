import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { estadisticasCasosDemo, serieActividadCasos } from "../src/lib/dashboard-casos.js";

const suma = (puntos) => puntos.reduce((s, p) => s + p.cantidad, 0);

test("Serie diaria completa días sin ingresos y respeta un rango de un solo día", () => {
  const serie = serieActividadCasos({ desde: "2026-10-01", hasta: "2026-10-03" }, [{ fecha: "2026-10-02", cantidad: 3 }]);
  assert.equal(serie.agrupacion, "día");
  assert.deepEqual(serie.puntos.map((p) => p.cantidad), [0, 3, 0]);
  assert.equal(serieActividadCasos({ desde: "2026-10-02", hasta: "2026-10-02" }, [{ fecha: "2026-10-02", cantidad: 3 }]).puntos.length, 1);
});

test("Semanas de lunes a domingo, recortadas al rango, sin perder ingresos de los extremos", () => {
  const serie = serieActividadCasos({ desde: "2026-01-01", hasta: "2026-04-01" }, [
    { fecha: "2026-04-01", cantidad: 4 }, { fecha: "2026-01-04", cantidad: 1 },
    { fecha: "2026-01-05", cantidad: 2 }, { fecha: "2026-04-02", cantidad: 100 },
  ]);
  assert.equal(serie.agrupacion, "semana");
  assert.deepEqual([serie.puntos[0].desde, serie.puntos[0].hasta, serie.puntos[0].cantidad], ["2026-01-01", "2026-01-04", 1]);
  assert.deepEqual([serie.puntos.at(-1).desde, serie.puntos.at(-1).hasta], ["2026-03-30", "2026-04-01"]);
  assert.equal(suma(serie.puntos), 7);
});

test("Rangos largos agrupan por mes o año conservando el total y el período exacto", () => {
  const mensual = serieActividadCasos({ desde: "2025-01-15", hasta: "2026-04-12" }, [{ fecha: "2025-01-15", cantidad: 2 }, { fecha: "2026-04-12", cantidad: 5 }]);
  assert.equal(mensual.agrupacion, "mes");
  assert.equal(mensual.puntos[0].desde, "2025-01-15");
  assert.equal(mensual.puntos.at(-1).hasta, "2026-04-12");
  assert.equal(suma(mensual.puntos), 7);
  const anual = serieActividadCasos({ desde: "2019-03-02", hasta: "2026-06-12" }, [{ fecha: "2019-03-02", cantidad: 2 }, { fecha: "2026-06-12", cantidad: 5 }]);
  assert.equal(anual.agrupacion, "año");
  assert.equal(anual.puntos.length, 8);
  assert.equal(anual.puntos[0].desde, "2019-03-02");
  assert.equal(anual.puntos.at(-1).hasta, "2026-06-12");
  assert.equal(suma(anual.puntos), 7);
});

test("Cruzar febrero bisiesto o diciembre no deja huecos ni repite días", () => {
  const serie = serieActividadCasos({ desde: "2024-02-28", hasta: "2024-03-01" }, [{ fecha: "2024-02-29", cantidad: 1 }]);
  assert.deepEqual(serie.puntos.map((p) => p.desde), ["2024-02-28", "2024-02-29", "2024-03-01"]);
  const finAnio = serieActividadCasos({ desde: "2025-12-31", hasta: "2026-01-01" }, []);
  assert.deepEqual(finAnio.puntos.map((p) => p.cantidad), [0, 0]);
});

test("Demo usa apertura, incluye estado actual de reabiertos y no mezcla otro negocio", () => {
  const datos = { negocio: { id: "a" }, casos: [
    { id: "viejo", negocio_id: "a", estado: "en_proceso", abierto_en: "2026-09-01T12:00:00Z", actualizado_en: "2026-10-03T12:00:00Z" },
    { id: "nuevo", negocio_id: "a", estado: "completado", abierto_en: "2026-10-01T03:00:00Z" },
    { id: "limite", negocio_id: "a", estado: "nuevo", abierto_en: "2026-10-01T02:59:59Z" },
    { id: "otro", negocio_id: "b", estado: "nuevo", abierto_en: "2026-10-03T12:00:00Z" },
  ] };
  const resultado = estadisticasCasosDemo(datos, { desde: "2026-10-01", hasta: "2026-10-07" });
  assert.equal(resultado.nuevos.total, 1);
  assert.deepEqual(resultado.nuevos.por_dia, [{ fecha: "2026-10-01", cantidad: 1 }]);
  assert.equal(resultado.distribucion_actual.total, 3);
  assert.equal(suma(resultado.distribucion_actual.por_estado), 3);
  assert.equal(resultado.distribucion_actual.por_estado.find((p) => p.estado === "en_proceso").cantidad, 1);
});

test("Sin datos conserva estados con cero y genera una serie completa sin ingresos ficticios", () => {
  const periodo = { desde: "2026-10-01", hasta: "2026-10-07" };
  const resultado = estadisticasCasosDemo({ negocio: { id: "a" }, casos: [] }, periodo);
  assert.equal(resultado.distribucion_actual.por_estado.length, 5);
  assert.equal(suma(resultado.distribucion_actual.por_estado), 0);
  assert.equal(suma(serieActividadCasos(periodo, resultado.nuevos.por_dia).puntos), 0);
});


test("Nuevos y cierres comparten intervalos y completan con cero los días sin actividad", () => {
  const serie = serieActividadCasos({ desde: "2026-10-01", hasta: "2026-10-03" }, [{ fecha: "2026-10-01", cantidad: 3 }], [{ fecha: "2026-10-02", cantidad: 2 }]);
  assert.deepEqual(serie.puntos.map((p) => [p.cantidad, p.cerrados]), [[3, 0], [0, 2], [0, 0]]);
  for (const periodo of [{ desde: "2026-01-01", hasta: "2026-04-01" }, { desde: "2025-01-01", hasta: "2026-04-01" }, { desde: "2019-01-01", hasta: "2026-04-01" }]) {
    const agrupada = serieActividadCasos(periodo, [{ fecha: periodo.desde, cantidad: 3 }], [{ fecha: periodo.hasta, cantidad: 7 }]);
    assert.equal(suma(agrupada.puntos), 3);
    assert.equal(agrupada.puntos.reduce((n, p) => n + p.cerrados, 0), 7);
  }
});

test("Demo cuenta entregas en su fecha aunque el caso se reabra, sin confundirlas con pagos", () => {
  const datos = { negocio: { id: "a" }, casos: [
    { id: "c", negocio_id: "a", estado: "en_proceso", abierto_en: "2026-09-01T12:00:00Z" },
    { id: "otro", negocio_id: "b", estado: "completado", abierto_en: "2026-09-01T12:00:00Z" },
  ], eventos: [
    { caso_id: "c", tipo: "entrega", ocurrido_en: "2026-10-01T03:00:00Z" },
    { caso_id: "c", tipo: "entrega", ocurrido_en: "2026-10-08T02:59:59Z" },
    { caso_id: "c", tipo: "entrega", ocurrido_en: "2026-10-08T03:00:00Z" },
    { caso_id: "c", tipo: "cobro", ocurrido_en: "2026-10-04T12:00:00Z" },
    { caso_id: "otro", tipo: "entrega", ocurrido_en: "2026-10-04T12:00:00Z" },
  ] };
  const resultado = estadisticasCasosDemo(datos, { desde: "2026-10-01", hasta: "2026-10-07" });
  assert.deepEqual(resultado.cerrados, { total: 2, por_dia: [{ fecha: "2026-10-01", cantidad: 1 }, { fecha: "2026-10-07", cantidad: 1 }] });
  assert.equal(resultado.nuevos.total, 0);
  assert.equal(resultado.distribucion_actual.total, 1);
});
