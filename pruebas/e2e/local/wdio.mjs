// WebdriverIO contra la API de api.mjs: la siembra va a esa API, con su clave.
// Los argumentos se pasan de largo (por ejemplo, --spec un-archivo.e2e.js).

import { spawn } from "node:child_process";
import { API_URL, FRONT, SEMILLA_CLAVE } from "./entorno.mjs";

const env = { ...process.env, E2E_API_URL: API_URL, E2E_SEMILLA_CLAVE: SEMILLA_CLAVE };
const wdio = ["node_modules/@wdio/cli/bin/wdio.js", "run", "./wdio.conf.js", ...process.argv.slice(2)];

const hijo = spawn(process.execPath, wdio, { cwd: FRONT, env, stdio: "inherit" });
hijo.on("exit", (codigo) => process.exit(codigo ?? 0));
