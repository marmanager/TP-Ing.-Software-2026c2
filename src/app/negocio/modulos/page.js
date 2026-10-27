"use client";

// "Módulos" (SCRUM-88).
//
// Pantalla propia y no una lista dentro de "Mi negocio": acá se decide si un
// módulo sirve o no, y para eso hace falta leer qué hace cada uno.
//
// Se llega desde "Mi negocio", no desde la navegación principal: el menú es
// para trabajar, no para configurar.
//
// La recomendación no se inventa: sale del preset del rubro, que ya declara
// con qué módulos arranca un negocio como este.

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
import { Boton, Cargando, TituloPantalla } from "@/componentes/ui";

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

      <ul className="grid gap-4">
        {LISTA_MODULOS.map((modulo) => {
          const m = traducirModulo(modulo, t);
          const prendido = estaPrendido(m.clave, activos);
          const recomendado = recomendados.includes(m.clave);
          // Las pantallas de adentro que están prendidas. Para un negocio de
          // antes de los submódulos son las dos, aunque no estén escritas.
          const adentro = hijosActivos(m.clave, activos);

          return (
            <li key={m.clave}>
              <div
                className={[
                  "rounded-tarjeta border-2 p-4 sm:p-6",
                  prendido ? "border-azul bg-azul-claro" : "border-borde bg-tarjeta",
                ].join(" ")}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="flex items-center gap-2 font-bold text-subtitulo">
                    <Icono nombre={m.icono} className="size-6" />
                    {m.nombre}
                  </p>
                  <span
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold text-etiqueta",
                      prendido ? "bg-tarjeta text-azul" : "bg-superficie text-tinta-media",
                    ].join(" ")}
                  >
                    <Icono nombre={prendido ? "listo" : "cruz"} className="size-5" />
                    {prendido ? t("ui.prendido") : t("ui.apagado")}
                  </span>
                </div>

                <p className="mt-3 max-w-[65ch] text-tinta-media">{m.queHace}</p>

                {recomendado && (
                  <p className="mt-3 flex items-center gap-1.5 font-bold text-etiqueta text-terracota">
                    <Icono nombre="tienda" className="size-5" />
                    {t("negocio.modulos.recomendado")}
                  </p>
                )}

                {puedeConfigurar && (
                  <div className="mt-4">
                    <Boton
                      icono={prendido ? "cruz" : "mas"}
                      onClick={() => alternar(m.clave)}
                      aria-pressed={prendido}
                    >
                      {prendido ? t("negocio.modulos.apagar", { nombre: m.nombre }) : t("negocio.modulos.prender", { nombre: m.nombre })}
                    </Boton>
                  </div>
                )}

                {/* Las pantallas de adentro. Aparecen recién cuando el módulo
                    está prendido: elegir cuáles de las dos querés antes de
                    haber dicho que querés la sección es una pregunta sin
                    sentido, y ocupa lugar en la pantalla de quien no la usa. */}
                {prendido && hijosDe(m.clave).length > 0 && (
                  <div className="mt-6 border-t border-borde pt-4">
                    <p className="font-bold text-etiqueta text-tinta-media">
                      {t("negocio.modulos.pantallasDe", { nombre: m.nombre })}
                    </p>
                    <ul className="mt-3 grid gap-3">
                      {hijosDe(m.clave).map((hijo) => {
                        const h = traducirModulo(hijo, t);
                        const hijoPrendido = adentro.some((x) => x.clave === h.clave);

                        return (
                          <li
                            key={h.clave}
                            className={[
                              "rounded-tarjeta border p-4",
                              hijoPrendido
                                ? "border-azul bg-tarjeta"
                                : "border-borde bg-superficie",
                            ].join(" ")}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="flex items-center gap-2 font-bold text-cuerpo">
                                <Icono nombre={h.icono} className="size-5" />
                                {h.nombre}
                              </p>
                              <span
                                className={[
                                  "inline-flex items-center gap-1.5 font-bold text-etiqueta",
                                  hijoPrendido ? "text-azul" : "text-tinta-media",
                                ].join(" ")}
                              >
                                <Icono
                                  nombre={hijoPrendido ? "listo" : "cruz"}
                                  className="size-5"
                                />
                                {hijoPrendido ? t("negocio.modulos.prendida") : t("negocio.modulos.apagada")}
                              </span>
                            </div>

                            <p className="mt-2 max-w-[65ch] text-tinta-media">{h.queHace}</p>

                            {puedeConfigurar && (
                              <div className="mt-3">
                                <Boton
                                  variante="plano"
                                  icono={hijoPrendido ? "cruz" : "mas"}
                                  onClick={() => alternar(h.clave)}
                                  aria-pressed={hijoPrendido}
                                >
                                  {hijoPrendido ? t("negocio.modulos.apagar", { nombre: h.nombre }) : t("negocio.modulos.prender", { nombre: h.nombre })}
                                </Boton>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
