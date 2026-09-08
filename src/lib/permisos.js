// Qué puede hacer cada rol (SCRUM-18).
//
// Es el mismo criterio que hacen cumplir las políticas de
// supabase/008_permisos.sql. Acá sólo sirve para no ofrecer botones que la
// base va a rechazar: **la que manda es la base**. Si algún día los dos no
// coinciden, esconder un botón no protege nada y la política sí.
//
// El modo de ejemplo no tiene cuenta, así que juega como dueño: es un
// sandbox para recorrer el sistema entero.

export const PERMISOS = {
  duenio: {
    configurarNegocio: true,
    manejarEquipo: true,
    verTodosLosCasos: true,
    cargarDatos: true,
  },
  encargado: {
    configurarNegocio: false,
    manejarEquipo: false,
    verTodosLosCasos: true,
    cargarDatos: true,
  },
  tecnico: {
    configurarNegocio: false,
    manejarEquipo: false,
    verTodosLosCasos: false,
    cargarDatos: false,
  },
};

export const puede = (rol, que) => Boolean(PERMISOS[rol ?? "duenio"]?.[que]);

// Cómo se llama quien está usando el sistema, para firmar el historial.
//
// Antes cada acción firmaba con un personaje escrito a mano —"Mostrador",
// "Encargado", "Del taller"—, de cuando no había cuentas. Ahora hay una
// persona atrás de cada cosa que pasa y el historial dice cuál.
//
// El orden es del nombre más propio al menos propio:
//   1. La ficha de empleado, que es como el negocio la llama.
//   2. El nombre de la cuenta, si alguna vez se carga.
//   3. El mail hasta el arroba, el mismo recurso que usa
//      aceptar_invitacion() en la base cuando no le pasan nombre.
//
// En el modo de ejemplo no hay cuenta y hay una sola persona: quien está
// mirando. Por eso "Vos" y no un nombre inventado.
//
// Nunca devuelve vacío: una firma en blanco en el historial se lee como si
// el sistema se hubiera olvidado de quién fue.
export function quienEscribe({ esDemo, usuario, empleados = [] } = {}) {
  if (esDemo) return "Vos";

  const ficha = usuario?.id
    ? empleados.find((e) => e.usuario_id === usuario.id)
    : null;
  const mail = usuario?.email ?? "";

  return (
    ficha?.nombre?.trim() ||
    usuario?.nombre?.trim() ||
    (mail.includes("@") ? mail.split("@")[0] : "") ||
    "Alguien del negocio"
  );
}

// Para explicar por qué no se puede, con las palabras del mostrador.
export const QUIEN_PUEDE = {
  configurarNegocio: "Esto lo cambia el dueño del negocio.",
  manejarEquipo: "Sumar y sacar gente lo hace el dueño del negocio.",
  cargarDatos: "Esto lo cargan el dueño y el encargado.",
  // Ninguna pantalla la consulta: de esta se encarga sola la base, que no le
  // manda al técnico los casos que no son suyos. Está para que las cuatro
  // acciones se puedan explicar con las mismas palabras si hace falta.
  verTodosLosCasos: "Cada quien ve los casos que tiene asignados.",
};
