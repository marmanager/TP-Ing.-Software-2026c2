"use client";

// La tarjeta de "Recordatorios por WhatsApp" en Mi negocio: cómo está cada
// uno, en una línea, y el camino a /negocio/recordatorios para cambiarlos.
// Igual que Módulos y Cuándo atendés: el resumen acá, la edición en su
// pantalla. Las líneas salen de las mismas filas que esa pantalla
// (filasDeRecordatorios), así que un recordatorio nuevo aparece solo.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { estaPrendido } from "@/lib/modulos";
import { filasDeRecordatorios } from "@/lib/recordatorios";
import Icono from "./Icono";
import { Tarjeta } from "./ui";

export default function ResumenRecordatorios({ puedeConfigurar }) {
  const datos = useDatos();
  const { negocio } = datos;
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);
  const acciones = useRef(datos);
  acciones.current = datos;
  const negocioId = negocio?.id;

  useEffect(() => {
    if (!negocioId) return;
    let vivo = true;
    (async () => {
      const r = await acciones.current.consultarSeguimiento();
      if (!vivo) return;
      if (r.ok) setConfig(r.configuracion);
      else setError(r.error);
    })();
    return () => { vivo = false; };
  }, [negocioId]);

  const conAgenda = estaPrendido("agenda", negocio?.modulos_activos ?? []);
  const filas = config ? filasDeRecordatorios({ configuracion: config, rubro: negocio?.rubro, conAgenda }) : null;

  return (
    <Tarjeta className="mb-12">
      <p className="max-w-[65ch] text-tinta-media">
        Mensajes que le llegan solos al cliente por WhatsApp.
      </p>
      {filas ? (
        <ul className="mt-3 flex flex-col gap-1">
          {filas.map((f) => (
            <li key={f.tipo}>
              <span className="font-bold text-tinta">{f.nombre}:</span>{" "}
              {f.prendido ? "prendido." : "apagado."}
            </li>
          ))}
        </ul>
      ) : (
        error && <p className="mt-3 text-tinta-media">{error}</p>
      )}
      <div className="mt-4">
        <Link
          href="/negocio/recordatorios"
          className="inline-flex min-h-12 items-center gap-2 font-bold text-azul"
        >
          <Icono nombre="whatsapp" />
          {puedeConfigurar ? "Ver y cambiar los recordatorios" : "Ver los recordatorios"}
        </Link>
      </div>
    </Tarjeta>
  );
}
