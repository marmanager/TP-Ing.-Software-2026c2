import { hijosActivos } from "./modulos.js";
import { categoriaEnIdioma, claveDeCategoria, normalizar, SIN_CATEGORIA } from "./inventario.js";
import { tCastellano } from "./idioma.js";

// Sólo para el modo de ejemplo. En cuentas reales la API recorre todas las
// filas; las listas parciales cargadas en el navegador no determinan totales.
export function estadisticasInventarioDemo(datos) {
  const hijos = hijosActivos("inventario", datos.negocio?.modulos_activos ?? []);
  const conStock = hijos.some((h) => h.clave === "stock");
  const conPedidos = hijos.some((h) => h.clave === "en_camino");
  const productos = (datos.insumos ?? []).filter((i) => !i.negocio_id || i.negocio_id === datos.negocio?.id);
  const stock = productos.filter((i) => i.estado === "en_stock");
  const pedidos = productos.filter((i) => i.estado === "pedido");
  // Se agrupa por claveDeCategoria: "Filtros" (castellano) y "Filters" (inglés)
  // de fábrica son una sola categoría. Queda la primera forma que aparece; el
  // idioma de quien mira se aplica al mostrar (categoriasParaMostrar).
  const rubro = datos.negocio?.rubro;
  const categorias = new Map();
  for (const producto of stock) {
    const nombre = producto.categoria?.trim().replace(/\s+/g, " ") || SIN_CATEGORIA;
    const clave = claveDeCategoria(nombre, rubro);
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

// Las categorías del gráfico, listas para mostrar. Vienen de la API ya contadas
// por el texto que cada producto tiene guardado, así que "Filtros" y "Filters"
// (el mismo nombre de fábrica en los dos idiomas) llegan como dos filas: acá se
// juntan por claveDeCategoria y se muestran en el idioma de quien mira. Las
// propias del negocio quedan como las escribió. Si nada se junta, el orden de
// la API se respeta tal cual.
export function categoriasParaMostrar(porCategoria = [], { rubro, idioma = "es", t = tCastellano } = {}) {
  const grupos = new Map();
  let juntadas = false;
  for (const fila of porCategoria) {
    const sin = normalizar(fila.categoria) === normalizar(SIN_CATEGORIA);
    const clave = sin ? SIN_CATEGORIA : claveDeCategoria(fila.categoria, rubro);
    const previo = grupos.get(clave);
    if (previo) {
      previo.cantidad += fila.cantidad;
      juntadas = true;
    } else {
      grupos.set(clave, {
        categoria: sin ? t("inventario.sinCategoria") : categoriaEnIdioma(fila.categoria, rubro, idioma),
        cantidad: fila.cantidad,
        sin,
      });
    }
  }
  const lista = [...grupos.values()];
  if (juntadas) {
    lista.sort((a, b) => {
      if (a.sin !== b.sin) return a.sin ? 1 : -1;
      return b.cantidad - a.cantidad || a.categoria.localeCompare(b.categoria, idioma);
    });
  }
  return lista.map(({ sin, ...fila }) => fila);
}
