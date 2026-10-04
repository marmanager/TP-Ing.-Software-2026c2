// Correr con: npm run test:unit
//
// El inventario: cuándo dos productos son el mismo (y se suman en vez de
// quedar dos filas), las categorías, y cómo se lee una caja.
//
// Lo que más se cuida es "mismo producto". Si es demasiado estricto, lo que
// alguien escribió con una mayúscula distinta queda duplicado, que es el
// problema que esto viene a resolver. Si es demasiado flojo, junta dos
// productos distintos y el número del estante miente.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import {
  SIN_CATEGORIA,
  buscarIgual,
  categoriaExistente,
  categoriasDisponibles,
  enTotal,
  limpiarProducto,
  productoParaLaApi,
  mismoProducto,
  normalizar,
  porCategoria,
  presentacion,
  alternarFiltro,
  buscarEnCategorias,
  cuantosFiltros,
  filtrarProductos,
  filtrosDisponibles,
  soloVigentes,
} from "../src/lib/inventario.js";

// ---------- normalizar ----------

test("sin mayúsculas, sin espacios de más y sin tildes", () => {
  assert.equal(normalizar("  Bujía   NGK "), "bujia ngk");
});

test("la ñ no se confunde con la n", () => {
  // Sacar las tildes también le saca el "moño" a la ñ si no se la cuida.
  assert.notEqual(normalizar("caño"), normalizar("cano"));
  assert.equal(normalizar("Caño"), "caño");
});

test("una ñ que llegó descompuesta se lee igual que una entera", () => {
  const descompuesta = "can\u0303o"; // "n" + tilde combinable
  assert.equal(normalizar(descompuesta), normalizar("caño"));
});

test("nada o vacío dan texto vacío", () => {
  assert.equal(normalizar(null), "");
  assert.equal(normalizar(undefined), "");
  assert.equal(normalizar("   "), "");
});

// ---------- mismo producto ----------

const p = (extra = {}) => ({
  nombre: "Filtro de aceite",
  marca: "Mann",
  modelo: "W 712",
  unidad: "unidad",
  por_caja: null,
  ...extra,
});

test("el mismo producto escrito distinto es el mismo", () => {
  assert.ok(mismoProducto(p(), p({ nombre: "filtro  de ACEITE", marca: "mann ", modelo: "w 712" })));
});

test("otra marca es otro producto", () => {
  assert.ok(!mismoProducto(p(), p({ marca: "Fram" })));
});

test("otro modelo es otro producto", () => {
  assert.ok(!mismoProducto(p(), p({ modelo: "W 610" })));
});

test("sin marca y sin marca son iguales", () => {
  // Nulo, vacío y espacios quieren decir lo mismo: no se dijo.
  assert.ok(mismoProducto(p({ marca: null }), p({ marca: "" })));
  assert.ok(mismoProducto(p({ modelo: undefined }), p({ modelo: "  " })));
});

test("con marca y sin marca no son el mismo", () => {
  assert.ok(!mismoProducto(p({ marca: "Mann" }), p({ marca: null })));
});

test("suelto y en caja no son el mismo", () => {
  assert.ok(!mismoProducto(p(), p({ unidad: "caja", por_caja: 10 })));
});

test("una caja de 100 y una de 50 no se pueden sumar", () => {
  // 3 cajas de 100 más 2 cajas de 50 no son 5 cajas de nada.
  assert.ok(!mismoProducto(p({ unidad: "caja", por_caja: 100 }), p({ unidad: "caja", por_caja: 50 })));
});

test("dos cajas del mismo tamaño sí son el mismo", () => {
  assert.ok(mismoProducto(p({ unidad: "caja", por_caja: 100 }), p({ unidad: "caja", por_caja: "100" })));
});

test("la categoría no cambia qué producto es", () => {
  // Es cómo se ordena, no qué es.
  assert.ok(mismoProducto(p({ categoria: "Filtros" }), p({ categoria: "Repuestos" })));
});

test("un dato viejo sin unidad cuenta como suelto", () => {
  assert.ok(mismoProducto(p({ unidad: undefined }), p({ unidad: "unidad" })));
});

// ---------- buscar el igual en el stock ----------

test("encuentra el igual que está en stock", () => {
  const stock = [{ id: "a", estado: "en_stock", cantidad: 5, ...p() }];
  assert.equal(buscarIgual(stock, p({ nombre: "FILTRO DE ACEITE" }))?.id, "a");
});

test("un pedido que no llegó no cuenta como igual", () => {
  // No se le puede sumar a algo que todavía no está en el estante.
  const stock = [{ id: "a", estado: "pedido", cantidad: 5, ...p() }];
  assert.equal(buscarIgual(stock, p()), null);
});

test("no se encuentra a sí mismo", () => {
  // Al llegar un pedido se busca un igual en el stock, y ese pedido no puede
  // ser su propio igual.
  const yo = { id: "a", estado: "en_stock", cantidad: 5, ...p() };
  assert.equal(buscarIgual([yo], yo), null);
});

test("sin nada en stock no hay igual", () => {
  assert.equal(buscarIgual([], p()), null);
  assert.equal(buscarIgual(undefined, p()), null);
});

// ---------- limpiar lo del formulario ----------

test("lo vacío queda nulo, y los espacios de más se van", () => {
  const l = limpiarProducto({ nombre: "  Tornillo   Parker ", marca: "  ", modelo: "", categoria: " " });
  assert.equal(l.nombre, "Tornillo Parker");
  assert.equal(l.marca, null);
  assert.equal(l.modelo, null);
  assert.equal(l.categoria, null);
});

test("las cantidades quedan enteras y nunca negativas", () => {
  const l = limpiarProducto({ nombre: "x", cantidad: "3.7", minimo: "-2" });
  assert.equal(l.cantidad, 3);
  assert.equal(l.minimo, 0);
});

test("suelto no guarda cuántos vienen por caja", () => {
  const l = limpiarProducto({ nombre: "x", unidad: "unidad", porCaja: "100" });
  assert.equal(l.unidad, "unidad");
  assert.equal(l.por_caja, null);
});

test("en caja guarda cuántos vienen, y nunca menos de uno", () => {
  assert.equal(limpiarProducto({ nombre: "x", unidad: "caja", porCaja: "100" }).por_caja, 100);
  assert.equal(limpiarProducto({ nombre: "x", unidad: "caja", porCaja: "0" }).por_caja, 1);
});

test("una unidad que no conocemos se guarda como suelto", () => {
  assert.equal(limpiarProducto({ nombre: "x", unidad: "loquesea" }).unidad, "unidad");
});

// ---------- lo que se manda a la API ----------

test("a la API va lo del formulario con los nombres del contrato, sin decidir nada", () => {
  const form = { nombre: " Tornillo ", marca: "", modelo: "M6", categoria: "Bulones",
    cantidad: "3", minimo: "1", unidad: "caja", porCaja: "100" };
  assert.deepEqual(productoParaLaApi(form), {
    nombre: " Tornillo ", marca: "", modelo: "M6", categoria: "Bulones",
    cantidad: "3", minimo: "1", unidad: "caja", por_caja: "100",
  });
});

test("lo que no es del producto no viaja a la API (ni un negocio_id)", () => {
  const enviado = productoParaLaApi({ nombre: "x", negocio_id: "otro", id: "i1" });
  assert.equal("negocio_id" in enviado, false);
  assert.equal("id" in enviado, false);
});

// ---------- categorías ----------

test("arranca con las de fábrica del rubro, en su orden", () => {
  const cs = categoriasDisponibles("taller", []);
  assert.equal(cs[0], "Repuestos");
  assert.ok(cs.includes("Tornillos"));
});

test("suma las que ya usan los productos del negocio", () => {
  const cs = categoriasDisponibles("taller", [{ categoria: "Juntas" }]);
  assert.ok(cs.includes("Juntas"));
});

test("suma las recién agregadas con el más", () => {
  assert.ok(categoriasDisponibles("taller", [], ["Correas"]).includes("Correas"));
});

test("no repite una categoría escrita distinto, y se queda con la del rubro", () => {
  const cs = categoriasDisponibles("taller", [{ categoria: "tornillos" }], ["TORNILLOS"]);
  assert.equal(cs.filter((c) => normalizar(c) === "tornillos").length, 1);
  assert.ok(cs.includes("Tornillos"));
});

test("las del negocio van después de las de fábrica, en orden alfabético", () => {
  const cs = categoriasDisponibles("taller", [{ categoria: "Juntas" }, { categoria: "Correas" }]);
  const propias = cs.slice(cs.indexOf("Correas"));
  assert.deepEqual(propias, ["Correas", "Juntas"]);
});

test("un producto sin categoría no agrega una categoría vacía", () => {
  const cs = categoriasDisponibles("taller", [{ categoria: null }, { categoria: "  " }]);
  assert.ok(!cs.some((c) => !c.trim()));
});

test("el más reconoce una categoría que ya existe escrita de otra manera", () => {
  assert.equal(categoriaExistente("tornillos", ["Repuestos", "Tornillos"]), "Tornillos");
  assert.equal(categoriaExistente("Juntas", ["Repuestos", "Tornillos"]), null);
});

// ---------- agrupar por categoría ----------

const prod = (nombre, categoria) => ({ id: nombre, nombre, categoria });

test("agrupa por categoría, en orden alfabético", () => {
  const g = porCategoria([prod("llave", "Herramientas"), prod("aceite", "Lubricantes"), prod("martillo", "Herramientas")]);
  assert.deepEqual(g.map((x) => x.categoria), ["Herramientas", "Lubricantes"]);
  assert.equal(g[0].productos.length, 2);
});

test("adentro de cada categoría, por nombre", () => {
  const g = porCategoria([prod("martillo", "Herramientas"), prod("llave", "Herramientas")]);
  assert.deepEqual(g[0].productos.map((x) => x.nombre), ["llave", "martillo"]);
});

test("lo que no tiene categoría va al final", () => {
  const g = porCategoria([prod("x", null), prod("a", "Aceites"), prod("z", "Zapatas")]);
  assert.equal(g.at(-1).categoria, SIN_CATEGORIA);
});

test("la misma categoría escrita distinto es un solo grupo", () => {
  const g = porCategoria([prod("a", "Tornillos"), prod("b", "tornillos ")]);
  assert.equal(g.length, 1);
  assert.equal(g[0].productos.length, 2);
});

test("ningún producto se pierde al agrupar", () => {
  const todos = [prod("a", "X"), prod("b", null), prod("c", "Y"), prod("d", "x")];
  const g = porCategoria(todos);
  assert.equal(g.reduce((n, x) => n + x.productos.length, 0), todos.length);
});

// ---------- cómo se lee una cantidad ----------

test("suelto: unidad o unidades", () => {
  assert.equal(presentacion({ unidad: "unidad" }, 1), "unidad");
  assert.equal(presentacion({ unidad: "unidad" }, 3), "unidades");
  assert.equal(presentacion({}, 0), "unidades");
});

test("en caja: caja o cajas, con cuántos trae", () => {
  assert.equal(presentacion({ unidad: "caja", por_caja: 100 }, 1), "caja de 100");
  assert.equal(presentacion({ unidad: "caja", por_caja: 100 }, 3), "cajas de 100");
});

test("una unidad vieja escrita a mano se muestra tal cual", () => {
  assert.equal(presentacion({ unidad: "litros" }, 4), "litros");
});

test("el total de una caja es cajas por lo que trae cada una", () => {
  assert.equal(enTotal({ unidad: "caja", por_caja: 100, cantidad: 3 }), 300);
});

test("suelto no tiene total aparte", () => {
  assert.equal(enTotal({ unidad: "unidad", cantidad: 3 }), null);
});

// ---------------------------------------------------------------
// Buscar y filtrar el stock (SCRUM-81)
// ---------------------------------------------------------------
// Los filtros salen de lo que tienen cargado los productos: si ninguno tiene
// marca, no hay filtro de marca. Adentro de un grupo se suma ("Bosch o NGK");
// entre grupos se restringe ("Bosch y Filtros").

const stock = [
  { id: "1", nombre: "Filtro de aceite", marca: "Bosch", modelo: "F-100", categoria: "Filtros", unidad: "unidad" },
  { id: "2", nombre: "Filtro de aire", marca: "bosch", modelo: null, categoria: "filtros", unidad: "unidad" },
  { id: "3", nombre: "Bujía", marca: "NGK", modelo: "BKR6", categoria: "Encendido", unidad: "caja", por_caja: 4 },
  { id: "4", nombre: "Estopa", marca: null, modelo: null, categoria: null, unidad: "unidad" },
];
const ids = (lista) => lista.map((p) => p.id);

test("cada característica cargada es un grupo de filtros, con cuántos productos tiene cada valor", () => {
  const grupos = filtrosDisponibles(stock);
  assert.deepEqual(grupos.map((g) => g.clave), ["categoria", "marca", "modelo", "unidad"]);
  const marca = grupos.find((g) => g.clave === "marca");
  assert.deepEqual(marca.opciones, [
    { valor: "bosch", etiqueta: "Bosch", cuantos: 2 },
    { valor: "ngk", etiqueta: "NGK", cuantos: 1 },
  ]);
});

test("lo mismo escrito distinto es un solo valor, y se muestra como apareció primero", () => {
  // "Bosch" y "bosch", "Filtros" y "filtros": uno solo, no dos pastillas.
  const categoria = filtrosDisponibles(stock).find((g) => g.clave === "categoria");
  assert.deepEqual(categoria.opciones.map((o) => o.etiqueta), ["Encendido", "Filtros"]);
  assert.equal(categoria.opciones.find((o) => o.valor === "filtros").cuantos, 2);
});

test("si ningún producto tiene una característica, no hay filtro para ella", () => {
  const sinMarca = stock.map((p) => ({ ...p, marca: null }));
  assert.equal(filtrosDisponibles(sinMarca).some((g) => g.clave === "marca"), false);
});

test("'cómo viene' sólo aparece si algo viene en caja: si todo es suelto, no filtra nada", () => {
  const todoSuelto = stock.map((p) => ({ ...p, unidad: "unidad", por_caja: null }));
  assert.equal(filtrosDisponibles(todoSuelto).some((g) => g.clave === "unidad"), false);
  const unidad = filtrosDisponibles(stock).find((g) => g.clave === "unidad");
  assert.deepEqual(unidad.opciones, [
    { valor: "unidad", etiqueta: "Suelto", cuantos: 3 },
    { valor: "caja", etiqueta: "En caja", cuantos: 1 },
  ]);
});

test("sin nada filtrable, no hay grupos: la pantalla no ofrece un botón que no hace nada", () => {
  assert.deepEqual(filtrosDisponibles([{ id: "x", nombre: "Estopa", unidad: "unidad" }]), []);
  assert.deepEqual(filtrosDisponibles([]), []);
});

test("la búsqueda encuentra por nombre, marca, modelo o categoría, sin mirar mayúsculas ni tildes", () => {
  assert.deepEqual(ids(filtrarProductos(stock, { texto: "bujia" })), ["3"]);
  assert.deepEqual(ids(filtrarProductos(stock, { texto: "ngk" })), ["3"]);
  assert.deepEqual(ids(filtrarProductos(stock, { texto: "f-100" })), ["1"]);
  assert.deepEqual(ids(filtrarProductos(stock, { texto: "ENCENDIDO" })), ["3"]);
  assert.deepEqual(ids(filtrarProductos(stock, { texto: "  filtro  " })), ["1", "2"]);
});

test("sin búsqueda ni filtros se ve todo", () => {
  assert.deepEqual(ids(filtrarProductos(stock)), ["1", "2", "3", "4"]);
  assert.deepEqual(ids(filtrarProductos(stock, { texto: "", elegidos: {} })), ["1", "2", "3", "4"]);
});

test("adentro de un grupo se suma, entre grupos se restringe", () => {
  assert.deepEqual(ids(filtrarProductos(stock, { elegidos: { marca: ["bosch", "ngk"] } })), ["1", "2", "3"]);
  assert.deepEqual(
    ids(filtrarProductos(stock, { elegidos: { marca: ["bosch"], categoria: ["filtros"] } })),
    ["1", "2"]
  );
  assert.deepEqual(
    ids(filtrarProductos(stock, { elegidos: { marca: ["ngk"], categoria: ["filtros"] } })),
    []
  );
  assert.deepEqual(ids(filtrarProductos(stock, { elegidos: { unidad: ["caja"] } })), ["3"]);
});

test("un producto sin la característica no entra cuando se filtra por ella", () => {
  // La estopa no tiene marca: filtrando por Bosch no aparece.
  assert.equal(ids(filtrarProductos(stock, { elegidos: { marca: ["bosch"] } })).includes("4"), false);
});

test("búsqueda y filtros se combinan", () => {
  assert.deepEqual(ids(filtrarProductos(stock, { texto: "aire", elegidos: { marca: ["bosch"] } })), ["2"]);
});

test("tocar una pastilla la elige, tocarla de nuevo la saca, y no toca lo que ya había", () => {
  const antes = { marca: ["bosch"] };
  const despues = alternarFiltro(antes, "marca", "ngk");
  assert.deepEqual(despues, { marca: ["bosch", "ngk"] });
  assert.deepEqual(antes, { marca: ["bosch"] }, "no cambia el objeto de antes");
  assert.deepEqual(alternarFiltro(despues, "marca", "bosch"), { marca: ["ngk"] });
  // Sacar el último de un grupo borra el grupo: no quedan grupos vacíos.
  assert.deepEqual(alternarFiltro({ marca: ["ngk"] }, "marca", "ngk"), {});
});

test("cuántos filtros hay elegidos, para el botón", () => {
  assert.equal(cuantosFiltros({}), 0);
  assert.equal(cuantosFiltros({ marca: ["bosch", "ngk"], unidad: ["caja"] }), 3);
});

test("un filtro elegido que ya no existe se descarta, en vez de esconder todo", () => {
  // Estaba elegida una marca y se borró el único producto que la tenía: la
  // pastilla desaparece, y si la elección quedara, la lista quedaría vacía
  // sin nada que se pueda tocar para arreglarla.
  const grupos = filtrosDisponibles(stock);
  assert.deepEqual(soloVigentes({ marca: ["bosch", "champion"], modelo: ["xx"] }, grupos), {
    marca: ["bosch"],
  });
});

// ---------------------------------------------------------------
// Buscar en la vista Categorías
// ---------------------------------------------------------------

test("en Categorías, buscar el nombre de una categoría la muestra entera", () => {
  const r = buscarEnCategorias(porCategoria(stock), "filtros");
  assert.deepEqual(r.map((g) => g.categoria), ["Filtros"]);
  assert.deepEqual(ids(r[0].productos), ["1", "2"]);
});

test("en Categorías, buscar un producto muestra su categoría con ese producto", () => {
  const r = buscarEnCategorias(porCategoria(stock), "aceite");
  assert.deepEqual(r.map((g) => g.categoria), ["Filtros"]);
  assert.deepEqual(ids(r[0].productos), ["1"]);
});

test("en Categorías, la búsqueda no mira mayúsculas ni tildes, y sin texto se ve todo", () => {
  assert.deepEqual(buscarEnCategorias(porCategoria(stock), "BUJIA").map((g) => g.categoria), ["Encendido"]);
  assert.equal(buscarEnCategorias(porCategoria(stock), "").length, porCategoria(stock).length);
  assert.deepEqual(buscarEnCategorias(porCategoria(stock), "nada que ver"), []);
});
