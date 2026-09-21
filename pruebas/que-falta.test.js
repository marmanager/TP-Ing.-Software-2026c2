// "Qué falta" tiene que decir el próximo paso, no repetir el estado.
//
// Como estaba, salía de una tabla por estado y para "en proceso" devolvía
// "Está en el taller", que es la etiqueta del estado. O sea que la tarjeta
// decía dos veces lo mismo: el chip arriba y el "qué falta" abajo.
//
// La cartilla (sección 05, anatomía de la tarjeta, punto 5) pide otra cosa:
// «"Qué falta" dice el próximo paso en el lenguaje del negocio», y su ejemplo
// es «que la clienta apruebe 3 de los 5 pasos». O sea, sale de los pasos y de
// los insumos del caso, no de una tabla fija.
//
// Correr con: npm test

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { queFalta } from "../src/lib/estados.js";

const caso = (estado, extra = {}) => ({ id: "k1", estado, responsable_id: null, ...extra });
const paso = (estado, nombre = "Un paso") => ({ caso_id: "k1", nombre, monto: 1000, estado });
const contexto = (extra = {}) => ({ rubro: "taller", pasos: [], insumos: [], ...extra });

test("un caso cerrado no tiene nada pendiente", () => {
  assert.equal(
    queFalta(caso("completado"), contexto()),
    "Nada, el caso está cerrado."
  );
});

test("un caso recién anotado y sin nadie, lo que falta es asignarlo", () => {
  assert.equal(
    queFalta(caso("nuevo"), contexto()),
    "Asignar a alguien del equipo"
  );
});

test("con pasos sin contestar, lo que falta es que el cliente conteste", () => {
  const dice = queFalta(
    caso("esperando", { responsable_id: "e1" }),
    contexto({
      cliente: { nombre: "Marcela Suárez" },
      pasos: [paso("aprobado"), paso("esperando"), paso("esperando"), paso("esperando")],
    })
  );

  assert.equal(dice, "Que Marcela Suárez apruebe 3 pasos");
});

test("un solo paso se dice en singular", () => {
  const dice = queFalta(
    caso("esperando", { responsable_id: "e1" }),
    contexto({ cliente: { nombre: "Ana" }, pasos: [paso("esperando")] })
  );

  assert.equal(dice, "Que Ana apruebe 1 paso");
});

test("sin cliente cargado no dice 'undefined'", () => {
  const dice = queFalta(
    caso("esperando", { responsable_id: "e1" }),
    contexto({ pasos: [paso("esperando")] })
  );

  assert.equal(dice, "Que el cliente apruebe 1 paso");
});

test("si lo que traba es un insumo, lo que falta es que llegue", () => {
  const dice = queFalta(
    caso("esperando", { responsable_id: "e1" }),
    contexto({
      insumos: [{ caso_id: "k1", nombre: "Correa de distribución", estado: "pedido" }],
    })
  );

  // Entre comillas y sin artículo: "la correa" pero "el filtro" y "las
  // pastillas", y adivinar el género del insumo que cargó el usuario no es
  // algo que valga la pena resolver. Las comillas lo vuelven un nombre.
  assert.equal(dice, "Que llegue «Correa de distribución»");
});

test("un caso sin presupuesto todavía: lo que falta es armarlo", () => {
  assert.equal(
    queFalta(caso("en_proceso", { responsable_id: "e1" }), contexto()),
    "Armar el presupuesto"
  );
});

test("con todo aprobado y en el taller, lo que falta es hacer el trabajo", () => {
  assert.equal(
    queFalta(
      caso("en_proceso", { responsable_id: "e1" }),
      contexto({ pasos: [paso("aprobado"), paso("aprobado")] })
    ),
    "Hacer el trabajo"
  );
});

test("en control final, lo que falta es el control del rubro", () => {
  assert.equal(
    queFalta(caso("revision_final", { responsable_id: "e1" }), contexto({ pasos: [paso("aprobado")] })),
    "Control antes de entregar"
  );
  assert.equal(
    queFalta(
      caso("revision_final", { responsable_id: "e1" }),
      contexto({ rubro: "medicina", pasos: [paso("aprobado")] })
    ),
    "Control antes del alta"
  );
});

test("nunca repite la etiqueta del estado, que es lo que pasaba antes", () => {
  // "Está en el taller" era literalmente lo que devolvía para en_proceso.
  const dice = queFalta(
    caso("en_proceso", { responsable_id: "e1" }),
    contexto({ pasos: [paso("aprobado")] })
  );
  assert.notEqual(dice, "Está en el taller");
});

test("nunca queda vacío, en ningún estado ni rubro", () => {
  for (const rubro of ["taller", "medicina", "service"]) {
    for (const estado of ["nuevo", "en_proceso", "esperando", "revision_final", "completado"]) {
      const dice = queFalta(caso(estado, { responsable_id: "e1" }), contexto({ rubro }));
      assert.ok(dice?.trim(), `${estado} en ${rubro} quedó vacío`);
    }
  }
});

// ------------------------------------------------------------
// Que las pantallas la usen
// ------------------------------------------------------------
// Esto no prueba comportamiento: lee el código fuente. Está acá porque el
// cableado ya se perdió una vez —en un merge con conflictos, sin que nada
// se quejara— y los tests de arriba no lo iban a notar: la función seguía
// estando y seguía andando; lo que faltaba era que alguien la llamara.
//
// El caso y su fila tienen que decir lo mismo, y "caso.que_falta" es la
// columna guardada, que es justamente lo que esto vino a reemplazar. La
// pantalla pública de seguimiento sí la usa, y a propósito: ahí el texto
// viaja ya recortado desde la base.

import { readFileSync } from "node:fs";

const PANTALLAS = [
  ["la pantalla del caso", "src/app/casos/[id]/page.js"],
  ["la fila de la lista de casos", "src/componentes/FilaCaso.js"],
  ["el módulo del Inicio", "src/componentes/inicio/cuerpos.js"],
];

for (const [donde, archivo] of PANTALLAS) {
  test(`${donde} deriva el "qué falta" en vez de mostrar la columna guardada`, () => {
    const fuente = readFileSync(new URL("../" + archivo, import.meta.url), "utf8");
    assert.ok(fuente.includes("queFalta("), `${archivo} no llama a queFalta()`);
    assert.ok(
      !fuente.includes("caso.que_falta"),
      `${archivo} sigue mostrando la columna guardada`
    );
  });
}
