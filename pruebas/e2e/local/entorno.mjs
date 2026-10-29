// Los e2e 100% locales (npm run test:e2e:local): el Supabase del stack de
// Docker (npx supabase start en este repo), una API propia en el puerto 4100
// y el front en el 3000. No tocan ninguna base en la nube.
//
// Ni Next ni dotenv pisan una variable que ya está definida, así que esto
// manda sobre el .env.local del front y el .env de la API sin tocarlos.
//
// Las claves son las del stack local: fijas y públicas (`npx supabase status`
// las imprime siempre iguales). Sólo abren una base que vive en tu Docker.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SUPABASE_URL = "http://127.0.0.1:54321";
export const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
export const SERVICIO =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
export const API_URL = "http://localhost:4100";
export const SEMILLA_CLAVE = "clave-e2e-local";

export const FRONT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
// La API vive al lado de este repo, como en la máquina de cada uno.
export const API = process.env.E2E_API_DIR ?? resolve(FRONT, "../TP-IngeSoft-API");
