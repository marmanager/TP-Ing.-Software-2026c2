// Catálogo de módulos (SCRUM-38 los prende y apaga; acá sólo se definen).
//
// Un módulo es una sección del sistema que un negocio puede tener o no según
// su rubro. El núcleo (Hoy, Casos, Clientes, Mi negocio) está siempre.
//
// Sumar un módulo nuevo en el futuro es agregar una entrada acá: aparece solo
// en el selector de Mi negocio y en la navegación de los negocios que lo tengan.

export const MODULOS = {
  agenda: {
    clave: "agenda",
    nombre: "Agenda",
    icono: "calendario",
    ruta: "/agenda",
    descripcion: "Turnos del día y de la semana.",
  },
  inventario: {
    clave: "inventario",
    nombre: "Inventario",
    icono: "cajas",
    ruta: "/inventario",
    descripcion: "Insumos, stock y lo que hay que pedir.",
  },
  equipo: {
    clave: "equipo",
    nombre: "Equipo",
    icono: "personas",
    ruta: "/equipo",
    descripcion: "Quién atiende cada caso.",
  },
  presupuesto: {
    clave: "presupuesto",
    nombre: "Presupuesto",
    icono: "nota",
    ruta: "/aprobar",
    descripcion: "Pasos que el cliente aprueba uno por uno.",
  },
};

export const LISTA_MODULOS = Object.values(MODULOS);

// Secciones del núcleo: no se pueden apagar.
export const RUTAS_NUCLEO = ["/", "/casos", "/clientes", "/negocio"];

// De una lista de claves a las definiciones, salteando las que no existan.
export const modulosDe = (claves = []) =>
  claves.map((c) => MODULOS[c]).filter(Boolean);
