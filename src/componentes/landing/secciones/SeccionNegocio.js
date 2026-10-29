"use client";

import Icono from "@/componentes/Icono";
import Frase from "@/componentes/Frase";
import { DIAS, cortoDelDia, normalizarHorarios } from "@/lib/horarios";
import { useIdioma } from "@/lib/useIdioma";
import { linkDeLlamada, linkDeWhatsAppA } from "@/lib/seguimiento";

// "El negocio", en la landing: lo que cuenta de sí, cuándo atiende y cómo
// hablarle. El nombre no se repite: ya es el título de la página.
//
// Los horarios vienen null si el negocio no publicó los suyos (lo decide la
// API). Los botones van con borde y no en azul: el botón principal de la
// página es el de entrar o el de sacar turno, que es a lo que viene la gente.
const BOTON =
  "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-campo border-2 " +
  "border-borde-fuerte bg-tarjeta px-5 font-bold text-cuerpo text-tinta hover:bg-superficie";

export default function SeccionNegocio({ negocio, horarios }) {
  const { locale, t } = useIdioma();
  const h = normalizarHorarios(horarios);
  const dias = h ? DIAS.filter((d) => h.dias.includes(d.clave)).map((d) => cortoDelDia(d.diaJs, locale)) : [];
  // Lo que escribe el cliente por WhatsApp sale en su idioma.
  const whatsapp = linkDeWhatsAppA(negocio.telefono, t("landing.negocioSeccion.hola", { negocio: negocio.nombre }));
  const llamada = linkDeLlamada(negocio.telefono);

  if (!negocio.descripcion && dias.length === 0 && !llamada) {
    return <p className="mt-2 text-tinta-media">{t("landing.negocioSeccion.sinDatos", { negocio: negocio.nombre })}</p>;
  }

  return (
    <>
      {negocio.descripcion && (
        <p className="mt-2 max-w-[65ch] whitespace-pre-line text-tinta-media">{negocio.descripcion}</p>
      )}

      {dias.length > 0 && (
        <p className="mt-4 flex items-start gap-2 text-tinta-media">
          <Icono nombre="reloj" className="mt-0.5 size-5 shrink-0" />
          <span>
            <Frase
              texto={
                h.corte
                  ? t("landing.negocioSeccion.atiendeConCorte", {
                      desde: h.desde,
                      hasta: h.hasta,
                      corteDesde: h.corte.desde,
                      corteHasta: h.corte.hasta,
                    })
                  : t("landing.negocioSeccion.atiende", { desde: h.desde, hasta: h.hasta })
              }
              partes={{ dias: <span className="font-bold text-tinta">{dias.join(" · ")}</span> }}
            />
          </span>
        </p>
      )}

      {llamada && (
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
          <a href={whatsapp} target="_blank" rel="noreferrer" className={BOTON}>
            <Icono nombre="whatsapp" />
            {t("landing.negocioSeccion.whatsapp")}
          </a>
          {/* El número escrito y no sólo en el enlace: en una computadora
              "Llamar" puede no hacer nada, y ahí sirve poder leerlo. */}
          <a href={llamada} className={BOTON}>
            <Icono nombre="telefono" />
            {t("landing.negocioSeccion.llamar", { telefono: negocio.telefono })}
          </a>
        </div>
      )}
    </>
  );
}
