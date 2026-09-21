import { googleConfigurado, sincronizarTodos } from "@/lib/google-calendar-server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return new Response("No autorizado", { status: 401 });
  if (!googleConfigurado) return new Response("Google Calendar no configurado", { status: 503 });
  try { return Response.json({ cuentas: await sincronizarTodos() }); }
  catch (error) { console.error("Google Calendar cron:", error); return new Response("Error de sincronización", { status: 500 }); }
}
