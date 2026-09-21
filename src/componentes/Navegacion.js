"use client";

// Navegación principal (cartilla, sección 05).
//
// Escritorio: barra lateral, siempre con texto. La lista puede crecer con las
// secciones que el negocio necesite, siempre con ícono y palabra.
//
// Celular: tres destinos abajo —Inicio · Casos · Agenda, lo que se usa todos
// los días— y un cuarto lugar, "Más", que abre un panel con TODAS las
// secciones, igual que la barra lateral de la computadora.
//
// EXCEPCIÓN A LA CARTILLA. La sección 05 dice "cuatro destinos abajo, nunca un
// menú escondido". Con nueve secciones posibles no entran en cuatro, y lo que
// no entraba sólo se alcanzaba desde el pie del Inicio. Se decidió en equipo
// que lo de todos los días siga a un toque, a la vista, y que lo que se usa
// menos quede a dos toques desde cualquier pantalla. "Más" va con ícono y
// palabra, y abre un panel a pantalla completa, no un desplegable chico. Está
// anotado en el README, en "Decisiones que se apartan de la cartilla".
//
// Si el negocio apagó la Agenda, su lugar no queda vacío: lo toma el siguiente
// destino que ese negocio tenga prendido, en el orden de la lista.
//
// El destino activo se marca con color Y con peso, no sólo con color. Cuando
// la sección actual está adentro de "Más", el que se marca es "Más": así se
// sabe dónde se está.
//
// Los destinos con "modulo" sólo aparecen si ese módulo está prendido en
// "Mi negocio" (SCRUM-38). El resto es núcleo y está siempre.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icono from "./Icono";
import { useDatos } from "@/lib/datos";
import { hijosActivos } from "@/lib/modulos";

const DESTINOS = [
  { href: "/", icono: "sol", palabra: "Inicio", celular: true },
  { href: "/casos", icono: "carpeta", palabra: "Casos", celular: true },
  {
    href: "/agenda",
    icono: "calendario",
    palabra: "Agenda",
    celular: true,
    modulo: "agenda",
    // La Agenda es la única sección con pantallas adentro: la lista de turnos
    // y el calendario del mes. Cada una se prende por su cuenta desde "Mi
    // negocio", así que las dos pueden no estar.
    hijos: [
      { href: "/agenda", icono: "reloj", palabra: "Turnos", modulo: "turnos" },
      { href: "/agenda/calendario", icono: "calendario", palabra: "Calendario", modulo: "calendario" },
    ],
  },
  { href: "/clientes", icono: "persona", palabra: "Clientes" },
  { href: "/inventario", icono: "cajas", palabra: "Inventario", modulo: "inventario" },
  { href: "/aprobar", icono: "persona-check", palabra: "A aprobar", modulo: "presupuesto" },
  { href: "/equipo", icono: "personas", palabra: "Equipo", modulo: "equipo" },
  // Núcleo, no módulo: lo que pasó en el negocio le sirve a cualquier rubro.
  { href: "/historial", icono: "historial", palabra: "Historial" },
  { href: "/negocio", icono: "tienda", palabra: "Mi negocio" },
];

const activo = (ruta, href) => (href === "/" ? ruta === "/" : ruta.startsWith(href));

// Deja pasar el núcleo y sólo los módulos prendidos.
//
// LAS PANTALLAS DE ADENTRO NO SE LISTAN ACÁ. Turnos y Calendario se cambian
// con las pestañas de arriba de la Agenda (componentes/PestanasDeAgenda.js).
// La barra dice a qué sección vas, y una vez adentro elegir la vista es parte
// de la sección.
//
// Lo que sí sigue acá es a dónde lleva "Agenda": al primer hijo prendido. Si
// el negocio apagó Turnos y dejó el Calendario, tocar "Agenda" tiene que
// llevar al calendario y no a una pantalla que ese negocio no tiene.
const conModulo = (destinos, negocio) => {
  const activos = negocio?.modulos_activos ?? [];
  return destinos
    .filter((d) => !d.modulo || activos.includes(d.modulo))
    .map((d) => {
      if (!d.hijos) return d;
      const prendidos = hijosActivos(d.modulo, activos).map((h) => h.clave);
      const primero = d.hijos.find((h) => prendidos.includes(h.modulo));
      return { ...d, href: primero?.href ?? d.href };
    });
};

// Los tres de abajo en celular: primero los marcados para la barra, y si
// alguno no está disponible se completa con el resto, sin repetir y
// respetando el orden en que están escritos. El cuarto lugar es "Más".
const DIRECTOS_EN_CELULAR = 3;

const paraCelular = (destinos, negocio) => {
  const disponibles = conModulo(destinos, negocio);
  const elegidos = disponibles.filter((d) => d.celular);

  for (const d of disponibles) {
    if (elegidos.length >= DIRECTOS_EN_CELULAR) break;
    if (!elegidos.includes(d)) elegidos.push(d);
  }

  // Ordenados como están escritos arriba. Se mide contra "disponibles" y no
  // contra DESTINOS porque conModulo() devuelve una copia de los destinos que
  // tienen hijos —les recalcula el href— y esa copia no está en la lista
  // original: indexOf daría -1 y los tres de abajo saldrían en cualquier orden.
  return elegidos
    .slice(0, DIRECTOS_EN_CELULAR)
    .sort((a, b) => disponibles.indexOf(a) - disponibles.indexOf(b));
};

// La lista de secciones con ícono y palabra. La usan la barra lateral y el
// panel de "Más", así las dos muestran lo mismo en el mismo orden.
function ListaDeSecciones({ destinos, ruta, grande = false }) {
  return (
    <ul className="flex flex-col gap-1">
      {destinos.map((d) => {
        // "/agenda" marca la sección también estando en "/agenda/calendario":
        // las dos son la Agenda, y cuál de las dos lo dicen las pestañas.
        const acá = activo(ruta, d.href);
        return (
          <li key={d.href}>
            <Link
              href={d.href}
              aria-current={acá ? "page" : undefined}
              className={[
                "flex items-center gap-3 rounded-campo px-3 text-cuerpo",
                grande ? "min-h-14" : "min-h-12",
                acá ? "bg-azul-claro font-bold text-azul" : "text-tinta-media hover:bg-superficie",
              ].join(" ")}
            >
              <Icono nombre={d.icono} className="size-7" />
              {d.palabra}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function BarraLateral() {
  const ruta = usePathname();
  const { negocio } = useDatos();

  return (
    <nav
      aria-label="Secciones"
      className="hidden w-64 shrink-0 border-r border-borde bg-fondo p-4 md:block"
    >
      <div className="mb-6 flex items-center gap-3 px-3">
        {/* La foto va sin texto alternativo a propósito: el nombre del
            negocio está al lado, y describirla otra vez haría que un lector
            de pantalla lo diga dos veces seguidas. */}
        {negocio?.foto ? (
          <img
            src={negocio.foto}
            alt=""
            className="size-11 shrink-0 rounded-campo object-cover"
          />
        ) : (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-campo bg-azul text-white">
            <Icono nombre="tienda" />
          </span>
        )}
        <span className="font-titulo font-extrabold text-subtitulo leading-tight">
          {negocio?.nombre ?? "Mi negocio"}
        </span>
      </div>
      <ListaDeSecciones destinos={conModulo(DESTINOS, negocio)} ruta={ruta} />
    </nav>
  );
}

// Lo que se ancla encima de la barra —el botón principal fijo, los avisos,
// el total de los pasos— necesita saber cuánto mide. De fábrica son 4rem,
// pero con la letra agrandada una palabra se puede partir en dos renglones y
// la barra crece: con un alto fijo, lo de arriba quedaba tapado. La barra
// mide su alto real y lo deja en --alto-barra; los demás lo usan con 4rem de
// respaldo.
function usarAltoPublicado(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const raiz = document.documentElement;
    const publicar = () => raiz.style.setProperty("--alto-barra", `${el.offsetHeight}px`);
    publicar();
    const observador = new ResizeObserver(publicar);
    observador.observe(el);
    return () => {
      observador.disconnect();
      raiz.style.removeProperty("--alto-barra");
    };
  }, [ref]);
}

// Acostado, el ícono y la palabra van en la misma línea: la barra pasa de
// 64 px de alto a 48 y le deja ese espacio al contenido (auditoría, criterio
// "funciona acostado").
const CLASE_DESTINO =
  "flex min-h-16 w-full flex-col items-center justify-center gap-1 px-1 text-apoyo " +
  "[@media(max-height:480px)]:min-h-12 [@media(max-height:480px)]:flex-row " +
  "[@media(max-height:480px)]:gap-2";

export function BarraCelular() {
  const ruta = usePathname();
  const { negocio } = useDatos();
  const directos = paraCelular(DESTINOS, negocio);
  const todos = conModulo(DESTINOS, negocio);
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  const botonMas = useRef(null);
  usarAltoPublicado(ref);

  // Si la pantalla actual no es uno de los tres de la barra, está adentro de
  // "Más", y es "Más" lo que se marca como activo.
  const enMas = !directos.some((d) => activo(ruta, d.href));

  // Al elegir una sección el panel se cierra solo: se cambió de pantalla.
  useEffect(() => {
    setAbierto(false);
  }, [ruta]);

  // Estable entre renders: el panel la usa en un efecto, y si cambiara cada
  // vez le devolvería el foco a "Cerrar" a cada rato.
  const cerrarPanel = useCallback(() => {
    setAbierto(false);
    // El foco vuelve a donde estaba: quien usa teclado o lector de pantalla
    // sigue desde "Más" y no desde el principio de la página.
    botonMas.current?.focus();
  }, []);

  return (
    <>
      <nav
        ref={ref}
        aria-label="Secciones principales"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-borde bg-tarjeta md:hidden"
      >
        <ul className="mx-auto flex max-w-lg">
          {directos.map((d) => {
            const acá = activo(ruta, d.href);
            return (
              <li key={d.href} className="flex-1">
                <Link
                  href={d.href}
                  aria-current={acá ? "page" : undefined}
                  className={[CLASE_DESTINO, acá ? "font-bold text-azul" : "text-tinta-media"].join(" ")}
                >
                  <Icono nombre={d.icono} className="size-7" />
                  {d.palabra}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              ref={botonMas}
              type="button"
              aria-expanded={abierto}
              aria-controls="panel-secciones"
              onClick={() => setAbierto(true)}
              className={[
                CLASE_DESTINO,
                "cursor-pointer",
                enMas ? "font-bold text-azul" : "text-tinta-media",
              ].join(" ")}
            >
              <Icono nombre="secciones" className="size-7" />
              Más
            </button>
          </li>
        </ul>
      </nav>

      {abierto && (
        <PanelDeSecciones
          destinos={todos}
          ruta={ruta}
          negocio={negocio}
          alCerrar={cerrarPanel}
        />
      )}
    </>
  );
}

// El panel de "Más": todas las secciones, a pantalla completa, como la barra
// lateral de la computadora. Se cierra con "Cerrar", con Escape o eligiendo
// una sección. Mientras está abierto, la página de atrás no se mueve.
function PanelDeSecciones({ destinos, ruta, negocio, alCerrar }) {
  const cerrar = useRef(null);

  useEffect(() => {
    cerrar.current?.focus();
    const raiz = document.documentElement;
    const antes = raiz.style.overflow;
    raiz.style.overflow = "hidden";
    const alTeclado = (e) => {
      if (e.key === "Escape") alCerrar();
    };
    window.addEventListener("keydown", alTeclado);
    return () => {
      raiz.style.overflow = antes;
      window.removeEventListener("keydown", alTeclado);
    };
  }, [alCerrar]);

  return (
    <div
      id="panel-secciones"
      role="dialog"
      aria-modal="true"
      aria-labelledby="panel-secciones-titulo"
      className="fixed inset-0 z-40 overflow-y-auto bg-fondo px-4 pt-4 pb-8 md:hidden"
    >
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {negocio?.foto ? (
            <img
              src={negocio.foto}
              alt=""
              className="size-11 shrink-0 rounded-campo object-cover"
            />
          ) : (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-campo bg-azul text-white">
              <Icono nombre="tienda" />
            </span>
          )}
          <div className="min-w-0">
            <h2 id="panel-secciones-titulo" className="text-seccion">
              Todas las secciones
            </h2>
            <p className="truncate text-apoyo text-tinta-suave">{negocio?.nombre}</p>
          </div>
        </div>
        <button
          ref={cerrar}
          type="button"
          onClick={alCerrar}
          className="flex min-h-12 shrink-0 cursor-pointer items-center gap-2 rounded-campo px-3 font-bold text-azul hover:bg-azul-claro"
        >
          <Icono nombre="cruz" />
          Cerrar
        </button>
      </div>
      <nav aria-label="Todas las secciones">
        <ListaDeSecciones destinos={destinos} ruta={ruta} grande />
      </nav>
    </div>
  );
}
