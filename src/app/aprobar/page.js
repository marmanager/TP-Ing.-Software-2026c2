"use client";

// "A aprobar" — los casos donde falta que el cliente conteste.
// No es una pantalla vacía: es la misma consulta del Inicio filtrada por
// los pasos que todavía esperan respuesta.

import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { pesos } from "@/lib/estados";
import { haceCuanto } from "@/lib/fechas";
import ChipEstado from "@/componentes/ChipEstado";
import Icono from "@/componentes/Icono";
import { Cargando, Tarjeta, Vacio } from "@/componentes/ui";

export default function AAprobar() {
  const { cargando, casos, clientes, pasos } = useDatos();
  useTitulo("A aprobar");

  if (cargando) return <Cargando />;

  const conPendientes = casos
    .map((caso) => {
      const pendientes = pasos.filter((p) => p.caso_id === caso.id && p.estado === "esperando");
      return { caso, pendientes, plata: pendientes.reduce((s, p) => s + Number(p.monto), 0) };
    })
    .filter((x) => x.pendientes.length > 0)
    .sort((a, b) => b.plata - a.plata);

  const total = conPendientes.reduce((s, x) => s + x.plata, 0);

  return (
    <>
      <h1 className="text-pantalla">A aprobar</h1>
      <p className="mt-1 mb-8 max-w-[65ch] text-tinta-media">
        Los casos donde falta que el cliente diga que sí. Están ordenados por lo que hay en
        juego, no por fecha.
      </p>

      {conPendientes.length === 0 ? (
        <Vacio icono="listo" titulo="No hay nada esperando respuesta">
          Cuando armes un presupuesto y se lo mandes a un cliente, va a aparecer acá.
        </Vacio>
      ) : (
        <>
          <div className="mb-6 rounded-tarjeta border border-borde bg-superficie p-4 sm:p-6">
            <p className="text-tinta-media">Esperando respuesta en total</p>
            <p className="font-titulo font-extrabold text-dato text-espera tabular-nums">
              {pesos(total)}
            </p>
          </div>

          <ul className="flex flex-col gap-3">
            {conPendientes.map(({ caso, pendientes, plata }) => {
              const cliente = clientes.find((c) => c.id === caso.cliente_id);
              return (
                <li key={caso.id}>
                  <Tarjeta>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-titulo font-extrabold text-ident">Caso {caso.numero}</p>
                        <p className="text-tinta-media">
                          {caso.servicio}
                          {cliente && ` · ${cliente.nombre}`}
                        </p>
                      </div>
                      <ChipEstado estado={caso.estado} />
                    </div>

                    <p className="mt-3">
                      <span className="font-bold">
                        {pendientes.length} {pendientes.length === 1 ? "paso" : "pasos"}
                      </span>{" "}
                      por <span className="font-bold tabular-nums">{pesos(plata)}</span>
                    </p>
                    <p className="text-apoyo text-tinta-suave">{haceCuanto(caso.abierto_en)}</p>

                    <Link
                      href={`/casos/${caso.id}/pasos`}
                      className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-campo border-2 border-azul bg-tarjeta px-6 font-bold text-azul hover:bg-azul-claro"
                    >
                      <Icono nombre="nota" />
                      Ver los pasos
                    </Link>
                  </Tarjeta>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
