"use client";

import { useEffect, useRef, useState } from "react";
import { useIdioma } from "@/lib/useIdioma";
import { formatoNumero } from "@/lib/formatoNumero";
import { Bar, BarChart, CartesianGrid, LabelList, Rectangle, Tooltip, XAxis, YAxis } from "recharts";
import { useDatos } from "@/lib/datos";
import { presentacion } from "@/lib/inventario";
import { categoriasParaMostrar } from "@/lib/dashboard-inventario";
import { horaDeConsulta, mensajeDeRespuesta } from "@/lib/dashboard";
import { Boton, Cargando, ErrorGeneral, Tarjeta } from "@/componentes/ui";

const numero = (locale) => formatoNumero(locale, { maximumFractionDigits: 6 });
const fecha = (locale) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });
const cantidadConUnidad = (producto, cantidad, locale, t) => `${numero(locale).format(cantidad)} ${presentacion(producto, cantidad, t)}`;

function ListaPedidos({ pedidos }) {
  const { locale, t } = useIdioma();
  function lista(filas) {
    return <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {filas.map((producto) => <li key={producto.id} className="min-w-0 rounded-campo border border-borde p-3 text-etiqueta">
        <p className="break-words font-bold">{producto.nombre}</p>
        {(producto.marca || producto.modelo) && <p className="mt-1 break-words text-tinta-media">{[producto.marca, producto.modelo].filter(Boolean).join(" · ")}</p>}
        <dl className="mt-2">
          <div className="flex flex-wrap justify-between gap-x-3"><dt>{t("dashboard.inventario.porLlegarDt")}</dt><dd className="ml-auto break-words text-right font-bold tabular-nums">{cantidadConUnidad(producto, producto.cantidad, locale, t)}</dd></div>
        </dl>
        {producto.creado_en && <p className="mt-2 text-tinta-media">{t("dashboard.inventario.pedidoEl", { fecha: fecha(locale).format(new Date(producto.creado_en)) })}</p>}
      </li>)}
    </ul>;
  }
  return <>
    {lista(pedidos.slice(0, 3))}
    {pedidos.length > 3 && <details className="mt-3 border-t border-borde pt-2">
      <summary className="min-h-12 cursor-pointer py-3 text-etiqueta font-bold text-azul">{t("dashboard.inventario.verMas", { n: pedidos.length - 3, cantidad: numero(locale).format(pedidos.length - 3) })}</summary>
      {lista(pedidos.slice(3))}
    </details>}
  </>;
}

// El nombre del indicador puede traer un salto de línea ("En mínimo\no por
// debajo"): el eje lo dibuja en dos renglones, y en el resto se lee seguido.
const unaLinea = (texto) => texto.replace("\n", " ");

function EtiquetaIndicador({ x, y, payload }) {
  const lineas = String(payload.value).split("\n");
  return <text x={x - 8} y={y} textAnchor="end" fill="var(--color-tinta-media)" fontSize={12}>
    {lineas.map((linea, i) => <tspan key={linea} x={x - 8} dy={i === 0 ? 4 - (lineas.length - 1) * 7 : 14}>{linea}</tspan>)}
  </text>;
}

function BarraIndicador(props) {
  return <Rectangle {...props} fill={props.payload.color} />;
}

function DetalleIndicador({ active, payload }) {
  const { locale, t } = useIdioma();
  const punto = payload?.[0]?.payload;
  if (!active || !punto) return null;
  return <div className="max-w-64 rounded-campo border border-borde bg-tarjeta p-3 text-etiqueta shadow-sm">
    <p className="font-bold">{unaLinea(punto.nombre)}</p>
    <p className="mt-1">{t(`dashboard.inventario.${punto.unidad}`, { n: punto.cantidad, cantidad: numero(locale).format(punto.cantidad) })}</p>
  </div>;
}

function EtiquetaCategoria({ x, y, payload }) {
  const nombre = String(payload.value);
  return <text x={x - 8} y={y} dy={4} textAnchor="end" fill="var(--color-tinta-media)" fontSize={12}>
    <title>{nombre}</title>{nombre.length > 18 ? `${nombre.slice(0, 17)}…` : nombre}
  </text>;
}

function DetalleCategoria({ active, payload }) {
  const { locale, t } = useIdioma();
  const punto = payload?.[0]?.payload;
  if (!active || !punto) return null;
  return <div className="max-w-64 break-words rounded-campo border border-borde bg-tarjeta p-3 text-etiqueta shadow-sm">
    <p className="font-bold">{punto.categoria}</p>
    <p className="mt-1">{t("dashboard.inventario.registrados", { n: punto.cantidad, cantidad: numero(locale).format(punto.cantidad) })}</p>
  </div>;
}

export default function InventarioDashboard() {
  const { idioma, locale, t } = useIdioma();
  const { negocio, consultarInventarioDashboard } = useDatos();
  const consultar = useRef(consultarInventarioDashboard);
  consultar.current = consultarInventarioDashboard;
  const [intento, setIntento] = useState(0);
  const [respuesta, setRespuesta] = useState(null);
  // El período histórico no interviene: cambiarlo conserva esta consulta.
  const clave = `${negocio.id}:${JSON.stringify(negocio.modulos_activos ?? [])}:${intento}`;
  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const r = await consultar.current();
        if (vigente) setRespuesta({ clave, ...r });
      } catch {
        if (vigente) setRespuesta({ clave, ok: false, fallback: "dashboard.inventario.noPudimos" });
      }
    })();
    return () => { vigente = false; };
  }, [clave]);

  const cargando = respuesta?.clave !== clave;
  const estadisticas = !cargando && respuesta.ok ? respuesta.estadisticas : null;
  const stock = estadisticas?.stock;
  // Las de fábrica salen en el idioma de quien mira y "Filtros" y "Filters" son una sola barra.
  const categorias = stock ? categoriasParaMostrar(stock.por_categoria, { rubro: negocio.rubro, idioma, t }) : [];
  const pedidos = estadisticas?.pedidos_pendientes;
  const indicadores = [
    ...(stock ? [
      { nombre: t("dashboard.inventario.sinStock"), cantidad: stock.sin_stock.total, unidad: "productos", color: "var(--color-rojo)" },
      { nombre: t("dashboard.inventario.enMinimo"), cantidad: stock.en_minimo.total, unidad: "productos", color: "var(--color-espera)" },
    ] : []),
    ...(pedidos ? [{ nombre: t("dashboard.inventario.pendientes"), cantidad: pedidos.total, unidad: "pedidos", color: "var(--color-azul)" }] : []),
  ];

  return <div aria-busy={cargando}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2 id="dashboard-categoria-titulo" className="text-seccion">{t("dashboard.categorias.inventario.nombre")}</h2>
      <Boton disabled={cargando} onClick={() => setIntento((i) => i + 1)}>{t("dashboard.actualizar")}</Boton>
    </div>
    <p className="mb-5 text-tinta-media">{t("dashboard.inventario.situacion")}</p>
    {cargando ? <Cargando filas={5} /> : !respuesta.ok ? <Tarjeta>
      <ErrorGeneral>{mensajeDeRespuesta(respuesta, t)}</ErrorGeneral>
      <Boton onClick={() => setIntento((i) => i + 1)}>{t("dashboard.reintentar")}</Boton>
    </Tarjeta> : <>
      <div className={`mb-6 grid min-w-0 items-stretch gap-6 ${stock ? "xl:grid-cols-2" : ""}`}>
        {stock && <Tarjeta className="min-w-0">
          <figure aria-labelledby="inventario-categorias-titulo" aria-describedby="inventario-categorias-descripcion">
            <h3 id="inventario-categorias-titulo" className="text-subtitulo font-bold">{t("dashboard.inventario.porCategoria")}</h3>
            <figcaption id="inventario-categorias-descripcion" className="mt-2 text-etiqueta text-tinta-media">{t("dashboard.inventario.porCategoriaApoyo")}</figcaption>
            <p className="mt-4 text-2xl font-bold tabular-nums">{t("dashboard.inventario.registrados", { n: stock.total_productos, cantidad: numero(locale).format(stock.total_productos) })}</p>
            {stock.total_productos === 0 ? <p className="mt-4 text-tinta-media">{t("dashboard.inventario.sinProductos")}</p> : <div className="mt-5 min-w-0">
              <BarChart responsive style={{ width: "100%", minWidth: 0 }} height={Math.max(240, categorias.length * 46)} data={categorias} layout="vertical" accessibilityLayer aria-label={t("dashboard.inventario.graficoCategorias")} margin={{ top: 8, right: 32, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="var(--color-borde)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickFormatter={(n) => numero(locale).format(n)} tick={{ fill: "var(--color-tinta-media)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="categoria" width={128} interval={0} tick={<EtiquetaCategoria />} axisLine={false} tickLine={false} />
                <Tooltip content={<DetalleCategoria />} cursor={{ fill: "var(--color-superficie)" }} />
                <Bar dataKey="cantidad" name={t("dashboard.inventario.serieRegistrados")} fill="var(--color-azul)" maxBarSize={28} radius={[0, 5, 5, 0]} isAnimationActive={false}>
                  <LabelList dataKey="cantidad" position="right" fill="var(--color-tinta)" fontSize={13} formatter={(n) => numero(locale).format(n)} />
                </Bar>
              </BarChart>
            </div>}
          </figure>
        </Tarjeta>}
        <Tarjeta className="min-w-0">
          <figure aria-labelledby="inventario-indicadores-titulo" aria-describedby="inventario-indicadores-descripcion">
            <h3 id="inventario-indicadores-titulo" className="text-subtitulo font-bold">{t("dashboard.inventario.indicadores")}</h3>
            <figcaption id="inventario-indicadores-descripcion" className="mt-2 text-etiqueta text-tinta-media">{t("dashboard.inventario.indicadoresApoyo")}</figcaption>
            <div className="mt-5 min-w-0">
              <BarChart responsive style={{ width: "100%", minWidth: 0 }} height={280} data={indicadores} layout="vertical" accessibilityLayer aria-label={t("dashboard.inventario.graficoIndicadores")} margin={{ top: 8, right: 32, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="var(--color-borde)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} domain={[0, "auto"]} tickFormatter={(n) => numero(locale).format(n)} tick={{ fill: "var(--color-tinta-media)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="nombre" width={130} interval={0} tick={<EtiquetaIndicador />} axisLine={false} tickLine={false} />
                <Tooltip content={<DetalleIndicador />} cursor={{ fill: "var(--color-superficie)" }} />
                <Bar dataKey="cantidad" name={t("dashboard.inventario.serieCantidad")} fill="var(--color-azul)" maxBarSize={28} radius={[0, 5, 5, 0]} shape={<BarraIndicador />} isAnimationActive={false}>
                  <LabelList dataKey="cantidad" position="right" fill="var(--color-tinta)" fontSize={13} formatter={(n) => numero(locale).format(n)} />
                </Bar>
              </BarChart>
            </div>
          </figure>
        </Tarjeta>
      </div>
      {!stock && <p className="mb-6 text-etiqueta text-tinta-media">{t("dashboard.inventario.stockApagado")}</p>}
      {pedidos ? <Tarjeta>
        <h3 className="text-subtitulo font-bold">{t("dashboard.inventario.porLlegar")}</h3>
        <p className="mb-4 mt-2 text-etiqueta text-tinta-media">{t("dashboard.inventario.porLlegarApoyo")}</p>
        {pedidos.total ? <ListaPedidos pedidos={pedidos.pedidos} /> : <p className="text-tinta-media">{t("dashboard.inventario.sinPedidos")}</p>}
      </Tarjeta> : <p className="text-etiqueta text-tinta-media">{t("dashboard.inventario.enCaminoApagado")}</p>}
      <p className="mt-4 text-etiqueta text-tinta-media">{t("dashboard.consultadoEl", { fecha: fecha(locale).format(new Date(estadisticas.actualizado_en)), hora: horaDeConsulta(estadisticas.actualizado_en, locale) })}</p>
    </>}
  </div>;
}
