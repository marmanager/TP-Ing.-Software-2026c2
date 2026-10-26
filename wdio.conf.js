// siembra.js carga las mismas variables que ve Next (.env.local y compañía):
// ahí van E2E_API_URL y E2E_SEMILLA_CLAVE.
import { limpiarSembradas } from "./pruebas/e2e/siembra.js";

export const config = {
  runner: "local",
  specs: ["./pruebas/e2e/**/*.e2e.js"],
  maxInstances: 1,
  capabilities: [{ browserName: "chrome", "wdio:enforceWebDriverClassic": true }],
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
