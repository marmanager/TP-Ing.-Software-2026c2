"use client";

import { useEffect, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import { useDatos } from "@/lib/datos";
import { serieCobros } from "@/lib/dashboard-cobros";
import { medioDe } from "@/lib/cobros";
import { Boton, Cargando, ErrorGeneral, Tarjeta } from "@/componentes/ui";

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compacto = new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 });
const numero = new Intl.NumberFormat("es-AR");
const porcentaje = new Intl.NumberFormat("es-AR", { style: "percent", maximumFractionDigits: 1 });
const colores = {
  efectivo: "var(--color-completo)", transferencia: "var(--color-azul)", tarjeta: "var(--color-revision)",
  link: "var(--color-terracota)", qr: "var(--color-espera)", sin_dato: "var(--color-tinta-suave)",
};

function DetalleGrafico({ active, payload }) {
  const punto = payload?.[0]?.payload;
  if (!active || !punto) return null;
  return <div className="max-w-64 rounded-campo border border-borde bg-tarjeta p-3 text-etiqueta shadow-sm">
    <p className="font-bold">{punto.detalle}</p>
    <p className="mt-1 tabular-nums">{pesos.format(punto.monto)}</p>
  </div>;
}

export default function CobrosDashboard({ periodo }) {
  const { negocio, consultarCobrosDashboard } = useDatos();
  const consultar = useRef(consultarCobrosDashboard);
  consultar.current = consultarCobrosDashboard;
  const [intento, setIntento] = useState(0);
  const [respuesta, setRespuesta] = useState(null);
  const [agrupacion, setAgrupacion] = useState("día");
  const clave = `${negocio.id}:${periodo.desde}:${periodo.hasta}:${intento}`;

  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const r = await consultar.current({ desde: periodo.desde, hasta: periodo.hasta });
        if (vigente) setRespuesta({ clave, ...r });
      } catch {
        if (vigente) setRespuesta({ clave, ok: false, error: "No pudimos consultar las estadísticas de Cobros. Volvé a intentarlo." });
      }
    })();
    return () => { vigente = false; };
  }, [clave, periodo.desde, periodo.hasta]);

  const cargando = respuesta?.clave !== clave;
  const estadisticas = !cargando && respuesta.ok ? respuesta.estadisticas : null;
  const puntos = estadisticas ? serieCobros(periodo, estadisticas.por_dia, agrupacion) : [];
  const medios = estadisticas?.por_medio.map((fila) => ({
    ...fila, detalle: medioDe(fila.medio).palabra, fill: colores[fila.medio] ?? colores.sin_dato,
  })) ?? [];

  return <div aria-busy={cargando}>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h2 id="dashboard-categoria-titulo" className="text-seccion">Cobros</h2>
      <Boton disabled={cargando} onClick={() => setIntento((i) => i + 1)}>Actualizar</Boton>
    </div>
    {cargando ? <Cargando filas={4} /> : !respuesta.ok ? <Tarjeta>
      <ErrorGeneral>{respuesta.error}</ErrorGeneral>
      <Boton onClick={() => setIntento((i) => i + 1)}>Reintentar</Boton>
    </Tarjeta> : <>
      <Tarjeta className="mb-6 min-w-0">
        <h3 className="text-subtitulo font-bold">Total cobrado</h3>
        <p className="mt-2 break-words text-3xl font-bold text-completo tabular-nums" data-testid="cobros-total">{pesos.format(estadisticas.total_cobrado)}</p>
        <p className="mt-2 text-etiqueta text-tinta-media">{numero.format(estadisticas.cantidad_cobros)} {estadisticas.cantidad_cobros === 1 ? "cobro recibido" : "cobros recibidos"} · Pesos argentinos (ARS)</p>
        <p className="mt-2 text-etiqueta text-tinta-media">Según la fecha de pago. Sólo se incluyen cobros pagados; los pendientes, rechazados y anulados quedan fuera.</p>
      </Tarjeta>
      <div className="grid min-w-0 items-stretch gap-6 xl:grid-cols-2">
        <Tarjeta className="min-w-0">
          <figure aria-labelledby="cobros-evolucion-titulo" aria-describedby="cobros-evolucion-descripcion">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 id="cobros-evolucion-titulo" className="text-subtitulo font-bold">Evolución de los cobros</h3>
              <div className="flex items-center gap-2 text-etiqueta font-bold">
                <label htmlFor="cobros-agrupacion">Agrupar por</label>
                <select id="cobros-agrupacion" value={agrupacion} onChange={(e) => setAgrupacion(e.target.value)} className="min-h-12 rounded-campo border border-borde-fuerte bg-tarjeta px-3 text-tinta">
                  <option value="día">Día</option><option value="semana">Semana</option><option value="mes">Mes</option>
                </select>
              </div>
            </div>
            <figcaption id="cobros-evolucion-descripcion" className="mt-2 text-etiqueta text-tinta-media">Agrupados por {agrupacion} · Unidad: pesos argentinos (ARS)</figcaption>
            {estadisticas.cantidad_cobros === 0 && <p className="mt-4 text-tinta-media">No se recibieron cobros en este período.</p>}
            <div className="mt-5 min-w-0">
              <LineChart responsive style={{ width: "100%", minWidth: 0 }} height={280} data={puntos} accessibilityLayer aria-label="Importe cobrado según fecha de pago" margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="var(--color-borde)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="etiqueta" tick={{ fill: "var(--color-tinta-media)", fontSize: 13 }} minTickGap={30} tickMargin={10} axisLine={false} tickLine={false} />
                <YAxis width={58} domain={[0, "auto"]} tickFormatter={(n) => compacto.format(n)} tick={{ fill: "var(--color-tinta-media)", fontSize: 13 }} axisLine={false} tickLine={false} />
                <Tooltip content={<DetalleGrafico />} />
                <Line dataKey="monto" name="Cobrado" type="linear" stroke="var(--color-completo)" strokeWidth={3} dot={puntos.length <= 31 ? { r: 3, fill: "var(--color-completo)" } : false} activeDot={{ r: 6 }} isAnimationActive={false} />
              </LineChart>
            </div>
          </figure>
          <p className="mt-3 text-etiqueta text-tinta-media">Los días sin cobros valen cero. Cambiar la agrupación conserva el total del período.</p>
        </Tarjeta>
        <Tarjeta className="min-w-0">
          <figure aria-labelledby="cobros-medios-titulo" aria-describedby="cobros-medios-descripcion">
            <h3 id="cobros-medios-titulo" className="text-subtitulo font-bold">Distribución por medio de pago</h3>
            <figcaption id="cobros-medios-descripcion" className="mt-2 text-etiqueta text-tinta-media">Distribución del monto cobrado · Pesos argentinos (ARS)</figcaption>
            {estadisticas.total_cobrado > 0 ? <PieChart responsive style={{ width: "100%", minWidth: 0 }} height={260} accessibilityLayer aria-label="Importe cobrado por medio de pago">
              <Pie data={medios} dataKey="monto" nameKey="detalle" innerRadius="52%" outerRadius="78%" paddingAngle={medios.length > 1 ? 2 : 0} isAnimationActive={false} />
              <Tooltip content={<DetalleGrafico />} />
            </PieChart> : <div className="flex h-52 items-center justify-center text-center text-tinta-media">No hay cobros para distribuir en este período.</div>}
          </figure>
          <ul className="mt-2 space-y-3" aria-label="Montos por medio de pago">
            {medios.map((fila) => <li key={fila.medio} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-b border-borde pb-3 text-etiqueta">
              <span className="flex min-w-0 items-center gap-2"><span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ backgroundColor: fila.fill }} /><span>{fila.detalle}</span></span>
              <span className="ml-auto text-right tabular-nums"><strong>{pesos.format(fila.monto)}</strong><span className="block text-tinta-media">{porcentaje.format(estadisticas.total_cobrado ? fila.monto / estadisticas.total_cobrado : 0)} · {numero.format(fila.cantidad)} {fila.cantidad === 1 ? "cobro" : "cobros"}</span></span>
            </li>)}
          </ul>
          <p className="mt-4 flex flex-wrap justify-between gap-2 text-etiqueta font-bold"><span>Total por medios de pago</span><span className="tabular-nums">{pesos.format(estadisticas.total_cobrado)}</span></p>
        </Tarjeta>
      </div>
      <p className="mt-4 text-etiqueta text-tinta-media">Consultado a las {new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(estadisticas.actualizado_en))} (Argentina).</p>
    </>}
  </div>;
}
