// Una fila de negocio: la foto —o el ícono de local—, el nombre y el rubro, y
// el rol si se pasa. Es sólo el contenido: quien la usa pone alrededor el
// botón o la tarjeta, porque en el selector la fila entera se toca y en Mi
// perfil tiene botones adentro.

import Link from "next/link";
import { etiquetaRol, preset } from "@/lib/presets";
import Icono from "./Icono";

export default function FilaNegocio({ negocio, rol }) {
  return (
    <>
      {/* Sin texto alternativo: el nombre está al lado. */}
      {negocio.foto ? (
        <img src={negocio.foto} alt="" className="size-12 shrink-0 rounded-campo object-cover" />
      ) : (
        <span className="flex size-12 shrink-0 items-center justify-center rounded-campo bg-azul text-white">
          <Icono nombre="tienda" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-cuerpo">{negocio.nombre}</span>
        <span className="block text-tinta-media">
          {preset(negocio.rubro).nombre}
          {rol && ` · ${etiquetaRol(negocio.rubro, rol)}`}
        </span>
      </span>
    </>
  );
}

// La última fila: un "+" en el lugar de la foto.
export function FilaNuevoNegocio() {
  return (
    <Link
      href="/crear-negocio"
      className="flex min-h-12 items-center gap-3 rounded-tarjeta border-2 border-dashed border-borde-fuerte p-4 font-bold text-azul hover:bg-superficie"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-campo bg-azul-claro">
        <Icono nombre="mas" />
      </span>
      Nuevo negocio
    </Link>
  );
}
