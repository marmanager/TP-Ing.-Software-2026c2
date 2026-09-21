"use client";

// Las dos pantallas de la Agenda, una al lado de la otra.
//
// Estaban como submenú en la barra lateral y se mudaron acá adentro. La barra
// dice a qué sección vas; una vez adentro, cambiar de vista es parte de la
// sección y no un destino nuevo, igual que "Los que vienen / Los que ya
// pasaron" de la lista de turnos.
//
// Son links y no botones: cada vista tiene su dirección, así que se puede
// volver con el botón de atrás del navegador, guardarse un favorito y
// compartirse. Por eso tampoco llevan role="tab", que es para paneles que se
// cambian sin salir de la página; lo que corresponde es aria-current="page".
//
// Sólo aparecen las que el negocio tiene prendidas, y si queda una sola no
// aparece ninguna: un par de pestañas donde no hay nada para elegir es una
// decoración que ocupa 48 px de alto.

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icono from "./Icono";
import { useDatos } from "@/lib/datos";
import { SUBMODULOS, hijosActivos } from "@/lib/modulos";

const ORDEN = ["turnos", "calendario"];

export default function PestanasDeAgenda() {
  const ruta = usePathname();
  const { negocio } = useDatos();

  const prendidas = hijosActivos("agenda", negocio?.modulos_activos ?? []);
  if (prendidas.length < 2) return null;

  const vistas = ORDEN.map((c) => SUBMODULOS[c]).filter((s) =>
    prendidas.some((h) => h.clave === s.clave)
  );

  return (
    <nav aria-label="Las pantallas de la Agenda" className="mb-6">
      <ul className="flex flex-wrap gap-2">
        {vistas.map((v) => {
          // Exacta y no startsWith: "/agenda" es el principio de
          // "/agenda/calendario" y se marcarían las dos a la vez.
          const acá = ruta === v.ruta;
          return (
            <li key={v.clave}>
              <Link
                href={v.ruta}
                aria-current={acá ? "page" : undefined}
                className={[
                  "flex min-h-12 items-center gap-2 rounded-full border-2 px-4 text-etiqueta",
                  acá
                    ? "border-azul bg-azul-claro font-bold text-azul"
                    : "border-borde bg-tarjeta text-tinta-media hover:bg-superficie",
                ].join(" ")}
              >
                <Icono nombre={v.icono} className="size-5" />
                {v.nombre}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
