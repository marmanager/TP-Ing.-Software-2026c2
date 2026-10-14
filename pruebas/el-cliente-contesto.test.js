// Correr con: npm test
//
// Cuando el cliente contesta, el caso se suelta solo (flujo, puntos 5 y 6).
//
// Antes el cliente aprobaba desde el link y del lado del negocio no pasaba
// nada: el caso se quedaba esperando hasta que alguien se acordara de mirar.
// La pelota quedaba en el aire.
//
// Soltar el caso lo hace la base (022_el_cliente_destraba.sql) cuando el
// cliente contesta desde el link. Acá queda lo que mira la pantalla: el aviso
// en el Inicio y el camino de vuelta desde control final.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import {
  FIRMA_DEL_CLIENTE,
  casosQueContestoElCliente,
  quedoTrabajoPendiente,
} from "../src/lib/estados.js";

const caso = (estado = "esperando", extra = {}) => ({ id: "k1", numero: 1, estado, ...extra });
const paso = (estado, caso_id = "k1") => ({ caso_id, estado });

// ------------------------------------------------------------
// El aviso en el Inicio
// ------------------------------------------------------------

const AHORA = new Date("2026-09-20T12:00:00.000Z").getTime();
const haceHoras = (h) => new Date(AHORA - h * 3600000).toISOString();

const evento = (caso_id, autor, horas) => ({
  caso_id,
  autor,
  ocurrido_en: haceHoras(horas),
});

test("avisa por los casos donde el cliente contestó hace poco", () => {
  const casos = [caso("esperando", { id: "k1" }), caso("en_proceso", { id: "k2" })];
  const eventos = [evento("k1", FIRMA_DEL_CLIENTE, 2)];

  assert.deepEqual(
    casosQueContestoElCliente(casos, eventos, { ahora: AHORA }).map((c) => c.id),
    ["k1"]
  );
});

test("lo que escribió el mostrador no es una novedad del cliente", () => {
  const casos = [caso("esperando")];
  const eventos = [evento("k1", "Vos", 2), evento("k1", "Diego", 1)];

  assert.deepEqual(casosQueContestoElCliente(casos, eventos, { ahora: AHORA }), []);
});

test("una respuesta del viernes sigue avisando el lunes", () => {
  // La ventana es de dos días a propósito: con una de veinticuatro horas, un
  // presupuesto contestado el viernes a la tarde no aparecería el lunes.
  const casos = [caso("esperando")];
  assert.equal(
    casosQueContestoElCliente(casos, [evento("k1", FIRMA_DEL_CLIENTE, 40)], { ahora: AHORA })
      .length,
    1
  );
  assert.equal(
    casosQueContestoElCliente(casos, [evento("k1", FIRMA_DEL_CLIENTE, 60)], { ahora: AHORA })
      .length,
    0
  );
});

test("un caso ya entregado no pide que nadie lo mire", () => {
  const casos = [caso("completado")];
  assert.deepEqual(
    casosQueContestoElCliente(casos, [evento("k1", FIRMA_DEL_CLIENTE, 1)], { ahora: AHORA }),
    []
  );
});

test("un caso no se repite por más que el cliente haya contestado tres pasos", () => {
  const casos = [caso("esperando")];
  const eventos = [
    evento("k1", FIRMA_DEL_CLIENTE, 3),
    evento("k1", FIRMA_DEL_CLIENTE, 2),
    evento("k1", FIRMA_DEL_CLIENTE, 1),
  ];
  assert.equal(casosQueContestoElCliente(casos, eventos, { ahora: AHORA }).length, 1);
});

test("sin eventos y sin casos no explota", () => {
  assert.deepEqual(casosQueContestoElCliente(), []);
  assert.deepEqual(casosQueContestoElCliente([], []), []);
});

// ------------------------------------------------------------
// El camino de vuelta (flujo, punto 10)
// ------------------------------------------------------------

const aprobado = (hecho_en = null) => ({ caso_id: "k1", estado: "aprobado", hecho_en });

test("un caso en control final con trabajo sin hacer lo dice", () => {
  // Se controló todo y justo ahí apareció otra cosa: se sumó un paso, se
  // aprobó, y el caso quedó diciendo "control final" con trabajo adentro.
  assert.equal(
    quedoTrabajoPendiente(caso("revision_final"), [aprobado("2026-09-20T10:00:00.000Z"), aprobado()]),
    true
  );
});

test("si está todo hecho, control final es control final", () => {
  assert.equal(
    quedoTrabajoPendiente(caso("revision_final"), [aprobado("2026-09-20T10:00:00.000Z")]),
    false
  );
});

test("en cualquier otro estado no se avisa nada", () => {
  // En el taller con trabajo sin hacer no es una contradicción: es el estado
  // normal de un caso en el taller.
  for (const estado of ["nuevo", "en_proceso", "esperando", "completado"]) {
    assert.equal(quedoTrabajoPendiente(caso(estado), [aprobado()]), false, estado);
  }
});

test("un paso sin contestar no cuenta como trabajo sin hacer", () => {
  assert.equal(
    quedoTrabajoPendiente(caso("revision_final"), [paso("esperando"), paso("rechazado")]),
    false
  );
});
