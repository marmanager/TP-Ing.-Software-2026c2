// Catálogo de módulos (SCRUM-38 los prende y apaga; acá sólo se definen).
//
// Un módulo es una sección del sistema que un negocio puede tener o no. El
// núcleo —Inicio, Casos y Mi negocio— está siempre: sin casos no hay sistema,
// y sin Mi negocio no habría desde dónde volver a prender lo que se apagó.
//
// Sumar un módulo nuevo en el futuro es agregar una entrada acá: aparece solo
// en el selector de Mi negocio y en la navegación de los negocios que lo tengan.
//
// El orden es el de la barra lateral, a propósito: quien busca en "Módulos"
// la sección que ve en el menú la encuentra en el mismo lugar.

// "descripcion" es el renglón corto, para listas y resúmenes.
// "queHace" es la explicación de la pantalla de módulos, donde alguien está
// decidiendo si le sirve o no: dice para qué se usa, con un ejemplo.
//
// "deFabrica" marca los que vienen prendidos sin que nadie los elija. Ver
// estaPrendido() más abajo: es la diferencia entre los módulos que existieron
// siempre como opcionales y los que antes eran núcleo.
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
  // SCRUM-122. Era núcleo; pasó a módulo, prendido de fábrica.
  clientes: {
    clave: "clientes",
    nombre: "Clientes",
    icono: "persona",
    ruta: "/clientes",
    deFabrica: true,
    descripcion: "La ficha de cada cliente, con todo lo que trajo.",
    queHace:
      "La lista de tus clientes y la ficha de cada uno, con su teléfono y todos los trabajos que te trajo. Apagarlo saca la sección del menú: los clientes se siguen anotando igual cuando abrís un caso o un turno.",
  },
  // Las descripciones no nombran lo que se guarda —"repuestos", "insumos"—
  // porque eso depende del rubro y este catálogo es uno solo para todos. Las
  // pantallas sí lo nombran, con vocabulario() de presets.js.
  inventario: {
    clave: "inventario",
    nombre: "Inventario",
    icono: "cajas",
    ruta: "/inventario",
    descripcion: "Lo que tenés en stock y lo que pediste.",
    queHace:
      "Qué tenés, qué se está por acabar y qué pediste que todavía no llegó. Cuando marcás que llegó algo que un caso estaba esperando, ese caso se destraba solo.",
  },
  // SCRUM-121. La clave sigue siendo "presupuesto" y no "aprobar": está
  // escrita en la lista de módulos de cada negocio que existe y en cada preset,
  // y cambiarla obligaba a migrar todo eso para decir lo mismo.
  //
  // Lo que cambió es el nombre, porque el de antes prometía algo que no
  // hacía. Se llamaba "Presupuesto" y apagarlo no apagaba ningún presupuesto:
  // los pasos se siguen armando y aprobando adentro de cada caso. Lo único que
  // prende y apaga es la pantalla "A aprobar" y su tarjeta del Inicio. Ahora
  // se llama como lo que hace, y es el mismo nombre que tiene en el menú.
  presupuesto: {
    clave: "presupuesto",
    nombre: "A aprobar",
    icono: "persona-check",
    ruta: "/aprobar",
    descripcion: "Los casos que esperan que el cliente conteste.",
    queHace:
      "Todos los casos que están esperando que el cliente conteste el presupuesto, en una sola lista y con cuánta plata hay en juego. Apagarlo no apaga el presupuesto: los pasos se siguen armando y aprobando adentro de cada caso.",
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
  // SCRUM-120. Era núcleo; pasó a módulo, prendido de fábrica.
  historial: {
    clave: "historial",
    nombre: "Historial",
    icono: "historial",
    ruta: "/historial",
    deFabrica: true,
    descripcion: "Todo lo que fue pasando en el negocio.",
    queHace:
      "Lo que fue pasando en los casos, día por día y con quién lo hizo: lo que entró, lo que se entregó y la plata. Apagarlo saca la sección del menú: lo que pasa se sigue anotando, y cada caso sigue mostrando el suyo.",
  },
};

export const LISTA_MODULOS = Object.values(MODULOS);

// ------------------------------------------------------------
// Si un módulo está prendido
// ------------------------------------------------------------
// La lista "modulos_activos" de cada negocio dice lo que está PRENDIDO. Eso
// anda para los módulos que fueron opcionales desde el principio, pero no para
// los que antes eran núcleo.
//
// EL PROBLEMA. Ningún negocio que existe hoy tiene "clientes" ni "historial" en
// su lista: hasta ahora no hacía falta, estaban siempre. Si se preguntara
// "¿está en la lista?", el día que esto se publique todos los negocios
// perderían Clientes e Historial de un saque y sin aviso.
//
// POR QUÉ NO UNA MIGRACIÓN. Agregarlos a la lista de cada negocio con SQL
// parece lo directo, pero las migraciones de este repo se pueden volver a
// correr, y volver a correr ésa prendería de nuevo lo que un dueño apagó.
// Taparlo pedía una columna de versión, repetir lo mismo para el modo de
// ejemplo, y dejaba un caso donde la elección de alguien se deshace sola.
//
// LO QUE SE HACE. Los "deFabrica" están prendidos salvo que alguien los haya
// apagado, y apagarlos se anota explícito como "-clientes". Nada que migrar,
// igual en Supabase y en el modo de ejemplo, y ningún negocio pierde nada.
const apagado = (clave) => `-${clave}`;

export function estaPrendido(clave, activos = []) {
  if (MODULOS[clave]?.deFabrica) return !activos.includes(apagado(clave));
  return activos.includes(clave);
}

// Si el negocio no tiene ningún módulo prendido, ni los de fábrica. Es como
// arranca el rubro "personalizable", y mientras siga así el Inicio lo manda a
// elegir los suyos (SCRUM-95).
export const ningunoPrendido = (activos = []) =>
  LISTA_MODULOS.every((m) => !estaPrendido(m.clave, activos));

// ------------------------------------------------------------
// Submódulos: las pantallas de adentro de un módulo
// ------------------------------------------------------------
// La Agenda pasó a tener dos pantallas —los turnos en lista y el calendario
// del mes— y no todo negocio quiere las dos. Son submódulos y no módulos
// sueltos porque sin Agenda no significan nada: un calendario de turnos de
// un negocio que no lleva turnos está vacío por definición.
//
// Van en un catálogo aparte y no adentro de MODULOS a propósito. LISTA_MODULOS
// es "los módulos que se prenden y se apagan", y de ahí salen el contador de
// "Mi negocio" ("tenés 3 de 4 prendidos") y la lista que recomienda cada
// preset. Meter los hijos ahí adentro cambiaría esos dos números sin que
// nadie lo pidiera.
export const SUBMODULOS = {
  turnos: {
    clave: "turnos",
    padre: "agenda",
    nombre: "Turnos",
    icono: "reloj",
    ruta: "/agenda",
    descripcion: "Los turnos en lista, día por día.",
    queHace:
      "Quién viene y a qué hora, en una lista ordenada por día. Es donde se confirma un turno, se marca que la persona vino y se cancela.",
  },
  calendario: {
    clave: "calendario",
    padre: "agenda",
    nombre: "Calendario",
    icono: "calendario",
    ruta: "/agenda/calendario",
    descripcion: "El mes entero, para ver cómo viene.",
    queHace:
      "El mes en una grilla, con los días que tienen turno marcados. Sirve para ver de un vistazo cómo viene la semana que viene y para anotar un turno parado en el día.",
  },

  // El Inventario, partido igual que la Agenda: lo que hay y lo que viene.
  //
  // "En camino" es un submódulo y no un módulo suelto por lo mismo que el
  // Calendario: un pedido es una fila del inventario, y al llegar pasa a "Lo
  // que tenés". Sin Inventario no hay dónde pedir ni adónde llegar.
  stock: {
    clave: "stock",
    padre: "inventario",
    nombre: "En stock",
    icono: "cajas",
    ruta: "/inventario",
    descripcion: "Lo que tenés y lo que se está por acabar.",
    queHace:
      "Lo que tenés, cuánto te queda de cada cosa, y aviso cuando algo baja del mínimo que elegiste.",
  },
  // SCRUM-113.
  en_camino: {
    clave: "en_camino",
    padre: "inventario",
    nombre: "En camino",
    icono: "camion",
    ruta: "/inventario/en-camino",
    descripcion: "Lo que pediste y todavía no llegó.",
    queHace:
      "Lo que pediste y todavía no llegó, con el caso que lo está esperando. Pedís desde acá o desde el caso, el caso queda esperando, y cuando marcás que llegó se destraba solo.",
  },
};

export const LISTA_SUBMODULOS = Object.values(SUBMODULOS);

export const hijosDe = (clave) => LISTA_SUBMODULOS.filter((s) => s.padre === clave);

// Los hijos prendidos de un módulo. Vacío si el padre está apagado: un hijo
// no existe sin su padre.
//
// COMPATIBILIDAD, Y POR QUÉ NO HAY MIGRACIÓN. Un negocio de antes de los
// submódulos tiene "agenda" en la lista y ninguno de sus hijos escrito. Eso
// no quiere decir "los dos apagados": quiere decir que nadie eligió todavía,
// y hasta ayer la Agenda era una sola pantalla. Así que sin ninguno escrito
// valen los dos, y la primera vez que alguien toca el interruptor quedan
// escritos los dos. Es lo mismo que hace conModulos() en datos.js con un
// negocio que no tiene la lista.
export function hijosActivos(clave, activos = []) {
  if (!estaPrendido(clave, activos)) return [];
  const hijos = hijosDe(clave);
  const escritos = hijos.filter((h) => activos.includes(h.clave));
  return escritos.length ? escritos : hijos;
}

// Prender o apagar, devolviendo la lista nueva. Es una función suelta y no
// dos líneas adentro de la pantalla porque tiene cinco reglas que no se ven:
// los de fábrica se apagan anotando que se apagaron, prender un padre prende a
// sus hijos, apagarlo se los lleva, tocar un hijo por primera vez tiene que
// dejar escritos a los hermanos que hasta entonces valían sin estar, y apagar
// el último hijo apaga al padre.
export function alternarModulo(clave, activos = []) {
  // Los de fábrica no tienen hijos (hay una prueba que lo cuida), así que no
  // hace falta cruzar esta regla con la de los submódulos.
  if (MODULOS[clave]?.deFabrica) {
    const marca = apagado(clave);
    return activos.includes(marca)
      ? activos.filter((c) => c !== marca)
      : [...activos, marca];
  }

  const hijos = hijosDe(clave).map((h) => h.clave);

  if (hijos.length) {
    return activos.includes(clave)
      ? activos.filter((c) => c !== clave && !hijos.includes(c))
      : [...activos, clave, ...hijos];
  }

  const def = SUBMODULOS[clave];
  if (def) {
    const hermanos = hijosActivos(def.padre, activos).map((h) => h.clave);
    // Apagar el último hijo es apagar el módulo entero. Antes no se podía
    // (el botón decía "apagá Inventario"). Y no alcanza con sacar al hijo:
    // un padre prendido sin ningún hijo escrito vale como "los dos" (ver
    // hijosActivos), y volvería a prender lo que se acababa de apagar.
    if (hermanos.length === 1 && hermanos[0] === clave) return alternarModulo(def.padre, activos);
    const resto = activos.filter((c) => !hermanos.includes(c));
    return hermanos.includes(clave)
      ? [...resto, ...hermanos.filter((c) => c !== clave)]
      : [...resto, ...hermanos, clave];
  }

  return activos.includes(clave)
    ? activos.filter((c) => c !== clave)
    : [...activos, clave];
}

// Cuáles son las secciones del núcleo no se declara acá: la navegación
// marca con "modulo" las que se pueden apagar, y el resto está siempre.
// Una segunda lista con lo mismo se desincroniza sola.
//
// Y nadie pregunta "activos.includes(...)" a mano: se pregunta
// estaPrendido(), que es el único que sabe cuáles son de fábrica.

// De una lista de claves a las definiciones, salteando las que no existan.
export const modulosDe = (claves = []) =>
  claves.map((c) => MODULOS[c]).filter(Boolean);
