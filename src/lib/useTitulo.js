"use client";

import { useEffect } from "react";
import { useDatos } from "./datos";

// Cada pantalla tiene su propio título (WCAG 2.1 AA, criterio 2.4.2), seguido
// del nombre del negocio. Sin negocio (la bienvenida, el ingreso) va el del
// producto: la pestaña dice MarManager y no "Mi negocio".
export function useTitulo(texto) {
  const { negocio } = useDatos();
  const nombre = negocio?.nombre ?? "MarManager";

  useEffect(() => {
    document.title = texto ? `${texto} · ${nombre}` : nombre;
  }, [texto, nombre]);
}
