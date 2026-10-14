"use client";

// La tarjeta de "Recordatorios por WhatsApp" en Mi negocio: cómo está cada
// uno, en una frase, y el camino a /negocio/recordatorios para cambiarlos.
// Igual que Módulos y Cuándo atendés: el resumen acá, la edición en su
// pantalla.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { estaPrendido } from "@/lib/modulos";
import { vocabulario } from "@/lib/presets";
import { anticipacionEnPalabras, recordatoriosDeLaApi } from "@/lib/recordatorios";
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
      if (r.ok) setConfig(recordatoriosDeLaApi(r.configuracion));
      else setError(r.error);
    })();
    return () => { vivo = false; };
  }, [negocioId]);

  const conAgenda = estaPrendido("agenda", negocio?.modulos_activos ?? []);
  const { cita } = vocabulario(negocio?.rubro);
  const dias = Number(config?.cierre.plazo);

  return (
    <Tarjeta className="mb-12">
      <p className="max-w-[65ch] text-tinta-media">
        Mensajes que le llegan solos al cliente por WhatsApp.
      </p>
      {config ? (
        <ul className="mt-3 flex flex-col gap-1">
          <li>
            <span className="font-bold text-tinta">Después de entregar:</span>{" "}
            {config.cierre.activo
              ? dias === 0 ? "prendido, apenas entregás." : `prendido, ${dias === 1 ? "un día" : `${dias} días`} después.`
              : "apagado."}
          </li>
          {conAgenda && (
            <li>
              <span className="font-bold text-tinta">
                Antes {cita.segun("del", "de la")} {cita.palabra()}:
              </span>{" "}
              {config.turno.activo ? `prendido, ${anticipacionEnPalabras(config.turno.plazo)}.` : "apagado."}
            </li>
          )}
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
