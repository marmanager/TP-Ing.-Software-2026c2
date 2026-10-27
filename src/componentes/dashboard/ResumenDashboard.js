"use client";

import { useEffect, useRef, useState } from "react";
import { useIdioma } from "@/lib/useIdioma";
import { formatoNumero } from "@/lib/formatoNumero";
import { useDatos } from "@/lib/datos";
import { hijosActivos } from "@/lib/modulos";
import { destinoDashboard, horaDeConsulta, mensajeDeRespuesta } from "@/lib/dashboard";
import Icono from "@/componentes/Icono";
import { Boton, Cargando, ErrorGeneral, Tarjeta } from "@/componentes/ui";

const numero = (locale) => formatoNumero(locale);
const pesos = (locale) => formatoNumero(locale, { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

export default function ResumenDashboard({ periodo }) {
  const { locale, t } = useIdioma();
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
        if (vigente) setRespuesta({ clave, ok: false, fallback: "dashboard.resumen.noPudimos" });
      }
    })();
    return () => { vigente = false; };
  }, [clave, periodo.desde, periodo.hasta]);

  const cargando = respuesta?.clave !== clave;
  const resumen = !cargando && respuesta?.ok ? respuesta.resumen : null;
  const tarjetas = resumen ? [
    { clave: "total_cobrado", categoria: "cobros", icono: "nota", periodo: true },
    { clave: "clientes_nuevos", categoria: "clientes", icono: "persona", periodo: true },
    { clave: "casos_abiertos", categoria: "casos", icono: "carpeta", periodo: false },
    { clave: "productos_reponer", categoria: "inventario", soloStock: true, icono: "cajas", periodo: false },
  ].filter((tarjeta) => resumen[tarjeta.clave] != null && destinoDashboard(tarjeta.categoria, activos) &&
    (!tarjeta.soloStock || hijosActivos("inventario", activos).some((h) => h.clave === "stock"))) : [];

  return (
    <div aria-busy={cargando}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="dashboard-categoria-titulo" className="text-seccion">{t("dashboard.categorias.resumen.nombre")}</h2>
        <Boton disabled={cargando} onClick={() => setIntento((i) => i + 1)}>{t("dashboard.actualizar")}</Boton>
      </div>
      {cargando ? <Cargando filas={4} /> : !respuesta.ok ? (
        <Tarjeta>
          <ErrorGeneral>{mensajeDeRespuesta(respuesta, t)}</ErrorGeneral>
          <Boton onClick={() => setIntento((i) => i + 1)}>{t("dashboard.reintentar")}</Boton>
        </Tarjeta>
      ) : (
        <>
          <div className="grid min-w-0 auto-rows-fr gap-4 xl:grid-cols-2">
            {tarjetas.map((tarjeta) => (
              <Tarjeta key={tarjeta.clave} className="flex flex-col">
                <div className="flex items-center gap-2 text-tinta-media">
                  <Icono nombre={tarjeta.icono} className="size-6 shrink-0 text-azul" />
                  <h3 className="font-bold text-cuerpo">{t(`dashboard.resumen.${tarjeta.clave}.nombre`)}</h3>
                </div>
                <p className="mt-4 break-words text-3xl font-bold tabular-nums sm:text-4xl">
                  {tarjeta.clave === "total_cobrado" ? pesos(locale).format(resumen[tarjeta.clave]) : numero(locale).format(resumen[tarjeta.clave])}
                </p>
                <p className="mt-1 text-etiqueta text-tinta-media">{t(`dashboard.resumen.${tarjeta.clave}.unidad`)}</p>
                <p className="mt-4 font-bold text-etiqueta text-azul">{tarjeta.periodo ? t("dashboard.resumen.enPeriodo") : t("dashboard.resumen.actual")}</p>
                <p className="mt-3 text-etiqueta text-tinta-media">{t(`dashboard.resumen.${tarjeta.clave}.detalle`)}</p>
              </Tarjeta>
            ))}
          </div>
          <p className="mt-4 text-etiqueta text-tinta-media">
            {t("dashboard.consultado", { hora: horaDeConsulta(resumen.actualizado_en, locale) })}
          </p>
        </>
      )}
    </div>
  );
}
