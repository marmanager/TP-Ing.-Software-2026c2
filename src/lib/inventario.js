// El inventario: cuándo dos productos son el mismo, y cómo se lee una caja.
//
// No tiene React ni Supabase adentro, igual que calendario.js y horarios.js:
// lo corre `npm run test:unit` y lo usan tanto el alta de un producto como la
// llegada de un pedido.

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
    cantidad: entero(cantidad),
    minimo: entero(minimo),
    unidad: enCaja ? "caja" : "unidad",
    por_caja: enCaja ? Math.max(1, entero(porCaja)) : null,
  };
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
