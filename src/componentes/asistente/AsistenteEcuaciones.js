"use client";

import { useState } from "react";
import { explicarEcuacion, prepararResolucion, proponerEcuacion, revisarEcuacion } from "@/lib/asistente";
import { Boton, Campo } from "@/componentes/ui";
import PanelAsistente from "./Panel";

export function CreadorEcuacionAsistido({ t, alRevisar }) {
  const [abierto, setAbierto] = useState(false);
  const [frase, setFrase] = useState("");
  const [resultado, setResultado] = useState(null);
  if (!abierto) return <Boton variante="borde" data-testid="asistente-ecuacion-abrir" onClick={() => setAbierto(true)}>{t("asistente.ecuaciones.abrir")}</Boton>;
  return <PanelAsistente titulo={t("asistente.ecuaciones.titulo")} apoyo={t("asistente.ecuaciones.apoyo")} t={t} className="mt-4 mb-8 w-full basis-full">
    <Campo id="asistente-ecuacion" etiqueta={t("asistente.ecuaciones.frase")} ayuda={t("asistente.ecuaciones.ejemplos")}><textarea id="asistente-ecuacion" className="mt-2 min-h-28 w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta p-3" value={frase} onChange={(e) => setFrase(e.target.value)} autoFocus /></Campo>
    <div className="flex flex-wrap gap-2"><Boton variante="borde" data-testid="asistente-ecuacion-analizar" onClick={() => setResultado(proponerEcuacion(frase, t))}>{t("asistente.analizar")}</Boton><Boton variante="plano" onClick={() => setAbierto(false)}>{t("asistente.cancelar")}</Boton></div>
      {resultado && <div className="mt-4 rounded-campo bg-superficie p-4" aria-live="polite"><p>{resultado.explicacion}</p>{resultado.propuesta && <><p className="mt-3 font-bold">{resultado.propuesta.nombre}</p><code className="mt-1 block break-all">{resultado.propuesta.formula}</code><ul className="mt-2 list-disc pl-5">{resultado.propuesta.variables.map((v) => <li key={v.id}>{v.nombre}{v.valor != null ? ` = ${v.valor}` : ""} {v.unidad}</li>)}</ul><Boton className="mt-4" variante="borde" data-testid="asistente-ecuacion-revisar" onClick={() => alRevisar(resultado.propuesta)}>{t("asistente.ecuaciones.revisarEditor")}</Boton></>}</div>}
  </PanelAsistente>;
}

export function AyudaEcuacion({ ecuacion, t }) {
  const [modo, setModo] = useState(null);
  const [frase, setFrase] = useState("");
  const [resultado, setResultado] = useState(null);
  const mostrar = (nuevo) => {
    setModo(nuevo);
    if (nuevo === "explicar") setResultado(explicarEcuacion(ecuacion, t));
    if (nuevo === "detectar") setResultado(revisarEcuacion(ecuacion, t));
  };
  return <div className="mt-3 border-t border-borde pt-3"><div className="flex flex-wrap gap-2"><Boton variante="plano" onClick={() => mostrar("explicar")}>{t("asistente.ecuaciones.explicar")}</Boton><Boton variante="plano" onClick={() => mostrar("detectar")}>{t("asistente.ecuaciones.detectar")}</Boton><Boton variante="plano" onClick={() => setModo("preparar")}>{t("asistente.ecuaciones.preparar")}</Boton></div>
    {modo === "preparar" && <div className="mt-3"><Campo id={`valores-${ecuacion.id}`} etiqueta={t("asistente.ecuaciones.valores")} value={frase} onChange={(e) => setFrase(e.target.value)} /><Boton variante="borde" onClick={() => setResultado(prepararResolucion(ecuacion, frase, t))}>{t("asistente.analizar")}</Boton></div>}
    {resultado && <div className="mt-3 rounded-campo bg-superficie p-3"><p>{resultado.explicacion}</p>{resultado.propuesta?.formula && <code className="mt-2 block break-all">{resultado.propuesta.formula}</code>}{resultado.suposiciones?.map((s) => <p key={s} className="mt-1 text-espera">{s}</p>)}</div>}
  </div>;
}

