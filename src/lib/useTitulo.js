"use client";

import { useEffect } from "react";
import { useDatos } from "./datos";
import { useIdioma } from "./useIdioma";

// Cada pantalla tiene su propio título (WCAG 2.1 AA, criterio 2.4.2).
export function useTitulo(texto) {
  const { negocio } = useDatos();
  const { t } = useIdioma();
  const nombre = negocio?.nombre ?? t("negocio.titulo");

  useEffect(() => {
    document.title = texto ? `${texto} · ${nombre}` : nombre;
  }, [texto, nombre]);
}
