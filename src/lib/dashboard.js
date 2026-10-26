// Categorías internas de Dashboard: comparten un único interruptor de módulo.
// Clientes e Inventario acompañan a los módulos que ya usa el negocio.
import { cobrosConLoDeAntes, cobrosDelCaso } from "./cobros.js";
import { MODULOS, estaPrendido, hijosActivos, nombreDeModulo } from "./modulos.js";
import { tCastellano, textoDeError } from "./idioma.js";

export const CATEGORIAS_DASHBOARD = [
  {
    clave: "resumen",
    nombre: "Resumen",
    icono: "secciones",
    descripcion: "Una mirada general a la actividad de tu negocio.",
  },
  {
    clave: "casos",
    nombre: "Casos",
    icono: "carpeta",
    descripcion: "El trabajo que ingresa y cómo avanza.",
  },
  {
    clave: "cobros",
    nombre: "Cobros",
    icono: "nota",
    descripcion: "Los cobros recibidos y los medios de pago.",
  },
  {
    clave: "clientes",
    nombre: "Clientes",
    icono: "persona",
    modulo: "clientes",
    descripcion: "Los clientes que llegan y vuelven a tu negocio.",
  },
  {
    clave: "inventario",
    nombre: "Inventario",
    icono: "cajas",
    modulo: "inventario",
    descripcion: "El stock disponible y lo que necesita reposición.",
  },
];

// Los textos de cada categoría salen del diccionario (dashboard.categorias.*);
// sin t, en castellano, igual que las constantes de arriba.
export const traducirCategoria = (c, t = tCastellano) => ({
  ...c,
  nombre: t(`dashboard.categorias.${c.clave}.nombre`, {}, c.nombre),
  descripcion: t(`dashboard.categorias.${c.clave}.descripcion`, {}, c.descripcion),
});

export const categoriasDashboard = (activos = [], t = tCastellano) =>
  CATEGORIAS_DASHBOARD.filter((categoria) => !categoria.modulo || estaPrendido(categoria.modulo, activos))
    .map((categoria) => traducirCategoria(categoria, t));

// Los accesos usan los mismos módulos y destinos que la navegación principal.
// Cobros vive dentro de los casos; no hay una pantalla /cobros independiente.
export function destinoDashboard(clave, activos = [], t = tCastellano) {
  const categoria = categoriasDashboard(activos).find((c) => c.clave === clave);
  if (!categoria || clave === "resumen") return null;
  if (clave === "casos") return { href: "/casos", texto: t("dashboard.destino.casos") };
  if (clave === "cobros") return { href: "/casos", texto: t("dashboard.destino.cobros") };
  const modulo = MODULOS[categoria.modulo];
  if (!modulo) return null;
  const ruta = clave === "inventario" ? hijosActivos("inventario", activos)[0]?.ruta : modulo.ruta;
  return ruta ? { href: ruta, texto: t("dashboard.destino.modulo", { modulo: nombreDeModulo(categoria.modulo, t) }) } : null;
}

export const ZONA_DASHBOARD = "America/Argentina/Buenos_Aires";
export const PERIODOS_DASHBOARD = [
  { clave: "mes", nombre: "Este mes" },
  { clave: "7dias", nombre: "Últimos 7 días" },
  { clave: "30dias", nombre: "Últimos 30 días" },
  { clave: "personalizado", nombre: "Rango personalizado" },
];

// El nombre de un período en el idioma de t.
export const nombreDePeriodo = (clave, t = tCastellano) =>
  t(`dashboard.periodos.${clave}`, {}, PERIODOS_DASHBOARD.find((p) => p.clave === clave)?.nombre ?? clave);

// La agrupación del gráfico ("día", "semana", "mes", "año" son las claves
// internas) como palabra para mostrar.
const CLAVE_DE_AGRUPACION = { "día": "dia", semana: "semana", mes: "mes", "año": "anio" };
export const nombreDeAgrupacion = (agrupacion, t = tCastellano) =>
  t(`dashboard.agrupaciones.${CLAVE_DE_AGRUPACION[agrupacion] ?? agrupacion}`, {}, agrupacion);

// "03:05 p. m." en es-AR y "15:05" en inglés, para que el pie de las
// estadísticas use la misma hora de 24 h que las tablas. El castellano queda
// como estaba (el ciclo por defecto del locale).
export function horaDeConsulta(iso, locale = "es-AR") {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ZONA_DASHBOARD,
    ...(locale === "en-US" ? { hourCycle: "h23" } : {}),
  }).format(new Date(iso));
}

// Lo que se muestra de una consulta que falló: o un error de la API ({codigo,
// mensaje}, que se traduce por código), o un texto propio del tablero que
// viaja como clave del diccionario ("fallback").
export const mensajeDeRespuesta = (respuesta, t = tCastellano) =>
  respuesta?.fallback ? t(respuesta.fallback) : textoDeError(t, respuesta?.error);

export function hoyDashboard(ahora = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_DASHBOARD, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(ahora);
  const dato = (tipo) => partes.find((p) => p.type === tipo).value;
  return `${dato("year")}-${dato("month")}-${dato("day")}`;
}

export function errorPeriodo({ desde, hasta }, t = tCastellano) {
  const valida = (fecha) => /^\d{4}-\d{2}-\d{2}$/.test(fecha ?? "") &&
    Number.isFinite(Date.parse(`${fecha}T00:00:00Z`)) &&
    new Date(`${fecha}T00:00:00Z`).toISOString().slice(0, 10) === fecha;
  if (!valida(desde) || !valida(hasta)) return t("dashboard.periodo.errorFechas");
  if (desde > hasta) return t("dashboard.periodo.errorOrden");
  return null;
}

export function periodoDashboard(clave = "mes", ahora = new Date()) {
  const hasta = hoyDashboard(ahora);
  const dias = clave === "7dias" ? 6 : 29;
  const desde = clave === "mes" ? `${hasta.slice(0, 7)}-01` :
    new Date(Date.parse(`${hasta}T12:00:00Z`) - dias * 86_400_000).toISOString().slice(0, 10);
  return { desde, hasta };
}

export function textoPeriodo({ desde, hasta }, locale = "es-AR", t = tCastellano) {
  const formato = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const fecha = (valor) => formato.format(new Date(`${valor}T12:00:00Z`));
  return desde === hasta ? fecha(desde) : t("dashboard.periodo.rango", { desde: fecha(desde), hasta: fecha(hasta) });
}

// Sólo para el modo de ejemplo. Las cuentas reales obtienen los agregados de
// la API; nunca se calculan sobre las listas parciales cargadas en pantalla.
export function resumenDashboardDemo(datos, periodo) {
  const inicio = Date.parse(`${periodo.desde}T00:00:00-03:00`);
  const fin = Date.parse(`${periodo.hasta}T00:00:00-03:00`) + 86_400_000;
  const enPeriodo = (fecha) => Date.parse(fecha) >= inicio && Date.parse(fecha) < fin;
  const delNegocio = (fila) => !fila.negocio_id || fila.negocio_id === datos.negocio?.id;
  const casos = (datos.casos ?? []).filter(delNegocio);
  const cobros = (datos.cobros ?? []).filter(delNegocio);
  const pagos = [
    ...cobros,
    ...casos.filter((caso) => !cobros.some((c) => c.caso_id === caso.id))
      .flatMap((caso) => cobrosConLoDeAntes(cobrosDelCaso(cobros, caso.id), caso)),
  ];
  const activos = datos.negocio?.modulos_activos ?? [];
  return {
    negocio_id: datos.negocio?.id,
    periodo: { ...periodo, zona_horaria: ZONA_DASHBOARD },
    actualizado_en: new Date().toISOString(),
    total_cobrado: pagos.filter((c) => c.estado === "pagado" && enPeriodo(c.pagado_en))
      .reduce((total, c) => total + Math.round(Number(c.monto) * 100), 0) / 100,
    clientes_nuevos: estaPrendido("clientes", activos) ?
      (datos.clientes ?? []).filter((c) => delNegocio(c) && enPeriodo(c.creado_en)).length : null,
    casos_abiertos: casos.filter((c) => c.estado !== "completado").length,
    productos_reponer: hijosActivos("inventario", activos).some((h) => h.clave === "stock") ?
      (datos.insumos ?? []).filter((i) => delNegocio(i) && i.estado === "en_stock" && i.cantidad <= i.minimo).length : null,
  };
}
