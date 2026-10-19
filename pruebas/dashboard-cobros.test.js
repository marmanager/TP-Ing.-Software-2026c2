import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { estadisticasCobrosDemo, serieCobros } from "../src/lib/dashboard-cobros.js";
import { resumenDashboardDemo } from "../src/lib/dashboard.js";

const centavos = (filas) => filas.reduce((s, f) => s + Math.round(f.monto * 100), 0);

test("Días sin cobros valen cero, incluido un período vacío y uno de un solo día", () => {
  const periodo = { desde: "2026-10-01", hasta: "2026-10-03" };
  assert.deepEqual(serieCobros(periodo, [{ fecha: "2026-10-02", monto: 12.30 }]).map((p) => p.monto), [0, 12.30, 0]);
  assert.deepEqual(serieCobros(periodo, []).map((p) => p.monto), [0, 0, 0]);
  assert.equal(serieCobros({ desde: "2026-10-02", hasta: "2026-10-02" }, []).length, 1);
});

test("Día, semana y mes conservan centavos y extremos del mismo período", () => {
  const periodo = { desde: "2025-12-31", hasta: "2026-02-02" };
  const filas = [{ fecha: "2026-02-02", monto: 0.10 }, { fecha: "2026-01-04", monto: 0.20 },
    { fecha: "2025-12-31", monto: 101.33 }, { fecha: "2026-01-05", monto: 4.02 },
    { fecha: "2025-12-30", monto: 999 }, { fecha: "2026-02-03", monto: 999 }];
  for (const agrupacion of ["día", "semana", "mes"]) {
    const puntos = serieCobros(periodo, filas, agrupacion);
    assert.equal(centavos(puntos), 10565);
    assert.equal(puntos[0].desde, periodo.desde);
    assert.equal(puntos.at(-1).hasta, periodo.hasta);
  }
  const semanas = serieCobros(periodo, filas, "semana");
  assert.equal(semanas[0].hasta, "2026-01-04");
  assert.equal(semanas[1].desde, "2026-01-05");
  const meses = serieCobros(periodo, filas, "mes");
  assert.equal(meses.length, 3);
  assert.equal(meses[1].monto, 4.22);
});

test("Febrero bisiesto se incluye sin huecos", () => {
  const puntos = serieCobros({ desde: "2024-02-28", hasta: "2024-03-01" }, [{ fecha: "2024-02-29", monto: 1 }]);
  assert.deepEqual(puntos.map((p) => [p.desde, p.monto]), [["2024-02-28", 0], ["2024-02-29", 1], ["2024-03-01", 0]]);
});

test("Demo usa pagos recibidos por fecha argentina y negocio, sin duplicar el total del caso", () => {
  const periodo = { desde: "2026-10-01", hasta: "2026-10-07" };
  const base = { negocio_id: "a", caso_id: "c", estado: "pagado", medio: "efectivo", monto: 0.10, creado_en: "2025-01-01T12:00:00Z" };
  const datos = { negocio: { id: "a", modulos_activos: ["dashboard"] }, casos: [{ id: "c", negocio_id: "a", cobrado: 999 }], cobros: [
    { ...base, id: "1", pagado_en: "2026-10-01T03:00:00Z" },
    { ...base, id: "2", medio: "transferencia", monto: 0.20, pagado_en: "2026-10-08T02:59:59Z" },
    { ...base, id: "3", negocio_id: "b", pagado_en: "2026-10-03T12:00:00Z" },
    { ...base, id: "4", pagado_en: "2026-10-01T02:59:59Z" },
    { ...base, id: "5", pagado_en: "2026-10-08T03:00:00Z" },
    ...["pendiente", "rechazado", "anulado", "devuelto", "vencido"].map((estado) => ({ ...base, id: estado, estado, pagado_en: "2026-10-03T12:00:00Z" })),
  ] };
  const d = estadisticasCobrosDemo(datos, periodo);
  assert.equal(d.total_cobrado, 0.30);
  assert.equal(d.cantidad_cobros, 2);
  assert.equal(centavos(d.por_dia), 30);
  assert.equal(centavos(d.por_medio), 30);
  assert.equal(resumenDashboardDemo(datos, periodo).total_cobrado, d.total_cobrado);
});

test("Demo conserva cobros anteriores sin medio conocido y excluye los casos de otros negocios", () => {
  const periodo = { desde: "2026-10-01", hasta: "2026-10-07" };
  const datos = { negocio: { id: "a" }, casos: [
    { id: "viejo", negocio_id: "a", cobrado: 10.10, cobrado_en: "2026-10-03T12:00:00Z" },
    { id: "ajeno", negocio_id: "b", cobrado: 1000, cobrado_en: "2026-10-03T12:00:00Z" },
  ], cobros: [{ id: "nuevo", negocio_id: "a", caso_id: "nuevo", estado: "pagado", medio: "antiguo", monto: 0.20, pagado_en: "2026-10-04T12:00:00Z" }] };
  const d = estadisticasCobrosDemo(datos, periodo);
  assert.equal(d.total_cobrado, 10.30);
  assert.deepEqual(d.por_medio, [{ medio: "sin_dato", monto: 10.30, cantidad: 2 }]);
  assert.equal(resumenDashboardDemo(datos, periodo).total_cobrado, d.total_cobrado);
  const vacio = estadisticasCobrosDemo({ negocio: { id: "a" } }, periodo);
  assert.equal(vacio.total_cobrado, 0);
  assert.deepEqual(vacio.por_medio, []);
});
