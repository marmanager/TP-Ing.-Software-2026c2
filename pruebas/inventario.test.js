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
  mismoProducto,
  normalizar,
  porCategoria,
  presentacion,
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
