// La llave con la que el cliente de un negocio vuelve a ver lo suyo en su
// landing (docs/landing-por-negocio.md): la API se la da al entrar con su
// identificador y los últimos 4 del teléfono, y vale unas horas. Se guarda en
// sessionStorage, no en localStorage: cerrar la pestaña es salir, y en un
// celular prestado no queda nada.
//
// Una llave por landing (el código va en la clave): entrar al taller de un
// lado no abre la peluquería de otro. Nunca se confunde con la sesión del
// dueño, que vive en otra clave (src/lib/sesion.js).
//
// Nada de acá tira una excepción: un storage bloqueado (modo privado, sin
// permisos, el servidor) se comporta como un storage vacío.
//
// Los tests están en pruebas/llave-landing.test.js.

const clave = (codigo) => `marmanager.landing.${codigo}`;

// Sin storage explícito se usa el sessionStorage del navegador; en el
// servidor no existe y el error cae en el mismo catch.
const conStorage = (storage, fn) => {
  try {
    return fn(storage ?? globalThis.sessionStorage);
  } catch {
    return null;
  }
};

// La llave de esa landing, o null si no hay, si venció o si no se puede leer.
// "ahora" va en milisegundos, como Date.now(); "vence_en" es la fecha que
// contesta la API.
export function leerLlave(codigo, { storage, ahora = Date.now() } = {}) {
  return conStorage(storage, (s) => {
    const guardada = JSON.parse(s.getItem(clave(codigo)));
    // Si la fecha no se entiende, la comparación da falsa y cuenta como vencida.
    if (typeof guardada?.llave !== "string" || !(Date.parse(guardada.vence_en) > ahora)) return null;
    return guardada.llave;
  });
}

// Devuelve si se pudo guardar. Sin lugar donde guardarla la persona tendría
// que poner sus datos de nuevo en cada pantalla: a quien entra hay que
// decírselo, no dejarlo dando vueltas.
export function guardarLlave(codigo, { llave, vence_en } = {}, { storage } = {}) {
  if (!llave) return false;
  return conStorage(storage, (s) => (s.setItem(clave(codigo), JSON.stringify({ llave, vence_en })), true)) === true;
}

export const borrarLlave = (codigo, { storage } = {}) => {
  conStorage(storage, (s) => s.removeItem(clave(codigo)));
};
