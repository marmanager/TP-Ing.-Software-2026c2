"use client";

// La landing: lo primero que ve quien todavía no tiene cuenta (SCRUM-5).
//
// Dos cosas la separan del resto del sistema y las dos son a propósito:
//
// 1. La marca no es un logotipo, son los cinco estados. De ahí baja un hilo
//    de 2 px por el margen izquierdo y, en cada sección, lo interrumpe un
//    tramo del color del estado que esa sección está contando. El hilo es el
//    único elemento de la página atado al scroll, porque es el único cuyo
//    trabajo es decir en qué parte del argumento está el lector.
//
// 2. Los nombres de los cinco estados salen de presets.js y no están
//    escritos acá. Si alguien renombra un estado de un rubro, las tabletas
//    de la sección 02 lo siguen solas. Es la pantalla más fácil de dejar
//    mintiendo.
//
// El movimiento vive en src/app/globals.css y lo prende esta pantalla. El
// contrato es que la página se lee entera sin él: nada esconde nada por su
// cuenta, todo lo que esconde cuelga de la clase "mov".
//
// Los casos del recorte son de ejemplo. Son la única invención de la página:
// no hay testimonios, ni logos, ni cantidades de usuarios, ni precios.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import Icono from "@/componentes/Icono";
import { accionDeFila, ESTADOS, ORDEN_ESTADOS } from "@/lib/estados";
import { PRESETS } from "@/lib/presets";

// Los nombres del núcleo común, los que no pertenecen a ningún rubro. Van
// acá y no en estados.js porque en el sistema nunca se muestran: adentro
// siempre se ve la palabra del rubro del negocio.
const NOMBRE_COMUN = {
  nuevo: "Nuevo",
  en_proceso: "En proceso",
  esperando: "Esperando",
  revision_final: "Revisión",
  completado: "Completado",
};

const RUBROS = [
  { clave: "taller", nombre: "Taller" },
  { clave: "medicina", nombre: "Consultorio" },
  { clave: "service", nombre: "Service" },
];

// Los casos del recorte son de ejemplo, pero la acción de cada fila NO se
// escribe acá: sale de accionDeFila(), la misma función que decide el botón
// en la pantalla de casos de verdad. Si alguien cambia esa palabra en el
// sistema, el recorte la sigue solo. Antes estaban escritas a mano y decían
// «Asignar», «Llegó» y «Entregar», que son tres botones que el producto no
// tiene.
const CASOS = [
  {
    id: 1,
    estado: "nuevo",
    numero: 251,
    asunto: "Ruido raro",
    cliente: "Marcela Suárez",
    tiene: "Sin asignar",
    sinAsignar: true,
    falta: "Asignar a alguien",
  },
  {
    id: 2,
    estado: "en_proceso",
    numero: 248,
    asunto: "Frenos",
    cliente: "Hugo Peralta",
    tiene: "Diego",
    falta: "Cargar los pasos",
    soloEscritorio: true,
  },
  {
    id: 3,
    estado: "esperando",
    numero: 246,
    asunto: "Cambio de aceite",
    cliente: "Silvina Roldán",
    tiene: "Proveedor",
    falta: "El filtro de aceite",
    // Con un insumo pedido, accionDeFila ofrece marcar que llegó.
    insumo: true,
  },
  {
    id: 4,
    estado: "revision_final",
    numero: 243,
    asunto: "No arranca",
    cliente: "Ariel Castro",
    tiene: "Diego",
    falta: "Control antes de entregar",
    soloEscritorio: true,
  },
  {
    id: 5,
    estado: "completado",
    numero: 239,
    asunto: "Service de rutina",
    cliente: "Norma Giménez",
    tiene: "Valeria",
    falta: "Se entregó el viernes",
  },
];

const INSUMOS = CASOS.filter((c) => c.insumo).map((c) => ({
  caso_id: c.id,
  estado: "pedido",
}));

const accionDe = (caso) => accionDeFila(caso, { pasos: [], insumos: INSUMOS });

const CUENTAS = { nuevo: 4, en_proceso: 5, esperando: 3, revision_final: 2, completado: 4 };
const TOTAL = Object.values(CUENTAS).reduce((a, b) => a + b, 0);

const MANANA = [
  {
    hora: "08:47",
    icono: "chat",
    titulo: "En un audio de WhatsApp",
    texto:
      "El presupuesto se lo mandaste el martes. Quedó en un audio, entre otros cuarenta mensajes.",
  },
  {
    hora: "09:02",
    icono: "nota",
    titulo: "En un papel del mostrador",
    texto:
      "La orden está escrita a mano, abajo de otras cuatro, con la letra del que atendió. Dice qué hay que hacer; no dice si ya se hizo.",
  },
  {
    hora: "09:15",
    icono: "telefono",
    titulo: "En la cabeza del que atendió",
    texto:
      "El cliente llama para saber cómo viene lo suyo y hay que cortar, caminar hasta el fondo y buscar al que lo recibió.",
  },
];

const DIA = [
  {
    estado: "nuevo",
    titulo: "Cuando entra",
    texto:
      "Quién lo trae, la patente y qué necesita, con las palabras del cliente. El número de caso lo pone el sistema.",
  },
  {
    estado: "en_proceso",
    titulo: "Cuando cambia",
    texto:
      "Tocás el estado que corresponde. Queda anotado quién lo movió y a qué hora, sin escribir nada.",
  },
  {
    estado: "completado",
    titulo: "Cuando sale",
    texto: "Control final, entregado, y el caso se cierra con todo lo que pasó adentro.",
  },
];

const HISTORIAL = [
  { hora: "Lun 08:40", estado: "nuevo", que: "lo recibió Valeria" },
  { hora: "Lun 09:05", estado: "en_proceso", que: "lo tomó Diego" },
  { hora: "Lun 11:20", estado: "esperando", que: "falta la bomba de nafta" },
  { hora: "Mar 15:10", estado: "en_proceso", que: "llegó la bomba" },
  { hora: "Mar 17:45", estado: "revision_final", que: "listo para entregar" },
];

const etiqueta = (rubro, estado) => PRESETS[rubro].etiquetas[estado];

/* ---------------------------------------------------------------- piezas */

// Las cinco franjas de color, que son la marca.
function Marca({ className = "size-10" }) {
  return (
    <span
      className={`flex flex-col overflow-hidden rounded-campo border border-borde ${className}`}
    >
      {ORDEN_ESTADOS.map((e) => (
        <i key={e} className={`flex-1 ${ESTADOS[e].barra}`} />
      ))}
    </span>
  );
}

// El tramo del hilo que le toca a cada sección. En escritorio vive en el
// margen izquierdo; en celular el hilo vertical no entra en un margen de
// 24 px, así que se da vuelta y pasa a ser una regla horizontal arriba de la
// sección. Mismo dispositivo, otro eje.
function Tramo({ numero, estados, alto, color }) {
  const franjas = estados ?? [];
  return (
    <>
      <div
        aria-hidden
        className="tramo rv absolute left-[130px] top-24 hidden items-start gap-4 md:flex"
      >
        <span className="flex w-3 flex-col overflow-hidden rounded-[2px]">
          {franjas.length > 0 ? (
            franjas.map((e) => (
              <i
                key={e}
                className={`m-baja ${ESTADOS[e].barra}`}
                style={{ height: alto }}
              />
            ))
          ) : (
            <i className={`m-baja ${color}`} style={{ height: alto }} />
          )}
        </span>
        {numero && (
          <span className="m-item font-titulo text-[40px]/[40px] font-black tracking-[-0.02em] tabular-nums">
            {numero}
          </span>
        )}
      </div>

      <div aria-hidden className="tramo rv md:hidden">
        <span className="flex h-1 w-full overflow-hidden">
          {franjas.length > 0 ? (
            franjas.map((e) => <i key={e} className={`m-baja flex-1 ${ESTADOS[e].barra}`} />)
          ) : (
            <i className={`m-baja w-full ${color}`} />
          )}
        </span>
      </div>
    </>
  );
}

// El titular grande, partido en tres líneas. Cada línea vive en su propia
// caja para que el revelado suba desde abajo detrás de una máscara; el
// padding compensado no es decorativo, es lo que evita que la máscara le
// coma la cola de la Q.
function Titular({ lineas, className = "", observado = false }) {
  return (
    <span className={`titular block ${observado ? "rv" : ""} ${className}`}>
      {lineas.map((l) => (
        <span key={l}>
          <span>{l}</span>
        </span>
      ))}
    </span>
  );
}

function Chip({ estado, children, className = "" }) {
  const e = ESTADOS[estado];
  return (
    <span
      className={`inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-etiqueta font-bold ${e.fondo} ${e.texto} ${className}`}
    >
      <Icono nombre={e.icono} className="size-[18px]" />
      {children}
    </span>
  );
}

function Eyebrow({ children }) {
  return (
    <p className="text-[16px]/[16px] font-extrabold tracking-[0.06em] text-terracota">
      {children}
    </p>
  );
}

// El numeral de sección, en celular: en escritorio va en el margen.
function NumeroCelular({ numero, color }) {
  return (
    <span
      className={`font-titulo text-[32px]/[32px] font-black tracking-[-0.02em] tabular-nums md:hidden ${color}`}
    >
      {numero}
    </span>
  );
}

const HOJA = "mx-auto w-full max-w-[1440px] px-6 md:pl-[290px] md:pr-[130px]";
const HILO =
  "hilo pointer-events-none absolute left-[135px] top-0 bottom-0 hidden w-0.5 md:block";
const BOTON =
  "inline-flex h-14 items-center justify-center rounded-campo border-2 px-6 text-cuerpo font-bold transition-colors duration-100";
// El único control que queda dibujado dentro del recorte. Va con borde de
// 1 px y no de 2: adentro de una captura no tiene que pedir que lo toquen,
// alcanza con que se entienda que la pantalla tiene por dónde empezar.
const CONTORNO =
  "inline-flex h-12 items-center justify-center gap-2 rounded-campo border border-borde bg-tarjeta px-4 text-etiqueta font-bold text-tinta";

/* ----------------------------------------------------------------- página */

// Prende el movimiento y arma el observador que revela cada sección al
// entrar en pantalla.
//
// La clase "mov" se agrega ACÁ y no en un script del <head>, aunque un
// script suelto correría antes del primer pintado. El motivo es concreto:
// la Guardia muestra "Cargando…" mientras resuelve la sesión, así que
// cuando se dispara DOMContentLoaded esta pantalla todavía no existe en el
// DOM y un observador armado ahí no encuentra una sola sección que mirar —
// y entonces nada se revela nunca.
//
// El orden importa y es defensivo: primero se observa, y recién cuando todo
// salió bien se prende "mov". Si algo falla, la clase no se pone (o se
// saca) y la página queda entera, que es el contrato. Va en un efecto de
// maquetado y no en uno común para que la clase esté puesta antes del
// primer pintado del hero: si no, el titular se vería completo y recién
// después arrancaría a animarse.
function usarMovimiento() {
  const [activo, setActivo] = useState(false);

  useLayoutEffect(() => {
    const raiz = document.documentElement;
    const apagar = () => {
      raiz.classList.remove("mov");
      setActivo(false);
    };
    let io;
    try {
      if (!matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
      if (!("IntersectionObserver" in window)) return;
      io = new IntersectionObserver(
        (entradas) => {
          for (const e of entradas) {
            if (!e.isIntersecting) continue;
            e.target.classList.add("vi");
            io.unobserve(e.target);
          }
        },
        // Dispara cuando la sección ya está claramente en pantalla, no
        // rozando el borde de abajo.
        { rootMargin: "0px 0px -12% 0px" }
      );
      for (const n of document.querySelectorAll(".landing .rv")) io.observe(n);
      raiz.classList.add("mov");
      setActivo(true);
    } catch {
      apagar();
    }
    return () => {
      io?.disconnect();
      apagar();
    };
  }, []);

  return activo;
}

// El recorrido de la 02, clavado: la seccion se queda quieta mientras el
// lector sigue bajando y los cinco estados van llegando de a uno. La seccion
// se llama «El recorrido», así que conviene que el recorrido se haga en vez
// de dibujarse.
//
// Los estados se acumulan en vez de reemplazarse. Al final la matriz queda
// entera, porque el argumento de la seccion —los mismos cinco estados, tres
// vocabularios— necesita verlos juntos: si cada uno tapara al anterior, el
// lector nunca llegaría a compararlos.
//
// Devuelve el paso a partir del avance del scroll dentro del contenedor
// alto. Se mide con getBoundingClientRect y no con un observador de
// intersección porque acá hace falta un avance continuo, no un aviso de
// entrada, y porque tiene que funcionar igual bajando que subiendo.
function usarPasos(activo, cuantos) {
  const caja = useRef(null);
  const [paso, setPaso] = useState(0);

  useEffect(() => {
    const el = caja.current;
    if (!activo || !el) return;

    // Sólo en escritorio: clavar tres pantallas enteras en un celular es
    // pelearse con el pulgar del que está leyendo. Ahí las cinco fichas
    // apiladas ya cuentan lo mismo sin trabar nada.
    const escritorio = matchMedia("(min-width: 48rem)");
    let pedido = 0;

    const medir = () => {
      pedido = 0;
      if (!escritorio.matches) {
        setPaso(cuantos - 1);
        return;
      }
      const r = el.getBoundingClientRect();
      const recorrido = r.height - window.innerHeight;
      const avance = recorrido > 0 ? -r.top / recorrido : 1;
      setPaso(Math.floor(Math.min(0.999, Math.max(0, avance)) * cuantos));
    };

    const alMoverse = () => {
      if (!pedido) pedido = requestAnimationFrame(medir);
    };

    medir();
    addEventListener("scroll", alMoverse, { passive: true });
    addEventListener("resize", alMoverse);
    return () => {
      if (pedido) cancelAnimationFrame(pedido);
      removeEventListener("scroll", alMoverse);
      removeEventListener("resize", alMoverse);
    };
  }, [activo, cuantos]);

  return [caja, paso];
}

export default function Bienvenida() {
  const activo = usarMovimiento();
  const [caja, paso] = usarPasos(activo, ORDEN_ESTADOS.length);

  return (
    <div className="landing bg-fondo">
      {/* ============================ barra ============================ */}
      <header className="border-b border-borde">
        <div className="mx-auto flex h-20 w-full max-w-[1440px] items-center justify-between px-6 md:px-[130px]">
          <span className="flex items-center gap-3.5">
            <Marca />
            <span className="font-titulo text-[20px]/[20px] font-black tracking-[-0.01em]">
              MarManager
            </span>
          </span>
          <div className="flex items-center gap-6">
            <Link
              href="/iniciar-sesion"
              className="py-3.5 text-etiqueta font-bold text-azul underline underline-offset-4 transition-colors duration-100 hover:text-azul-apretado"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/crear-cuenta"
              className="hidden h-12 items-center rounded-campo border-2 border-tinta bg-superficie px-5 text-etiqueta font-bold text-tinta transition-colors duration-100 hover:bg-borde sm:inline-flex"
            >
              Crear una cuenta
            </Link>
          </div>
        </div>
      </header>

      {/* la marca a sangre: declara de entrada que esto trata de cinco estados */}
      <div aria-hidden className="flex h-2.5">
        {ORDEN_ESTADOS.map((e) => (
          <i key={e} className={`flex-1 ${ESTADOS[e].barra}`} />
        ))}
      </div>

      {/* ======================== hero + producto ====================== */}
      <section className="hero relative pt-14 md:pt-32">
        <div aria-hidden className={`${HILO} hilo--fija bg-borde-fuerte`} />
        <div
          aria-hidden
          className="absolute left-[130px] top-32 hidden w-3 flex-col overflow-hidden rounded-[2px] md:flex"
        >
          {ORDEN_ESTADOS.map((e) => (
            <i key={e} className={`h-7 ${ESTADOS[e].barra}`} />
          ))}
        </div>

        <div className={HOJA}>
          <div className="m-sube mov-eyebrow">
            <Eyebrow>TALLER MECÁNICO · CONSULTORIO · SERVICE TÉCNICO</Eyebrow>
          </div>

          {/* El tamaño va fluido y no en dos escalones: cada línea tiene que
              entrar entera en una sola línea, porque una que se parta en dos
              rompe el revelado — cada línea vive adentro de su propia caja con
              máscara. A 390 da 40 px y a 360 da 37, que es lo que aguanta
              «CADA TRABAJO» sin cortarse. */}
          <h1 className="mt-2 max-w-[790px] font-titulo text-[clamp(32px,10.2vw,44px)]/[0.9] font-black tracking-[-0.03em] md:text-[94px]/[84px]">
            <Titular lineas={["CADA TRABAJO", "QUE TE ENTRA", "TIENE SU CASO"]} />
          </h1>

          <p className="m-sube mov-parrafo mt-6 max-w-[46ch] text-cuerpo text-tinta-media">
            Entra un auto y lo abrís como un caso: su ficha con quién lo trajo, qué hay que
            hacerle, cómo viene, quién lo tiene y qué falta para entregarlo. Lo mismo con un
            paciente o con un equipo.
          </p>

          <div className="m-sube mov-accion mt-10">
            <Link
              href="/crear-cuenta"
              className={`${BOTON} w-full border-azul bg-azul text-white hover:border-azul-apretado hover:bg-azul-apretado sm:w-auto`}
            >
              Crear una cuenta
            </Link>
          </div>
          <p className="m-sube mov-sesion mt-5 text-apoyo text-tinta-suave">
            ¿Ya tenés cuenta?{" "}
            <Link
              href="/iniciar-sesion"
              className="font-bold text-azul underline underline-offset-[3px] transition-colors duration-100 hover:text-azul-apretado"
            >
              Iniciá sesión
            </Link>
          </p>

          {/* El recorte del producto. Llega al borde derecho y se corta por
              abajo: el corte es la profundidad. Sin sombra, sin marco de
              notebook, sin inclinación. */}
          <div className="mt-14 md:mt-24 md:-mr-[130px] md:h-[634px] md:overflow-hidden md:rounded-tl-tarjeta md:border-l md:border-t md:border-borde md:pt-7 md:pl-8">
            <div className="flex flex-col gap-5 md:h-[88px] md:flex-row md:items-start md:justify-between md:gap-6 md:pr-8">
              <div>
                <h2 className="font-titulo text-[26px]/[30px] font-extrabold tracking-[-0.02em] md:text-pantalla md:tracking-[-0.02em]">
                  Casos
                </h2>
                <p className="mt-2 text-cuerpo text-tinta-media md:mt-5">
                  Todo lo que entró, en el estado en el que está.
                </p>
              </div>
              {/* El envoltorio es para esconderlo, y no un `hidden` encima:
                  CONTORNO ya trae `inline-flex` y las dos son utilidades de
                  display, así que la que gana la decide el orden del CSS y
                  no el del atributo. */}
              <span className="hidden shrink-0 md:block">
                <span className={CONTORNO}>
                  <Icono nombre="mas" className="size-5 text-azul" />
                  Abrir un caso nuevo
                </span>
              </span>
            </div>

            {/* fila de filtros: en celular es una fila con scroll propio, que
                es lo que es — una fila de controles, no una tabla */}
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 tabular-nums md:mt-0 md:mb-5 md:overflow-visible md:pr-8 md:pb-0">
              <span className="inline-flex h-12 shrink-0 items-center rounded-full border-2 border-azul bg-azul-claro px-4 text-etiqueta font-bold text-azul">
                Todos ({TOTAL})
              </span>
              {ORDEN_ESTADOS.map((e) => (
                <span
                  key={e}
                  className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full border border-borde bg-tarjeta px-4 text-etiqueta font-bold"
                >
                  <Icono nombre={ESTADOS[e].icono} className={`size-[18px] ${ESTADOS[e].texto}`} />
                  {etiqueta("taller", e)} ({CUENTAS[e]})
                </span>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-3 md:mt-0 md:mr-8 md:block md:gap-0 md:overflow-hidden md:rounded-t-tarjeta md:border md:border-b-0 md:border-borde md:bg-tarjeta">
              {/* rótulos de columna: la marca de 1 px sale del borde, como una
                  leyenda de anatomía. Se usa una sola vez y para algo. */}
              <div className="hidden h-10 grid-cols-[6px_170px_1.4fr_0.8fr_1.1fr_200px] items-end gap-4 border-b border-borde pr-4 pb-1 text-apoyo font-bold tracking-[0.06em] text-tinta-suave md:grid">
                <i />
                {["ESTADO", "CASO", "LO TIENE", "QUÉ FALTA"].map((r) => (
                  <span key={r} className="flex flex-col gap-1">
                    <i className="h-3 w-px bg-terracota" />
                    {r}
                  </span>
                ))}
                <i />
              </div>

              {CASOS.map((c) => {
                const accion = accionDe(c);
                return (
                <div
                  key={c.numero}
                  className={`fila overflow-hidden rounded-tarjeta border border-borde-fuerte bg-tarjeta transition-colors duration-100 md:grid md:h-[82px] md:grid-cols-[6px_170px_1.4fr_0.8fr_1.1fr_200px] md:items-center md:gap-4 md:rounded-none md:border-0 md:border-b md:border-borde md:pr-4 md:hover:bg-fondo ${
                    c.soloEscritorio ? "hidden md:grid" : ""
                  }`}
                >
                  <i
                    className={`m-baja block h-1.5 w-full md:h-full md:w-1.5 ${ESTADOS[c.estado].barra}`}
                  />
                  <div className="p-4 md:contents">
                    <Chip estado={c.estado} className="md:h-10">
                      {etiqueta("taller", c.estado)}
                    </Chip>
                    <span className="mt-3 flex flex-col tabular-nums md:mt-0">
                      <span className="font-titulo text-ident tracking-[-0.01em]">
                        Caso {c.numero}
                      </span>
                      <span className="text-apoyo text-tinta-suave">
                        {c.asunto} · {c.cliente}
                      </span>
                    </span>
                    <span className="mt-3 flex flex-col md:mt-0 md:block">
                      <span className="text-apoyo text-tinta-suave md:hidden">Lo tiene</span>
                      <span className={`text-cuerpo ${c.sinAsignar ? "text-tinta-suave" : ""}`}>
                        {c.tiene}
                      </span>
                    </span>
                    <span className="mt-3 flex flex-col md:mt-0 md:block">
                      <span className="text-apoyo text-tinta-suave md:hidden">Qué falta</span>
                      <span className="text-cuerpo text-tinta-media">{c.falta}</span>
                    </span>
                    {/* Acá NO va un botón con caja. Es una captura, no un
                        control: cinco cajas de 2 px apiladas eran lo más
                        pesado del recorte y se leían como algo para tocar.
                        Plano, con su ícono y en azul, es el mismo lenguaje
                        del sistema —la variante «plano» de Boton— y deja que
                        manden los chips, que son el argumento. */}
                    <span className="mt-3 inline-flex items-center gap-2 text-etiqueta font-bold text-azul md:mt-0">
                      <Icono nombre={accion.icono} className="size-5" />
                      {accion.etiqueta}
                    </span>
                  </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ====================== 01 · el problema ======================= */}
      {/* La única sección sin un solo color de estado: hoy no hay sistema,
          entonces no hay color. */}
      <section className="relative pt-14 pb-14 md:py-24">
        <div aria-hidden className={`${HILO} bg-borde-fuerte`} />
        <Tramo numero="01" alto="56px" color="bg-nuevo" />

        <div className={`${HOJA} mt-4 md:mt-0`}>
          <div className="flex items-center gap-3">
            <NumeroCelular numero="01" color="text-nuevo" />
            <Eyebrow>EL PROBLEMA</Eyebrow>
          </div>
          <h2 className="mt-2 font-titulo text-[26px]/[30px] font-black tracking-[-0.02em] md:text-pantalla md:font-black md:tracking-[-0.02em]">
            Hoy un mismo trabajo vive en tres lugares distintos
          </h2>

          {/* Misma anatomía que el historial de un caso: cuando el lector lo
              vea funcionando en la 03, reconoce el objeto. */}
          <div className="entradas rv mt-6 max-w-[760px] border-t border-borde-fuerte md:mt-10">
            {MANANA.map((m) => (
              <div
                key={m.hora}
                className="m-item border-b border-borde py-5 md:grid md:grid-cols-[92px_32px_1fr] md:gap-5 md:py-6"
              >
                <span className="flex items-center gap-2.5 text-apoyo tabular-nums text-tinta-suave md:block md:text-cuerpo md:font-bold">
                  <Icono nombre={m.icono} className="size-5 md:hidden" />
                  {m.hora}
                </span>
                <Icono nombre={m.icono} className="mt-1 hidden size-[22px] text-tinta-suave md:block" />
                <span>
                  <span className="mt-1 block font-titulo text-subtitulo font-extrabold text-tinta-media md:mt-0">
                    {m.titulo}
                  </span>
                  <span className="block max-w-[58ch] text-cuerpo text-tinta-suave">{m.texto}</span>
                </span>
              </div>
            ))}
          </div>

          <p className="remate rv relative mt-8 max-w-[700px] pl-5 font-titulo text-[26px]/[30px] font-black tracking-[-0.02em] md:mt-10 md:pl-6 md:text-pantalla md:font-black md:tracking-[-0.02em]">
            <span className="m-item block">
              Ninguno de los tres te dice, a las nueve de la mañana, qué hay que hacer hoy.
            </span>
          </p>
        </div>
      </section>

      {/* ====================== 02 · el recorrido ====================== */}
      {/* La única sección clavada de la página: mientras el lector baja, se
          queda quieta y los cinco estados van llegando de a uno. El alto de
          «recorrido» y el clavado de «escenario» viven los dos detrás de
          .mov y de la consulta de escritorio, así que sin JS —y en celular—
          esto es la matriz entera de siempre, sin un hueco de más. */}
      <section className="relative pb-14 md:pb-0">
        <div ref={caja} className="recorrido">
          <div className="escenario relative md:py-24">
            <div aria-hidden className={`${HILO} hilo--fija bg-borde-fuerte`} />

            {/* Acá el riel es el indicador de avance: los estados que todavía
                no llegaron esperan apagados. Es decorativo y aria-hidden, así
                que bajarles la opacidad no le saca contraste a ningún texto. */}
            <div
              aria-hidden
              className="absolute left-[130px] top-1/2 hidden -translate-y-1/2 items-start gap-4 md:flex"
            >
              <span className="flex w-3 flex-col overflow-hidden rounded-[2px]">
                {ORDEN_ESTADOS.map((e, i) => (
                  <i
                    key={e}
                    className={`h-6 transition-opacity duration-300 ${ESTADOS[e].barra} ${
                      i <= paso ? "opacity-100" : "opacity-25"
                    }`}
                  />
                ))}
              </span>
              <span className="font-titulo text-[40px]/[40px] font-black tracking-[-0.02em] tabular-nums">
                02
              </span>
            </div>

            <div aria-hidden className="tramo rv md:hidden">
              <span className="flex h-1 w-full overflow-hidden">
                {ORDEN_ESTADOS.map((e) => (
                  <i key={e} className={`m-baja flex-1 ${ESTADOS[e].barra}`} />
                ))}
              </span>
            </div>

            <div className={`${HOJA} mt-4 md:mt-0`}>
              <div className="flex items-center gap-3">
                <NumeroCelular numero="02" color="text-tinta" />
                <Eyebrow>EL RECORRIDO</Eyebrow>
              </div>
              <h2 className="mt-2 font-titulo text-[26px]/[30px] font-black tracking-[-0.02em] md:text-pantalla md:font-black md:tracking-[-0.02em]">
                Cinco estados. Cada rubro los llama como habla.
              </h2>

              {/* Cinco tabletas sueltas, una por estado, y cada una se basta
                  sola: por eso repite los tres rubros en vez de apoyarse en
                  una columna de rótulos. No afirma que sirve para tres
                  rubros, lo demuestra — y con las tabletas separadas se ve
                  que son cinco cosas que pasan una después de otra, no cinco
                  celdas de una planilla.

                  Es una sola maqueta para las dos pantallas: en celular van
                  apiladas con el rubro y su palabra en el mismo renglón; en
                  escritorio van en fila de cinco y el renglón se parte en
                  dos, porque a 190 px de ancho no entran los dos al lado.

                  La grilla reserva las cinco columnas desde el principio, así
                  que las que faltan dejan el hueco en vez de empujar a las
                  que ya llegaron: se ve que falta algo y nada se mueve de
                  lugar. A la que llegó no se le baja el tono —perdería
                  contraste—: al activo lo marcan su borde y el fondo claro de
                  su propio color, que es color más ícono más palabra. */}
              <div className="matriz rv mt-6 flex flex-col gap-3 md:mt-10 md:grid md:max-w-[1020px] md:grid-cols-5 md:gap-4">
                {ORDEN_ESTADOS.map((e, i) => {
                  const marcado = activo && i === paso;
                  return (
                    <div
                      key={e}
                      className={`tableta overflow-hidden rounded-tarjeta border bg-tarjeta ${
                        marcado ? `${ESTADOS[e].borde} border-2` : "border-borde-fuerte"
                      } ${i > paso ? "col-oculta" : ""}`}
                    >
                      <i
                        className={`m-cruza block h-2 w-full ${ESTADOS[e].barra}`}
                        style={{ "--r": `${i * 0.09}s` }}
                      />
                      <div className={`p-4 ${marcado ? ESTADOS[e].fondo : ""}`}>
                        <span
                          className={`flex items-center gap-2 font-titulo text-subtitulo font-black tabular-nums ${ESTADOS[e].texto}`}
                        >
                          {i + 1}
                          <Icono nombre={ESTADOS[e].icono} className="size-[18px]" />
                          <span className="font-cuerpo text-etiqueta font-extrabold">
                            {NOMBRE_COMUN[e]}
                          </span>
                        </span>

                        <div className="mt-3 flex flex-col gap-1 border-t border-borde pt-3 md:gap-3">
                          {RUBROS.map((r) => (
                            <span
                              key={r.clave}
                              className="flex justify-between gap-4 md:flex-col md:gap-0"
                            >
                              <span className="text-apoyo/[28px] text-tinta-suave md:leading-[22px]">
                                {r.nombre}
                              </span>
                              <span
                                className={
                                  r.clave === "taller"
                                    ? "text-cuerpo font-bold text-tinta"
                                    : "text-cuerpo text-tinta-suave"
                                }
                              >
                                {etiqueta(r.clave, e)}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mt-5 max-w-[62ch] text-cuerpo text-tinta-media md:mt-6">
                Los cinco son siempre los mismos y están en los tres rubros: lo único que cambia
                son las palabras. Elegís el tuyo una vez, cuando creás el negocio, y el sistema
                pasa a hablar como vos.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ====================== 03 · el día a día ====================== */}
      {/* Único cambio de fondo de la página: acá dejó de argumentar y pasó a
          mostrar el trabajo diario. */}
      <section className="relative border-y border-borde bg-superficie py-14 md:py-24">
        <div aria-hidden className={`${HILO} bg-borde-fuerte`} />
        <Tramo numero="03" alto="56px" color="bg-completo" />

        <div className={`${HOJA} mt-4 md:mt-0`}>
          <div className="flex items-center gap-3">
            <NumeroCelular numero="03" color="text-completo" />
            <Eyebrow>EL DÍA A DÍA</Eyebrow>
          </div>
          <h2 className="mt-2 font-titulo text-[26px]/[30px] font-black tracking-[-0.02em] md:text-pantalla md:font-black md:tracking-[-0.02em]">
            Lo anotás cuando entra y lo movés cuando cambia
          </h2>

          <div className="mt-6 grid gap-8 md:mt-10 md:grid-cols-[430px_1fr] md:items-start md:gap-14">
            <div>
              <div className="rv flex flex-col gap-3">
                {DIA.map((d) => (
                  <div
                    key={d.titulo}
                    className="regla relative pt-4"
                    style={{ "--c": `var(--color-${ESTADOS[d.estado].barra.slice(3)})` }}
                  >
                    <h3 className="text-subtitulo font-extrabold">{d.titulo}</h3>
                    <p className="text-cuerpo text-tinta-media">{d.texto}</p>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-cuerpo text-tinta-media">
                Eso es todo el trabajo diario. No hay una segunda planilla que llenar a la noche.
              </p>
            </div>

            <div className="flex overflow-hidden rounded-tarjeta border border-borde-fuerte bg-tarjeta">
              <i className="w-1.5 shrink-0 bg-revision" />
              <div className="flex-1 p-4 md:p-6">
                <div className="flex flex-col-reverse items-start gap-3 md:flex-row md:items-start md:justify-between md:gap-5">
                  <div className="tabular-nums">
                    <span className="block font-titulo text-ident font-black tracking-[-0.01em]">
                      Caso 243
                    </span>
                    <span className="block text-cuerpo text-tinta-media">
                      No arranca · Ariel Castro
                    </span>
                  </div>
                  <Chip estado="revision_final">{etiqueta("taller", "revision_final")}</Chip>
                </div>

                <div className="mt-4 flex flex-col gap-2 border-t border-borde pt-3 md:flex-row md:gap-10 md:border-0 md:pt-0">
                  {[
                    ["Patente", "AB 123 CD", true],
                    ["Lo tiene", "Diego", false],
                    ["Qué falta", "Control antes de entregar", false],
                  ].map(([r, v, num]) => (
                    <span key={r} className="flex justify-between gap-4 md:block">
                      <span className="text-apoyo text-tinta-suave">{r}</span>
                      <span className={`text-cuerpo font-bold ${num ? "tabular-nums" : ""}`}>
                        {v}
                      </span>
                    </span>
                  ))}
                </div>

                <div className="mt-5 border-t border-borde pt-5">
                  <p className="text-apoyo font-bold tracking-[0.06em] text-tinta-suave">
                    LO QUE PASÓ CON ESTE CASO
                  </p>
                  <ul className="historial rv mt-4 flex flex-col gap-4 tabular-nums md:gap-5">
                    {HISTORIAL.map((h, i) => (
                      <li
                        key={i}
                        className="m-item grid grid-cols-[76px_20px_1fr] items-start gap-3 md:grid-cols-[88px_20px_1fr] md:items-center md:gap-4"
                      >
                        <span className="text-cuerpo text-tinta-suave">{h.hora}</span>
                        <Icono
                          nombre={ESTADOS[h.estado].icono}
                          className={`mt-1 size-5 md:mt-0 ${ESTADOS[h.estado].texto}`}
                        />
                        <span className="text-cuerpo text-tinta-media">
                          <strong className="font-bold text-tinta">
                            {etiqueta("taller", h.estado)}
                          </strong>{" "}
                          · {h.que}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5 border-t border-borde pt-4">
                  <p className="text-apoyo text-tinta-suave">
                    Cinco toques en dos días. Eso es todo lo que se cargó a mano.
                  </p>
                  <p className="text-apoyo text-tinta-suave">
                    Cuando llama el cliente, abrís el caso y le contestás sin cortar ni
                    preguntarle a nadie.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ cierre =========================== */}
      {/* El hero con el par de tokens dado vuelta: el mismo componente, no
          una sección nueva. El movimiento lo prueba en vez de declararlo. */}
      <section className="cierre relative bg-tinta pt-20 md:pt-32">
        <div aria-hidden className={`${HILO} bg-tinta-suave`} />
        <div
          aria-hidden
          className="absolute left-[130px] top-32 hidden w-3 flex-col overflow-hidden rounded-[2px] md:flex"
        >
          {ORDEN_ESTADOS.map((e) => (
            <i key={e} className={`h-7 ${ESTADOS[e].barra}`} />
          ))}
        </div>

        <div className={HOJA}>
          {/* Un escalón menos que el hero en celular, y no por capricho: sus
              líneas son dos caracteres más largas y a 40 px se parten. En
              escritorio los dos miden 94 px, que es donde se lee que son el
              mismo componente. */}
          <h2 className="max-w-[950px] font-titulo text-[clamp(28px,8.8vw,38px)]/[0.9] font-black tracking-[-0.03em] text-fondo md:text-[94px]/[84px]">
            <Titular
              observado
              lineas={["EL PRIMER CASO", "ES EL QUE TENÉS", "EN EL MOSTRADOR"]}
            />
          </h2>
          <p className="mt-5 max-w-[48ch] text-cuerpo text-borde-fuerte md:mt-6">
            Creás la cuenta, elegís tu rubro y cargás ese caso. Mañana a la mañana la pantalla ya
            está armada.
          </p>
          <div className="mt-8 md:mt-10">
            <Link
              href="/crear-cuenta"
              className={`${BOTON} w-full border-fondo bg-fondo text-tinta hover:bg-superficie sm:w-auto`}
            >
              Crear una cuenta
            </Link>
          </div>
          <p className="mt-5 text-apoyo text-borde-fuerte">
            ¿Ya tenés cuenta?{" "}
            <Link
              href="/iniciar-sesion"
              className="font-bold text-fondo underline underline-offset-[3px]"
            >
              Iniciá sesión
            </Link>
          </p>

          <div className="mt-8 h-px bg-tinta-suave md:mt-10" />
          <p className="mt-5 text-apoyo text-borde-fuerte md:mt-6">
            Se crea con tu nombre, tu mail, tu teléfono y una contraseña. Después, el nombre del
            negocio y el rubro.
          </p>

          <div aria-hidden className="mt-20 flex h-2.5 md:mt-32">
            {ORDEN_ESTADOS.map((e) => (
              <i key={e} className={`flex-1 ${ESTADOS[e].barra}`} />
            ))}
          </div>
        </div>
      </section>

      {/* ============================== pie ============================ */}
      <footer className="bg-fondo">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-6 px-6 py-8 md:px-[130px]">
          <span className="flex items-center gap-3">
            <Marca className="size-7" />
            <span className="font-titulo text-etiqueta font-black">MarManager</span>
          </span>
          <Link
            href="/iniciar-sesion"
            className="text-apoyo font-bold text-azul transition-colors duration-100 hover:text-azul-apretado"
          >
            Iniciar sesión
          </Link>
        </div>
      </footer>
    </div>
  );
}
