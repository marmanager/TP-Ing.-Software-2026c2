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
import { puede, QUIEN_PUEDE } from "@/lib/permisos";
import { LISTA_MODULOS } from "@/lib/modulos";
import { preset } from "@/lib/presets";
import Icono from "@/componentes/Icono";
import { Boton, Cargando, TituloPantalla } from "@/componentes/ui";

export default function Modulos() {
  const datos = useDatos();
  const { cargando, negocio } = datos;
  const { usuario } = useAuth();
  useTitulo("Módulos");

  if (cargando) return <Cargando />;

  const activos = negocio?.modulos_activos ?? [];
  const recomendados = preset(negocio?.rubro).modulos ?? [];
  const puedeConfigurar = puede(usuario?.rol, "configurarNegocio");

  const alternar = (clave) =>
    datos.cambiarModulos(
      activos.includes(clave) ? activos.filter((c) => c !== clave) : [...activos, clave]
    );

  return (
    <>
      <Link
        href="/negocio"
        className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul"
      >
        <Icono nombre="volver" />
        Volver a Mi negocio
      </Link>

      <TituloPantalla apoyo="Las secciones que usa tu negocio.">Módulos</TituloPantalla>

      <p className="mb-8 max-w-[65ch] text-tinta-media">
        {puedeConfigurar
          ? "Hoy, Casos, Clientes y Mi negocio están siempre. El resto los prendés y apagás según te sirvan. Apagar uno lo saca del menú: no borra nada de lo que ya cargaste."
          : `Hoy, Casos, Clientes y Mi negocio están siempre. El resto los tiene o no tu negocio. ${QUIEN_PUEDE.configurarNegocio}`}
      </p>

      <ul className="grid gap-4">
        {LISTA_MODULOS.map((m) => {
          const prendido = activos.includes(m.clave);
          const recomendado = recomendados.includes(m.clave);

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
                    {prendido ? "Prendido" : "Apagado"}
                  </span>
                </div>

                <p className="mt-3 max-w-[65ch] text-tinta-media">{m.queHace}</p>

                {recomendado && (
                  <p className="mt-3 flex items-center gap-1.5 font-bold text-etiqueta text-terracota">
                    <Icono nombre="tienda" className="size-5" />
                    Recomendado para tu rubro
                  </p>
                )}

                {puedeConfigurar && (
                  <div className="mt-4">
                    <Boton
                      icono={prendido ? "cruz" : "mas"}
                      onClick={() => alternar(m.clave)}
                      aria-pressed={prendido}
                    >
                      {prendido ? `Apagar ${m.nombre}` : `Prender ${m.nombre}`}
                    </Boton>
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
