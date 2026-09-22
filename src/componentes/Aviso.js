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
// - En escritorio quedan fijos abajo para conservar la posición al cobrar.

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

export default function Aviso() {
  const { aviso, exito, deshacerExito, descartarAviso, descartarExito } = useDatos();

  if (!exito && !aviso) return null;

  return (
    <div
      className="fixed inset-x-3 bottom-[calc(var(--alto-barra,4rem)+0.75rem)] z-30 flex flex-col gap-2 md:inset-x-auto md:right-6 md:bottom-6 md:w-[min(32rem,calc(100vw-3rem))]"
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
