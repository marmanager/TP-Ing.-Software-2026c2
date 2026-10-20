import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { estadisticasClientesDemo, serieAltasClientes } from "../src/lib/dashboard-clientes.js";
import { resumenDashboardDemo } from "../src/lib/dashboard.js";

const periodo = { desde: "2026-10-01", hasta: "2026-10-07" };
const cliente = (id, extra = {}) => ({ id, nombre: id, negocio_id: "a", creado_en: "2026-10-03T12:00:00Z", ...extra });
const caso = (id, cliente_id, extra = {}) => ({ id, cliente_id, negocio_id: "a", abierto_en: "2026-10-03T12:00:00Z", ...extra });
const datos = (clientes = [], casos = []) => ({ negocio: { id: "a", modulos_activos: ["dashboard"] }, clientes, casos });

test("Las altas completan días con cero y conservan totales al agrupar rangos largos", () => {
  const diario = serieAltasClientes({ desde: "2026-10-01", hasta: "2026-10-03" }, [{ fecha: "2026-10-02", cantidad: 2 }]);
  assert.deepEqual(diario.puntos.map((p) => p.cantidad), [0, 2, 0]);
  for (const [rango, agrupacion] of [[{ desde: "2026-01-01", hasta: "2026-04-01" }, "semana"], [{ desde: "2025-01-01", hasta: "2026-04-01" }, "mes"], [{ desde: "2019-01-01", hasta: "2026-04-01" }, "año"]]) {
    const s = serieAltasClientes(rango, [{ fecha: rango.desde, cantidad: 2 }, { fecha: rango.hasta, cantidad: 3 }]);
    assert.equal(s.agrupacion, agrupacion);
    assert.equal(s.puntos.reduce((n, p) => n + p.cantidad, 0), 5);
    assert.equal(s.puntos[0].desde, rango.desde);
    assert.equal(s.puntos.at(-1).hasta, rango.hasta);
  }
});

test("Rango de un día y febrero bisiesto no omiten días ni incluyen datos de afuera", () => {
  assert.equal(serieAltasClientes({ desde: "2026-10-01", hasta: "2026-10-01" }, []).puntos.length, 1);
  const s = serieAltasClientes({ desde: "2024-02-28", hasta: "2024-03-01" }, [{ fecha: "2024-02-29", cantidad: 1 }, { fecha: "2024-03-02", cantidad: 99 }]);
  assert.deepEqual(s.puntos.map((p) => p.cantidad), [0, 1, 0]);
});

test("Demo cuenta altas por registro en horario argentino, igual que Resumen", () => {
  const d = datos([cliente("inicio", { creado_en: "2026-10-01T03:00:00Z" }), cliente("fin", { creado_en: "2026-10-08T02:59:59Z" }),
    cliente("antes", { creado_en: "2026-10-01T02:59:59Z" }), cliente("despues", { creado_en: "2026-10-08T03:00:00Z" })], [caso("c", "antes")]);
  const r = estadisticasClientesDemo(d, periodo);
  assert.equal(r.nuevos.total, 2);
  assert.deepEqual(r.nuevos.por_dia, [{ fecha: "2026-10-01", cantidad: 1 }, { fecha: "2026-10-07", cantidad: 1 }]);
  assert.equal(resumenDashboardDemo(d, periodo).clientes_nuevos, r.nuevos.total);
});

test("Clientes únicos en recurrencia; todos los casos del período en el ranking; historial y futuros no alteran ese orden", () => {
  const d = datos([cliente("a", { nombre: "Ana" }), cliente("b", { nombre: "Beto" }), cliente("c", { nombre: "Carla" })], [
    caso("a-viejo", "a", { abierto_en: "2020-01-01T12:00:00Z" }), caso("a-actual", "a"), caso("b-actual", "b"),
    caso("b-futuro", "b", { abierto_en: "2026-10-08T03:00:00Z" }), caso("c-1", "c"), caso("c-2", "c"),
    caso("anonimo", null), caso("otro-cliente", "no-existe"),
  ]);
  const r = estadisticasClientesDemo(d, periodo);
  assert.deepEqual(r.recurrencia, { clientes_con_casos: 3, clientes_recurrentes: 2, porcentaje: 66.67 });
  assert.deepEqual(r.ranking, [{ cliente_id: "c", nombre: "Carla", casos: 2 }, { cliente_id: "a", nombre: "Ana", casos: 1 }, { cliente_id: "b", nombre: "Beto", casos: 1 }]);
});

test("Demo no mezcla negocios; nombres iguales no fusionan clientes distintos", () => {
  const r = estadisticasClientesDemo(datos([cliente("b", { nombre: "Ana" }), cliente("a", { nombre: "Ana" }), cliente("ajeno", { negocio_id: "b" })], [
    caso("a", "a"), caso("b", "b"), caso("ajeno", "a", { negocio_id: "b" }), caso("invalido", "ajeno"),
  ]), periodo);
  assert.equal(r.nuevos.total, 2);
  assert.equal(r.recurrencia.clientes_con_casos, 2);
  assert.equal(r.recurrencia.porcentaje, 0);
  assert.deepEqual(r.ranking.map((c) => c.cliente_id), ["a", "b"]);
});

test("Sin clientes no inventa recurrencia, ranking ni altas", () => {
  const r = estadisticasClientesDemo(datos(), periodo);
  assert.deepEqual(r.nuevos, { total: 0, por_dia: [] });
  assert.deepEqual(r.recurrencia, { clientes_con_casos: 0, clientes_recurrentes: 0, porcentaje: 0 });
  assert.deepEqual(r.ranking, []);
});
