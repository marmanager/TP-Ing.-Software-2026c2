"use client";

// El campo "¿Cuándo le toca volver?" (Recordatorios, R-1b).
//
// Se usa al entregar el caso, que es el único momento en que alguien lo sabe
// de verdad —el mecánico se lo acaba de decir al cliente—, y en el caso ya
// cerrado, para corregirlo. Puede quedar vacío: no todos los trabajos tienen
// una próxima vez, y entregar nunca se traba por eso.
//
// El valor es el día tal como lo da el <input type="date">, "2027-04-13", y
// así viaja hasta la API: no pasa por Date.

import Icono from "./Icono";
import { Boton, Campo } from "./ui";
import { diaEnPalabras } from "@/lib/fechas";
import { useIdioma } from "@/lib/useIdioma";

// "aviso" es lo que va a pasar con el aviso por WhatsApp de esa fecha
// (R-2b, avisoAlAnotarVolver): si está apagado se dice acá, así nadie cree
// que el sistema va a avisar cuando no.
export default function CuandoVuelve({ id = "volver-en", valor, alCambiar, hoy, sugerencia, error, aviso, disabled }) {
  const { locale, t } = useIdioma();
  // "cada 90 días" se dice "cada 3 meses".
  const meses = sugerencia ? Math.round(sugerencia.dias / 30.4) : 0;
  return (
    <div>
      <Campo
        id={id}
        etiqueta={t("agenda.cuandoVuelve.etiqueta")}
        ayuda={t("agenda.cuandoVuelve.ayuda")}
        ejemplo={diaEnPalabras(hoy, locale)}
        error={error ? t("agenda.cuandoVuelve.yaPaso") : null}
        type="date"
        min={hoy}
        value={valor}
        disabled={disabled}
        onChange={(e) => alCambiar(e.target.value)}
      />

      {/* Para el cliente de siempre en un rubro sin intervalo típico: si sus
          visitas van parejas, se ofrece esa fecha. Se ofrece, no se carga:
          el que decide es el que tiene al cliente enfrente. */}
      {!valor && sugerencia && (
        <div className="-mt-3 mb-6">
          <p className="max-w-[65ch] text-tinta-media">
            {sugerencia.dias < 60
              ? t("agenda.cuandoVuelve.sueleVolverDias", { n: sugerencia.dias })
              : t("agenda.cuandoVuelve.sueleVolverMeses", { n: meses })}
          </p>
          <div className="mt-2">
            <Boton variante="plano" icono="mas" disabled={disabled} onClick={() => alCambiar(sugerencia.fecha)}>
              {t("agenda.cuandoVuelve.anotar", { fecha: diaEnPalabras(sugerencia.fecha, locale) })}
            </Boton>
          </div>
        </div>
      )}

      {valor && (
        <div className="-mt-3 mb-6">
          {aviso && (
            <p id={`${id}-aviso`} role="status" className="mb-2 flex max-w-[65ch] items-start gap-2 text-tinta-media">
              <Icono nombre="whatsapp" className="mt-1 size-5 shrink-0" />
              <span>{aviso}</span>
            </p>
          )}
          <Boton variante="plano" icono="cruz" disabled={disabled} onClick={() => alCambiar("")} data-testid="cuando-vuelve-no">
            {t("agenda.cuandoVuelve.noVuelve")}
          </Boton>
        </div>
      )}
    </div>
  );
}
