// Categorías internas de Dashboard: comparten un único interruptor de módulo.
// Clientes e Inventario acompañan a los módulos que ya usa el negocio.
import { cobrosConLoDeAntes, cobrosDelCaso } from "./cobros.js";
import { estaPrendido, hijosActivos } from "./modulos.js";

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

export const categoriasDashboard = (activos = []) =>
  CATEGORIAS_DASHBOARD.filter((categoria) => !categoria.modulo || estaPrendido(categoria.modulo, activos));

export const ZONA_DASHBOARD = "America/Argentina/Buenos_Aires";
export const PERIODOS_DASHBOARD = [
  { clave: "mes", nombre: "Este mes" },
  { clave: "7dias", nombre: "Últimos 7 días" },
  { clave: "30dias", nombre: "Últimos 30 días" },
  { clave: "personalizado", nombre: "Rango personalizado" },
];

export function hoyDashboard(ahora = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_DASHBOARD, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(ahora);
  const dato = (tipo) => partes.find((p) => p.type === tipo).value;
  return `${dato("year")}-${dato("month")}-${dato("day")}`;
}

export function errorPeriodo({ desde, hasta }) {
  const valida = (fecha) => /^\d{4}-\d{2}-\d{2}$/.test(fecha ?? "") &&
    Number.isFinite(Date.parse(`${fecha}T00:00:00Z`)) &&
    new Date(`${fecha}T00:00:00Z`).toISOString().slice(0, 10) === fecha;
  if (!valida(desde) || !valida(hasta)) return "Elegí una fecha inicial y una final válidas.";
  if (desde > hasta) return "La fecha final debe ser igual o posterior a la inicial.";
  return null;
}

export function periodoDashboard(clave = "mes", ahora = new Date()) {
  const hasta = hoyDashboard(ahora);
  const dias = clave === "7dias" ? 6 : 29;
  const desde = clave === "mes" ? `${hasta.slice(0, 7)}-01` :
    new Date(Date.parse(`${hasta}T12:00:00Z`) - dias * 86_400_000).toISOString().slice(0, 10);
  return { desde, hasta };
}

export function textoPeriodo({ desde, hasta }) {
  const formato = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const fecha = (valor) => formato.format(new Date(`${valor}T12:00:00Z`));
  return desde === hasta ? fecha(desde) : `${fecha(desde)} al ${fecha(hasta)}`;
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
    total_cobrado: Math.round(pagos.filter((c) => c.estado === "pagado" && enPeriodo(c.pagado_en))
      .reduce((total, c) => total + Number(c.monto), 0) * 100) / 100,
    clientes_nuevos: estaPrendido("clientes", activos) ?
      (datos.clientes ?? []).filter((c) => delNegocio(c) && enPeriodo(c.creado_en)).length : null,
    casos_abiertos: casos.filter((c) => c.estado !== "completado").length,
    productos_reponer: hijosActivos("inventario", activos).some((h) => h.clave === "stock") ?
      (datos.insumos ?? []).filter((i) => delNegocio(i) && i.estado === "en_stock" && i.cantidad <= i.minimo).length : null,
  };
}
