import { randomBytes } from "node:crypto";
import {
  conexionDe, desconectar, estadoOAuth, googleConfigurado,
  sincronizarUsuario, urlAutorizacion, usuarioAutenticado,
} from "@/lib/google-calendar-server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request) {
  if (!googleConfigurado) return Response.json({ disponible: false, conectado: false });
  const usuario = await usuarioAutenticado(request);
  if (!usuario) return Response.json({ error: "Iniciá sesión." }, { status: 401 });
  try {
    const conexion = await conexionDe(usuario.id);
    const vigente = conexion?.negocio_id === usuario.negocio_id;
    return Response.json({ disponible: true, conectado: vigente, error: vigente ? conexion.error : null });
  } catch {
    return Response.json({ error: "No se pudo consultar la conexión." }, { status: 500 });
  }
}

export async function POST(request) {
  if (!googleConfigurado) return Response.json({ error: "Google Calendar todavía no está configurado." }, { status: 503 });
  const usuario = await usuarioAutenticado(request);
  if (!usuario) return Response.json({ error: "Iniciá sesión." }, { status: 401 });
  let action;
  try { action = (await request.json()).action; } catch { return Response.json({ error: "Pedido inválido." }, { status: 400 }); }
  try {
    if (action === "connect") {
      const nonce = randomBytes(24).toString("hex");
      const state = estadoOAuth(usuario, nonce);
      const response = Response.json({ url: urlAutorizacion(state) });
      response.headers.set("Set-Cookie", `google_oauth_state=${nonce}; HttpOnly; SameSite=Lax; Path=/api/google-calendar/callback; Max-Age=600${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
      return response;
    }
    if (action === "sync") return Response.json({ cambios: await sincronizarUsuario(usuario.id) });
    return Response.json({ error: "Acción inválida." }, { status: 400 });
  } catch (error) {
    console.error("Google Calendar:", error);
    return Response.json({ error: "No se pudo completar la operación con Google Calendar." }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!googleConfigurado) return Response.json({ error: "Google Calendar todavía no está configurado." }, { status: 503 });
  const usuario = await usuarioAutenticado(request);
  if (!usuario) return Response.json({ error: "Iniciá sesión." }, { status: 401 });
  try { await desconectar(usuario.id); return Response.json({ ok: true }); }
  catch { return Response.json({ error: "No se pudo desconectar." }, { status: 500 }); }
}
