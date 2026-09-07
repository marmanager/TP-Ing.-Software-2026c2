"use client";

// Navegación principal (cartilla, sección 05).
//
// Escritorio: barra lateral, siempre con texto. La lista puede crecer con las
// secciones que el negocio necesite, siempre con ícono y palabra.
//
// Celular: cuatro destinos abajo, nunca un menú escondido. El máximo es cuatro;
// elegimos Hoy · Casos · Agenda · Mi negocio porque la agenda se usa todos los
// días, y a los clientes se llega desde cualquier caso.
//
// El destino activo se marca con color Y con peso, no sólo con color.
//
// Los destinos con "modulo" sólo aparecen si ese módulo está prendido en
// "Mi negocio" (SCRUM-38). El resto es núcleo y está siempre.

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icono from "./Icono";
import { useDatos } from "@/lib/datos";

const DESTINOS = [
  { href: "/", icono: "sol", palabra: "Hoy", celular: true },
  { href: "/casos", icono: "carpeta", palabra: "Casos", celular: true },
  { href: "/agenda", icono: "calendario", palabra: "Agenda", celular: true, modulo: "agenda" },
  { href: "/clientes", icono: "persona", palabra: "Clientes" },
  { href: "/inventario", icono: "cajas", palabra: "Inventario", modulo: "inventario" },
  { href: "/aprobar", icono: "persona-check", palabra: "A aprobar", modulo: "presupuesto" },
  { href: "/equipo", icono: "personas", palabra: "Equipo", modulo: "equipo" },
  { href: "/negocio", icono: "tienda", palabra: "Mi negocio", celular: true },
];

const activo = (ruta, href) => (href === "/" ? ruta === "/" : ruta.startsWith(href));

// Deja pasar el núcleo y sólo los módulos prendidos.
const conModulo = (destinos, negocio) => {
  const activos = negocio?.modulos_activos ?? [];
  return destinos.filter((d) => !d.modulo || activos.includes(d.modulo));
};

export function BarraLateral() {
  const ruta = usePathname();
  const { negocio } = useDatos();
  const destinos = conModulo(DESTINOS, negocio);

  return (
    <nav
      aria-label="Secciones"
      className="hidden w-64 shrink-0 border-r border-borde bg-fondo p-4 md:block"
    >
      <div className="mb-6 flex items-center gap-3 px-3">
        <span className="flex size-11 items-center justify-center rounded-campo bg-azul text-white">
          <Icono nombre="tienda" />
        </span>
        <span className="font-titulo font-extrabold text-subtitulo leading-tight">
          {negocio?.nombre ?? "Mi negocio"}
        </span>
      </div>

      <ul className="flex flex-col gap-1">
        {destinos.map((d) => {
          const acá = activo(ruta, d.href);
          return (
            <li key={d.href}>
              <Link
                href={d.href}
                aria-current={acá ? "page" : undefined}
                className={[
                  "flex min-h-12 items-center gap-3 rounded-campo px-3 text-cuerpo",
                  acá
                    ? "bg-azul-claro font-bold text-azul"
                    : "text-tinta-media hover:bg-superficie",
                ].join(" ")}
              >
                <Icono nombre={d.icono} className="size-7" />
                {d.palabra}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function BarraCelular() {
  const ruta = usePathname();
  const { negocio } = useDatos();
  const destinos = conModulo(DESTINOS, negocio).filter((d) => d.celular);

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-borde bg-tarjeta md:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {destinos.map((d) => {
          const acá = activo(ruta, d.href);
          return (
            <li key={d.href} className="flex-1">
              <Link
                href={d.href}
                aria-current={acá ? "page" : undefined}
                className={[
                  "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-apoyo",
                  acá ? "font-bold text-azul" : "text-tinta-media",
                ].join(" ")}
              >
                <Icono nombre={d.icono} className="size-7" />
                {d.palabra}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
