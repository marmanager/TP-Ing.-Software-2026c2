import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Mientras no haya credenciales, la aplicación funciona igual: se entra sin
// cuenta y todo se guarda en el navegador. Ver .env.example.
export const haySupabase = Boolean(url && clave);

export const supabase = haySupabase ? createClient(url, clave) : null;
