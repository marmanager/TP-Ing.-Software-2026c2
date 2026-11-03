"use client";

// La sección 04 de la bienvenida: la lista de módulos y la pantalla de
// ejemplo del elegido (docs/bienvenida-modulos-y-remi.md).
//
// Son pestañas de verdad (role="tab"): cambian el panel sin salir de la
// página, que es justo el caso para el que Pestanas.js dice que no usa el
// rol. Las flechas, Inicio y Fin eligen; sólo la elegida está en el orden de
// tabulación. Cambia sólo al tocar: lo que se mueve solo en la página es la
// charla de Remi, y dos cosas moviéndose a la vez distraen.
//
// En el celular la lista es una fila de botones que se desliza de costado;
// recién en xl pasa a columna, con la línea de qué es cada uno.

import { useRef, useState, useSyncExternalStore } from "react";
import Icono from "@/componentes/Icono";
import { MODULOS_AL_PIE, MODULOS_DE_LA_BIENVENIDA, siguientePestana } from "@/lib/bienvenida";
import { MODULOS, traducirModulo } from "@/lib/modulos";
import { useIdioma } from "@/lib/useIdioma";
import PantallaDeModulo from "./PantallasDeModulos";

// Desde xl la lista es una columna, y el lector de pantalla tiene que saberlo.
const XL = "(min-width: 80rem)";
const alCambiarElAncho = (avisar) => {
  const m = matchMedia(XL);
  m.addEventListener("change", avisar);
  return () => m.removeEventListener("change", avisar);
};

export default function SelectorDeModulos() {
  const { t, locale } = useIdioma();
  const [elegido, setElegido] = useState(0);
  const pestanas = useRef([]);
  const vertical = useSyncExternalStore(alCambiarElAncho, () => matchMedia(XL).matches, () => false);
  const L = (clave, vars) => t(`acceso.landing.modulos.${clave}`, vars);

  const modulo = (clave) => traducirModulo(MODULOS[clave], t);
  // Ecuaciones se llama como en la barra lateral: el nombre entero no entra.
  const nombre = (clave) => (clave === "ecuaciones" ? t("navegacion.ecuaciones") : modulo(clave).nombre);

  const alTeclear = (e) => {
    const i = siguientePestana(elegido, e.key, MODULOS_DE_LA_BIENVENIDA.length);
    if (i === null) return;
    e.preventDefault();
    setElegido(i);
    pestanas.current[i]?.focus();
    // En la fila deslizable del celular, focus() no trae entera una pestaña
    // que ya se ve en parte.
    pestanas.current[i]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  const clave = MODULOS_DE_LA_BIENVENIDA[elegido];
  const alPie = new Intl.ListFormat(locale, { type: "conjunction" }).format(
    MODULOS_AL_PIE.map((c) => modulo(c).nombre)
  );

  return (
    <>
      <div className="xl:grid xl:grid-cols-[220px_minmax(0,1fr)] xl:items-start xl:gap-8">
        <div
          role="tablist"
          aria-label={L("lista")}
          aria-orientation={vertical ? "vertical" : "horizontal"}
          onKeyDown={alTeclear}
          // La fila deslizable recorta lo que se sale de su caja: el
          // padding deja lugar al anillo de foco (3 px más 2 de separación).
          className="-mx-6 -my-1.5 flex gap-2 overflow-x-auto px-6 py-1.5 md:-mx-1.5 md:px-1.5 xl:m-0 xl:flex-col xl:gap-1 xl:overflow-visible xl:p-0"
        >
          {MODULOS_DE_LA_BIENVENIDA.map((c, i) => {
            const elegida = i === elegido;
            return (
              <button
                key={c}
                ref={(el) => (pestanas.current[i] = el)}
                type="button"
                role="tab"
                id={`modulo-${c}`}
                aria-selected={elegida}
                aria-controls="modulo-pantalla"
                tabIndex={elegida ? 0 : -1}
                onClick={() => setElegido(i)}
                className={`flex min-h-12 shrink-0 cursor-pointer items-center gap-2.5 rounded-full border-2 px-4 text-left transition-colors duration-100 xl:items-start xl:rounded-campo xl:px-3 xl:py-2.5 ${
                  elegida
                    ? "border-azul bg-azul-claro text-azul"
                    : "border-borde bg-tarjeta text-tinta-media hover:bg-superficie xl:border-transparent xl:bg-transparent"
                }`}
              >
                <Icono nombre={MODULOS[c].icono} className="size-5 shrink-0 xl:mt-0.5" />
                <span className="flex flex-col">
                  <span className={`text-etiqueta font-bold ${elegida ? "" : "text-tinta"}`}>{nombre(c)}</span>
                  <span className={`hidden text-apoyo/[20px] xl:block ${elegida ? "text-azul" : "text-tinta-suave"}`}>
                    {modulo(c).descripcion}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id="modulo-pantalla"
          aria-labelledby={`modulo-${clave}`}
          // El panel no tiene nada para tocar adentro: así el foco puede
          // llegar al contenido después de la lista.
          tabIndex={0}
          className="mt-5 rounded-tarjeta xl:mt-0"
        >
          {/* La key hace que la pantalla nueva entre con su fundido. */}
          <div key={clave} className="pantalla-modulo">
            <PantallaDeModulo clave={clave} icono={MODULOS[clave].icono} nombre={nombre(clave)} t={t} locale={locale} />
            <p className="mt-4 max-w-[62ch] text-cuerpo text-tinta-media">{L(`frase.${clave}`)}</p>
          </div>
        </div>
      </div>

      <p className="mt-8 text-cuerpo text-tinta-media">{L("yAdemas", { modulos: alPie })}</p>
    </>
  );
}
