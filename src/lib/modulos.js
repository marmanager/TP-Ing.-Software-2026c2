// Catálogo de módulos (SCRUM-38 los prende y apaga; acá sólo se definen).
//
// Un módulo es una sección del sistema que un negocio puede tener o no según
// su rubro. El núcleo (Hoy, Casos, Clientes, Mi negocio) está siempre.
//
// Sumar un módulo nuevo en el futuro es agregar una entrada acá: aparece solo
// en el selector de Mi negocio y en la navegación de los negocios que lo tengan.

// "descripcion" es el renglón corto, para listas y resúmenes.
// "queHace" es la explicación de la pantalla de módulos, donde alguien está
// decidiendo si le sirve o no: dice para qué se usa, con un ejemplo.
export const MODULOS = {
  agenda: {
    clave: "agenda",
    nombre: "Agenda",
    icono: "calendario",
    ruta: "/agenda",
    descripcion: "Turnos del día y de la semana.",
    queHace:
      "Los turnos del día y de la semana en una sola pantalla, con quién viene y a qué hora. Sirve para anotar cuándo entra un trabajo y cuándo lo vienen a buscar.",
  },
  inventario: {
    clave: "inventario",
    nombre: "Inventario",
    icono: "cajas",
    ruta: "/inventario",
    descripcion: "Insumos, stock y lo que hay que pedir.",
    queHace:
      "Qué tenés, qué se está por acabar y qué pediste que todavía no llegó. Cuando marcás que llegó algo que un caso estaba esperando, ese caso se destraba solo.",
  },
  equipo: {
    clave: "equipo",
    nombre: "Equipo",
    icono: "personas",
    ruta: "/equipo",
    descripcion: "Quién atiende cada caso.",
    queHace:
      "Las personas que atienden los trabajos y qué tiene cada una entre manos. Si trabajás solo, dejalo apagado: un caso no necesita tener a alguien asignado.",
  },
  presupuesto: {
    clave: "presupuesto",
    nombre: "Presupuesto",
    icono: "nota",
    ruta: "/aprobar",
    descripcion: "Pasos que el cliente aprueba uno por uno.",
    queHace:
      "El presupuesto se arma por pasos y el cliente aprueba cada uno por separado, en vez de decir que sí o que no a todo. Queda anotado qué aprobó y por cuánto.",
  },
};

export const LISTA_MODULOS = Object.values(MODULOS);

// Secciones del núcleo: no se pueden apagar.
export const RUTAS_NUCLEO = ["/", "/casos", "/clientes", "/negocio"];

// De una lista de claves a las definiciones, salteando las que no existan.
export const modulosDe = (claves = []) =>
  claves.map((c) => MODULOS[c]).filter(Boolean);
