"use client";

import { useState } from "react";
import { useDatos } from "@/lib/datos";
import { ESTADOS, ORDEN_ESTADOS } from "@/lib/estados";
import {
  ICONOS_DE_ESTADO,
  configuracionEstadosValida,
  configuracionInicialEstados,
  presentacionEstado,
} from "@/lib/presentacion-estados";
import Icono from "./Icono";
import { Boton, Campo, Tarjeta } from "./ui";

export default function ConfiguracionEstados({ puedeConfigurar }) {
  const datos = useDatos();
  const { negocio } = datos;
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(() => configuracionInicialEstados(negocio));

  function abrir() {
    setBorrador(configuracionInicialEstados(negocio));
    setEditando(true);
  }

  function cambiar(estado, campo, valor) {
    setBorrador((actual) => ({
      ...actual,
      [estado]: { ...actual[estado], [campo]: valor },
    }));
  }

  function guardar() {
    if (!configuracionEstadosValida(borrador)) return;
    const limpios = Object.fromEntries(
      ORDEN_ESTADOS.map((estado) => [estado, {
        nombre: borrador[estado].nombre.trim(),
        icono: borrador[estado].icono,
      }])
    );
    datos.cambiarPresentacionEstados(limpios);
    setEditando(false);
    datos.avisarExito("Listo. Guardamos los nombres e íconos de los estados.");
  }

  if (editando) return (
    <Tarjeta className="mb-12">
      <div className="mb-6">
        <p className="font-bold text-cuerpo">Nombres e íconos de los estados</p>
        <p className="mt-1 max-w-[65ch] text-tinta-media">
          Cambia cómo se ven en las listas y en cada caso. El orden y lo que hace cada estado se conserva.
        </p>
      </div>

      <div className="grid gap-5">
        {ORDEN_ESTADOS.map((estado, indice) => {
          const base = ESTADOS[estado];
          const visual = borrador[estado];
          return (
            <fieldset key={estado} className="rounded-tarjeta border border-borde p-4">
              <legend className="px-2 font-bold">Estado {indice + 1}</legend>
              <div className="grid items-end gap-4 md:grid-cols-[minmax(240px,1fr)_minmax(210px,.7fr)]">
                <Campo
                  id={`estado-${estado}-nombre`}
                  etiqueta="Nombre"
                  ayuda={base.significado}
                  error={!visual.nombre.trim()
                    ? "Escribí un nombre."
                    : visual.nombre.trim().length > 40 ? "Puede tener hasta 40 caracteres." : null}
                  value={visual.nombre}
                  maxLength={41}
                  onChange={(e) => cambiar(estado, "nombre", e.target.value)}
                />
                <label className="mb-4 block" htmlFor={`estado-${estado}-icono`}>
                  <span className="mb-2 block font-bold">Ícono</span>
                  <span className="flex min-h-12 items-center gap-3 rounded-campo border-2 border-borde-fuerte bg-tarjeta px-3 focus-within:border-azul">
                    <Icono nombre={visual.icono} className={`size-6 ${base.texto}`} />
                    <select
                      id={`estado-${estado}-icono`}
                      value={visual.icono}
                      onChange={(e) => cambiar(estado, "icono", e.target.value)}
                      className="min-h-11 flex-1 cursor-pointer bg-transparent text-tinta outline-none"
                    >
                      {ICONOS_DE_ESTADO.map(([clave, nombre]) => (
                        <option key={clave} value={clave}>{nombre}</option>
                      ))}
                    </select>
                  </span>
                </label>
              </div>
            </fieldset>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Boton
          variante="principal"
          icono="check"
          motivo={configuracionEstadosValida(borrador) ? null : "revisá los nombres"}
          onClick={guardar}
        >
          Guardar nombres e íconos
        </Boton>
        <Boton variante="plano" onClick={() => setEditando(false)}>Cancelar</Boton>
      </div>
    </Tarjeta>
  );

  return (
    <>
      {puedeConfigurar && (
        <div className="mb-4">
          <Boton icono="pincel" onClick={abrir}>Configurar nombres e íconos</Boton>
        </div>
      )}
      <ul className="mb-12 overflow-hidden rounded-tarjeta border border-borde bg-tarjeta">
        {ORDEN_ESTADOS.map((estado) => {
          const e = presentacionEstado(negocio, estado);
          return (
            <li key={estado} className="flex flex-wrap items-center gap-4 border-b border-borde p-4 last:border-b-0">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold text-etiqueta ${e.fondo} ${e.texto}`}>
                <Icono nombre={e.icono} className="size-5" />
                {e.nombre}
              </span>
              <p className="min-w-0 flex-1 text-tinta-media">{e.significado}</p>
            </li>
          );
        })}
      </ul>
    </>
  );
}
