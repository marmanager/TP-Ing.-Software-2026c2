"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { useDatos } from "@/lib/datos";
import { serieAltasClientes } from "@/lib/dashboard-clientes";
import { Boton, Cargando, ErrorGeneral, Tarjeta } from "@/componentes/ui";

const numero = new Intl.NumberFormat("es-AR");
const porcentaje = new Intl.NumberFormat("es-AR", { style: "percent", maximumFractionDigits: 2 });
const TAMANO_RANKING = 10;

function DetalleAlta({ active, payload }) {
  const punto = payload?.[0]?.payload;
  if (!active || !punto) return null;
  return <div className="max-w-64 rounded-campo border border-borde bg-tarjeta p-3 text-etiqueta shadow-sm">
    <p className="font-bold">{punto.detalle}</p>
    <p className="mt-1">{numero.format(punto.cantidad)} {punto.cantidad === 1 ? "cliente nuevo" : "clientes nuevos"}</p>
  </div>;
}

export default function ClientesDashboard({ periodo }) {
  const { negocio, consultarClientesDashboard } = useDatos();
  const consultar = useRef(consultarClientesDashboard);
  consultar.current = consultarClientesDashboard;
  const [intento, setIntento] = useState(0);
  const [respuesta, setRespuesta] = useState(null);
  const [paginacion, setPaginacion] = useState(null);
  const clave = `${negocio.id}:${periodo.desde}:${periodo.hasta}:${intento}`;

  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const r = await consultar.current({ desde: periodo.desde, hasta: periodo.hasta });
        if (vigente) setRespuesta({ clave, ...r });
      } catch {
        if (vigente) setRespuesta({ clave, ok: false, error: "No pudimos consultar las estadísticas de Clientes. Volvé a intentarlo." });
      }
    })();
    return () => { vigente = false; };
  }, [clave, periodo.desde, periodo.hasta]);

  const cargando = respuesta?.clave !== clave;
  const estadisticas = !cargando && respuesta.ok ? respuesta.estadisticas : null;
  const serie = estadisticas ? serieAltasClientes(periodo, estadisticas.nuevos.por_dia) : null;
  const recurrencia = estadisticas?.recurrencia;
  const pagina = paginacion?.clave === clave ? paginacion.pagina : 0;
  const ranking = estadisticas?.ranking ?? [];
  const inicio = pagina * TAMANO_RANKING;
  const visibles = ranking.slice(inicio, inicio + TAMANO_RANKING);
  const paginas = Math.ceil(ranking.length / TAMANO_RANKING);

  return <div aria-busy={cargando}>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h2 id="dashboard-categoria-titulo" className="text-seccion">Clientes</h2>
      <Boton disabled={cargando} onClick={() => setIntento((i) => i + 1)}>Actualizar</Boton>
    </div>
    {cargando ? <Cargando filas={4} /> : !respuesta.ok ? <Tarjeta>
      <ErrorGeneral>{respuesta.error}</ErrorGeneral>
      <Boton onClick={() => setIntento((i) => i + 1)}>Reintentar</Boton>
    </Tarjeta> : <>
      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-2">
        <div className="grid min-w-0 content-start gap-6">
          <Tarjeta>
            <h3 className="text-subtitulo font-bold">Clientes nuevos</h3>
            <p className="mt-2 text-3xl font-bold text-azul tabular-nums">{numero.format(estadisticas.nuevos.total)}</p>
            <p className="mt-2 text-etiqueta text-tinta-media">Unidad: clientes registrados</p>
            <p className="mt-2 text-etiqueta text-tinta-media">Según su fecha de registro. Cada cliente se cuenta una sola vez.</p>
          </Tarjeta>
          <Tarjeta>
            <h3 className="text-subtitulo font-bold">Recurrencia de clientes</h3>
            <p className="mt-2 text-3xl font-bold text-completo tabular-nums">{porcentaje.format(recurrencia.porcentaje / 100)}</p>
            <p className="mt-2 text-etiqueta text-tinta-media">Porcentaje de clientes con más de un caso en el período</p>
            <p className="mt-2 text-etiqueta text-tinta-media">{recurrencia.clientes_con_casos === 0 ? "No hay clientes con casos en este período." : `${numero.format(recurrencia.clientes_recurrentes)} de ${numero.format(recurrencia.clientes_con_casos)} clientes tienen más de un caso hasta la fecha final del período. Cada cliente se cuenta una sola vez.`}</p>
          </Tarjeta>
          <Tarjeta className="min-w-0">
            <figure aria-labelledby="clientes-altas-titulo" aria-describedby="clientes-altas-descripcion">
              <h3 id="clientes-altas-titulo" className="text-subtitulo font-bold">Altas de clientes</h3>
              <figcaption id="clientes-altas-descripcion" className="mt-2 text-etiqueta text-tinta-media">Agrupadas por {serie.agrupacion} · Unidad: clientes registrados</figcaption>
              {estadisticas.nuevos.total === 0 && <p className="mt-4 text-tinta-media">No se registraron clientes en este período.</p>}
              <div className="mt-5 min-w-0">
                <LineChart responsive style={{ width: "100%", minWidth: 0 }} height={280} data={serie.puntos} accessibilityLayer aria-label="Altas de clientes por fecha de registro" margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="var(--color-borde)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="etiqueta" tick={{ fill: "var(--color-tinta-media)", fontSize: 13 }} minTickGap={30} tickMargin={10} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} width={40} domain={[0, "auto"]} tickFormatter={(n) => numero.format(n)} tick={{ fill: "var(--color-tinta-media)", fontSize: 13 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<DetalleAlta />} />
                  <Line dataKey="cantidad" name="Clientes nuevos" type="linear" stroke="var(--color-azul)" strokeWidth={3} dot={serie.puntos.length <= 31 ? { r: 3, fill: "var(--color-azul)" } : false} activeDot={{ r: 6 }} isAnimationActive={false} />
                </LineChart>
              </div>
            </figure>
            <p className="mt-3 text-etiqueta text-tinta-media">Los días sin altas se muestran con cero.</p>
          </Tarjeta>
        </div>
        <Tarjeta className="flex min-w-0 flex-col">
          <h3 className="text-subtitulo font-bold">Ranking de clientes con más casos</h3>
          <p className="mt-2 text-etiqueta text-tinta-media">Casos por fecha de apertura, de mayor a menor. Unidad: casos por cliente.</p>
          {ranking.length === 0 ? <p className="mt-4 text-tinta-media">No se abrieron casos asociados a clientes en este período.</p> : <>
            <table className="mt-5 w-full table-fixed text-left text-etiqueta">
              <caption className="sr-only">Clientes con más casos abiertos en el período seleccionado.</caption>
              <thead><tr className="border-b border-borde"><th scope="col" className="w-9 py-2 pr-2">N.º</th><th scope="col" className="py-2 pr-2">Cliente</th><th scope="col" className="w-14 py-2 text-right">Casos</th></tr></thead>
              <tbody>{visibles.map((cliente, i) => <tr key={cliente.cliente_id} className="border-b border-borde last:border-0">
                <td className="py-3 pr-2 text-tinta-media tabular-nums">{numero.format(inicio + i + 1)}</td>
                <th scope="row" className="break-words py-3 pr-2 font-normal"><Link href={`/clientes/${encodeURIComponent(cliente.cliente_id)}`} className="font-bold text-azul underline underline-offset-2">{cliente.nombre || "Cliente sin nombre"}</Link></th>
                <td className="py-3 text-right font-bold tabular-nums">{numero.format(cliente.casos)}</td>
              </tr>)}</tbody>
            </table>
            {paginas > 1 && <nav aria-label="Páginas del ranking de clientes" className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <Boton disabled={pagina === 0} onClick={() => setPaginacion({ clave, pagina: pagina - 1 })}>Anterior</Boton>
              <p className="text-etiqueta" aria-live="polite">Página {numero.format(pagina + 1)} de {numero.format(paginas)}</p>
              <Boton disabled={pagina + 1 >= paginas} onClick={() => setPaginacion({ clave, pagina: pagina + 1 })}>Siguiente</Boton>
            </nav>}
          </>}
          <p className="mt-auto pt-4 text-etiqueta text-tinta-media">Cada cliente aparece una sola vez. Los casos sin cliente asociado no participan del ranking.</p>
        </Tarjeta>
      </div>
      <p className="mt-4 text-etiqueta text-tinta-media">Consultado a las {new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(estadisticas.actualizado_en))} (Argentina).</p>
    </>}
  </div>;
}
