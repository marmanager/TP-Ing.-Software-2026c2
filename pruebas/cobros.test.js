// Correr con: npm run test:unit
//
// Los cobros de un caso: pagos parciales, cobros que todavía no entraron y
// qué se puede corregir. Las mismas reglas que supabase/025_cobros.sql.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import {
  ESTADOS_COBRO,
  MEDIOS,
  MEDIOS_DEL_LOCAL,
  cobradoDelCaso,
  cobrosDelCaso,
  cobrosPendientes,
  conCobro,
  cuentaDelCaso,
  estadoDeCobro,
  montoDeCobroValido,
  montoSugerido,
  sePuedeAnular,
} from "../src/lib/cobros.js";

const cobro = (extra = {}) => ({
  caso_id: "c1",
  monto: 10000,
  medio: "efectivo",
  estado: "pagado",
  creado_en: "2026-09-21T10:00:00.000Z",
  pagado_en: "2026-09-21T10:00:00.000Z",
  ...extra,
});

// ------------------------------------------------------------
// caso.cobrado: lo mismo que el trigger de la base
// ------------------------------------------------------------

test("caso.cobrado es la suma de lo pagado, con la fecha del último pago", () => {
  const r = cobradoDelCaso([
    cobro({ monto: 20000, pagado_en: "2026-09-18T10:00:00.000Z" }),
    cobro({ monto: 30000, pagado_en: "2026-09-21T12:00:00.000Z" }),
  ]);
  assert.deepEqual(r, { cobrado: 50000, cobrado_en: "2026-09-21T12:00:00.000Z" });
});

test("un cobro que todavía no se pagó no es plata que entró", () => {
  const r = cobradoDelCaso([cobro({ estado: "pendiente", medio: "link", pagado_en: null })]);
  assert.deepEqual(r, { cobrado: null, cobrado_en: null });
});

test("lo anulado, rechazado, vencido o devuelto no suma", () => {
  const r = cobradoDelCaso([
    cobro({ monto: 5000 }),
    cobro({ monto: 99999, estado: "anulado" }),
    cobro({ monto: 99999, estado: "rechazado" }),
    cobro({ monto: 99999, estado: "vencido" }),
    cobro({ monto: 99999, estado: "devuelto" }),
  ]);
  assert.equal(r.cobrado, 5000);
});

test("si se anula el único cobro, el caso vuelve a no tener nada registrado", () => {
  assert.equal(cobradoDelCaso([cobro({ estado: "anulado" })]).cobrado, null);
});

// ------------------------------------------------------------
// La cuenta contra lo aprobado
// ------------------------------------------------------------

test("sin ningún cobro, falta todo lo aprobado", () => {
  const c = cuentaDelCaso({ aprobado: 80000, cobros: [] });
  assert.equal(c.falta, 80000);
  assert.equal(c.situacion, "sin_cobrar");
});

test("una seña deja el resto por cobrar", () => {
  const c = cuentaDelCaso({ aprobado: 80000, cobros: [cobro({ monto: 20000 })] });
  assert.equal(c.pagado, 20000);
  assert.equal(c.falta, 60000);
  assert.equal(c.situacion, "parcial");
});

test("seña más el resto: cobrado completo", () => {
  const c = cuentaDelCaso({
    aprobado: 80000,
    cobros: [cobro({ monto: 20000 }), cobro({ monto: 60000, medio: "transferencia" })],
  });
  assert.equal(c.falta, 0);
  assert.equal(c.situacion, "completo");
});

test("lo pedido por link no se vuelve a pedir, pero tampoco cuenta como cobrado", () => {
  const c = cuentaDelCaso({
    aprobado: 80000,
    cobros: [cobro({ monto: 20000 }), cobro({ monto: 60000, medio: "link", estado: "pendiente" })],
  });
  assert.equal(c.pagado, 20000);
  assert.equal(c.pendiente, 60000);
  assert.equal(c.falta, 0);
  assert.equal(c.situacion, "esperando_pagos");
});

test("si el link vence, lo que tenía pedido vuelve a faltar", () => {
  const c = cuentaDelCaso({
    aprobado: 80000,
    cobros: [cobro({ monto: 20000 }), cobro({ monto: 60000, medio: "link", estado: "vencido" })],
  });
  assert.equal(c.falta, 60000);
  assert.equal(c.situacion, "parcial");
});

test("cobrar más de lo aprobado se dice, no se esconde", () => {
  const c = cuentaDelCaso({ aprobado: 50000, cobros: [cobro({ monto: 55000 })] });
  assert.equal(c.deMas, 5000);
  assert.equal(c.falta, 0);
  assert.equal(c.situacion, "de_mas");
});

test("un caso sin presupuesto aprobado puede cobrar igual", () => {
  const c = cuentaDelCaso({ aprobado: 0, cobros: [cobro({ monto: 15000 })] });
  assert.equal(c.falta, 0);
  assert.equal(c.situacion, "sin_presupuesto");
});

test("el formulario ofrece lo que falta, y nada cuando no falta nada", () => {
  assert.equal(montoSugerido(cuentaDelCaso({ aprobado: 80000, cobros: [cobro({ monto: 20000 })] })), 60000);
  assert.equal(montoSugerido(cuentaDelCaso({ aprobado: 20000, cobros: [cobro({ monto: 20000 })] })), null);
});

// ------------------------------------------------------------
// Qué se acepta y qué se puede corregir
// ------------------------------------------------------------

test("un cobro es un número mayor que cero, sin puntos", () => {
  assert.equal(montoDeCobroValido("20000"), true);
  assert.equal(montoDeCobroValido("0"), false, "un cobro de cero no es un cobro");
  assert.equal(montoDeCobroValido(""), false);
  assert.equal(montoDeCobroValido("-500"), false);
  assert.equal(montoDeCobroValido("20.000"), false);
  assert.equal(montoDeCobroValido("veinte mil"), false);
});

test("se anula lo pendiente y lo cobrado en el local", () => {
  assert.equal(sePuedeAnular(cobro()), true);
  assert.equal(sePuedeAnular(cobro({ medio: "tarjeta" })), true);
  assert.equal(sePuedeAnular(cobro({ medio: "link", estado: "pendiente" })), true);
});

test("un pago por link que ya entró no se anula: se devuelve desde el medio de pago", () => {
  assert.equal(sePuedeAnular(cobro({ medio: "link" })), false);
  assert.equal(sePuedeAnular(cobro({ medio: "qr" })), false);
});

test("lo que ya no cuenta no se anula de nuevo", () => {
  for (const estado of ["anulado", "rechazado", "vencido", "devuelto"]) {
    assert.equal(sePuedeAnular(cobro({ estado })), false, estado);
  }
  assert.equal(sePuedeAnular(null), false);
});

// ------------------------------------------------------------
// Vocabulario y listas
// ------------------------------------------------------------

test("cada estado tiene palabra, ícono y color, como pide la cartilla", () => {
  for (const e of Object.values(ESTADOS_COBRO)) {
    assert.ok(e.palabra && e.icono && e.texto, e.clave);
  }
  assert.equal(estadoDeCobro("cualquiera").clave, "pendiente");
});

test("los medios del local son los que el negocio puede anotar a mano", () => {
  for (const m of MEDIOS_DEL_LOCAL) assert.equal(MEDIOS[m].enElLocal, true, m);
  assert.equal(MEDIOS.link.enElLocal, false);
  assert.equal(MEDIOS.qr.enElLocal, false);
});

test("los cobros de un caso vienen en el orden en que pasaron", () => {
  const lista = cobrosDelCaso(
    [
      cobro({ id: "b", creado_en: "2026-09-21T12:00:00.000Z" }),
      cobro({ id: "x", caso_id: "otro" }),
      cobro({ id: "a", creado_en: "2026-09-18T12:00:00.000Z" }),
    ],
    "c1"
  );
  assert.deepEqual(lista.map((c) => c.id), ["a", "b"]);
});

test("para Inicio sólo cuentan los que esperan un pago", () => {
  const lista = cobrosPendientes([
    cobro({ estado: "pendiente", medio: "link" }),
    cobro(),
    cobro({ estado: "vencido", medio: "link" }),
  ]);
  assert.equal(lista.length, 1);
});

// ------------------------------------------------------------
// El estado de la aplicación: lo mismo que hace la base
// ------------------------------------------------------------

let n = 0;
const nuevoId = () => `id-${++n}`;
const estado = (caso, cobros = []) => ({ casos: [{ id: "c1", negocio_id: "n1", ...caso }], cobros });

test("un cobro nuevo actualiza lo cobrado del caso", () => {
  const d = conCobro(estado({ cobrado: null }), cobro({ id: "x", monto: 20000 }), { nuevoId });
  assert.equal(d.cobros.length, 1);
  assert.equal(d.casos[0].cobrado, 20000);
});

test("una seña y el resto se suman", () => {
  let d = conCobro(estado({}), cobro({ id: "x", monto: 20000 }), { nuevoId });
  d = conCobro(d, cobro({ id: "y", monto: 60000, pagado_en: "2026-09-22T10:00:00.000Z" }), { nuevoId });
  assert.equal(d.casos[0].cobrado, 80000);
  assert.equal(d.casos[0].cobrado_en, "2026-09-22T10:00:00.000Z");
});

test("un caso con un cobro de antes (012) no pierde lo que tenía al sumar uno nuevo", () => {
  const viejo = estado({ cobrado: 50000, cobrado_en: "2026-09-01T10:00:00.000Z" });
  const d = conCobro(viejo, cobro({ id: "x", monto: 10000 }), { adoptarLoViejo: true, nuevoId });
  assert.equal(d.cobros.length, 2);
  assert.equal(d.cobros[0].medio, "sin_dato");
  assert.equal(d.casos[0].cobrado, 60000);
});

test("lo de antes se adopta una sola vez", () => {
  let d = conCobro(estado({ cobrado: 50000 }), cobro({ id: "x", monto: 10000 }), { adoptarLoViejo: true, nuevoId });
  d = conCobro(d, cobro({ id: "y", monto: 5000 }), { adoptarLoViejo: true, nuevoId });
  assert.equal(d.cobros.filter((c) => c.medio === "sin_dato").length, 1);
  assert.equal(d.casos[0].cobrado, 65000);
});

test("el cero de 'se entregó sin cobrar' no se convierte en un cobro", () => {
  const d = conCobro(estado({ cobrado: 0 }), cobro({ id: "x", monto: 10000 }), { adoptarLoViejo: true, nuevoId });
  assert.equal(d.cobros.length, 1);
  assert.equal(d.casos[0].cobrado, 10000);
});

test("anular reemplaza el cobro y resta", () => {
  let d = conCobro(estado({}), cobro({ id: "x", monto: 20000 }), { nuevoId });
  d = conCobro(d, cobro({ id: "y", monto: 5000 }), { nuevoId });
  d = conCobro(d, cobro({ id: "y", monto: 5000, estado: "anulado" }), { nuevoId });
  assert.equal(d.cobros.length, 2);
  assert.equal(d.casos[0].cobrado, 20000);
});
