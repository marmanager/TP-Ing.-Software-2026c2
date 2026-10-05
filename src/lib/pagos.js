// La puerta hacia la API de pagos: cobrar por link o por QR.
//
// ES EL ÚNICO ARCHIVO QUE HABLA CON ESA API. Las pantallas no saben qué
// medio de pago hay detrás (Mercado Pago, otro, varios): piden un cobro y
// muestran en qué quedó. El día que la API exista, o cambie de proveedor, se
// toca acá y nada más. El contrato completo está en docs/api-pagos.md.
//
// LO QUE NO HACE EL NAVEGADOR, A PROPÓSITO:
//   · No tiene ninguna clave del medio de pago. Viven en el servidor de la
//     API, como la service_role de Supabase: nunca en el repo, nunca acá.
//   · No marca nada como pagado. Eso lo hace la API cuando el medio de pago
//     le avisa (webhook). Si el navegador pudiera, cualquiera podría marcar
//     como pagado algo que no pagó.
//   · No decide el monto final: la API lo vuelve a validar contra el caso.
//
// Si la API no está configurada:
//   · En el modo de ejemplo se SIMULA: el cobro queda "esperando el pago" y
//     la pantalla ofrece simular que se pagó o que venció. Sirve para armar
//     y probar las pantallas; no es un pago.
//   · Con Supabase y sin API, el botón aparece apagado y dice por qué.

import { API, mandar } from "./api.js";

export function apiPagosApuntaAlFrontend(api) {
  if (!api) return false;
  try {
    const host = new URL(api).hostname;
    return host === "tp-ing-software-2026c2.vercel.app" ||
      host.startsWith("tp-ing-software-2026c2-") && host.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

// Si se puede pedir un pago en línea, y si es de verdad o simulado.
export function pagosEnLinea({ esDemo = false, api = API } = {}) {
  if (esDemo) return { disponible: true, simulado: true, motivo: null };
  if (apiPagosApuntaAlFrontend(api)) return {
    disponible: false,
    simulado: false,
    motivo: "la dirección de pagos apunta a la app; corregí NEXT_PUBLIC_API_URL en Vercel",
  };
  if (api) return { disponible: true, simulado: false, motivo: null };
  return {
    disponible: false,
    simulado: false,
    motivo: "todavía no está conectado el sistema de pagos",
  };
}

// Pedir un pago: la API arma el link o el QR con el medio de pago, guarda el
// cobro "pendiente" en la tabla y lo devuelve. También anota el renglón del
// historial y lo devuelve en "evento" (null si el cobro ya existía).
export async function pedirPagoEnLinea({ casoId, monto, medio, token, api = API, fetcher = fetch }) {
  const r = await mandar(`/casos/${encodeURIComponent(casoId)}/cobros/en-linea`,
    { monto: Number(monto), medio }, token, { base: api, fetcher });
  return r.ok
    ? { ok: true, cobro: r.datos.cobro, evento: r.datos.evento ?? null }
    : { ok: false, error: r.error.mensaje };
}

// Anular un pago que todavía no se hizo. Pasa por la API y no por la base
// directo, porque además hay que dar de baja el link en el medio de pago: si
// no, el cliente todavía podría pagarlo.
export async function anularPagoEnLinea({ cobroId, motivo, token, api = API, fetcher = fetch }) {
  const r = await mandar(`/cobros/${encodeURIComponent(cobroId)}/anular`, { motivo }, token, { base: api, fetcher });
  return r.ok ? { ok: true, cobro: r.datos.cobro } : { ok: false, error: r.error.mensaje };
}

// Pagar desde el link de seguimiento, cuando el negocio todavía no le mandó
// un link de pago. Es la única llamada SIN sesión: la hace el cliente, que
// no tiene cuenta. Por eso no manda monto: la API calcula lo que falta con
// la misma cuenta que ver_seguimiento() y arma el link por eso, y nada más.
// El código del seguimiento es lo único que identifica el caso.
export async function pagarDesdeSeguimiento({ codigo, api = API, fetcher = fetch } = {}) {
  const base = api;
  if (!base) return { ok: false, error: "Por ahora no se puede pagar desde acá. Podés pagarlo en el local." };
  let respuesta;
  try {
    respuesta = await fetcher(`${base}/publico/seguimiento/${encodeURIComponent(codigo)}/pagos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  } catch {
    return { ok: false, error: "No pudimos conectarnos para el pago. Probá de nuevo en un rato." };
  }
  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    // Sin cuerpo: se decide por el código.
  }
  const link = datos?.datos?.cobro?.link;
  if (!respuesta.ok || !datos?.ok || !link) {
    return { ok: false, error: datos?.error?.mensaje ?? datos?.motivo ?? "No pudimos armar el pago. Probá de nuevo o pagalo en el local." };
  }
  return { ok: true, link };
}
