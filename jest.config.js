export default {
  testEnvironment: "node",
  testMatch: ["<rootDir>/pruebas/**/*.test.js"],
  transform: {},
  reporters: ["default", "<rootDir>/pruebas/reporters/pruebas-omitidas.cjs"],
};
