"use client";

// Una fila de la lista de casos (cartilla, sección 05).
//
// En escritorio es una lista con columnas fijas, no una tabla densa: filas de
// 72 px, sin líneas verticales, con el estado a la izquierda y una barra de
// color para reconocerlo de reojo en una lista larga.
// En celular es una tarjeta de borde a borde, y toda la tarjeta es tocable.
//
// El botón de la fila va con borde, nunca azul: un solo botón azul por pantalla.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ESTADOS, accionDeFila, quienLoTiene } from "@/lib/estados";
import { useDatos } from "@/lib/datos";
import { queFaltaPara } from "@/lib/presets";
import ChipEstado from "./ChipEstado";
import { Boton } from "./ui";

export default function FilaCaso({ caso }) {
  const router = useRouter();
  const datos = useDatos();
  const { clientes, empleados, pasos, insumos } = datos;
  const [eligiendo, setEligiendo] = useState(false);

  const cliente = clientes.find((c) => c.id === caso.cliente_id);
  const accion = accionDeFila(caso, { pasos, insumos });
  const barra = ESTADOS[caso.estado]?.barra ?? "bg-borde";

  function tocarAccion() {
    switch (accion.tipo) {
      case "pasos":
        return router.push(`/casos/${caso.id}/pasos`);
      case "insumo":
        return datos.marcarInsumoLlegado(accion.insumoId);
      case "entregar":
        return datos.cambiarEstado(
          caso.id,
          "completado",
          queFaltaPara(datos.negocio?.rubro, "completado"),
          {
            titulo: "Entregaron el trabajo",
            detalle: "El caso queda cerrado.",
            icono: "listo",
          }
        );
      case "asignar":
        return setEligiendo((v) => !v);
      default:
        return router.push(`/casos/${caso.id}`);
    }
  }

  return (
    <li className="relative flex gap-0 border-b border-borde last:border-b-0">
      <span className={`w-1.5 shrink-0 ${barra}`} aria-hidden="true" />

      <div className="grid flex-1 items-center gap-x-4 gap-y-2 p-4 md:min-h-[72px] md:grid-cols-[minmax(150px,auto)_minmax(0,1.4fr)_minmax(0,.8fr)_minmax(0,1.2fr)_auto] md:py-3">
        <ChipEstado estado={caso.estado} className="justify-self-start" />

        <div className="min-w-0">
          {/* El enlace cubre toda la fila: la tarjeta entera es tocable. */}
          <Link
            href={`/casos/${caso.id}`}
            className="font-titulo font-extrabold text-ident after:absolute after:inset-0 after:content-['']"
          >
            Caso {caso.numero}
          </Link>
          <p className="truncate text-tinta-media">
            {caso.servicio}
            {cliente && ` · ${cliente.nombre}`}
          </p>
        </div>

        <p className="text-tinta-media">
          <span className="md:hidden">Lo tiene: </span>
          {quienLoTiene(caso, empleados)}
        </p>

        <p className="text-tinta-media">{caso.que_falta}</p>

        <div className="relative z-10 justify-self-start md:justify-self-end">
          <Boton icono={accion.icono} onClick={tocarAccion}>
            {accion.etiqueta}
          </Boton>

          {eligiendo && (
            <ul className="mt-2 flex flex-wrap gap-2 md:absolute md:right-0 md:z-20 md:mt-1 md:w-56 md:flex-col md:rounded-tarjeta md:border md:border-borde md:bg-tarjeta md:p-2 md:shadow-sm">
              {empleados.map((e) => (
                <li key={e.id}>
                  <Boton
                    variante="plano"
                    icono="persona"
                    className="w-full justify-start"
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
      </div>
    </li>
  );
}
