"use client";

// "Tema" en Mi perfil: cómo se ve la app en este dispositivo (src/lib/tema.js).
//
// Se edita sobre un borrador, como la cuenta: cada toque se ve al instante en
// toda la app, así la vista previa es la pantalla misma; "Guardar" lo deja y
// "Cancelar" (o irse de la pantalla sin guardar) vuelve a lo que estaba.

import { useEffect, useRef, useState } from "react";
import {
  ACENTOS,
  COLORES_CAJA,
  MODOS_CAJA,
  PATRONES,
  dibujo,
  DE_FABRICA,
  LETRAS,
  REDONDEOS,
  TEMAS,
  TINTAS,
  aplicarApariencia,
  esOscuro,
  guardarApariencia,
  leerApariencia,
  opcion,
} from "@/lib/tema";
import Icono from "@/componentes/Icono";
import { Boton, Tarjeta } from "@/componentes/ui";

export default function Tema() {
  // Se lee después de montar: en el servidor no hay localStorage.
  const [guardada, setGuardada] = useState(null);
  const [borrador, setBorrador] = useState(null);
  useEffect(() => setGuardada(leerApariencia()), []);

  // Si se va de la pantalla con la edición abierta, no queda a medias.
  const abierta = useRef(false);
  useEffect(() => () => abierta.current && aplicarApariencia(), []);

  function abrir() {
    abierta.current = true;
    setBorrador(guardada);
  }

  function cambiar(campo, clave) {
    const ap = { ...borrador, [campo]: clave };
    setBorrador(ap);
    aplicarApariencia(ap);
  }

  function cerrar(ap) {
    abierta.current = false;
    setBorrador(null);
    setGuardada(ap);
  }

  function guardar() {
    guardarApariencia(borrador);
    cerrar(borrador);
  }

  function cancelar() {
    aplicarApariencia(guardada);
    cerrar(guardada);
  }

  const resumen = guardada && [
    opcion("tema", guardada.tema).palabra,
    `Letra ${opcion("letra", guardada.letra).palabra}`,
    `Bordes ${opcion("redondeo", guardada.redondeo).palabra.toLowerCase()}`,
    `Botones ${opcion("acento", guardada.acento).palabra.toLowerCase()}`,
  ].join(" · ");

  return (
    <Tarjeta className="mb-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-[60ch]">
          <p>Cómo se ve la app en este dispositivo: claro u oscuro, la letra, los bordes y el color de los botones.</p>
          {resumen && <p className="mt-1 text-apoyo text-tinta-suave">{resumen}</p>}
        </div>
        {!borrador && (
          <Boton icono="pincel" onClick={abrir} motivo={guardada ? null : "Cargando"}>
            Editar
          </Boton>
        )}
      </div>

      {borrador && (
        <div className="mt-6 border-t border-borde pt-6">
          <Parte titulo="Tema" ayuda="El fondo de la app. Con el del sistema, sigue al claro u oscuro de tu dispositivo.">
            <Grupo nombre="Tema" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {TEMAS.map((t) => (
                <Opcion key={t.clave} elegida={borrador.tema === t.clave} onClick={() => cambiar("tema", t.clave)} palabra={t.palabra}>
                  <VistaTema tema={t} />
                </Opcion>
              ))}
            </Grupo>
          </Parte>

          <Parte titulo="Bordes y letra" ayuda="La letra de toda la app, su color y qué tan redondeadas son las tarjetas, los campos y los botones.">
            <h4 className="mb-2 font-bold">Letra</h4>
            <Grupo nombre="Letra" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {LETRAS.map((l) => (
                <Opcion key={l.clave} elegida={borrador.letra === l.clave} onClick={() => cambiar("letra", l.clave)} palabra={l.palabra}>
                  <span className="block py-2 text-pantalla" style={{ fontFamily: l.familia }} aria-hidden="true">
                    Aa
                  </span>
                </Opcion>
              ))}
            </Grupo>

            <h4 className="mb-2 font-bold">Color de la letra</h4>
            <Grupo nombre="Color de la letra" className="mb-6 flex flex-wrap gap-3">
              {TINTAS.map((t) => (
                <Muestra
                  key={t.clave}
                  elegida={borrador.tinta === t.clave}
                  onClick={() => cambiar("tinta", t.clave)}
                  palabra={t.palabra}
                  color={esOscuro(borrador.tema) ? t.oscuro : t.claro}
                  letra
                />
              ))}
            </Grupo>

            <h4 className="mb-2 font-bold">Bordes</h4>
            <Grupo nombre="Bordes" className="grid grid-cols-3 gap-3">
              {REDONDEOS.map((b) => (
                <Opcion key={b.clave} elegida={borrador.redondeo === b.clave} onClick={() => cambiar("redondeo", b.clave)} palabra={b.palabra}>
                  <span
                    aria-hidden="true"
                    className="mx-auto my-2 block h-12 w-20 border-2 border-borde-fuerte bg-superficie"
                    style={{ borderRadius: b.tarjeta }}
                  />
                </Opcion>
              ))}
            </Grupo>
          </Parte>

          <Parte titulo="Color de botones" ayuda="El color de lo que se toca: abrir un caso nuevo, ver el caso, los enlaces y lo elegido.">
            <Grupo nombre="Color de botones" className="mb-4 flex flex-wrap gap-3">
              {ACENTOS.map((a) => (
                <Muestra
                  key={a.clave}
                  elegida={borrador.acento === a.clave}
                  onClick={() => cambiar("acento", a.clave)}
                  palabra={a.palabra}
                  color={a.solido}
                />
              ))}
            </Grupo>
            {/* Una muestra de los botones de verdad, con el color ya puesto. */}
            <div aria-hidden="true" className="flex flex-wrap items-center gap-3 rounded-tarjeta bg-superficie p-4">
              <span className="inline-flex min-h-12 items-center gap-2 rounded-campo bg-azul px-6 font-bold text-white">
                <Icono nombre="mas" className="size-6" />
                Abrir un caso nuevo
              </span>
              <span className="inline-flex min-h-12 items-center rounded-campo border-2 border-azul bg-tarjeta px-6 font-bold text-azul">
                Ver el caso
              </span>
              <span className="font-bold text-azul underline">Ver todo</span>
            </div>
          </Parte>

          <Parte titulo="Cajas y rebordes" ayuda="El interior y el borde de las tarjetas, como la de acá. El interior va traslúcido para que el texto se siga leyendo.">
            <EditorCaja
              titulo="Color de cajas"
              valor={borrador.caja}
              cambiar={(c) => cambiar("caja", c)}
            />
            <EditorCaja
              titulo="Color de rebordes"
              valor={borrador.reborde}
              cambiar={(c) => cambiar("reborde", c)}
            />
          </Parte>

          <div className="flex flex-wrap gap-3">
            <Boton variante="principal" icono="check" onClick={guardar}>
              Guardar
            </Boton>
            <Boton variante="plano" onClick={cancelar}>
              Cancelar
            </Boton>
            <Boton variante="plano" onClick={() => { setBorrador(DE_FABRICA); aplicarApariencia(DE_FABRICA); }}>
              Volver a lo de fábrica
            </Boton>
          </div>
        </div>
      )}
    </Tarjeta>
  );
}

function Parte({ titulo, ayuda, children }) {
  return (
    <section className="mb-8">
      <h3 className="text-subtitulo font-bold">{titulo}</h3>
      <p className="mb-4 text-tinta-media">{ayuda}</p>
      {children}
    </section>
  );
}

function Grupo({ nombre, className, children }) {
  return (
    <div role="group" aria-label={nombre} className={className}>
      {children}
    </div>
  );
}

// Una opción grande, con su dibujo arriba y el nombre abajo.
function Opcion({ elegida, onClick, palabra, children }) {
  return (
    <button
      type="button"
      aria-pressed={elegida}
      onClick={onClick}
      className={`relative cursor-pointer rounded-tarjeta border-2 p-3 text-center ${
        elegida ? "border-azul bg-azul-claro" : "border-borde bg-tarjeta hover:bg-superficie"
      }`}
    >
      {children}
      <span className={`mt-2 block text-etiqueta ${elegida ? "font-bold text-azul" : "text-tinta-media"}`}>{palabra}</span>
      {elegida && <Icono nombre="check" className="absolute top-2 right-2 size-5 text-azul" />}
    </button>
  );
}

// Una muestra de color redonda. Con "letra", dice "Aa" en ese color sobre el
// fondo de la app; sin, es el color lleno.
function Muestra({ elegida, onClick, palabra, color, letra }) {
  return (
    <button
      type="button"
      aria-pressed={elegida}
      onClick={onClick}
      className="flex w-20 cursor-pointer flex-col items-center gap-1 rounded-campo p-1 hover:bg-superficie"
    >
      <span
        aria-hidden="true"
        className={`flex size-12 items-center justify-center rounded-full border-2 font-bold ${
          elegida ? "border-azul ring-2 ring-azul ring-offset-2 ring-offset-tarjeta" : "border-borde"
        } ${letra ? "bg-fondo" : ""}`}
        style={letra ? { color } : { backgroundColor: color }}
      >
        {letra ? "Aa" : elegida && <Icono nombre="check" className="size-5 text-white" />}
      </span>
      <span className={`text-apoyo ${elegida ? "font-bold text-tinta" : "text-tinta-media"}`}>{palabra}</span>
    </button>
  );
}

// Una ventanita como la de Windows: barra, tarjeta y renglones, con los
// colores de ese tema. La del sistema va mitad y mitad.
function VistaTema({ tema }) {
  if (tema.clave === "sistema") {
    return (
      <span aria-hidden="true" className="relative block h-24 overflow-hidden rounded-campo border border-borde">
        <span className="absolute inset-0" style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }}>
          <Ventana {...TEMAS[0]} />
        </span>
        <span className="absolute inset-0" style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}>
          <Ventana {...TEMAS[1]} />
        </span>
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="block h-24 overflow-hidden rounded-campo border border-borde">
      <Ventana {...tema} />
    </span>
  );
}

function Ventana({ fondo, tarjeta, tinta }) {
  return (
    <span className="flex h-full gap-2 p-2" style={{ backgroundColor: fondo }}>
      <span className="flex w-1/4 flex-col gap-1.5 pt-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="block h-1.5 rounded-full opacity-40" style={{ backgroundColor: tinta }} />
        ))}
      </span>
      <span className="flex flex-1 flex-col gap-1.5 rounded-md p-2" style={{ backgroundColor: tarjeta }}>
        <span className="block h-2 w-2/3 rounded-full opacity-80" style={{ backgroundColor: tinta }} />
        <span className="block h-1.5 w-full rounded-full opacity-30" style={{ backgroundColor: tinta }} />
        <span className="block h-1.5 w-5/6 rounded-full opacity-30" style={{ backgroundColor: tinta }} />
        <span className="mt-auto block h-3 w-1/3 rounded-sm bg-azul" />
      </span>
    </span>
  );
}

// Un color o dos en degradé, para el interior o el borde de las tarjetas.
function EditorCaja({ titulo, valor, cambiar }) {
  const poner = (parte, clave) => cambiar({ ...valor, [parte]: clave });
  const dos = valor.modo === "degrade";

  return (
    <div className="mb-6">
      <h4 className="mb-2 font-bold">{titulo}</h4>
      <Grupo nombre={titulo} className="mb-4 flex flex-wrap gap-2">
        {MODOS_CAJA.map((m) => (
          <button
            key={m.clave}
            type="button"
            aria-pressed={valor.modo === m.clave}
            onClick={() => poner("modo", m.clave)}
            className={`min-h-12 cursor-pointer rounded-full border-2 px-4 text-etiqueta ${
              valor.modo === m.clave
                ? "border-azul bg-azul-claro font-bold text-azul"
                : "border-borde bg-tarjeta text-tinta-media hover:bg-superficie"
            }`}
          >
            {m.palabra}
          </button>
        ))}
      </Grupo>

      {valor.modo !== "fabrica" && (
        <>
          <p className="mb-1 text-apoyo text-tinta-media">{dos ? "Primer color" : "Color"}</p>
          <Grupo nombre={`${titulo}: ${dos ? "primer color" : "color"}`} className="mb-3 flex flex-wrap gap-2">
            {COLORES_CAJA.map((c) => (
              <Muestra key={c.clave} elegida={valor.c1 === c.clave} onClick={() => poner("c1", c.clave)} palabra={c.palabra} color={c.color} />
            ))}
          </Grupo>
        </>
      )}

      {dos && (
        <>
          <p className="mb-1 text-apoyo text-tinta-media">Segundo color</p>
          <Grupo nombre={`${titulo}: segundo color`} className="mb-3 flex flex-wrap gap-2">
            {COLORES_CAJA.map((c) => (
              <Muestra key={c.clave} elegida={valor.c2 === c.clave} onClick={() => poner("c2", c.clave)} palabra={c.palabra} color={c.color} />
            ))}
          </Grupo>

          <p className="mb-1 text-apoyo text-tinta-media">Patrón del degradé</p>
          <Grupo nombre={`${titulo}: patrón`} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PATRONES.map((p) => (
              <Opcion key={p.clave} elegida={valor.patron === p.clave} onClick={() => poner("patron", p.clave)} palabra={p.palabra}>
                <span aria-hidden="true" className="block h-12 rounded-campo" style={{ background: dibujo({ ...valor, patron: p.clave }) }} />
              </Opcion>
            ))}
          </Grupo>
        </>
      )}
    </div>
  );
}
