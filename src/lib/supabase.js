import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Mientras no haya credenciales, la aplicación funciona igual: se entra sin
// cuenta y todo se guarda en el navegador. Ver .env.example.
export const haySupabase = Boolean(url && clave);

export const supabase = haySupabase ? createClient(url, clave) : null;

// Qué formas de entrar tiene activadas el proyecto (mail, Google, ...). Es
// una consulta pública de Supabase Auth, con la misma clave anónima. Sirve
// para no mostrar "Entrar con Google" mientras nadie lo activó en el panel:
// tocarlo llevaría a una página de error de Supabase.
export async function formasDeEntrar() {
  if (!haySupabase) return null;
  try {
    const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: clave } });
    if (!r.ok) return null;
    return (await r.json())?.external ?? null;
  } catch {
    return null;
  }
}
