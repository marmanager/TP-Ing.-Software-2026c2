import { intervalosDashboard } from "./dashboard-periodos.js";

const DIA = 86_400_000;

export function serieAltasClientes(periodo, porDia) {
  const dias = (Date.parse(periodo.hasta) - Date.parse(periodo.desde)) / DIA + 1;
  const agrupacion = dias <= 62 ? "día" : dias <= 366 ? "semana" : dias <= 1826 ? "mes" : "año";
  const puntos = intervalosDashboard(periodo, agrupacion).map((punto) => ({ ...punto, cantidad: 0 }));
  let indice = 0;
  for (const fila of [...porDia].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    if (fila.fecha < periodo.desde || fila.fecha > periodo.hasta) continue;
    while (puntos[indice] && puntos[indice].hasta < fila.fecha) indice++;
    if (puntos[indice]) puntos[indice].cantidad += fila.cantidad;
  }
  return { agrupacion, puntos };
}

// Sólo para la demo. Las cuentas reales reciben estadísticas de la API,
// nunca las calculan a partir de las listas parciales de la pantalla.
export function estadisticasClientesDemo(datos, periodo) {
  const inicio = Date.parse(`${periodo.desde}T00:00:00-03:00`);
  const fin = Date.parse(`${periodo.hasta}T00:00:00-03:00`) + DIA;
  const delNegocio = (fila) => !fila.negocio_id || fila.negocio_id === datos.negocio?.id;
  const clientes = new Map();
  const altas = new Map();
  let nuevos = 0;
  for (const cliente of (datos.clientes ?? []).filter(delNegocio)) {
    if (clientes.has(cliente.id)) continue;
    clientes.set(cliente.id, { nombre: cliente.nombre, casos: 0, historicos: 0 });
    const registro = Date.parse(cliente.creado_en);
    if (!(registro >= inicio && registro < fin)) continue;
    const fecha = new Date(registro - 3 * 3_600_000).toISOString().slice(0, 10);
    altas.set(fecha, (altas.get(fecha) ?? 0) + 1);
    nuevos++;
  }
  for (const caso of (datos.casos ?? []).filter(delNegocio)) {
    const cliente = caso.cliente_id ? clientes.get(caso.cliente_id) : null;
    if (!cliente) continue;
    const apertura = Date.parse(caso.abierto_en);
    if (!Number.isFinite(apertura) || apertura >= fin) continue;
    cliente.historicos++;
    if (apertura >= inicio) cliente.casos++;
  }
  const conCasos = [...clientes].filter(([, c]) => c.casos > 0);
  const recurrentes = conCasos.filter(([, c]) => c.historicos > 1).length;
  return {
    negocio_id: datos.negocio?.id,
    periodo: { ...periodo, zona_horaria: "America/Argentina/Buenos_Aires" },
    actualizado_en: new Date().toISOString(),
    nuevos: { total: nuevos, por_dia: [...altas].sort(([a], [b]) => a.localeCompare(b)).map(([fecha, cantidad]) => ({ fecha, cantidad })) },
    recurrencia: { clientes_con_casos: conCasos.length, clientes_recurrentes: recurrentes, porcentaje: conCasos.length ? Math.round(recurrentes / conCasos.length * 10_000) / 100 : 0 },
    ranking: conCasos.sort(([aId, a], [bId, b]) => b.casos - a.casos || a.nombre.localeCompare(b.nombre, "es") || aId.localeCompare(bId))
      .map(([cliente_id, c]) => ({ cliente_id, nombre: c.nombre, casos: c.casos })),
  };
}
