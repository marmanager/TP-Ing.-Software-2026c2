"use client";

import { useEffect, useRef, useState } from "react";
import { useIdioma } from "@/lib/useIdioma";
import { formatoNumero } from "@/lib/formatoNumero";
import { useDatos } from "@/lib/datos";
import { hijosActivos } from "@/lib/modulos";
import { destinoDashboard } from "@/lib/dashboard";
import Icono from "@/componentes/Icono";
import { Boton, Cargando, ErrorGeneral, Tarjeta } from "@/componentes/ui";

const numero = (locale) => formatoNumero(locale);
const pesos = (locale) => formatoNumero(locale, { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

export default function ResumenDashboard({ periodo }) {
  const { locale } = useIdioma();
  const { negocio, consultarResumenDashboard } = useDatos();
  const consultar = useRef(consultarResumenDashboard);
  consultar.current = consultarResumenDashboard;
  const [intento, setIntento] = useState(0);
  const [respuesta, setRespuesta] = useState(null);
  const activos = negocio.modulos_activos ?? [];
  const clave = `${negocio.id}:${JSON.stringify(activos)}:${periodo.desde}:${periodo.hasta}:${intento}`;

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
    { clave: "total_cobrado", categoria: "cobros", nombre: "Total cobrado", icono: "nota", unidad: "Pesos argentinos (ARS)", periodo: true,
      detalle: "Suma de los cobros pagados, según la fecha del pago." },
    { clave: "clientes_nuevos", categoria: "clientes", nombre: "Clientes nuevos", icono: "persona", unidad: "Clientes registrados", periodo: true,
      detalle: "Altas registradas en el período; cada cliente se cuenta una vez." },
    { clave: "casos_abiertos", categoria: "casos", nombre: "Casos abiertos", icono: "carpeta", unidad: "Casos", periodo: false,
      detalle: "Todos los casos que todavía no se completaron." },
    { clave: "productos_reponer", categoria: "inventario", soloStock: true, nombre: "Productos para reponer", icono: "cajas", unidad: "Productos", periodo: false,
      detalle: "Productos en stock con cantidad menor o igual al mínimo." },
  ].filter((t) => resumen[t.clave] != null && destinoDashboard(t.categoria, activos) &&
    (!t.soloStock || hijosActivos("inventario", activos).some((h) => h.clave === "stock"))) : [];

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
          <div className="grid min-w-0 auto-rows-fr gap-4 xl:grid-cols-2">
            {tarjetas.map((t) => (
              <Tarjeta key={t.clave} className="flex flex-col">
                <div className="flex items-center gap-2 text-tinta-media">
                  <Icono nombre={t.icono} className="size-6 shrink-0 text-azul" />
                  <h3 className="font-bold text-cuerpo">{t.nombre}</h3>
                </div>
                <p className="mt-4 break-words text-3xl font-bold tabular-nums sm:text-4xl">
                  {t.clave === "total_cobrado" ? pesos(locale).format(resumen[t.clave]) : numero(locale).format(resumen[t.clave])}
                </p>
                <p className="mt-1 text-etiqueta text-tinta-media">{t.unidad}</p>
                <p className="mt-4 font-bold text-etiqueta text-azul">{t.periodo ? "En el período seleccionado" : "Situación actual"}</p>
                <p className="mt-3 text-etiqueta text-tinta-media">{t.detalle}</p>
              </Tarjeta>
            ))}
          </div>
          <p className="mt-4 text-etiqueta text-tinta-media">
            Consultado a las {new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(resumen.actualizado_en))} (Argentina).
          </p>
        </>
      )}
    </div>
  );
}
