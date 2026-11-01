"use client";

import { useState } from "react";
import { prepararAccion } from "@/lib/asistente";
import { Boton, Campo } from "@/componentes/ui";
import PanelAsistente from "./Panel";

export default function PrepararAccion({ tipo, t, alUsar }) {
  const [abierto, setAbierto] = useState(false);
  const [frase, setFrase] = useState("");
  const [resultado, setResultado] = useState(null);
  if (!abierto) return <Boton variante="plano" onClick={() => setAbierto(true)}>{t(tipo === "agenda" ? "asistente.acciones.agendaTitulo" : "asistente.acciones.inventarioTitulo")}</Boton>;
  return <PanelAsistente titulo={t(tipo === "agenda" ? "asistente.acciones.agendaTitulo" : "asistente.acciones.inventarioTitulo")} apoyo={t("asistente.acciones.apoyo")} t={t} className="mb-8">
    <Campo id={`accion-${tipo}`} etiqueta={t("asistente.acciones.frase")} ayuda={t(tipo === "agenda" ? "asistente.acciones.agendaEjemplo" : "asistente.acciones.inventarioEjemplo")}><textarea id={`accion-${tipo}`} className="mt-2 min-h-24 w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta p-3" value={frase} onChange={(e) => setFrase(e.target.value)} /></Campo>
    <div className="flex flex-wrap gap-2"><Boton variante="borde" onClick={() => setResultado(prepararAccion(tipo, frase, t))}>{t("asistente.analizar")}</Boton><Boton variante="plano" onClick={() => setAbierto(false)}>{t("asistente.cancelar")}</Boton></div>
    {resultado && <div className="mt-4 rounded-campo bg-superficie p-3"><p>{resultado.explicacion}</p>{resultado.propuesta && <dl className="mt-2 grid gap-2 sm:grid-cols-2">{Object.entries(resultado.propuesta).filter(([k, v]) => k !== "faltantes" && v).map(([k, v]) => <div key={k}><dt className="text-apoyo text-tinta-suave">{t(`asistente.acciones.campos.${k}`)}</dt><dd className="font-bold">{v}</dd></div>)}</dl>}{resultado.propuesta && <Boton className="mt-3" variante="borde" onClick={() => { alUsar(resultado.propuesta); setAbierto(false); }}>{t("asistente.acciones.llevarFormulario")}</Boton>}</div>}
  </PanelAsistente>;
}

