/**
 * @typedef {"listo" | "falta_informacion" | "no_entendido"} EstadoAsistencia
 *
 * @typedef {Object} RespuestaAsistencia
 * @property {EstadoAsistencia} estado
 * @property {unknown} propuesta Propuesta estructurada; nunca modifica datos.
 * @property {string} explicacion
 * @property {string[]} suposiciones
 * @property {string[]} preguntas
 */

/** @param {Partial<RespuestaAsistencia>} respuesta @returns {RespuestaAsistencia} */
export function respuestaAsistente(respuesta = {}) {
  return {
    estado: "no_entendido",
    propuesta: null,
    explicacion: "",
    suposiciones: [],
    preguntas: [],
    ...respuesta,
  };
}

