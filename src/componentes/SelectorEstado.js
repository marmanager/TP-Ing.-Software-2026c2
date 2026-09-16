"use client";

// El estado del caso, y desde el mismo lugar se cambia.
//
// Antes esto eran botones sueltos en una sección "Cómo sigue", abajo de todo:
// para cambiar el estado había que leer el chip arriba, bajar, y buscar cuál
// de tres botones correspondía. Ahora se toca donde se lee.
//
// No es un <select>: cada opción es un botón de 48 px con el color, el ícono y
// la palabra del estado —las tres señales de la sección 02— más una línea que
// dice qué significa. Un <select> mostraría sólo texto y perdería las tres.
//
// Las palabras salen del preset del rubro: un taller lee "En el taller" y un
// consultorio "En consulta". Es el mismo estado abajo.

import { useEffect, useRef, useState } from "react";
import { AL_PASAR_A, ESTADOS, otrosEstados } from "@/lib/estados";
import { etiquetaEstado, preset } from "@/lib/presets";
import Icono from "./Icono";

export default function SelectorEstado({ estado, rubro, sePuedeCambiar, alElegir }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);

  // Se cierra al tocar afuera o con Escape: un menú que queda abierto tapando
  // la pantalla es peor que no tenerlo.
  useEffect(() => {
    if (!abierto) return;

    const afuera = (e) => {
      if (caja.current && !caja.current.contains(e.target)) setAbierto(false);
    };
    const escape = (e) => e.key === "Escape" && setAbierto(false);

    document.addEventListener("pointerdown", afuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", afuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  const actual = ESTADOS[estado];
  if (!actual) return null;

  const palabra = etiquetaEstado(rubro, estado);
  const explica = preset(rubro).explica ?? {};

  // Sin permiso para cambiarlo, el chip es un chip y nada más.
  if (!sePuedeCambiar) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold text-etiqueta ${actual.fondo} ${actual.texto}`}
      >
        <Icono nombre={actual.icono} className="size-5" />
        {palabra}
      </span>
    );
  }

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="true"
        aria-expanded={abierto}
        aria-label={`El caso está en «${palabra}». Tocá para cambiarlo.`}
        className={`inline-flex min-h-12 cursor-pointer items-center gap-1.5 rounded-full px-4 font-bold text-etiqueta ${actual.fondo} ${actual.texto} hover:brightness-95`}
      >
        <Icono nombre={actual.icono} className="size-5" />
        {palabra}
        <Icono
          nombre={abierto ? "flecha-arriba" : "flecha-abajo"}
          className="size-5 opacity-70"
        />
      </button>

      {abierto && (
        <div className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-tarjeta border border-borde bg-tarjeta shadow-sm">
          <p className="border-b border-borde px-4 py-3 font-bold text-etiqueta">
            Pasar el caso a
          </p>
          <ul>
            {otrosEstados(estado).map((otro) => {
              const e = ESTADOS[otro];
              const suPalabra = etiquetaEstado(rubro, otro);
              return (
                <li key={otro} className="border-b border-borde last:border-b-0">
                  <button
                    type="button"
                    onClick={() => {
                      setAbierto(false);
                      alElegir(otro, AL_PASAR_A[otro]);
                    }}
                    aria-label={`Marcar el caso como ${suPalabra}`}
                    className="flex w-full min-h-12 cursor-pointer flex-col items-start gap-1 px-4 py-3 text-left hover:bg-superficie"
                  >
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-bold text-etiqueta ${e.fondo} ${e.texto}`}
                    >
                      <Icono nombre={e.icono} className="size-5" />
                      {suPalabra}
                    </span>
                    <span className="text-apoyo text-tinta-suave">
                      {explica[otro] ?? e.significado}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
