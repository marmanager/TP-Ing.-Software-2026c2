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

// El monto va en números y sin puntos (cartilla, sección 05: «Escribí el
// monto con números, sin puntos. Por ejemplo: 120000»). Cero no sirve: un
// paso que no cuesta nada no es un paso del presupuesto.
export const montoValido = (valor = "") =>
  /^\d+$/.test(String(valor).trim()) && Number(valor) > 0;

// El cobro del caso al entregarlo (SCRUM-74). No usa montoValido a propósito:
// aquel exige mayor que cero, porque un paso del presupuesto que no cuesta
// nada no es un paso. Un cobro de cero sí existe, y hay que poder distinguirlo
// de no haber registrado nada:
//
//   vacío → nadie registró un cobro acá
//   cero  → se entregó sin cobrar (garantía, cortesía, obra social)
//
// Si las dos se guardaran igual, el negocio no podría saber cuáles entregó
// sin cobrar y cuáles cobró por afuera del sistema.
export const cobroValido = (valor = "") => {
  const limpio = String(valor).trim();
  return limpio === "" || /^\d+$/.test(limpio);
};

// De lo que se escribió en el campo a lo que se guarda en la base: null
// cuando no se registró nada, un número cuando sí.
export const montoCobrado = (valor = "") => {
  const limpio = String(valor).trim();
  return limpio === "" ? null : Number(limpio);
};
