// Validaciones compartidas entre pantallas. Sin dependencias ni "use client":
// se pueden probar con `node --test` (pruebas/validaciones.test.js).

// "Con característica, sin el 0 ni el 15": diez dígitos que no arrancan en 0.
export const telefonoValido = (valor = "") =>
  /^\d{10}$/.test(valor.replace(/\D/g, "")) && !valor.trim().startsWith("0");

// Forma mínima de un mail: algo, arroba, algo, punto, algo.
export const emailValido = (valor = "") =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim());

// La contraseña necesita al menos 8 caracteres.
export const contrasenaValida = (valor = "") => valor.length >= 8;
