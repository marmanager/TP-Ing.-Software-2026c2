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
//
// "Configurar nombres e íconos" guarda los cinco nombres aunque nadie los haya
// tocado (el formulario arranca con los de fábrica, en el idioma de quien
// edita). Un nombre guardado que es igual al de fábrica del rubro, en
// cualquiera de los dos idiomas, cuenta como de fábrica: se traduce, así quien
// sólo cambió un ícono no le fija el idioma a todo el equipo. Costo conocido:
// un negocio que escribe a propósito el nombre de fábrica del otro idioma lo ve
// traducido.
export function presentacionEstado(negocio, estado, idioma = "es") {
  const base = ESTADOS[estado];
  if (!base) return null;
  const guardado = negocio?.estados?.[estado];
  const deFabrica = preset(negocio?.rubro, idioma).etiquetas[estado] ?? estado;
  const escrito = typeof guardado?.nombre === "string" ? guardado.nombre.trim() : "";
  const esDeFabrica = ["es", "en"].some((i) => preset(negocio?.rubro, i).etiquetas[estado] === escrito);
  const nombre = escrito && !esDeFabrica ? escrito : deFabrica;
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
