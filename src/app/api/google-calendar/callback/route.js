import {
  guardarConexion, googleConfigurado, leerEstadoOAuth,
  sigueEnNegocio, sincronizarUsuario, tokenGoogle,
} from "@/lib/google-calendar-server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request) {
  const origin = new URL(process.env.GOOGLE_REDIRECT_URI || request.url).origin;
  const destination = new URL("/agenda/calendario", origin);
  const params = new URL(request.url).searchParams;
  const nonce = /(?:^|;\s*)google_oauth_state=([^;]+)/.exec(request.headers.get("cookie") || "")?.[1];
  const response = (result) => {
    destination.searchParams.set("google", result);
    return new Response(null, {
      status: 303,
      headers: {
        Location: destination.toString(),
        "Set-Cookie": "google_oauth_state=; HttpOnly; SameSite=Lax; Path=/api/google-calendar/callback; Max-Age=0",
      },
    });
  };
  if (!googleConfigurado || !nonce || !params.get("state") || !params.get("code")) return response("error");
  const state = leerEstadoOAuth(params.get("state"), nonce);
  if (!state || !(await sigueEnNegocio(state.usuario_id, state.negocio_id))) return response("error");
  try {
    const token = await tokenGoogle({
      code: params.get("code"), redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    });
    if (!token.refresh_token) throw new Error("Google no devolvió un refresh token.");
    await guardarConexion({ id: state.usuario_id, negocio_id: state.negocio_id }, token.refresh_token);
    try { await sincronizarUsuario(state.usuario_id); }
    catch (error) { console.error("Google Calendar sincronización inicial:", error); }
    return response("conectado");
  } catch (error) {
    console.error("Google Calendar OAuth:", error);
    return response("error");
  }
}
