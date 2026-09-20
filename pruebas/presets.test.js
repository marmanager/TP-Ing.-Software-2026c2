// Correr con: npm test
//
// Los presets y sus módulos: que cada rubro renombre los cinco estados y que
// los módulos que trae existan en el catálogo. El resto se mira en pantalla.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PRESETS,
  RUBROS,
  preset,
  queFaltaPara,
  ORDEN_ROLES,
  etiquetaRol,
  comoSeIdentifica,
  ejemplosDe,
} from "../src/lib/presets.js";
import { MODULOS } from "../src/lib/modulos.js";
import { ORDEN_ESTADOS } from "../src/lib/estados.js";

test("hay tres rubros: taller, medicina y service", () => {
  assert.deepEqual(
    RUBROS.map((r) => r.clave),
    ["taller", "medicina", "service"]
  );
});

test("cada preset renombra los cinco estados con una palabra no vacía", () => {
  for (const r of RUBROS) {
    for (const estado of ORDEN_ESTADOS) {
      assert.equal(typeof r.etiquetas[estado], "string", `${r.clave} sin etiqueta para ${estado}`);
      assert.ok(r.etiquetas[estado].trim().length > 0, `${r.clave}.${estado} está vacío`);
    }
  }
});

test("los módulos que trae cada preset existen en el catálogo", () => {
  for (const r of RUBROS) {
    assert.ok(Array.isArray(r.modulos), `${r.clave} no tiene lista de módulos`);
    assert.ok(r.modulos.length > 0, `${r.clave} no trae ningún módulo`);
    for (const m of r.modulos) {
      assert.ok(MODULOS[m], `${r.clave} trae un módulo desconocido: ${m}`);
    }
  }
});

test("un rubro desconocido o vacío cae en taller", () => {
  assert.equal(preset("no_existe").clave, "taller");
  assert.equal(preset(undefined).clave, "taller");
  assert.equal(preset(null).clave, "taller");
});

test("ya no existe el preset veterinaria", () => {
  assert.equal(PRESETS.veterinaria, undefined);
});

// "Qué falta" queda guardado en el caso: si sale con las palabras del taller,
// un consultorio termina con casos que dicen "Está en el taller".
test("el 'qué falta' que se guarda sale en las palabras del rubro", () => {
  assert.equal(queFaltaPara("taller", "en_proceso"), "Está en el taller");
  assert.equal(queFaltaPara("medicina", "en_proceso"), "En consulta");
  assert.equal(queFaltaPara("service", "en_proceso"), "En reparación");

  assert.equal(queFaltaPara("taller", "revision_final"), "Control antes de entregar");
  assert.equal(queFaltaPara("medicina", "revision_final"), "Control antes del alta");
  assert.equal(queFaltaPara("service", "revision_final"), "Prueba antes de entregar");
});

test("un caso sin responsable dice lo mismo en todos los rubros", () => {
  for (const r of RUBROS) {
    assert.equal(queFaltaPara(r.clave, "nuevo"), "Asignar a alguien del equipo");
  }
});

// CAMBIO DE CRITERIO. Antes esto devolvía "" a propósito: qué se está
// esperando depende del caso —un repuesto, el sí del cliente— y lo escribía
// quien lo producía. Ese razonamiento valía cuando cada botón de "Cómo sigue"
// traía su texto a mano.
//
// Con el estado en un desplegable, pasar a esperando ya no pasa por ningún
// botón que sepa qué se espera, y el "" dejaba la tarjeta del caso con un
// "Qué falta:" vacío colgando. Ahora hay un texto genérico del rubro, y quien
// sabe más lo sigue pisando: el flujo del insumo escribe "El repuesto llega
// mañana", que es más preciso y le gana a esto.
test("esperando cae en lo genérico del rubro, que es mejor que un hueco", () => {
  assert.equal(queFaltaPara("taller", "esperando"), "El repuesto o el sí del cliente");

  for (const r of RUBROS) {
    assert.ok(queFaltaPara(r.clave, "esperando").trim(), `${r.clave} lo deja vacío`);
  }
});

test("un caso cerrado no tiene nada pendiente, en ningún rubro", () => {
  for (const r of RUBROS) {
    assert.equal(queFaltaPara(r.clave, "completado"), "Nada, el caso está cerrado.");
  }
});

// Mismo criterio que los estados: los tres roles son fijos porque la base no
// acepta otros, pero cómo se llaman sale del rubro.
test("cada preset le pone nombre a los tres roles", () => {
  for (const r of RUBROS) {
    for (const rol of ORDEN_ROLES) {
      assert.equal(typeof r.roles[rol], "string", `${r.clave} sin nombre para ${rol}`);
      assert.ok(r.roles[rol].trim().length > 0, `${r.clave}.${rol} está vacío`);
    }
  }
});

test("el que hace el trabajo se llama distinto en cada rubro", () => {
  assert.equal(etiquetaRol("taller", "tecnico"), "Mecánico");
  assert.equal(etiquetaRol("medicina", "tecnico"), "Profesional");
  assert.equal(etiquetaRol("service", "tecnico"), "Técnico");

  // Dueño y encargado se dicen igual en todos.
  for (const r of RUBROS) {
    assert.equal(etiquetaRol(r.clave, "duenio"), "Dueño");
    assert.equal(etiquetaRol(r.clave, "encargado"), "Encargado");
  }
});

// El identificador es lo más certero para reconocer un caso, y se pide al
// abrirlo. Si a un rubro le faltara, el alta quedaría pidiendo "falta
// undefined undefined".
test("cada rubro dice cómo identifica un caso, con su artículo", () => {
  for (const r of RUBROS) {
    const id = comoSeIdentifica(r.clave);
    for (const campo of ["nombre", "enFrase", "ejemplo"]) {
      assert.equal(typeof id[campo], "string", `${r.clave}.identificador sin ${campo}`);
      assert.ok(id[campo].trim().length > 0, `${r.clave}.identificador.${campo} vacío`);
    }
    assert.ok(/^(el|la) /.test(id.enFrase), `${r.clave}: "${id.enFrase}" tendría que empezar con el o la`);
  }
});

test("cada rubro identifica por lo suyo", () => {
  assert.equal(comoSeIdentifica("taller").nombre, "Patente");
  assert.equal(comoSeIdentifica("medicina").nombre, "DNI");
  assert.equal(comoSeIdentifica("service").nombre, "Número de serie");
  // Para meterlo en una oración. Pasar el nombre a minúsculas rompería la
  // sigla: "falta el dni" en vez de "falta el DNI".
  assert.equal(comoSeIdentifica("taller").enFrase, "la patente");
  assert.equal(comoSeIdentifica("medicina").enFrase, "el DNI");
});

// ---------------------------------------------------------------
// SCRUM-90: los ejemplos de los formularios son de cada rubro
// ---------------------------------------------------------------

test("cada rubro trae sus ejemplos para todos los formularios", () => {
  const claves = ["negocio", "descripcion", "servicio", "diagnostico", "paso", "turno", "insumo"];
  for (const r of RUBROS) {
    for (const clave of claves) {
      assert.ok(
        ejemplosDe(r.clave)[clave]?.trim(),
        `${r.clave} no tiene ejemplo de ${clave}`
      );
    }
  }
});

test("un ejemplo de un rubro no aparece en otro: cada oficio tiene los suyos", () => {
  const taller = ejemplosDe("taller");
  for (const otro of ["medicina", "service"]) {
    for (const [clave, texto] of Object.entries(ejemplosDe(otro))) {
      assert.notEqual(texto, taller[clave], `${otro}.${clave} repite el de taller`);
    }
  }
});
