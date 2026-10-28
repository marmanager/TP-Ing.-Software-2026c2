// El inventario: cuándo dos productos son el mismo, qué categorías hay, y
// cómo se lee una caja.
//
// No tiene React ni Supabase adentro, igual que calendario.js y horarios.js:
// lo corre `npm run test:unit` y lo usan tanto el alta de un producto como la
// llegada de un pedido.

import { categoriasDe } from "./presets.js";
import { tCastellano } from "./idioma.js";

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
// Lo que llega del formulario, con los nombres del contrato de la API
// (snake_case, como las columnas). La API limpia por su cuenta con la misma
// regla que limpiarProducto(): acá sólo se traduce, no se decide nada.
//
// Traducir incluye cómo se dice "no se dijo": en el contrato es null, no "".
// La API rechaza un "" donde espera un número, y agregar un producto suelto
// fallaba con "Cuántos vienen por caja va con números.": ese campo arranca
// vacío y nadie lo toca. Por lo mismo, un producto suelto no manda cuántos
// vienen por caja, aunque se haya escrito algo antes de elegir "Suelto".
const oNulo = (v) => (typeof v === "string" && v.trim() === "" ? null : v);

export function productoParaLaApi({ nombre, marca, modelo, categoria, cantidad, minimo, unidad, porCaja }) {
  return {
    nombre: oNulo(nombre),
    marca: oNulo(marca),
    modelo: oNulo(modelo),
    categoria: oNulo(categoria),
    cantidad: oNulo(cantidad),
    minimo: oNulo(minimo),
    unidad,
    por_caja: unidad === "caja" ? oNulo(porCaja) : null,
  };
}

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

// Al revés que limpiarProducto(): de un producto guardado a lo que muestra el
// formulario, todo como texto. Lo usan "Editar" y "Pedirlo" desde el aviso
// de stock bajo; éste pide de a uno, con los mismos datos, para que al
// llegar se sume a ese mismo producto.
export const formDeProducto = (i, { cantidad = i.cantidad } = {}) => ({
  nombre: i.nombre ?? "",
  marca: i.marca ?? "",
  modelo: i.modelo ?? "",
  categoria: i.categoria ?? "",
  cantidad: String(cantidad ?? ""),
  minimo: String(i.minimo ?? ""),
  unidad: i.unidad === "caja" ? "caja" : "unidad",
  porCaja: i.unidad === "caja" && i.por_caja != null ? String(i.por_caja) : "",
});

// Por qué no se puede guardar todavía, o null si se puede. Lo dice el botón
// apagado del alta, del pedido y de "Editar". En el stock puede haber cero;
// un pedido es de al menos uno (desdeUno).
const enteroDesde = (v, desde) => Number.isInteger(Number(v)) && Number(v) >= desde;
export function motivoDelProducto(form, { desdeUno = false } = {}, t = tCastellano) {
  if (!String(form.nombre ?? "").trim()) return t("ui.validaciones.faltaNombre");
  if (form.unidad === "caja" && !enteroDesde(form.porCaja, 1)) return t("inventario.motivo.faltaPorCaja");
  if (desdeUno && !enteroDesde(form.cantidad, 1)) return t("inventario.motivo.cantidadDesdeUno");
  if (Number(form.cantidad) < 0) return t("inventario.motivo.cantidadNegativa");
  return null;
}

// Si al editar un producto del stock queda igual a otro, ése: al guardar se
// juntan (la API hace lo mismo). Un pedido no se junta: todavía no está en el
// estante.
export const igualAlEditar = (insumos, insumo, form) =>
  insumo.estado === "en_stock" ? buscarIgual(insumos, { ...limpiarProducto(form), id: insumo.id }) : null;

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
//
// "guardadas" es la lista que el negocio armó con "Editar categorías" (064):
// si existe, reemplaza a las de fábrica. null es que nunca la editó.
//
// Las de fábrica salen en el idioma de quien mira (idioma, al final). Un
// producto que guardó "Frenos" y alguien que lo mira en inglés ve "Brakes": ver
// categoriaEnIdioma().
export function categoriasDisponibles(rubro, insumos = [], agregadas = [], guardadas = null, idioma = "es") {
  const vistas = new Set();
  const quedarse = (lista) =>
    lista
      .map((c) => categoriaEnIdioma(c, rubro, idioma))
      .filter((c) => {
        const k = claveDeCategoria(c, rubro);
        if (!k || vistas.has(k)) return false;
        vistas.add(k);
        return true;
      });

  const deFabrica = quedarse(Array.isArray(guardadas) ? guardadas : categoriasDe(rubro, idioma));
  const propias = quedarse([...insumos.map((i) => i.categoria), ...agregadas]).sort((a, b) =>
    a.localeCompare(b, idioma)
  );
  return [...deFabrica, ...propias];
}

// Qué es de fábrica y qué escribió el negocio.
//
// Lo que un producto guarda es el texto de la categoría, no un código: quien
// eligió "Frenos" guardó "Frenos", y quien lo hizo en inglés guardó "Brakes".
// Para que las dos se vean y se cuenten como una sola, un texto igual (sin
// mayúsculas ni tildes) a una categoría de fábrica del rubro, en castellano o
// en inglés, cuenta como de fábrica: se muestra en el idioma de quien mira y
// agrupa con la clave castellana. Las que el negocio agregó se ven como las
// escribió. Costo conocido: un negocio que escribe a propósito, como propia, el
// nombre de fábrica del otro idioma la ve traducida (igual que con los nombres
// de estados: lib/presentacion-estados.js).
function indiceDeFabrica(rubro, categoria) {
  const k = normalizar(categoria);
  if (!k) return -1;
  for (const idioma of ["es", "en"]) {
    const i = categoriasDe(rubro, idioma).findIndex((c) => normalizar(c) === k);
    if (i >= 0) return i;
  }
  return -1;
}

// La categoría tal como se muestra en este idioma.
export function categoriaEnIdioma(categoria, rubro, idioma = "es") {
  const i = indiceDeFabrica(rubro, categoria);
  const propia = i >= 0 ? categoriasDe(rubro, idioma)[i] : null;
  return propia && normalizar(propia) !== normalizar(categoria) ? propia : categoria;
}

// Con qué se compara y se agrupa: la misma para "Frenos" y "Brakes".
export function claveDeCategoria(categoria, rubro) {
  const i = indiceDeFabrica(rubro, categoria);
  return normalizar(i >= 0 ? categoriasDe(rubro, "es")[i] : categoria);
}

// Si una categoría nueva ya existe, escrita de otra manera. Para que el "+" no
// deje crear "tornillos" al lado de "Tornillos" (ni "Tornillos" al lado de
// "Screws").
export const categoriaExistente = (nueva, disponibles = [], rubro) =>
  disponibles.find((c) => claveDeCategoria(c, rubro) === claveDeCategoria(nueva, rubro)) ?? null;

// Los productos agrupados por categoría, para la vista "Categorías".
//
// Las categorías en orden alfabético, y "Sin categoría" siempre al final: es
// lo que falta ordenar, no una categoría más. Adentro de cada una, los
// productos también por nombre.
//
// Con { idioma, rubro }, las de fábrica se ven (y ordenan) en ese idioma y las
// guardadas en el otro idioma agrupan con ellas. "Sin categoría" sale de t.
export function porCategoria(insumos = [], { rubro, idioma, t = tCastellano } = {}) {
  const grupos = new Map();
  for (const i of insumos) {
    const escrita = i.categoria?.trim();
    const nombre = escrita
      ? idioma ? categoriaEnIdioma(escrita, rubro, idioma) : escrita
      : t("inventario.sinCategoria");
    const clave = escrita ? (idioma ? claveDeCategoria(escrita, rubro) : normalizar(escrita)) : SIN_CATEGORIA;
    if (!grupos.has(clave)) grupos.set(clave, { clave, categoria: nombre, productos: [] });
    grupos.get(clave).productos.push(i);
  }

  const locale = idioma ?? "es";
  const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, locale);
  return [...grupos.values()]
    .map((g) => ({ ...g, productos: g.productos.sort(porNombre) }))
    .sort((a, b) => {
      if (a.clave === SIN_CATEGORIA) return 1;
      if (b.clave === SIN_CATEGORIA) return -1;
      return a.categoria.localeCompare(b.categoria, locale);
    })
    .map(({ clave, ...g }) => (clave === SIN_CATEGORIA ? { ...g, sinCategoria: true } : g));
}

// ------------------------------------------------------------
// Cómo se lee una cantidad
// ------------------------------------------------------------
// Lo que va al lado del número: "unidades", "cajas de 100".
//
// En caja, la cantidad y el mínimo se cuentan en cajas, que es como se cuentan
// en el estante. Si "unidad" trae otra cosa —un dato viejo escrito a mano—
// se muestra tal cual antes que inventarle un plural.
export function presentacion({ unidad, por_caja }, cantidad = 0, t = tCastellano) {
  // Una caja sin "por_caja" (dato incompleto) es sólo "caja(s)": nunca "de undefined".
  if (unidad === "caja") {
    return por_caja
      ? t("inventario.presentacion.caja", { n: cantidad, porCaja: por_caja })
      : t("dashboard.inventario.cajas", { n: cantidad });
  }
  if (!unidad || unidad === "unidad") return t("inventario.presentacion.unidad", { n: cantidad });
  return unidad;
}

// Cuántas unidades hay en total, si viene en caja. Nulo si viene suelto: ahí
// el número de al lado ya es el total.
export const enTotal = ({ unidad, por_caja, cantidad }) =>
  unidad === "caja" && por_caja > 0 ? cantidad * por_caja : null;

// ------------------------------------------------------------
// Buscar y filtrar el stock (SCRUM-81)
// ------------------------------------------------------------
// Los filtros salen de lo que tienen cargado los productos, no de una lista
// fija: si ninguno tiene marca, no hay filtro de marca. Ofrecer "Marca" en un
// negocio que nunca cargó una es un botón que no hace nada.

// Lo que se puede filtrar, en el orden en que aparece. "unidad" es cómo viene
// el producto: suelto o en caja.
const CARACTERISTICAS = ["categoria", "marca", "modelo", "unidad"];

// El valor de un producto para una característica, listo para comparar. Sin
// "unidad" cargada es suelto, como en mismoProducto(). La categoría compara
// por claveDeCategoria(): "Frenos" y "Brakes" son un solo valor.
const valorDe = (producto, clave, rubro) =>
  clave === "unidad"
    ? producto.unidad === "caja"
      ? "caja"
      : "unidad"
    : clave === "categoria"
      ? claveDeCategoria(producto.categoria, rubro)
      : normalizar(producto[clave]);

// Los grupos de filtros que tiene sentido ofrecer, con cuántos productos tiene
// cada valor.
//
// Lo mismo escrito distinto ("Bosch" y "bosch") es un solo valor, que se
// muestra como apareció primero: dos pastillas iguales obligan a tocar las
// dos. "Cómo viene" sólo aparece si algo viene en caja: si todo es suelto,
// elegir "Suelto" no filtra nada.
//
// `opciones` es { rubro, idioma, t }: las categorías de fábrica se ven en ese
// idioma, y los títulos y "Suelto" / "En caja" salen de t.
export function filtrosDisponibles(productos = [], { rubro, idioma = "es", t = tCastellano } = {}) {
  const grupos = [];
  for (const clave of CARACTERISTICAS) {
    const titulo = t(`inventario.filtro.${clave}`);
    const opciones = new Map();
    for (const p of productos) {
      const valor = valorDe(p, clave, rubro);
      if (!valor) continue;
      if (!opciones.has(valor)) {
        const escrita = clave === "unidad" ? "" : String(p[clave]).trim().replace(/\s+/g, " ");
        const etiqueta =
          clave === "unidad"
            ? t(`inventario.comoViene.${valor}`)
            : clave === "categoria"
              ? categoriaEnIdioma(escrita, rubro, idioma)
              : escrita;
        opciones.set(valor, { valor, etiqueta, cuantos: 0 });
      }
      opciones.get(valor).cuantos += 1;
    }

    if (opciones.size === 0) continue;
    if (clave === "unidad" && !opciones.has("caja")) continue;

    // Cómo viene tiene un orden propio, suelto primero; el resto, alfabético.
    const lista =
      clave === "unidad"
        ? ["unidad", "caja"].filter((v) => opciones.has(v)).map((v) => opciones.get(v))
        : [...opciones.values()].sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, idioma));
    grupos.push({ clave, titulo, opciones: lista });
  }
  return grupos;
}

// Los productos que coinciden con la búsqueda y con los filtros elegidos.
//
// La búsqueda mira nombre, marca, modelo y categoría, sin mayúsculas ni
// tildes. De los filtros, adentro de un grupo se suma ("Bosch o NGK") y entre
// grupos se restringe ("Bosch y Filtros"): es como funciona un filtro en
// cualquier lado, y lo que la persona espera sin pensarlo.
//
// `elegidos` es { clave: [valores] }, con los valores como los da
// filtrosDisponibles().
//
// Con { rubro, idioma }, buscar también encuentra la categoría de fábrica en
// el idioma de quien mira ("brakes" encuentra lo que se guardó como "Frenos").
export function filtrarProductos(productos = [], { texto = "", elegidos = {}, rubro, idioma } = {}) {
  const buscado = normalizar(texto);
  const grupos = Object.entries(elegidos).filter(([, valores]) => valores?.length);
  return productos.filter((p) => {
    if (buscado) {
      const visible = idioma ? categoriaEnIdioma(p.categoria, rubro, idioma) : p.categoria;
      const donde = [p.nombre, p.marca, p.modelo, p.categoria, visible].map(normalizar).join(" ");
      if (!donde.includes(buscado)) return false;
    }
    return grupos.every(([clave, valores]) => valores.includes(valorDe(p, clave, rubro)));
  });
}

// Elegir un valor, o sacarlo si ya estaba. No cambia lo de antes, y no deja
// grupos vacíos: sin valores, el grupo no restringe nada y se borra.
export function alternarFiltro(elegidos = {}, clave, valor) {
  const actuales = elegidos[clave] ?? [];
  const nuevos = actuales.includes(valor)
    ? actuales.filter((v) => v !== valor)
    : [...actuales, valor];
  const { [clave]: _anterior, ...resto } = elegidos;
  return nuevos.length ? { ...resto, [clave]: nuevos } : resto;
}

// Cuántos valores hay elegidos, para "Filtros · 2".
export const cuantosFiltros = (elegidos = {}) =>
  Object.values(elegidos).reduce((total, valores) => total + valores.length, 0);

// Lo elegido que todavía existe. Si se borra el único producto de una marca,
// su pastilla desaparece; si la elección quedara, la lista se vería vacía y no
// habría nada a la vista para destrabarla.
export function soloVigentes(elegidos = {}, grupos = []) {
  const vigentes = {};
  for (const [clave, valores] of Object.entries(elegidos)) {
    const grupo = grupos.find((g) => g.clave === clave);
    const quedan = valores.filter((v) => grupo?.opciones.some((o) => o.valor === v));
    if (quedan.length) vigentes[clave] = quedan;
  }
  return vigentes;
}

// La búsqueda de la vista Categorías, sobre lo que arma porCategoria().
//
// Si coincide el nombre de la categoría, se ve entera. Si no, pero coincide el
// nombre de algún producto, se ve la categoría con sólo esos productos: es la
// respuesta a "¿dónde está la bujía?". Una categoría sin nada que coincida no
// aparece.
export function buscarEnCategorias(grupos = [], texto = "") {
  const buscado = normalizar(texto);
  if (!buscado) return grupos;
  return grupos.flatMap((g) => {
    if (normalizar(g.categoria).includes(buscado)) return [g];
    const productos = g.productos.filter((p) => normalizar(p.nombre).includes(buscado));
    return productos.length ? [{ ...g, productos }] : [];
  });
}

// ------------------------------------------------------------
// Lo que se guarda (la API compara el texto, no el idioma)
// ------------------------------------------------------------
// Se muestra en el idioma de quien mira, pero se guarda la forma castellana de
// fábrica: si no, "Filters" y "Filtros" serían dos categorías para la API, que
// al guardar la lista saca la categoría de todo producto cuyo texto no esté
// en ella. Una categoría propia se guarda tal cual se escribió, y una de
// fábrica ya escrita en castellano (aunque con otras mayúsculas) también.
export function categoriaParaGuardar(categoria, rubro) {
  const i = indiceDeFabrica(rubro, categoria);
  const fabrica = i >= 0 ? categoriasDe(rubro, "es")[i] : null;
  return fabrica && normalizar(fabrica) !== normalizar(categoria) ? fabrica : categoria;
}

// La lista de "Editar categorías" lista para mandar: cada una en su forma
// guardable, sin repetir, y con la forma escrita de cada categoría que sigue
// en uso (un producto guardado como "Filters" antes de esto): la API compara
// texto y, sin ella, esos productos se quedarían sin categoría.
export function listaParaGuardar(lista = [], insumos = [], rubro) {
  const vistas = new Set();
  const salida = [];
  const sumar = (c) => {
    const k = normalizar(c);
    if (!k || vistas.has(k)) return;
    vistas.add(k);
    salida.push(c);
  };
  lista.forEach((c) => sumar(categoriaParaGuardar(c, rubro)));
  const quedan = new Set(salida.map((c) => claveDeCategoria(c, rubro)));
  for (const i of insumos) {
    if (i.categoria && quedan.has(claveDeCategoria(i.categoria, rubro))) sumar(i.categoria.replace(/\s+/g, " "));
  }
  return salida;
}
