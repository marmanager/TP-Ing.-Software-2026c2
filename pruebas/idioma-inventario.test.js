// Correr con: npm run test:unit
//
// Clientes, inventario y sedes en los dos idiomas (docs/idiomas.md). Las
// categorías de fábrica se ven en el idioma de quien mira aunque el producto
// las haya guardado en el otro; las que el negocio agregó se ven como las
// escribió; y agrupar, filtrar y contar no se parten por idioma.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import es from "../src/lib/idiomas/es.js";
import en from "../src/lib/idiomas/en.js";
import { traducir } from "../src/lib/idioma.js";
import {
  buscarEnCategorias,
  categoriaEnIdioma,
  categoriaExistente,
  categoriasDisponibles,
  claveDeCategoria,
  filtrarProductos,
  filtrosDisponibles,
  motivoDelProducto,
  porCategoria,
  presentacion,
} from "../src/lib/inventario.js";

const tEs = (c, v, s) => traducir({ diccionario: es, base: null, locale: "es-AR" }, c, v, s);
const tEn = (c, v, s) => traducir({ diccionario: en, base: es, locale: "en-US" }, c, v, s);

const prod = (nombre, categoria, extra = {}) => ({ id: nombre, nombre, categoria, estado: "en_stock", ...extra });

test("una categoría de fábrica se ve en el idioma de quien mira, en cualquiera de los dos idiomas en que se guardó", () => {
  assert.equal(categoriaEnIdioma("Frenos", "taller", "en"), "Frenos"); // "Frenos" no es de fábrica del taller
  assert.equal(categoriaEnIdioma("Filtros", "taller", "en"), "Filters");
  assert.equal(categoriaEnIdioma("Filters", "taller", "es"), "Filtros");
  assert.equal(categoriaEnIdioma("filtros", "taller", "en"), "Filters");
  // Ya está en su idioma: se deja como está escrita.
  assert.equal(categoriaEnIdioma("filtros", "taller", "es"), "filtros");
  // Las que escribió el negocio no se tocan.
  assert.equal(categoriaEnIdioma("Frenos de disco", "taller", "en"), "Frenos de disco");
  assert.equal(categoriaEnIdioma(null, "taller", "en"), null);
});

test("la clave de agrupar es la misma para la categoría en castellano y en inglés", () => {
  assert.equal(claveDeCategoria("Filtros", "taller"), claveDeCategoria("Filters", "taller"));
  assert.equal(claveDeCategoria("Eléctrico", "taller"), claveDeCategoria("electrical", "taller"));
  assert.notEqual(claveDeCategoria("Filtros", "taller"), claveDeCategoria("Lubricantes", "taller"));
  // Cada rubro tiene sus listas: "Limpieza" es de medicina.
  assert.equal(claveDeCategoria("Cleaning", "medicina"), claveDeCategoria("Limpieza", "medicina"));
});

test("categoriasDisponibles: las de fábrica en el idioma, sin repetir las guardadas en el otro", () => {
  const insumos = [prod("a", "Filtros"), prod("b", "Filters"), prod("c", "Juntas")];
  assert.deepEqual(categoriasDisponibles("taller", insumos, [], null, "en"), [
    "Parts", "Filters", "Lubricants", "Bolts", "Screws", "Tools", "Electrical", "Juntas",
  ]);
  assert.deepEqual(categoriasDisponibles("taller", insumos, [], null, "es"), [
    "Repuestos", "Filtros", "Lubricantes", "Pernos", "Tornillos", "Herramientas", "Eléctrico", "Juntas",
  ]);
  // Una lista guardada por el negocio se mapea igual, y lo suyo queda como lo escribió.
  assert.deepEqual(categoriasDisponibles("taller", [], [], ["Filtros", "Juntas"], "en"), ["Filters", "Juntas"]);
});

test("categoriaExistente reconoce la misma categoría de fábrica en el otro idioma", () => {
  assert.equal(categoriaExistente("filtros", ["Filters", "Parts"], "taller"), "Filters");
  assert.equal(categoriaExistente("Juntas", ["Filters"], "taller"), null);
});

test("porCategoria agrupa 'Filtros' y 'Filters' en un solo grupo, con el nombre en el idioma", () => {
  const stock = [prod("x", "Filtros"), prod("y", "Filters"), prod("z", "Juntas"), prod("w", null)];
  const g = porCategoria(stock, { rubro: "taller", idioma: "en", t: tEn });
  assert.deepEqual(g.map((x) => x.categoria), ["Filters", "Juntas", "No category"]);
  assert.equal(g[0].productos.length, 2);
  assert.equal(g.at(-1).sinCategoria, true);
  const gEs = porCategoria(stock, { rubro: "taller", idioma: "es", t: tEs });
  assert.deepEqual(gEs.map((x) => x.categoria), ["Filtros", "Juntas", "Sin categoría"]);
  // Sin opciones, como antes: cada texto es su grupo.
  assert.equal(porCategoria(stock).length, 4);
});

test("filtrosDisponibles: una pastilla por categoría aunque esté guardada en los dos idiomas", () => {
  const stock = [prod("x", "Filtros"), prod("y", "Filters", { unidad: "caja", por_caja: 10 })];
  const grupos = filtrosDisponibles(stock, { rubro: "taller", idioma: "en", t: tEn });
  const categoria = grupos.find((g) => g.clave === "categoria");
  assert.equal(categoria.titulo, "Category");
  assert.deepEqual(categoria.opciones.map((o) => [o.etiqueta, o.cuantos]), [["Filters", 2]]);
  assert.deepEqual(grupos.find((g) => g.clave === "unidad").opciones.map((o) => o.etiqueta), ["Loose", "In a box"]);
  // Elegir esa pastilla trae los dos productos.
  const valor = categoria.opciones[0].valor;
  const r = filtrarProductos(stock, { elegidos: { categoria: [valor] }, rubro: "taller", idioma: "en" });
  assert.equal(r.length, 2);
});

test("la búsqueda encuentra la categoría de fábrica en el idioma de quien mira", () => {
  const stock = [prod("x", "Filtros"), prod("y", "Lubricantes")];
  assert.deepEqual(
    filtrarProductos(stock, { texto: "filters", rubro: "taller", idioma: "en" }).map((p) => p.id),
    ["x"]
  );
  assert.deepEqual(filtrarProductos(stock, { texto: "filters" }).map((p) => p.id), []);
  const grupos = porCategoria(stock, { rubro: "taller", idioma: "en", t: tEn });
  assert.deepEqual(buscarEnCategorias(grupos, "lubric").map((g) => g.categoria), ["Lubricants"]);
});

test("presentacion y motivoDelProducto salen en el idioma que se les pasa", () => {
  assert.equal(presentacion({ unidad: "unidad" }, 3), "unidades");
  assert.equal(presentacion({ unidad: "unidad" }, 3, tEn), "units");
  assert.equal(presentacion({ unidad: "unidad" }, 1, tEn), "unit");
  assert.equal(presentacion({ unidad: "caja", por_caja: 100 }, 1, tEn), "box of 100");
  assert.equal(presentacion({ unidad: "caja", por_caja: 100 }, 3, tEn), "boxes of 100");
  assert.equal(presentacion({ unidad: "litros" }, 4, tEn), "litros"); // lo que escribió el negocio
  assert.equal(motivoDelProducto({ nombre: "" }), "falta el nombre");
  assert.equal(motivoDelProducto({ nombre: "" }, {}, tEn), "name missing");
  assert.equal(
    motivoDelProducto({ nombre: "x", unidad: "caja", porCaja: "" }, {}, tEn),
    "how many come in each box is missing"
  );
});

// Las claves nuevas de clientes e inventario están en los dos idiomas con las
// mismas variables {x}.
test("clientes e inventario: mismas claves y variables en es y en", () => {
  const aplanar = (o, p = "") =>
    Object.entries(o).flatMap(([k, v]) =>
      v && typeof v === "object" && !("other" in v) ? aplanar(v, `${p}${k}.`) : [[`${p}${k}`, v]]
    );
  const vars = (v) => [...new Set((typeof v === "string" ? v : `${v.one} ${v.other}`).match(/\{\w+\}/g) ?? [])].sort();
  for (const top of ["clientes", "inventario"]) {
    const deEs = new Map(aplanar(es[top], `${top}.`));
    const deEn = new Map(aplanar(en[top], `${top}.`));
    assert.deepEqual([...deEn.keys()].sort(), [...deEs.keys()].sort(), top);
    for (const [clave, valor] of deEs) {
      const a = vars(valor).filter((x) => x !== "{n}");
      const b = vars(deEn.get(clave)).filter((x) => x !== "{n}");
      assert.deepEqual(b, a, clave);
    }
  }
});
