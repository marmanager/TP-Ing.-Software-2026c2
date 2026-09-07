"use client";

// "Aprobar los pasos de un caso" (cartilla, secciones 08 y 09).
//
// La decisión que más plata mueve. La revisa el encargado con el cliente al
// lado, o el cliente en su celular.
//
// Reglas que esta pantalla tiene que cumplir:
// - Cada paso es una tarjeta con nombre común, para qué sirve y monto grande.
// - Dos botones por paso, de 52 px como mínimo y con 10 px en medio, para no
//   equivocarse de dedo.
// - El estado de cada paso va escrito con ícono y palabra, no sólo con color.
// - El total siempre visible, separado en aprobado y esperando respuesta.
// - Aprobar o rechazar se puede deshacer.

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { puede, QUIEN_PUEDE } from "@/lib/permisos";
import { pesos, totalesDeCaso } from "@/lib/estados";
import ChipEstado from "@/componentes/ChipEstado";
import Icono from "@/componentes/Icono";
import { Boton, Cargando, Tarjeta, TituloSeccion, Vacio } from "@/componentes/ui";

const DICHO = {
  aprobado: { icono: "listo", texto: "Lo aprobó el cliente", color: "text-completo" },
  rechazado: { icono: "cruz", texto: "El cliente no lo hace", color: "text-tinta-suave" },
  esperando: { icono: "reloj", texto: "Esperando respuesta", color: "text-espera" },
};

export default function AprobarPasos() {
  const { id } = useParams();
  const { cargando, casos, clientes, pasos, negocio, responderPaso } = useDatos();
  const { usuario } = useAuth();
  const [mostrandoMensaje, setMostrandoMensaje] = useState(false);

  // Aprobar y rechazar mueven plata: los hacen el dueño y el encargado. El
  // técnico ve los pasos, porque son la lista de lo que tiene que hacer.
  const puedeResponder = puede(usuario?.rol, "cargarDatos");

  const caso = casos.find((c) => c.id === id);
  useTitulo(caso ? `Pasos del caso ${caso.numero}` : "Pasos");

  if (cargando) return <Cargando />;
  if (!caso) {
    return (
      <Vacio icono="buscar" titulo="No encontramos ese caso">
        <Link href="/casos" className="font-bold text-azul">Volver a los casos</Link>.
      </Vacio>
    );
  }

  const cliente = clientes.find((c) => c.id === caso.cliente_id);
  const mios = pasos.filter((p) => p.caso_id === caso.id).sort((a, b) => a.orden - b.orden);
  const { aprobado, esperando, todo, cuantosEsperan } = totalesDeCaso(mios);

  const mensaje = [
    `Hola ${cliente?.nombre ?? ""}, te paso el detalle del caso ${caso.numero} (${caso.servicio}).`,
    "",
    ...mios.map(
      (p) =>
        `${p.estado === "aprobado" ? "✓" : p.estado === "rechazado" ? "✗" : "•"} ${p.nombre} — ${pesos(p.monto)}${p.descripcion ? `\n   ${p.descripcion}` : ""}`
    ),
    "",
    `Aprobado hasta ahora: ${pesos(aprobado)}`,
    `Esperando tu respuesta: ${pesos(esperando)}`,
    `Todo el caso: ${pesos(todo)}`,
    "",
    "Se puede aprobar de a uno. Lo que no apruebes queda anotado para más adelante.",
  ].join("\n");

  return (
    <div className="mx-auto max-w-[560px]">
      <Link
        href={`/casos/${caso.id}`}
        className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul"
      >
        <Icono nombre="volver" />
        Volver a los casos
      </Link>

      <h1 className="text-ident">Caso {caso.numero}</h1>
      <p className="mt-1 text-tinta-media">
        {caso.servicio}
        {cliente && ` · ${cliente.nombre}`}
      </p>
      <div className="mt-3">
        <ChipEstado estado={caso.estado} />
      </div>
      {cuantosEsperan > 0 && (
        <p className="mt-3 text-cuerpo">
          Falta que {cliente?.nombre ?? "el cliente"} apruebe {cuantosEsperan}{" "}
          {cuantosEsperan === 1 ? "paso" : "pasos"}.
        </p>
      )}

      <TituloSeccion className="mt-10">Pasos a aprobar</TituloSeccion>
      <p className="-mt-2 mb-4 text-tinta-media">
        {puedeResponder
          ? "Se puede aprobar de a uno. Lo que no se apruebe queda anotado para más adelante."
          : `Esto es lo que hay que hacer en el caso. ${QUIEN_PUEDE.cargarDatos}`}
      </p>

      {mios.length === 0 ? (
        <Vacio icono="nota" titulo="Todavía no hay pasos">
          Cuando se cargue el diagnóstico y se arme el presupuesto, los pasos aparecen acá.
        </Vacio>
      ) : (
        <ul className="flex flex-col gap-3">
          {mios.map((paso) => {
            const dicho = DICHO[paso.estado];
            return (
              <li key={paso.id}>
                <Tarjeta>
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-cuerpo font-bold text-cuerpo">{paso.nombre}</h3>
                    <span className="font-titulo font-extrabold text-subtitulo tabular-nums">
                      {pesos(paso.monto)}
                    </span>
                  </div>
                  {paso.descripcion && (
                    <p className="mt-1 text-tinta-media">{paso.descripcion}</p>
                  )}

                  <p className={`mt-3 flex items-center gap-2 font-bold text-etiqueta ${dicho.color}`}>
                    <Icono nombre={dicho.icono} className="size-5" />
                    {dicho.texto}
                  </p>

                  {!puedeResponder ? null : paso.estado === "esperando" ? (
                    // 52 px de alto, 10 px en medio: para no equivocarse de dedo.
                    <div className="mt-3 flex gap-2.5">
                      <Boton
                        variante="principal"
                        className="min-h-13 flex-1"
                        onClick={() => responderPaso(paso.id, "aprobado")}
                      >
                        Lo aprueba
                      </Boton>
                      <Boton
                        variante="peligro"
                        className="min-h-13 flex-1"
                        onClick={() => responderPaso(paso.id, "rechazado")}
                      >
                        No lo hace
                      </Boton>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <Boton
                        variante="plano"
                        icono="deshacer"
                        onClick={() => responderPaso(paso.id, "esperando")}
                      >
                        Volver atrás
                      </Boton>
                    </div>
                  )}
                </Tarjeta>
              </li>
            );
          })}
        </ul>
      )}

      {/* La plata siempre a la vista, separada en aprobado y esperando. */}
      {mios.length > 0 && (
        <div className="mt-6 rounded-tarjeta border border-borde bg-superficie p-4 sm:p-6">
          <dl className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-4">
              <dt>Aprobado hasta ahora</dt>
              <dd className="font-bold tabular-nums">{pesos(aprobado)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 text-espera">
              <dt>Esperando respuesta</dt>
              <dd className="font-bold tabular-nums">{pesos(esperando)}</dd>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-borde pt-3">
              <dt className="font-bold">Todo el caso</dt>
              <dd className="font-titulo font-extrabold text-subtitulo tabular-nums">
                {pesos(todo)}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* El único botón azul de la pantalla. */}
      {mios.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setMostrandoMensaje((v) => !v)}
            className="mt-6 flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-campo bg-azul px-6 font-bold text-cuerpo text-white hover:bg-azul-apretado"
          >
            <Icono nombre="chat" />
            Mandarle los pasos al cliente
          </button>

          {mostrandoMensaje && (
            <div className="mt-3 rounded-tarjeta border border-borde bg-tarjeta p-4">
              <p className="font-bold">Esto es lo que le va a llegar</p>
              <p className="mt-1 text-apoyo text-tinta-suave">
                Se lee completo en el mensaje, sin abrir el sistema. Mandarlo de verdad es
                del próximo sprint.
              </p>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-campo bg-superficie p-4 font-cuerpo text-etiqueta text-tinta-media">
                {mensaje}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
