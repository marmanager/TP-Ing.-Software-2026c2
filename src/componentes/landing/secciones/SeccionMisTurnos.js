"use client";

import { useEffect, useState } from "react";
import { misTurnosEnLanding } from "@/lib/datos";
import { diaLargo } from "@/lib/fechas";
import { ESTADOS_TURNO, estadoDeTurno } from "@/lib/turnos";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import { traducirSeccion, SECCIONES } from "@/lib/landing";
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
  const { locale, t } = useIdioma();
  const [turnos, setTurnos] = useState(null);
  const [problema, setProblema] = useState(null);
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await misTurnosEnLanding(codigo);
      if (!vivo) return;
      if (r.ok) setTurnos(r.turnos);
      else if (r.codigo === "llave_vencida") alVencer({ codigo: r.codigo, mensaje: r.mensaje });
      else setProblema({ codigo: r.codigo, mensaje: r.mensaje });
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
          <span>{textoDeError(t, problema)}</span>
        </p>
        <Boton
          icono="deshacer"
          className="mt-4"
          onClick={() => {
            setProblema(null);
            setVuelta((v) => v + 1);
          }}
        >
          {t("landing.casos.probar")}
        </Boton>
      </div>
    );
  }

  if (!turnos) {
    return (
      <p role="status" className="mt-2 text-tinta-media">
        {t("landing.turnos.buscando")}
      </p>
    );
  }

  if (turnos.length === 0) {
    return (
      <p className="mt-2 max-w-[65ch] text-tinta-media">
        {t("landing.turnos.ninguno", {
          negocio: negocio.nombre,
          seccion: traducirSeccion(SECCIONES.find((s) => s.clave === "sacar_turno"), t).nombre,
        })}
      </p>
    );
  }

  return (
    <>
      <ul className="mt-2 divide-y divide-borde">
        {turnos.map((turno) => (
          <li key={turno.empieza_en} className="py-4">
            <p className="font-titulo font-extrabold text-subtitulo first-letter:uppercase">
              {t("turnos.cuando", { dia: diaLargo(turno.empieza_en, locale, t), hora: comoHora(new Date(turno.empieza_en)) })}
            </p>
            {turno.motivo && <p className="text-tinta-media">{turno.motivo}</p>}
            {turno.minutos_reservados > 0 && (
              <p className="text-apoyo text-tinta-suave">{t("landing.turnos.minutos", { minutos: turno.minutos_reservados })}</p>
            )}
            {/* Sólo el confirmado: "sin confirmar" es la palabra del negocio
                para un turno que nadie llamó a confirmar, y al cliente le
                haría dudar de si quedó anotado. */}
            {turno.estado === CONFIRMADO.clave && (
              <p className={`mt-1 flex items-center gap-1.5 font-bold ${CONFIRMADO.texto}`}>
                <Icono nombre={CONFIRMADO.icono} className="size-5 shrink-0" />
                {estadoDeTurno(CONFIRMADO.clave, t).palabra}
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 max-w-[65ch] text-apoyo text-tinta-media">
        {t("landing.turnos.avisar", { negocio: negocio.nombre })}
      </p>
    </>
  );
}
