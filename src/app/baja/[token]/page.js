"use client";

// "Dejar de recibir avisos" — el link de baja de los mails (083,
// docs/avisos-por-mail-plan.md, FRONT-3).
//
// Lo abre el cliente del negocio desde un mail: sin cuenta y sin sesión.
// Abrirlo no da de baja: lo hace el botón. Los antivirus de los mails abren
// todos los links para revisarlos, y uno que diera de baja solo dejaría sin
// avisos a quien no lo pidió. Gmail y Outlook no pasan por acá: su "Anular
// suscripción" le pega directo a la API (List-Unsubscribe).
//
// No se muestra nada del caso ni del cliente: el nombre del negocio, para que
// sepa de quién son los avisos, y su rubro, para decirlo con sus palabras.
// Un link que no existe y uno mal copiado se ven igual.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { usarBajaPorLink, verBajaPorLink } from "@/lib/datos";
import { vocabulario } from "@/lib/presets";
import { useIdioma } from "@/lib/useIdioma";
import Icono from "@/componentes/Icono";
import { Boton, Cargando } from "@/componentes/ui";

export default function BajaPorLink() {
  const { token } = useParams();
  const { idioma, t } = useIdioma();
  const [vista, setVista] = useState(null);
  const [mandando, setMandando] = useState(false);
  const [recien, setRecien] = useState(false);

  useEffect(() => {
    let vivo = true;
    verBajaPorLink(token).then((r) => vivo && setVista(r));
    return () => {
      vivo = false;
    };
  }, [token]);

  const negocio = vista?.negocio?.nombre || t("baja.elNegocio");
  useEffect(() => {
    document.title = vista?.sirve ? `${t("baja.titulo")} · ${negocio}` : t("baja.titulo");
  }, [vista, negocio, t]);

  async function darDeBaja() {
    setMandando(true);
    const r = await usarBajaPorLink(token);
    setMandando(false);
    setVista(r);
    if (r.sirve) setRecien(true);
  }

  if (!vista) {
    return (
      <Marco>
        <Cargando filas={2} />
      </Marco>
    );
  }

  if (vista.problema) {
    return (
      <Marco>
        <Mensaje icono="alerta" titulo={t("baja.noPudimosTitulo")}>{t("baja.noPudimosTexto")}</Mensaje>
      </Marco>
    );
  }

  if (!vista.sirve) {
    return (
      <Marco>
        <Mensaje icono="alerta" titulo={t("baja.noSirveTitulo")}>{t("baja.noSirveTexto")}</Mensaje>
      </Marco>
    );
  }

  const { cita } = vocabulario(vista.negocio.rubro, idioma);
  const citas = cita?.palabra(2) ?? t("baja.turnos");

  if (vista.de_baja) {
    return (
      <Marco negocio={negocio}>
        <Mensaje icono="listo" titulo={recien ? t("baja.listoTitulo") : t("baja.yaEstabaTitulo")}>
          {t("baja.listoTexto", { negocio, citas })}
        </Mensaje>
      </Marco>
    );
  }

  return (
    <Marco negocio={negocio}>
      <Mensaje icono="sobre" titulo={t("baja.pregunta", { negocio })}>
        {t("baja.queSignifica", { citas })}
      </Mensaje>
      <div className="mt-6">
        <Boton
          variante="principal"
          icono="check"
          data-testid="baja-confirmar"
          motivo={mandando ? t("baja.mandando") : null}
          onClick={darDeBaja}
        >
          {t("baja.confirmar")}
        </Boton>
        <p className="mt-3 max-w-[65ch] text-apoyo text-tinta-suave">{t("baja.siNo")}</p>
      </div>
    </Marco>
  );
}

function Mensaje({ icono, titulo, children }) {
  return (
    <div className="flex items-start gap-3">
      <Icono nombre={icono} className="mt-1 size-6 shrink-0 text-azul" />
      <div className="min-w-0">
        <h1 className="font-titulo font-extrabold text-subtitulo leading-tight">{titulo}</h1>
        <p className="mt-2 max-w-[65ch] text-tinta-media">{children}</p>
      </div>
    </div>
  );
}

function Marco({ negocio, children }) {
  const { t } = useIdioma();
  return (
    <div className="min-h-screen bg-fondo">
      <header className="border-b border-borde bg-tarjeta">
        <div className="mx-auto flex w-full max-w-[640px] items-center gap-3 px-4 py-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-campo bg-azul text-white">
            <Icono nombre="tienda" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-titulo font-extrabold text-subtitulo leading-tight">{negocio ?? t("baja.elNegocio")}</p>
            <p className="text-apoyo text-tinta-suave">{t("baja.titulo")}</p>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[640px] px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
