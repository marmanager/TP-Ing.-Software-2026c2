// Validaciones compartidas entre pantallas. Sin dependencias ni "use client":
// se pueden probar con Jest (pruebas/validaciones.test.js).

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

// Qué le falta al alta de un caso, en el orden de la pantalla. Cada uno dice
// en qué campo está y cómo se nombra en el botón apagado.
//
// Antes el botón decía sólo el primer faltante: con el formulario en blanco
// había que completar, mirar el botón, completar, mirar el botón, cuatro
// veces (auditoría, H9). Ahora la pantalla puede marcar todos a la vez.
export function faltantesDelAlta({ nombre, telefono, identificador, servicio }, identificadorEnFrase) {
  const faltan = [];
  if (!nombre?.trim()) faltan.push({ campo: "cliente", frase: "falta el nombre" });
  if (!telefono?.trim() || !telefonoValido(telefono))
    faltan.push({ campo: "telefono", frase: "falta el teléfono" });
  if (!identificador?.trim())
    faltan.push({ campo: "identificador", frase: `falta ${identificadorEnFrase}` });
  if (!servicio?.trim()) faltan.push({ campo: "servicio", frase: "falta qué necesita" });
  return faltan;
}

// Lo que dice el botón apagado: el dato si falta uno solo, la cuenta si
// faltan varios (y entonces los campos vacíos van marcados en la pantalla).
export const motivoDeFaltantes = (faltan) =>
  faltan.length === 0 ? null : faltan.length === 1 ? faltan[0].frase : `faltan ${faltan.length} datos`;
