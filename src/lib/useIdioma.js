"use client";

// El idioma para los componentes de cliente (src/lib/idioma.js). El layout
// raíz lo elige en el servidor y lo pasa acá con su diccionario, así la
// primera pantalla ya sale en el idioma bueno y no salta después.

import { createContext, useContext, useMemo } from "react";
import { LOCALES, traducir } from "./idioma";

const Contexto = createContext(null);

export function IdiomaProvider({ idioma, diccionario, base, children }) {
  const valor = useMemo(() => {
    const locale = LOCALES[idioma];
    const fuente = { diccionario, base, locale };
    return { idioma, locale, t: (clave, vars, siFalta) => traducir(fuente, clave, vars, siFalta) };
  }, [idioma, diccionario, base]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const useIdioma = () => useContext(Contexto);
