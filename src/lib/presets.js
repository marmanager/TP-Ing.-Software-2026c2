// Presets de rubro (cartilla, sección 02).
//
// Un preset es un diccionario de etiquetas más el paquete de módulos que
// vienen prendidos. Renombra los estados y trae los motivos frecuentes del
// oficio. No puede agregar un sexto estado, ni cambiar un ícono, ni tocar los
// datos de un caso.
//
// En el Sprint 1 ningún preset esconde estados: si escondiera uno, los casos
// sembrados en ese estado desaparecerían de la lista en vivo.

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
    identificador: { nombre: "Patente", ejemplo: "AB 123 CD" },
    roles: { duenio: "Dueño", encargado: "Encargado", tecnico: "Mecánico" },
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
    motivos: [
      "Primera consulta",
      "Control",
      "Renovación de receta",
      "Resultado de estudios",
      "Certificado médico",
      "Seguimiento de tratamiento",
    ],
    modulos: ["agenda", "presupuesto"],
    identificador: { nombre: "Número de ficha", ejemplo: "1042" },
    roles: { duenio: "Dueño", encargado: "Encargado", tecnico: "Profesional" },
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
    motivos: [
      "No enciende",
      "Pantalla rota",
      "Se apaga solo",
      "No carga",
      "Presupuesto de reparación",
      "Limpieza y mantenimiento",
    ],
    modulos: ["inventario", "equipo", "presupuesto"],
    identificador: { nombre: "Número de serie", ejemplo: "SN-48219" },
    roles: { duenio: "Dueño", encargado: "Encargado", tecnico: "Técnico" },
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
// número de ficha del paciente, el número de serie del equipo.
export const comoSeIdentifica = (rubro) => preset(rubro).identificador;

// El "qué falta" de un caso, en el idioma de su rubro.
//
// A diferencia de las etiquetas, este texto NO se recalcula al mostrarlo:
// queda guardado en el caso. Por eso tiene que escribirse desde acá y no a
// mano en cada pantalla, o un negocio de medicina termina con casos que
// dicen "Está en el taller".
//
// Los estados que dependen de algo de afuera ("esperando") o de una nota
// puntual los escribe quien los produce, porque no hay un texto único.
export function queFaltaPara(rubro, estado) {
  const p = preset(rubro);
  switch (estado) {
    case "nuevo":
      return "Asignar a alguien del equipo";
    case "en_proceso":
      return p.etiquetas.en_proceso;
    case "revision_final":
      return p.explica.revision_final;
    default:
      return "";
  }
}
