import { hijosActivos } from "./modulos.js";
import { normalizar, SIN_CATEGORIA } from "./inventario.js";

// Sólo para el modo de ejemplo. En cuentas reales la API recorre todas las
// filas; las listas parciales cargadas en el navegador no determinan totales.
export function estadisticasInventarioDemo(datos) {
  const hijos = hijosActivos("inventario", datos.negocio?.modulos_activos ?? []);
  const conStock = hijos.some((h) => h.clave === "stock");
  const conPedidos = hijos.some((h) => h.clave === "en_camino");
  const productos = (datos.insumos ?? []).filter((i) => !i.negocio_id || i.negocio_id === datos.negocio?.id);
  const stock = productos.filter((i) => i.estado === "en_stock");
  const pedidos = productos.filter((i) => i.estado === "pedido");
  const categorias = new Map();
  for (const producto of stock) {
    const nombre = producto.categoria?.trim().replace(/\s+/g, " ") || SIN_CATEGORIA;
    const clave = normalizar(nombre);
    const anterior = categorias.get(clave);
    categorias.set(clave, {
      categoria: clave === "sin categoria" ? SIN_CATEGORIA : anterior?.categoria ?? nombre,
      cantidad: (anterior?.cantidad ?? 0) + 1,
    });
  }
  const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, "es") || a.id.localeCompare(b.id);
  return {
    negocio_id: datos.negocio?.id,
    actualizado_en: new Date().toISOString(),
    stock: conStock ? {
      total_productos: stock.length,
      sin_stock: { total: stock.filter((i) => i.cantidad === 0).length, productos: stock.filter((i) => i.cantidad === 0).sort(porNombre) },
      en_minimo: { total: stock.filter((i) => i.cantidad > 0 && i.cantidad <= i.minimo).length, productos: stock.filter((i) => i.cantidad > 0 && i.cantidad <= i.minimo).sort(porNombre) },
      por_categoria: [...categorias.values()].sort((a, b) => {
        if (a.categoria === SIN_CATEGORIA) return 1;
        if (b.categoria === SIN_CATEGORIA) return -1;
        return b.cantidad - a.cantidad || a.categoria.localeCompare(b.categoria, "es");
      }),
    } : null,
    pedidos_pendientes: conPedidos ? {
      total: pedidos.length,
      pedidos: [...pedidos].sort((a, b) => (a.creado_en ?? "").localeCompare(b.creado_en ?? "") || porNombre(a, b)),
    } : null,
  };
}
