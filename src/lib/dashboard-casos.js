import { ORDEN_ESTADOS } from "./estados.js";
import { intervalosDashboard } from "./dashboard-periodos.js";
import { tCastellano } from "./idioma.js";

const DIA = 86_400_000;
const fechaISO = (instante) => new Date(instante).toISOString().slice(0, 10);

// Ambas líneas comparten los mismos intervalos; agrupar no altera sus totales.
// Los intervalos de los extremos se recortan al período pedido.
export function serieActividadCasos(periodo, porDia, cierresPorDia = [], locale = "es-AR", t = tCastellano) {
  const inicio = Date.parse(`${periodo.desde}T00:00:00Z`);
  const fin = Date.parse(`${periodo.hasta}T00:00:00Z`);
  const dias = (fin - inicio) / DIA + 1;
  const agrupacion = dias <= 62 ? "día" : dias <= 366 ? "semana" : dias <= 1826 ? "mes" : "año";
  const puntos = intervalosDashboard(periodo, agrupacion, locale, t).map((punto) => ({ ...punto, cantidad: 0, cerrados: 0 }));
  for (const [filas, campo] of [[porDia, "cantidad"], [cierresPorDia, "cerrados"]]) {
    let indice = 0;
    for (const fila of [...filas].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
      if (fila.fecha < periodo.desde || fila.fecha > periodo.hasta) continue;
      while (puntos[indice] && puntos[indice].hasta < fila.fecha) indice++;
      if (puntos[indice]) puntos[indice][campo] += fila.cantidad;
    }
  }
  return { agrupacion, puntos };
}

// La demo tiene la misma forma de respuesta que la API. En cuentas reales,
// los cálculos se hacen en el servidor y no sobre las listas de la pantalla.
export function estadisticasCasosDemo(datos, periodo) {
  const casos = (datos.casos ?? []).filter((c) => !c.negocio_id || c.negocio_id === datos.negocio?.id);
  const inicio = Date.parse(`${periodo.desde}T00:00:00-03:00`);
  const fin = Date.parse(`${periodo.hasta}T00:00:00-03:00`) + DIA;
  const porDia = new Map();
  const cierresPorDia = new Map();
  const porEstado = new Map(ORDEN_ESTADOS.map((e) => [e, 0]));
  let totalNuevos = 0;
  for (const caso of casos) {
    const estado = caso.estado?.trim() || "sin_estado";
    porEstado.set(estado, (porEstado.get(estado) ?? 0) + 1);
    const apertura = Date.parse(caso.abierto_en);
    if (!(apertura >= inicio && apertura < fin)) continue;
    const fecha = fechaISO(apertura - 3 * 3_600_000);
    porDia.set(fecha, (porDia.get(fecha) ?? 0) + 1);
    totalNuevos++;
  }
  const ids = new Set(casos.map((c) => c.id));
  let totalCerrados = 0;
  for (const evento of datos.eventos ?? []) {
    if (evento.tipo !== "entrega" || !ids.has(evento.caso_id)) continue;
    const cierre = Date.parse(evento.ocurrido_en);
    if (!(cierre >= inicio && cierre < fin)) continue;
    const fecha = fechaISO(cierre - 3 * 3_600_000);
    cierresPorDia.set(fecha, (cierresPorDia.get(fecha) ?? 0) + 1);
    totalCerrados++;
  }
  return {
    negocio_id: datos.negocio?.id,
    periodo: { ...periodo, zona_horaria: "America/Argentina/Buenos_Aires" },
    actualizado_en: new Date().toISOString(),
    nuevos: { total: totalNuevos, por_dia: [...porDia].sort(([a], [b]) => a.localeCompare(b)).map(([fecha, cantidad]) => ({ fecha, cantidad })) },
    cerrados: { total: totalCerrados, por_dia: [...cierresPorDia].sort(([a], [b]) => a.localeCompare(b)).map(([fecha, cantidad]) => ({ fecha, cantidad })) },
    distribucion_actual: { total: casos.length, por_estado: [...porEstado].map(([estado, cantidad]) => ({ estado, cantidad })) },
  };
}
