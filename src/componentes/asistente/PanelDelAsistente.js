"use client";

// El Asistente como panel (src/lib/asistente.js): un chat para preguntar cómo
// se usa la app, contar un problema o pedir que configure el negocio, SIN
// dejar la pantalla en la que se está trabajando.
//
// Cómo se ve, según el modo de ContextoAsistente:
//   cerrado  -> sólo el botón "Asistente", abajo a la derecha (computadora).
//               En el celular se abre desde "Más": un botón flotante taparía
//               el botón principal fijo de cada pantalla.
//   panel    -> computadora ancha: una columna a la derecha que achica el
//               contenido, así no tapa nada de lo que se está configurando.
//               Computadora angosta: una tarjeta flotante a la derecha.
//               Celular: ocupa la pantalla (no hay lugar para otra cosa).
//   completo -> toda la pantalla, para leer tranquilo. "Achicar" vuelve al
//               panel con la conversación igual.
//
// Lo que propone cambiar no se aplica solo: aparece en una tarjeta con lo que
// va a cambiar y dos botones. Sólo "Aplicar" escribe, y escribe por las
// mismas acciones que usan las pantallas de Mi negocio.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import { textoDeError } from "@/lib/idioma";
import { puede } from "@/lib/permisos";
import { useIdioma } from "@/lib/useIdioma";
import { describirPropuesta, igualA, leerVariable, partirTexto, prendidoEn } from "@/lib/asistente";
import Icono from "@/componentes/Icono";
import { Boton, Cargando, ErrorGeneral } from "@/componentes/ui";
import { useAsistente } from "./ContextoAsistente";

const SUGERENCIAS = ["modulos", "noVeo", "estados", "ecuaciones", "personalizable"];

// El botón para abrirlo, con ícono Y palabra (cartilla, sección 06). Sólo en
// computadora y sólo con el panel cerrado.
export function BotonDelAsistente() {
  const { t } = useIdioma();
  const { modo, abrir } = useAsistente();
  const boton = useRef(null);
  const antes = useRef(modo);

  // Al cerrar el panel el foco vuelve acá, de donde se abrió.
  useEffect(() => {
    if (antes.current !== "cerrado" && modo === "cerrado") boton.current?.focus();
    antes.current = modo;
  }, [modo]);

  if (modo !== "cerrado") return null;
  return (
    <button
      ref={boton}
      type="button"
      onClick={abrir}
      aria-controls="panel-asistente"
      aria-expanded={false}
      className="fixed right-6 bottom-6 z-30 hidden min-h-14 cursor-pointer items-center gap-2 rounded-full bg-azul px-5 font-bold text-white shadow-lg hover:brightness-110 md:flex"
    >
      {/* La mascota es azul como el botón: el círculo claro la despega. */}
      <img src="/asistente.png" alt="" className="size-10 rounded-full bg-fondo" />
      {t("asistente.titulo")}
    </button>
  );
}

export function PanelDelAsistente() {
  const { t } = useIdioma();
  const asistente = useAsistente();
  const { modo, pedidoDeFoco, cerrar, agrandar, achicar, conversacion, empezarDeNuevo } = asistente;
  const panel = useRef(null);
  const completo = modo === "completo";

  // Al abrirlo o agrandarlo, el foco va al campo para escribir: se abrió
  // para preguntar.
  useEffect(() => {
    if (!pedidoDeFoco) return;
    panel.current?.querySelector("textarea")?.focus();
  }, [pedidoDeFoco]);

  // A pantalla completa la página de atrás no se mueve.
  useEffect(() => {
    if (!completo) return;
    const raiz = document.documentElement;
    const antes = raiz.style.overflow;
    raiz.style.overflow = "hidden";
    return () => {
      raiz.style.overflow = antes;
    };
  }, [completo]);

  if (modo === "cerrado") return null;

  // Escape achica la pantalla completa, y con el panel chico lo cierra. Sólo
  // con el foco adentro: afuera, Escape es de la pantalla de trabajo.
  const alTeclado = (e) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    if (completo) achicar();
    else cerrar();
  };

  const ubicacion = completo
    ? "fixed inset-0 z-40"
    : [
        // Celular: toda la pantalla.
        "fixed inset-0 z-40",
        // Computadora angosta: tarjeta flotante a la derecha.
        "md:inset-auto md:top-4 md:right-4 md:bottom-4 md:w-[26rem] md:rounded-tarjeta md:border md:border-borde md:shadow-2xl",
        // Computadora ancha: columna al costado del contenido, que se achica.
        "lg:sticky lg:top-0 lg:z-20 lg:h-dvh lg:w-[26rem] lg:shrink-0 lg:self-start lg:rounded-none lg:border-0 lg:border-l lg:shadow-none",
      ].join(" ");

  return (
    <aside
      ref={panel}
      id="panel-asistente"
      aria-labelledby="panel-asistente-titulo"
      onKeyDown={alTeclado}
      className={`${ubicacion} flex flex-col overflow-hidden bg-fondo`}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-borde px-3 py-2">
        <h2 id="panel-asistente-titulo" className="mr-auto flex items-center gap-2 pl-1 font-titulo text-subtitulo font-extrabold">
          <img src="/asistente.png" alt="" className="size-8" />
          {t("asistente.titulo")}
        </h2>
        {/* Pantalla completa sólo tiene sentido en computadora: en el celular
            el panel ya ocupa todo. */}
        <button
          type="button"
          onClick={completo ? achicar : agrandar}
          className="hidden min-h-12 cursor-pointer items-center gap-2 rounded-campo border-2 border-borde-fuerte px-3 font-bold text-azul hover:bg-azul-claro md:flex"
        >
          <Icono nombre={completo ? "achicar" : "agrandar"} className="size-5" />
          {completo ? t("asistente.achicar") : t("asistente.pantallaCompleta")}
        </button>
        <button
          type="button"
          onClick={cerrar}
          className="flex min-h-12 cursor-pointer items-center gap-2 rounded-campo px-3 font-bold text-tinta-media hover:bg-superficie"
        >
          <Icono nombre="cruz" className="size-5" />
          {t("asistente.cerrarPanel")}
        </button>
      </header>

      <Conversacion
        completo={completo}
        alEmpezarDeNuevo={conversacion.length > 0 ? empezarDeNuevo : null}
      />
    </aside>
  );
}

function Conversacion({ completo, alEmpezarDeNuevo }) {
  const datos = useDatos();
  const { cargando, negocio } = datos;
  const { usuario } = useAuth();
  const { t, idioma } = useIdioma();
  const {
    conversacion, pensando, aplicando, agregando, error,
    mandarMensaje, aplicar, descartar, agregarEcuacion, agregarTodas,
  } = useAsistente();
  const [borrador, setBorrador] = useState("");
  const lista = useRef(null);
  const campo = useRef(null);

  // Se baja la lista del panel, no la página: con scrollIntoView se movía
  // también la pantalla de trabajo de atrás.
  useEffect(() => {
    const el = lista.current;
    if (el) el.scrollTo?.({ top: el.scrollHeight, behavior: "smooth" });
  }, [conversacion.length, pensando]);

  if (cargando) return <div className="flex-1 p-4"><Cargando /></div>;

  const puedeConfigurar = puede(usuario, "configurar_negocio");
  // Crear ecuaciones pide lo mismo que la pantalla de Ecuaciones.
  const puedeEcuaciones = puede(usuario, "armar_presupuesto");
  const ecuacionesPrendido = prendidoEn("ecuaciones", negocio?.modulos_activos ?? []);
  const guardadas = datos.ecuaciones ?? [];

  async function mandar(texto) {
    if (!texto.trim() || pensando) return;
    setBorrador("");
    await mandarMensaje(texto);
    campo.current?.focus();
  }

  // A pantalla completa los mensajes van en una columna cómoda de leer, no
  // de punta a punta de la pantalla.
  const columna = completo ? "mx-auto w-full max-w-3xl" : "w-full";

  return (
    <>
      <div ref={lista} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
        <div className={columna}>
          {conversacion.length === 0 && (
            <section className="rounded-tarjeta border border-borde bg-tarjeta p-4">
              <p className="font-bold text-subtitulo">{t("asistente.vacioTitulo")}</p>
              <p className="mt-2 text-tinta-media">{t("asistente.apoyo")}</p>
              <p className="mt-2 text-tinta-media">{t("asistente.vacioTexto")}</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {SUGERENCIAS.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => mandar(t(`asistente.sugerencias.${s}`))}
                      className="min-h-12 cursor-pointer rounded-full border-2 border-borde-fuerte bg-tarjeta px-4 py-2 text-left font-bold text-azul hover:bg-azul-claro"
                    >
                      {t(`asistente.sugerencias.${s}`)}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <ol className="grid gap-4" aria-live="polite">
            {conversacion.map((m, i) => (
              <li key={i} className={m.rol === "usuario" ? "flex justify-end" : "flex justify-start"}>
                <div className={m.rol === "usuario" ? "max-w-[90%]" : "w-full"}>
                  <p className={`mb-1 text-etiqueta font-bold text-tinta-suave ${m.rol === "usuario" ? "text-right" : ""}`}>
                    {m.rol === "usuario" ? t("asistente.vos") : t("asistente.nombre")}
                  </p>
                  <div
                    className={
                      m.rol === "usuario"
                        ? "whitespace-pre-wrap break-words rounded-tarjeta bg-azul px-4 py-3 text-white"
                        : "break-words rounded-tarjeta border border-borde bg-tarjeta px-4 py-3"
                    }
                  >
                    {m.rol === "usuario" ? m.texto : <TextoDelAsistente texto={m.texto} />}
                  </div>
                  {m.ecuaciones?.length > 0 && (
                    <EcuacionesPropuestas
                      ecuaciones={m.ecuaciones}
                      guardadas={guardadas}
                      puedeEcuaciones={puedeEcuaciones}
                      moduloPrendido={ecuacionesPrendido}
                      agregando={agregando}
                      prefijo={i}
                      ocupado={agregando !== null || pensando}
                      alAgregar={(k, opciones) => agregarEcuacion(i, k, opciones)}
                      alAgregarTodas={() => agregarTodas(i)}
                      t={t}
                    />
                  )}
                  {m.propuesta && (
                    <Propuesta
                      mensaje={m}
                      renglones={describirPropuesta(m.propuesta, negocio, { idioma, t })}
                      puedeConfigurar={puedeConfigurar}
                      aplicando={aplicando === i}
                      ocupado={aplicando !== null || pensando}
                      alAplicar={() => aplicar(i)}
                      alDescartar={() => descartar(i)}
                      t={t}
                    />
                  )}
                </div>
              </li>
            ))}
            {pensando && (
              <li className="flex justify-start">
                <p className="flex items-center gap-2 rounded-tarjeta border border-borde bg-tarjeta px-4 py-3 text-tinta-media">
                  <span className="inline-block size-3 animate-pulse rounded-full bg-azul" aria-hidden="true" />
                  {t("asistente.pensando")}
                </p>
              </li>
            )}
          </ol>

          {error && (
            <div className="mt-4">
              <ErrorGeneral>{textoDeError(t, error)}</ErrorGeneral>
            </div>
          )}
        </div>
      </div>

      <form
        className="border-t border-borde bg-fondo px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
        onSubmit={(e) => {
          e.preventDefault();
          mandar(borrador);
        }}
      >
        <div className={columna}>
          <label htmlFor="mensaje-asistente" className="sr-only">
            {t("asistente.escribir")}
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id="mensaje-asistente"
              ref={campo}
              rows={2}
              maxLength={2000}
              value={borrador}
              placeholder={t("asistente.escribir")}
              aria-describedby="ayuda-asistente"
              onChange={(e) => setBorrador(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  mandar(borrador);
                }
              }}
              className="max-h-48 min-h-12 w-full resize-y rounded-campo border-2 border-borde-fuerte bg-tarjeta px-3 py-2 text-cuerpo"
            />
            <Boton type="submit" variante="principal" icono="flecha" disabled={pensando || !borrador.trim()}>
              {t("asistente.enviar")}
            </Boton>
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3">
            <p id="ayuda-asistente" className="text-apoyo text-tinta-suave">
              {t("asistente.escribirAyuda")}
            </p>
            {alEmpezarDeNuevo && (
              <button
                type="button"
                onClick={() => {
                  alEmpezarDeNuevo();
                  campo.current?.focus();
                }}
                disabled={pensando}
                className="flex min-h-10 cursor-pointer items-center gap-1.5 text-apoyo font-bold text-azul underline-offset-2 hover:underline disabled:cursor-default disabled:text-tinta-suave"
              >
                <Icono nombre="deshacer" className="size-4" />
                {t("asistente.empezarDeNuevo")}
              </button>
            )}
          </div>
        </div>
      </form>
    </>
  );
}

function TextoDelAsistente({ texto }) {
  return (
    <div className="grid gap-2">
      {partirTexto(texto).map((bloque, i) =>
        bloque.tipo === "lista" ? (
          <ul key={i} className="grid list-disc gap-1 pl-5">
            {bloque.items.map((item, j) => (
              <li key={j}><Tramos tramos={item} /></li>
            ))}
          </ul>
        ) : (
          <p key={i}><Tramos tramos={bloque.tramos} /></p>
        )
      )}
    </div>
  );
}

function Tramos({ tramos }) {
  return tramos.map((tramo, i) => (tramo.negrita ? <strong key={i}>{tramo.texto}</strong> : <span key={i}>{tramo.texto}</span>));
}

function Propuesta({ mensaje, renglones, puedeConfigurar, aplicando, ocupado, alAplicar, alDescartar, t }) {
  const { estado } = mensaje;
  return (
    <div
      className={[
        "mt-2 rounded-tarjeta border-2 p-4",
        estado === "pendiente" ? "border-azul bg-azul-claro" : "border-borde bg-superficie",
      ].join(" ")}
    >
      <p className="flex items-center gap-2 font-bold">
        <Icono nombre={estado === "aplicada" ? "listo" : estado === "descartada" ? "cruz" : "tienda"} className="size-5" />
        {t("asistente.propuestaTitulo")}
      </p>
      <ul className="mt-2 grid list-disc gap-1 pl-6">
        {renglones.map((r, i) => <li key={i}>{r}</li>)}
      </ul>

      {estado === "pendiente" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Boton
            variante="principal"
            icono="listo"
            onClick={alAplicar}
            disabled={ocupado}
            motivo={puedeConfigurar ? undefined : t("asistente.sinPermiso")}
          >
            {aplicando ? t("asistente.aplicando") : t("asistente.aplicar")}
          </Boton>
          <Boton variante="neutro" icono="cruz" onClick={alDescartar} disabled={ocupado}>
            {t("asistente.descartar")}
          </Boton>
        </div>
      )}
      {estado === "aplicada" && <p className="mt-3 font-bold text-etiqueta text-azul">{t("asistente.aplicada")}</p>}
      {estado === "descartada" && <p className="mt-3 font-bold text-etiqueta text-tinta-media">{t("asistente.descartada")}</p>}
    </div>
  );
}

// Lo que interpretó el asistente, una tarjeta por ecuación, para revisarla
// antes de agregarla.
function EcuacionesPropuestas({ ecuaciones, guardadas, puedeEcuaciones, moduloPrendido, agregando, prefijo, ocupado, alAgregar, alAgregarTodas, t }) {
  const pendientes = ecuaciones.filter((e) => e.estado === "pendiente" && !igualA(e, guardadas));
  const sinPermiso = puedeEcuaciones ? undefined : t("asistente.ecuaciones.sinPermiso");
  return (
    <div className="mt-2 grid gap-3">
      {ecuaciones.map((e, k) => {
        const igual = e.estado === "pendiente" || e.estado === "duplicada" ? igualA(e, guardadas) : null;
        const repetida = e.estado === "duplicada" || Boolean(igual);
        const estaAgregando = agregando === `${prefijo}-${k}`;
        return (
          <article
            key={k}
            className={[
              "rounded-tarjeta border-2 p-4",
              e.estado === "agregada" ? "border-borde bg-superficie" : "border-azul bg-azul-claro",
            ].join(" ")}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-bold">
                <Icono nombre={e.estado === "agregada" ? "listo" : "nota"} className="size-5" />
                {e.nombre}
              </p>
              {e.categoria && (
                <span className="rounded-full bg-tarjeta px-3 py-1 text-etiqueta font-bold text-tinta-media">{e.categoria}</span>
              )}
            </div>

            <p className="mt-2 overflow-x-auto rounded-campo bg-tarjeta px-3 py-2 font-mono text-cuerpo">
              {e.nombre} = {e.formula}
              {e.unidad_resultado && <span className="text-tinta-media"> [{e.unidad_resultado}]</span>}
            </p>
            {e.descripcion && <p className="mt-2 text-tinta-media">{e.descripcion}</p>}

            {e.variables?.length > 0 && (
              <>
                <p className="mt-3 text-etiqueta font-bold text-tinta-media">{t("asistente.ecuaciones.interpreto")}</p>
                <ul className="mt-1 grid gap-1">
                  {e.variables.map((v) => (
                    <li key={v.nombre} className="flex flex-wrap gap-x-2">
                      <span className="font-mono font-bold">{leerVariable(v)}</span>
                      {v.tipo === "constante" && <span className="text-etiqueta text-terracota">{t("asistente.ecuaciones.constante")}</span>}
                      {v.descripcion && <span className="text-tinta-media">— {v.descripcion}</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {repetida && e.estado !== "agregada" && (
              <p className="mt-3 flex items-center gap-1.5 text-etiqueta font-bold text-terracota">
                <Icono nombre="alerta" className="size-5" />
                {igual ? t("asistente.ecuaciones.repetida", { nombre: igual }) : t("asistente.ecuaciones.repetidaSinNombre")}
              </p>
            )}
            {e.estado === "error" && e.error && <p className="mt-3 font-bold text-etiqueta text-rojo">{e.error}</p>}

            {e.estado === "agregada" ? (
              <p className="mt-3 flex flex-wrap items-center gap-2 font-bold text-etiqueta text-azul">
                {t("asistente.ecuaciones.agregada")}
                {moduloPrendido && <Link href="/ecuaciones" className="underline">{t("asistente.ecuaciones.ver")}</Link>}
              </p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                <Boton
                  variante={repetida ? "borde" : "principal"}
                  icono="mas"
                  onClick={() => alAgregar(k, { confirmarVariante: repetida })}
                  disabled={ocupado}
                  motivo={sinPermiso}
                >
                  {estaAgregando
                    ? t("asistente.ecuaciones.agregando")
                    : repetida ? t("asistente.ecuaciones.agregarIgual") : t("asistente.ecuaciones.agregar")}
                </Boton>
              </div>
            )}
          </article>
        );
      })}

      {pendientes.length > 1 && puedeEcuaciones && (
        <div>
          <Boton variante="principal" icono="mas" onClick={alAgregarTodas} disabled={ocupado}>
            {t("asistente.ecuaciones.agregarTodas", { n: pendientes.length })}
          </Boton>
        </div>
      )}
      {!moduloPrendido && <p className="text-apoyo text-tinta-suave">{t("asistente.ecuaciones.moduloApagado")}</p>}
    </div>
  );
}
