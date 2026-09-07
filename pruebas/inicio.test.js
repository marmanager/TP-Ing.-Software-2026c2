// Correr con: npm test
//
// La grilla del Inicio. Lo que se prueba acá es lo que rompe cuando alguien
// arrastra un módulo encima de otro: que nunca queden dos pisados, que nada
// se salga de las seis columnas, y que el que estás arrastrando quede donde
// lo soltaste y no lo empuje el que estaba abajo.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CATALOGO,
  COLUMNAS,
  INICIO_POR_DEFECTO,
  MAX_ALTO,
  agregables,
  agregar,
  cambiarFiltro,
  colocar,
  compactar,
  filasPara,
  intercambiar,
  normalizarInicio,
  quitar,
  redimensionar,
  resolver,
  sePisan,
  visibles,
} from "../src/lib/inicio.js";

const claves = (layout) => layout.map((m) => m.clave);
const de = (layout, clave) => layout.find((m) => m.clave === clave);
const TODOS_LOS_MODULOS = ["agenda", "inventario", "equipo", "presupuesto"];

// Las invariantes que tienen que valer siempre, pase lo que pase.
function grillaSana(layout, mensaje = "") {
  for (const a of layout) {
    assert.ok(a.x >= 0, `${mensaje} ${a.clave} arranca fuera de la grilla`);
    assert.ok(
      a.x + a.ancho <= COLUMNAS,
      `${mensaje} ${a.clave} se pasa del ancho: x=${a.x} ancho=${a.ancho}`
    );
    assert.ok(a.ancho >= 1 && a.alto >= 1, `${mensaje} ${a.clave} tiene tamaño cero`);
    assert.ok(a.y >= 0, `${mensaje} ${a.clave} está arriba de la primera fila`);

    for (const b of layout) {
      assert.ok(!sePisan(a, b), `${mensaje} ${a.clave} y ${b.clave} se pisan`);
    }
  }
}

// Esto vale sólo después de compactar, que es lo que pasa al guardar y al
// leer la configuración. Mientras se acomoda la pantalla los huecos se ven a
// propósito, así uno mira lo que está haciendo.
function sinHuecosVerticales(layout, mensaje = "") {
  for (const a of layout) {
    if (a.y === 0) continue;
    const unaFilaArriba = { ...a, y: a.y - 1 };
    assert.ok(
      layout.some((b) => sePisan(unaFilaArriba, b)),
      `${mensaje} ${a.clave} tiene un hueco arriba: está en y=${a.y} y podría subir`
    );
  }
}

test("el orden por defecto es una grilla sana", () => {
  const config = normalizarInicio(INICIO_POR_DEFECTO);
  grillaSana(config, "por defecto:");
  sinHuecosVerticales(config, "por defecto:");
  assert.deepEqual(claves(config), ["pendientes", "casos", "agenda", "inventario"]);
});

test("el orden por defecto reproduce el boceto", () => {
  const c = normalizarInicio(INICIO_POR_DEFECTO);

  // Arriba, a todo el ancho.
  assert.deepEqual(
    { x: de(c, "pendientes").x, y: de(c, "pendientes").y, ancho: de(c, "pendientes").ancho },
    { x: 0, y: 0, ancho: 6 }
  );
  // Casos grande a la izquierda; agenda e inventario en columna a la derecha.
  assert.equal(de(c, "casos").x, 0);
  assert.equal(de(c, "agenda").x, 4);
  assert.equal(de(c, "inventario").x, 4);
  assert.equal(de(c, "casos").y, de(c, "agenda").y, "casos y agenda arrancan en la misma fila");
  assert.ok(de(c, "inventario").y > de(c, "agenda").y, "inventario va debajo de agenda");
});

test("dos módulos pueden ir uno al lado del otro, no sólo apilados", () => {
  const layout = resolver([
    { clave: "casos", x: 0, y: 0, ancho: 3, alto: 1, filtro: null },
    { clave: "agenda", x: 3, y: 0, ancho: 3, alto: 1, filtro: null },
  ]);

  grillaSana(layout);
  assert.equal(de(layout, "casos").y, de(layout, "agenda").y, "quedan en la misma fila");
  assert.equal(de(layout, "agenda").x, 3, "y no lo empuja para abajo");
});

test("al soltar un módulo encima de otro, el otro se corre y el arrastrado se queda", () => {
  const antes = resolver([
    { clave: "casos", x: 0, y: 0, ancho: 3, alto: 1, filtro: null },
    { clave: "agenda", x: 0, y: 1, ancho: 3, alto: 1, filtro: null },
  ]);

  // Agarro agenda y la suelto justo encima de casos.
  const despues = colocar(antes, "agenda", 0, 0);

  grillaSana(despues, "tras soltar:");
  assert.equal(de(despues, "agenda").y, 0, "la que arrastré se queda con el lugar");
  assert.equal(de(despues, "casos").y, 1, "el que estaba ahí se corrió abajo");
});

test("acomodando, el hueco se ve; al guardar, se recorta", () => {
  const antes = normalizarInicio(INICIO_POR_DEFECTO);

  // Lo arrastro treinta filas para abajo, a la nada.
  const acomodando = colocar(antes, "inventario", 4, 30);
  grillaSana(acomodando, "acomodando:");
  assert.equal(
    de(acomodando, "inventario").y,
    30,
    "mientras acomodás queda donde lo soltaste, con el vacío a la vista"
  );

  // Y al guardar sube hasta apoyarse en lo que tiene encima en sus columnas.
  const guardado = compactar(acomodando);
  grillaSana(guardado, "guardado:");
  sinHuecosVerticales(guardado, "guardado:");

  const arriba = guardado.filter(
    (m) => m.clave !== "inventario" && m.x < 6 && m.x + m.ancho > 4
  );
  const tope = arriba.reduce((max, m) => Math.max(max, m.y + m.alto), 0);
  assert.equal(de(guardado, "inventario").y, tope, "queda apoyado, sin vacío en el medio");
});

test("los huecos horizontales sí se respetan: nadie se corre solo a la izquierda", () => {
  const layout = resolver([
    { clave: "casos", x: 0, y: 0, ancho: 2, alto: 1, filtro: null },
    // A propósito con una columna libre entre los dos.
    { clave: "agenda", x: 3, y: 0, ancho: 2, alto: 1, filtro: null },
  ]);

  grillaSana(layout);
  assert.equal(de(layout, "agenda").x, 3, "se queda donde la puse, con el hueco al lado");
  assert.equal(de(layout, "agenda").y, 0, "y en la misma fila");
});

test("sacar un módulo hace subir a los que tenía debajo", () => {
  const antes = normalizarInicio(INICIO_POR_DEFECTO);
  const yInventarioAntes = de(antes, "inventario").y;

  // Saco la agenda, que estaba entre pendientes e inventario.
  const acomodando = resolver(quitar(antes, "agenda"));
  assert.equal(
    de(acomodando, "inventario").y,
    yInventarioAntes,
    "acomodando, el hueco que dejó la agenda queda a la vista"
  );

  const guardado = compactar(acomodando);
  grillaSana(guardado, "tras guardar:");
  sinHuecosVerticales(guardado, "tras guardar:");
  assert.ok(
    de(guardado, "inventario").y < yInventarioAntes,
    "al guardar, el hueco se cierra"
  );
});

test("no se pierde ni se duplica ningún módulo al moverlos", () => {
  let layout = normalizarInicio(INICIO_POR_DEFECTO);
  const alPrincipio = claves(layout).sort();

  // Una tanda de movimientos de los que haría alguien acomodando la pantalla.
  const zarandeo = [
    ["casos", 4, 0],
    ["agenda", 0, 0],
    ["inventario", 2, 3],
    ["pendientes", 0, 5],
    ["casos", 0, 0],
  ];

  for (const [clave, x, y] of zarandeo) {
    layout = colocar(layout, clave, x, y);
    grillaSana(layout, `tras mover ${clave}:`);
    assert.deepEqual(claves(layout).sort(), alPrincipio, "cambió la lista de módulos");
  }
});

test("nada se sale de las seis columnas, ni moviendo ni agrandando", () => {
  let layout = normalizarInicio(INICIO_POR_DEFECTO);

  // Arrastrado bien a la derecha, se frena contra el borde.
  layout = colocar(layout, "casos", 99, 0);
  assert.equal(de(layout, "casos").x, COLUMNAS - de(layout, "casos").ancho);

  // Y a la izquierda.
  layout = colocar(layout, "casos", -5, 0);
  assert.equal(de(layout, "casos").x, 0);

  // Estirado a lo ancho desde la mitad, se frena donde termina la grilla.
  layout = colocar(layout, "agenda", 4, 0);
  layout = redimensionar(layout, "agenda", 99, 99);
  assert.equal(de(layout, "agenda").ancho, COLUMNAS - 4);
  assert.equal(de(layout, "agenda").alto, MAX_ALTO);

  // Achicado hasta la nada, queda en una celda.
  layout = redimensionar(layout, "agenda", -3, 0);
  assert.deepEqual(
    { ancho: de(layout, "agenda").ancho, alto: de(layout, "agenda").alto },
    { ancho: 1, alto: 1 }
  );

  grillaSana(layout, "tras estirar:");
});

test("agrandar un módulo empuja al que tiene abajo", () => {
  const layout = resolver([
    { clave: "casos", x: 0, y: 0, ancho: 3, alto: 1, filtro: null },
    { clave: "agenda", x: 0, y: 1, ancho: 3, alto: 1, filtro: null },
  ]);
  assert.equal(de(layout, "agenda").y, 1);

  const estirado = redimensionar(layout, "casos", 3, 3);
  grillaSana(estirado, "tras agrandar:");
  assert.equal(de(estirado, "casos").alto, 3, "el que agrandé se queda con el tamaño nuevo");
  assert.ok(de(estirado, "agenda").y >= 3, "el de abajo se corrió");
});

test("los módulos se leen de arriba abajo y de izquierda a derecha", () => {
  // Es el orden del DOM, y por lo tanto el que ve el celular en una columna.
  const layout = resolver([
    { clave: "inventario", x: 4, y: 1, ancho: 2, alto: 1, filtro: null },
    { clave: "pendientes", x: 0, y: 0, ancho: 6, alto: 1, filtro: null },
    { clave: "casos", x: 0, y: 1, ancho: 4, alto: 1, filtro: null },
  ]);

  assert.deepEqual(claves(layout), ["pendientes", "casos", "inventario"]);
});

test("subir y bajar intercambian el lugar con el vecino", () => {
  const antes = normalizarInicio(INICIO_POR_DEFECTO);
  assert.deepEqual(claves(antes), ["pendientes", "casos", "agenda", "inventario"]);

  const subido = intercambiar(antes, "agenda", -1);
  grillaSana(subido, "tras subir:");
  assert.equal(claves(subido).indexOf("agenda"), 1, "agenda subió un lugar");

  // Contra los bordes no hace nada.
  assert.deepEqual(claves(intercambiar(antes, "pendientes", -1)), claves(antes));
  assert.deepEqual(claves(intercambiar(antes, "inventario", 1)), claves(antes));
});

test("un módulo nuevo entra abajo de todo, sin tapar nada", () => {
  const antes = normalizarInicio(INICIO_POR_DEFECTO);
  const despues = agregar(antes, "equipo");

  grillaSana(despues, "tras agregar:");
  assert.ok(claves(despues).includes("equipo"));

  const abajoDeLoDemas = antes.reduce((max, m) => Math.max(max, m.y + m.alto), 0);
  assert.ok(de(despues, "equipo").y >= abajoDeLoDemas, "no se metió arriba de nada");

  assert.deepEqual(
    claves(agregar(despues, "equipo")).sort(),
    claves(despues).sort(),
    "agregar dos veces el mismo no lo duplica"
  );
  assert.ok(!claves(quitar(despues, "equipo")).includes("equipo"));
});

test("un módulo apagado en Mi negocio no se muestra, pero no se pierde", () => {
  const config = normalizarInicio(INICIO_POR_DEFECTO);

  assert.deepEqual(claves(visibles(config, ["agenda"])), ["pendientes", "casos", "agenda"]);
  assert.deepEqual(claves(visibles(config, TODOS_LOS_MODULOS)), claves(config));
});

test("sólo se ofrecen módulos que se pueden usar y que no están puestos", () => {
  const config = normalizarInicio(INICIO_POR_DEFECTO);

  assert.deepEqual(
    agregables(config, TODOS_LOS_MODULOS).map((d) => d.clave).sort(),
    ["aprobar", "clientes", "equipo"]
  );
  assert.deepEqual(
    agregables(config, []).map((d) => d.clave),
    ["clientes"],
    "sin módulos prendidos sólo queda el núcleo"
  );
});

test("una configuración vieja, sin lugar guardado, se apila y no se pisa", () => {
  // Así se guardaba antes de que los módulos tuvieran x e y.
  const vieja = [
    { clave: "casos", ancho: 4, alto: 2, filtro: "abiertos" },
    { clave: "agenda", ancho: 2, alto: 1, filtro: "hoy" },
    { clave: "inventario", ancho: 2, alto: 1, filtro: "bajo" },
  ];

  const config = normalizarInicio(vieja);
  grillaSana(config, "config vieja:");
  sinHuecosVerticales(config, "config vieja:");
  assert.deepEqual(claves(config), ["casos", "agenda", "inventario"]);
});

test("normalizar arregla lo que venga guardado, por roto que esté", () => {
  // Sin nada guardado vale el orden por defecto, no una pantalla vacía.
  assert.deepEqual(claves(normalizarInicio(undefined)), claves(INICIO_POR_DEFECTO));
  assert.deepEqual(claves(normalizarInicio(null)), claves(INICIO_POR_DEFECTO));

  // Una lista vacía de verdad se respeta: alguien sacó todos los módulos.
  assert.deepEqual(normalizarInicio([]), []);

  const sucio = [
    { clave: "casos", x: 99, y: -4, ancho: 0, alto: 999 },
    { clave: "modulo-que-borramos", x: 0, y: 0, ancho: 2, alto: 1 },
    { clave: "agenda", x: 0, y: 0, ancho: 2, alto: 1 },
    { clave: "inventario" },
  ];
  const limpio = normalizarInicio(sucio);

  grillaSana(limpio, "config sucia:");
  sinHuecosVerticales(limpio, "config sucia:");
  assert.deepEqual(claves(limpio).sort(), ["agenda", "casos", "inventario"]);
  assert.equal(de(limpio, "casos").ancho, CATALOGO.casos.ancho, "un ancho inválido vuelve al del catálogo");
  assert.equal(de(limpio, "casos").alto, MAX_ALTO, "un alto enorme se recorta al máximo");
  assert.equal(de(limpio, "inventario").filtro, "bajo", "sin filtro guardado toma el primero");
});

test("cambiar el filtro no mueve nada de lugar", () => {
  const antes = normalizarInicio(INICIO_POR_DEFECTO);
  const despues = cambiarFiltro(antes, "casos", "esperando");

  assert.equal(de(despues, "casos").filtro, "esperando");
  assert.equal(de(despues, "agenda").filtro, "hoy");
  assert.deepEqual(
    despues.map((m) => [m.clave, m.x, m.y]),
    antes.map((m) => [m.clave, m.x, m.y])
  );
});

test("cuántas filas de contenido entran según el alto", () => {
  assert.equal(filasPara(1), 1);
  assert.ok(filasPara(2) > filasPara(1), "más alto muestra más filas");
  assert.ok(filasPara(3) > filasPara(2));
  assert.ok(filasPara(0) >= 1, "nunca cero filas");
});
