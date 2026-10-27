// siembra.js carga las mismas variables que ve Next (.env.local y compañía):
// ahí van E2E_API_URL y E2E_SEMILLA_CLAVE.
import { limpiarSembradas } from "./pruebas/e2e/siembra.js";

export const config = {
  runner: "local",
  specs: ["./pruebas/e2e/**/*.e2e.js"],
  maxInstances: 1,
  // Chrome headless manda Accept-Language en inglés: sin esto los e2e, que
  // buscan textos en castellano, verían la app en inglés (docs/idiomas.md).
  capabilities: [
    {
      browserName: "chrome",
      "wdio:enforceWebDriverClassic": true,
      "goog:chromeOptions": { args: ["--lang=es-AR"], prefs: { "intl.accept_languages": "es-AR,es" } },
    },
  ],
  logLevel: "warn",
  baseUrl: "http://localhost:3000",
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 2,
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    timeout: 60000,
  },
  // Cada spec borra las cuentas que sembró, pase o falle.
  after: async () => {
    await limpiarSembradas();
  },
};
