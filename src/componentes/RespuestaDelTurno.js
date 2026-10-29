"use client";

// Lo que contestó el cliente al recordatorio de su turno (R-10b), en una
// línea debajo del aviso: que confirmó, que avisó que no puede, o que
// todavía no contestó. La frase sale de lib/recordatorios.js.
//
// Que avise que no puede no es un error: el turno sigue en pie y el negocio
// decide. Se nota con el color de "esperando", el ícono de WhatsApp y la
// negrita, sin rojo ni ícono de alerta (como la baja, R-8b).

import { respuestaDelTurno } from "@/lib/recordatorios";
import { useIdioma } from "@/lib/useIdioma";
import Icono from "./Icono";

// Cada respuesta con su color, su ícono y su palabra (cartilla, sección 02).
const COMO_SE_VE = {
  confirmo: { icono: "listo", clase: "text-completo" },
  no_puede: { icono: "whatsapp", clase: "font-bold text-espera" },
  sin_respuesta: { icono: "reloj", clase: "text-tinta-media" },
};

export default function RespuestaDelTurno({ turno, rubro, ahora }) {
  const { idioma, locale, t } = useIdioma();
  const respuesta = respuestaDelTurno({ turno, rubro, ahora }, { t, locale, idioma });
  if (!respuesta) return null;
  const { icono, clase } = COMO_SE_VE[respuesta.estado];
  return (
    <p data-respuesta={respuesta.estado} className={`mt-1 flex items-start gap-1.5 text-etiqueta ${clase}`}>
      <Icono nombre={icono} className="mt-0.5 size-5 shrink-0" />
      <span>{respuesta.frase}</span>
    </p>
  );
}
