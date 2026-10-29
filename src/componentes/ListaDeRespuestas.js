"use client";

// Lo que escribió el cliente por WhatsApp (R-10b), en la ficha y en el caso:
// cuándo, lo que escribió tal cual y, si la API lo sabe, a qué aviso
// contestaba. Las frases salen de lib/recordatorios.js; el orden lo pone
// quien la usa.
//
// La certeza se dice: "Contestó al…" cuando el cliente citó el aviso, y
// "Parece contestar al…" cuando la API lo asoció al último que le mandamos.

import { aQueContesto, cuandoContesto, loQueEscribio } from "@/lib/recordatorios";
import { useIdioma } from "@/lib/useIdioma";
import Icono from "./Icono";

export default function ListaDeRespuestas({ respuestas, rubro }) {
  const { idioma, locale, t } = useIdioma();
  const lang = { t, locale, idioma };
  return (
    <ul className="overflow-hidden rounded-tarjeta border border-borde bg-tarjeta">
      {respuestas.map((r) => {
        const escrito = loQueEscribio(r, lang);
        const contesto = aQueContesto({ contexto: r.contexto, rubro }, lang);
        return (
          <li key={r.id} data-respuesta={r.id} className="border-b border-borde px-4 py-3 last:border-b-0">
            <p className="flex items-center gap-2 text-apoyo text-tinta-suave">
              <Icono nombre="whatsapp" className="size-5 shrink-0" />
              <span className="first-letter:uppercase">{cuandoContesto(r, lang)}</span>
            </p>
            {/* Tal cual lo escribió: sin recortar ni corregir. */}
            {escrito.literal ? (
              <p className="mt-1 max-w-[65ch] whitespace-pre-wrap text-cuerpo [overflow-wrap:anywhere]">{escrito.texto}</p>
            ) : (
              <p className="mt-1 text-tinta-media">{escrito.texto}</p>
            )}
            {contesto && (
              <p data-certeza={contesto.certeza} className="mt-1 max-w-[65ch] text-etiqueta text-tinta-media">
                {contesto.frase}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
