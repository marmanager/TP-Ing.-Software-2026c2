"use client";

import { useState } from "react";
import { asistirCaso } from "@/lib/asistente";
import { Boton, Campo } from "@/componentes/ui";
import PanelAsistente from "./Panel";

export default function AsistenciaCaso({ contexto, t }) {
  const [accion, setAccion] = useState(null);
  const [nota, setNota] = useState("");
  const [resultado, setResultado] = useState(null);
  const [borrador, setBorrador] = useState("");
  const ejecutar = (nueva) => {
    setAccion(nueva);
    const r = asistirCaso(nueva, { ...contexto, nota }, t);
    setResultado(r);
    setBorrador(r.propuesta?.texto ?? "");
  };
  return <PanelAsistente titulo={t("asistente.caso.titulo")} apoyo={t("asistente.caso.apoyo")} t={t} className="mt-8">
    <div className="flex flex-wrap gap-2">
      {["resumen", "falta", "proximo", "mensaje", "nota", "respuesta"].map((clave) => <Boton key={clave} variante={accion === clave ? "borde" : "plano"} onClick={() => ejecutar(clave)}>{t(`asistente.caso.${clave}`)}</Boton>)}
    </div>
    {accion === "nota" && <div className="mt-4"><Campo id="asistente-nota-caso" etiqueta={t("asistente.caso.notaEtiqueta")}><textarea id="asistente-nota-caso" className="mt-2 min-h-24 w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta p-3" value={nota} onChange={(e) => setNota(e.target.value)} /></Campo><Boton variante="borde" onClick={() => ejecutar("nota")}>{t("asistente.analizar")}</Boton></div>}
    {resultado && <div className="mt-5 rounded-campo bg-superficie p-4" aria-live="polite">
      <p className="text-tinta-media">{resultado.explicacion}</p>
      {borrador && <><label htmlFor="asistente-borrador-caso" className="mt-3 block font-bold">{t("asistente.caso.editarBorrador")}</label><textarea id="asistente-borrador-caso" className="mt-2 min-h-28 w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta p-3" value={borrador} onChange={(e) => setBorrador(e.target.value)} /></>}
      {Array.isArray(resultado.propuesta) && <ul className="mt-3 space-y-2">{resultado.propuesta.map((p) => <li key={p.id} className="rounded-campo border border-borde bg-tarjeta p-3"><strong>{p.nombre}</strong>{p.monto != null && <span> · ${p.monto}</span>}</li>)}</ul>}
      {resultado.propuesta?.clasificacion && <><p className="mt-3 font-bold">{resultado.propuesta.clasificacion}</p><blockquote className="mt-2 border-l-4 border-borde pl-3 text-tinta-media">{resultado.propuesta.texto}</blockquote></>}
      <p className="mt-3 text-apoyo text-tinta-suave">{t("asistente.caso.avisoNoGuarda")}</p>
    </div>}
  </PanelAsistente>;
}

