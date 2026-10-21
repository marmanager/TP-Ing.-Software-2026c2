import { ESTADOS, ORDEN_ESTADOS } from "./estados.js";
import { preset } from "./presets.js";

// Opciones deliberadamente cortas: todos estos símbolos ya existen en la
// cartilla visual y conservan el mismo estilo de trazo. El nombre de cada uno
// sale del diccionario (casos.iconos.<clave>).
export const ICONOS_DE_ESTADO = [
  "carpeta",
  "llave",
  "reloj",
  "nota",
  "listo",
  "calendario",
  "persona",
  "diagnostico",
  "camion",
  "chat",
  "tienda",
  "circulo",
];

const iconosValidos = new Set(ICONOS_DE_ESTADO);

// Un nombre que el negocio escribió (Configurar nombres e íconos) se muestra
// tal cual; si no hay, el de fábrica del rubro, en el idioma de quien mira.
export function presentacionEstado(negocio, estado, idioma = "es") {
  const base = ESTADOS[estado];
  if (!base) return null;
  const guardado = negocio?.estados?.[estado];
  const nombre = typeof guardado?.nombre === "string" && guardado.nombre.trim()
    ? guardado.nombre.trim()
    : preset(negocio?.rubro, idioma).etiquetas[estado] ?? estado;
  const icono = iconosValidos.has(guardado?.icono) ? guardado.icono : base.icono;
  return { ...base, nombre, icono };
}

export function configuracionInicialEstados(negocio, idioma = "es") {
  return Object.fromEntries(
    ORDEN_ESTADOS.map((estado) => {
      const visual = presentacionEstado(negocio, estado, idioma);
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
