"use client";

import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, Rectangle, Tooltip, XAxis, YAxis } from "recharts";
import { useDatos } from "@/lib/datos";
import { presentacion } from "@/lib/inventario";
import { Boton, Cargando, ErrorGeneral, Tarjeta } from "@/componentes/ui";

const numero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 6 });
const fecha = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });
const cantidadConUnidad = (producto, cantidad) => `${numero.format(cantidad)} ${producto.unidad === "caja" && !producto.por_caja ? (cantidad === 1 ? "caja" : "cajas") : presentacion(producto, cantidad)}`;

function ListaPedidos({ pedidos }) {
  function lista(filas) {
    return <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {filas.map((producto) => <li key={producto.id} className="min-w-0 rounded-campo border border-borde p-3 text-etiqueta">
        <p className="break-words font-bold">{producto.nombre}</p>
        {(producto.marca || producto.modelo) && <p className="mt-1 break-words text-tinta-media">{[producto.marca, producto.modelo].filter(Boolean).join(" · ")}</p>}
        <dl className="mt-2">
          <div className="flex flex-wrap justify-between gap-x-3"><dt>Por llegar</dt><dd className="ml-auto break-words text-right font-bold tabular-nums">{cantidadConUnidad(producto, producto.cantidad)}</dd></div>
        </dl>
        {producto.creado_en && <p className="mt-2 text-tinta-media">Pedido el {fecha.format(new Date(producto.creado_en))}</p>}
      </li>)}
    </ul>;
  }
  return <>
    {lista(pedidos.slice(0, 3))}
    {pedidos.length > 3 && <details className="mt-3 border-t border-borde pt-2">
      <summary className="min-h-12 cursor-pointer py-3 text-etiqueta font-bold text-azul">Ver {numero.format(pedidos.length - 3)} {pedidos.length === 4 ? "pedido más" : "pedidos más"}</summary>
      {lista(pedidos.slice(3))}
    </details>}
  </>;
}

const etiquetasIndicadores = {
  "Sin stock": ["Sin stock"],
  "En mínimo o por debajo": ["En mínimo", "o por debajo"],
  "Pedidos pendientes de llegada": ["Pedidos pendientes", "de llegada"],
};

function EtiquetaIndicador({ x, y, payload }) {
  const lineas = etiquetasIndicadores[payload.value] ?? [payload.value];
  return <text x={x - 8} y={y} textAnchor="end" fill="var(--color-tinta-media)" fontSize={12}>
    {lineas.map((linea, i) => <tspan key={linea} x={x - 8} dy={i === 0 ? 4 - (lineas.length - 1) * 7 : 14}>{linea}</tspan>)}
  </text>;
}

function BarraIndicador(props) {
  return <Rectangle {...props} fill={props.payload.color} />;
}

function DetalleIndicador({ active, payload }) {
  const punto = payload?.[0]?.payload;
  if (!active || !punto) return null;
  return <div className="max-w-64 rounded-campo border border-borde bg-tarjeta p-3 text-etiqueta shadow-sm">
    <p className="font-bold">{punto.nombre}</p>
    <p className="mt-1">{numero.format(punto.cantidad)} {punto.unidad}{punto.cantidad === 1 ? "" : "s"}</p>
  </div>;
}

function EtiquetaCategoria({ x, y, payload }) {
  const nombre = String(payload.value);
  return <text x={x - 8} y={y} dy={4} textAnchor="end" fill="var(--color-tinta-media)" fontSize={12}>
    <title>{nombre}</title>{nombre.length > 18 ? `${nombre.slice(0, 17)}…` : nombre}
  </text>;
}

function DetalleCategoria({ active, payload }) {
  const punto = payload?.[0]?.payload;
  if (!active || !punto) return null;
  return <div className="max-w-64 break-words rounded-campo border border-borde bg-tarjeta p-3 text-etiqueta shadow-sm">
    <p className="font-bold">{punto.categoria}</p>
    <p className="mt-1">{numero.format(punto.cantidad)} {punto.cantidad === 1 ? "producto registrado" : "productos registrados"}</p>
  </div>;
}

export default function InventarioDashboard() {
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
        if (vigente) setRespuesta({ clave, ok: false, error: "No pudimos consultar las estadísticas de Inventario. Volvé a intentarlo." });
      }
    })();
    return () => { vigente = false; };
  }, [clave]);

  const cargando = respuesta?.clave !== clave;
  const estadisticas = !cargando && respuesta.ok ? respuesta.estadisticas : null;
  const stock = estadisticas?.stock;
  const pedidos = estadisticas?.pedidos_pendientes;
  const indicadores = [
    ...(stock ? [
      { nombre: "Sin stock", cantidad: stock.sin_stock.total, unidad: "producto", color: "var(--color-rojo)" },
      { nombre: "En mínimo o por debajo", cantidad: stock.en_minimo.total, unidad: "producto", color: "var(--color-espera)" },
    ] : []),
    ...(pedidos ? [{ nombre: "Pedidos pendientes de llegada", cantidad: pedidos.total, unidad: "pedido", color: "var(--color-azul)" }] : []),
  ];

  return <div aria-busy={cargando}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2 id="dashboard-categoria-titulo" className="text-seccion">Inventario</h2>
      <Boton disabled={cargando} onClick={() => setIntento((i) => i + 1)}>Actualizar</Boton>
    </div>
    <p className="mb-5 text-tinta-media">Situación actual. Estos valores no dependen del período seleccionado para los indicadores históricos.</p>
    {cargando ? <Cargando filas={5} /> : !respuesta.ok ? <Tarjeta>
      <ErrorGeneral>{respuesta.error}</ErrorGeneral>
      <Boton onClick={() => setIntento((i) => i + 1)}>Reintentar</Boton>
    </Tarjeta> : <>
      <div className={`mb-6 grid min-w-0 items-stretch gap-6 ${stock ? "xl:grid-cols-2" : ""}`}>
        {stock && <Tarjeta className="min-w-0">
          <figure aria-labelledby="inventario-categorias-titulo" aria-describedby="inventario-categorias-descripcion">
            <h3 id="inventario-categorias-titulo" className="text-subtitulo font-bold">Productos por categoría</h3>
            <figcaption id="inventario-categorias-descripcion" className="mt-2 text-etiqueta text-tinta-media">Catálogo actual de En stock, incluidos los productos con cantidad cero. Los pedidos se cuentan aparte. Unidad: productos registrados.</figcaption>
            <p className="mt-4 text-2xl font-bold tabular-nums">{numero.format(stock.total_productos)} {stock.total_productos === 1 ? "producto registrado" : "productos registrados"}</p>
            {stock.total_productos === 0 ? <p className="mt-4 text-tinta-media">Todavía no hay productos registrados en el stock.</p> : <div className="mt-5 min-w-0">
              <BarChart responsive style={{ width: "100%", minWidth: 0 }} height={Math.max(240, stock.por_categoria.length * 46)} data={stock.por_categoria} layout="vertical" accessibilityLayer aria-label="Cantidad actual de productos registrados por categoría" margin={{ top: 8, right: 32, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="var(--color-borde)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickFormatter={(n) => numero.format(n)} tick={{ fill: "var(--color-tinta-media)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="categoria" width={128} interval={0} tick={<EtiquetaCategoria />} axisLine={false} tickLine={false} />
                <Tooltip content={<DetalleCategoria />} cursor={{ fill: "var(--color-superficie)" }} />
                <Bar dataKey="cantidad" name="Productos registrados" fill="var(--color-azul)" maxBarSize={28} radius={[0, 5, 5, 0]} isAnimationActive={false}>
                  <LabelList dataKey="cantidad" position="right" fill="var(--color-tinta)" fontSize={13} formatter={(n) => numero.format(n)} />
                </Bar>
              </BarChart>
            </div>}
          </figure>
        </Tarjeta>}
        <Tarjeta className="min-w-0">
          <figure aria-labelledby="inventario-indicadores-titulo" aria-describedby="inventario-indicadores-descripcion">
            <h3 id="inventario-indicadores-titulo" className="text-subtitulo font-bold">Stock y pedidos pendientes</h3>
            <figcaption id="inventario-indicadores-descripcion" className="mt-2 text-etiqueta text-tinta-media">Situación actual. Sin stock y en mínimo cuentan productos; los pendientes cuentan pedidos. No se suman cantidades de distintas unidades.</figcaption>
            <div className="mt-5 min-w-0">
              <BarChart responsive style={{ width: "100%", minWidth: 0 }} height={280} data={indicadores} layout="vertical" accessibilityLayer aria-label="Cantidad actual de productos sin stock, en mínimo y pedidos pendientes" margin={{ top: 8, right: 32, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="var(--color-borde)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} domain={[0, "auto"]} tickFormatter={(n) => numero.format(n)} tick={{ fill: "var(--color-tinta-media)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="nombre" width={130} interval={0} tick={<EtiquetaIndicador />} axisLine={false} tickLine={false} />
                <Tooltip content={<DetalleIndicador />} cursor={{ fill: "var(--color-superficie)" }} />
                <Bar dataKey="cantidad" name="Cantidad" fill="var(--color-azul)" maxBarSize={28} radius={[0, 5, 5, 0]} shape={<BarraIndicador />} isAnimationActive={false}>
                  <LabelList dataKey="cantidad" position="right" fill="var(--color-tinta)" fontSize={13} formatter={(n) => numero.format(n)} />
                </Bar>
              </BarChart>
            </div>
          </figure>
        </Tarjeta>
      </div>
      {!stock && <p className="mb-6 text-etiqueta text-tinta-media">En stock está apagado para este negocio.</p>}
      {pedidos ? <Tarjeta>
        <h3 className="text-subtitulo font-bold">Pedidos por llegar</h3>
        <p className="mb-4 mt-2 text-etiqueta text-tinta-media">Pedidos pendientes de llegada, del más antiguo al más reciente. Cada cantidad conserva su unidad.</p>
        {pedidos.total ? <ListaPedidos pedidos={pedidos.pedidos} /> : <p className="text-tinta-media">No hay pedidos pendientes de llegada.</p>}
      </Tarjeta> : <p className="text-etiqueta text-tinta-media">En camino está apagado para este negocio.</p>}
      <p className="mt-4 text-etiqueta text-tinta-media">Consultado el {fecha.format(new Date(estadisticas.actualizado_en))} a las {new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(estadisticas.actualizado_en))} (Argentina).</p>
    </>}
  </div>;
}
