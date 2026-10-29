// La API para los e2e locales, contra el stack de Docker, con la siembra
// prendida. Kapso y Mercado Pago apuntan a ningún lado: un e2e no puede mandar
// un WhatsApp ni crear un cobro de verdad aunque el .env de la API tenga las
// claves reales.

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { API, ANON, API_URL, SEMILLA_CLAVE, SERVICIO, SUPABASE_URL } from "./entorno.mjs";

// Un Kapso de mentira: guarda el último WhatsApp que la API quiso mandar y lo
// devuelve en GET /ultimo. Es de donde los e2e sacan el código de ingreso de
// la landing, que de otro modo sólo llega al teléfono del cliente.
const PUERTO_KAPSO = 4199;
let ultimo = "";
createServer((req, res) => {
  if (req.method === "GET") return res.end(ultimo);
  let cuerpo = "";
  req.on("data", (d) => (cuerpo += d));
  req.on("end", () => {
    ultimo = cuerpo;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ messaging_product: "whatsapp", messages: [{ id: "wamid.e2e" }] }));
  });
}).listen(PUERTO_KAPSO, "127.0.0.1");

const env = {
  ...process.env,
  PORT: "4100",
  SUPABASE_URL,
  SUPABASE_ANON_KEY: ANON,
  SUPABASE_SERVICE_ROLE_KEY: SERVICIO,
  SEMILLA_CLAVE,
  ORIGENES_PERMITIDOS: "http://localhost:3000",
  FRONTEND_URL: "http://localhost:3000",
  API_PUBLIC_URL: API_URL,
  KAPSO_API_KEY: "kapso-e2e",
  KAPSO_PHONE_NUMBER_ID: "e2e",
  KAPSO_WEBHOOK_SECRET: "e2e",
  KAPSO_URL: `http://127.0.0.1:${PUERTO_KAPSO}`,
  MERCADOPAGO_CLIENT_ID: "e2e",
  MERCADOPAGO_CLIENT_SECRET: "e2e",
  MERCADOPAGO_ACCESS_TOKEN: "e2e",
  MERCADOPAGO_REDIRECT_URI: `${API_URL}/v1/webhooks/mercadopago/vinculacion`,
  MERCADOPAGO_BACK_URL: "http://localhost:3000",
  MERCADOPAGO_WEBHOOK_SECRET: "e2e",
};

const hijo = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], { cwd: API, env, stdio: "inherit" });
hijo.on("exit", (codigo) => process.exit(codigo ?? 0));
