"use client";

import { useRef } from "react";
import Icono from "./Icono";

// ------------------------------------------------------------
// El buscador (SCRUM-81)
// ------------------------------------------------------------
// El mismo que el de Casos: etiqueta a la vista, la lupa adentro del campo, y
// una cruz para borrar de un toque. Borrar letra por letra en el teclado de un
// celular son doce toques para volver a la lista completa; la cruz es uno, y
// devuelve el foco al campo para escribir otra cosa (auditoría, H3).

export default function Buscador({ id, etiqueta, ayuda, valor, alCambiar }) {
  const campo = useRef(null);
  return (
    <div className="min-w-64 flex-1">
      <label htmlFor={id} className="block font-bold text-cuerpo">
        {etiqueta}
      </label>
      {ayuda && <p className="mt-1 text-apoyo text-tinta-suave">{ayuda}</p>}
      <div className="relative mt-2">
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-tinta-suave">
          <Icono nombre="buscar" />
        </span>
        <input
          id={id}
          ref={campo}
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
          autoComplete="off"
          className="block min-h-12 w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta pl-13 pr-14 text-cuerpo placeholder:text-tinta-suave"
        />
        {valor && (
          <button
            type="button"
            aria-label="Borrar la búsqueda"
            onClick={() => {
              alCambiar("");
              campo.current?.focus();
            }}
            className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center rounded-r-campo text-tinta-media hover:text-tinta"
          >
            <Icono nombre="cruz" />
          </button>
        )}
      </div>
    </div>
  );
}
