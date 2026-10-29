// Correr con: npm run test:unit
//
// Inicio, navegación, Estadísticas (dashboard), ecuaciones y los avisos de
// datos.js en los dos idiomas (docs/idiomas.md): los nombres de la barra son
// los de los módulos, el tablero de Inventario junta las categorías de fábrica
// de los dos idiomas, y los errores que arma datos.js salen por código.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import es from "../src/lib/idiomas/es.js";
import en from "../src/lib/idiomas/en.js";
import { tCastellano, textoDeError, traducir } from "../src/lib/idioma.js";
import { MODULOS, SUBMODULOS, nombreDeModulo, palabraDeBarra } from "../src/lib/modulos.js";
import { CATALOGO, traducirDelCatalogo } from "../src/lib/inicio.js";
import {
  categoriasDashboard,
  destinoDashboard,
  errorPeriodo,
  horaDeConsulta,
  mensajeDeRespuesta,
  nombreDeAgrupacion,
  nombreDePeriodo,
  textoPeriodo,
} from "../src/lib/dashboard.js";
import { intervalosDashboard } from "../src/lib/dashboard-periodos.js";
import { categoriasParaMostrar, estadisticasInventarioDemo } from "../src/lib/dashboard-inventario.js";
import { analizarFormula, nuevaEcuacion, resolverEcuacion } from "../src/lib/ecuaciones.js";

const tEn = (clave, vars, siFalta) => traducir({ diccionario: en, base: es, locale: "en-US" }, clave, vars, siFalta);
const leer = (ruta) => readFileSync(fileURLToPath(new URL(ruta, import.meta.url)), "utf8");

// ---------- paridad es/en de los bloques nuevos ----------

const esPlural = (v) => v && typeof v === "object" && "other" in v;
const variablesDe = (v) => [...new Set((typeof v === "string" ? v : JSON.stringify(v)).match(/\{\w+\}/g) ?? [])].sort();
function hojas(o, prefijo = "") {
  return Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" && !esPlural(v) && !("m" in v && "f" in v) ? hojas(v, `${prefijo}${k}.`) : [[`${prefijo}${k}`, v]]
  );
}

test("navegacion, inicio, dashboard, datos, prueba y ecuaciones: mismas claves, plurales y variables en es y en", () => {
  for (const bloque of ["navegacion", "inicio", "dashboard", "datos", "prueba", "ecuaciones"]) {
    const deEs = new Map(hojas(es[bloque], `${bloque}.`));
    const deEn = new Map(hojas(en[bloque], `${bloque}.`));
    assert.deepEqual([...deEn.keys()].sort(), [...deEs.keys()].sort(), `claves de ${bloque}`);
    for (const [clave, v] of deEs) {
      const o = deEn.get(clave);
      assert.equal(esPlural(v), esPlural(o), `${clave}: forma de plural`);
      assert.deepEqual(variablesDe(o), variablesDe(v), `${clave}: variables`);
    }
  }
});

// ---------- la barra de navegación ----------

test("la barra dice lo mismo que Mi negocio → Módulos, en castellano y en inglés", () => {
  const modulos = [...Object.keys(MODULOS), ...Object.keys(SUBMODULOS)];
  for (const clave of modulos) {
    // En la barra, Ecuaciones es la palabra corta en castellano; el nombre del módulo es más largo.
    if (clave === "ecuaciones") continue;
    assert.equal(palabraDeBarra(clave), nombreDeModulo(clave), clave);
    assert.equal(palabraDeBarra(clave, tEn), nombreDeModulo(clave, tEn), clave);
  }
  assert.equal(palabraDeBarra("ecuaciones"), "Ecuaciones");
  assert.equal(palabraDeBarra("ecuaciones", tEn), nombreDeModulo("ecuaciones", tEn));
});

test("las palabras de la barra: castellano igual al de siempre, inglés con los nombres de los módulos", () => {
  const esperado = {
    inicio: ["Inicio", "Home"], casos: ["Casos", "Cases"], agenda: ["Agenda", "Schedule"], turnos: ["Turnos", "Appointments"],
    calendario: ["Calendario", "Calendar"], clientes: ["Clientes", "Customers"], inventario: ["Inventario", "Inventory"],
    stock: ["En stock", "In stock"], en_camino: ["En camino", "On the way"], sedes: ["Todas las sedes", "All locations"],
    ecuaciones: ["Ecuaciones", "Custom equations"], presupuesto: ["Pendientes de aprobación", "Pending approval"],
    equipo: ["Equipo", "Team"], historial: ["Historial", "History"], dashboard: ["Estadísticas", "Statistics"],
    negocio: ["Mi negocio", "My business"], perfil: ["Mi perfil", "My profile"],
  };
  for (const [clave, [delEs, delEn]] of Object.entries(esperado)) {
    assert.equal(palabraDeBarra(clave), delEs, `es ${clave}`);
    assert.equal(palabraDeBarra(clave, tEn), delEn, `en ${clave}`);
  }
});

test("todo destino de Navegacion.js es un módulo conocido o tiene su palabra propia", () => {
  const fuente = leer("../src/componentes/Navegacion.js");
  const modulos = [...fuente.matchAll(/modulo: "(\w+)"/g)].map((m) => m[1]);
  const ids = [...fuente.matchAll(/\bid: "(\w+)"/g)].map((m) => m[1]);
  // Los de núcleo con palabra propia: inicio, casos, la bandeja de
  // respuestas (R-10b), Mi negocio y Mi perfil.
  assert.ok(modulos.length >= 12 && ids.length === 5);
  for (const m of modulos) assert.ok(MODULOS[m] || SUBMODULOS[m], `módulo ${m}`);
  for (const id of ids) assert.notEqual(palabraDeBarra(id, tEn), id, `palabra de ${id}`);
  assert.doesNotMatch(fuente, /palabra:/, "ya no queda una palabra escrita en la lista de destinos");
});

// ---------- el Inicio ----------

test("el catálogo del Inicio: castellano igual a las constantes, inglés completo y con los nombres de los módulos", () => {
  for (const def of Object.values(CATALOGO)) {
    const delEs = traducirDelCatalogo(def);
    assert.deepEqual(delEs, def, def.clave);
    const delEn = traducirDelCatalogo(def, tEn);
    assert.notEqual(delEn.nombre, def.nombre, `${def.clave}: nombre en inglés`);
    assert.notEqual(delEn.queMuestra, def.queMuestra, `${def.clave}: queMuestra en inglés`);
    for (const f of delEn.filtros ?? []) assert.notEqual(f.palabra, def.filtros.find((x) => x.clave === f.clave).palabra, f.clave);
  }
  const modulo = { agenda: "agenda", inventario: "inventario", aprobar: "presupuesto", equipo: "equipo", clientes: "clientes", historial: "historial" };
  for (const [tarjeta, clave] of Object.entries(modulo)) {
    assert.equal(traducirDelCatalogo(CATALOGO[tarjeta], tEn).nombre, nombreDeModulo(clave, tEn), tarjeta);
    assert.equal(traducirDelCatalogo(CATALOGO[tarjeta]).nombre, nombreDeModulo(clave), tarjeta);
  }
});

// ---------- Estadísticas: períodos, destinos, horas ----------

test("períodos, categorías, destinos y errores de Estadísticas: castellano de siempre y versión en inglés", () => {
  assert.deepEqual(["mes", "7dias", "30dias", "personalizado"].map((c) => nombreDePeriodo(c)), ["Este mes", "Últimos 7 días", "Últimos 30 días", "Rango personalizado"]);
  assert.deepEqual(["mes", "7dias", "30dias", "personalizado"].map((c) => nombreDePeriodo(c, tEn)), ["This month", "Last 7 days", "Last 30 days", "Custom range"]);
  assert.equal(errorPeriodo({ desde: "", hasta: "2026-10-01" }), "Elegí una fecha inicial y una final válidas.");
  assert.equal(errorPeriodo({ desde: "2026-10-02", hasta: "2026-10-01" }), "La fecha final debe ser igual o posterior a la inicial.");
  assert.equal(errorPeriodo({ desde: "2026-10-02", hasta: "2026-10-01" }, tEn), "The end date must be the same as or later than the start date.");
  const activos = ["dashboard", "clientes", "inventario"];
  assert.deepEqual(categoriasDashboard(activos).map((c) => c.nombre), ["Resumen", "Casos", "Cobros", "Clientes", "Inventario"]);
  assert.deepEqual(categoriasDashboard(activos, tEn).map((c) => c.nombre), ["Summary", "Cases", "Payments", "Customers", "Inventory"]);
  assert.equal(destinoDashboard("casos", activos).texto, "Ir a Casos");
  assert.equal(destinoDashboard("cobros", activos).texto, "Ver cobros en Casos");
  assert.equal(destinoDashboard("clientes", activos).texto, "Ir a Clientes");
  assert.equal(destinoDashboard("clientes", activos, tEn).texto, "Go to Customers");
  assert.equal(destinoDashboard("cobros", activos, tEn).texto, "See payments in Cases");
  assert.deepEqual(["día", "semana", "mes", "año"].map((a) => nombreDeAgrupacion(a)), ["día", "semana", "mes", "año"]);
  assert.deepEqual(["día", "semana", "mes", "año"].map((a) => nombreDeAgrupacion(a, tEn)), ["day", "week", "month", "year"]);
});

test("el rango de fechas dice 'al' en castellano y 'to' en inglés, también en el detalle de cada punto del gráfico", () => {
  const periodo = { desde: "2026-10-01", hasta: "2026-10-07" };
  assert.match(textoPeriodo(periodo, "es-AR"), / al /);
  assert.match(textoPeriodo(periodo, "en-US", tEn), /^Oct 1, 2026 to Oct 7, 2026$/);
  assert.equal(textoPeriodo({ desde: "2026-10-01", hasta: "2026-10-01" }, "en-US", tEn), "Oct 1, 2026");
  const semanas = intervalosDashboard(periodo, "semana", "en-US", tEn);
  assert.ok(semanas.some((s) => / to /.test(s.detalle)));
  assert.ok(!intervalosDashboard(periodo, "semana", "es-AR").some((s) => / to /.test(s.detalle)));
});

test("la hora de 'Consultado a las' sigue igual en castellano y es de 24 h en inglés", () => {
  const iso = "2026-10-26T18:05:00Z"; // 15:05 en Argentina
  assert.equal(horaDeConsulta(iso, "es-AR"), new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso)));
  assert.equal(horaDeConsulta(iso, "en-US"), "15:05");
});

test("mensajeDeRespuesta: un error de la API se traduce por código y uno propio del tablero viaja como clave", () => {
  assert.equal(mensajeDeRespuesta({ ok: false, fallback: "dashboard.resumen.noPudimos" }), "No pudimos consultar el Resumen. Volvé a intentarlo.");
  assert.equal(mensajeDeRespuesta({ ok: false, fallback: "dashboard.resumen.noPudimos" }, tEn), "We couldn't load the Summary. Try again.");
  assert.equal(mensajeDeRespuesta({ ok: false, error: { codigo: "cambio_de_negocio", mensaje: "x" } }), "Cambiaste de negocio. Recargá la página para consultar sus estadísticas.");
  assert.equal(mensajeDeRespuesta({ ok: false, error: { codigo: "cambio_de_negocio", mensaje: "x" } }, tEn), "You switched businesses. Reload the page to see its statistics.");
  assert.equal(mensajeDeRespuesta({ ok: false, error: { codigo: "desconocido", mensaje: "lo que dijo la API" } }, tEn), "lo que dijo la API");
});

// ---------- Estadísticas de Inventario: "Filtros" y "Filters" son una sola barra ----------

const producto = (id, extra = {}) => ({ id, nombre: id, negocio_id: "a", cantidad: 5, minimo: 2, unidad: "unidad", categoria: null, estado: "en_stock", creado_en: "2020-01-01T12:00:00Z", ...extra });
const demo = (insumos, rubro = "taller") => estadisticasInventarioDemo({ negocio: { id: "a", rubro, modulos_activos: ["dashboard", "inventario"] }, insumos });

test("el tablero demo agrupa por la clave de la categoría: Filtros y Filters cuentan juntos", () => {
  const r = demo([
    producto("a", { categoria: "Filtros" }), producto("b", { categoria: "Filters" }), producto("c", { categoria: " filtros " }),
    producto("d", { categoria: "Frenos propios" }), producto("e"),
  ]);
  assert.deepEqual(r.stock.por_categoria, [
    { categoria: "Filtros", cantidad: 3 },
    { categoria: "Frenos propios", cantidad: 1 },
    { categoria: "Sin categoría", cantidad: 1 },
  ]);
  // Con una categoría escrita primero en inglés, queda esa forma: se traduce al mostrar.
  const alReves = demo([producto("a", { categoria: "Filters" }), producto("b", { categoria: "Filtros" })]);
  assert.deepEqual(alReves.stock.por_categoria, [{ categoria: "Filters", cantidad: 2 }]);
});

test("categoriasParaMostrar: una sola fila por categoría de fábrica, en el idioma de quien mira", () => {
  const delTablero = [
    { categoria: "Filtros", cantidad: 3 }, { categoria: "Filters", cantidad: 2 }, { categoria: "Lubricantes", cantidad: 4 },
    { categoria: "Mi categoría", cantidad: 1 }, { categoria: "Sin categoría", cantidad: 2 },
  ];
  const enEs = categoriasParaMostrar(delTablero, { rubro: "taller", idioma: "es" });
  assert.deepEqual(enEs, [
    { categoria: "Filtros", cantidad: 5 }, { categoria: "Lubricantes", cantidad: 4 },
    { categoria: "Mi categoría", cantidad: 1 }, { categoria: "Sin categoría", cantidad: 2 },
  ]);
  const enEn = categoriasParaMostrar(delTablero, { rubro: "taller", idioma: "en", t: tEn });
  assert.deepEqual(enEn.map((f) => f.categoria), ["Filters", "Lubricants", "Mi categoría", tEn("inventario.sinCategoria")]);
  assert.notEqual(tEn("inventario.sinCategoria"), "Sin categoría");
  assert.deepEqual(enEn.map((f) => f.cantidad), [5, 4, 1, 2]);
  // Una sola barra de Filtros en cada idioma.
  assert.equal(enEs.filter((f) => /^filt/i.test(f.categoria)).length, 1);
  assert.equal(enEn.filter((f) => /^filt/i.test(f.categoria)).length, 1);
});

test("categoriasParaMostrar: si nada se junta, el orden y los textos de la API quedan como vinieron", () => {
  const delTablero = [{ categoria: "Zeta", cantidad: 9 }, { categoria: "Alfa", cantidad: 1 }, { categoria: "Sin categoría", cantidad: 3 }];
  assert.deepEqual(categoriasParaMostrar(delTablero, { rubro: "taller", idioma: "es" }), delTablero);
  assert.deepEqual(categoriasParaMostrar([], { rubro: "taller" }), []);
});

test("el total del gráfico se conserva al juntar las categorías", () => {
  const delTablero = [{ categoria: "Repuestos", cantidad: 3 }, { categoria: "Parts", cantidad: 4 }, { categoria: "Otra", cantidad: 5 }];
  const juntas = categoriasParaMostrar(delTablero, { rubro: "taller", idioma: "en", t: tEn });
  assert.equal(juntas.reduce((s, f) => s + f.cantidad, 0), 12);
  assert.ok(juntas.some((f) => f.categoria === "Parts" && f.cantidad === 7));
});

// ---------- los errores que arma datos.js ----------

test("cada error que arma datos.js existe en los dos idiomas y el castellano es el de siempre", () => {
  const fuente = leer("../src/lib/datos.js");
  const usados = [...new Set([...fuente.matchAll(/errorLocal\("(\w+)"\)/g)].map((m) => m[1]))];
  assert.ok(usados.length >= 14);
  const viejo = {
    caso_ya_no_esta: "Ese caso ya no está.",
    caso_sin_encontrar: "No encontramos ese caso.",
    monto_mal_escrito: "El monto va con números, sin puntos, y mayor que cero.",
    cobro_en_linea_aparte: "Los cobros por link o QR se piden desde el sistema de pagos.",
    medio_en_linea_invalido: "Elegí link o QR.",
    pagos_no_conectados: "Todavía no está conectado el sistema de pagos.",
    sesion_vencida: "Tu sesión venció. Volvé a entrar y probá de nuevo.",
    cobro_ya_no_esta: "Ese cobro ya no está.",
    pago_ya_entro: "Ese pago ya entró por el medio de pago. Para devolverlo, hay que hacerlo desde ahí.",
    cobro_sin_efecto: "Ese cobro ya no cuenta: no hay nada que anular.",
    cambio_de_negocio: "Cambiaste de negocio. Recargá la página para consultar sus estadísticas.",
    cierres_sin_datos: "No pudimos consultar los cierres de casos. Volvé a intentarlo.",
    paso_ya_no_esta: "Ese paso ya no está en el presupuesto.",
    paso_caso_entregado: "El caso ya se entregó. Volvé a abrirlo si hay algo que corregir.",
    paso_no_aprobado: "Sólo se marca lo que el cliente aprobó.",
    estado_sin_aviso: "El estado se cambió, pero no pudimos enviar el aviso por WhatsApp.",
    negocio_sin_base: "Tu negocio todavía no aparece en la base. Esperá unos segundos y volvé a entrar.",
    servidor_sin_leer: "No se pudo leer el servidor. Fijate la conexión y volvé a entrar.",
  };
  for (const codigo of usados) {
    assert.equal(es.errores[codigo], viejo[codigo], `es.errores.${codigo}`);
    assert.equal(typeof en.errores[codigo], "string", `en.errores.${codigo}`);
    assert.notEqual(en.errores[codigo], es.errores[codigo], `en.errores.${codigo} traducido`);
  }
  for (const [codigo, texto] of Object.entries(viejo)) assert.equal(es.errores[codigo], texto, codigo);
});

test("un error de datos.js se muestra por código en el idioma de quien mira, y uno de la API desconocido, como vino", () => {
  const e = { codigo: "monto_mal_escrito", mensaje: tCastellano("errores.monto_mal_escrito") };
  assert.equal(textoDeError(tCastellano, e), "El monto va con números, sin puntos, y mayor que cero.");
  assert.match(textoDeError(tEn, e), /^The amount takes digits only/);
  assert.equal(textoDeError(tEn, { codigo: "otro_codigo", mensaje: "Mensaje de la API" }), "Mensaje de la API");
});

test("datos.js ya no devuelve el texto suelto de un error de la API: todo pasa como { codigo, mensaje }", () => {
  const fuente = leer("../src/lib/datos.js");
  assert.doesNotMatch(fuente, /error:\s*r\.error\.mensaje/, "error: r.error.mensaje");
  assert.doesNotMatch(fuente, /setAviso\(r\.error\.mensaje\)/);
  assert.doesNotMatch(fuente, /setAviso\(\s*"/, "setAviso con un texto suelto");
  assert.doesNotMatch(fuente, /error:\s*"/, "error: con un texto suelto");
});

// ---------- ecuaciones ----------

test("los errores de las ecuaciones: castellano de siempre por defecto y en inglés con t", () => {
  assert.equal(analizarFormula("").error, "La fórmula es obligatoria.");
  assert.equal(analizarFormula("2 $ 3").error, "La fórmula contiene un símbolo no válido.");
  assert.equal(analizarFormula("(1+2").error, "Los paréntesis no son válidos.");
  assert.equal(analizarFormula("(1+2", tEn).error, "The parentheses aren't valid.");
  assert.equal(nuevaEcuacion({ nombre: "", formula: "1" }).error, "El nombre es obligatorio.");
  assert.equal(nuevaEcuacion({ nombre: "", formula: "1" }, [], tEn).error, "The name is required.");
  assert.equal(nuevaEcuacion({ nombre: "x", formula: "a + 1" }).error, "La variable a se usa en la fórmula pero no está definida.");
  assert.equal(nuevaEcuacion({ nombre: "x", formula: "a + 1" }, [], tEn).error, "The variable a is used in the formula but isn't defined.");
  const ecuacion = { nombre: "x", formula: "a / b", variables: [{ id: "1", tipo: "variable", nombre: "a" }, { id: "2", tipo: "variable", nombre: "b" }] };
  assert.equal(resolverEcuacion(ecuacion, { 1: 1 }).error, "Ingresá un valor para b.");
  assert.equal(resolverEcuacion(ecuacion, { 1: 1, 2: 0 }).error, "No se puede dividir por cero.");
  assert.equal(resolverEcuacion(ecuacion, { 1: 1, 2: 0 }, tEn).error, "You can't divide by zero.");
  assert.equal(resolverEcuacion(ecuacion, { 1: 6, 2: 3 }).resultado, 2);
});

// ---------- el mensaje propio de la API ----------

test("el mensaje que escribió la API gana en castellano; en inglés se traduce por código; los genéricos de api.js siguen al diccionario", async () => {
  const { api } = await import("../src/lib/api.js");
  const respuesta = (status, cuerpo) => async () => ({ ok: status < 400, status, headers: { get: () => null }, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo) });
  const pedir = (status, cuerpo) => api("/x", { base: "http://api.test/v1", token: "t", fetcher: respuesta(status, cuerpo), reintentar: false, avisarSiVence: false });

  const suyo = await pedir(403, { ok: false, error: { codigo: "sin_permiso", mensaje: "Su rol no incluye el permiso para esta acción." } });
  assert.deepEqual(Object.keys(suyo.error).sort(), ["codigo", "mensaje"], "la marca no cambia la forma del error");
  assert.equal(textoDeError(tCastellano, suyo.error), "Su rol no incluye el permiso para esta acción.");
  assert.equal(textoDeError(tEn, suyo.error), en.errores.sin_permiso);

  const generico = await pedir(403, null);
  assert.equal(textoDeError(tCastellano, generico.error), "No tenés permiso para hacer eso.");
  assert.equal(textoDeError(tEn, generico.error), en.errores.sin_permiso);

  const desconocido = await pedir(422, { ok: false, error: { codigo: "algo_nuevo", mensaje: "Lo dijo la API" } });
  assert.equal(textoDeError(tCastellano, desconocido.error), "Lo dijo la API");
  assert.equal(textoDeError(tEn, desconocido.error), "Lo dijo la API");

  // Una copia que pierde la marca vuelve al diccionario, como siempre.
  assert.equal(textoDeError(tCastellano, { ...suyo.error }), "No tenés permiso para hacer eso.");
});

// ---------- presentación de cajas ----------

test("presentacion: caja con y sin por_caja, 1 y varias, en castellano e inglés; nunca 'undefined'", async () => {
  const { presentacion } = await import("../src/lib/inventario.js");
  assert.equal(presentacion({ unidad: "caja", por_caja: 12 }, 1), "caja de 12");
  assert.equal(presentacion({ unidad: "caja", por_caja: 12 }, 2), "cajas de 12");
  assert.equal(presentacion({ unidad: "caja" }, 1), "caja");
  assert.equal(presentacion({ unidad: "caja" }, 2), "cajas");
  assert.equal(presentacion({ unidad: "caja", por_caja: null }, 3, tEn), "boxes");
  assert.equal(presentacion({ unidad: "caja" }, 1, tEn), "box");
  assert.equal(presentacion({ unidad: "caja", por_caja: 12 }, 2, tEn), "boxes of 12");
  for (const t of [tCastellano, tEn]) for (const n of [1, 2]) assert.doesNotMatch(presentacion({ unidad: "caja" }, n, t), /undefined/);
});

// ---------- api() marca el mensaje propio ----------

test("api() marca como propio el mensaje de la API y no el genérico", async () => {
  const { api } = await import("../src/lib/api.js");
  const resp = (status, cuerpo) => async () => ({ ok: false, status, headers: { get: () => null }, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo) });
  const pedir = (status, cuerpo) => api("/x", { base: "http://api.test/v1", token: "t", fetcher: resp(status, cuerpo), reintentar: false, avisarSiVence: false });
  const suyo = await pedir(422, { ok: false, error: { codigo: "datos_invalidos", mensaje: "Revisá 2 datos." } });
  assert.equal(suyo.error.propio, true);
  assert.equal(Object.keys(suyo.error).includes("propio"), false);
  assert.equal(textoDeError(tCastellano, suyo.error), "Revisá 2 datos.");
  assert.equal((await pedir(422, null)).error.propio, undefined);
});
