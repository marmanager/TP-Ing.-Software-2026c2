// Correr con: npm run test:unit
//
// El Asistente de la barra lateral (src/lib/asistente.js): lo que le cuenta
// a la API de cómo está el negocio, cómo aplica una propuesta sólo cuando la
// persona la acepta, y dónde guarda la conversación.

import { test, describe } from "@jest/globals";
import assert from "node:assert/strict";
import {
  armarContexto,
  borrarConversacion,
  cambiosDePropuesta,
  conversar,
  describirPropuesta,
  estadosConPropuesta,
  formularioDeEcuacion,
  guardarConversacion,
  igualA,
  leerVariable,
  leerConversacion,
  MAX_GUARDADOS,
  mensajesParaLaApi,
  modulosConPropuesta,
  partirTexto,
  prendidoEn,
} from "../src/lib/asistente.js";
import { LISTA_MODULOS, LISTA_SUBMODULOS } from "../src/lib/modulos.js";
import { nuevaEcuacion } from "../src/lib/ecuaciones.js";
import { conModulosPrendidos, normalizarInicio, sePisan, visibles } from "../src/lib/inicio.js";
import es from "../src/lib/idiomas/es.js";
import en from "../src/lib/idiomas/en.js";

const personalizable = (extra = {}) => ({ id: "n-1", rubro: "personalizable", modulos_activos: [], nombrar_casos: "numero", ...extra });

// Un almacenamiento de mentira, como localStorage.
function almacen() {
  const guardado = new Map();
  return {
    guardado,
    getItem: (k) => (guardado.has(k) ? guardado.get(k) : null),
    setItem: (k, v) => guardado.set(k, String(v)),
    removeItem: (k) => guardado.delete(k),
  };
}

describe("el contexto que viaja a la API", () => {
  test("trae todos los módulos y sus pantallas, con lo que está prendido", () => {
    const c = armarContexto({ negocio: personalizable({ modulos_activos: ["agenda"] }), tieneCasos: false });
    const claves = c.modulos.map((m) => m.clave);
    for (const m of [...LISTA_MODULOS, ...LISTA_SUBMODULOS]) assert.ok(claves.includes(m.clave), m.clave);

    const de = (clave) => c.modulos.find((m) => m.clave === clave);
    assert.equal(de("agenda").prendido, true);
    // Un negocio de antes de los submódulos: con la Agenda, valen las dos pantallas.
    assert.equal(de("turnos").prendido, true);
    assert.equal(de("turnos").padre, "agenda");
    assert.equal(de("inventario").prendido, false);
    // Clientes viene de fábrica: prendido aunque no esté en la lista.
    assert.equal(de("clientes").prendido, true);
    assert.equal(de("sedes").aPedido, true);
  });

  test("trae los cinco estados como se ven, el rubro, cómo se nombran los casos y si hay casos", () => {
    const c = armarContexto({
      negocio: personalizable({ estados: { en_proceso: { nombre: "Cortando", icono: "llave" } }, nombrar_casos: "cliente" }),
      tieneCasos: true,
      pantalla: "/asistente",
    });
    assert.deepEqual(c.estados.map((e) => e.clave), ["nuevo", "en_proceso", "esperando", "revision_final", "completado"]);
    assert.equal(c.estados[1].nombre, "Cortando");
    assert.equal(c.rubro, "personalizable");
    assert.equal(c.nombrarCasos, "cliente");
    assert.equal(c.tieneCasos, true);
    assert.equal(c.pantalla, "/asistente");
    assert.ok(c.rubros.some((r) => r.clave === "personalizable"));
  });

  test("respeta los largos que acepta la API", () => {
    const c = armarContexto({ negocio: personalizable() });
    for (const m of c.modulos) {
      assert.ok(m.nombre.length <= 80 && m.queHace.length <= 800, m.clave);
    }
  });
});

describe("aplicar una propuesta", () => {
  test("prender y apagar pasa por las reglas de siempre", () => {
    // Prender Agenda prende sus dos pantallas; apagar Clientes (de fábrica) lo anota como apagado.
    const lista = modulosConPropuesta([], { prender: ["agenda"], apagar: ["clientes"] });
    assert.ok(prendidoEn("agenda", lista) && prendidoEn("turnos", lista) && prendidoEn("calendario", lista));
    assert.equal(prendidoEn("clientes", lista), false);
    assert.ok(lista.includes("-clientes"));
  });

  test("prender una pantalla de un módulo apagado prende el módulo", () => {
    const lista = modulosConPropuesta([], { prender: ["en_camino"] });
    assert.ok(prendidoEn("inventario", lista));
    assert.ok(prendidoEn("en_camino", lista));
  });

  test("una pantalla a pedido se prende sólo si se pide", () => {
    assert.equal(prendidoEn("sedes", modulosConPropuesta([], { prender: ["inventario"] })), false);
    assert.equal(prendidoEn("sedes", modulosConPropuesta([], { prender: ["sedes"] })), true);
  });

  test("lo que ya está como se pide no se toca", () => {
    const activos = ["agenda", "equipo"];
    assert.deepEqual(modulosConPropuesta(activos, { prender: ["agenda", "clientes"], apagar: ["inventario"] }), activos);
  });

  test("los estados: cambia sólo lo pedido y quedan los cinco", () => {
    const config = estadosConPropuesta(personalizable(), [{ clave: "en_proceso", nombre: "Cortando" }, { clave: "nuevo", icono: "calendario" }]);
    assert.equal(config.en_proceso.nombre, "Cortando");
    assert.equal(config.nuevo.icono, "calendario");
    assert.equal(config.nuevo.nombre, "Anotado");
    assert.equal(Object.keys(config).length, 5);
  });

  test("cambiosDePropuesta: sólo lo que cambia, en la forma de aplicarConfiguracion()", () => {
    const negocio = personalizable({ modulos_activos: ["agenda"] });
    assert.deepEqual(cambiosDePropuesta({ prender: ["agenda"] }, negocio), {});
    const cambios = cambiosDePropuesta({
      prender: ["equipo"], estados: [{ clave: "completado", nombre: "Listo para irse" }], nombrarCasos: "cliente", rubro: "taller",
    }, negocio);
    assert.ok(cambios.modulos.includes("equipo"));
    assert.equal(cambios.estados.completado.nombre, "Listo para irse");
    assert.equal(cambios.nombrar_casos, "cliente");
    assert.equal(cambios.rubro, "taller");
  });
});

describe("lo que ve la persona antes de decidir", () => {
  test("cada cambio en un renglón, con los nombres de pantalla", () => {
    const renglones = describirPropuesta({
      prender: ["agenda", "presupuesto"], apagar: ["historial"],
      estados: [{ clave: "en_proceso", nombre: "Cortando", icono: "llave" }],
      nombrarCasos: "cliente", rubro: "taller",
    }, personalizable());
    assert.deepEqual(renglones, [
      "Prender: Agenda, Pendientes de aprobación.",
      "Apagar: Historial.",
      "«En proceso» pasa a llamarse «Cortando».",
      "«Cortando» lleva el ícono «Herramienta».",
      "Los casos nuevos se nombran por el nombre del cliente.",
      "El rubro pasa a ser Taller mecánico.",
    ]);
  });
});

describe("la conversación", () => {
  test("a la API van sólo el rol y el texto, sin vacíos ni propuestas", () => {
    const conversacion = [
      { rol: "usuario", texto: "prendeme la agenda" },
      { rol: "asistente", texto: "Te propongo…", propuesta: { prender: ["agenda"] }, estado: "aplicada" },
      { rol: "usuario", texto: "   " },
      { rol: "sistema", texto: "nada" },
    ];
    assert.deepEqual(mensajesParaLaApi(conversacion), [
      { rol: "usuario", texto: "prendeme la agenda" },
      { rol: "asistente", texto: "Te propongo…" },
    ]);
  });

  test("conversar le pega a /asistente con la charla y el contexto", async () => {
    const pedidos = [];
    const fetcher = async (url, init) => {
      pedidos.push({ url, init });
      return new Response(JSON.stringify({ ok: true, datos: { texto: "Hola", propuesta: null } }), { status: 200 });
    };
    const r = await conversar([{ rol: "usuario", texto: "hola" }], { rubro: "taller" }, "token", { fetcher, base: "https://api.test/v1" });
    // Campo por campo: el objeto viene del otro "realm" de jest.
    assert.equal(r.ok, true);
    assert.equal(r.datos.texto, "Hola");
    assert.equal(r.datos.propuesta, null);
    assert.equal(pedidos[0].url, "https://api.test/v1/asistente");
    assert.equal(pedidos[0].init.method, "POST");
    assert.deepEqual(JSON.parse(pedidos[0].init.body), { mensajes: [{ rol: "usuario", texto: "hola" }], contexto: { rubro: "taller" } });
  });

  test("se guarda por negocio, con un tope, y se puede borrar", () => {
    const a = almacen();
    const larga = Array.from({ length: MAX_GUARDADOS + 5 }, (_, i) => ({ rol: i % 2 ? "asistente" : "usuario", texto: `m${i}` }));
    guardarConversacion("n-1", larga, a);
    guardarConversacion("n-2", [{ rol: "usuario", texto: "otro negocio" }], a);

    const leida = leerConversacion("n-1", a);
    assert.equal(leida.length, MAX_GUARDADOS);
    assert.equal(leida.at(-1).texto, `m${MAX_GUARDADOS + 4}`);
    assert.equal(leerConversacion("n-2", a)[0].texto, "otro negocio");

    borrarConversacion("n-1", a);
    assert.deepEqual(leerConversacion("n-1", a), []);
  });

  test("sin almacenamiento o con algo roto guardado, arranca vacía y no se rompe", () => {
    const roto = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("lleno"); }, removeItem: () => {} };
    assert.deepEqual(leerConversacion("n-1", roto), []);
    assert.doesNotThrow(() => guardarConversacion("n-1", [{ rol: "usuario", texto: "x" }], roto));
    const basura = almacen();
    basura.setItem("asistente:n-1", "{no es json");
    assert.deepEqual(leerConversacion("n-1", basura), []);
    assert.deepEqual(leerConversacion(null, basura), []);
  });
});

describe("el texto del asistente", () => {
  test("párrafos, listas y negritas, sin HTML", () => {
    assert.deepEqual(partirTexto("Hola **Juan**.\n\n- **Agenda**: turnos\n- Equipo\nChau <b>x</b>"), [
      { tipo: "parrafo", tramos: [{ negrita: false, texto: "Hola " }, { negrita: true, texto: "Juan" }, { negrita: false, texto: "." }] },
      { tipo: "lista", items: [
        [{ negrita: true, texto: "Agenda" }, { negrita: false, texto: ": turnos" }],
        [{ negrita: false, texto: "Equipo" }],
      ] },
      { tipo: "parrafo", tramos: [{ negrita: false, texto: "Chau <b>x</b>" }] },
    ]);
  });
});

describe("los textos", () => {
  test("están en los dos idiomas, con las mismas claves", () => {
    const claves = (o, prefijo = "") => Object.entries(o).flatMap(([k, v]) =>
      typeof v === "object" ? claves(v, `${prefijo}${k}.`) : [`${prefijo}${k}`]);
    assert.deepEqual(claves(en.asistente).sort(), claves(es.asistente).sort());
  });
});

describe("las ecuaciones que arma", () => {
  const propuesta = {
    nombre: "Precio final", formula: "(horas * tarifa + repuestos) * (1 + iva)", descripcion: "", categoria: "Costos", unidad_resultado: "$",
    variables: [
      { tipo: "variable", nombre: "horas", descripcion: "Horas de mano de obra", valor: null, unidad: "h" },
      { tipo: "constante", nombre: "tarifa", descripcion: "", valor: 15000, unidad: "$/h" },
      { tipo: "variable", nombre: "repuestos", descripcion: "", valor: null, unidad: "$" },
      { tipo: "constante", nombre: "iva", descripcion: "", valor: 0.21, unidad: "" },
    ],
  };

  test("el formulario pasa las validaciones de la pantalla de Ecuaciones", () => {
    const form = formularioDeEcuacion(propuesta);
    assert.equal(form.confirmarVariante, false);
    assert.equal(form.variables.length, 4);
    assert.ok(form.variables.every((v) => v.id), "cada variable con su id");
    const creada = nuevaEcuacion(form, []);
    assert.equal(creada.error, undefined);
    assert.equal(creada.ecuacion.formula, propuesta.formula);
    assert.equal(formularioDeEcuacion(propuesta, { confirmarVariante: true }).confirmarVariante, true);
  });

  test("avisa si ya hay una con la misma fórmula, sin importar los espacios", () => {
    assert.equal(igualA(propuesta, [{ nombre: "Mi precio", formula: "(horas*tarifa+repuestos)*(1+iva)" }]), "Mi precio");
    assert.equal(igualA(propuesta, [{ nombre: "Otra", formula: "horas * tarifa" }]), null);
  });

  test("cada variable se lee con su unidad, y las constantes con su valor", () => {
    assert.equal(leerVariable(propuesta.variables[0]), "horas (h)");
    assert.equal(leerVariable(propuesta.variables[1]), "tarifa = 15000 $/h");
    assert.equal(leerVariable(propuesta.variables[3]), "iva = 0.21");
  });

  test("el contexto lleva las que ya guardó, para no repetirlas", () => {
    const c = armarContexto({ negocio: personalizable(), ecuaciones: [{ id: "x", nombre: "Ohm", formula: "corriente * resistencia", categoria: "" }] });
    assert.deepEqual(c.ecuaciones, [{ nombre: "Ohm", formula: "corriente * resistencia" }]);
  });
});

describe("las tarjetas del Inicio al prender módulos", () => {
  // Un Inicio acomodado con la Agenda y el Inventario apagados: sus tarjetas
  // guardan lugares viejos que hoy caen en el medio (o encima) de lo que se ve.
  const acomodado = [
    { clave: "casos", x: 0, y: 0, ancho: 6, alto: 2, filtro: "abiertos" },
    { clave: "pendientes", x: 0, y: 2, ancho: 6, alto: 1, filtro: null },
    { clave: "historial", x: 0, y: 3, ancho: 6, alto: 2, filtro: "todo" },
    { clave: "inventario", x: 2, y: 1, ancho: 2, alto: 1, filtro: "bajo" },
    { clave: "agenda", x: 4, y: 0, ancho: 2, alto: 2, filtro: "semana" },
  ];

  test("entran abajo de todo, en el orden pedido, sin mover lo que se ve ni encimarse", () => {
    const despues = ["inventario", "agenda"];
    const nuevo = conModulosPrendidos(acomodado, [], despues, ["inventario", "agenda"]);
    const enPantalla = visibles(nuevo, despues);
    const lugar = (clave) => enPantalla.find((m) => m.clave === clave);

    assert.deepEqual([lugar("casos").y, lugar("pendientes").y, lugar("historial").y], [0, 2, 3], "lo acomodado queda igual");
    assert.ok(lugar("inventario").y >= 5 && lugar("agenda").y >= 5, "las nuevas, abajo de todo");
    assert.ok(lugar("inventario").y < lugar("agenda").y, "en el orden en que se pidieron");
    assert.equal(lugar("agenda").filtro, "semana", "con el filtro y el tamaño que tenían");
    for (const a of enPantalla) for (const b of enPantalla) assert.ok(!sePisan(a, b), `${a.clave} pisa ${b.clave}`);
  });

  test("si no se prende nada nuevo, el Inicio no se toca", () => {
    const inicio = normalizarInicio(acomodado);
    assert.equal(conModulosPrendidos(inicio, ["agenda"], ["agenda"], []), inicio);
    assert.equal(conModulosPrendidos(inicio, ["agenda"], [], []), inicio);
  });

  test("lo que sigue apagado queda guardado tal cual", () => {
    const nuevo = conModulosPrendidos(acomodado, [], ["agenda"], ["agenda"]);
    assert.deepEqual(nuevo.find((m) => m.clave === "inventario"), acomodado[3]);
  });

  test("aplicar una propuesta dice en qué orden se pidieron", () => {
    const cambios = cambiosDePropuesta({ prender: ["inventario", "agenda"] }, personalizable());
    assert.deepEqual(cambios.prendidos, ["inventario", "agenda"]);
  });
});
