// Los cobros de un caso: cuánto entró, cuánto falta, cómo se pagó.
//
// Sin React y sin Supabase, para que se pueda probar con Jest
// (pruebas/cobros.test.js). La tabla y las reglas de quién puede qué están
// en supabase/025_cobros.sql; esto es lo que la pantalla necesita para
// mostrarlo, y lo que el modo de ejemplo necesita para comportarse igual.
//
// UN CASO, VARIOS COBROS:
// Una seña al dejar el auto y el resto al retirarlo. Un pago en efectivo y
// otro por link que el cliente paga a la noche. Por eso no alcanzaba con el
// número único de 012: ahora ese número (caso.cobrado) es la suma de los
// cobros pagados, y la mantiene la base.
//
// LO QUE NO DECIDE EL NAVEGADOR:
// Un cobro por link o QR pasa a pagado únicamente cuando la API de pagos
// recibe la confirmación del medio de pago. Acá sólo se muestra.

import { montoValido } from "./validaciones.js";

// ------------------------------------------------------------
// Cómo se pagó
// ------------------------------------------------------------
// "enElLocal" son los que el negocio anota a mano porque la plata ya la
// tiene en la mano. Los otros los crea la API de pagos, que todavía no
// existe: la lista crece el día que se definan los medios, sin tocar las
// pantallas.
export const MEDIOS = {
  efectivo: { clave: "efectivo", palabra: "Efectivo", enElLocal: true },
  transferencia: { clave: "transferencia", palabra: "Transferencia", enElLocal: true },
  tarjeta: { clave: "tarjeta", palabra: "Tarjeta en el local", enElLocal: true },
  link: { clave: "link", palabra: "Link de pago", enElLocal: false },
  qr: { clave: "qr", palabra: "QR en el local", enElLocal: false },
  // Los cobros anotados antes de que existiera esta tabla (012): se sabe
  // cuánto y cuándo, no cómo.
  sin_dato: { clave: "sin_dato", palabra: "Sin dato de cómo se pagó", enElLocal: true },
};

export const MEDIOS_DEL_LOCAL = ["efectivo", "transferencia", "tarjeta"];
export const MEDIOS_EN_LINEA = ["link", "qr"];

export const medioDe = (clave) => MEDIOS[clave] ?? MEDIOS.sin_dato;

// ------------------------------------------------------------
// En qué quedó cada cobro
// ------------------------------------------------------------
// Mismo formato que los estados del caso y del turno: palabra, ícono y
// color, porque la cartilla pide las tres cosas juntas. El verde queda para
// la plata que entró; lo que espera algo, en ámbar; lo que no va a entrar,
// en gris.
export const ESTADOS_COBRO = {
  pendiente: {
    clave: "pendiente",
    palabra: "Esperando el pago",
    icono: "reloj",
    texto: "text-espera",
    cuenta: false,
  },
  pagado: {
    clave: "pagado",
    palabra: "Pagado",
    icono: "listo",
    texto: "text-completo",
    cuenta: true,
  },
  rechazado: {
    clave: "rechazado",
    palabra: "El pago no pasó",
    icono: "alerta",
    texto: "text-rojo",
    cuenta: false,
  },
  vencido: {
    clave: "vencido",
    palabra: "Venció sin pagarse",
    icono: "reloj",
    texto: "text-tinta-suave",
    cuenta: false,
  },
  anulado: {
    clave: "anulado",
    palabra: "Anulado",
    icono: "cruz",
    texto: "text-tinta-suave line-through",
    cuenta: false,
  },
  devuelto: {
    clave: "devuelto",
    palabra: "Devuelto",
    icono: "deshacer",
    texto: "text-tinta-suave",
    cuenta: false,
  },
};

export const estadoDeCobro = (estado) => ESTADOS_COBRO[estado] ?? ESTADOS_COBRO.pendiente;

// ------------------------------------------------------------
// Las cuentas
// ------------------------------------------------------------

// Los cobros de un caso, del más viejo al más nuevo: así se leen como lo
// que pasó, en orden.
export const cobrosDelCaso = (cobros = [], casoId) =>
  cobros
    .filter((c) => c.caso_id === casoId)
    .sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en));

const suma = (lista) => lista.reduce((s, c) => s + Number(c.monto), 0);

// Lo que va a caso.cobrado. Es la misma cuenta que hace el trigger de
// 025_cobros.sql, para que el modo de ejemplo quede igual que la base:
// la suma de lo pagado, o null si todavía no se pagó nada.
//
// Sólo se usa para un caso que TIENE cobros en la tabla. Uno que no tiene
// conserva lo que ya tenía, incluido el 0 de "se entregó sin cobrar".
export function cobradoDelCaso(cobrosDeEseCaso = []) {
  const pagados = cobrosDeEseCaso.filter((c) => c.estado === "pagado");
  if (pagados.length === 0) return { cobrado: null, cobrado_en: null };
  const ultimo = pagados
    .map((c) => c.pagado_en)
    .filter(Boolean)
    .sort()
    .at(-1);
  return { cobrado: suma(pagados), cobrado_en: ultimo ?? null };
}

// Cuánto entró, cuánto está en camino y cuánto falta, contra lo que aprobó
// el cliente.
//
//   pagado     → plata que entró
//   pendiente  → links o QR que se mandaron y todavía no se pagaron. No es
//                plata que entró, pero tampoco hay que volver a pedirla.
//   falta      → lo que queda por cobrar, sin contar lo pendiente
//   deMas      → si se cobró más de lo aprobado (un extra que no pasó por
//                el presupuesto, una propina): no es un error, pero se dice
//
// "situacion" es lo que la pantalla necesita para elegir la frase.
export function cuentaDelCaso({ aprobado = 0, cobros = [] } = {}) {
  const total = Number(aprobado) || 0;
  const pagado = suma(cobros.filter((c) => c.estado === "pagado"));
  const pendiente = suma(cobros.filter((c) => c.estado === "pendiente"));
  const falta = Math.max(0, total - pagado - pendiente);
  const deMas = Math.max(0, pagado - total);

  let situacion;
  if (pagado === 0 && pendiente === 0) situacion = "sin_cobrar";
  else if (pagado >= total && total > 0) situacion = deMas > 0 ? "de_mas" : "completo";
  else if (total === 0) situacion = "sin_presupuesto";
  else if (falta === 0) situacion = "esperando_pagos";
  else situacion = "parcial";

  return { total, pagado, pendiente, falta, deMas, situacion };
}

// Lo que se ofrece para cobrar al abrir el formulario: lo que falta. Si ya
// está todo cobrado o pedido, nada (el campo arranca vacío).
export const montoSugerido = (cuenta) => (cuenta.falta > 0 ? cuenta.falta : null);

// El monto de UN cobro: números, sin puntos, mayor que cero. A diferencia
// del campo de SCRUM-74 (cobroValido), acá el cero no tiene sentido: un
// cobro de cero no es un cobro. "Se entregó sin cobrar" se anota al cerrar.
export const montoDeCobroValido = (valor = "") => montoValido(valor);

// Si un cobro se puede anular desde la pantalla. Misma regla que
// anular_cobro() en la base: lo pendiente y lo pagado en el local sí; un
// pago por link o QR que ya entró no, porque se devuelve desde el medio de
// pago.
export function sePuedeAnular(cobro) {
  if (!cobro) return false;
  if (cobro.estado === "pendiente") return true;
  if (cobro.estado !== "pagado") return false;
  return medioDe(cobro.medio).enElLocal;
}

// Los casos con cobros esperando: para el aviso de Inicio.
export const cobrosPendientes = (cobros = []) => cobros.filter((c) => c.estado === "pendiente");

// ------------------------------------------------------------
// El estado de la aplicación
// ------------------------------------------------------------

// Pone un cobro nuevo (o su nueva versión) en el estado y recalcula
// caso.cobrado con la misma cuenta que el trigger de 025_cobros.sql.
//
// "adoptarLoViejo" es el modo de ejemplo haciendo lo que la migración hizo
// en la base: un caso que tenía un cobro anotado con 012, y ninguno en la
// lista, primero pasa ese número a la lista (medio "sin dato"). Si no, el
// primer cobro nuevo pisaría lo que ya estaba en vez de sumarse.
export function conCobro(d, cobro, { adoptarLoViejo = false, nuevoId } = {}) {
  let cobros = d.cobros ?? [];
  const caso = d.casos.find((c) => c.id === cobro.caso_id);

  if (adoptarLoViejo && caso && Number(caso.cobrado) > 0 && !cobros.some((c) => c.caso_id === caso.id)) {
    const cuando = caso.cobrado_en ?? caso.actualizado_en ?? caso.abierto_en ?? new Date().toISOString();
    cobros = [
      ...cobros,
      {
        id: nuevoId(),
        negocio_id: caso.negocio_id,
        caso_id: caso.id,
        monto: Number(caso.cobrado),
        medio: "sin_dato",
        estado: "pagado",
        nota: null,
        creado_en: cuando,
        pagado_en: cuando,
      },
    ];
  }

  cobros = cobros.some((c) => c.id === cobro.id)
    ? cobros.map((c) => (c.id === cobro.id ? cobro : c))
    : [...cobros, cobro];

  const { cobrado, cobrado_en } = cobradoDelCaso(cobrosDelCaso(cobros, cobro.caso_id));
  return {
    ...d,
    cobros,
    casos: d.casos.map((c) => (c.id === cobro.caso_id ? { ...c, cobrado, cobrado_en } : c)),
  };
}
