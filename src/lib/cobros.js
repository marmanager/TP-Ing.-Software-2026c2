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
import { pesos } from "./estados.js";

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
//   descuento  → lo que el negocio decidió no cobrar (caso.descuento). No es
//                plata que entró, pero tampoco se le debe.
//   deMas      → si se cobró más de lo aprobado (un extra que no pasó por
//                el presupuesto, una propina): no es un error, pero se dice
//
// "situacion" es lo que la pantalla necesita para elegir la frase.
export function cuentaDelCaso({ aprobado = 0, cobros = [], descuento = 0 } = {}) {
  const total = Number(aprobado) || 0;
  const pagado = suma(cobros.filter((c) => c.estado === "pagado"));
  const pendiente = suma(cobros.filter((c) => c.estado === "pendiente"));
  const desc = Math.max(0, Number(descuento) || 0);
  const falta = Math.max(0, total - pagado - pendiente - desc);
  const deMas = Math.max(0, pagado - total);

  let situacion;
  if (pagado === 0 && pendiente === 0 && desc === 0) situacion = "sin_cobrar";
  else if (total > 0 && pagado + desc >= total) {
    situacion = deMas > 0 ? "de_mas" : desc > 0 ? "con_descuento" : "completo";
  } else if (total === 0) situacion = "sin_presupuesto";
  else if (falta === 0) situacion = "esperando_pagos";
  else situacion = "parcial";

  return { total, pagado, pendiente, descuento: desc, falta, deMas, situacion };
}

// Cuánto no se le cobra en este caso. Lo dice caso.descuento; si todavía no
// tiene (un caso cerrado antes de 025, o la migración sin correr), sale de la
// misma regla con la que 025 completa los viejos: en un caso entregado con
// un cobro anotado, lo que se cobró de menos fue el precio final, no una
// deuda. Un caso entregado sin cobro registrado (NULL) no descuenta nada:
// no se sabe si se cobró por afuera.
export function descuentoDelCaso(caso, aprobado = 0) {
  if (!caso) return 0;
  if (caso.descuento != null) return Math.max(0, Number(caso.descuento) || 0);
  if (caso.estado === "completado" && caso.cobrado != null) {
    return Math.max(0, Number(aprobado) - Number(caso.cobrado));
  }
  return 0;
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
  if (!cobro || cobro.deAntes) return false;
  if (cobro.estado === "pendiente") return true;
  if (cobro.estado !== "pagado") return false;
  return medioDe(cobro.medio).enElLocal;
}

// Los cobros de un caso para mostrar, contando lo que se anotó antes de que
// existiera la tabla. En la base, 025 ya lo pasó a la tabla; en el modo de
// ejemplo puede quedar un caso con el número de 012 y ninguna fila. Sin
// esto, la cuenta diría que falta todo, y al entregar se volvería a cobrar
// lo que ya se cobró.
//
// La fila que se agrega es sólo para mirar ("deAntes"): no se anula, porque
// no existe. El primer cobro nuevo la vuelve de verdad (conCobro).
export function cobrosConLoDeAntes(cobrosDeEseCaso = [], caso) {
  if (cobrosDeEseCaso.length > 0 || !caso || !(Number(caso.cobrado) > 0)) return cobrosDeEseCaso;
  const cuando = caso.cobrado_en ?? caso.actualizado_en ?? caso.abierto_en ?? null;
  return [
    {
      id: `de-antes-${caso.id}`,
      caso_id: caso.id,
      monto: Number(caso.cobrado),
      medio: "sin_dato",
      estado: "pagado",
      creado_en: cuando,
      pagado_en: cuando,
      deAntes: true,
    },
  ];
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

// ------------------------------------------------------------
// Pedir un pago por link o QR (la API de pagos, src/lib/pagos.js)
// ------------------------------------------------------------

// Lo que tiene sentido pedir: lo que falta. "falta" ya descuenta lo que se
// está esperando, así que no se pide dos veces lo mismo.
export const montoParaPedir = (cuenta) => (cuenta.falta > 0 ? cuenta.falta : null);

// Los cobros en línea que siguen esperando: mientras haya alguno, la
// pantalla le pregunta a la base cada tanto si ya se pagó.
export const hayPagosEnCamino = (cobros = []) =>
  cobros.some((c) => c.estado === "pendiente" && MEDIOS_EN_LINEA.includes(c.medio));

// El mensaje de WhatsApp con el link. Sin datos del caso que el cliente no
// necesite: quién cobra, cuánto, y dónde pagar.
export function mensajeDePago({ negocio, cliente, monto, link }) {
  const saludo = cliente ? `Hola ${String(cliente).split(" ")[0]}` : "Hola";
  const quien = negocio ? ` Te escribimos de ${negocio}.` : "";
  return `${saludo}.${quien} Podés pagar los ${pesos(monto)} desde acá: ${link}`;
}

// ------------------------------------------------------------
// El saldo de un caso, afuera de su pantalla (Inicio, ficha del cliente,
// seguimiento público)
// ------------------------------------------------------------

// Lo aprobado de un caso: la suma de sus pasos aprobados.
export const aprobadoDelCaso = (pasos = [], casoId) =>
  pasos
    .filter((p) => p.caso_id === casoId && p.estado === "aprobado")
    .reduce((s, p) => s + Number(p.monto), 0);

// Si se sabe cuánto debe. Un caso abierto, sí: lo que falta es lo que
// falta. Uno entregado, sólo si se cerró con este sistema o tiene algo
// anotado: uno cerrado antes de 025 sin ningún cobro registrado puede
// haberse cobrado por afuera (SCRUM-74: vacío = "no se registró"), y
// decirle al negocio —o peor, al cliente— que debe plata sería inventarlo.
// Al cerrar, la pantalla deja caso.descuento escrito (aunque sea 0): esa es
// la marca de "se cerró sabiendo".
export function saldoConocido(caso, cobrosDeEseCaso = []) {
  if (!caso) return false;
  if (caso.estado !== "completado") return true;
  return cobrosDeEseCaso.length > 0 || caso.descuento != null || caso.cobrado != null;
}

// La cuenta de un caso con todo lo que hace falta: lo aprobado, los cobros
// (incluido lo anotado antes de la tabla) y el descuento. null si no se sabe.
export function saldoDelCaso({ caso, pasos = [], cobros = [] }) {
  if (!caso) return null;
  const deEste = cobrosConLoDeAntes(cobrosDelCaso(cobros, caso.id), caso);
  if (!saldoConocido(caso, deEste)) return null;
  const aprobado = aprobadoDelCaso(pasos, caso.id);
  return cuentaDelCaso({ aprobado, cobros: deEste, descuento: descuentoDelCaso(caso, aprobado) });
}

// Los casos entregados que todavía deben plata: el aviso de Inicio. Los
// abiertos no, porque lo que falta cobrar ahí se cobra al entregar.
export function casosConSaldo({ casos = [], pasos = [], cobros = [] }) {
  return casos
    .filter((c) => c.estado === "completado")
    .map((caso) => ({ caso, cuenta: saldoDelCaso({ caso, pasos, cobros }) }))
    .filter(({ cuenta }) => cuenta && cuenta.falta > 0);
}

// Lo que ve el cliente en su link de seguimiento sobre el pago. Es el mismo
// recorte que hace ver_seguimiento() en 026_pago_en_el_seguimiento.sql:
// cuánto pagó, cuánto falta y los links de pago que le mandaron y todavía
// no pagó. Nada de cómo pagó cada cosa ni de descuentos: eso es de adentro.
//
// null cuando no hay nada que decir: antes de que el trabajo esté listo
// (el total todavía puede cambiar) salvo que ya le hayan mandado un link,
// o cuando no se sabe si debe.
export function pagoPublico({ caso, pasos = [], cobros = [] }) {
  if (!caso) return null;
  const deEste = cobrosDelCaso(cobros, caso.id);
  const links = deEste
    .filter((c) => c.estado === "pendiente" && c.medio === "link")
    .map((c) => ({ monto: Number(c.monto), link: c.link ?? null, vence_en: c.vence_en ?? null }));

  const cuenta = saldoDelCaso({ caso, pasos, cobros });
  const listo = caso.estado === "revision_final" || caso.estado === "completado";

  if (links.length === 0 && !(listo && cuenta && cuenta.total > 0)) return null;
  return {
    pagado: cuenta?.pagado ?? 0,
    falta: cuenta?.falta ?? 0,
    pendientes: links,
  };
}
