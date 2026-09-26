// El inventario: cuándo dos productos son el mismo, qué categorías hay, y
// cómo se lee una caja.
//
// No tiene React ni Supabase adentro, igual que calendario.js y horarios.js:
// lo corre `npm run test:unit` y lo usan tanto el alta de un producto como la
// llegada de un pedido.

import { categoriasDe } from "./presets.js";

// La categoría de un producto que no tiene ninguna, para agrupar y mostrar.
export const SIN_CATEGORIA = "Sin categoría";

// ------------------------------------------------------------
// Cuándo dos productos son el mismo
// ------------------------------------------------------------
// Para comparar lo que escribió una persona con lo que escribió otra.
//
// Sin mayúsculas, sin espacios de más y sin tildes: "Bujía NGK" y "bujia  ngk"
// son lo mismo en el estante, y tratarlos como dos productos es exactamente el
// problema que esto resuelve.
//
// LA Ñ SE QUEDA. NFD separa cada letra de su tilde para poder sacarla, y la ñ
// también se separa en "n" más una tilde: sin cuidarla, "caño" y "cano" darían
// el mismo producto. Por eso se pasa primero a NFC (una sola letra aunque haya
// llegado descompuesta), se aparta, y se devuelve después de sacar las tildes.
const MARCA_ENIE = "\u0001";

export function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/ñ/g, MARCA_ENIE)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(new RegExp(MARCA_ENIE, "g"), "ñ")
    .replace(/\s+/g, " ")
    .trim();
}

// Dos productos son el mismo si coinciden nombre, marca, modelo y cómo vienen.
//
// "Cómo vienen" entra en la cuenta a propósito: una caja de 100 tornillos y una
// de 50 del mismo tornillo no se pueden sumar en cajas —3 cajas más 2 cajas no
// son 5 cajas de nada—, así que son dos líneas del inventario.
//
// La categoría NO entra: es cómo se ordena, no qué es. El mismo filtro puesto
// en "Filtros" por uno y en "Repuestos" por otro sigue siendo un solo filtro.
export function mismoProducto(a, b) {
  if (!a || !b) return false;
  return (
    normalizar(a.nombre) === normalizar(b.nombre) &&
    normalizar(a.marca) === normalizar(b.marca) &&
    normalizar(a.modelo) === normalizar(b.modelo) &&
    (a.unidad || "unidad") === (b.unidad || "unidad") &&
    (a.unidad === "caja" ? Number(a.por_caja) === Number(b.por_caja) : true)
  );
}

// El producto del stock igual a éste, si hay. Sólo se busca en lo que está en
// stock: un pedido que todavía no llegó no es algo a lo que se le pueda sumar.
export const buscarIgual = (insumos = [], producto) =>
  insumos.find((i) => i.estado === "en_stock" && i.id !== producto?.id && mismoProducto(i, producto)) ??
  null;

// Lo que llega del formulario, listo para guardar: sin espacios de más, lo
// vacío como nulo y los números como números.
//
// Nulo y no "" para lo que no se dijo: "sin marca" no es una marca, y en la
// base dos productos sin marca tienen que comparar igual.
export function limpiarProducto({
  nombre,
  marca,
  modelo,
  categoria,
  cantidad,
  minimo,
  unidad,
  porCaja,
}) {
  const texto = (v) => (String(v ?? "").trim() ? String(v).trim().replace(/\s+/g, " ") : null);
  const entero = (v) => Math.max(0, Math.floor(Number(v) || 0));
  const enCaja = unidad === "caja";
  return {
    nombre: texto(nombre) ?? "",
    marca: texto(marca),
    modelo: texto(modelo),
    categoria: texto(categoria),
    cantidad: entero(cantidad),
    minimo: entero(minimo),
    unidad: enCaja ? "caja" : "unidad",
    por_caja: enCaja ? Math.max(1, entero(porCaja)) : null,
  };
}

// ------------------------------------------------------------
// Las categorías
// ------------------------------------------------------------
// Las que ofrece el alta: las de fábrica del rubro, más las que ya usan los
// productos del negocio, más las recién agregadas con el "+" que todavía no
// usa nadie.
//
// Sin repetir aunque estén escritas distinto ("Tornillos" y "tornillos"): se
// queda la primera forma que aparece, que es la del rubro si es una de ésas.
// Las de fábrica van primero y en su orden; las del negocio, después y en
// orden alfabético.
export function categoriasDisponibles(rubro, insumos = [], agregadas = []) {
  const vistas = new Set();
  const quedarse = (lista) =>
    lista.filter((c) => {
      const k = normalizar(c);
      if (!k || vistas.has(k)) return false;
      vistas.add(k);
      return true;
    });

  const deFabrica = quedarse(categoriasDe(rubro));
  const propias = quedarse([...insumos.map((i) => i.categoria), ...agregadas]).sort((a, b) =>
    a.localeCompare(b, "es")
  );
  return [...deFabrica, ...propias];
}

// Si una categoría nueva ya existe, escrita de otra manera. Para que el "+" no
// deje crear "tornillos" al lado de "Tornillos".
export const categoriaExistente = (nueva, disponibles = []) =>
  disponibles.find((c) => normalizar(c) === normalizar(nueva)) ?? null;

// Los productos agrupados por categoría, para la vista "Categorías".
//
// Las categorías en orden alfabético, y "Sin categoría" siempre al final: es
// lo que falta ordenar, no una categoría más. Adentro de cada una, los
// productos también por nombre.
export function porCategoria(insumos = []) {
  const grupos = new Map();
  for (const i of insumos) {
    const nombre = i.categoria?.trim() || SIN_CATEGORIA;
    const clave = nombre === SIN_CATEGORIA ? SIN_CATEGORIA : normalizar(nombre);
    if (!grupos.has(clave)) grupos.set(clave, { categoria: nombre, productos: [] });
    grupos.get(clave).productos.push(i);
  }

  const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, "es");
  return [...grupos.values()]
    .map((g) => ({ ...g, productos: g.productos.sort(porNombre) }))
    .sort((a, b) => {
      if (a.categoria === SIN_CATEGORIA) return 1;
      if (b.categoria === SIN_CATEGORIA) return -1;
      return a.categoria.localeCompare(b.categoria, "es");
    });
}

// ------------------------------------------------------------
// Cómo se lee una cantidad
// ------------------------------------------------------------
// Lo que va al lado del número: "unidades", "cajas de 100".
//
// En caja, la cantidad y el mínimo se cuentan en cajas, que es como se cuentan
// en el estante. Si "unidad" trae otra cosa —un dato viejo escrito a mano—
// se muestra tal cual antes que inventarle un plural.
export function presentacion({ unidad, por_caja }, cantidad = 0) {
  if (unidad === "caja") {
    return `${cantidad === 1 ? "caja" : "cajas"} de ${por_caja}`;
  }
  if (!unidad || unidad === "unidad") return cantidad === 1 ? "unidad" : "unidades";
  return unidad;
}

// Cuántas unidades hay en total, si viene en caja. Nulo si viene suelto: ahí
// el número de al lado ya es el total.
export const enTotal = ({ unidad, por_caja, cantidad }) =>
  unidad === "caja" && por_caja > 0 ? cantidad * por_caja : null;
