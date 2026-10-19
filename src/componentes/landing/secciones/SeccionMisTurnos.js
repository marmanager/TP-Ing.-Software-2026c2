"use client";

import { useEffect, useState } from "react";
import { misTurnosEnLanding } from "@/lib/datos";
import { diaLargo } from "@/lib/fechas";
import { ESTADOS_TURNO } from "@/lib/turnos";
import { comoHora } from "@/componentes/CalendarioDeTurnos";
import Icono from "@/componentes/Icono";
import { Boton } from "@/componentes/ui";

// "Mis turnos", en la landing: los próximos turnos del cliente (los pasados y
// los cancelados no vienen: lo decide la base). Cancelar desde acá queda
// afuera (docs/landing-por-negocio.md), así que se dice a quién avisarle.
//
// Como "Mis casos", la página la dibuja sólo cuando el cliente entró. Además
// se vuelve a pedir cada vez que saca un turno ("reservas" cambia), para que
// el nuevo aparezca sin recargar.
const CONFIRMADO = ESTADOS_TURNO.confirmado;

export default function SeccionMisTurnos({ codigo, negocio, alVencer, reservas }) {
  const [turnos, setTurnos] = useState(null);
  const [problema, setProblema] = useState(null);
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await misTurnosEnLanding(codigo);
      if (!vivo) return;
      if (r.ok) setTurnos(r.turnos);
      else if (r.codigo === "llave_vencida") alVencer(r.mensaje);
      else setProblema(r.mensaje);
    })();
    return () => {
      vivo = false;
    };
  }, [codigo, vuelta, reservas, alVencer]);

  if (problema) {
    return (
      <div className="mt-2">
        <p role="alert" className="flex items-start gap-2 font-bold text-rojo">
          <Icono nombre="alerta" className="mt-0.5 size-5 shrink-0" />
          <span>{problema}</span>
        </p>
        <Boton
          icono="deshacer"
          className="mt-4"
          onClick={() => {
            setProblema(null);
            setVuelta((v) => v + 1);
          }}
        >
          Probar de nuevo
        </Boton>
      </div>
    );
  }

  if (!turnos) {
    return (
      <p role="status" className="mt-2 text-tinta-media">
        Buscando tus turnos…
      </p>
    );
  }

  if (turnos.length === 0) {
    return (
      <p className="mt-2 max-w-[65ch] text-tinta-media">
        No tenés turnos próximos en {negocio.nombre}. Podés sacar uno acá mismo, en «Sacar turno».
      </p>
    );
  }

  return (
    <>
      <ul className="mt-2 divide-y divide-borde">
        {turnos.map((t) => (
          <li key={t.empieza_en} className="py-4">
            <p className="font-titulo font-extrabold text-subtitulo first-letter:uppercase">
              {diaLargo(t.empieza_en)} a las {comoHora(new Date(t.empieza_en))}
            </p>
            {t.motivo && <p className="text-tinta-media">{t.motivo}</p>}
            {t.minutos_reservados > 0 && (
              <p className="text-apoyo text-tinta-suave">Son {t.minutos_reservados} minutos.</p>
            )}
            {/* Sólo el confirmado: "sin confirmar" es la palabra del negocio
                para un turno que nadie llamó a confirmar, y al cliente le
                haría dudar de si quedó anotado. */}
            {t.estado === CONFIRMADO.clave && (
              <p className={`mt-1 flex items-center gap-1.5 font-bold ${CONFIRMADO.texto}`}>
                <Icono nombre={CONFIRMADO.icono} className="size-5 shrink-0" />
                {CONFIRMADO.palabra}
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 max-w-[65ch] text-apoyo text-tinta-media">
        Si no podés venir, avisale a {negocio.nombre} así le dan el lugar a otro.
      </p>
    </>
  );
}
