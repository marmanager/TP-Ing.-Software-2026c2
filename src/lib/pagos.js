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

// La dirección de la API, sin la barra final. Es pública (va al navegador),
// igual que la URL de Supabase.
export const API_PAGOS = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "") || null;

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
export function pagosEnLinea({ esDemo = false, api = API_PAGOS } = {}) {
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

// Lo que contesta la API cuando algo sale mal, en una frase para la
// pantalla. La API ya contesta { ok: false, motivo } con palabras; esto
// cubre lo que no llega a contestar.
function porQueFallo(respuesta, cuerpo) {
  if (cuerpo?.motivo) return cuerpo.motivo;
  if (respuesta?.status === 401) return "Tu sesión venció. Volvé a entrar y probá de nuevo.";
  if (respuesta?.status === 403) return "Los cobros los piden el dueño o el encargado.";
  return "El sistema de pagos no contestó. Probá de nuevo en un rato.";
}

async function llamar(ruta, { token, cuerpo, api = API_PAGOS, fetcher = fetch } = {}) {
  if (!api) return { ok: false, error: "Todavía no está conectado el sistema de pagos." };
  let respuesta;
  try {
    respuesta = await fetcher(`${api}${ruta}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // La sesión de la persona, no una clave del servidor: la API la
        // valida y actúa como ella, así las reglas de 008_permisos siguen
        // valiendo del otro lado.
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(cuerpo ?? {}),
    });
  } catch {
    return { ok: false, error: "No hay conexión con el sistema de pagos. Probá de nuevo." };
  }

  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    // Sin cuerpo: se decide por el código.
  }
  if (!respuesta.ok || !datos?.ok) return { ok: false, error: porQueFallo(respuesta, datos) };
  return { ok: true, cobro: datos.cobro };
}

// Pedir un pago: la API arma el link o el QR con el medio de pago, guarda el
// cobro "pendiente" en la tabla y lo devuelve.
export const pedirPagoEnLinea = ({ casoId, monto, medio, token, ...resto }) =>
  llamar("/cobros", { token, cuerpo: { caso_id: casoId, monto: Number(monto), medio }, ...resto });

// Anular un pago que todavía no se hizo. Pasa por la API y no por la base
// directo, porque además hay que dar de baja el link en el medio de pago: si
// no, el cliente todavía podría pagarlo.
export const anularPagoEnLinea = ({ cobroId, motivo, token, ...resto }) =>
  llamar(`/cobros/${encodeURIComponent(cobroId)}/anular`, { token, cuerpo: { motivo }, ...resto });

// Pagar desde el link de seguimiento, cuando el negocio todavía no le mandó
// un link de pago. Es la única llamada SIN sesión: la hace el cliente, que
// no tiene cuenta. Por eso no manda monto: la API calcula lo que falta con
// la misma cuenta que ver_seguimiento() y arma el link por eso, y nada más.
// El código del seguimiento es lo único que identifica el caso.
export async function pagarDesdeSeguimiento({ codigo, api = API_PAGOS, fetcher = fetch } = {}) {
  if (!api) return { ok: false, error: "Por ahora no se puede pagar desde acá. Podés pagarlo en el local." };
  let respuesta;
  try {
    respuesta = await fetcher(`${api}/seguimiento/${encodeURIComponent(codigo)}/pagos`, {
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
  if (!respuesta.ok || !datos?.ok || !datos?.link) {
    return { ok: false, error: datos?.motivo ?? "No pudimos armar el pago. Probá de nuevo o pagalo en el local." };
  }
  return { ok: true, link: datos.link };
}
