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

// Para explicar por qué no se puede, con las palabras del mostrador.
export const QUIEN_PUEDE = {
  configurarNegocio: "Esto lo cambia el dueño del negocio.",
  manejarEquipo: "Sumar y sacar gente lo hace el dueño del negocio.",
  cargarDatos: "Esto lo cargan el dueño y el encargado.",
};
