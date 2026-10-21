"use client";

// El script del tema en el <head> (src/lib/tema.js). Es componente de cliente
// para poder ser text/plain en el navegador: React avisa si dibuja un
// <script>, y ahí ya no hace falta que corra (docs de Next, "Preventing flash").
import { SCRIPT_APARIENCIA } from "@/lib/tema";

export default function ScriptTema() {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: SCRIPT_APARIENCIA }}
    />
  );
}
