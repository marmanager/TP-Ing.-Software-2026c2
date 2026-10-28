"use client";

// Pasar un turno a otro día u hora, desde la agenda (R-4b). El recordatorio
// por WhatsApp lo sigue: la API lo corre con la misma anticipación, y la
// línea del aviso muestra la fecha nueva.

import { useState } from "react";
import { useDatos } from "@/lib/datos";
import { diaLargoEnFrase, horaYMinutos, paraInput } from "@/lib/fechas";
import { textoDeError } from "@/lib/idioma";
import { useIdioma } from "@/lib/useIdioma";
import { avisoAlAnotar } from "@/lib/recordatorios";
import { Boton, Campo } from "./ui";

export default function MoverTurno({ turno, alTerminar }) {
  const datos = useDatos();
  const { idioma, locale, t } = useIdioma();
  const [cuando, setCuando] = useState(paraInput(new Date(turno.empieza_en)));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const motivo = guardando
    ? t("agenda.mover.guardando")
    : !cuando
      ? t("agenda.mover.faltaCuando")
      : cuando === paraInput(new Date(turno.empieza_en))
        ? t("agenda.mover.mismaHora")
        : null;

  async function guardar() {
    setGuardando(true);
    setError(null);
    const r = await datos.moverTurno(turno.id, cuando);
    setGuardando(false);
    if (!r.ok) return setError(textoDeError(t, r.error));
    const nuevo = r.turno.empieza_en;
    datos.avisarExito(
      [
        t("agenda.mover.listo", {
          motivo: turno.motivo,
          dia: diaLargoEnFrase(nuevo, locale, t),
          hora: horaYMinutos(nuevo, locale),
        }),
        avisoAlAnotar(r.recordatorio, { t, locale, idioma }),
      ].filter(Boolean).join(" ")
    );
    alTerminar();
  }

  return (
    <div className="w-full rounded-tarjeta bg-superficie p-4">
      <Campo
        id={`mover-${turno.id}`}
        etiqueta={t("agenda.mover.etiqueta")}
        ayuda={t("agenda.mover.ayuda")}
        type="datetime-local"
        value={cuando}
        error={error}
        onChange={(e) => setCuando(e.target.value)}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Boton icono="check" className="w-full sm:w-auto" motivo={motivo} onClick={guardar} data-testid="turno-mover-guardar">
          {t("agenda.mover.guardar")}
        </Boton>
        <Boton variante="plano" className="w-full sm:w-auto" onClick={alTerminar}>
          {t("agenda.mover.dejar")}
        </Boton>
      </div>
    </div>
  );
}
