import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { errorPeriodo, hoyDashboard, periodoDashboard, resumenDashboardDemo } from "../src/lib/dashboard.js";

test("El día y los períodos se calculan en Argentina aunque el dispositivo esté en otra zona", () => {
  const ahora = new Date("2026-11-01T02:00:00Z");
  assert.equal(hoyDashboard(ahora), "2026-10-31");
  assert.deepEqual(periodoDashboard("mes", ahora), { desde: "2026-10-01", hasta: "2026-10-31" });
  assert.deepEqual(periodoDashboard("7dias", ahora), { desde: "2026-10-25", hasta: "2026-10-31" });
  assert.deepEqual(periodoDashboard("30dias", ahora), { desde: "2026-10-02", hasta: "2026-10-31" });
});

test("Los últimos siete días incluyen hoy y cruzan correctamente meses y años", () => {
  assert.deepEqual(periodoDashboard("7dias", new Date("2026-01-03T15:00:00Z")), { desde: "2025-12-28", hasta: "2026-01-03" });
});

test("Rango personalizado rechaza fechas incompletas, inexistentes y orden invertido", () => {
  for (const periodo of [{ desde: "", hasta: "2026-10-01" }, { desde: "2026-02-30", hasta: "2026-03-01" },
    { desde: "2026-10-02", hasta: "2026-10-01" }]) assert.ok(errorPeriodo(periodo));
  assert.equal(errorPeriodo({ desde: "2024-02-29", hasta: "2024-02-29" }), null);
});

test("Demo respeta cobros pagados, fecha local, módulos y situación actual, sin duplicar el saldo del caso", () => {
  const datos = {
    negocio: { id: "a", modulos_activos: ["dashboard", "inventario"] },
    casos: [{ id: "c", estado: "en_proceso", cobrado: 999 }, { id: "viejo", estado: "completado", cobrado: 20, cobrado_en: "2026-10-03T15:00:00Z" }],
    cobros: [
      { id: "1", caso_id: "c", estado: "pagado", monto: 10.5, pagado_en: "2026-10-01T03:00:00Z" },
      { id: "2", caso_id: "c", estado: "anulado", monto: 30, pagado_en: "2026-10-01T03:00:00Z" },
      { id: "3", caso_id: "c", estado: "pagado", monto: 60, pagado_en: "2026-10-01T02:59:59Z" },
    ],
    clientes: [{ creado_en: "2026-10-02T15:00:00Z" }, { creado_en: "2026-09-01T15:00:00Z" }],
    insumos: [{ estado: "en_stock", cantidad: 0, minimo: 0 }, { estado: "pedido", cantidad: 0, minimo: 1 }],
  };
  const periodo = { desde: "2026-10-01", hasta: "2026-10-07" };
  const resumen = resumenDashboardDemo(datos, periodo);
  assert.equal(resumen.total_cobrado, 30.5);
  assert.equal(resumen.clientes_nuevos, 1);
  assert.equal(resumen.casos_abiertos, 1);
  assert.equal(resumen.productos_reponer, 1);
  datos.negocio.modulos_activos = ["dashboard", "-clientes", "inventario", "en_camino"];
  const apagado = resumenDashboardDemo(datos, periodo);
  assert.equal(apagado.clientes_nuevos, null);
  assert.equal(apagado.productos_reponer, null);
});
