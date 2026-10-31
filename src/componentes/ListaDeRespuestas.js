"use client";

// Lo que escribió el cliente por WhatsApp (R-10b), en la ficha y en el caso:
// cuándo, lo que escribió tal cual y, si la API lo sabe, a qué aviso
// contestaba. Las frases salen de lib/recordatorios.js; el orden lo pone
// quien la usa.
//
// La certeza se dice: "Contestó al…" cuando el cliente citó el aviso, y
// "Parece contestar al…" cuando la API lo asoció al último que le mandamos.

//
// Con "primeros", se ven sólo esos (los más nuevos, que es como llegan) y el
// resto se abre de a DE_A: un cliente que escribió cincuenta veces no tapa lo
// que viene abajo en la ficha. Arriba, cuántos son y cuándo fue el último,
// para saber de un vistazo cuánto hay sin abrirlo.

import { useState } from "react";
import { aQueContesto, cuandoContesto, loQueEscribio } from "@/lib/recordatorios";
import { useIdioma } from "@/lib/useIdioma";
import Icono from "./Icono";
import { Boton } from "./ui";

const DE_A = 10;

export default function ListaDeRespuestas({ respuestas, rubro, primeros = null }) {
  const { idioma, locale, t } = useIdioma();
  const lang = { t, locale, idioma };
  const [cuantas, setCuantas] = useState(primeros ?? respuestas.length);
  const visibles = primeros === null ? respuestas : respuestas.slice(0, cuantas);
  const quedan = respuestas.length - visibles.length;
  const recortable = primeros !== null && respuestas.length > primeros;

  return (
    <>
      {recortable && (
        <p data-resumen-respuestas className="mb-2 text-tinta-media">
          {t("respuestas.resumen", { n: respuestas.length, cuando: cuandoContesto(respuestas[0], lang) })}
        </p>
      )}
    <ul className="overflow-hidden rounded-tarjeta border border-borde bg-tarjeta">
      {visibles.map((r) => {
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
      {recortable && (
        <div className="mt-2 flex flex-wrap gap-2">
          {quedan > 0 && (
            <Boton variante="plano" icono="flecha-abajo" onClick={() => setCuantas((n) => n + DE_A)}>
              {quedan > DE_A
                ? t("respuestas.verAnterioresDe", { n: DE_A, total: quedan })
                : t("respuestas.verAnteriores", { n: quedan })}
            </Boton>
          )}
          {cuantas > primeros && (
            <Boton variante="plano" icono="flecha-arriba" onClick={() => setCuantas(primeros)}>
              {t("respuestas.mostrarMenos")}
            </Boton>
          )}
        </div>
      )}
    </>
  );
}
