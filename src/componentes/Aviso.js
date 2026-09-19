"use client";

// Los mensajes del sistema dicen qué pasó y qué hacer, sin culpar a nadie
// y sin jerga (cartilla, sección 07).
//
// Tienen que verse donde la persona está mirando (auditoría, H1). Antes se
// dibujaban arriba del contenido: quien guardaba algo abajo de todo —un
// paso, un insumo, la contraseña— no veía la confirmación y volvía a tocar
// el botón creyendo que no había pasado nada.
//
// - En celular van fijos abajo, encima de la barra de secciones (64 px).
// - En escritorio van arriba del contenido, como antes, y si quedaron fuera
//   de la vista se lleva la vista hasta ellos.

import { useEffect, useRef } from "react";
import { useDatos } from "@/lib/datos";
import Icono from "./Icono";
import { Boton } from "./ui";

function Banda({ tono, icono, texto, alDescartar, deshacer, rol }) {
  return (
    <div
      role={rol}
      className={`flex flex-wrap items-start gap-3 rounded-tarjeta border border-borde border-l-4 p-4 shadow-lg md:shadow-none ${tono}`}
    >
      <Icono nombre={icono} className="size-6" />
      <p className="min-w-0 flex-1 text-cuerpo">{texto}</p>
      <div className="flex shrink-0 gap-2">
        {deshacer && (
          <Boton
            icono="deshacer"
            onClick={() => {
              deshacer();
              alDescartar();
            }}
          >
            Deshacer
          </Boton>
        )}
        <Boton variante="plano" onClick={alDescartar}>
          Entendido
        </Boton>
      </div>
    </div>
  );
}

// Lleva la vista al aviso cuando aparece fuera de ella. Sólo en escritorio:
// en celular el aviso ya está fijo a la vista.
function usarTraerALaVista(ref, contenido) {
  useEffect(() => {
    const el = ref.current;
    if (!contenido || !el) return;
    if (!window.matchMedia("(min-width: 768px)").matches) return;

    const { top, bottom } = el.getBoundingClientRect();
    if (top >= 0 && bottom <= window.innerHeight) return;

    const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "start", behavior: sinMovimiento ? "auto" : "smooth" });
  }, [ref, contenido]);
}

export default function Aviso() {
  const { aviso, exito, deshacerExito, descartarAviso, descartarExito } = useDatos();
  const ref = useRef(null);
  usarTraerALaVista(ref, exito || aviso ? `${exito ?? ""}${aviso ?? ""}` : null);

  if (!exito && !aviso) return null;

  return (
    <div
      ref={ref}
      className="fixed inset-x-3 bottom-[calc(var(--alto-barra,4rem)+0.75rem)] z-30 flex flex-col gap-2 md:static md:inset-auto md:z-auto md:mb-6 md:scroll-mt-6"
    >
      {exito && (
        <Banda
          rol="status"
          tono="border-l-completo bg-completo-fondo text-completo"
          icono="listo"
          texto={exito}
          deshacer={deshacerExito}
          alDescartar={descartarExito}
        />
      )}
      {aviso && (
        <Banda
          rol="alert"
          tono="border-l-espera bg-espera-fondo text-espera"
          icono="alerta"
          texto={aviso}
          alDescartar={descartarAviso}
        />
      )}
    </div>
  );
}
