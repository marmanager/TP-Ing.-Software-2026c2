"use client";

// Pasar un turno a otro día u hora, desde la agenda (R-4b). El recordatorio
// por WhatsApp lo sigue: la API lo corre con la misma anticipación, y la
// línea del aviso muestra la fecha nueva.

import { useState } from "react";
import { useDatos } from "@/lib/datos";
import { diaLargo, horaYMinutos, paraInput } from "@/lib/fechas";
import { Boton, Campo } from "./ui";

export default function MoverTurno({ turno, alTerminar }) {
  const datos = useDatos();
  const [cuando, setCuando] = useState(paraInput(new Date(turno.empieza_en)));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const motivo = guardando
    ? "se está guardando"
    : !cuando
      ? "falta el día y la hora"
      : cuando === paraInput(new Date(turno.empieza_en))
        ? "es la misma hora"
        : null;

  async function guardar() {
    setGuardando(true);
    setError(null);
    const r = await datos.moverTurno(turno.id, cuando);
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    const nuevo = r.turno.empieza_en;
    datos.avisarExito(
      [
        `Listo. El turno de ${turno.motivo} pasó a ${diaLargo(nuevo).toLowerCase()} a las ${horaYMinutos(nuevo)}.`,
        r.avisoDelRecordatorio,
      ].filter(Boolean).join(" ")
    );
    alTerminar();
  }

  return (
    <div className="w-full rounded-tarjeta bg-superficie p-4">
      <Campo
        id={`mover-${turno.id}`}
        etiqueta="¿Para cuándo lo pasás?"
        ayuda="Si tenía recordatorio, se corre solo con el turno."
        type="datetime-local"
        value={cuando}
        error={error}
        onChange={(e) => setCuando(e.target.value)}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Boton icono="check" className="w-full sm:w-auto" motivo={motivo} onClick={guardar}>
          Guardar la hora nueva
        </Boton>
        <Boton variante="plano" className="w-full sm:w-auto" onClick={alTerminar}>
          Dejarlo como está
        </Boton>
      </div>
    </div>
  );
}
