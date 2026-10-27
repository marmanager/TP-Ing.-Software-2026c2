"use client";

// "Tema" en Mi perfil: cómo se ve la app en este dispositivo (src/lib/tema.js).
//
// Se edita sobre un borrador, como la cuenta: cada toque se ve al instante en
// toda la app, así la vista previa es la pantalla misma; "Guardar" lo deja y
// "Cancelar" (o irse de la pantalla sin guardar) vuelve a lo que estaba.

import { useEffect, useRef, useState } from "react";
import {
  ACENTOS,
  COLORES_CAJA,
  MODOS_CAJA,
  PATRONES,
  dibujo,
  DE_FABRICA,
  LETRAS,
  REDONDEOS,
  TEMAS,
  TINTAS,
  aplicarApariencia,
  esOscuro,
  guardarApariencia,
  leerApariencia,
  opcion,
} from "@/lib/tema";
import Icono from "@/componentes/Icono";
import { Boton, Tarjeta } from "@/componentes/ui";
import { useIdioma } from "@/lib/useIdioma";

// El nombre de una opción, en el idioma de quien mira. Las listas de
// src/lib/tema.js guardan la palabra en castellano (`palabra`) y la clave; la
// traducción se busca por la clave y, si no hay (Inter, Merriweather y
// JetBrains Mono son nombres de marca), queda la palabra.
const nombreDe = (t, grupo, o) => t(`cuenta.tema.${grupo}.${o.clave}`, {}, o.palabra);

export default function Tema() {
  const { t } = useIdioma();
  // Se lee después de montar: en el servidor no hay localStorage.
  const [guardada, setGuardada] = useState(null);
  const [borrador, setBorrador] = useState(null);
  useEffect(() => setGuardada(leerApariencia()), []);

  // Si se va de la pantalla con la edición abierta, no queda a medias.
  const abierta = useRef(false);
  useEffect(() => () => abierta.current && aplicarApariencia(), []);

  function abrir() {
    abierta.current = true;
    setBorrador(guardada);
  }

  function cambiar(campo, clave) {
    const ap = { ...borrador, [campo]: clave };
    setBorrador(ap);
    aplicarApariencia(ap);
  }

  function cerrar(ap) {
    abierta.current = false;
    setBorrador(null);
    setGuardada(ap);
  }

  function guardar() {
    guardarApariencia(borrador);
    cerrar(borrador);
  }

  function cancelar() {
    aplicarApariencia(guardada);
    cerrar(guardada);
  }

  const resumen = guardada && [
    nombreDe(t, "temas", opcion("tema", guardada.tema)),
    t("cuenta.tema.resumenLetra", { valor: nombreDe(t, "letras", opcion("letra", guardada.letra)) }),
    t("cuenta.tema.resumenBordes", { valor: nombreDe(t, "redondeos", opcion("redondeo", guardada.redondeo)).toLowerCase() }),
    t("cuenta.tema.resumenBotones", { valor: nombreDe(t, "colores", opcion("acento", guardada.acento)).toLowerCase() }),
  ].join(" · ");

  return (
    <Tarjeta className="mb-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-[60ch]">
          <p>{t("cuenta.tema.intro")}</p>
          {resumen && <p className="mt-1 text-apoyo text-tinta-suave">{resumen}</p>}
        </div>
        {!borrador && (
          <Boton icono="pincel" onClick={abrir} motivo={guardada ? null : t("cuenta.tema.cargando")}>
            {t("cuenta.tema.editar")}
          </Boton>
        )}
      </div>

      {borrador && (
        <div className="mt-6 border-t border-borde pt-6">
          <Parte titulo={t("cuenta.tema.tituloTema")} ayuda={t("cuenta.tema.ayudaTema")}>
            <Grupo nombre={t("cuenta.tema.tituloTema")} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {TEMAS.map((o) => (
                <Opcion key={o.clave} elegida={borrador.tema === o.clave} onClick={() => cambiar("tema", o.clave)} palabra={nombreDe(t, "temas", o)}>
                  <VistaTema tema={o} />
                </Opcion>
              ))}
            </Grupo>
          </Parte>

          <Parte titulo={t("cuenta.tema.tituloBordesLetra")} ayuda={t("cuenta.tema.ayudaBordesLetra")}>
            <h4 className="mb-2 font-bold">{t("cuenta.tema.letra")}</h4>
            <Grupo nombre={t("cuenta.tema.letra")} className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {LETRAS.map((l) => (
                <Opcion key={l.clave} elegida={borrador.letra === l.clave} onClick={() => cambiar("letra", l.clave)} palabra={nombreDe(t, "letras", l)}>
                  <span className="block py-2 text-pantalla" style={{ fontFamily: l.familia }} aria-hidden="true">
                    Aa
                  </span>
                </Opcion>
              ))}
            </Grupo>

            <h4 className="mb-2 font-bold">{t("cuenta.tema.colorLetra")}</h4>
            <Grupo nombre={t("cuenta.tema.colorLetra")} className="mb-6 flex flex-wrap gap-3">
              {TINTAS.map((o) => (
                <Muestra
                  key={o.clave}
                  elegida={borrador.tinta === o.clave}
                  onClick={() => cambiar("tinta", o.clave)}
                  palabra={nombreDe(t, "tintas", o)}
                  color={esOscuro(borrador.tema) ? o.oscuro : o.claro}
                  letra
                />
              ))}
            </Grupo>

            <h4 className="mb-2 font-bold">{t("cuenta.tema.bordes")}</h4>
            <Grupo nombre={t("cuenta.tema.bordes")} className="grid grid-cols-3 gap-3">
              {REDONDEOS.map((b) => (
                <Opcion key={b.clave} elegida={borrador.redondeo === b.clave} onClick={() => cambiar("redondeo", b.clave)} palabra={nombreDe(t, "redondeos", b)}>
                  <span
                    aria-hidden="true"
                    className="mx-auto my-2 block h-12 w-20 border-2 border-borde-fuerte bg-superficie"
                    style={{ borderRadius: b.tarjeta }}
                  />
                </Opcion>
              ))}
            </Grupo>
          </Parte>

          <Parte titulo={t("cuenta.tema.tituloBotones")} ayuda={t("cuenta.tema.ayudaBotones")}>
            <Grupo nombre={t("cuenta.tema.tituloBotones")} className="mb-4 flex flex-wrap gap-3">
              {ACENTOS.map((a) => (
                <Muestra
                  key={a.clave}
                  elegida={borrador.acento === a.clave}
                  onClick={() => cambiar("acento", a.clave)}
                  palabra={nombreDe(t, "colores", a)}
                  color={a.solido}
                />
              ))}
            </Grupo>
            {/* Una muestra de los botones de verdad, con el color ya puesto. */}
            <div aria-hidden="true" className="flex flex-wrap items-center gap-3 rounded-tarjeta bg-superficie p-4">
              <span className="inline-flex min-h-12 items-center gap-2 rounded-campo bg-azul px-6 font-bold text-white">
                <Icono nombre="mas" className="size-6" />
                {t("cuenta.tema.muestraAbrir")}
              </span>
              <span className="inline-flex min-h-12 items-center rounded-campo border-2 border-azul bg-tarjeta px-6 font-bold text-azul">
                {t("cuenta.tema.muestraVer")}
              </span>
              <span className="font-bold text-azul underline">{t("cuenta.tema.muestraTodo")}</span>
            </div>
          </Parte>

          <Parte titulo={t("cuenta.tema.tituloCajas")} ayuda={t("cuenta.tema.ayudaCajas")}>
            <EditorCaja
              titulo={t("cuenta.tema.colorCajas")}
              valor={borrador.caja}
              cambiar={(c) => cambiar("caja", c)}
            />
            <EditorCaja
              titulo={t("cuenta.tema.colorRebordes")}
              valor={borrador.reborde}
              cambiar={(c) => cambiar("reborde", c)}
            />
          </Parte>

          <div className="flex flex-wrap gap-3">
            <Boton variante="principal" icono="check" onClick={guardar}>
              {t("cuenta.tema.guardar")}
            </Boton>
            <Boton variante="plano" onClick={cancelar}>
              {t("cuenta.tema.cancelar")}
            </Boton>
            <Boton variante="plano" onClick={() => { setBorrador(DE_FABRICA); aplicarApariencia(DE_FABRICA); }}>
              {t("cuenta.tema.deFabrica")}
            </Boton>
          </div>
        </div>
      )}
    </Tarjeta>
  );
}

function Parte({ titulo, ayuda, children }) {
  return (
    <section className="mb-8">
      <h3 className="text-subtitulo font-bold">{titulo}</h3>
      <p className="mb-4 text-tinta-media">{ayuda}</p>
      {children}
    </section>
  );
}

function Grupo({ nombre, className, children }) {
  return (
    <div role="group" aria-label={nombre} className={className}>
      {children}
    </div>
  );
}

// Una opción grande, con su dibujo arriba y el nombre abajo.
function Opcion({ elegida, onClick, palabra, children }) {
  return (
    <button
      type="button"
      aria-pressed={elegida}
      onClick={onClick}
      className={`relative cursor-pointer rounded-tarjeta border-2 p-3 text-center ${
        elegida ? "border-azul bg-azul-claro" : "border-borde bg-tarjeta hover:bg-superficie"
      }`}
    >
      {children}
      <span className={`mt-2 block text-etiqueta ${elegida ? "font-bold text-azul" : "text-tinta-media"}`}>{palabra}</span>
      {elegida && <Icono nombre="check" className="absolute top-2 right-2 size-5 text-azul" />}
    </button>
  );
}

// Una muestra de color redonda. Con "letra", dice "Aa" en ese color sobre el
// fondo de la app; sin, es el color lleno.
function Muestra({ elegida, onClick, palabra, color, letra }) {
  return (
    <button
      type="button"
      aria-pressed={elegida}
      onClick={onClick}
      className="flex w-20 cursor-pointer flex-col items-center gap-1 rounded-campo p-1 hover:bg-superficie"
    >
      <span
        aria-hidden="true"
        className={`flex size-12 items-center justify-center rounded-full border-2 font-bold ${
          elegida ? "border-azul ring-2 ring-azul ring-offset-2 ring-offset-tarjeta" : "border-borde"
        } ${letra ? "bg-fondo" : ""}`}
        style={letra ? { color } : { backgroundColor: color }}
      >
        {letra ? "Aa" : elegida && <Icono nombre="check" className="size-5 text-white" />}
      </span>
      <span className={`text-apoyo ${elegida ? "font-bold text-tinta" : "text-tinta-media"}`}>{palabra}</span>
    </button>
  );
}

// Una ventanita como la de Windows: barra, tarjeta y renglones, con los
// colores de ese tema. La del sistema va mitad y mitad.
function VistaTema({ tema }) {
  if (tema.clave === "sistema") {
    return (
      <span aria-hidden="true" className="relative block h-24 overflow-hidden rounded-campo border border-borde">
        <span className="absolute inset-0" style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }}>
          <Ventana {...TEMAS[0]} />
        </span>
        <span className="absolute inset-0" style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}>
          <Ventana {...TEMAS[1]} />
        </span>
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="block h-24 overflow-hidden rounded-campo border border-borde">
      <Ventana {...tema} />
    </span>
  );
}

function Ventana({ fondo, tarjeta, tinta }) {
  return (
    <span className="flex h-full gap-2 p-2" style={{ backgroundColor: fondo }}>
      <span className="flex w-1/4 flex-col gap-1.5 pt-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="block h-1.5 rounded-full opacity-40" style={{ backgroundColor: tinta }} />
        ))}
      </span>
      <span className="flex flex-1 flex-col gap-1.5 rounded-md p-2" style={{ backgroundColor: tarjeta }}>
        <span className="block h-2 w-2/3 rounded-full opacity-80" style={{ backgroundColor: tinta }} />
        <span className="block h-1.5 w-full rounded-full opacity-30" style={{ backgroundColor: tinta }} />
        <span className="block h-1.5 w-5/6 rounded-full opacity-30" style={{ backgroundColor: tinta }} />
        <span className="mt-auto block h-3 w-1/3 rounded-sm bg-azul" />
      </span>
    </span>
  );
}

// Un color o dos en degradé, para el interior o el borde de las tarjetas.
function EditorCaja({ titulo, valor, cambiar }) {
  const { t } = useIdioma();
  const poner = (parte, clave) => cambiar({ ...valor, [parte]: clave });
  const dos = valor.modo === "degrade";

  return (
    <div className="mb-6">
      <h4 className="mb-2 font-bold">{titulo}</h4>
      <Grupo nombre={titulo} className="mb-4 flex flex-wrap gap-2">
        {MODOS_CAJA.map((m) => (
          <button
            key={m.clave}
            type="button"
            aria-pressed={valor.modo === m.clave}
            onClick={() => poner("modo", m.clave)}
            className={`min-h-12 cursor-pointer rounded-full border-2 px-4 text-etiqueta ${
              valor.modo === m.clave
                ? "border-azul bg-azul-claro font-bold text-azul"
                : "border-borde bg-tarjeta text-tinta-media hover:bg-superficie"
            }`}
          >
            {nombreDe(t, "modos", m)}
          </button>
        ))}
      </Grupo>

      {valor.modo !== "fabrica" && (
        <>
          <p className="mb-1 text-apoyo text-tinta-media">{dos ? t("cuenta.tema.primerColor") : t("cuenta.tema.color")}</p>
          <Grupo nombre={dos ? t("cuenta.tema.grupoPrimerColor", { titulo }) : t("cuenta.tema.grupoColor", { titulo })} className="mb-3 flex flex-wrap gap-2">
            {COLORES_CAJA.map((c) => (
              <Muestra key={c.clave} elegida={valor.c1 === c.clave} onClick={() => poner("c1", c.clave)} palabra={nombreDe(t, "colores", c)} color={c.color} />
            ))}
          </Grupo>
        </>
      )}

      {dos && (
        <>
          <p className="mb-1 text-apoyo text-tinta-media">{t("cuenta.tema.segundoColor")}</p>
          <Grupo nombre={t("cuenta.tema.grupoSegundoColor", { titulo })} className="mb-3 flex flex-wrap gap-2">
            {COLORES_CAJA.map((c) => (
              <Muestra key={c.clave} elegida={valor.c2 === c.clave} onClick={() => poner("c2", c.clave)} palabra={nombreDe(t, "colores", c)} color={c.color} />
            ))}
          </Grupo>

          <p className="mb-1 text-apoyo text-tinta-media">{t("cuenta.tema.patron")}</p>
          <Grupo nombre={t("cuenta.tema.grupoPatron", { titulo })} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PATRONES.map((p) => (
              <Opcion key={p.clave} elegida={valor.patron === p.clave} onClick={() => poner("patron", p.clave)} palabra={nombreDe(t, "patrones", p)}>
                <span aria-hidden="true" className="block h-12 rounded-campo" style={{ background: dibujo({ ...valor, patron: p.clave }) }} />
              </Opcion>
            ))}
          </Grupo>
        </>
      )}
    </div>
  );
}
