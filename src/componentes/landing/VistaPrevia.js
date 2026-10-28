"use client";

import Lienzo from "./Lienzo";
import Icono from "@/componentes/Icono";
import { useIdioma } from "@/lib/useIdioma";

// La landing en chico, con datos de ejemplo, para ver cómo queda mientras se
// edita. Es una imitación: los botones son de mentira (no se pueden tocar ni
// enfocar). Las secciones de la página pública (landing/secciones/) no la
// reemplazan: necesitan los datos del negocio y la llave de un cliente, y acá
// no hay ni una cosa ni la otra. Los títulos sí son los mismos.

function Seccion({ titulo, children }) {
  return (
    // Sin la clase rounded-tarjeta a propósito: el degradé y el reborde del
    // tema (src/lib/tema.js) buscan esa clase, y la vista previa muestra las
    // cajas del negocio, no las de quien edita. Mismo radio, por la variable.
    <section className="rounded-[var(--radius-tarjeta)] border border-borde bg-tarjeta p-4">
      <h3 className="text-subtitulo font-extrabold">{titulo}</h3>
      <div className="mt-2 grid justify-items-start gap-2 text-tinta-media">{children}</div>
    </section>
  );
}

function BotonDeMentira({ icono, children }) {
  return (
    <span className="inline-flex min-h-11 items-center gap-2 rounded-campo bg-azul px-4 font-bold text-white">
      {icono && <Icono nombre={icono} className="size-5" />}
      {children}
    </span>
  );
}

// Todo lo que muestra son datos de ejemplo del editor: los textos fijos salen
// del diccionario (landing.vistaPrevia.*).
const CONTENIDO = {
  negocio: (negocio, t) => (
    <>
      <p>{negocio?.telefono || "341 555 1234"}</p>
      <p>{t("landing.vistaPrevia.horario")}</p>
      <BotonDeMentira icono="whatsapp">{t("landing.vistaPrevia.escribinos")}</BotonDeMentira>
    </>
  ),
  sacar_turno: (_negocio, t) => (
    <>
      <div className="flex flex-wrap gap-2">
        {["d1", "d2", "d3"].map((dia) => (
          <span key={dia} className="rounded-campo bg-azul-claro px-3 py-2 font-bold text-azul">
            {t(`landing.vistaPrevia.dias.${dia}`)}
          </span>
        ))}
      </div>
      <BotonDeMentira>{t("landing.vistaPrevia.pedirTurno")}</BotonDeMentira>
    </>
  ),
  mis_casos: (_negocio, t) => (
    <>
      <p className="flex flex-wrap items-center gap-2 text-tinta">
        {t("casos.nombre.caso", { numero: 248 })}
        <span className="lienzo-acento rounded-full px-3 py-1 font-bold text-etiqueta">
          {t("landing.vistaPrevia.enProceso")}
        </span>
      </p>
      <span className="font-bold text-azul">{t("landing.vistaPrevia.verComoViene")}</span>
    </>
  ),
  mis_turnos: (_negocio, t) => <p>{t("landing.vistaPrevia.turno")}</p>,
};

export default function VistaPrevia({ landing, negocio, secciones }) {
  const { t } = useIdioma();
  return (
    <figure>
      <figcaption className="mb-2 font-bold text-etiqueta text-tinta-media">
        {t("landing.vistaPrevia.asiLaVe")}
      </figcaption>
      <Lienzo landing={landing} className="mx-auto max-w-sm rounded-tarjeta border border-borde-fuerte p-4">
        <h2 className="text-seccion font-extrabold">{negocio?.nombre ?? t("landing.vistaPrevia.tuNegocio")}</h2>
        <div className="mt-4 grid gap-3">
          {secciones.map((s) => (
            <Seccion key={s.clave} titulo={s.nombre}>
              {CONTENIDO[s.clave](negocio, t)}
            </Seccion>
          ))}
        </div>
      </Lienzo>
    </figure>
  );
}
