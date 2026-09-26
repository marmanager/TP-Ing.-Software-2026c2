// Presets de rubro (cartilla, sección 02).
//
// Un preset es un diccionario de etiquetas más el paquete de módulos que
// vienen prendidos. Renombra los estados y trae los motivos frecuentes del
// oficio. No puede agregar un sexto estado, ni cambiar un ícono, ni tocar los
// datos de un caso.
//
// Ningún preset esconde estados todavía: la cartilla lo permite, pero un caso
// que ya está en el estado escondido desaparecería de la lista sin aviso.
//
// "ejemplos" son los textos de muestra de los formularios. Van acá y no en
// cada pantalla porque un ejemplo de otro oficio confunde más que no tener
// ninguno: a un consultorio no le sirve leer "cambio de pastillas de freno".
//
// "palabras" son los sustantivos que cambian de un oficio a otro y aparecen
// en botones, títulos y menús de toda la app. Se usan con vocabulario(), más
// abajo, que los devuelve ya declinados: "un repuesto", "los insumos",
// "3 repuestos". Cada palabra lleva su plural y su género escritos a mano, y
// no calculados, por lo mismo que "identificador" lleva "enFrase": el
// castellano no se deduce ("un DNI", "una pieza", "el análisis/los análisis").
//
// Sumar una palabra nueva —"cliente" que en un consultorio sea "paciente"—
// es agregarla acá en los tres rubros y usarla con vocabulario(rubro).cliente.

export const PRESETS = {
  taller: {
    clave: "taller",
    nombre: "Taller mecánico",
    queEs: "Autos que entran, se diagnostican, se presupuestan y se entregan.",
    etiquetas: {
      nuevo: "Turno anotado",
      en_proceso: "Está en el taller",
      esperando: "Esperando",
      revision_final: "Control final",
      completado: "Entregado",
    },
    explica: {
      esperando: "El repuesto o el sí del cliente",
      revision_final: "Control antes de entregar",
    },
    // Las dos esperas, separadas. "explica.esperando" las mezcla —"el
    // repuesto O el sí del cliente"— y para adentro alcanza, pero al cliente
    // que abre el link hay que decirle cuál de las dos es: si la pelota es
    // suya y la pantalla no se lo dice, no contesta nunca.
    espera: { cliente: "tu respuesta al presupuesto", negocio: "un repuesto" },
    motivos: [
      "Ruido raro",
      "Service de rutina",
      "Cambio de aceite y filtros",
      "Frenos",
      "No arranca",
      "Luz de tablero encendida",
      "Alineación y balanceo",
    ],
    modulos: ["agenda", "inventario", "equipo", "presupuesto"],
    identificador: { nombre: "Patente", enFrase: "la patente", ejemplo: "AB 123 CD" },
    roles: { duenio: "Dueño", encargado: "Encargado", tecnico: "Mecánico" },
    // Lo que el taller tiene en stock. Era "repuesto", y pasó a "producto"
    // porque en el estante hay más que repuestos: tornillos, herramientas,
    // lubricantes, y "Agregar un repuesto" para cargar una llave de 13 no se
    // entiende.
    palabras: {
      articulo: { uno: "producto", varios: "productos", genero: "m" },
    },
    ejemplos: {
      negocio: "Taller Sur",
      descripcion: "Mecánica general y chapa, zona sur",
      servicio: "Un ruido raro cuando frena",
      diagnostico: "La correa está floja y las pastillas, al límite.",
      paso: "Cambio de pastillas de freno",
      turno: "cambio de aceite",
      insumo: "filtro de aceite",
    },
  },

  medicina: {
    clave: "medicina",
    nombre: "Medicina",
    queEs: "Pacientes que sacan turno, se atienden y se les da el alta.",
    etiquetas: {
      nuevo: "Turno pedido",
      en_proceso: "En consulta",
      esperando: "Esperando",
      revision_final: "Control final",
      completado: "Dado de alta",
    },
    explica: {
      esperando: "El estudio o el turno con el especialista",
      revision_final: "Control antes del alta",
    },
    espera: { cliente: "tu respuesta", negocio: "un estudio o un turno con el especialista" },
    motivos: [
      "Primera consulta",
      "Control",
      "Renovación de receta",
      "Resultado de estudios",
      "Certificado médico",
      "Seguimiento de tratamiento",
    ],
    modulos: ["agenda", "presupuesto"],
    identificador: { nombre: "DNI", enFrase: "el DNI", ejemplo: "30123456" },
    roles: { duenio: "Dueño", encargado: "Encargado", tecnico: "Profesional" },
    // Guantes, jeringas, gasas: en un consultorio no hay "repuestos" ni
    // "productos", hay insumos.
    palabras: {
      articulo: { uno: "insumo", varios: "insumos", genero: "m" },
    },
    ejemplos: {
      negocio: "Consultorio Belgrano",
      descripcion: "Clínica médica, con obras sociales",
      servicio: "Dolor de cabeza que no se le va hace una semana",
      diagnostico: "Contractura cervical. No hay signos de alarma.",
      paso: "Resonancia de columna cervical",
      turno: "control anual",
      insumo: "guantes descartables",
    },
  },

  service: {
    clave: "service",
    nombre: "Service técnico",
    queEs: "Equipos que se reciben, se reparan, se prueban y se devuelven.",
    etiquetas: {
      nuevo: "Equipo recibido",
      en_proceso: "En reparación",
      esperando: "Esperando",
      revision_final: "Prueba final",
      completado: "Entregado",
    },
    explica: {
      esperando: "El repuesto o el presupuesto aprobado",
      revision_final: "Prueba antes de entregar",
    },
    espera: { cliente: "tu respuesta al presupuesto", negocio: "un repuesto" },
    motivos: [
      "No enciende",
      "Pantalla rota",
      "Se apaga solo",
      "No carga",
      "Presupuesto de reparación",
      "Limpieza y mantenimiento",
    ],
    modulos: ["inventario", "equipo", "presupuesto"],
    identificador: { nombre: "Número de serie", enFrase: "el número de serie", ejemplo: "SN-48219" },
    roles: { duenio: "Dueño", encargado: "Encargado", tecnico: "Técnico" },
    // Igual que el taller: el estante tiene más que repuestos.
    palabras: {
      articulo: { uno: "producto", varios: "productos", genero: "m" },
    },
    ejemplos: {
      negocio: "Service Centro",
      descripcion: "Notebooks y celulares, reparación en el día",
      servicio: "La notebook se apaga sola a los diez minutos",
      diagnostico: "El cooler está trabado y el procesador recalienta.",
      paso: "Cambio de cooler y pasta térmica",
      turno: "retirar la notebook",
      insumo: "pasta térmica",
    },
  },
};

// Los tres roles del equipo son fijos, igual que los cinco estados: la base
// no acepta otros. Lo que cambia por rubro es cómo se llaman.
export const ORDEN_ROLES = ["duenio", "encargado", "tecnico"];

export const RUBROS = Object.values(PRESETS);

export const preset = (rubro) => PRESETS[rubro] ?? PRESETS.taller;

// La palabra que ve el usuario para un estado, en el idioma de su rubro.
export const etiquetaEstado = (rubro, estado) =>
  preset(rubro).etiquetas[estado] ?? estado;

// Lo mismo para los roles del equipo: el que arregla autos es "Mecánico" en
// un taller y "Profesional" en un consultorio.
export const etiquetaRol = (rubro, rol) => preset(rubro).roles[rol] ?? rol;

// Cómo llama cada rubro a lo que identifica el caso: la patente del auto, el
// DNI del paciente, el número de serie del equipo.
//
// No es un dato más: es lo más certero que tenemos para reconocer un caso, y
// por eso se pide al abrirlo. El nombre de un cliente se escribe de diez
// formas distintas; una patente, no.
//
// "nombre" es para la etiqueta del campo y "enFrase" para meterlo en medio de
// una oración: van separados porque no alcanza con pasar el nombre a
// minúsculas — "el DNI" no es "el dni".
export const comoSeIdentifica = (rubro) => preset(rubro).identificador;

// Los textos de muestra de los formularios, en el oficio del negocio.
export const ejemplosDe = (rubro) => preset(rubro).ejemplos;

// Cómo llama cada rubro a las dos cosas por las que un caso puede estar
// frenado: la respuesta del cliente, o algo que tiene que conseguir el
// negocio. Un taller espera un repuesto y un consultorio, un estudio.
export const comoSeEspera = (rubro) => preset(rubro).espera;

// ------------------------------------------------------------
// El vocabulario del rubro
// ------------------------------------------------------------
// Las formas de una palabra, ya armadas para meter en un texto:
//
//   palabra(n)      "repuesto" · "repuestos"   (plural si n no es 1)
//   un()            "un repuesto" · "una pieza"
//   el(n)           "el repuesto" · "los repuestos" · "la pieza"
//   cuantos(n)      "1 repuesto" · "3 repuestos"
//   segun(m, f)     elige entre las dos formas de un adjetivo o participio
//                   que tiene que concordar: segun("Nuevo", "Nueva")
//
// segun() recibe las dos formas escritas por quien la llama, en vez de
// sacarle la "o" y ponerle una "a": "Nuevo/Nueva" sale así, pero no toda
// palabra se deja, y un error de concordancia en un botón se ve.
//
// Va separada de vocabulario() para poder probarla con cualquier palabra, en
// particular una femenina, que hoy ningún preset usa.
export function formas({ uno, varios, genero }) {
  const f = genero === "f";
  return {
    palabra: (n = 1) => (n === 1 ? uno : varios),
    un: () => `${f ? "una" : "un"} ${uno}`,
    el: (n = 1) => (n === 1 ? `${f ? "la" : "el"} ${uno}` : `${f ? "las" : "los"} ${varios}`),
    cuantos: (n) => `${n} ${n === 1 ? uno : varios}`,
    segun: (masculino, femenino) => (f ? femenino : masculino),
  };
}

// Todas las palabras del rubro, declinadas. Se usa así:
//
//   const { articulo } = vocabulario(negocio?.rubro);
//   `Agregar ${articulo.un()}`              → "Agregar un producto" (taller)
//   `${articulo.cuantos(3)} en camino`      → "3 insumos en camino" (medicina)
export function vocabulario(rubro) {
  const palabras = preset(rubro).palabras ?? {};
  return Object.fromEntries(
    Object.entries(palabras).map(([clave, palabra]) => [clave, formas(palabra)])
  );
}

// La primera letra en mayúscula, para cuando la palabra arranca un título o
// un botón: "Repuestos en camino". Con toUpperCase y no a mano, así las
// palabras con tilde en la primera letra ("Órdenes") salen bien.
export const mayuscula = (texto) =>
  texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;

// El "qué falta" de un caso, en el idioma de su rubro.
//
// A diferencia de las etiquetas, este texto NO se recalcula al mostrarlo:
// queda guardado en el caso. Por eso tiene que escribirse desde acá y no a
// mano en cada pantalla, o un negocio de medicina termina con casos que
// dicen "Está en el taller".
//
// "esperando" es el único que no sale de acá: depende de qué se está
// esperando —un repuesto, el sí del cliente— y lo escribe quien lo produce.
export function queFaltaPara(rubro, estado) {
  const p = preset(rubro);
  switch (estado) {
    case "nuevo":
      return "Asignar a alguien del equipo";
    case "en_proceso":
      return p.etiquetas.en_proceso;
    case "revision_final":
      return p.explica.revision_final;
    case "esperando":
      // Quien sabe qué se está esperando lo escribe más preciso —el flujo del
      // insumo pone "El repuesto llega mañana"—, pero desde el desplegable no
      // hay quién, así que vale lo genérico del rubro antes que un hueco.
      return p.explica.esperando;
    case "completado":
      return "Nada, el caso está cerrado.";
    default:
      return "";
  }
}
