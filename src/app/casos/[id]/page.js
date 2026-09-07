"use client";

// "Ver cómo va un caso" (cartilla, sección 08).
//
// La abren el encargado y el equipo muchas veces por día, casi siempre desde
// el celular. Identificador, estado y "qué falta" tienen que entrar en la
// primera pantalla, sin scrollear.

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { ESTADOS, pesos, quienLoTiene } from "@/lib/estados";
import { cuando, haceCuanto } from "@/lib/fechas";
import { preset, queFaltaPara } from "@/lib/presets";
import ChipEstado from "@/componentes/ChipEstado";
import Icono from "@/componentes/Icono";
import { Boton, Cargando, Tarjeta, TituloSeccion, Vacio } from "@/componentes/ui";

export default function VerCaso() {
  const { id } = useParams();
  const datos = useDatos();
  const { cargando, casos, clientes, empleados, pasos, eventos, insumos, negocio } = datos;
  const [eligiendo, setEligiendo] = useState(false);

  const caso = casos.find((c) => c.id === id);
  useTitulo(caso ? `Caso ${caso.numero}` : "Caso");

  if (cargando) return <Cargando />;
  if (!caso) {
    return (
      <Vacio icono="buscar" titulo="No encontramos ese caso">
        Puede que lo hayan borrado. <Link href="/casos" className="font-bold text-azul">Volver a los casos</Link>.
      </Vacio>
    );
  }

  const cliente = clientes.find((c) => c.id === caso.cliente_id);
  const mios = pasos.filter((p) => p.caso_id === caso.id).sort((a, b) => a.orden - b.orden);
  const historial = eventos
    .filter((e) => e.caso_id === caso.id)
    .sort((a, b) => new Date(b.ocurrido_en) - new Date(a.ocurrido_en));
  const insumosDelCaso = insumos.filter((i) => i.caso_id === caso.id);

  const aprobado = mios.filter((p) => p.estado === "aprobado").reduce((s, p) => s + Number(p.monto), 0);
  const esperando = mios.filter((p) => p.estado === "esperando");
  const barra = ESTADOS[caso.estado].barra;
  const explica = preset(negocio?.rubro).explica[caso.estado];

  return (
    <>
      <Link href="/" className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul">
        <Icono nombre="volver" />
        Volver a los casos
      </Link>

      {/* Lo importante, sin scrollear: identificador, estado y qué falta. */}
      <div className="overflow-hidden rounded-tarjeta border border-borde bg-tarjeta">
        <div className={`h-1.5 w-full ${barra}`} aria-hidden="true" />
        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-ident">Caso {caso.numero}</h1>
              <p className="mt-1 text-tinta-media">
                {caso.servicio}
                {cliente && ` · ${cliente.nombre}`}
              </p>
            </div>
            <ChipEstado estado={caso.estado} />
          </div>

          <p className="mt-4 text-cuerpo">
            <span className="font-bold">Qué falta:</span> {caso.que_falta}
            {explica && <span className="text-tinta-media"> ({explica})</span>}
          </p>

          <dl className="mt-4 grid gap-2 text-tinta-media sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <Icono nombre="persona" className="size-5" />
              <dt className="sr-only">Quién lo tiene</dt>
              <dd>{quienLoTiene(caso, empleados)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <Icono nombre="reloj" className="size-5" />
              <dt className="sr-only">Desde cuándo</dt>
              <dd>{haceCuanto(caso.abierto_en)}</dd>
            </div>
            {cliente?.telefono && (
              <div className="flex items-center gap-2">
                <Icono nombre="telefono" className="size-5" />
                <dt className="sr-only">Teléfono</dt>
                <dd>
                  <a href={`tel:${cliente.telefono.replace(/\s/g, "")}`} className="text-azul">
                    {cliente.telefono}
                  </a>
                </dd>
              </div>
            )}
          </dl>

          {/* Un único botón azul: el que casi siempre se va a tocar. */}
          {mios.length > 0 && (
            <Link href={`/casos/${caso.id}/pasos`} className="mt-6 block sm:inline-block">
              <span className="flex min-h-14 items-center justify-center gap-2 rounded-campo bg-azul px-6 font-bold text-cuerpo text-white hover:bg-azul-apretado sm:min-h-12">
                <Icono nombre="nota" />
                {esperando.length > 0
                  ? `Ver los ${esperando.length} pasos a aprobar`
                  : "Ver los pasos del caso"}
              </span>
            </Link>
          )}

          {mios.length > 0 && (
            <p className="mt-3 text-tinta-media">
              Aprobado hasta ahora <span className="font-bold text-tinta">{pesos(aprobado)}</span>.
            </p>
          )}
        </div>
      </div>

      {/* Hacer avanzar el caso. Los estados son un ciclo de vida, no adorno. */}
      <TituloSeccion className="mt-12">Cómo sigue</TituloSeccion>
      <div className="flex flex-wrap gap-3">
        {caso.estado === "nuevo" && (
          <div className="relative">
            <Boton icono="persona-mas" onClick={() => setEligiendo((v) => !v)}>
              Asignar responsable
            </Boton>
            {eligiendo && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {empleados.map((e) => (
                  <li key={e.id}>
                    <Boton
                      variante="plano"
                      icono="persona"
                      onClick={() => {
                        datos.asignarResponsable(caso.id, e.id);
                        setEligiendo(false);
                      }}
                    >
                      {e.nombre}
                    </Boton>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {caso.estado === "en_proceso" && (
          <Boton
            icono="reloj"
            onClick={() =>
              datos.cambiarEstado(caso.id, "esperando", "Espera respuesta del cliente", {
                titulo: "Quedó esperando",
                detalle: "Falta que el cliente conteste.",
                icono: "reloj",
              })
            }
          >
            Marcar que espera al cliente
          </Boton>
        )}

        {caso.estado === "en_proceso" && (
          <Boton
            icono="listo"
            onClick={() =>
              datos.cambiarEstado(caso.id, "revision_final", queFaltaPara(negocio?.rubro, "revision_final"), {
                titulo: "Terminó el trabajo",
                detalle: "Pasa al control final.",
                icono: "nota",
              })
            }
          >
            Marcar el trabajo terminado
          </Boton>
        )}

        {caso.estado === "esperando" &&
          insumosDelCaso
            .filter((i) => i.estado !== "en_stock")
            .map((i) => (
              <Boton key={i.id} icono="camion" onClick={() => datos.marcarInsumoLlegado(i.id)}>
                Marcar que llegó {i.nombre.toLowerCase()}
              </Boton>
            ))}

        {caso.estado === "esperando" && (
          <Boton
            icono="llave"
            onClick={() =>
              datos.cambiarEstado(caso.id, "en_proceso", queFaltaPara(negocio?.rubro, "en_proceso"), {
                titulo: "Volvió al trabajo",
                detalle: "Se destrabó lo que estaba esperando.",
                icono: "llave",
              })
            }
          >
            Retomar el trabajo
          </Boton>
        )}

        {caso.estado === "revision_final" && (
          <Boton
            icono="listo"
            onClick={() =>
              datos.cambiarEstado(caso.id, "completado", "Listo para cobrar", {
                titulo: "Dieron por revisado el trabajo",
                detalle: "Pasó el control y se puede entregar.",
                icono: "listo",
              })
            }
          >
            Dar por revisado
          </Boton>
        )}

        {caso.estado === "completado" && (
          <p className="text-tinta-media">
            Este caso ya se entregó y se cerró. No queda nada por hacer.
          </p>
        )}
      </div>

      {/* El historial cuenta la historia: qué pasó, cuándo y quién lo hizo. */}
      <TituloSeccion className="mt-12">Lo que pasó con este caso</TituloSeccion>
      <ol className="flex flex-col gap-6">
        {historial.map((e) => (
          <li key={e.id} className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-superficie text-tinta-media">
              <Icono nombre={e.icono} className="size-5" />
            </span>
            <div className="min-w-0 flex-1 border-b border-borde pb-4">
              <p className="font-bold">{e.titulo}</p>
              <p className="text-apoyo text-tinta-suave">
                {cuando(e.ocurrido_en)} · {e.autor}
              </p>
              {e.detalle && <p className="mt-1 text-tinta-media">{e.detalle}</p>}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
