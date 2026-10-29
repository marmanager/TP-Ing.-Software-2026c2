// Lo que contestó el cliente por WhatsApp, cargado directo en la base de
// pruebas para la e2e de R-10b.
//
// En la vida real esto lo escribe el webhook de Kapso (R-10a), y sólo
// asocia una respuesta a un aviso que salió de verdad. En las pruebas no
// sale ningún WhatsApp (Kapso apunta a ningún lado), así que no hay avisos
// enviados que contestar: se cargan acá, con la clave de servicio, el aviso
// y lo que contestó, como los dejaría el webhook.
//
// Sólo contra el stack local de Docker (npx supabase start): la clave de
// servicio de ese stack es fija y pública, y no abre nada fuera de tu
// máquina. Corre del lado de WebdriverIO (Node), nunca en la página.
//
//   E2E_SUPABASE_URL       por defecto http://127.0.0.1:54321
//   E2E_SUPABASE_SERVICIO  la service_role key del stack (npx supabase status)

const URL = (process.env.E2E_SUPABASE_URL || "http://127.0.0.1:54321").replace(/\/+$/, "");
const SERVICIO = process.env.E2E_SUPABASE_SERVICIO || "";

async function pedir(metodo, tabla, cuerpo, filtro = "") {
  if (!SERVICIO) {
    throw new Error("Falta E2E_SUPABASE_SERVICIO: la service_role key del stack local (npx supabase status).");
  }
  const r = await fetch(`${URL}/rest/v1/${tabla}${filtro}`, {
    method: metodo,
    headers: {
      apikey: SERVICIO,
      Authorization: `Bearer ${SERVICIO}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(cuerpo),
  });
  const datos = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`No se pudo cargar ${tabla}: ${JSON.stringify(datos)}`);
  return datos;
}

const insertar = async (tabla, fila) => (await pedir("POST", tabla, fila))[0];

export const cambiar = (tabla, id, cambios) => pedir("PATCH", tabla, cambios, `?id=eq.${id}`);

export const turno = (fila) => insertar("turno", { estado: "agendado", origen: "mostrador", ...fila });

// Un aviso que ya salió, con el id que le dio WhatsApp.
export const avisoEnviado = ({ negocio_id, tipo, telefono, procesado_en, mensaje_id, caso_id = null, turno_id = null, turno_empieza_en = null }) =>
  insertar("seguimiento_whatsapp", {
    negocio_id, tipo, telefono, caso_id, turno_id, turno_empieza_en, mensaje_id,
    numero_emisor_id: "e2e", estado: "enviado", mensaje: "Un aviso de prueba.",
    // Los de un caso guardan desde cuándo cuenta su plazo (cerrado_en).
    enviar_en: procesado_en, procesado_en, cerrado_en: caso_id ? procesado_en : null,
  });

// Lo que contestó, asociado a ese aviso. "citada" si citó el mensaje.
export const respuesta = ({ aviso, cliente_id, texto, enviado_en, citada = false, creado_en = enviado_en }) =>
  insertar("seguimiento_whatsapp_respuesta", {
    negocio_id: aviso.negocio_id, seguimiento_id: aviso.id, caso_id: aviso.caso_id, cliente_id,
    telefono: aviso.telefono, numero_emisor_id: "e2e", mensaje_id: `wamid.${Math.random().toString(36).slice(2)}`,
    contexto_mensaje_id: citada ? aviso.mensaje_id : null,
    tipo: "text", texto, contenido: { origen: "e2e" }, enviado_en, creado_en,
  });
