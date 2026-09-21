// Correr con: npm test
//
// Cuando el cliente contesta, el caso se suelta solo (flujo, puntos 5 y 6).
//
// Antes el cliente aprobaba desde el link y del lado del negocio no pasaba
// nada: el caso se quedaba esperando hasta que alguien se acordara de mirar.
// La pelota quedaba en el aire.
//
// La misma cuenta la hace la base en 022_el_cliente_destraba.sql. Estos
// tests son de la versión en JavaScript, que es la que corre en el modo de
// ejemplo, pero las dos tienen que decir lo mismo.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FIRMA_DEL_CLIENTE,
  casosQueContestoElCliente,
  elClienteDestraba,
} from "../src/lib/estados.js";

const caso = (estado = "esperando", extra = {}) => ({ id: "k1", numero: 1, estado, ...extra });
const paso = (estado, caso_id = "k1") => ({ caso_id, estado });
const insumo = (estado, caso_id = "k1") => ({ caso_id, estado });

// ------------------------------------------------------------
// Cuándo se suelta
// ------------------------------------------------------------

test("contestado lo último que faltaba, el caso se suelta", () => {
  assert.equal(
    elClienteDestraba(caso(), { pasos: [paso("aprobado"), paso("rechazado")] }),
    true
  );
});

test("si todavía queda algo por contestar, sigue esperando", () => {
  // Con tres pasos en la mesa el cliente puede aprobar uno hoy y pensar los
  // otros dos. El caso sigue esperando, porque sigue esperando.
  assert.equal(
    elClienteDestraba(caso(), { pasos: [paso("aprobado"), paso("esperando")] }),
    false
  );
});

test("rechazar destraba igual que aprobar", () => {
  // Un "no" es una respuesta. Si no destrabara, un paso rechazado dejaría el
  // caso trabado para siempre.
  assert.equal(elClienteDestraba(caso(), { pasos: [paso("rechazado")] }), true);
});

test("si lo que traba es un repuesto, contestar no lo suelta", () => {
  // El cliente ya dijo que sí, pero el auto sigue sin poder salir.
  assert.equal(
    elClienteDestraba(caso(), {
      pasos: [paso("aprobado")],
      insumos: [insumo("pedido")],
    }),
    false
  );
});

test("un insumo que ya llegó no traba nada", () => {
  assert.equal(
    elClienteDestraba(caso(), {
      pasos: [paso("aprobado")],
      insumos: [insumo("en_stock")],
    }),
    true
  );
});

test("los pasos y los insumos de otro caso no cuentan", () => {
  assert.equal(
    elClienteDestraba(caso(), {
      pasos: [paso("aprobado"), paso("esperando", "k2")],
      insumos: [insumo("pedido", "k2")],
    }),
    true
  );
});

test("un caso que no está esperando no se toca", () => {
  // Si ya está en el taller, o en control final, contestar un paso suelto no
  // tiene por qué moverlo de donde está.
  for (const estado of ["nuevo", "en_proceso", "revision_final", "completado"]) {
    assert.equal(
      elClienteDestraba(caso(estado), { pasos: [paso("aprobado")] }),
      false,
      estado
    );
  }
});

test("sin caso no se decide nada", () => {
  assert.equal(elClienteDestraba(null, { pasos: [] }), false);
  assert.equal(elClienteDestraba(undefined), false);
});

test("un caso sin pasos no se suelta por las dudas", () => {
  // No hay nada esperando respuesta, pero tampoco hubo respuesta: el caso
  // quedó esperando por otra cosa que nadie escribió. Moverlo sería inventar.
  assert.equal(elClienteDestraba(caso(), { pasos: [] }), true);
});

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
