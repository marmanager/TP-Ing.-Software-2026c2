"use client";

import { ESTADOS } from "@/lib/estados";
import { etiquetaEstado } from "@/lib/presets";
import { useDatos } from "@/lib/datos";
import Icono from "./Icono";

// Tres señales por estado: color, ícono y palabra.
// Si se imprime en blanco y negro se sigue entendiendo (cartilla, sección 02).
//
// El rubro sale del negocio de quien está usando el sistema, salvo que se lo
// pasen. Se lo pasa la pantalla pública de seguimiento (SCRUM-68): ahí quien
// mira no tiene negocio propio —no tiene ni cuenta—, y el vocabulario que
// corresponde es el del negocio que le mandó el link.
export default function ChipEstado({ estado, rubro, className = "", grande = false }) {
  const { negocio } = useDatos();
  const e = ESTADOS[estado];
  if (!e) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold ${
        grande ? "gap-2 px-4 py-2 text-subtitulo" : "px-3 py-1.5 text-etiqueta"
      } ${e.fondo} ${e.texto} ${className}`}
    >
      <Icono nombre={e.icono} className={grande ? "size-7" : "size-5"} />
      {etiquetaEstado(rubro ?? negocio?.rubro, estado)}
    </span>
  );
}
