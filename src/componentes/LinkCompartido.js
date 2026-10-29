"use client";

// El link que el negocio reparte: armarlo, copiarlo, mandarlo por WhatsApp y
// dejar de compartirlo. Lo usan "Cuándo atendés" (el link para pedir turno) y
// el editor de la landing: el bloque es el mismo y cambian el código, la ruta
// y las palabras.
//
// Trae su propia tarjeta pero no el título, y no decide cuándo aparece: cada
// pantalla sabe si ya tiene sentido repartir el link (horarios, por ejemplo,
// lo muestra recién con los horarios publicados).
//
// Dejar de compartir pide confirmación porque el link deja de andar en el acto
// y quien ya lo tiene no puede volver a abrirlo.

import { useEffect, useState } from "react";
import { useDatos } from "@/lib/datos";
import { textoDeError } from "@/lib/idioma";
import { useIdioma } from "@/lib/useIdioma";
import { linkDeWhatsApp } from "@/lib/seguimiento";
import Icono from "@/componentes/Icono";
import { Boton, Campo, Tarjeta } from "@/componentes/ui";

// Props:
//   id          el id del campo con el link ("link-agenda")
//   codigo      el código ya publicado, o null si todavía no hay link
//   ruta        lo que va entre el origen y el código ("/turnos/")
//   icono       el del botón de armar el link
//   nombre      el del negocio, para el mensaje de WhatsApp
//   compartir / dejarDeCompartir
//               las acciones de datos.js: { ok } o { ok: false, error }
//   textos      todo lo que se lee y cambia de una pantalla a otra, ya
//               traducido por la pantalla que lo pasa. `whatsapp(nombre,
//               link)` arma el mensaje en el idioma de quien lo manda.
export default function LinkCompartido({
  id,
  codigo,
  ruta,
  icono,
  nombre,
  compartir,
  dejarDeCompartir,
  textos,
}) {
  const { avisarExito } = useDatos();
  const { idioma, t } = useIdioma();
  const [compartiendo, setCompartiendo] = useState(false);
  const [error, setError] = useState(null);
  const [cortando, setCortando] = useState(false);
  // El origen sale del navegador: así el link anda igual en localhost y el
  // día que esto se publique.
  const [origen, setOrigen] = useState("");
  useEffect(() => setOrigen(window.location.origin), []);

  // El link lleva el idioma de Mi perfil: las pantallas públicas no tienen
  // selector (docs/idioma-en-links-publicos.md).
  const link = origen && codigo ? `${origen}${ruta}${codigo}?idioma=${idioma}` : "";

  return (
    <Tarjeta className="mb-8">
      {error && (
        <p className="mb-3 flex items-start gap-2 font-bold text-rojo">
          <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
          <span>{textoDeError(t, error)}</span>
        </p>
      )}

      {!codigo ? (
        <>
          <p className="max-w-[65ch] text-tinta-media">{textos.explicacion}</p>
          <div className="mt-4">
            <Boton
              icono={icono}
              data-testid="link-armar"
              motivo={compartiendo ? t("casos.link.armando") : null}
              onClick={async () => {
                setError(null);
                setCompartiendo(true);
                const r = await compartir();
                setCompartiendo(false);
                if (!r.ok) return setError(r.error);
                avisarExito(textos.armado);
              }}
            >
              {textos.armar}
            </Boton>
          </div>
        </>
      ) : (
        <>
          <Campo
            id={id}
            etiqueta={textos.etiqueta}
            ayuda={t("casos.link.ayuda")}
            value={link}
            readOnly
            onFocus={(ev) => ev.target.select()}
          />

          <div className="-mt-2 flex flex-wrap gap-3">
            <Boton
              icono="copiar"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  avisarExito(t("casos.link.copiado"));
                } catch {
                  document.getElementById(id)?.select();
                  avisarExito(t("casos.link.seleccionado"));
                }
              }}
            >
              {t("casos.comun.copiarLink")}
            </Boton>
            <a
              href={linkDeWhatsApp(textos.whatsapp(nombre ?? t("casos.comun.tuNegocio"), link))}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 font-bold text-cuerpo text-tinta hover:bg-superficie"
            >
              <Icono nombre="chat" />
              {t("casos.comun.mandarWhatsapp")}
            </a>
          </div>

          {cortando ? (
            <div className="mt-4 rounded-tarjeta bg-superficie p-4">
              <p className="font-bold text-cuerpo">{textos.pregunta}</p>
              <p className="mt-1 max-w-[65ch] text-tinta-media">{textos.aviso}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Boton
                  variante="peligro"
                  icono="tacho"
                  data-testid="link-dejar-confirmar"
                  onClick={async () => {
                    setCortando(false);
                    const r = await dejarDeCompartir();
                    if (!r.ok) return setError(r.error);
                    avisarExito(textos.cortado);
                  }}
                >
                  {t("casos.link.siDejar")}
                </Boton>
                <Boton variante="plano" onClick={() => setCortando(false)}>
                  {t("casos.link.seguir")}
                </Boton>
              </div>
            </div>
          ) : (
            <div className="mt-2">
              <Boton variante="plano" icono="tacho" onClick={() => setCortando(true)} data-testid="link-dejar">
                {textos.dejar}
              </Boton>
            </div>
          )}
        </>
      )}
    </Tarjeta>
  );
}
