// npm run test:e2e:local — los e2e contra el stack de Docker, sin depender de
// los .env ni de ninguna base en la nube. Antes: `npx supabase start` en este
// repo, y la API al lado (../TP-IngeSoft-API, o E2E_API_DIR).
//
// Levanta la API (api.mjs) y el front (front.mjs), espera a que contesten,
// corre WebdriverIO (wdio.mjs, con los argumentos que vengan: --spec …) y los
// baja al terminar. Sale con el código de las pruebas.

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { API_URL } from "./entorno.mjs";

const aca = dirname(fileURLToPath(import.meta.url));
const correr = (archivo, args = []) =>
  spawn(process.execPath, [join(aca, archivo), ...args], { stdio: "inherit" });

async function esperar(url, segundos = 120) {
  const hasta = Date.now() + segundos * 1000;
  while (Date.now() < hasta) {
    try {
      if ((await fetch(url)).status < 500) return;
    } catch {
      // todavía no levantó
    }
    await new Promise((listo) => setTimeout(listo, 1000));
  }
  throw new Error(`${url} no contestó en ${segundos} segundos.`);
}

const servidores = [correr("api.mjs"), correr("front.mjs")];
const bajar = () => servidores.forEach((s) => s.kill());
for (const s of servidores) s.on("exit", (codigo) => {
  if (codigo) {
    console.error("Un servidor de los e2e se cayó.");
    bajar();
    process.exit(codigo);
  }
});

try {
  await esperar(`${API_URL}/v1/salud`);
  await esperar("http://localhost:3000");
} catch (error) {
  console.error(String(error));
  bajar();
  process.exit(1);
}

const pruebas = correr("wdio.mjs", process.argv.slice(2));
pruebas.on("exit", (codigo) => {
  bajar();
  process.exit(codigo ?? 1);
});
