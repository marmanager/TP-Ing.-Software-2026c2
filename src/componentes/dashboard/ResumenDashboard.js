"use client";

import { useEffect, useRef, useState } from "react";
import { useDatos } from "@/lib/datos";
import { textoPeriodo } from "@/lib/dashboard";
import Icono from "@/componentes/Icono";
import { Boton, Cargando, ErrorGeneral, Tarjeta } from "@/componentes/ui";

const numero = new Intl.NumberFormat("es-AR");
const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

export default function ResumenDashboard({ periodo }) {
  const { negocio, consultarResumenDashboard } = useDatos();
  const consultar = useRef(consultarResumenDashboard);
  consultar.current = consultarResumenDashboard;
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
        if (vigente) setRespuesta({ clave, ok: false, error: "No pudimos consultar el Resumen. Volvé a intentarlo." });
      }
    })();
    return () => { vigente = false; };
  }, [clave, periodo.desde, periodo.hasta]);

  const cargando = respuesta?.clave !== clave;
  const resumen = !cargando && respuesta?.ok ? respuesta.resumen : null;
  const tarjetas = resumen ? [
    { clave: "total_cobrado", nombre: "Total cobrado", icono: "nota", unidad: "Pesos argentinos (ARS)", periodo: true,
      detalle: "Suma de los cobros pagados, según la fecha del pago." },
    { clave: "clientes_nuevos", nombre: "Clientes nuevos", icono: "persona", unidad: "Clientes registrados", periodo: true,
      detalle: "Altas registradas en el período; cada cliente se cuenta una vez." },
    { clave: "casos_abiertos", nombre: "Casos abiertos", icono: "carpeta", unidad: "Casos", periodo: false,
      detalle: "Todos los casos que todavía no se completaron." },
    { clave: "productos_reponer", nombre: "Productos para reponer", icono: "cajas", unidad: "Productos", periodo: false,
      detalle: "Productos en stock con cantidad menor o igual al mínimo." },
  ].filter((t) => resumen[t.clave] != null) : [];

  return (
    <div aria-busy={cargando}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="dashboard-categoria-titulo" className="text-seccion">Resumen</h2>
        <Boton disabled={cargando} onClick={() => setIntento((i) => i + 1)}>Actualizar</Boton>
      </div>
      {cargando ? <Cargando filas={4} /> : !respuesta.ok ? (
        <Tarjeta>
          <ErrorGeneral>{respuesta.error}</ErrorGeneral>
          <Boton onClick={() => setIntento((i) => i + 1)}>Reintentar</Boton>
        </Tarjeta>
      ) : (
        <>
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            {tarjetas.map((t) => (
              <Tarjeta key={t.clave}>
                <div className="flex items-center gap-2 text-tinta-media">
                  <Icono nombre={t.icono} className="size-6 shrink-0 text-azul" />
                  <h3 className="font-bold text-cuerpo">{t.nombre}</h3>
                </div>
                <p className="mt-4 break-words text-3xl font-bold tabular-nums sm:text-4xl">
                  {t.clave === "total_cobrado" ? pesos.format(resumen[t.clave]) : numero.format(resumen[t.clave])}
                </p>
                <p className="mt-1 text-etiqueta text-tinta-media">{t.unidad}</p>
                <p className="mt-4 font-bold text-etiqueta text-azul">{t.periodo ? "En el período seleccionado" : "Situación actual"}</p>
                <p className="mt-1 text-etiqueta text-tinta-media">{t.periodo ? textoPeriodo(periodo) : "Incluye todos los períodos"}</p>
                <p className="mt-3 text-etiqueta text-tinta-media">{t.detalle}</p>
              </Tarjeta>
            ))}
          </div>
          <p className="mt-4 text-etiqueta text-tinta-media">
            Consultado a las {new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(resumen.actualizado_en))} (Argentina).
          </p>
        </>
      )}
    </div>
  );
}
