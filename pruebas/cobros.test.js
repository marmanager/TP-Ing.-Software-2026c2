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
  casosConSaldo,
  cobrosConLoDeAntes,
  pagoPublico,
  saldoDelCaso,
  cobrosDelCaso,
  cobrosPendientes,
  conCobro,
  cuentaDelCaso,
  descuentoDelCaso,
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

// ------------------------------------------------------------
// Lo anotado antes de la tabla (012)
// ------------------------------------------------------------

test("un caso con un cobro de antes lo muestra como pagado, sin dato del medio", () => {
  const [c] = cobrosConLoDeAntes([], { id: "c1", cobrado: "50000", cobrado_en: "2026-09-01T10:00:00.000Z" });
  assert.equal(c.monto, 50000);
  assert.equal(c.medio, "sin_dato");
  assert.equal(cuentaDelCaso({ aprobado: 80000, cobros: [c] }).falta, 30000);
});

test("lo de antes se mira pero no se anula: no existe en la tabla", () => {
  const [c] = cobrosConLoDeAntes([], { id: "c1", cobrado: 50000 });
  assert.equal(sePuedeAnular(c), false);
});

test("si ya hay cobros en la tabla, o no se cobró nada, no se agrega nada", () => {
  const reales = [cobro()];
  assert.equal(cobrosConLoDeAntes(reales, { id: "c1", cobrado: 50000 }), reales);
  assert.deepEqual(cobrosConLoDeAntes([], { id: "c1", cobrado: 0 }), []);
  assert.deepEqual(cobrosConLoDeAntes([], { id: "c1", cobrado: null }), []);
});

// ------------------------------------------------------------
// Lo que no se le cobra
// ------------------------------------------------------------

test("con un descuento, lo que no se cobra no queda como deuda", () => {
  const c = cuentaDelCaso({ aprobado: 80000, cobros: [cobro({ monto: 70000 })], descuento: 10000 });
  assert.equal(c.falta, 0);
  assert.equal(c.situacion, "con_descuento");
});

test("una garantía: no se cobró nada y no se debe nada", () => {
  const c = cuentaDelCaso({ aprobado: 80000, cobros: [], descuento: 80000 });
  assert.equal(c.falta, 0);
  assert.equal(c.situacion, "con_descuento");
});

test("un descuento de una parte deja el resto por cobrar", () => {
  const c = cuentaDelCaso({ aprobado: 80000, cobros: [cobro({ monto: 20000 })], descuento: 10000 });
  assert.equal(c.falta, 50000);
  assert.equal(c.situacion, "parcial");
});

test("un caso cerrado con el sistema anterior cobrando de menos: la diferencia fue un descuento", () => {
  const viejo = { estado: "completado", cobrado: "50000", descuento: null };
  assert.equal(descuentoDelCaso(viejo, 70000), 20000);
  assert.equal(descuentoDelCaso({ ...viejo, cobrado: 0 }, 70000), 70000, "el 0 de 'se entregó sin cobrar'");
});

test("si no se registró cobro, no se inventa un descuento", () => {
  assert.equal(descuentoDelCaso({ estado: "completado", cobrado: null }, 70000), 0);
  assert.equal(descuentoDelCaso({ estado: "en_proceso", cobrado: 20000 }, 70000), 0, "un caso abierto con seña debe el resto");
});

test("lo que dice la columna manda, incluido un descuento sacado (0)", () => {
  assert.equal(descuentoDelCaso({ estado: "completado", cobrado: 50000, descuento: 0 }, 70000), 0);
  assert.equal(descuentoDelCaso({ estado: "en_proceso", descuento: "5000" }, 70000), 5000);
});

// ------------------------------------------------------------
// El saldo afuera del caso: Inicio, la ficha del cliente, el seguimiento
// ------------------------------------------------------------

const pasosDe = (casoId, ...montos) =>
  montos.map((monto, i) => ({ caso_id: casoId, monto, estado: "aprobado", orden: i }));

test("un caso entregado con seña y el resto para después, debe", () => {
  const caso = { id: "c1", estado: "completado", cobrado: 20000, descuento: 0 };
  const cuenta = saldoDelCaso({ caso, pasos: pasosDe("c1", 80000), cobros: [cobro({ monto: 20000 })] });
  assert.equal(cuenta.falta, 60000);
});

test("uno viejo, entregado sin ningún cobro anotado, no se sabe: no se inventa una deuda", () => {
  const caso = { id: "c1", estado: "completado", cobrado: null, descuento: null };
  assert.equal(saldoDelCaso({ caso, pasos: pasosDe("c1", 80000), cobros: [] }), null);
});

test("uno cerrado con el sistema nuevo sin cobrar nada, sí debe (la marca es el descuento en 0)", () => {
  const caso = { id: "c1", estado: "completado", cobrado: null, descuento: 0 };
  assert.equal(saldoDelCaso({ caso, pasos: pasosDe("c1", 80000), cobros: [] }).falta, 80000);
});

test("Inicio: sólo los entregados que deben", () => {
  const casos = [
    { id: "debe", estado: "completado", descuento: 0 },
    { id: "saldado", estado: "completado", cobrado: 50000, descuento: 0 },
    { id: "viejo", estado: "completado", cobrado: null, descuento: null },
    { id: "abierto", estado: "en_proceso" },
  ];
  const pasos = [...pasosDe("debe", 30000), ...pasosDe("saldado", 50000), ...pasosDe("viejo", 10000), ...pasosDe("abierto", 9000)];
  const cobros = [cobro({ caso_id: "saldado", monto: 50000 })];
  const lista = casosConSaldo({ casos, pasos, cobros });
  assert.deepEqual(lista.map((x) => x.caso.id), ["debe"]);
  assert.equal(lista[0].cuenta.falta, 30000);
});

test("el cliente ve cuánto pagó, cuánto falta y sus links, y nada más", () => {
  const caso = { id: "c1", estado: "completado", descuento: 5000 };
  const cobros = [
    cobro({ monto: 20000, nota: "Seña" }),
    cobro({ monto: 30000, medio: "link", estado: "pendiente", link: "https://pago/x", vence_en: "2026-09-24T00:00:00.000Z" }),
    cobro({ monto: 99999, medio: "qr", estado: "pendiente" }),
    cobro({ monto: 99999, estado: "anulado", motivo_anulacion: "interno" }),
  ];
  const p = pagoPublico({ caso, pasos: pasosDe("c1", 80000), cobros });
  assert.deepEqual(p, {
    pagado: 20000,
    falta: 0,
    pendientes: [{ monto: 30000, link: "https://pago/x", vence_en: "2026-09-24T00:00:00.000Z" }],
  });
  const texto = JSON.stringify(p);
  for (const interno of ["Seña", "efectivo", "interno", "5000", "descuento", "qr"]) {
    assert.ok(!texto.includes(interno), `no viaja: ${interno}`);
  }
});

test("antes de que esté listo no se habla de plata, salvo que le hayan mandado un link", () => {
  const caso = { id: "c1", estado: "en_proceso" };
  assert.equal(pagoPublico({ caso, pasos: pasosDe("c1", 80000), cobros: [] }), null);
  const conLink = pagoPublico({
    caso,
    pasos: pasosDe("c1", 80000),
    cobros: [cobro({ monto: 20000, medio: "link", estado: "pendiente", link: "l" })],
  });
  assert.equal(conLink.pendientes.length, 1);
});

test("listo para retirar: cuánto falta", () => {
  const caso = { id: "c1", estado: "revision_final" };
  assert.deepEqual(pagoPublico({ caso, pasos: pasosDe("c1", 80000), cobros: [cobro({ monto: 20000 })] }), {
    pagado: 20000,
    falta: 60000,
    pendientes: [],
  });
});

test("sin presupuesto aprobado, o sin saber si debe, no se dice nada", () => {
  assert.equal(pagoPublico({ caso: { id: "c1", estado: "completado", descuento: 0 }, pasos: [], cobros: [] }), null);
  assert.equal(
    pagoPublico({ caso: { id: "c1", estado: "completado", cobrado: null, descuento: null }, pasos: pasosDe("c1", 5), cobros: [] }),
    null
  );
});
