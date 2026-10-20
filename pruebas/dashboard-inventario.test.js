import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { estadisticasInventarioDemo } from "../src/lib/dashboard-inventario.js";
import { resumenDashboardDemo } from "../src/lib/dashboard.js";

const producto = (id, extra = {}) => ({ id, nombre: id, negocio_id: "a", cantidad: 5, minimo: 2, unidad: "unidad", categoria: null, estado: "en_stock", creado_en: "2020-01-01T12:00:00Z", ...extra });
const datos = (insumos, modulos = ["dashboard", "inventario"]) => ({ negocio: { id: "a", modulos_activos: modulos }, insumos });

test("Cero no se cuenta como mínimo, y el límite exacto sí necesita reposición", () => {
  const d = datos([producto("cero", { cantidad: 0 }), producto("cero-min", { cantidad: 0, minimo: 0 }), producto("min", { cantidad: 2 }), producto("bajo", { cantidad: 1 }), producto("bien")]);
  const r = estadisticasInventarioDemo(d);
  assert.equal(r.stock.sin_stock.total, 2);
  assert.equal(r.stock.en_minimo.total, 2);
  assert.equal(r.stock.total_productos, 5);
  assert.equal(resumenDashboardDemo(d, { desde: "2026-10-01", hasta: "2026-10-07" }).productos_reponer, 4);
});

test("Categorías agrupan variantes y vacíos; cuentan productos con cantidad cero, sin sumar existencias", () => {
  const r = estadisticasInventarioDemo(datos([
    producto("a", { categoria: "Lubricación", cantidad: 100, unidad: "litros" }), producto("b", { categoria: " lubricacion ", cantidad: 0 }),
    producto("c"), producto("d", { categoria: "  " }), producto("e", { categoria: "Otra" }), producto("pedido", { estado: "pedido", categoria: "No es stock" }),
  ]));
  assert.deepEqual(r.stock.por_categoria, [{ categoria: "Lubricación", cantidad: 2 }, { categoria: "Otra", cantidad: 1 }, { categoria: "Sin categoría", cantidad: 2 }]);
  assert.equal(r.stock.por_categoria.reduce((s, g) => s + g.cantidad, 0), r.stock.total_productos);
});

test("Unidades y cajas se conservan por producto y por pedido", () => {
  const r = estadisticasInventarioDemo(datos([
    producto("litros", { cantidad: 1.5, unidad: "litros" }), producto("piezas", { cantidad: 2, unidad: "piezas" }),
    producto("caja", { cantidad: 1, unidad: "caja", por_caja: 100 }), producto("pedido", { estado: "pedido", cantidad: 50, unidad: "litros" }),
  ]));
  assert.equal(r.stock.en_minimo.total, 3);
  assert.deepEqual(r.stock.en_minimo.productos.map((p) => p.unidad), ["caja", "litros", "piezas"]);
  assert.equal(r.stock.en_minimo.productos[0].por_caja, 100);
  assert.equal(r.pedidos_pendientes.total, 1);
  assert.equal(r.pedidos_pendientes.pedidos[0].cantidad, 50);
});

test("Pedidos excluyen llegados y stock, respetan el negocio y ordenan primero los más antiguos", () => {
  const r = estadisticasInventarioDemo(datos([
    producto("viejo", { estado: "pedido" }), producto("nuevo", { estado: "pedido", creado_en: "2030-01-01T12:00:00Z" }),
    producto("llegado", { estado: "llegado" }), producto("usado", { estado: "usado" }), producto("stock"),
    producto("ajeno", { negocio_id: "b", estado: "pedido" }), producto("stock-ajeno", { negocio_id: "b" }),
  ]));
  assert.equal(r.stock.total_productos, 1);
  assert.equal(r.pedidos_pendientes.total, 2);
  assert.deepEqual(r.pedidos_pendientes.pedidos.map((p) => p.id), ["viejo", "nuevo"]);
});

test("Submódulos de stock y pedidos siguen la configuración y el Inventario apagado no aporta datos", () => {
  const filas = [producto("stock"), producto("pedido", { estado: "pedido" })];
  const ambos = estadisticasInventarioDemo(datos(filas));
  assert.equal(ambos.stock.total_productos, 1);
  assert.equal(ambos.pedidos_pendientes.total, 1);
  const pedidos = estadisticasInventarioDemo(datos(filas, ["dashboard", "inventario", "en_camino"]));
  assert.equal(pedidos.stock, null);
  assert.equal(pedidos.pedidos_pendientes.total, 1);
  const stock = estadisticasInventarioDemo(datos(filas, ["dashboard", "inventario", "stock"]));
  assert.equal(stock.stock.total_productos, 1);
  assert.equal(stock.pedidos_pendientes, null);
  const apagado = estadisticasInventarioDemo(datos(filas, ["dashboard"]));
  assert.equal(apagado.stock, null);
  assert.equal(apagado.pedidos_pendientes, null);
});

test("Sin datos conserva ceros, listas vacías y no depende de un período histórico", () => {
  const r = estadisticasInventarioDemo(datos([]));
  assert.equal(r.stock.total_productos, 0);
  assert.deepEqual(r.stock.por_categoria, []);
  assert.deepEqual(r.stock.sin_stock, { total: 0, productos: [] });
  assert.deepEqual(r.pedidos_pendientes, { total: 0, pedidos: [] });
  assert.equal(r.periodo, undefined);
});
