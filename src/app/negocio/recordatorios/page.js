"use client";

// "Recordatorios por WhatsApp" — los mensajes que le llegan solos al cliente.
//
// Son cuatro: el de después de entregar, el de antes del turno (R-4b), el de
// cuando le toca volver (R-2b) y el del presupuesto sin respuesta (R-5b).
// Con dos, entraban en una pantalla: eran seis campos, el máximo de la
// cartilla. El tercero ya no entraba, y vienen más (R-6), así que esta
// pantalla es la lista y cada uno se edita en la suya,
// /negocio/recordatorios/[tipo], con sus tres campos y su botón.
//
// Cada fila dice cómo está y cuándo sale, para no tener que entrar a mirar.
// Las filas salen de lib/recordatorios.js (filasDeRecordatorios): sumar un
// recordatorio no toca esta pantalla. Con la agenda apagada, el de turnos
// no aparece: no se configura algo que no se usa.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { puede, QUIEN_PUEDE } from "@/lib/permisos";
import { estaPrendido } from "@/lib/modulos";
import { filasDeRecordatorios } from "@/lib/recordatorios";
import Icono from "@/componentes/Icono";
import { Boton, Cargando, ErrorGeneral, Tarjeta, TituloPantalla } from "@/componentes/ui";

export default function Recordatorios() {
  const datos = useDatos();
  const { cargando, negocio } = datos;
  const { usuario } = useAuth();
  useTitulo("Recordatorios por WhatsApp");

  const [configuracion, setConfiguracion] = useState(null);
  const [error, setError] = useState(null);
  const [intento, setIntento] = useState(0);
  const acciones = useRef(datos);
  acciones.current = datos;
  const negocioId = negocio?.id;

  useEffect(() => {
    if (!negocioId) return;
    let vivo = true;
    setError(null);
    (async () => {
      const r = await acciones.current.consultarSeguimiento();
      if (!vivo) return;
      if (!r.ok) return setError(r.error);
      setConfiguracion(r.configuracion);
    })();
    return () => { vivo = false; };
  }, [negocioId, intento]);

  if (cargando || (!configuracion && !error)) return <Cargando />;

  const puedeConfigurar = puede(usuario, "entregar_y_reabrir");
  const conAgenda = estaPrendido("agenda", negocio?.modulos_activos ?? []);

  const volver = (
    <Link href="/negocio" className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul">
      <Icono nombre="volver" />
      Volver a Mi negocio
    </Link>
  );

  if (!configuracion) {
    return (
      <>
        {volver}
        <TituloPantalla>Recordatorios por WhatsApp</TituloPantalla>
        <ErrorGeneral>{error}</ErrorGeneral>
        <Boton className="mt-4" onClick={() => setIntento((n) => n + 1)}>Volver a cargar</Boton>
      </>
    );
  }

  const filas = filasDeRecordatorios({ configuracion, rubro: negocio?.rubro, conAgenda });

  return (
    <>
      {volver}
      <TituloPantalla apoyo="Mensajes que le llegan solos al cliente por WhatsApp. Prendé los que quieras usar.">
        Recordatorios por WhatsApp
      </TituloPantalla>

      {!puedeConfigurar && (
        <p className="mb-6 max-w-[65ch] text-tinta-media">{QUIEN_PUEDE.entregar_y_reabrir}</p>
      )}

      <ul className="flex flex-col gap-4">
        {filas.map((fila) => (
          <li key={fila.tipo}>
            <FilaRecordatorio fila={fila} puedeConfigurar={puedeConfigurar} />
          </li>
        ))}
      </ul>
    </>
  );
}

function FilaRecordatorio({ fila, puedeConfigurar }) {
  return (
    <Tarjeta>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${fila.tipo}-nombre`} className="flex items-center gap-2 text-subtitulo font-bold">
          <Icono nombre="whatsapp" className="size-6 text-completo" />
          {fila.nombre}
        </h2>
        <span
          className={[
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold text-etiqueta",
            fila.prendido ? "bg-azul-claro text-azul" : "bg-superficie text-tinta-media",
          ].join(" ")}
        >
          <Icono nombre={fila.prendido ? "listo" : "cruz"} className="size-5" />
          {fila.prendido ? "Prendido" : "Apagado"}
        </span>
      </div>

      <p className="mt-3 max-w-[65ch] text-tinta-media">
        {fila.prendido ? fila.cuando : "Apagado: no le llega a ningún cliente."}
      </p>

      <div className="mt-4">
        <Link
          href={fila.href}
          aria-describedby={`${fila.tipo}-nombre`}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-campo border-2 border-azul bg-tarjeta px-6 font-bold text-azul hover:bg-azul-claro"
        >
          <Icono nombre={puedeConfigurar ? "pincel" : "ojo"} className="size-6" />
          {puedeConfigurar ? "Configurar" : "Ver cómo está"}
        </Link>
      </div>
    </Tarjeta>
  );
}
