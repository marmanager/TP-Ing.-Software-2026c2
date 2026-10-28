"use client";

// "Módulos" (SCRUM-88).
//
// Pantalla propia y no una lista dentro de "Mi negocio": acá se decide si un
// módulo sirve o no, y para eso hace falta leer qué hace cada uno.
//
// Se llega desde "Mi negocio", no desde la navegación principal: el menú es
// para trabajar, no para configurar.
//
// Cada módulo es una fila cerrada (ícono, nombre e interruptor) que se abre
// para leer qué hace: así la lista entra en pantalla sin tener que scrollear.
//
// La recomendación no se inventa: sale del preset del rubro, que ya declara
// con qué módulos arranca un negocio como este.

import { useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { puede, quienPuede } from "@/lib/permisos";
import { useIdioma } from "@/lib/useIdioma";
import {
  LISTA_MODULOS,
  alternarModulo,
  estaPrendido,
  hijosActivos,
  hijosDe,
  traducirModulo,
} from "@/lib/modulos";
import { preset } from "@/lib/presets";
import Icono from "@/componentes/Icono";
import { Cargando, TituloPantalla } from "@/componentes/ui";

export default function Modulos() {
  const datos = useDatos();
  const { cargando, negocio } = datos;
  const { usuario } = useAuth();
  const { idioma, t } = useIdioma();
  useTitulo(t("negocio.modulosResumen.titulo"));

  if (cargando) return <Cargando />;

  const activos = negocio?.modulos_activos ?? [];
  const recomendados = preset(negocio?.rubro, idioma).modulos ?? [];
  const puedeConfigurar = puede(usuario, "configurar_negocio");

  // Las tres reglas de prender y apagar —que prender un módulo prenda sus
  // pantallas, que apagarlo se las lleve, y que apagar una deje escrita la
  // otra— viven en lib/modulos.js, con sus pruebas.
  const alternar = (clave) => datos.cambiarModulos(alternarModulo(clave, activos));

  return (
    <>
      <Link
        href="/negocio"
        className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul"
      >
        <Icono nombre="volver" />
        {t("negocio.volver")}
      </Link>

      <TituloPantalla apoyo={t("negocio.modulos.apoyo")}>{t("negocio.modulosResumen.titulo")}</TituloPantalla>

      <p className="mb-8 max-w-[65ch] text-tinta-media">
        {puedeConfigurar
          ? t("negocio.modulos.intro")
          : t("negocio.modulos.introSoloLectura", { quienPuede: quienPuede("configurar_negocio", t) })}
      </p>

      <ul className="grid gap-3">
        {LISTA_MODULOS.map((modulo) => {
          const m = traducirModulo(modulo, t);
          const prendido = estaPrendido(m.clave, activos);
          // Las pantallas de adentro que están prendidas. Para un negocio de
          // antes de los submódulos son las dos, aunque no estén escritas.
          const adentro = hijosActivos(m.clave, activos);
          // Aparecen recién con el módulo prendido: elegir cuáles querés antes
          // de haber dicho que querés la sección es una pregunta sin sentido.
          const hijos = prendido ? hijosDe(m.clave) : [];

          return (
            <Fila
              key={m.clave}
              m={m}
              prendido={prendido}
              puedeConfigurar={puedeConfigurar}
              onAlternar={() => alternar(m.clave)}
              t={t}
            >
              {recomendados.includes(m.clave) && (
                <p className="mt-3 flex items-center gap-1.5 font-bold text-etiqueta text-terracota">
                  <Icono nombre="tienda" className="size-5" />
                  {t("negocio.modulos.recomendado")}
                </p>
              )}

              {hijos.length > 0 && (
                <div className="mt-4 border-t border-borde pt-4">
                  <p className="mb-3 font-bold text-etiqueta text-tinta-media">
                    {t("negocio.modulos.pantallasDe", { nombre: m.nombre })}
                  </p>
                  <ul className="grid gap-2">
                    {hijos.map((hijo) => {
                      const h = traducirModulo(hijo, t);
                      return (
                        <Fila
                          key={h.clave}
                          hijo
                          m={h}
                          prendido={adentro.some((x) => x.clave === h.clave)}
                          puedeConfigurar={puedeConfigurar}
                          onAlternar={() => alternar(h.clave)}
                          t={t}
                        />
                      );
                    })}
                  </ul>
                </div>
              )}
            </Fila>
          );
        })}
      </ul>
    </>
  );
}

// Una fila: ícono y nombre a la izquierda, interruptor a la derecha. Tocar el
// nombre abre la explicación. El interruptor es hermano del botón que abre y
// no hijo, para que tocarlo no abra ni cierre nada.
function Fila({ m, prendido, puedeConfigurar, onAlternar, t, hijo, children }) {
  const [abierto, setAbierto] = useState(false);
  const accion = t(prendido ? "negocio.modulos.apagar" : "negocio.modulos.prender", { nombre: m.nombre });

  return (
    <li
      className={[
        "rounded-tarjeta border-2",
        prendido && !hijo ? "border-azul bg-azul-claro" : "border-borde bg-tarjeta",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 pr-3 sm:pr-4">
        <button
          type="button"
          aria-expanded={abierto}
          onClick={() => setAbierto(!abierto)}
          className="flex min-h-14 flex-1 cursor-pointer items-center gap-3 px-3 text-left font-bold sm:px-4"
        >
          <Icono nombre={m.icono} className={hijo ? "size-5 shrink-0" : "size-6 shrink-0"} />
          <span className="flex-1">{m.nombre}</span>
          <Icono nombre={abierto ? "flecha-arriba" : "flecha-abajo"} className="size-5 shrink-0 text-tinta-media" />
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={prendido}
          aria-label={accion}
          title={accion}
          disabled={!puedeConfigurar}
          onClick={onAlternar}
          data-testid={`modulo-alternar-${m.clave}`}
          className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            prendido ? "bg-azul" : "bg-borde-fuerte"
          }`}
        >
          <span
            aria-hidden="true"
            className={`absolute top-0.5 left-0 size-6 rounded-full bg-white transition-transform ${
              prendido ? "translate-x-5.5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      {abierto && (
        <div className="px-3 pb-4 sm:px-4">
          <p className="max-w-[65ch] text-tinta-media">{m.queHace}</p>
          {children}
        </div>
      )}
    </li>
  );
}
