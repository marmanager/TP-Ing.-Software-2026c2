"use client";

// Navegación principal (cartilla, sección 05).
//
// Escritorio: barra lateral, siempre con texto. La lista puede crecer con las
// secciones que el negocio necesite, siempre con ícono y palabra. Ocupa el alto
// de la pantalla y no se mueve con la página: arriba lo del trabajo de todos
// los días, y al pie Mi negocio y Mi perfil, que se usan mucho menos. Se puede
// cerrar para darle todo el ancho al contenido.
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
// "Mi negocio" (SCRUM-38). El resto —Inicio, Casos y Mi negocio— es núcleo y
// está siempre.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Icono from "./Icono";
import DesplegableVistaMaestra from "./DesplegableVistaMaestra";
import { useAuth } from "@/lib/auth";
import { textoDeError } from "@/lib/idioma";
import { ErrorGeneral } from "./ui";
import { puede } from "@/lib/permisos";
import { useDatos } from "@/lib/datos";
import { estaPrendido, hijosActivos, palabraDeBarra } from "@/lib/modulos";
import { useIdioma } from "@/lib/useIdioma";

const DESTINOS = [
  { href: "/", icono: "sol", id: "inicio", celular: true },
  { href: "/casos", icono: "carpeta", id: "casos", celular: true },
  {
    href: "/agenda",
    icono: "calendario",
    celular: true,
    modulo: "agenda",
    // La Agenda tiene pantallas adentro: la lista de turnos y el calendario
    // del mes. Cada una se prende por su cuenta desde "Mi negocio", así que
    // las dos pueden no estar. El Inventario, más abajo, igual.
    hijos: [
      { href: "/agenda", icono: "reloj", modulo: "turnos" },
      { href: "/agenda/calendario", icono: "calendario", modulo: "calendario" },
    ],
  },
  // Clientes e Historial eran núcleo y pasaron a módulo (SCRUM-122 y 120).
  // Vienen prendidos de fábrica: ver estaPrendido() en lib/modulos.js.
  { href: "/clientes", icono: "persona", modulo: "clientes" },
  {
    href: "/inventario",
    icono: "cajas",
    modulo: "inventario",
    // Igual que la Agenda: lo que hay y lo que viene (SCRUM-113). Si el
    // negocio apagó "En stock", tocar Inventario lleva a "En camino".
    hijos: [
      { href: "/inventario", icono: "cajas", modulo: "stock" },
      { href: "/inventario/en-camino", icono: "camion", modulo: "en_camino" },
      { href: "/inventario/sedes", icono: "tienda", modulo: "sedes" },
    ],
  },
  { href: "/ecuaciones", icono: "nota", modulo: "ecuaciones" },
  { href: "/lienzo", icono: "pincel", modulo: "lienzo" },
  { href: "/aprobar", icono: "persona-check", modulo: "presupuesto" },
  { href: "/equipo", icono: "personas", modulo: "equipo" },
  { href: "/historial", icono: "historial", modulo: "historial" },
  { href: "/dashboard", icono: "grafico", modulo: "dashboard", permiso: "ver_todos_los_casos" },
  // "alPie": van separados, abajo de todo. Son la configuración, no el
  // trabajo del día.
  { href: "/negocio", icono: "tienda", id: "negocio", alPie: true },
  // Lo de la persona, aparte de lo del negocio (SCRUM-118): sus datos, su
  // foto, su contraseña y el negocio en el que está.
  { href: "/perfil", icono: "cuenta", id: "perfil", alPie: true },
];

// Las dos partes de la lista: lo del trabajo, arriba, y lo de "alPie".
const partir = (destinos) => [destinos.filter((d) => !d.alPie), destinos.filter((d) => d.alPie)];

const activo = (ruta, href) => (href === "/" ? ruta === "/" : ruta.startsWith(href));

// Deja pasar el núcleo y sólo los módulos prendidos.
//
// LAS PANTALLAS DE ADENTRO NO SE LISTAN ACÁ. Turnos y Calendario se cambian
// con las pestañas de arriba de la Agenda (componentes/Pestanas.js).
// La barra dice a qué sección vas, y una vez adentro elegir la vista es parte
// de la sección.
//
// Lo que sí sigue acá es a dónde lleva "Agenda": al primer hijo prendido. Si
// el negocio apagó Turnos y dejó el Calendario, tocar "Agenda" tiene que
// llevar al calendario y no a una pantalla que ese negocio no tiene.
const conModulo = (destinos, negocio, quien) => {
  const activos = negocio?.modulos_activos ?? [];
  return destinos
    .filter((d) => (!d.modulo || estaPrendido(d.modulo, activos)) && (!d.permiso || puede(quien, d.permiso)))
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

const paraCelular = (destinos, negocio, quien) => {
  const disponibles = conModulo(destinos, negocio, quien);
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
  const { t } = useIdioma();
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
              {palabraDeBarra(d.modulo ?? d.id, t)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// En vista maestra "Mi negocio" no va (se mira, no se configura) y al pie hay
// "Salir de vista", que hace una llamada: por eso es un botón y no un Link.
const sinNegocio = (destinos) => destinos.filter((d) => d.id !== "negocio");

function usarSalida() {
  const router = useRouter();
  const { t } = useIdioma();
  const { salirDeVistaMaestra } = useAuth();
  const [saliendo, setSaliendo] = useState(false);
  const [errorAlSalir, setErrorAlSalir] = useState(null);
  async function salir() {
    setSaliendo(true);
    setErrorAlSalir(null);
    const r = await salirDeVistaMaestra();
    setSaliendo(false);
    if (r.ok) router.replace(r.negocioId ? "/" : "/negocios");
    else setErrorAlSalir(textoDeError(t, r.error));
  }
  return [salir, saliendo, errorAlSalir];
}

function BotonSalirDeVista({ salir, saliendo, errorAlSalir, grande = false }) {
  const { t } = useIdioma();
  return (
    <>
      {errorAlSalir && <div className="mt-2 px-3"><ErrorGeneral>{errorAlSalir}</ErrorGeneral></div>}
    <button
      type="button"
      onClick={salir}
      disabled={saliendo}
      className={`mt-1 flex w-full cursor-pointer items-center gap-3 rounded-campo px-3 text-cuerpo text-tinta-media hover:bg-superficie ${grande ? "min-h-14" : "min-h-12"}`}
    >
      <Icono nombre="salir" className="size-7" />
      {t("vistaMaestra.salir")}
    </button>
    </>
  );
}

// Foto + nombre de hoy, o el ojo y "Vista maestra" con la flechita del
// desplegable cuando se está en ella. "extra" es el botón de cerrar la barra.
function Encabezado({ negocio, enVista, extra }) {
  const { t } = useIdioma();
  const [abierto, setAbierto] = useState(false);
  // La barra y el panel "Más" están los dos en el DOM: ids propios de cada uno.
  const idDesplegable = useId();
  if (!enVista) {
    return (
      <div className="mb-6 flex items-center gap-3 pl-3">
        {/* La foto va sin texto alternativo a propósito: el nombre del
            negocio está al lado, y describirla otra vez haría que un lector
            de pantalla lo diga dos veces seguidas. */}
        {negocio?.foto ? (
          <img src={negocio.foto} alt="" className="size-11 shrink-0 rounded-campo object-cover" />
        ) : (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-campo bg-azul text-white">
            <Icono nombre="tienda" />
          </span>
        )}
        <span className="min-w-0 flex-1 font-titulo font-extrabold text-subtitulo leading-tight">
          {negocio?.nombre ?? t("negocio.titulo")}
        </span>
        {extra}
      </div>
    );
  }
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 pl-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-campo bg-espera text-white">
          <Icono nombre="ojo" />
        </span>
        <span className="min-w-0 flex-1 font-titulo font-extrabold text-subtitulo leading-tight">
          {t("vistaMaestra.titulo")}
        </span>
        <FlechitaDelDesplegable abierto={abierto} alTocar={() => setAbierto(!abierto)} controla={idDesplegable} />
        {extra}
      </div>
      {abierto && <DesplegableVistaMaestra id={idDesplegable} />}
    </div>
  );
}

function FlechitaDelDesplegable({ abierto, alTocar, controla }) {
  const { t } = useIdioma();
  return (
    <button
      type="button"
      onClick={alTocar}
      aria-expanded={abierto}
      aria-controls={controla}
      aria-label={t("vistaMaestra.desplegable.abrir")}
      title={t("vistaMaestra.desplegable.abrir")}
      className="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-campo text-tinta-media hover:bg-superficie hover:text-azul"
    >
      <Icono nombre={abierto ? "flecha-arriba" : "flecha-abajo"} />
    </button>
  );
}

// Si la barra está cerrada, en este navegador. Es una comodidad de cada
// persona en su computadora, no algo del negocio: no va a la base.
const LLAVE_BARRA = "marmanager.barra-cerrada";

export function BarraLateral() {
  const { t } = useIdioma();
  const ruta = usePathname();
  const { negocio } = useDatos();
  const { usuario } = useAuth();
  const enVista = Boolean(usuario?.vista_maestra_desde);
  const [arriba, alPie] = partir(conModulo(DESTINOS, negocio, usuario));
  const [salir, saliendo, errorAlSalir] = usarSalida();
  const [cerrada, setCerrada] = useState(false);
  const boton = useRef(null);
  const recienTocado = useRef(false);

  // Se lee después de montar: en el servidor no hay localStorage, y leerlo
  // antes haría que lo de los dos lados no coincida.
  useEffect(() => {
    try {
      setCerrada(window.localStorage.getItem(LLAVE_BARRA) === "1");
    } catch {
      // Sin almacenamiento, la barra arranca abierta, como siempre.
    }
  }, []);

  // Al abrir o cerrar, el foco pasa al botón que quedó: el de antes ya no
  // existe, y quien usa teclado no tiene que volver a buscarlo.
  useEffect(() => {
    if (!recienTocado.current) return;
    recienTocado.current = false;
    boton.current?.focus();
  }, [cerrada]);

  const cambiar = (valor) => {
    recienTocado.current = true;
    setCerrada(valor);
    try {
      if (valor) window.localStorage.setItem(LLAVE_BARRA, "1");
      else window.localStorage.removeItem(LLAVE_BARRA);
    } catch {
      // Si no se puede guardar, igual se cierra; sólo no se recuerda.
    }
  };

  // Sólo un ícono, sin la palabra, a pedido del equipo: el texto lo dicen
  // aria-label para el lector de pantalla y title al pasar el mouse.
  const botonDeBarra = (
    <button
      ref={boton}
      type="button"
      onClick={() => cambiar(!cerrada)}
      aria-label={cerrada ? t("navegacion.abrirMenu") : t("navegacion.cerrarMenu")}
      title={cerrada ? t("navegacion.abrirMenu") : t("navegacion.cerrarMenu")}
      aria-expanded={!cerrada}
      className="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-campo text-tinta-media hover:bg-superficie hover:text-azul"
    >
      <Icono nombre="panel" />
    </button>
  );

  // Cerrada queda sólo el botón para abrirla, quieto arriba a la izquierda.
  // El contenido se queda con el resto del ancho.
  if (cerrada) {
    return (
      <div className="hidden shrink-0 px-2 py-4 md:block">
        <div className="sticky top-4">{botonDeBarra}</div>
      </div>
    );
  }

  return (
    <nav aria-label={t("navegacion.secciones")} className="hidden w-64 shrink-0 border-r border-borde bg-fondo md:block">
      {/* Del alto de la pantalla y quieta mientras la página se mueve, así el
          pie queda siempre abajo. Si las secciones no entran, se mueve sólo
          la lista de arriba y el pie no se tapa. */}
      <div className="sticky top-0 flex h-dvh flex-col p-4">
        <Encabezado negocio={negocio} enVista={enVista} extra={botonDeBarra} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ListaDeSecciones destinos={arriba} ruta={ruta} />
        </div>
        <div className="mt-4 border-t border-borde pt-4">
          <ListaDeSecciones destinos={enVista ? sinNegocio(alPie) : alPie} ruta={ruta} />
          {enVista && <BotonSalirDeVista salir={salir} saliendo={saliendo} errorAlSalir={errorAlSalir} />}
        </div>
      </div>
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
  const { t } = useIdioma();
  const ruta = usePathname();
  const { negocio } = useDatos();
  const { usuario } = useAuth();
  const enVista = Boolean(usuario?.vista_maestra_desde);
  const destinos = enVista ? sinNegocio(DESTINOS) : DESTINOS;
  const directos = paraCelular(destinos, negocio, usuario);
  const todos = conModulo(destinos, negocio, usuario);
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
        aria-label={t("navegacion.seccionesPrincipales")}
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
                  {palabraDeBarra(d.modulo ?? d.id, t)}
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
              {t("navegacion.mas")}
            </button>
          </li>
        </ul>
      </nav>

      {abierto && (
        <PanelDeSecciones
          destinos={todos}
          ruta={ruta}
          negocio={negocio}
          enVista={enVista}
          alCerrar={cerrarPanel}
        />
      )}
    </>
  );
}

// El panel de "Más": todas las secciones, a pantalla completa, como la barra
// lateral de la computadora. Se cierra con "Cerrar", con Escape o eligiendo
// una sección. Mientras está abierto, la página de atrás no se mueve.
function PanelDeSecciones({ destinos, ruta, negocio, enVista, alCerrar }) {
  const { t } = useIdioma();
  const [salir, saliendo, errorAlSalir] = usarSalida();
  const [abierto, setAbierto] = useState(false);
  const idDesplegable = useId();
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
          {enVista ? (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-campo bg-espera text-white">
              <Icono nombre="ojo" />
            </span>
          ) : negocio?.foto ? (
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
              {t("navegacion.todasLasSecciones")}
            </h2>
            <p className="truncate text-apoyo text-tinta-suave">
              {enVista ? t("vistaMaestra.titulo") : negocio?.nombre}
            </p>
          </div>
          {enVista && <FlechitaDelDesplegable abierto={abierto} alTocar={() => setAbierto(!abierto)} controla={idDesplegable} />}
        </div>
        <button
          ref={cerrar}
          type="button"
          onClick={alCerrar}
          className="flex min-h-12 shrink-0 cursor-pointer items-center gap-2 rounded-campo px-3 font-bold text-azul hover:bg-azul-claro"
        >
          <Icono nombre="cruz" />
          {t("navegacion.cerrar")}
        </button>
      </div>
      {/* Partida igual que la barra de la computadora: Mi negocio y Mi
          perfil en un grupo aparte, al final. */}
      {enVista && abierto && (
        <div className="mb-6">
          <DesplegableVistaMaestra id={idDesplegable} />
        </div>
      )}
      <nav aria-label={t("navegacion.todasLasSecciones")}>
        <ListaDeSecciones destinos={partir(destinos)[0]} ruta={ruta} grande />
        <div className="mt-4 border-t border-borde pt-4">
          <ListaDeSecciones destinos={partir(destinos)[1]} ruta={ruta} grande />
          {enVista && <BotonSalirDeVista salir={salir} saliendo={saliendo} errorAlSalir={errorAlSalir} grande />}
        </div>
      </nav>
    </div>
  );
}
