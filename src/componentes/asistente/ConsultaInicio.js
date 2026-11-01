"use client";

import { useState } from "react";
import Link from "next/link";
import { consultarInicio } from "@/lib/asistente";
import { Boton, Campo } from "@/componentes/ui";
import PanelAsistente from "./Panel";

export default function ConsultaInicio({ datos, t }) {
  const [consulta, setConsulta] = useState("");
  const [resultado, setResultado] = useState(null);
  const ejemplos = ["hoy", "esperando", "stock", "turnos", "carga"];
  const buscar = (valor = consulta) => { setConsulta(valor); setResultado(consultarInicio(valor, datos, t)); };
  return <PanelAsistente titulo={t("asistente.inicio.titulo")} apoyo={t("asistente.inicio.apoyo")} t={t} className="mb-6">
    <div className="flex flex-wrap items-end gap-2"><div className="min-w-0 flex-1"><Campo id="consulta-negocio" etiqueta={t("asistente.inicio.consulta")} value={consulta} onChange={(e) => setConsulta(e.target.value)} /></div><Boton variante="borde" onClick={() => buscar()}>{t("asistente.inicio.buscar")}</Boton></div>
    <div className="mt-2 flex flex-wrap gap-2">{ejemplos.map((e) => <button type="button" key={e} onClick={() => buscar(t(`asistente.inicio.ejemplos.${e}`))} className="min-h-10 rounded-full border border-borde px-3 text-etiqueta text-azul hover:bg-azul-claro">{t(`asistente.inicio.ejemplos.${e}`)}</button>)}</div>
    {resultado && <div className="mt-4" aria-live="polite"><p>{resultado.explicacion}</p>{resultado.propuesta?.criterio && <p className="mt-1 text-apoyo text-tinta-suave">{t("asistente.inicio.criterio", { criterio: resultado.propuesta.criterio })}</p>}{!!resultado.propuesta?.items.length && <ul className="mt-3 divide-y divide-borde rounded-campo border border-borde">{resultado.propuesta.items.map((item, i) => <li key={`${item.href}-${i}`}><Link href={item.href} className="block min-h-12 p-3 hover:bg-superficie"><strong className="text-azul">{item.titulo}</strong>{item.detalle && <span className="ml-2 text-tinta-media">{item.detalle}</span>}</Link></li>)}</ul>}</div>}
  </PanelAsistente>;
}

