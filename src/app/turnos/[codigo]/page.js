"use client";

// "Pedir un turno" — la pantalla pública de la agenda.
//
// La abre gente que nunca vio la aplicación, desde un link que el negocio
// puso en su Instagram o mandó por WhatsApp. Sin cuenta, sin instalar nada,
// casi siempre desde el celular.
//
// Es la segunda pantalla pública del sistema y sigue las mismas reglas que la
// de seguimiento: sin navegación, sin nada que lleve adentro del sistema, y
// todo lo que necesita explicación explicado ahí mismo.
//
// LA DECISIÓN DE FORMA:
// Primero el día, después la hora, después los datos. Tres pasos y no un
// formulario entero, porque elegir el horario es lo que la persona vino a
// hacer y pedirle el nombre antes de mostrarle si hay lugar es pedirle que
// trabaje antes de saber si sirve de algo.
//
// Los días van en un calendario de un mes, como el de cualquier aplicación
// de turnos: los días con lugar marcados, los demás tachados. Tocás un día y
// abajo aparecen sólo sus horarios, partidos en mañana y tarde. Antes era una
// tarjeta por día con todos sus horarios, y con tres semanas de agenda la
// pantalla se volvía una lista interminable donde no se encontraba nada.
//
// Los horarios que se ofrecen los calcula src/lib/horarios.js con lo que
// manda la base: los horarios del negocio y los turnos ya tomados. La base
// vuelve a hacer la cuenta al reservar, porque lo que llega del navegador no
// se puede creer.

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { buscarAgenda, reservarTurno } from "@/lib/datos";
import { huecosLibres, normalizarHorarios } from "@/lib/horarios";
import { preset } from "@/lib/presets";
import { diaPasado, diaPasadoEnFrase } from "@/lib/fechas";
import { conElementos } from "@/lib/conElementos";
import { textoDeError } from "@/lib/idioma";
import { useIdioma } from "@/lib/useIdioma";
import { telefonoLegible, telefonoParaLlamar } from "@/lib/telefono";
import Icono from "@/componentes/Icono";
import SelectorIdioma from "@/componentes/SelectorIdioma";
import CalendarioDeTurnos, { comoHora } from "@/componentes/CalendarioDeTurnos";
import { Boton, Campo, Cargando } from "@/componentes/ui";

export default function PedirTurno() {
  const { codigo } = useParams();
  // Es la pantalla del cliente del negocio: sale en el idioma de su navegador
  // (o el que eligió abajo), no en el del negocio.
  const { idioma, locale, t } = useIdioma();
  const [mirando, setMirando] = useState(true);
  const [agenda, setAgenda] = useState(null);

  const [elegido, setElegido] = useState(null);
  const datosRef = useRef(null);
  const [motivo, setMotivo] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [problema, setProblema] = useState(null);
  const [listo, setListo] = useState(null);

  useEffect(() => {
    document.title = agenda?.negocio_nombre
      ? `${t("turnos.publica.titulo")} · ${agenda.negocio_nombre}`
      : t("turnos.publica.titulo");
  }, [agenda, t]);

  const traer = useCallback(async () => {
    const r = await buscarAgenda(codigo);
    setAgenda(r);
    setMirando(false);
  }, [codigo]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await buscarAgenda(codigo);
      if (vivo) {
        setAgenda(r);
        setMirando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [codigo]);

  const hayElegido = Boolean(elegido);
  useEffect(() => {
    if (hayElegido) datosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hayElegido]);

  async function pedir() {
    setProblema(null);
    setGuardando(true);
    const r = await reservarTurno({
      codigo,
      cuando: elegido,
      motivo: motivo.trim(),
      nombre: nombre.trim(),
      telefono: telefono.trim(),
    });
    setGuardando(false);

    if (!r.ok) {
      setProblema(r.error ?? r.motivo);
      // Si el horario se lo ganaron, la lista que está viendo quedó vieja.
      await traer();
      setElegido(null);
      return;
    }

    setListo({ cuando: new Date(r.cuando), motivo: motivo.trim() });
  }

  if (mirando) {
    return (
      <Marco>
        <Cargando filas={2} />
      </Marco>
    );
  }

  // No es lo mismo que el link no sirva que no haber podido preguntar: si la
  // API no contestó, se dice eso, y el link puede andar en un rato.
  if (!agenda?.sirve && agenda?.problema) {
    return (
      <Marco>
        <Tarjetita titulo={t("turnos.publica.noAbrio")} icono="alerta">
          {textoDeError(t, agenda.error ?? agenda.problema)}
        </Tarjetita>
      </Marco>
    );
  }

  if (!agenda?.sirve) {
    return (
      <Marco>
        <Tarjetita titulo={t("turnos.publica.linkNoSirve")} icono="alerta">
          {t("turnos.publica.linkNoSirveTexto")}
        </Tarjetita>
      </Marco>
    );
  }

  const horarios = normalizarHorarios(agenda.horarios);

  // Ya reservó: de acá no se sigue a ningún lado. Lo único que queda es la
  // constancia de qué pidió y para cuándo.
  if (listo) {
    return (
      <Marco negocio={agenda.negocio_nombre}>
        <div className="overflow-hidden rounded-tarjeta border-2 border-completo bg-completo-fondo">
          <div className="p-5 sm:p-6">
            <p className="flex items-center gap-2 font-titulo font-extrabold text-seccion text-completo">
              <Icono nombre="listo" className="size-7 shrink-0" />
              {t("turnos.publica.listo")}
            </p>
            <p className="mt-4 font-titulo font-extrabold text-ident first-letter:uppercase">
              {t("turnos.cuando", { dia: diaPasado(listo.cuando, locale, t), hora: comoHora(listo.cuando) })}
            </p>
            <p className="mt-1 text-tinta-media">{listo.motivo}</p>
            <p className="mt-4 max-w-[65ch] text-tinta-media">
              {t("turnos.publica.yaLoVe", { negocio: agenda.negocio_nombre })}
            </p>
            {agenda.negocio_telefono && (
              <p className="mt-2 text-tinta-media">
                {conElementos(t("turnos.publica.suTelefono"), {
                  telefono: (
                    <a
                      href={`tel:${telefonoParaLlamar(agenda.negocio_telefono)}`}
                      className="font-bold text-azul"
                    >
                      {telefonoLegible(agenda.negocio_telefono)}
                    </a>
                  ),
                })}
              </p>
            )}
          </div>
        </div>
      </Marco>
    );
  }

  if (!horarios) {
    return (
      <Marco negocio={agenda.negocio_nombre}>
        <Tarjetita titulo={t("turnos.publica.sinHorarios")} icono="reloj">
          {t("turnos.publica.sinHorariosTexto", { negocio: agenda.negocio_nombre })}
        </Tarjetita>
      </Marco>
    );
  }

  // Con los turnos por la API, los huecos ya vienen calculados por la API
  // (que es la que después decide si se puede reservar). Si no vinieran, se
  // calculan acá como siempre.
  const dias =
    agenda.dias ??
    huecosLibres({
      horarios,
      turnos: (agenda.ocupados ?? []).map((o) => ({ ...o, estado: "agendado" })),
    });

  const motivos = preset(agenda.rubro, idioma).motivos;
  const faltan = !elegido
    ? t("turnos.publica.faltaHorario")
    : !motivo.trim()
      ? t("turnos.publica.faltaMotivo")
      : !nombre.trim()
        ? t("turnos.publica.faltaNombre")
        : null;

  return (
    <Marco negocio={agenda.negocio_nombre}>
      <h1 className="text-ident">{t("turnos.publica.titulo")}</h1>
      <p className="mt-1 max-w-[65ch] text-tinta-media">
        {t("turnos.publica.intro")}
      </p>

      {problema && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-campo bg-espera-fondo p-4 font-bold text-espera"
        >
          <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
          <span>{textoDeError(t, problema)}</span>
        </p>
      )}

      {dias.length === 0 ? (
        <div className="mt-6">
          <Tarjetita titulo={t("turnos.publica.sinLugar")} icono="reloj">
            {t("turnos.publica.sinLugarTexto", { negocio: agenda.negocio_nombre })}
          </Tarjetita>
        </div>
      ) : (
        <>
          <CalendarioDeTurnos
            dias={dias}
            elegido={elegido}
            onElegir={(cuando) => {
              if (cuando) setProblema(null);
              setElegido(cuando);
            }}
          />

          {/* Los datos recién cuando ya eligió: pedirle el nombre antes de que
              sepa si hay lugar es pedirle que trabaje sin saber si sirve. */}
          {elegido && (
            <>
              <h2 ref={datosRef} className="mt-10 mb-1 scroll-mt-4 text-seccion">
                {t("turnos.publica.tusDatos")}
              </h2>
              <p className="mb-4 max-w-[65ch] text-tinta-media">
                {conElementos(t("turnos.publica.pediste", { minutos: horarios.minutos }), {
                  cuando: (
                    <span className="font-bold text-tinta">
                      {t("turnos.cuando", {
                        dia: diaPasadoEnFrase(new Date(elegido), locale, t),
                        hora: comoHora(new Date(elegido)),
                      })}
                    </span>
                  ),
                })}
              </p>

              <div className="rounded-tarjeta border border-borde bg-tarjeta p-4 sm:p-5">
                <Campo
                  id="motivo"
                  etiqueta={t("turnos.publica.paraQue")}
                  ayuda={t("turnos.publica.paraQueAyuda")}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  autoComplete="off"
                />
                <div className="-mt-3 mb-6">
                  <ul className="flex flex-wrap gap-2">
                    {motivos.map((m) => (
                      <li key={m}>
                        <button
                          type="button"
                          onClick={() => setMotivo(m)}
                          className={[
                            "min-h-12 cursor-pointer rounded-full border-2 px-4 text-etiqueta",
                            motivo === m
                              ? "border-azul bg-azul-claro font-bold text-azul"
                              : "border-borde bg-tarjeta text-tinta-media hover:bg-superficie",
                          ].join(" ")}
                        >
                          {m}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <Campo
                  id="nombre"
                  etiqueta={t("turnos.publica.nombre")}
                  ayuda={t("turnos.publica.nombreAyuda")}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  autoComplete="name"
                />
                <Campo
                  id="telefono"
                  etiqueta={t("turnos.publica.telefono")}
                  ayuda={t("turnos.publica.telefonoAyuda")}
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                />

                <Boton
                  variante="principal"
                  icono="calendario"
                  className="min-h-14 w-full sm:min-h-12 sm:w-auto"
                  motivo={guardando ? t("turnos.publica.anotandote") : faltan}
                  onClick={pedir}
                >
                  {t("turnos.publica.pedir")}
                </Boton>
              </div>
            </>
          )}
        </>
      )}
    </Marco>
  );
}

function Tarjetita({ titulo, icono, children }) {
  return (
    <div className="rounded-tarjeta border border-borde bg-tarjeta p-6">
      <p className="flex items-start gap-3 font-titulo font-extrabold text-seccion">
        <Icono nombre={icono} className="mt-1 size-7 shrink-0 text-espera" />
        <span>{titulo}</span>
      </p>
      <p className="mt-3 max-w-[65ch] text-tinta-media">{children}</p>
    </div>
  );
}

// El mismo marco que la pantalla de seguimiento: a sangre completa, sin la
// navegación del sistema, columna angosta porque se abre en un celular.
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
            <p className="truncate font-titulo font-extrabold text-subtitulo leading-tight">
              {negocio ?? t("turnos.publica.titulo")}
            </p>
            <p className="text-apoyo text-tinta-suave">{t("turnos.publica.titulo")}</p>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[640px] px-4 py-6 sm:py-8">
        {children}
        <div className="mt-4">
          <SelectorIdioma />
        </div>
      </main>
    </div>
  );
}
