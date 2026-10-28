"use client";

// "Tu landing" (SCRUM-196 a 199, docs/landing-por-negocio.md).
//
// La página pública de cada negocio sale de un modelo fijo: el dueño sólo
// elige el orden de las secciones, los colores y la fuente. Acá lo edita, lo
// ve en la vista previa mientras cambia, y recién al guardar queda.
//
// Se llega desde "Mi negocio", como Módulos. La edita sólo el dueño; la API
// también lo frena (403). Arriba va el link para compartirla: publicarlo y
// dejar de compartirlo no dependen del borrador, porque la página pública
// siempre muestra lo que está guardado.

import { useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { puede, quienPuede } from "@/lib/permisos";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import {
  CONTRASTE_MINIMO,
  FUENTES,
  PALETAS,
  PARTES,
  cambiarColor,
  contraste,
  esDeFabrica,
  estadoDeSecciones,
  moverSeccion,
  nombreDeFuente,
  nombreDeMuestra,
  normalizarLanding,
  seLee,
  traducirParte,
} from "@/lib/landing";
import { horariosListos, normalizarHorarios } from "@/lib/horarios";
import Icono from "@/componentes/Icono";
import LinkCompartido from "@/componentes/LinkCompartido";
import { FUENTES_LANDING } from "@/componentes/landing/fuentes";
import VistaPrevia from "@/componentes/landing/VistaPrevia";
import { Boton, Cargando, Tarjeta, TituloPantalla, TituloSeccion } from "@/componentes/ui";
import { Grupo, Muestra, Opcion } from "@/app/perfil/Tema";

// 4.478 → "4,4" (en inglés "4.4"): se trunca, no se redondea, para que un
// contraste que no llega nunca se muestre igual al mínimo.
const conComa = (n, locale) =>
  (Math.floor(n * 10) / 10).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Las palabras del link de la landing. El bloque en sí es el de
// LinkCompartido, el mismo del link para pedir turno. El mensaje de WhatsApp lo
// manda el negocio: sale en su idioma.
const textosDelLink = (t) => ({
  etiqueta: t("landing.editor.link.etiqueta"),
  explicacion: t("landing.editor.link.explicacion"),
  armar: t("landing.editor.link.armar"),
  armado: t("landing.editor.link.armado"),
  whatsapp: (nombre, link) => t("landing.editor.link.whatsapp", { nombre, link }),
  dejar: t("landing.editor.link.dejar"),
  pregunta: t("landing.editor.link.pregunta"),
  aviso: t("landing.editor.link.aviso"),
  cortado: t("landing.editor.link.cortado"),
});

export default function EditorDeLanding() {
  const datos = useDatos();
  const { cargando, negocio } = datos;
  const { usuario } = useAuth();
  const { locale, t } = useIdioma();
  useTitulo(t("negocio.landing.titulo"));

  // null = sin cambios: se ve lo guardado.
  const [borrador, setBorrador] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  if (cargando) return <Cargando />;

  const puedeConfigurar = puede(usuario, "configurar_negocio");
  const guardada = normalizarLanding(negocio?.landing);
  const actual = borrador ?? guardada;
  const hayCambios = borrador !== null && JSON.stringify(borrador) !== JSON.stringify(guardada);
  const secciones = estadoDeSecciones(
    actual.orden,
    negocio?.modulos_activos ?? [],
    horariosListos(normalizarHorarios(negocio?.horarios)),
    t
  );

  // React mueve la fila en el DOM y el botón apretado pierde el foco: se lo
  // devolvemos, o al otro de la fila si quedó apagado en la punta. Sin esto,
  // quien usa el teclado vuelve al principio de la página a cada paso.
  const mover = (clave, paso, ev) => {
    const boton = ev.currentTarget;
    flushSync(() =>
      setBorrador({ ...actual, orden: moverSeccion(actual.orden, clave, paso) })
    );
    (boton.disabled
      ? boton.parentElement.querySelector("button:not(:disabled)")
      : boton
    )?.focus();
  };

  const guardar = async () => {
    setError(null);
    setGuardando(true);
    // La de fábrica se guarda como null: así, si un día cambia, el negocio
    // que nunca la tocó recibe la nueva.
    const r = await datos.guardarLanding(esDeFabrica(actual) ? null : actual);
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    // Si cambió algo mientras la API contestaba, eso no se guardó: no se pisa.
    setBorrador((b) => (b === actual ? null : b));
    datos.avisarExito(t("landing.editor.guardado"));
  };

  return (
    <>
      <Link
        href="/negocio"
        className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul"
      >
        <Icono nombre="volver" />
        {t("negocio.volver")}
      </Link>

      <TituloPantalla apoyo={t("landing.editor.apoyo")}>
        {t("negocio.landing.titulo")}
      </TituloPantalla>

      {!puedeConfigurar ? (
        <Tarjeta>
          <p className="max-w-[65ch] text-tinta-media">{quienPuede("configurar_negocio", t)}</p>
        </Tarjeta>
      ) : (
        // Las columnas por el ancho del bloque (@container de Guardia.js) y no
        // de la ventana: la barra lateral se lleva 256 px. Con 56rem de bloque
        // quedan unos 480 px para el editor.
        <div className="grid gap-8 @4xl:grid-cols-[minmax(0,1fr)_24rem] @4xl:items-start">
          <div>
            <TituloSeccion>{t("landing.editor.elLink")}</TituloSeccion>
            <LinkCompartido
              id="link-landing"
              codigo={negocio?.landing_codigo}
              ruta="/n/"
              icono="pincel"
              nombre={negocio?.nombre}
              compartir={datos.compartirLanding}
              dejarDeCompartir={datos.dejarDeCompartirLanding}
              textos={textosDelLink(t)}
            />

            <TituloSeccion>{t("landing.editor.orden")}</TituloSeccion>
            <Tarjeta className="mb-8">
              <p className="mb-4 max-w-[65ch] text-tinta-media">
                {t("landing.editor.ordenTexto")}
              </p>
              <ol data-orden="" className="grid gap-3">
                {secciones.map((s, i) => (
                  <li
                    key={s.clave}
                    className={[
                      "flex flex-wrap items-center justify-between gap-3 rounded-tarjeta border border-borde p-4",
                      s.visible ? "" : "bg-superficie",
                    ].join(" ")}
                  >
                    <div className="min-w-0">
                      <h3 className="font-bold text-cuerpo">{s.nombre}</h3>
                      <p className="max-w-[55ch] text-apoyo text-tinta-suave">
                        {s.motivo ?? s.queMuestra}
                      </p>
                    </div>
                    {/* Con palabra: la cartilla no permite botones de sólo
                        ícono (Icono.js). El aria-label suma de qué sección se
                        habla, y empieza con la palabra visible (WCAG 2.5.3). */}
                    <div className="flex flex-wrap gap-2">
                      <Boton
                        variante="plano"
                        icono="flecha-arriba"
                        aria-label={t(i === 0 ? "landing.editor.subirAriaPrimera" : "landing.editor.subirAria", { nombre: s.nombre })}
                        motivo={i === 0 ? t("landing.editor.yaPrimera") : null}
                        onClick={(ev) => mover(s.clave, -1, ev)}
                      >
                        {t("landing.editor.subir")}
                      </Boton>
                      <Boton
                        variante="plano"
                        icono="flecha-abajo"
                        aria-label={t(i === secciones.length - 1 ? "landing.editor.bajarAriaUltima" : "landing.editor.bajarAria", { nombre: s.nombre })}
                        data-testid={`landing-seccion-bajar-${s.clave}`}
                        motivo={i === secciones.length - 1 ? t("landing.editor.yaUltima") : null}
                        onClick={(ev) => mover(s.clave, 1, ev)}
                      >
                        {t("landing.editor.bajar")}
                      </Boton>
                    </div>
                  </li>
                ))}
              </ol>
            </Tarjeta>

            <TituloSeccion>{t("landing.editor.colores")}</TituloSeccion>
            <Tarjeta className="mb-8">
              <p className="mb-6 max-w-[65ch] text-tinta-media">
                {t("landing.editor.coloresTexto")}
              </p>
              <div className="grid gap-8">
                {PARTES.map((parte) => {
                  const p = traducirParte(parte, t);
                  const { color } = actual.colores[p.clave];
                  return (
                    <div key={p.clave}>
                      <h3 className="font-bold text-cuerpo">{p.nombre}</h3>
                      <p className="mb-3 text-apoyo text-tinta-suave">{p.ayuda}</p>
                      <Grupo nombre={t("landing.editor.colorDe", { nombre: p.nombre })} className="flex flex-wrap gap-3">
                        {PALETAS[p.clave].map((m) => (
                          <Muestra
                            key={m.clave}
                            data-testid={`landing-color-${p.clave}-${m.clave}`}
                            elegida={color === m.color}
                            onClick={() => setBorrador(cambiarColor(actual, p.clave, m.color))}
                            palabra={nombreDeMuestra(m, t)}
                            color={m.color}
                          />
                        ))}
                      </Grupo>
                      {/* Los links (text-azul) van con el color de los
                          botones y sobre las cajas: un botón claro deja los
                          links ilegibles aunque su propio texto se lea. */}
                      {p.clave === "botones" && !seLee(actual.colores.cajas.color, color) && (
                        <p className="mt-3 flex items-start gap-2 font-bold text-rojo">
                          <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
                          <span>
                            {t("landing.editor.linksCuestaLeer", {
                              actual: conComa(contraste(actual.colores.cajas.color, color), locale),
                              minimo: conComa(CONTRASTE_MINIMO, locale),
                            })}
                          </span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Tarjeta>

            <TituloSeccion>{t("landing.editor.letra")}</TituloSeccion>
            <Tarjeta className="mb-8">
              <p className="mb-4 max-w-[65ch] text-tinta-media">{t("landing.editor.letraTexto")}</p>
              <Grupo nombre={t("landing.editor.letra")} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {FUENTES.map((f) => (
                  <Opcion
                    key={f.clave}
                    data-testid={`landing-fuente-${f.clave}`}
                    elegida={actual.fuente === f.clave}
                    onClick={() => setBorrador({ ...actual, fuente: f.clave })}
                    palabra={nombreDeFuente(f, t)}
                  >
                    <span
                      aria-hidden="true"
                      className={`block py-2 text-pantalla ${FUENTES_LANDING[f.clave]?.className ?? ""}`}
                    >
                      Aa
                    </span>
                  </Opcion>
                ))}
              </Grupo>
            </Tarjeta>

            {error && (
              <p role="alert" className="mb-4 flex items-start gap-2 font-bold text-rojo">
                <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
                <span>{textoDeError(t, error)}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Boton
                variante="principal"
                icono="check"
                onClick={guardar}
                data-testid="landing-guardar"
                motivo={guardando ? t("landing.editor.guardando") : hayCambios ? null : t("landing.editor.nadaCambio")}
              >
                {t("landing.editor.guardar")}
              </Boton>
              {hayCambios && (
                <Boton variante="plano" onClick={() => setBorrador(null)}>
                  {t("landing.editor.descartar")}
                </Boton>
              )}
              {!esDeFabrica(actual) && (
                <Boton
                  variante="plano"
                  icono="deshacer"
                  data-testid="landing-de-fabrica"
                  onClick={() => setBorrador(normalizarLanding(null))}
                >
                  {t("landing.editor.deFabrica")}
                </Boton>
              )}
            </div>
          </div>

          <div className="@4xl:sticky @4xl:top-6">
            <VistaPrevia
              landing={actual}
              negocio={negocio}
              secciones={secciones.filter((s) => s.visible)}
            />
          </div>
        </div>
      )}
    </>
  );
}
