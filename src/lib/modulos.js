// Catálogo de módulos (SCRUM-38 los prende y apaga; acá sólo se definen).
//
// Un módulo es una sección del sistema que un negocio puede tener o no según
// su rubro. El núcleo (Inicio, Casos, Clientes, Mi negocio) está siempre.
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
  if (!activos.includes(clave)) return [];
  const hijos = hijosDe(clave);
  const escritos = hijos.filter((h) => activos.includes(h.clave));
  return escritos.length ? escritos : hijos;
}

// Apagar el último hijo dejaría el módulo prendido y sin ninguna pantalla
// adentro. Eso no es un estado que alguien quiera: es apagar el módulo, y
// para eso está el interruptor del padre. El botón lo dice, como manda la
// cartilla para todo botón apagado.
export function motivoParaNoApagar(clave, activos = []) {
  const def = SUBMODULOS[clave];
  if (!def) return null;
  const quedan = hijosActivos(def.padre, activos).filter((h) => h.clave !== clave);
  return quedan.length ? null : `apagá ${MODULOS[def.padre].nombre}`;
}

// Prender o apagar, devolviendo la lista nueva. Es una función suelta y no
// dos líneas adentro de la pantalla porque tiene tres reglas que no se ven:
// prender un padre prende a sus hijos, apagarlo se los lleva, y tocar un
// hijo por primera vez tiene que dejar escritos a los hermanos que hasta
// entonces valían sin estar.
export function alternarModulo(clave, activos = []) {
  const hijos = hijosDe(clave).map((h) => h.clave);

  if (hijos.length) {
    return activos.includes(clave)
      ? activos.filter((c) => c !== clave && !hijos.includes(c))
      : [...activos, clave, ...hijos];
  }

  const def = SUBMODULOS[clave];
  if (def) {
    const hermanos = hijosActivos(def.padre, activos).map((h) => h.clave);
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

// De una lista de claves a las definiciones, salteando las que no existan.
export const modulosDe = (claves = []) =>
  claves.map((c) => MODULOS[c]).filter(Boolean);
