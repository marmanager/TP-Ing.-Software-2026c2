"use client";

import { useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { ORDEN_ESTADOS, ESTADOS } from "@/lib/estados";
import { etiquetaEstado, comoSeIdentifica } from "@/lib/presets";
import FilaCaso from "@/componentes/FilaCaso";
import Icono from "@/componentes/Icono";
import { Cargando, Vacio } from "@/componentes/ui";

export default function Casos() {
  const { cargando, casos, clientes, negocio } = useDatos();
  const [filtro, setFiltro] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  useTitulo("Casos");

  if (cargando) return <Cargando />;

  const texto = busqueda.trim().toLowerCase();
  const comoIdent = comoSeIdentifica(negocio?.rubro);
  const visibles = casos
    .filter((c) => filtro === "todos" || c.estado === filtro)
    .filter((c) => {
      if (!texto) return true;
      const cliente = clientes.find((x) => x.id === c.cliente_id);
      return (
        String(c.numero).includes(texto) ||
        c.servicio.toLowerCase().includes(texto) ||
        // Por la patente, la ficha o el número de serie, según el rubro.
        (c.identificador ?? "").toLowerCase().includes(texto) ||
        (cliente?.nombre ?? "").toLowerCase().includes(texto)
      );
    })
    .sort((a, b) => ORDEN_ESTADOS.indexOf(a.estado) - ORDEN_ESTADOS.indexOf(b.estado));

  const cuantos = (estado) => casos.filter((c) => c.estado === estado).length;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-pantalla">Casos</h1>
          <p className="mt-1 text-tinta-media">Todos los trabajos, incluidos los ya entregados.</p>
        </div>
        <Link href="/casos/nuevo" className="w-full sm:w-auto">
          <span className="flex min-h-14 w-full items-center justify-center gap-2 rounded-campo bg-azul px-6 font-bold text-cuerpo text-white hover:bg-azul-apretado sm:min-h-12">
            <Icono nombre="mas" />
            Abrir un caso nuevo
          </span>
        </Link>
      </div>

      <label htmlFor="buscar" className="block font-bold text-cuerpo">
        Buscar un caso
      </label>
      <p className="mt-1 text-apoyo text-tinta-suave">
        Por número, por {comoIdent.nombre.toLowerCase()}, por lo que necesita o por el
        nombre del cliente.
      </p>
      <div className="relative mt-2 mb-6">
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-tinta-suave">
          <Icono nombre="buscar" />
        </span>
        <input
          id="buscar"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={`248, ${comoIdent.ejemplo}, frenos, Marcela…`}
          className="block min-h-12 w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta pl-13 pr-4 text-cuerpo placeholder:text-tinta-suave"
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <BotonFiltro activo={filtro === "todos"} onClick={() => setFiltro("todos")}>
          Todos ({casos.length})
        </BotonFiltro>
        {ORDEN_ESTADOS.map((estado) => (
          <BotonFiltro
            key={estado}
            activo={filtro === estado}
            onClick={() => setFiltro(estado)}
            icono={ESTADOS[estado].icono}
          >
            {etiquetaEstado(negocio?.rubro, estado)} ({cuantos(estado)})
          </BotonFiltro>
        ))}
      </div>

      {visibles.length === 0 ? (
        <Vacio icono="buscar" titulo="No hay casos que coincidan">
          Probá con otra palabra o sacá el filtro de estado.
        </Vacio>
      ) : (
        <ul className="overflow-hidden rounded-tarjeta border border-borde bg-tarjeta">
          {visibles.map((caso) => (
            <FilaCaso key={caso.id} caso={caso} />
          ))}
        </ul>
      )}
    </>
  );
}

function BotonFiltro({ activo, icono, children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      {...props}
      className={[
        "inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full border-2 px-4 text-etiqueta",
        activo
          ? "border-azul bg-azul-claro font-bold text-azul"
          : "border-borde bg-tarjeta text-tinta-media hover:bg-superficie",
      ].join(" ")}
    >
      {icono && <Icono nombre={icono} className="size-5" />}
      {children}
    </button>
  );
}
