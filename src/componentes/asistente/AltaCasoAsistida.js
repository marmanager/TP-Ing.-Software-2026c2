"use client";

import { useEffect, useRef, useState } from "react";
import { extraerAltaCaso, reconciliarAlta } from "@/lib/asistente";
import { Boton, Campo } from "@/componentes/ui";
import PanelAsistente from "./Panel";

export default function AltaCasoAsistida({ actual, empleados, rubro, t, alUsar, alCerrar }) {
  const [frase, setFrase] = useState("");
  const [resultado, setResultado] = useState(null);
  const [usarSugerido, setUsarSugerido] = useState(new Set());
  const [dictando, setDictando] = useState(false);
  const reconocimiento = useRef(null);
  const SoporteVoz = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  useEffect(() => () => reconocimiento.current?.stop(), []);

  function analizar() {
    const r = extraerAltaCaso({ frase, empleados, rubro }, t);
    setResultado(r);
    setUsarSugerido(new Set());
  }
  function dictar() {
    if (!SoporteVoz) return;
    if (dictando) { reconocimiento.current?.stop(); return; }
    const r = new SoporteVoz();
    r.lang = document.documentElement.lang || "es-AR";
    r.continuous = true; r.interimResults = true;
    r.onresult = (e) => setFrase([...e.results].map((x) => x[0].transcript).join(" "));
    r.onend = () => setDictando(false);
    r.start(); reconocimiento.current = r; setDictando(true);
  }
  function usar() {
    const mezcla = reconciliarAlta(actual, resultado.propuesta);
    for (const conflicto of mezcla.conflictos) if (usarSugerido.has(conflicto.campo)) mezcla.valores[conflicto.campo] = conflicto.sugerido;
    alUsar(mezcla.valores);
    alCerrar();
  }
  const mezcla = resultado?.propuesta ? reconciliarAlta(actual, resultado.propuesta) : null;
  return <PanelAsistente titulo={t("asistente.alta.titulo")} apoyo={t("asistente.alta.apoyo")} t={t} className="mb-8 max-w-[640px]">
    <Campo id="asistente-caso-frase" etiqueta={t("asistente.alta.frase")} ayuda={t("asistente.alta.ejemplo")}>
      <textarea id="asistente-caso-frase" className="mt-2 min-h-28 w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 py-3" value={frase} onChange={(e) => setFrase(e.target.value)} autoFocus />
    </Campo>
    <div className="flex flex-wrap gap-2"><Boton variante="borde" data-testid="asistente-alta-analizar" onClick={analizar}>{t("asistente.analizar")}</Boton>{SoporteVoz ? <Boton variante="plano" onClick={dictar}>{t(dictando ? "asistente.alta.detener" : "asistente.alta.dictar")}</Boton> : <span className="self-center text-apoyo text-tinta-suave">{t("asistente.alta.dictadoNoDisponible")}</span>}</div>
    {resultado && <div className="mt-5" aria-live="polite"><p className="font-bold">{t("asistente.alta.vistaPrevia")}</p><p className="mt-1 text-tinta-media">{resultado.explicacion}</p>
      {resultado.propuesta && <dl className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(resultado.propuesta).filter(([k, v]) => k !== "faltantes" && v).map(([campo, valor]) => <div key={campo} className="rounded-campo bg-superficie p-3"><dt className="text-etiqueta text-tinta-suave">{t(`asistente.alta.campos.${campo}`)}</dt><dd className="font-bold">{campo === "responsable" ? empleados.find((e) => e.id === valor)?.nombre : valor}</dd></div>)}</dl>}
      {!!mezcla?.conflictos.length && <div className="mt-4"><p className="font-bold text-espera">{t("asistente.alta.conflicto")}</p>{mezcla.conflictos.map((c) => <label key={c.campo} className="mt-2 flex items-start gap-2 rounded-campo border border-espera p-3"><input type="checkbox" checked={usarSugerido.has(c.campo)} onChange={() => setUsarSugerido((s) => { const n = new Set(s); if (n.has(c.campo)) n.delete(c.campo); else n.add(c.campo); return n; })} /><span>{usarSugerido.has(c.campo) ? `${t("asistente.alta.usarSugerido")}: ${c.sugerido}` : `${t("asistente.alta.conservar")}: ${c.actual}`}</span></label>)}</div>}
      {!!resultado.preguntas.length && <ul className="mt-4 list-disc pl-5 text-espera">{resultado.preguntas.map((p) => <li key={p}>{p}</li>)}</ul>}
      {resultado.propuesta && <div className="mt-4"><Boton variante="borde" data-testid="asistente-alta-usar" onClick={usar}>{t("asistente.usar")}</Boton></div>}
    </div>}
    <div className="mt-3"><Boton variante="plano" onClick={alCerrar}>{t("asistente.cancelar")}</Boton></div>
  </PanelAsistente>;
}

