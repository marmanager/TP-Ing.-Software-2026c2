"use client";

// Cómo está configurado el aviso de que le toca volver (R-2b), para el caso
// y la ficha del cliente: { activo, plazo, mensaje }, o null mientras no se
// leyó, si no se pudo leer o si la API no tiene este tipo. Con null, las
// pantallas no dicen nada que dependa de él: mejor callar que adivinar.

import { useEffect, useRef, useState } from "react";
import { useDatos } from "./datos";
import { recordatoriosDeLaApi } from "./recordatorios.js";

export function useRecordatorioVolver() {
  const datos = useDatos();
  const [volver, setVolver] = useState(null);
  const acciones = useRef(datos);
  acciones.current = datos;
  const negocioId = datos.negocio?.id;

  useEffect(() => {
    if (!negocioId) return;
    let vivo = true;
    (async () => {
      const r = await acciones.current.consultarSeguimiento();
      if (vivo) setVolver(r.ok ? recordatoriosDeLaApi(r.configuracion).volver ?? null : null);
    })();
    return () => { vivo = false; };
  }, [negocioId]);

  return volver;
}
