"use client";

// "Historial" (SCRUM-75): todo lo que pasó en el negocio.
//
// Cada caso ya tiene su historial en su pantalla. Esta junta el de todos,
// para contestar las preguntas que no son de un caso solo: qué entró esta
// semana, qué se entregó, cuánta plata se movió en cada paso.
//
// Se filtra por período y por tipo. El tipo lo guarda cada evento (ver
// lib/historial.js).
//
// Un técnico ve sólo lo de sus casos: la base no le manda los eventos de
// los demás.

import { useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { pesos } from "@/lib/estados";
import { diaPasado, horaYMinutos } from "@/lib/fechas";
import {
  LISTA_PERIODOS,
  LISTA_TIPOS,
  agruparPorDia,
  filtrarHistorial,
  plataAprobada,
  resumirHistorial,
} from "@/lib/historial";
import Icono from "@/componentes/Icono";
import { Cargando, TituloSeccion, Vacio } from "@/componentes/ui";

function Opcion({ elegida, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={elegida}
      onClick={onClick}
      className={[
        "min-h-12 cursor-pointer rounded-full border-2 px-4 text-etiqueta",
        elegida
          ? "border-azul bg-azul-claro font-bold text-azul"
          : "border-borde bg-tarjeta text-tinta-media hover:bg-superficie",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function Historial() {
  const { cargando, eventos, casos, clientes, pasos } = useDatos();
  useTitulo("Historial");

  const [periodo, setPeriodo] = useState("semana");
  const [tipo, setTipo] = useState("todo");

  if (cargando) return <Cargando />;

  // El resumen mira el período entero, sin el filtro de tipo: si no, al
  // elegir "Plata" diría que entraron cero casos, que no es cierto.
  const delPeriodo = filtrarHistorial(eventos, { periodo });
  const { entraron, entregados } = resumirHistorial(delPeriodo);
  const aprobado = plataAprobada(pasos, { periodo });
  const visibles = filtrarHistorial(eventos, { periodo, tipo });
  const dias = agruparPorDia(visibles);

  const numeros = [
    ["Entraron", entraron, entraron === 1 ? "caso" : "casos"],
    ["Se entregaron", entregados, entregados === 1 ? "caso" : "casos"],
  ];

  return (
    <>
      <h1 className="text-pantalla">Historial</h1>
      <p className="mt-1 mb-8 max-w-[65ch] text-tinta-media">
        Todo lo que pasó en el negocio: qué entró, qué cambió, qué se entregó y la plata de
        cada paso, con quién lo hizo.
      </p>

      <fieldset className="mb-4">
        <legend className="mb-2 font-bold text-cuerpo">Desde cuándo</legend>
        <div className="flex flex-wrap gap-2">
          {LISTA_PERIODOS.map((p) => (
            <Opcion key={p.clave} elegida={periodo === p.clave} onClick={() => setPeriodo(p.clave)}>
              {p.palabra}
            </Opcion>
          ))}
        </div>
      </fieldset>

      <dl className="mb-8 grid gap-3 sm:grid-cols-3">
        {numeros.map(([que, cuanto, unidad]) => (
          <div key={que} className="rounded-tarjeta border border-borde bg-tarjeta p-4">
            <dt className="text-tinta-media">{que}</dt>
            <dd className="font-titulo font-extrabold text-dato tabular-nums">
              {cuanto} <span className="text-cuerpo font-normal text-tinta-media">{unidad}</span>
            </dd>
          </div>
        ))}
        {/* La plata que los clientes dijeron que sí. Sale de los pasos: lo
            aprobado ya no se deshace, así que cada paso cuenta una vez. */}
        <div className="rounded-tarjeta border border-borde bg-tarjeta p-4">
          <dt className="text-tinta-media">Aprobaron los clientes</dt>
          <dd className="font-titulo font-extrabold text-dato text-completo tabular-nums">
            {pesos(aprobado.total)}
          </dd>
          <dd className="text-apoyo text-tinta-suave">
            {aprobado.pasos === 0
              ? "Ningún paso aprobado"
              : `En ${aprobado.pasos} ${aprobado.pasos === 1 ? "paso" : "pasos"}`}
          </dd>
        </div>
      </dl>

      <fieldset className="mb-8">
        <legend className="mb-2 font-bold text-cuerpo">Qué mostrar</legend>
        <div className="flex flex-wrap gap-2">
          <Opcion elegida={tipo === "todo"} onClick={() => setTipo("todo")}>
            Todo
          </Opcion>
          {LISTA_TIPOS.map((t) => (
            <Opcion key={t.clave} elegida={tipo === t.clave} onClick={() => setTipo(t.clave)}>
              {t.palabra}
            </Opcion>
          ))}
        </div>
      </fieldset>

      {dias.length === 0 ? (
        <Vacio icono="historial" titulo="No pasó nada con este filtro">
          {eventos.length === 0
            ? "Cuando abras el primer caso, lo que vaya pasando aparece acá."
            : "Probá con un período más largo o con «Todo»."}
        </Vacio>
      ) : (
        dias.map(({ clave, dia, eventos: delDia }) => (
          <section key={clave} className="mb-10">
            <TituloSeccion className="first-letter:uppercase">{diaPasado(dia)}</TituloSeccion>
            <ol className="overflow-hidden rounded-tarjeta border border-borde bg-tarjeta">
              {delDia.map((e) => {
                const caso = casos.find((c) => c.id === e.caso_id);
                const cliente = caso && clientes.find((c) => c.id === caso.cliente_id);
                return (
                  <li key={e.id} className="border-b border-borde last:border-b-0">
                    <Link
                      href={caso ? `/casos/${caso.id}` : "/casos"}
                      className="flex items-start gap-3 p-4 hover:bg-superficie"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-superficie text-tinta-media">
                        <Icono nombre={e.icono} className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold">{e.titulo}</span>
                        {e.detalle && (
                          <span className="block text-tinta-media">{e.detalle}</span>
                        )}
                        <span className="mt-1 block text-apoyo text-tinta-suave">
                          {horaYMinutos(e.ocurrido_en)} · {e.autor}
                          {caso && ` · Caso ${caso.numero}`}
                          {cliente && ` de ${cliente.nombre}`}
                        </span>
                      </span>
                      {e.tipo === "plata" && e.monto !== null && e.monto !== undefined && (
                        <span className="shrink-0 font-titulo font-extrabold text-subtitulo tabular-nums">
                          {pesos(e.monto)}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}
    </>
  );
}
