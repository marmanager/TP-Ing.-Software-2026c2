// Las secciones 04 (módulos) y 05 (Remi) de la bienvenida: lo que se puede
// probar sin pantalla (docs/bienvenida-modulos-y-remi.md).

import { test, describe } from "@jest/globals";
import assert from "node:assert/strict";
import {
  CHARLAS_DE_REMI,
  DURACION_CHARLA,
  MODULOS_AL_PIE,
  MODULOS_DE_LA_BIENVENIDA,
  PASOS,
  estadoDeLaCharla,
  siguientePestana,
} from "../src/lib/bienvenida.js";
import { MODULOS } from "../src/lib/modulos.js";
import es from "../src/lib/idiomas/es.js";
import en from "../src/lib/idiomas/en.js";

describe("los módulos que muestra la bienvenida", () => {
  test("son seis con pantalla y tres al pie, sin repetirse", () => {
    assert.equal(MODULOS_DE_LA_BIENVENIDA.length, 6);
    assert.equal(MODULOS_AL_PIE.length, 3);
    const todos = [...MODULOS_DE_LA_BIENVENIDA, ...MODULOS_AL_PIE];
    assert.equal(new Set(todos).size, todos.length);
  });

  test("todos existen en el catálogo y tienen ícono: la landing no muestra un módulo que no hay", () => {
    for (const clave of [...MODULOS_DE_LA_BIENVENIDA, ...MODULOS_AL_PIE]) {
      assert.ok(MODULOS[clave], `${clave} no está en MODULOS`);
      assert.ok(MODULOS[clave].icono, `${clave} no tiene ícono`);
      for (const d of [es, en]) assert.ok(d.modulos[clave]?.nombre, `${clave} no tiene nombre traducido`);
    }
  });
});

describe("siguientePestana: el teclado en la lista de módulos", () => {
  test("abajo y derecha avanzan, y del último vuelven al primero", () => {
    assert.equal(siguientePestana(0, "ArrowDown", 6), 1);
    assert.equal(siguientePestana(2, "ArrowRight", 6), 3);
    assert.equal(siguientePestana(5, "ArrowDown", 6), 0);
  });

  test("arriba e izquierda retroceden, y del primero van al último", () => {
    assert.equal(siguientePestana(3, "ArrowUp", 6), 2);
    assert.equal(siguientePestana(1, "ArrowLeft", 6), 0);
    assert.equal(siguientePestana(0, "ArrowUp", 6), 5);
  });

  test("Inicio y Fin van a los extremos", () => {
    assert.equal(siguientePestana(3, "Home", 6), 0);
    assert.equal(siguientePestana(3, "End", 6), 5);
  });

  test("otra tecla no elige nada", () => {
    assert.equal(siguientePestana(3, "Enter", 6), null);
    assert.equal(siguientePestana(3, "a", 6), null);
  });
});

describe("estadoDeLaCharla: qué se ve de la charla de Remi", () => {
  // Cuándo aparece cada paso dentro de una charla.
  const desde = PASOS.reduce((acc, p, i) => [...acc, (acc[i - 1] ?? 0) + (i ? p.espera : 0)], []);

  test("arranca con la pregunta de la primera charla", () => {
    assert.deepEqual(estadoDeLaCharla(0), { charla: 0, pasos: 1 });
  });

  test("cada paso aparece justo en su momento, ni antes ni después", () => {
    for (let i = 1; i < PASOS.length; i++) {
      assert.equal(estadoDeLaCharla(desde[i] - 1).pasos, i, `antes del paso ${PASOS[i].paso}`);
      assert.equal(estadoDeLaCharla(desde[i]).pasos, i + 1, `en el paso ${PASOS[i].paso}`);
    }
  });

  test("después del último paso se queda quieta hasta la siguiente charla", () => {
    assert.deepEqual(estadoDeLaCharla(DURACION_CHARLA - 1), { charla: 0, pasos: PASOS.length });
    assert.deepEqual(estadoDeLaCharla(DURACION_CHARLA), { charla: 1, pasos: 1 });
  });

  test("de la última vuelve a la primera", () => {
    const vuelta = DURACION_CHARLA * CHARLAS_DE_REMI.length;
    assert.deepEqual(estadoDeLaCharla(vuelta - 1), { charla: CHARLAS_DE_REMI.length - 1, pasos: PASOS.length });
    assert.deepEqual(estadoDeLaCharla(vuelta), { charla: 0, pasos: 1 });
  });

  test("la quietud del final da tiempo a leer: más de lo que tardan los pasos", () => {
    const pasos = PASOS.reduce((s, p) => s + p.espera, 0);
    assert.ok(DURACION_CHARLA - pasos >= 3000);
  });
});

describe("los textos de las dos secciones", () => {
  // Las claves que pide la landing con L(`…`) no las revisa
  // idioma-claves.test.js, que sólo mira llamadas literales: una que falte se
  // vería cruda en pantalla. Por eso se revisan acá, en los dos sentidos.
  const hojas = (nodo, prefijo = "") =>
    Object.entries(nodo).flatMap(([k, v]) =>
      v && typeof v === "object" && !("one" in v) ? hojas(v, `${prefijo}${k}.`) : [`${prefijo}${k}`]
    );
  const buscar = (d, ruta) => ruta.split(".").reduce((n, k) => n?.[k], d);

  for (const seccion of ["modulos", "remi"]) {
    test(`acceso.landing.${seccion} tiene las mismas claves en castellano y en inglés`, () => {
      const enEs = es.acceso.landing[seccion];
      const enEn = en.acceso.landing[seccion];
      assert.ok(enEs && enEn, `falta acceso.landing.${seccion}`);
      assert.deepEqual(hojas(enEn).sort(), hojas(enEs).sort());
    });
  }

  test("cada módulo con pantalla tiene su frase, y cada charla su pregunta y su respuesta", () => {
    for (const d of [es, en]) {
      for (const clave of MODULOS_DE_LA_BIENVENIDA) {
        assert.ok(buscar(d, `acceso.landing.modulos.frase.${clave}`), `falta la frase de ${clave}`);
      }
      for (const { clave } of CHARLAS_DE_REMI) {
        assert.ok(buscar(d, `acceso.landing.remi.charlas.${clave}.pregunta`), `falta la pregunta de ${clave}`);
        assert.ok(buscar(d, `acceso.landing.remi.charlas.${clave}.respuesta`), `falta la respuesta de ${clave}`);
      }
    }
  });

  test("las tarjetas de Remi usan textos que la app ya tiene", () => {
    const usados = [
      "asistente.nombre", "asistente.vos", "asistente.pensando", "asistente.propuestaTitulo",
      "asistente.aplicar", "asistente.aplicando", "asistente.aplicada", "asistente.descartar", "asistente.cambios.prender",
      "asistente.ecuaciones.interpreto", "asistente.ecuaciones.constante", "asistente.ecuaciones.agregar",
      "asistente.ecuaciones.agregando", "asistente.ecuaciones.agregada", "asistente.apoyo",
    ];
    for (const d of [es, en]) for (const clave of usados) assert.ok(buscar(d, clave), `falta ${clave}`);
  });
});
