// Correr con: npm run test:unit
//
// Los submódulos de la Agenda: Turnos y Calendario.
//
// La regla que más importa es la de compatibilidad. Los negocios que ya
// existen tienen "agenda" en la lista y ningún hijo escrito, y eso tiene que
// seguir queriendo decir "la Agenda entera", no "la Agenda vacía".

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import {
  LISTA_MODULOS,
  LISTA_SUBMODULOS,
  MODULOS,
  SUBMODULOS,
  alternarModulo,
  estaPrendido,
  hijosActivos,
  hijosDe,
  motivoParaNoApagar,
} from "../src/lib/modulos.js";

const claves = (lista) => lista.map((m) => m.clave).sort();

// ---------- el catálogo ----------

test("los submódulos no ensucian la lista de módulos", () => {
  // De LISTA_MODULOS salen el contador de "Mi negocio" y lo que recomienda
  // cada preset. Si los hijos entraran ahí, esos números cambiarían solos.
  assert.deepEqual(claves(LISTA_MODULOS), [
    "agenda",
    "clientes",
    "equipo",
    "historial",
    "inventario",
    "presupuesto",
  ]);
  for (const s of LISTA_SUBMODULOS) {
    assert.ok(!LISTA_MODULOS.includes(s), `${s.clave} se coló entre los módulos`);
  }
});

test("los módulos van en el orden de la barra lateral", () => {
  // Quien busca en "Módulos" lo que ve en el menú lo encuentra en el mismo
  // lugar.
  assert.deepEqual(
    LISTA_MODULOS.map((m) => m.clave),
    ["agenda", "clientes", "inventario", "presupuesto", "equipo", "historial"]
  );
});

test("el módulo de /aprobar se llama como en el menú", () => {
  // SCRUM-121. Se llamaba "Presupuesto" y apagarlo no apagaba ningún
  // presupuesto: sólo la pantalla "A aprobar".
  assert.equal(MODULOS.presupuesto.nombre, "A aprobar");
  assert.equal(MODULOS.presupuesto.ruta, "/aprobar");
});

test("cada submódulo cuelga de un módulo que existe", () => {
  for (const s of LISTA_SUBMODULOS) {
    assert.ok(MODULOS[s.padre], `${s.clave} cuelga de un módulo desconocido: ${s.padre}`);
  }
});

test("la Agenda tiene Turnos y Calendario", () => {
  assert.deepEqual(claves(hijosDe("agenda")), ["calendario", "turnos"]);
});

test("el Inventario tiene En stock y En camino", () => {
  // SCRUM-113.
  assert.deepEqual(claves(hijosDe("inventario")), ["en_camino", "stock"]);
});

test("un negocio de antes con el Inventario prendido tiene las dos pantallas", () => {
  // Nadie tiene "stock" ni "en_camino" escritos: hasta hoy no existían.
  assert.deepEqual(claves(hijosActivos("inventario", ["inventario", "agenda"])), [
    "en_camino",
    "stock",
  ]);
});

test("los otros módulos no tienen hijos", () => {
  for (const clave of ["equipo", "presupuesto", "clientes", "historial"]) {
    assert.deepEqual(hijosDe(clave), []);
  }
});

test("cada submódulo tiene lo que la pantalla del módulo apagado necesita", () => {
  for (const s of LISTA_SUBMODULOS) {
    assert.ok(s.nombre, `${s.clave} sin nombre`);
    assert.ok(s.descripcion, `${s.clave} sin descripción`);
    assert.ok(s.ruta?.startsWith("/"), `${s.clave} sin ruta`);
  }
});

// ---------- qué hijos están prendidos ----------

test("con la Agenda apagada no hay ningún hijo prendido", () => {
  assert.deepEqual(hijosActivos("agenda", ["inventario"]), []);
});

test("un negocio de antes de los submódulos tiene los dos", () => {
  // Es el caso de toda cuenta creada hasta hoy: "agenda" sí, hijos no.
  assert.deepEqual(claves(hijosActivos("agenda", ["agenda", "inventario"])), [
    "calendario",
    "turnos",
  ]);
});

test("con un hijo escrito valen sólo los escritos", () => {
  assert.deepEqual(claves(hijosActivos("agenda", ["agenda", "calendario"])), ["calendario"]);
});

// ---------- prender y apagar ----------

test("prender la Agenda prende sus dos pantallas", () => {
  const despues = alternarModulo("agenda", []);
  assert.ok(despues.includes("agenda"));
  assert.deepEqual(claves(hijosActivos("agenda", despues)), ["calendario", "turnos"]);
});

test("apagar la Agenda se lleva a los hijos", () => {
  const despues = alternarModulo("agenda", ["agenda", "turnos", "calendario", "equipo"]);
  assert.deepEqual(despues, ["equipo"]);
});

test("apagar un hijo de un negocio viejo deja escrito al hermano", () => {
  // Sin materializar al hermano, filtrar "turnos" de una lista donde no está
  // no cambiaría nada y el interruptor no haría nada.
  const despues = alternarModulo("turnos", ["agenda"]);
  assert.deepEqual(claves(hijosActivos("agenda", despues)), ["calendario"]);
  assert.ok(despues.includes("agenda"), "la Agenda sigue prendida");
});

test("volver a prender el hijo apagado deja los dos", () => {
  const sinTurnos = alternarModulo("turnos", ["agenda"]);
  const despues = alternarModulo("turnos", sinTurnos);
  assert.deepEqual(claves(hijosActivos("agenda", despues)), ["calendario", "turnos"]);
});

test("prender y apagar un módulo sin hijos no toca a los demás", () => {
  // Con Equipo y no con Inventario: el Inventario tiene pantallas adentro
  // desde SCRUM-113.
  assert.deepEqual(alternarModulo("equipo", ["agenda"]).sort(), ["agenda", "equipo"]);
  assert.deepEqual(alternarModulo("equipo", ["agenda", "equipo"]), ["agenda"]);
});

test("prender el Inventario prende sus dos pantallas, y apagarlo se las lleva", () => {
  const con = alternarModulo("inventario", ["agenda"]);
  assert.deepEqual(claves(hijosActivos("inventario", con)), ["en_camino", "stock"]);
  assert.deepEqual(alternarModulo("inventario", con), ["agenda"]);
});

// ---------- la última pantalla no se apaga ----------

test("el último hijo prendido no se puede apagar, y el botón dice por qué", () => {
  const soloCalendario = ["agenda", "calendario"];
  assert.equal(motivoParaNoApagar("calendario", soloCalendario), "apagá Agenda");
});

test("con los dos prendidos, cualquiera de los dos se puede apagar", () => {
  const losDos = ["agenda", "turnos", "calendario"];
  assert.equal(motivoParaNoApagar("turnos", losDos), null);
  assert.equal(motivoParaNoApagar("calendario", losDos), null);
});

test("un negocio viejo puede apagar cualquiera de los dos", () => {
  assert.equal(motivoParaNoApagar("turnos", ["agenda"]), null);
  assert.equal(motivoParaNoApagar("calendario", ["agenda"]), null);
});

test("un módulo que no es hijo nunca tiene motivo", () => {
  assert.equal(motivoParaNoApagar("agenda", ["agenda"]), null);
  assert.equal(motivoParaNoApagar("inventario", ["inventario"]), null);
});

// ---------- la invariante que sostiene todo ----------

test("nunca queda un módulo prendido sin ninguna pantalla adentro", () => {
  // Se recorre todo lo que se puede tocar desde la pantalla de módulos, y en
  // ningún estado alcanzable la Agenda ni el Inventario quedan prendidos y
  // vacíos.
  const partidas = [
    ["agenda", "inventario"],
    ["agenda", "turnos", "calendario", "inventario", "stock", "en_camino"],
    ["agenda", "turnos", "inventario", "stock"],
    ["agenda", "calendario", "inventario", "en_camino"],
  ];
  const padres = [...new Set(LISTA_SUBMODULOS.map((s) => s.padre))];
  for (const activos of partidas) {
    for (const clave of Object.keys(SUBMODULOS)) {
      if (motivoParaNoApagar(clave, activos)) continue;
      const despues = alternarModulo(clave, activos);
      for (const padre of padres) {
        if (!despues.includes(padre)) continue;
        assert.ok(
          hijosActivos(padre, despues).length > 0,
          `apagar ${clave} desde [${activos}] dejó ${padre} vacío`
        );
      }
    }
  }
});

test("apagar una pantalla del Inventario no toca las de la Agenda", () => {
  const todo = ["agenda", "turnos", "calendario", "inventario", "stock", "en_camino"];
  const sinStock = alternarModulo("stock", todo);
  assert.deepEqual(claves(hijosActivos("agenda", sinStock)), ["calendario", "turnos"]);
  assert.deepEqual(claves(hijosActivos("inventario", sinStock)), ["en_camino"]);
});

// ---------- los módulos de fábrica: Clientes e Historial ----------
//
// SCRUM-120 y SCRUM-122. Eran núcleo y pasaron a módulo. Lo que más importa
// probar es que NINGÚN negocio que ya existe los pierda: ninguno los tiene
// escritos en su lista, porque hasta ahora no hacía falta.

// Las listas de negocios reales de hoy: los cuatro presets, uno vacío a mano,
// y el de las pruebas de navegador.
const NEGOCIOS_DE_HOY = [
  ["agenda", "inventario", "equipo", "presupuesto"],
  ["agenda", "equipo", "presupuesto"],
  ["agenda"],
  [],
  ["equipo", "presupuesto", "clientes", "historial"],
];

test("Clientes e Historial son de fábrica, los demás no", () => {
  const deFabrica = LISTA_MODULOS.filter((m) => m.deFabrica).map((m) => m.clave).sort();
  assert.deepEqual(deFabrica, ["clientes", "historial"]);
});

test("ningún negocio que ya existe pierde Clientes ni Historial", () => {
  for (const activos of NEGOCIOS_DE_HOY) {
    assert.ok(estaPrendido("clientes", activos), `perdió Clientes: [${activos}]`);
    assert.ok(estaPrendido("historial", activos), `perdió Historial: [${activos}]`);
  }
});

test("los opcionales de siempre siguen necesitando estar escritos", () => {
  // Que la regla nueva no cambie la vieja: la Agenda que no está en la lista
  // sigue apagada.
  assert.equal(estaPrendido("agenda", []), false);
  assert.equal(estaPrendido("agenda", ["agenda"]), true);
  assert.equal(estaPrendido("presupuesto", ["agenda"]), false);
});

test("apagar Clientes lo apaga, y prenderlo de nuevo lo vuelve a prender", () => {
  const sin = alternarModulo("clientes", ["agenda"]);
  assert.equal(estaPrendido("clientes", sin), false);
  const con = alternarModulo("clientes", sin);
  assert.equal(estaPrendido("clientes", con), true);
});

test("prender de nuevo un módulo de fábrica no deja basura en la lista", () => {
  // Ida y vuelta tiene que dejar la lista como estaba, no con marcas sueltas.
  const antes = ["agenda", "equipo"];
  const idaYVuelta = alternarModulo("historial", alternarModulo("historial", antes));
  assert.deepEqual(idaYVuelta, antes);
});

test("apagar Historial no toca Clientes, ni al revés", () => {
  const sinHistorial = alternarModulo("historial", ["agenda"]);
  assert.equal(estaPrendido("clientes", sinHistorial), true);
  assert.equal(estaPrendido("agenda", sinHistorial), true);

  const sinClientes = alternarModulo("clientes", ["agenda"]);
  assert.equal(estaPrendido("historial", sinClientes), true);
});

test("apagar un módulo de fábrica no lo confunde con uno escrito", () => {
  // La lista de las pruebas de navegador ya traía "clientes" escrito. Eso no
  // puede impedir apagarlo.
  const activos = ["equipo", "clientes"];
  assert.equal(estaPrendido("clientes", alternarModulo("clientes", activos)), false);
});

test("los módulos de fábrica no tienen pantallas adentro", () => {
  // alternarModulo() no cruza la regla de fábrica con la de los submódulos.
  // Si algún día un módulo de fábrica tuviera hijos, esto tiene que fallar
  // antes de que alguien lo descubra en producción.
  for (const m of LISTA_MODULOS.filter((x) => x.deFabrica)) {
    assert.deepEqual(hijosDe(m.clave), [], `${m.clave} es de fábrica y tiene hijos`);
  }
});

test("una clave que no está en el catálogo se trata como opcional", () => {
  // No se inventa que está prendida: vale sólo si está escrita, como
  // cualquier módulo que no es de fábrica.
  assert.equal(estaPrendido("loquesea", ["loquesea"]), true);
  assert.equal(estaPrendido("loquesea", []), false);
});
