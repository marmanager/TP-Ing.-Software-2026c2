import { ESTADOS, ORDEN_ESTADOS } from "./estados.js";
import { preset } from "./presets.js";

// Opciones deliberadamente cortas: todos estos símbolos ya existen en la
// cartilla visual y conservan el mismo estilo de trazo.
export const ICONOS_DE_ESTADO = [
  ["carpeta", "Carpeta"],
  ["llave", "Herramienta"],
  ["reloj", "Espera"],
  ["nota", "Lista"],
  ["listo", "Listo"],
  ["calendario", "Calendario"],
  ["persona", "Persona"],
  ["diagnostico", "Diagnóstico"],
  ["camion", "En camino"],
  ["chat", "Conversación"],
  ["tienda", "Negocio"],
  ["circulo", "Círculo"],
];

const iconosValidos = new Set(ICONOS_DE_ESTADO.map(([clave]) => clave));

export function presentacionEstado(negocio, estado) {
  const base = ESTADOS[estado];
  if (!base) return null;
  const guardado = negocio?.estados?.[estado];
  const nombre = typeof guardado?.nombre === "string" && guardado.nombre.trim()
    ? guardado.nombre.trim()
    : preset(negocio?.rubro).etiquetas[estado] ?? estado;
  const icono = iconosValidos.has(guardado?.icono) ? guardado.icono : base.icono;
  return { ...base, nombre, icono };
}

export function configuracionInicialEstados(negocio) {
  return Object.fromEntries(
    ORDEN_ESTADOS.map((estado) => {
      const visual = presentacionEstado(negocio, estado);
      return [estado, { nombre: visual.nombre, icono: visual.icono }];
    })
  );
}

export function configuracionEstadosValida(configuracion) {
  return ORDEN_ESTADOS.every((estado) => {
    const valor = configuracion?.[estado];
    return valor?.nombre?.trim() && valor.nombre.trim().length <= 40 && iconosValidos.has(valor.icono);
  });
}
