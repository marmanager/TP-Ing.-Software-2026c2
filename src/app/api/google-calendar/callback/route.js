import {
  guardarConexion, googleConfigurado, leerEstadoOAuth,
  sigueEnNegocio, sincronizarUsuario, tokenGoogle,
} from "@/lib/google-calendar-server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request) {
  const origin = new URL(process.env.GOOGLE_REDIRECT_URI || request.url).origin;
  const params = new URL(request.url).searchParams;
  const nonce = /(?:^|;\s*)google_oauth_state=([^;]+)/.exec(request.headers.get("cookie") || "")?.[1];
  const response = (result, volver = "calendario") => {
    const destination = new URL(volver === "negocio" ? "/negocio" : "/agenda/calendario", origin);
    destination.searchParams.set("google", result);
    if (volver === "negocio") destination.hash = "integraciones";
    return new Response(null, {
      status: 303,
      headers: {
        Location: destination.toString(),
        "Set-Cookie": "google_oauth_state=; HttpOnly; SameSite=Lax; Path=/api/google-calendar/callback; Max-Age=0",
      },
    });
  };
  if (!googleConfigurado || !nonce || !params.get("state")) return response("error");
  const state = leerEstadoOAuth(params.get("state"), nonce);
  if (!state || !params.get("code")) return response("error", state?.volver);
  try {
    if (!(await sigueEnNegocio(state.usuario_id, state.negocio_id))) return response("error", state.volver);
  } catch (error) {
    console.error("Google Calendar verificación de negocio:", error);
    return response("error", state.volver);
  }
  try {
    const token = await tokenGoogle({
      code: params.get("code"), redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    });
    if (!token.refresh_token) throw new Error("Google no devolvió un refresh token.");
    await guardarConexion({ id: state.usuario_id, negocio_id: state.negocio_id }, token.refresh_token);
    try { await sincronizarUsuario(state.usuario_id); }
    catch (error) { console.error("Google Calendar sincronización inicial:", error); }
    return response("conectado", state.volver);
  } catch (error) {
    console.error("Google Calendar OAuth:", error);
    return response("error", state.volver);
  }
}
