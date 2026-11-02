"use client";

// "Tu turno" — contestar el recordatorio del turno desde el mail (085,
// docs/avisos-por-mail-plan.md, API-6).
//
// Por WhatsApp el recordatorio trae dos botones, «Confirmo» y «Cancelo». Por
// mail trae un link a esta página, con los mismos dos. Lo abre el cliente del
// negocio: sin cuenta y sin sesión. Abrirla no contesta nada; los botones sí.
// Cancelar pide confirmarlo una vez, porque deja el lugar libre.
//
// Se muestra lo justo para contestar: de qué negocio es y cuándo es el turno.
// Un link contesta una sola vez; después muestra lo que se contestó.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { responderTurnoPorLink, verTurnoPorLink } from "@/lib/datos";
import { diaLargoEnFrase, horaYMinutos } from "@/lib/fechas";
import { vocabulario } from "@/lib/presets";
import { telefonoLegible, telefonoParaLlamar } from "@/lib/telefono";
import { useIdioma } from "@/lib/useIdioma";
import Icono from "@/componentes/Icono";
import { Boton, Cargando } from "@/componentes/ui";

export default function TurnoPorLink() {
  const { token } = useParams();
  const { idioma, locale, t } = useIdioma();
  const [vista, setVista] = useState(null);
  const [mandando, setMandando] = useState(null);
  const [cancelando, setCancelando] = useState(false);

  useEffect(() => {
    let vivo = true;
    verTurnoPorLink(token).then((r) => vivo && setVista(r));
    return () => {
      vivo = false;
    };
  }, [token]);

  const negocio = vista?.negocio?.nombre || t("baja.elNegocio");
  const { cita } = vocabulario(vista?.negocio?.rubro, idioma);
  const palabra = cita?.palabra() ?? t("turnoPorLink.turno");
  useEffect(() => {
    document.title = vista?.sirve ? `${t("turnoPorLink.titulo", { cita: palabra })} · ${negocio}` : t("turnoPorLink.titulo", { cita: palabra });
  }, [vista, negocio, palabra, t]);

  async function contestar(respuesta) {
    setMandando(respuesta);
    const r = await responderTurnoPorLink(token, respuesta);
    setMandando(null);
    setCancelando(false);
    setVista(r);
  }

  if (!vista) {
    return (
      <Marco titulo={t("turnoPorLink.titulo", { cita: palabra })}>
        <Cargando filas={2} />
      </Marco>
    );
  }

  const titulo = t("turnoPorLink.titulo", { cita: palabra });
  if (vista.problema) {
    return (
      <Marco titulo={titulo}>
        <Mensaje icono="alerta" titulo={t("baja.noPudimosTitulo")}>{t("baja.noPudimosTexto")}</Mensaje>
      </Marco>
    );
  }
  if (!vista.sirve) {
    return (
      <Marco titulo={titulo}>
        <Mensaje icono="alerta" titulo={t("baja.noSirveTitulo")}>{t("baja.noSirveTexto")}</Mensaje>
      </Marco>
    );
  }

  const cuando = {
    dia: diaLargoEnFrase(vista.turno.empieza_en, locale, t),
    hora: horaYMinutos(vista.turno.empieza_en, locale),
  };
  const telefono = vista.negocio.telefono;
  const llamar = telefono && (
    <p className="mt-6 max-w-[65ch] text-tinta-media">
      {t("turnoPorLink.paraCambiarlo", { negocio })}{" "}
      <a href={`tel:${telefonoParaLlamar(telefono)}`} className="font-bold text-azul">
        {telefonoLegible(telefono)}
      </a>
      .
    </p>
  );

  if (vista.respuesta === "confirmo") {
    return (
      <Marco negocio={negocio} titulo={titulo}>
        <Mensaje icono="listo" titulo={vista.recien ? t("turnoPorLink.confirmadoTitulo") : t("turnoPorLink.yaConfirmasteTitulo")}>
          {t("turnoPorLink.confirmadoTexto", { negocio, ...cuando })}
        </Mensaje>
        {llamar}
      </Marco>
    );
  }
  if (vista.respuesta === "cancelo") {
    return (
      <Marco negocio={negocio} titulo={titulo}>
        <Mensaje icono="listo" titulo={vista.recien ? t("turnoPorLink.canceladoTitulo") : t("turnoPorLink.yaCancelasteTitulo")}>
          {t("turnoPorLink.canceladoTexto", { negocio, cita: palabra })}
        </Mensaje>
        {llamar}
      </Marco>
    );
  }
  if (!vista.en_pie) {
    return (
      <Marco negocio={negocio} titulo={titulo}>
        <Mensaje icono="alerta" titulo={t("turnoPorLink.yaNoTitulo")}>{t("turnoPorLink.yaNoTexto")}</Mensaje>
        {llamar}
      </Marco>
    );
  }

  return (
    <Marco negocio={negocio} titulo={titulo}>
      <Mensaje icono="calendario" titulo={t("turnoPorLink.pregunta", { cita: palabra, ...cuando })}>
        {t("turnoPorLink.queHacer", { negocio })}
      </Mensaje>
      {cancelando ? (
        <div className="mt-6" data-turno-seguro-cancelar>
          <p className="max-w-[65ch] font-bold">{t("turnoPorLink.seguroCancelar")}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Boton icono="cruz" data-testid="turno-cancelar-si" motivo={mandando ? t("turnoPorLink.mandando") : null}
              onClick={() => contestar("cancelo")}>
              {t("turnoPorLink.siCancelar")}
            </Boton>
            <Boton variante="plano" onClick={() => setCancelando(false)}>{t("turnoPorLink.noCancelar")}</Boton>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap gap-3">
          <Boton variante="principal" icono="check" data-testid="turno-confirmo"
            motivo={mandando ? t("turnoPorLink.mandando") : null} onClick={() => contestar("confirmo")}>
            {t("turnoPorLink.confirmo")}
          </Boton>
          <Boton icono="cruz" data-testid="turno-cancelo" onClick={() => setCancelando(true)}>
            {t("turnoPorLink.cancelo")}
          </Boton>
        </div>
      )}
      {llamar}
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

function Marco({ negocio, titulo, children }) {
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
            <p className="text-apoyo text-tinta-suave">{titulo}</p>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[640px] px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
