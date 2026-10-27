"use client";

import { useEffect, useRef, useState } from "react";
import { useIdioma } from "@/lib/useIdioma";
import { formatoNumero } from "@/lib/formatoNumero";
import Link from "next/link";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { useDatos } from "@/lib/datos";
import { serieAltasClientes } from "@/lib/dashboard-clientes";
import { horaDeConsulta, mensajeDeRespuesta, nombreDeAgrupacion } from "@/lib/dashboard";
import { Boton, Cargando, ErrorGeneral, Tarjeta } from "@/componentes/ui";

const numero = (locale) => formatoNumero(locale);
const porcentaje = (locale) => formatoNumero(locale, { style: "percent", maximumFractionDigits: 2 });
const TAMANO_RANKING = 10;

function DetalleAlta({ active, payload }) {
  const { locale, t } = useIdioma();
  const punto = payload?.[0]?.payload;
  if (!active || !punto) return null;
  return <div className="max-w-64 rounded-campo border border-borde bg-tarjeta p-3 text-etiqueta shadow-sm">
    <p className="font-bold">{punto.detalle}</p>
    <p className="mt-1">{t("dashboard.clientes.tooltip", { n: punto.cantidad, cantidad: numero(locale).format(punto.cantidad) })}</p>
  </div>;
}

export default function ClientesDashboard({ periodo }) {
  const { locale, t } = useIdioma();
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
        if (vigente) setRespuesta({ clave, ok: false, fallback: "dashboard.clientes.noPudimos" });
      }
    })();
    return () => { vigente = false; };
  }, [clave, periodo.desde, periodo.hasta]);

  const cargando = respuesta?.clave !== clave;
  const estadisticas = !cargando && respuesta.ok ? respuesta.estadisticas : null;
  const serie = estadisticas ? serieAltasClientes(periodo, estadisticas.nuevos.por_dia, locale, t) : null;
  const recurrencia = estadisticas?.recurrencia;
  const pagina = paginacion?.clave === clave ? paginacion.pagina : 0;
  const ranking = estadisticas?.ranking ?? [];
  const inicio = pagina * TAMANO_RANKING;
  const visibles = ranking.slice(inicio, inicio + TAMANO_RANKING);
  const paginas = Math.ceil(ranking.length / TAMANO_RANKING);

  return <div aria-busy={cargando}>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h2 id="dashboard-categoria-titulo" className="text-seccion">{t("dashboard.categorias.clientes.nombre")}</h2>
      <Boton disabled={cargando} onClick={() => setIntento((i) => i + 1)}>{t("dashboard.actualizar")}</Boton>
    </div>
    {cargando ? <Cargando filas={4} /> : !respuesta.ok ? <Tarjeta>
      <ErrorGeneral>{mensajeDeRespuesta(respuesta, t)}</ErrorGeneral>
      <Boton onClick={() => setIntento((i) => i + 1)}>{t("dashboard.reintentar")}</Boton>
    </Tarjeta> : <>
      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-2">
        <div className="grid min-w-0 content-start gap-6">
          <Tarjeta>
            <h3 className="text-subtitulo font-bold">{t("dashboard.clientes.nuevos")}</h3>
            <p className="mt-2 text-3xl font-bold text-azul tabular-nums">{numero(locale).format(estadisticas.nuevos.total)}</p>
            <p className="mt-2 text-etiqueta text-tinta-media">{t("dashboard.clientes.unidad")}</p>
            <p className="mt-2 text-etiqueta text-tinta-media">{t("dashboard.clientes.segunRegistro")}</p>
          </Tarjeta>
          <Tarjeta>
            <h3 className="text-subtitulo font-bold">{t("dashboard.clientes.recurrencia")}</h3>
            <p className="mt-2 text-3xl font-bold text-completo tabular-nums">{porcentaje(locale).format(recurrencia.porcentaje / 100)}</p>
            <p className="mt-2 text-etiqueta text-tinta-media">{t("dashboard.clientes.recurrenciaApoyo")}</p>
            <p className="mt-2 text-etiqueta text-tinta-media">{recurrencia.clientes_con_casos === 0 ? t("dashboard.clientes.sinClientesConCasos") : t("dashboard.clientes.recurrentes", { recurrentes: numero(locale).format(recurrencia.clientes_recurrentes), conCasos: numero(locale).format(recurrencia.clientes_con_casos) })}</p>
          </Tarjeta>
          <Tarjeta className="min-w-0">
            <figure aria-labelledby="clientes-altas-titulo" aria-describedby="clientes-altas-descripcion">
              <h3 id="clientes-altas-titulo" className="text-subtitulo font-bold">{t("dashboard.clientes.altas")}</h3>
              <figcaption id="clientes-altas-descripcion" className="mt-2 text-etiqueta text-tinta-media">{t("dashboard.clientes.agrupadas", { agrupacion: nombreDeAgrupacion(serie.agrupacion, t) })}</figcaption>
              {estadisticas.nuevos.total === 0 && <p className="mt-4 text-tinta-media">{t("dashboard.clientes.sinAltas")}</p>}
              <div className="mt-5 min-w-0">
                <LineChart responsive style={{ width: "100%", minWidth: 0 }} height={280} data={serie.puntos} accessibilityLayer aria-label={t("dashboard.clientes.graficoAltas")} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="var(--color-borde)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="etiqueta" tick={{ fill: "var(--color-tinta-media)", fontSize: 13 }} minTickGap={30} tickMargin={10} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} width={40} domain={[0, "auto"]} tickFormatter={(n) => numero(locale).format(n)} tick={{ fill: "var(--color-tinta-media)", fontSize: 13 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<DetalleAlta />} />
                  <Line dataKey="cantidad" name={t("dashboard.clientes.serieNuevos")} type="linear" stroke="var(--color-azul)" strokeWidth={3} dot={serie.puntos.length <= 31 ? { r: 3, fill: "var(--color-azul)" } : false} activeDot={{ r: 6 }} isAnimationActive={false} />
                </LineChart>
              </div>
            </figure>
            <p className="mt-3 text-etiqueta text-tinta-media">{t("dashboard.clientes.diasSinAltas")}</p>
          </Tarjeta>
        </div>
        <Tarjeta className="flex min-w-0 flex-col">
          <h3 className="text-subtitulo font-bold">{t("dashboard.clientes.ranking")}</h3>
          <p className="mt-2 text-etiqueta text-tinta-media">{t("dashboard.clientes.rankingApoyo")}</p>
          {ranking.length === 0 ? <p className="mt-4 text-tinta-media">{t("dashboard.clientes.sinRanking")}</p> : <>
            <table className="mt-5 w-full table-fixed text-left text-etiqueta">
              <caption className="sr-only">{t("dashboard.clientes.tablaDescripcion")}</caption>
              <thead><tr className="border-b border-borde"><th scope="col" className="w-9 py-2 pr-2">{t("dashboard.clientes.columnaNumero")}</th><th scope="col" className="py-2 pr-2">{t("dashboard.clientes.columnaCliente")}</th><th scope="col" className="w-14 py-2 text-right">{t("dashboard.clientes.columnaCasos")}</th></tr></thead>
              <tbody>{visibles.map((cliente, i) => <tr key={cliente.cliente_id} className="border-b border-borde last:border-0">
                <td className="py-3 pr-2 text-tinta-media tabular-nums">{numero(locale).format(inicio + i + 1)}</td>
                <th scope="row" className="break-words py-3 pr-2 font-normal"><Link href={`/clientes/${encodeURIComponent(cliente.cliente_id)}`} className="font-bold text-azul underline underline-offset-2">{cliente.nombre || t("dashboard.clientes.sinNombre")}</Link></th>
                <td className="py-3 text-right font-bold tabular-nums">{numero(locale).format(cliente.casos)}</td>
              </tr>)}</tbody>
            </table>
            {paginas > 1 && <nav aria-label={t("dashboard.clientes.paginas")} className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <Boton disabled={pagina === 0} onClick={() => setPaginacion({ clave, pagina: pagina - 1 })}>{t("dashboard.clientes.anterior")}</Boton>
              <p className="text-etiqueta" aria-live="polite">{t("dashboard.clientes.pagina", { pagina: numero(locale).format(pagina + 1), paginas: numero(locale).format(paginas) })}</p>
              <Boton disabled={pagina + 1 >= paginas} onClick={() => setPaginacion({ clave, pagina: pagina + 1 })}>{t("dashboard.clientes.siguiente")}</Boton>
            </nav>}
          </>}
          <p className="mt-auto pt-4 text-etiqueta text-tinta-media">{t("dashboard.clientes.notaRanking")}</p>
        </Tarjeta>
      </div>
      <p className="mt-4 text-etiqueta text-tinta-media">{t("dashboard.consultado", { hora: horaDeConsulta(estadisticas.actualizado_en, locale) })}</p>
    </>}
  </div>;
}
