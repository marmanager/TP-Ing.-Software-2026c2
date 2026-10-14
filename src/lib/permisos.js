// Qué puede hacer cada rol (SCRUM-18).
//
// Es el mismo criterio que hacen cumplir la API y las políticas de
// supabase/008_permisos.sql. Acá sólo sirve para no ofrecer botones que van
// a rechazar: **la que manda es la API**, y detrás la base. Si algún día no
// coinciden, esconder un botón no protege nada y la regla de la API sí.

export const PERMISOS = {
  duenio: {
    configurarNegocio: true,
    manejarEquipo: true,
    verTodosLosCasos: true,
    cargarDatos: true,
    vincularSedes: true,
    sumarAlEquipo: true,
  },
  encargado: {
    configurarNegocio: false,
    manejarEquipo: false,
    verTodosLosCasos: true,
    cargarDatos: true,
    vincularSedes: false,
    sumarAlEquipo: false,
  },
  tecnico: {
    configurarNegocio: false,
    manejarEquipo: false,
    verTodosLosCasos: false,
    cargarDatos: false,
    vincularSedes: false,
    sumarAlEquipo: false,
  },
};

// Sin rol (la cuenta todavía no cargó) no se ofrece nada.
export const puede = (rol, que) => Boolean(PERMISOS[rol]?.[que]);

// Para explicar por qué no se puede, con las palabras del mostrador.
export const QUIEN_PUEDE = {
  configurarNegocio: "Esto lo cambia el dueño del negocio.",
  manejarEquipo: "Sumar y sacar gente lo hace el dueño del negocio.",
  cargarDatos: "Esto lo cargan el dueño y el encargado.",
  vincularSedes: "Vincular sedes lo hace el dueño del negocio.",
  sumarAlEquipo: "Sumar gente al equipo lo hace el dueño del negocio.",
  // Ninguna pantalla la consulta: de esta se encarga sola la base, que no le
  // manda al técnico los casos que no son suyos. Está para que las cuatro
  // acciones se puedan explicar con las mismas palabras si hace falta.
  verTodosLosCasos: "Cada quien ve los casos que tiene asignados.",
};

// Qué significa cada permiso, dicho de la persona. Para la confirmación de
// Equipo: "Va a poder..." / "Deja de poder...".
const QUE_ES = {
  configurarNegocio: "cambiar la configuración del negocio",
  manejarEquipo: "sumar y sacar gente del equipo",
  verTodosLosCasos: "ver todos los casos, no sólo los suyos",
  cargarDatos: "cargar y cambiar casos, presupuestos, clientes, agenda e inventario",
  vincularSedes: "vincular este negocio con sus otras sedes",
  sumarAlEquipo: "sumar gente al equipo y aprobar quién entra",
};

// Qué gana y qué pierde alguien al pasar de un rol a otro.
//
// Desde la 037, cambiar el rol en Equipo cambia los permisos de verdad, y el
// cambio se confirma diciendo esto antes (auditoría, H5): en un desplegable de
// celular el dedo elige otra opción sin querer, y bajar a alguien sin querer
// lo deja sin poder trabajar.
//
// Sale de PERMISOS, no de una lista aparte: si se suma un permiso, entra solo.
// Si ese permiso no tiene su frase en QUE_ES, la prueba lo ataja.
export function queCambiaConElRol(de, a) {
  const antes = PERMISOS[de] ?? {};
  const despues = PERMISOS[a] ?? {};
  const claves = Object.keys(PERMISOS.duenio);
  return {
    gana: claves.filter((k) => !antes[k] && despues[k]).map((k) => QUE_ES[k]),
    pierde: claves.filter((k) => antes[k] && !despues[k]).map((k) => QUE_ES[k]),
  };
}

// Los roles que alguien puede dar al aprobar un pedido: nunca uno más alto que
// el suyo (la base lo vuelve a controlar en aprobar_solicitud, 051).
const RANGO = { duenio: 3, encargado: 2, tecnico: 1 };
export const rolesQuePuedeDar = (miRol) =>
  ["duenio", "encargado", "tecnico"].filter((r) => RANGO[r] <= (RANGO[miRol] ?? 0));
