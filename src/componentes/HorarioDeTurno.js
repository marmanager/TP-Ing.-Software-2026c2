"use client";

// Elegir el día y la hora de un turno cargado a mano, sólo entre los huecos
// que el negocio atiende: los mismos que ve el cliente en su landing (salen de
// huecosLibres, la misma cuenta). Así no se anota a las 15:38 un negocio que
// da turnos cada 30 minutos, ni encima de otro turno.
//
// Entra y sale la hora como la deja un <input type="datetime-local">
// ("2026-10-28T15:30"), así que quien lo usa no cambia. Si el negocio todavía
// no cargó sus horarios, cae a ese mismo input.
//
// A diferencia del cliente, quien carga a mano no queda sujeto a la
// anticipación mínima: puede anotar para dentro de un rato.

import { useState } from "react";
import { useDatos } from "@/lib/datos";
import { huecosLibres, horariosListos, normalizarHorarios } from "@/lib/horarios";
import { paraInput } from "@/lib/fechas";
import { useIdioma } from "@/lib/useIdioma";
import { Campo } from "@/componentes/ui";

// Un botón de hora o de minutos: marcado, queda con el color de selección.
function Opcion({ marcada, children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={marcada}
      className={[
        "min-h-12 min-w-16 cursor-pointer rounded-full border-2 px-4 text-etiqueta",
        marcada
          ? "border-azul bg-azul-claro font-bold text-azul"
          : "border-borde bg-tarjeta text-tinta-media hover:bg-superficie",
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}

export default function HorarioDeTurno({ valor, onChange, ignorarId, id = "turno-cuando", etiqueta, ayuda, error }) {
  const { negocio, turnos } = useDatos();
  const { t } = useIdioma();
  const [dia, setDia] = useState(valor.slice(0, 10));
  const [hh, setHh] = useState(valor ? valor.slice(11, 13) : null);

  const horarios = normalizarHorarios(negocio?.horarios);
  if (!horarios || !horariosListos(horarios)) {
    return (
      <Campo
        id={id}
        etiqueta={etiqueta}
        ayuda={ayuda}
        error={error}
        type="datetime-local"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  const [anio, mes, d] = dia.split("-").map(Number);
  const huecos = dia
    ? (huecosLibres({
        horarios: { ...horarios, anticipacionHoras: 0 },
        turnos: (turnos ?? []).filter((x) => x.id !== ignorarId),
        desde: new Date(anio, mes - 1, d),
        dias: 1,
      })[0]?.huecos ?? [])
    : [];
  const horas = huecos.map((h) => paraInput(h));

  // La hora se elige en dos pasos, con botones: primero la hora en punto y
  // después los minutos. Lo elegido queda marcado y el resto desaparece; al
  // tocarlo de nuevo se desmarca y vuelven las opciones.
  const horaElegida = horas.some((h) => h.slice(11, 13) === hh) ? hh : null;
  const horasEnPunto = [...new Set(horas.map((h) => h.slice(11, 13)))];
  const minutosDe = horas.filter((h) => h.slice(11, 13) === horaElegida).map((h) => h.slice(14));
  const minutoElegido = horas.includes(valor) ? valor.slice(14) : null;

  return (
    <>
      <Campo
        id={`${id}-dia`}
        etiqueta={etiqueta}
        ayuda={ayuda}
        type="date"
        min={paraInput().slice(0, 10)}
        value={dia}
        onChange={(e) => {
          setDia(e.target.value);
          setHh(null);
          onChange("");
        }}
      />
      {dia && (
        <Campo
          id={id}
          etiqueta={t("agenda.alta.hora")}
          error={error ?? (horas.length === 0 ? t("agenda.alta.sinHorarios") : null)}
        >
          <div id={id} role="group" className="mt-2">
            <div className="flex flex-wrap gap-2">
              {(horaElegida ? [horaElegida] : horasEnPunto).map((h) => (
                <Opcion
                  key={h}
                  id={`${id}-h-${h}`}
                  marcada={h === horaElegida}
                  onClick={() => {
                    setHh(h === horaElegida ? null : h);
                    onChange("");
                  }}
                >
                  {h}
                </Opcion>
              ))}
            </div>
            {horaElegida && (
              <>
                <p className="mt-4 mb-2 text-etiqueta text-tinta-media">{t("agenda.alta.minutos")}</p>
                <div className="flex flex-wrap gap-2">
                  {(minutoElegido ? [minutoElegido] : minutosDe).map((m) => (
                    <Opcion
                      key={m}
                      id={`${id}-m-${m}`}
                      marcada={m === minutoElegido}
                      onClick={() => onChange(m === minutoElegido ? "" : `${dia}T${horaElegida}:${m}`)}
                    >
                      {`${horaElegida}:${m}`}
                    </Opcion>
                  ))}
                </div>
              </>
            )}
          </div>
        </Campo>
      )}
    </>
  );
}
