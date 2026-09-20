export default {
  testEnvironment: "node",
  testMatch: ["<rootDir>/pruebas/**/*.test.js"],
  transform: {},
  collectCoverageFrom: [
    "src/lib/**/*.js",
    // Estos módulos son proveedores de React y contienen JSX. Se cubrirán
    // cuando agreguemos tests de componentes con un entorno de navegador.
    "!src/lib/auth.js",
    "!src/lib/datos.js",
  ],
  coverageDirectory: "coverage",
};
