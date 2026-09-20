export const config = {
  runner: "local",
  specs: ["./pruebas/e2e/**/*.e2e.js"],
  maxInstances: 1,
  capabilities: [{ browserName: "chrome" }],
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
};
