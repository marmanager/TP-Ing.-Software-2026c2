import { cobrosConLoDeAntes, medioDe } from "./cobros.js";
import { intervalosDashboard } from "./dashboard-periodos.js";

// Agrupar usa centavos y los mismos datos diarios, sin otra consulta a la API.
export function serieCobros(periodo, porDia, agrupacion = "día") {
  const puntos = intervalosDashboard(periodo, agrupacion).map((punto) => ({ ...punto, centavos: 0 }));
  let indice = 0;
  for (const fila of [...porDia].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    if (fila.fecha < periodo.desde || fila.fecha > periodo.hasta) continue;
    while (puntos[indice] && puntos[indice].hasta < fila.fecha) indice++;
    if (puntos[indice]) puntos[indice].centavos += Math.round(Number(fila.monto) * 100);
  }
  return puntos.map(({ centavos, ...punto }) => ({ ...punto, monto: centavos / 100 }));
}

// Sólo para el modo de ejemplo. Las cuentas reales reciben estos agregados
// de la API, que consulta todos los cobros del negocio.
export function estadisticasCobrosDemo(datos, periodo) {
  const delNegocio = (fila) => !fila.negocio_id || fila.negocio_id === datos.negocio?.id;
  const cobros = (datos.cobros ?? []).filter(delNegocio);
  const anteriores = (datos.casos ?? []).filter(delNegocio)
    .filter((caso) => !cobros.some((c) => c.caso_id === caso.id))
    .flatMap((caso) => cobrosConLoDeAntes([], caso));
  const inicio = Date.parse(`${periodo.desde}T00:00:00-03:00`);
  const fin = Date.parse(`${periodo.hasta}T00:00:00-03:00`) + 86_400_000;
  const porDia = new Map();
  const porMedio = new Map();
  let total = 0;
  let cantidad = 0;
  for (const cobro of [...cobros, ...anteriores]) {
    const pago = Date.parse(cobro.pagado_en);
    if (cobro.estado !== "pagado" || !(pago >= inicio && pago < fin)) continue;
    const centavos = Math.round(Number(cobro.monto) * 100);
    const fecha = new Date(pago - 3 * 3_600_000).toISOString().slice(0, 10);
    const medio = medioDe(cobro.medio).clave;
    const anterior = porMedio.get(medio) ?? { centavos: 0, cantidad: 0 };
    porDia.set(fecha, (porDia.get(fecha) ?? 0) + centavos);
    porMedio.set(medio, { centavos: anterior.centavos + centavos, cantidad: anterior.cantidad + 1 });
    total += centavos;
    cantidad++;
  }
  return {
    negocio_id: datos.negocio?.id,
    periodo: { ...periodo, zona_horaria: "America/Argentina/Buenos_Aires" },
    actualizado_en: new Date().toISOString(),
    total_cobrado: total / 100,
    cantidad_cobros: cantidad,
    por_dia: [...porDia].sort(([a], [b]) => a.localeCompare(b)).map(([fecha, centavos]) => ({ fecha, monto: centavos / 100 })),
    por_medio: [...porMedio].sort(([, a], [, b]) => b.centavos - a.centavos)
      .map(([medio, fila]) => ({ medio, monto: fila.centavos / 100, cantidad: fila.cantidad })),
  };
}
