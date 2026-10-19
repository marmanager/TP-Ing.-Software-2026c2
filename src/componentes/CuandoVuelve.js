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

// "cada 90 días" se dice "cada 3 meses".
const cadaCuanto = (dias) => (dias < 60 ? `${dias} días` : `${Math.round(dias / 30.4)} meses`);

// "aviso" es lo que va a pasar con el aviso por WhatsApp de esa fecha
// (R-2b, avisoAlAnotarVolver): si está apagado se dice acá, así nadie cree
// que el sistema va a avisar cuando no.
export default function CuandoVuelve({ id = "volver-en", valor, alCambiar, hoy, sugerencia, error, aviso, disabled }) {
  return (
    <div>
      <Campo
        id={id}
        etiqueta="¿Cuándo le toca volver?"
        ayuda="Queda en su ficha para avisarle cuando se acerque el día; si no tiene que volver, dejalo vacío."
        ejemplo={diaEnPalabras(hoy)}
        error={error ? "Esa fecha ya pasó. Elegí hoy o un día más adelante." : null}
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
            Por sus visitas anteriores, suele volver cada {cadaCuanto(sugerencia.dias)}.
          </p>
          <div className="mt-2">
            <Boton variante="plano" icono="mas" disabled={disabled} onClick={() => alCambiar(sugerencia.fecha)}>
              Anotar el {diaEnPalabras(sugerencia.fecha)}
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
          <Boton variante="plano" icono="cruz" disabled={disabled} onClick={() => alCambiar("")}>
            No tiene que volver
          </Boton>
        </div>
      )}
    </div>
  );
}
