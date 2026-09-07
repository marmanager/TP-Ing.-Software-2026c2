"use client";

// "Inicio" — lo primero que se ve al abrir (cartilla, sección 09).
//
// Se llama Inicio y no Home porque la sección 07 no deja poner palabras en
// inglés donde existe una en castellano.
//
// La pantalla se arma con módulos: cada uno asoma una feature del sistema.
// Acomodando, cada módulo se comporta como una imagen en un documento: se
// agarra del medio y se lleva a cualquier lado, y se le cambia el tamaño
// tirando de la esquina punteada. Van en una grilla de seis columnas, así que
// pueden quedar uno al lado del otro y no sólo apilados.
//
// Mientras se acomoda, los huecos verticales se ven: cada módulo queda donde
// lo soltaste. Al guardar se recortan y todo sube a apoyarse. A lo ancho no:
// si dejás una columna libre, se respeta.
//
// Lo mismo se puede hacer con el teclado (flechas, y Shift para el tamaño) y
// con los botones de Ajustes: en un celular no hay grilla que arrastrar, y hay
// gente que no usa el mouse.
//
// El modo acomodar trabaja sobre una copia: hasta que no se toca "Guardar",
// la pantalla de verdad no cambia, y "Descartar" la deja como estaba
// (principio 6: todo se puede deshacer).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { estaAbierto } from "@/lib/estados";
import {
  ALTO_FILA,
  COLUMNAS,
  INICIO_POR_DEFECTO,
  SEPARACION,
  agregables,
  agregar,
  cambiarFiltro,
  colocar,
  compactar,
  intercambiar,
  normalizarInicio,
  quitar,
  redimensionar,
  resolver,
  visibles,
} from "@/lib/inicio";
import Modulo from "@/componentes/inicio/Modulo";
import Icono from "@/componentes/Icono";
import { Boton, Cargando, TituloSeccion, Vacio } from "@/componentes/ui";

const FLECHAS = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

// No arranca un arrastre si el dedo cayó sobre algo que se toca.
const enAlgoQueSeToca = (destino) =>
  destino instanceof Element && destino.closest("button, select, input, a, label");

export default function Inicio() {
  const { cargando, casos, negocio, inicio, cambiarInicio, avisarExito } = useDatos();
  useTitulo("Inicio");

  const [acomodando, setAcomodando] = useState(false);
  const [borrador, setBorrador] = useState(null);
  const [ocultos, setOcultos] = useState([]);
  const [seleccion, setSeleccion] = useState(null);
  const [ajustando, setAjustando] = useState(null);
  const [agarrado, setAgarrado] = useState(null);

  const grillaRef = useRef(null);
  const arrastre = useRef(null);

  // Mientras se arrastra, el mouse manda aunque se vaya del módulo.
  useEffect(() => {
    if (!agarrado) return;

    function mover(e) {
      const a = arrastre.current;
      if (!a) return;

      const dx = Math.round((e.clientX - a.px) / a.celda.ancho);
      const dy = Math.round((e.clientY - a.py) / a.celda.alto);
      if (dx === a.dx && dy === a.dy) return;
      a.dx = dx;
      a.dy = dy;

      // Siempre se resuelve desde la foto de cuando lo agarró: así la vista
      // previa es la misma para el mismo lugar del mouse, y no se va
      // acumulando el empujón de los pasos anteriores.
      setBorrador(
        a.tipo === "mover"
          ? colocar(a.base, a.clave, a.item.x + dx, a.item.y + dy)
          : redimensionar(a.base, a.clave, a.item.ancho + dx, a.item.alto + dy)
      );
    }

    function soltar() {
      arrastre.current = null;
      setAgarrado(null);
    }

    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
    return () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
    };
  }, [agarrado]);

  if (cargando) return <Cargando />;

  const modulosActivos = negocio?.modulos_activos ?? [];
  const enPantalla = acomodando ? borrador : visibles(inicio, modulosActivos);
  const sePuedenAgregar = agregables([...(borrador ?? []), ...ocultos], modulosActivos);

  const abiertos = casos.filter(estaAbierto).length;
  const fecha = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  // Cuánto mide una celda ahora mismo, para traducir píxeles a celdas.
  function medirCelda() {
    const el = grillaRef.current;
    if (!el) return null;
    const ancho = (el.clientWidth - SEPARACION * (COLUMNAS - 1)) / COLUMNAS;
    return { ancho: ancho + SEPARACION, alto: ALTO_FILA + SEPARACION };
  }

  function agarrar(e, clave, tipo) {
    // Sólo el botón principal, y sólo donde hay grilla: en celular se acomoda
    // con los botones de Ajustes.
    if (e.button > 0) return;
    if (!window.matchMedia("(min-width: 48rem)").matches) return;
    if (enAlgoQueSeToca(e.target)) return;

    const item = borrador.find((m) => m.clave === clave);
    const celda = medirCelda();
    if (!item || !celda) return;

    e.preventDefault();
    e.stopPropagation();
    arrastre.current = { clave, tipo, item, celda, base: borrador, px: e.clientX, py: e.clientY };
    setAgarrado(clave);
    setSeleccion(clave);
  }

  function teclado(e, clave) {
    if (e.key === "Escape") {
      e.preventDefault();
      if (ajustando) setAjustando(null);
      else setSeleccion(null);
      return;
    }

    const paso = FLECHAS[e.key];
    if (!paso) return;
    // Con los ajustes abiertos las flechas son para moverse por los controles.
    if (ajustando === clave) return;
    e.preventDefault();

    const item = borrador.find((m) => m.clave === clave);
    if (!item) return;

    setBorrador((b) =>
      e.shiftKey
        ? redimensionar(b, clave, item.ancho + paso[0], item.alto + paso[1])
        : colocar(b, clave, item.x + paso[0], item.y + paso[1])
    );
  }

  function empezarAAcomodar() {
    // Los módulos de features apagadas no entran en la grilla mientras se
    // acomoda: si no, empujarían desde un lugar que nadie ve. Se guardan
    // aparte y vuelven tal cual al grabar.
    const enGrilla = visibles(inicio, modulosActivos);
    const claves = new Set(enGrilla.map((m) => m.clave));
    setBorrador(enGrilla);
    setOcultos(inicio.filter((m) => !claves.has(m.clave)));
    setSeleccion(null);
    setAjustando(null);
    setAcomodando(true);
  }

  function salirDeAcomodar() {
    setAcomodando(false);
    setBorrador(null);
    setSeleccion(null);
    setAjustando(null);
  }

  function guardar() {
    // Recién acá se recortan los huecos verticales. Mientras se acomodaba se
    // veían, para poder mirar lo que uno estaba haciendo.
    const acomodado = compactar(borrador);
    const subioAlgo = acomodado.some(
      (m) => m.y !== borrador.find((b) => b.clave === m.clave)?.y
    );

    cambiarInicio([...acomodado, ...ocultos]);
    salirDeAcomodar();
    avisarExito(
      subioAlgo
        ? "Listo. Juntamos los módulos para arriba así no te quedan espacios en blanco."
        : "Listo. Tu pantalla de inicio quedó como la dejaste."
    );
  }

  // Las acciones de Ajustes. Todas trabajan sobre el borrador: nada toca la
  // pantalla de verdad hasta que se guarda.
  const acciones = {
    redimensionar: (clave, ancho, alto) =>
      setBorrador((b) => redimensionar(b, clave, ancho, alto)),
    intercambiar: (clave, pasos) => setBorrador((b) => intercambiar(b, clave, pasos)),
    cambiarFiltro: (clave, filtro) => setBorrador((b) => cambiarFiltro(b, clave, filtro)),
    quitar: (clave) => {
      // Al sacar uno, los que tenía debajo suben a ocupar el lugar.
      setBorrador((b) => resolver(quitar(b, clave)));
      setSeleccion(null);
      setAjustando(null);
    },
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-pantalla">Inicio</h1>
          <p className="mt-1 max-w-[65ch] text-tinta-media first-letter:uppercase">
            {acomodando
              ? "Agarrá un módulo del medio y llevalo donde quieras. Para el tamaño, tirá de la esquina punteada; para lo demás, tocalo y abrí sus ajustes."
              : `${fecha} · ${abiertos} ${abiertos === 1 ? "caso abierto" : "casos abiertos"}`}
          </p>
        </div>

        {acomodando ? (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Boton variante="plano" onClick={salirDeAcomodar}>
              Descartar los cambios
            </Boton>
            <Boton variante="principal" icono="check" onClick={guardar}>
              Guardar la pantalla
            </Boton>
          </div>
        ) : (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Boton icono="cajas" onClick={empezarAAcomodar}>
              Acomodar la pantalla
            </Boton>
            {/* El único botón azul cuando no se está acomodando. */}
            <Link href="/casos/nuevo" className="flex-1 sm:flex-none">
              <span className="flex min-h-14 w-full items-center justify-center gap-2 rounded-campo bg-azul px-6 font-bold text-cuerpo text-white hover:bg-azul-apretado sm:min-h-12">
                <Icono nombre="mas" />
                Abrir un caso nuevo
              </span>
            </Link>
          </div>
        )}
      </div>

      {enPantalla.length === 0 ? (
        <Vacio icono="cajas" titulo="Tu inicio está vacío">
          {acomodando
            ? "Agregá abajo los módulos que quieras ver."
            : "Tocá «Acomodar la pantalla» y elegí qué querés ver al abrir."}
        </Vacio>
      ) : (
        <div ref={grillaRef} className="grilla-inicio">
          {enPantalla.map((m, i) => (
            <Modulo
              key={m.clave}
              config={m}
              acomodando={acomodando}
              seleccionado={seleccion === m.clave}
              ajustando={ajustando === m.clave}
              agarrado={agarrado === m.clave}
              esPrimero={i === 0}
              esUltimo={i === enPantalla.length - 1}
              acciones={acciones}
              alSeleccionar={() => setSeleccion(m.clave)}
              alAlternarAjustes={() =>
                setAjustando((a) => (a === m.clave ? null : m.clave))
              }
              alAgarrarParaMover={(e) => agarrar(e, m.clave, "mover")}
              alAgarrarParaRedimensionar={(e) => agarrar(e, m.clave, "tamano")}
              alTeclado={(e) => teclado(e, m.clave)}
            />
          ))}
        </div>
      )}

      {acomodando && (
        <>
          <TituloSeccion className="mt-12">Agregar un módulo</TituloSeccion>
          {sePuedenAgregar.length === 0 ? (
            <p className="max-w-[65ch] text-tinta-media">
              Ya están todos los que podés usar. Para tener más, prendé otros módulos en{" "}
              <Link href="/negocio/modulos" className="font-bold text-azul">
                Mi negocio
              </Link>
              .
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sePuedenAgregar.map((def) => (
                <li key={def.clave}>
                  <button
                    type="button"
                    onClick={() => {
                      setBorrador((b) => agregar(b, def.clave));
                      setSeleccion(def.clave);
                    }}
                    className="flex h-full w-full cursor-pointer flex-col items-start gap-1 rounded-tarjeta border-2 border-borde bg-tarjeta p-4 text-left hover:bg-superficie"
                  >
                    <span className="flex items-center gap-2 font-bold text-subtitulo">
                      <Icono nombre={def.icono} className="size-6 text-tinta-media" />
                      {def.nombre}
                    </span>
                    <span className="text-tinta-media">{def.queMuestra}</span>
                    <span className="mt-2 flex items-center gap-1 font-bold text-azul text-etiqueta">
                      <Icono nombre="mas" className="size-5" />
                      Agregarlo al inicio
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-8">
            <Boton
              icono="deshacer"
              onClick={() => {
                setBorrador(normalizarInicio(INICIO_POR_DEFECTO));
                setSeleccion(null);
                setAjustando(null);
              }}
            >
              Volver al orden de fábrica
            </Boton>
          </div>
        </>
      )}
    </>
  );
}
