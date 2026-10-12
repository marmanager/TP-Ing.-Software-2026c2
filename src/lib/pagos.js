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
// Si la API no está configurada, el botón aparece apagado y dice por qué.
// Pedir y anular pagos van por las acciones de datos.js; acá queda lo que
// decide si se ofrece el botón y el pago desde el link del cliente.

import { API } from "./api.js";

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

// Después de vincular, Mercado Pago vuelve siempre a /casos?mp=conectado.
// Antes de irse, la pantalla anota en el navegador de dónde salió —"negocio"
// o el id del caso—, y Casos la manda de vuelta ahí. Sólo esas dos: lo
// anotado no arma una dirección cualquiera. null es quedarse en Casos.
export function vueltaDeMercadoPago(desde) {
  if (desde === "negocio") return "/negocio?mp=conectado#integraciones";
  if (/^[0-9a-f-]{36}$/i.test(desde ?? "")) return `/casos/${desde}?mp=conectado#cobros`;
  return null;
}

// Si se puede pedir un pago en línea, y si no, por qué.
export function pagosEnLinea({ api = API } = {}) {
  if (apiPagosApuntaAlFrontend(api)) return {
    disponible: false,
    motivo: "la dirección de pagos apunta a la app; corregí NEXT_PUBLIC_API_URL en Vercel",
  };
  if (api) return { disponible: true, motivo: null };
  return { disponible: false, motivo: "todavía no está conectado el sistema de pagos" };
}

