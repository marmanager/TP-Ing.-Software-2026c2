// Entrar con Google: lo que no depende de React ni de Supabase, para poder
// probarlo con Jest (pruebas/ingreso-google.test.js).
//
// El ingreso con Google lo hace Supabase Auth (signInWithOAuth, en auth.js).
// NO es el mismo OAuth que el de Google Calendar (src/lib/google-calendar-
// server.js): aquel pide permiso para escribir en el calendario y guarda un
// token en el servidor; este sólo pide quién sos (mail y nombre) y termina en
// una sesión de Supabase, igual que entrar con mail y contraseña. Pueden usar
// el mismo cliente de Google Cloud, pero son dos permisos distintos y se
// piden por separado: entrar con Google no conecta el calendario.

// El nombre de la persona. Con mail y contraseña lo escribe en el formulario
// y viaja como "nombre"; Google lo manda como "full_name" o "name".
export function nombreDeLaCuenta(metadatos = {}) {
  const nombre = metadatos?.nombre ?? metadatos?.full_name ?? metadatos?.name ?? null;
  const limpio = typeof nombre === "string" ? nombre.trim() : "";
  return limpio || null;
}
// El retorno de Supabase tiene que abrir una URL pública. Las vistas previas
// de Vercel pueden pedir iniciar sesión en Vercel antes de entregar el token.
// Cuando Google o Supabase no dejan entrar, vuelven a la pantalla con el
// error en la dirección (?error=... o #error=...). Esto lo traduce a una
// frase para la persona, o null si no hubo error.
export function errorDelIngreso(direccion) {
  let url;
  try {
    url = new URL(direccion);
  } catch {
    return null;
  }
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const codigo = url.searchParams.get("error") ?? hash.get("error");
  const detalle = url.searchParams.get("error_description") ?? hash.get("error_description") ?? "";
  if (!codigo) return null;

  if (codigo === "access_denied") {
    return "No se completó el ingreso con Google. Si fue sin querer, probá de nuevo.";
  }
  if (/provider is not enabled|unsupported provider/i.test(detalle)) {
    return "El ingreso con Google todavía no está activado. Por ahora entrá con tu mail y tu contraseña.";
  }
  return "No pudimos entrar con Google. Probá de nuevo o entrá con tu mail y tu contraseña.";
}
