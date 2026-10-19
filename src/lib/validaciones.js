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

// Si la cuenta tiene contraseña: "tiene", "no tiene" o "no se sabe". Lo dice
// la API (auth_usuario.tiene_contrasena, de la base: 045). Si no lo dice —una
// API publicada antes de eso—, no se sabe, y no se adivina por los
// proveedores: una cuenta de Google que creó su contraseña con el link del
// mail sigue figurando sólo con "google", y la pantalla le decía que no tenía.
export function estadoDeLaContrasena(authUsuario, { recienCreada = false } = {}) {
  if (recienCreada || authUsuario?.tiene_contrasena === true) return "tiene";
  if (authUsuario?.tiene_contrasena === false) return "no tiene";
  return "no se sabe";
}

// Por qué no se puede guardar todavía una contraseña nueva, o null si se
// puede. Se pide dos veces porque se escribe sin verla: sin repetirla, un
// dedazo deja a alguien afuera de su propia cuenta. La usan Mi perfil y la
// pantalla a la que lleva el link del mail.
export const motivoDeContrasenaNueva = (nueva = "", repetida = "") =>
  !contrasenaValida(nueva)
    ? "necesita 8 caracteres o más"
    : nueva !== repetida
      ? "repetila igual abajo"
      : null;

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

// ---------------------------------------------------------------
// El cliente del alta de un caso
// ---------------------------------------------------------------
// Dos clientes pueden llamarse igual. Por eso un cliente se elige de la lista,
// que muestra nombre y teléfono, o se reconoce por nombre Y teléfono: el
// nombre solo no alcanza para saber de quién es el caso.

const comoNombre = (texto = "") => (texto ?? "").trim().toLowerCase();

// El teléfono con sólo sus números: "341 456-7890" y "3414567890" son el mismo.
export const soloNumeros = (telefono) => String(telefono ?? "").replace(/\D/g, "");

// Los que se llaman así, sin importar mayúsculas ni espacios de más. Más de
// uno es el aviso de "existen varios clientes con este nombre".
export const clientesConEseNombre = (nombre, clientes = []) =>
  clientes.filter((c) => comoNombre(c.nombre) === comoNombre(nombre));

// Lo que sugiere la lista mientras se escribe: los que contienen lo escrito.
// Los repetidos aparecen todos; se distinguen por el teléfono.
export function sugerirClientes(texto, clientes = [], cuantos = 8) {
  const buscado = comoNombre(texto);
  if (!buscado) return [];
  return clientes.filter((c) => comoNombre(c.nombre).includes(buscado)).slice(0, cuantos);
}

// Elegir un cliente de la lista pone su nombre y su teléfono, aunque hubiera
// otro escrito: el guardado es el que sirve para avisarle. Si no tiene
// teléfono guardado, queda el escrito. Elegir otro —un toque equivocado— pisa
// todo con el del nuevo.
export const alElegirCliente = (cliente, telefono) => ({
  nombre: cliente.nombre,
  telefono: cliente.telefono || telefono,
  elegido: cliente,
});

// Cuando el nombre se cambia a mano. Escribirlo no trae el teléfono: para eso
// está la lista. Si deja de ser el del cliente elegido, se suelta la elección,
// y el teléfono que se puso solo se va con ella: si no, un cliente nuevo se
// llevaría el teléfono de otro. Uno corregido a mano queda.
export function alCambiarElNombre({ nombre, telefono, elegido }) {
  if (!elegido || comoNombre(elegido.nombre) === comoNombre(nombre)) return { telefono, elegido };
  return { telefono: telefono === (elegido.telefono || "") ? "" : telefono, elegido: null };
}

// A qué cliente va el caso: al elegido de la lista; si no se eligió, al que
// tiene el mismo nombre y el mismo teléfono. Si no hay ninguno, null: se crea
// un cliente nuevo.
export function clienteDelAlta({ nombre, telefono, clientes = [], elegido = null }) {
  if (elegido) return elegido;
  const numero = soloNumeros(telefono);
  if (!numero) return null;
  return clientesConEseNombre(nombre, clientes).find((c) => soloNumeros(c.telefono) === numero) ?? null;
}

// Lo que dice el botón apagado: el dato si falta uno solo, la cuenta si
// faltan varios (y entonces los campos vacíos van marcados en la pantalla).
export const motivoDeFaltantes = (faltan) =>
  faltan.length === 0 ? null : faltan.length === 1 ? faltan[0].frase : `faltan ${faltan.length} datos`;
