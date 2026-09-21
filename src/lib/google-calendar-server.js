import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { eventoGoogle, idEventoGoogle } from "./google-calendar";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_REDIRECT_URI;
const key = process.env.GOOGLE_TOKEN_KEY ? Buffer.from(process.env.GOOGLE_TOKEN_KEY, "hex") : null;

export const googleConfigurado = Boolean(
  url && serviceKey && clientId && clientSecret && redirectUri && key?.length === 32
);

const db = googleConfigurado
  ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null;

export async function usuarioAutenticado(request) {
  if (!db) return null;
  const bearer = /^Bearer (.+)$/i.exec(request.headers.get("authorization") || "")?.[1];
  if (!bearer) return null;
  const { data: auth, error } = await db.auth.getUser(bearer);
  if (error || !auth.user) return null;
  const { data, error: userError } = await db.from("usuario")
    .select("id,negocio_id").eq("id", auth.user.id).maybeSingle();
  if (userError || !data?.negocio_id) return null;
  return data;
}

export function estadoOAuth(usuario, nonce) {
  const payload = Buffer.from(JSON.stringify({
    usuario_id: usuario.id, negocio_id: usuario.negocio_id,
    nonce, vence: Date.now() + 10 * 60_000,
  })).toString("base64url");
  const firma = createHmac("sha256", key).update(payload).digest("base64url");
  return `${payload}.${firma}`;
}

export function leerEstadoOAuth(state, nonce) {
  try {
    const [payload, firma] = String(state).split(".");
    const esperado = createHmac("sha256", key).update(payload).digest();
    const recibido = Buffer.from(firma, "base64url");
    if (recibido.length !== esperado.length || !timingSafeEqual(recibido, esperado)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.nonce === nonce && data.vence > Date.now() ? data : null;
  } catch { return null; }
}

export function urlAutorizacion(state) {
  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  for (const [name, value] of Object.entries({
    client_id: clientId, redirect_uri: redirectUri, response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events.owned",
    access_type: "offline", prompt: "consent", state,
  })) auth.searchParams.set(name, value);
  return auth.toString();
}

export async function tokenGoogle(params) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }),
  });
  const token = await response.json();
  if (!response.ok) throw new Error(`Google OAuth: ${token.error || response.status}`);
  return token;
}

function cifrar(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

function descifrar(value) {
  const bytes = Buffer.from(value, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
}

export async function guardarConexion(usuario, refreshToken) {
  const { error } = await db.from("google_calendar_conexion").upsert({
    usuario_id: usuario.id, negocio_id: usuario.negocio_id,
    refresh_token: cifrar(refreshToken), conectado_en: new Date().toISOString(), error: null,
  });
  if (error) throw error;
  // Una reconexión puede apuntar a otra cuenta de Google: hay que copiar todo allí.
  const { error: limpiarError } = await db.from("google_calendar_evento").delete().eq("usuario_id", usuario.id);
  if (limpiarError) throw limpiarError;
}

export async function conexionDe(usuarioId) {
  const { data, error } = await db.from("google_calendar_conexion")
    .select("usuario_id,negocio_id,refresh_token,conectado_en,error")
    .eq("usuario_id", usuarioId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function desconectar(usuarioId) {
  const { error } = await db.from("google_calendar_conexion").delete().eq("usuario_id", usuarioId);
  if (error) throw error;
}

async function todas(tabla, columnas, columna, valor, orden = "id") {
  const filas = [];
  for (let offset = 0; ; offset += 1000) {
    let query = db.from(tabla).select(columnas);
    if (valor !== null) query = query.eq(columna, valor);
    const { data, error } = await query.order(orden).range(offset, offset + 999);
    if (error) throw error;
    filas.push(...data);
    if (data.length < 1000) return filas;
  }
}

async function googleEvento(method, path, token, body) {
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if ([404, 409, 410].includes(response.status)) return response.status;
  if (!response.ok) throw new Error(`Google Calendar HTTP ${response.status}: ${(await response.text()).slice(0, 180)}`);
  return response.status;
}

export async function sincronizarUsuario(usuarioId) {
  const conexion = await conexionDe(usuarioId);
  if (!conexion) return 0;
  if (!(await sigueEnNegocio(usuarioId, conexion.negocio_id))) {
    await desconectar(usuarioId);
    return 0;
  }
  try {
    const { access_token } = await tokenGoogle({
      refresh_token: descifrar(conexion.refresh_token), grant_type: "refresh_token",
    });
    const [turnos, clientes, estados] = await Promise.all([
      todas("turno", "id,cliente_id,empieza_en,minutos_reservados,motivo,estado", "negocio_id", conexion.negocio_id),
      todas("cliente", "id,nombre,telefono", "negocio_id", conexion.negocio_id),
      todas("google_calendar_evento", "turno_id,huella", "usuario_id", usuarioId, "turno_id"),
    ]);
    const { data: negocio, error: negocioError } = await db.from("negocio")
      .select("horarios").eq("id", conexion.negocio_id).single();
    if (negocioError) throw negocioError;
    const clientesPorId = new Map(clientes.map(c => [c.id, c]));
    const huellas = new Map(estados.map(e => [e.turno_id, e.huella]));
    const minutos = Number(negocio.horarios?.minutos) || 30;
    let cambios = 0;
    for (const turno of turnos) {
      const path = `/${idEventoGoogle(turno.id)}`;
      if (turno.estado === "cancelado") {
        if (huellas.get(turno.id) !== "cancelado") {
          await googleEvento("DELETE", path, access_token);
          const { error } = await db.from("google_calendar_evento").upsert({
            usuario_id: usuarioId, turno_id: turno.id, huella: "cancelado",
          });
          if (error) throw error;
          cambios++;
        }
        continue;
      }
      const evento = eventoGoogle(turno, clientesPorId.get(turno.cliente_id), minutos);
      const huella = createHash("sha256").update(JSON.stringify(evento)).digest("hex");
      if (huellas.get(turno.id) === huella) continue;
      if (huellas.has(turno.id) && huellas.get(turno.id) !== "cancelado") {
        const status = await googleEvento("PATCH", path, access_token, evento);
        if (status === 404 || status === 410) await googleEvento("POST", "", access_token, evento);
      } else {
        const status = await googleEvento("POST", "", access_token, evento);
        if (status === 409) await googleEvento("PATCH", path, access_token, evento);
      }
      const { error } = await db.from("google_calendar_evento").upsert({
        usuario_id: usuarioId, turno_id: turno.id, huella,
      });
      if (error) throw error;
      cambios++;
    }
    await db.from("google_calendar_conexion").update({ error: null }).eq("usuario_id", usuarioId);
    return cambios;
  } catch (error) {
    await db.from("google_calendar_conexion").update({ error: error.message }).eq("usuario_id", usuarioId);
    throw error;
  }
}

export async function sincronizarTodos() {
  // ponytail: una cuenta por vez alcanza al tamaño actual; dividir en lotes si el cron llega a su límite de duración.
  const conexiones = await todas("google_calendar_conexion", "usuario_id", "usuario_id", null);
  let completadas = 0;
  for (const conexion of conexiones) {
    try { await sincronizarUsuario(conexion.usuario_id); completadas++; }
    catch (error) { console.error("Google Calendar:", error); }
  }
  return completadas;
}

export async function sigueEnNegocio(usuarioId, negocioId) {
  const { data } = await db.from("usuario").select("negocio_id").eq("id", usuarioId).maybeSingle();
  return data?.negocio_id === negocioId;
}
