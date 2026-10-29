"use client";

import { useEffect, useRef, useState } from "react";
import { useIdioma } from "@/lib/useIdioma";
import { formatoNumero } from "@/lib/formatoNumero";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, Rectangle, Tooltip, XAxis, YAxis } from "recharts";
import { useDatos } from "@/lib/datos";
import { serieActividadCasos } from "@/lib/dashboard-casos";
import { horaDeConsulta, mensajeDeRespuesta, nombreDeAgrupacion } from "@/lib/dashboard";
import { etiquetaEstado } from "@/lib/presets";
import { Boton, Cargando, ErrorGeneral, Tarjeta } from "@/componentes/ui";

const numero = (locale) => formatoNumero(locale);
const colores = {
  nuevo: "var(--color-nuevo)", en_proceso: "var(--color-proceso)", esperando: "var(--color-espera)",
  revision_final: "var(--color-revision)", completado: "var(--color-completo)",
};

function DetalleGrafico({ active, payload }) {
  const { locale } = useIdioma();
  const punto = payload?.[0]?.payload;
  if (!active || !punto) return null;
  return (
    <div className="max-w-64 rounded-campo border border-borde bg-tarjeta p-3 text-etiqueta shadow-sm">
      <p className="font-bold">{punto.detalle}</p>
      <ul className="mt-2 space-y-1">
        {payload.map((serie) => <li key={serie.dataKey} className="flex items-center gap-2">
          <span aria-hidden="true" className="w-5 shrink-0 border-t-2" style={{ borderColor: colores[punto.estado] ?? serie.color, borderTopStyle: serie.dataKey === "cerrados" ? "dashed" : "solid" }} />
          <span>{serie.name}: <strong>{numero(locale).format(serie.value)}</strong></span>
        </li>)}
      </ul>
    </div>
  );
}

function BarraEstado(props) {
  return <Rectangle {...props} fill={colores[props.payload?.estado] ?? "var(--color-tinta-suave)"} />;
}

export default function CasosDashboard({ periodo }) {
  const { idioma, locale, t } = useIdioma();
  const { negocio, consultarCasosDashboard } = useDatos();
  const consultar = useRef(consultarCasosDashboard);
  consultar.current = consultarCasosDashboard;
  const [intento, setIntento] = useState(0);
  const [respuesta, setRespuesta] = useState(null);
  const clave = `${negocio.id}:${periodo.desde}:${periodo.hasta}:${intento}`;

  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const r = await consultar.current({ desde: periodo.desde, hasta: periodo.hasta });
        if (vigente) setRespuesta({ clave, ...r });
      } catch {
        if (vigente) setRespuesta({ clave, ok: false, fallback: "dashboard.casos.noPudimos" });
      }
    })();
    return () => { vigente = false; };
  }, [clave, periodo.desde, periodo.hasta]);

  const cargando = respuesta?.clave !== clave;
  const estadisticas = !cargando && respuesta.ok ? respuesta.estadisticas : null;
  const serie = estadisticas ? serieActividadCasos(periodo, estadisticas.nuevos.por_dia, estadisticas.cerrados.por_dia, locale, t) : null;
  const estados = estadisticas?.distribucion_actual.por_estado.map((fila) => {
    const etiqueta = fila.estado === "sin_estado" ? t("dashboard.casos.sinEstado") : etiquetaEstado(negocio.rubro, fila.estado, idioma);
    return { ...fila, etiqueta, detalle: etiqueta };
  });

  return (
    <div aria-busy={cargando}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="dashboard-categoria-titulo" className="text-seccion">{t("dashboard.categorias.casos.nombre")}</h2>
        <Boton disabled={cargando} onClick={() => setIntento((i) => i + 1)}>{t("dashboard.actualizar")}</Boton>
      </div>
      {cargando ? <Cargando filas={4} /> : !respuesta.ok ? (
        <Tarjeta>
          <ErrorGeneral>{mensajeDeRespuesta(respuesta, t)}</ErrorGeneral>
          <Boton onClick={() => setIntento((i) => i + 1)}>{t("dashboard.reintentar")}</Boton>
        </Tarjeta>
      ) : (
        <>
          <div className="grid min-w-0 items-stretch gap-6 xl:grid-cols-2">
            <Tarjeta className="min-w-0">
              <figure aria-labelledby="casos-actividad-titulo" aria-describedby="casos-actividad-descripcion">
                <h3 id="casos-actividad-titulo" className="text-subtitulo font-bold">{t("dashboard.casos.actividad")}</h3>
                <figcaption id="casos-actividad-descripcion" className="mt-2 text-etiqueta text-tinta-media">
                  {t("dashboard.casos.agrupados", { agrupacion: nombreDeAgrupacion(serie.agrupacion, t) })}
                </figcaption>
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-subtitulo font-bold tabular-nums">
                  <p>{t("dashboard.casos.nuevos", { n: estadisticas.nuevos.total, cantidad: numero(locale).format(estadisticas.nuevos.total) })}</p>
                  <p>{t("dashboard.casos.cierres", { n: estadisticas.cerrados.total, cantidad: numero(locale).format(estadisticas.cerrados.total) })}</p>
                </div>
                {estadisticas.nuevos.total === 0 && <p className="mt-2 text-tinta-media">{t("dashboard.casos.sinAperturas")}</p>}
                <div className="mt-5 min-w-0">
                  <LineChart responsive style={{ width: "100%", minWidth: 0 }} height={280} data={serie.puntos}
                    accessibilityLayer aria-label={t("dashboard.casos.graficoActividad")} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke="var(--color-borde)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="etiqueta" tick={{ fill: "var(--color-tinta-media)", fontSize: 13 }} minTickGap={30} tickMargin={10} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(n) => numero(locale).format(n)} allowDecimals={false} width={40} domain={[0, "auto"]} tick={{ fill: "var(--color-tinta-media)", fontSize: 13 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<DetalleGrafico />} />
                    <Legend verticalAlign="top" height={40} iconSize={16} wrapperStyle={{ fontSize: 14 }} />
                    <Line dataKey="cantidad" name={t("dashboard.casos.serieNuevos")} type="linear" stroke="var(--color-azul)" strokeWidth={3}
                      dot={serie.puntos.length <= 31 ? { r: 3, fill: "var(--color-azul)" } : false} activeDot={{ r: 6 }} isAnimationActive={false} />
                    <Line dataKey="cerrados" name={t("dashboard.casos.serieCierres")} type="linear" stroke="var(--color-completo)" strokeWidth={3} strokeDasharray="6 4"
                      dot={serie.puntos.length <= 31 ? { r: 3, fill: "var(--color-completo)", strokeDasharray: "none" } : false} activeDot={{ r: 6, strokeDasharray: "none" }} isAnimationActive={false} />
                  </LineChart>
                </div>
              </figure>
              <p className="mt-3 text-etiqueta text-tinta-media">{t("dashboard.casos.notaActividad")}</p>
            </Tarjeta>

            <Tarjeta className="min-w-0">
              <figure aria-labelledby="casos-estados-titulo" aria-describedby="casos-estados-descripcion">
                <h3 id="casos-estados-titulo" className="text-subtitulo font-bold">{t("dashboard.casos.distribucion")}</h3>
                <figcaption id="casos-estados-descripcion" className="mt-2 text-etiqueta text-tinta-media">
                  {t("dashboard.casos.distribucionApoyo")}
                </figcaption>
                <p className="mt-4 text-2xl font-bold tabular-nums">{t("dashboard.casos.total", { n: estadisticas.distribucion_actual.total, cantidad: numero(locale).format(estadisticas.distribucion_actual.total) })}</p>
                {estadisticas.distribucion_actual.total === 0 && <p className="mt-2 text-tinta-media">{t("dashboard.casos.sinCasos")}</p>}
                <div className="mt-5 min-w-0">
                  <BarChart responsive style={{ width: "100%", minWidth: 0 }} height={Math.max(300, estados.length * 60)}
                    data={estados} layout="vertical" accessibilityLayer aria-label={t("dashboard.casos.graficoEstados")}
                    margin={{ top: 8, right: 40, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke="var(--color-borde)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={(n) => numero(locale).format(n)} allowDecimals={false} tick={{ fill: "var(--color-tinta-media)", fontSize: 13 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="etiqueta" width={130} interval={0} tick={{ fill: "var(--color-tinta-media)", fontSize: 13 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<DetalleGrafico />} cursor={{ fill: "var(--color-superficie)" }} />
                    <Bar dataKey="cantidad" name={t("dashboard.casos.serieCasos")} fill="var(--color-azul)" maxBarSize={28} radius={[0, 5, 5, 0]} shape={<BarraEstado />} isAnimationActive={false}>
                      <LabelList dataKey="cantidad" position="right" fill="var(--color-tinta)" fontSize={14} formatter={(n) => numero(locale).format(n)} />
                    </Bar>
                  </BarChart>
                </div>
              </figure>
            </Tarjeta>
          </div>
          <p className="mt-4 text-etiqueta text-tinta-media">
            {t("dashboard.consultado", { hora: horaDeConsulta(estadisticas.actualizado_en, locale) })}
          </p>
        </>
      )}
    </div>
  );
}
