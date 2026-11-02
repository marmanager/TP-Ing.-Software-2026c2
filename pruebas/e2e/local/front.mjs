// El front para los e2e locales: el mismo `next dev`, contra el Supabase del
// stack y la API de api.mjs.

import { spawn } from "node:child_process";
import { ANON, API_URL, FRONT, SERVICIO, SUPABASE_URL } from "./entorno.mjs";

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
  NEXT_PUBLIC_API_URL: API_URL,
  SUPABASE_SERVICE_ROLE_KEY: SERVICIO,
};

// Con webpack, como el build: Turbopack falla al bajar la fuente de Google
// Fonts (872e0a8) y la pantalla queda en error.
const hijo = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--webpack", "--port", "3000"],
  { cwd: FRONT, env, stdio: "inherit" });
hijo.on("exit", (codigo) => process.exit(codigo ?? 0));
