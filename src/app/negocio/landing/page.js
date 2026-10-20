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
import { puede, QUIEN_PUEDE } from "@/lib/permisos";
import {
  CONTRASTE_MINIMO,
  FUENTES,
  PARTES,
  cambiarColor,
  cambiarTexto,
  contraste,
  esDeFabrica,
  estadoDeSecciones,
  moverSeccion,
  normalizarLanding,
  seLee,
  textoRecomendado,
} from "@/lib/landing";
import { horariosListos, normalizarHorarios } from "@/lib/horarios";
import Icono from "@/componentes/Icono";
import LinkCompartido from "@/componentes/LinkCompartido";
import { FUENTES_LANDING } from "@/componentes/landing/fuentes";
import VistaPrevia from "@/componentes/landing/VistaPrevia";
import { Boton, Cargando, Tarjeta, TituloPantalla, TituloSeccion } from "@/componentes/ui";

// 4.478 → "4,4": se trunca, no se redondea, para que un contraste que no llega
// nunca se muestre igual al mínimo.
const conComa = (n) => (Math.floor(n * 10) / 10).toFixed(1).replace(".", ",");

// Las palabras del link de la landing. El bloque en sí es el de
// LinkCompartido, el mismo del link para pedir turno.
const TEXTOS_DEL_LINK = {
  etiqueta: "El link de tu landing",
  explicacion:
    "Un link para poner en tu Instagram o mandar por WhatsApp. Ahí tus clientes ven tus datos, sacan turno y siguen sus casos.",
  armar: "Publicar la landing",
  armado: "Listo. Tu landing ya tiene link para repartir.",
  whatsapp: (nombre, link) =>
    `Hola, te escribimos de ${nombre}. Acá podés sacar turno y ver cómo viene lo tuyo: ${link}`,
  dejar: "Dejar de compartir la landing",
  pregunta: "¿Dejar de compartir la landing?",
  aviso:
    "El link deja de funcionar ahora mismo. Tus clientes no pierden nada: sus casos y turnos siguen como están.",
  cortado: "Listo. Ese link dejó de funcionar.",
};

const CAMPO_COLOR =
  "h-12 w-16 cursor-pointer rounded-campo border-2 border-borde-fuerte bg-tarjeta p-1";

export default function EditorDeLanding() {
  const datos = useDatos();
  const { cargando, negocio } = datos;
  const { usuario } = useAuth();
  useTitulo("Tu landing");

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
    horariosListos(normalizarHorarios(negocio?.horarios))
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
    datos.avisarExito("Listo. Tu landing quedó guardada.");
  };

  return (
    <>
      <Link
        href="/negocio"
        className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul"
      >
        <Icono nombre="volver" />
        Volver a Mi negocio
      </Link>

      <TituloPantalla apoyo="La página que van a ver tus clientes. Elegí el orden, los colores y la letra.">
        Tu landing
      </TituloPantalla>

      {!puedeConfigurar ? (
        <Tarjeta>
          <p className="max-w-[65ch] text-tinta-media">{QUIEN_PUEDE.configurar_negocio}</p>
        </Tarjeta>
      ) : (
        // Las columnas por el ancho del bloque (@container de Guardia.js) y no
        // de la ventana: la barra lateral se lleva 256 px. Con 56rem de bloque
        // quedan unos 480 px para el editor.
        <div className="grid gap-8 @4xl:grid-cols-[minmax(0,1fr)_24rem] @4xl:items-start">
          <div>
            <TituloSeccion>El link</TituloSeccion>
            <LinkCompartido
              id="link-landing"
              codigo={negocio?.landing_codigo}
              ruta="/n/"
              icono="pincel"
              nombre={negocio?.nombre}
              compartir={datos.compartirLanding}
              dejarDeCompartir={datos.dejarDeCompartirLanding}
              textos={TEXTOS_DEL_LINK}
            />

            <TituloSeccion>Orden</TituloSeccion>
            <Tarjeta className="mb-8">
              <p className="mb-4 max-w-[65ch] text-tinta-media">
                Las secciones son siempre las mismas. Elegí en qué orden aparecen.
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
                        aria-label={`Subir ${s.nombre}${i === 0 ? " · ya va primera" : ""}`}
                        motivo={i === 0 ? "ya va primera" : null}
                        onClick={(ev) => mover(s.clave, -1, ev)}
                      >
                        Subir
                      </Boton>
                      <Boton
                        variante="plano"
                        icono="flecha-abajo"
                        aria-label={`Bajar ${s.nombre}${i === secciones.length - 1 ? " · ya va última" : ""}`}
                        motivo={i === secciones.length - 1 ? "ya va última" : null}
                        onClick={(ev) => mover(s.clave, 1, ev)}
                      >
                        Bajar
                      </Boton>
                    </div>
                  </li>
                ))}
              </ol>
            </Tarjeta>

            <TituloSeccion>Colores</TituloSeccion>
            <Tarjeta className="mb-8">
              <p className="mb-6 max-w-[65ch] text-tinta-media">
                Cada parte lleva su color y el de su texto. Te marcamos el texto que mejor se
                lee; si elegís otro, te avisamos cuando cueste leerlo.
              </p>
              <div className="grid gap-8">
                {PARTES.map((p) => {
                  const { color, texto } = actual.colores[p.clave];
                  const recomendado = textoRecomendado(color);
                  return (
                    <fieldset key={p.clave} className="grid gap-3">
                      <legend className="font-bold text-cuerpo">{p.nombre}</legend>
                      <p className="text-apoyo text-tinta-suave">{p.ayuda}</p>
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="inline-flex min-h-12 items-center gap-2">
                          <input
                            type="color"
                            aria-label={`Color de ${p.nombre}`}
                            value={color}
                            onChange={(ev) =>
                              setBorrador(cambiarColor(actual, p.clave, ev.target.value))
                            }
                            className={CAMPO_COLOR}
                          />
                          Color
                        </label>
                        <label className="inline-flex min-h-12 items-center gap-2">
                          <input
                            type="color"
                            aria-label={`Texto de ${p.nombre}`}
                            value={texto}
                            onChange={(ev) =>
                              setBorrador(cambiarTexto(actual, p.clave, ev.target.value))
                            }
                            className={CAMPO_COLOR}
                          />
                          Texto
                        </label>
                        {texto === recomendado ? (
                          // Sin el verde ni el ícono "listo": son del estado
                          // Completado, y acá no se completa nada.
                          <span className="inline-flex items-center gap-1.5 font-bold text-etiqueta text-tinta-media">
                            <Icono nombre="check" className="size-5" />
                            Recomendado
                          </span>
                        ) : (
                          <Boton
                            variante="plano"
                            onClick={() => setBorrador(cambiarTexto(actual, p.clave, recomendado))}
                          >
                            Usar el recomendado
                          </Boton>
                        )}
                      </div>
                      {!seLee(color, texto) && (
                        <p className="flex items-start gap-2 font-bold text-rojo">
                          <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
                          <span>
                            Con este texto cuesta leer: el contraste es{" "}
                            {conComa(contraste(color, texto))} a 1 y lo mínimo es{" "}
                            {conComa(CONTRASTE_MINIMO)} a 1.
                          </span>
                        </p>
                      )}
                      {/* Los links (text-azul) van con el color de los
                          botones y sobre las cajas: un botón claro deja los
                          links ilegibles aunque su propio texto se lea. */}
                      {p.clave === "botones" && !seLee(actual.colores.cajas.color, color) && (
                        <p className="flex items-start gap-2 font-bold text-rojo">
                          <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
                          <span>
                            Los links van con este color y sobre las cajas cuesta leerlos: el
                            contraste es {conComa(contraste(actual.colores.cajas.color, color))} a
                            1 y lo mínimo es {conComa(CONTRASTE_MINIMO)} a 1.
                          </span>
                        </p>
                      )}
                    </fieldset>
                  );
                })}
              </div>
            </Tarjeta>

            <TituloSeccion>Letra</TituloSeccion>
            <Tarjeta className="mb-8">
              <fieldset className="grid gap-3">
                <legend className="mb-3 max-w-[65ch] text-tinta-media">
                  La letra de toda la página. Cada opción está escrita con la suya.
                </legend>
                {FUENTES.map((f) => (
                  <label
                    key={f.clave}
                    className={[
                      "flex min-h-12 cursor-pointer items-center gap-3 rounded-campo border-2 px-4",
                      actual.fuente === f.clave ? "border-azul" : "border-borde",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="fuente"
                      value={f.clave}
                      checked={actual.fuente === f.clave}
                      onChange={() => setBorrador({ ...actual, fuente: f.clave })}
                      className="size-5"
                    />
                    <span className={`text-cuerpo ${FUENTES_LANDING[f.clave]?.className ?? ""}`}>
                      {f.nombre}
                    </span>
                  </label>
                ))}
              </fieldset>
            </Tarjeta>

            {error && (
              <p role="alert" className="mb-4 flex items-start gap-2 font-bold text-rojo">
                <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
                <span>{error}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Boton
                variante="principal"
                icono="check"
                onClick={guardar}
                motivo={guardando ? "guardando" : hayCambios ? null : "no cambiaste nada"}
              >
                Guardar
              </Boton>
              {hayCambios && (
                <Boton variante="plano" onClick={() => setBorrador(null)}>
                  Descartar los cambios
                </Boton>
              )}
              {!esDeFabrica(actual) && (
                <Boton
                  variante="plano"
                  icono="deshacer"
                  onClick={() => setBorrador(normalizarLanding(null))}
                >
                  Volver a la de fábrica
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
