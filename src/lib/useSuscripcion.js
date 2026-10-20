"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./auth";
import { traer, mandar } from "./api";
import { urlDePago } from "./suscripcion";

// Guardia pide la suscripción una sola vez y la comparte con Mi perfil: si
// cada uno tuviera la suya, al pagar Guardia seguiría con la vieja y mandaría
// a la persona de vuelta al perfil.
export const ContextoSuscripcion = createContext(null);
export const useSuscripcionCompartida = () => useContext(ContextoSuscripcion);

// La suscripción del negocio activo. Se vuelve a pedir al cambiar de negocio
// y con recargar() (al volver de pagar, el aviso de Mercado Pago puede tardar).
//
// datos: la respuesta de GET /v1/suscripcion, o null si la API no contestó.
export function useSuscripcion() {
  const { sesion, usuario } = useAuth();
  const negocioId = usuario?.negocio_id ?? null;
  const hayToken = Boolean(sesion?.access_token);
  const aplica = hayToken && Boolean(negocioId);

  const [estado, setEstado] = useState({ para: null, datos: null });
  const [vuelta, setVuelta] = useState(0);

  const recargar = useCallback(() => setVuelta((v) => v + 1), []);

  useEffect(() => {
    if (!aplica) return;
    let vivo = true;
    (async () => {
      const r = await traer("/suscripcion", sesion.access_token);
      if (vivo) setEstado({ para: negocioId, datos: r.ok ? r.datos : null });
    })();
    return () => { vivo = false; };
    // El token se renueva solo: pedir de nuevo en cada renovación sería ruido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aplica, negocioId, vuelta]);

  // Crea la suscripción y devuelve adónde mandar a pagar. Pagar es del dueño:
  // la API lo comprueba.
  const suscribirse = useCallback(async () => {
    const r = await mandar("/suscripcion", undefined, sesion?.access_token);
    if (!r.ok) return r;
    const url = urlDePago(r.datos?.checkoutUrl);
    return url
      ? { ok: true, url }
      : { ok: false, error: { codigo: "sin_link", mensaje: "No pudimos abrir el pago. Probá de nuevo." } };
  }, [sesion?.access_token]);

  return {
    suscribirse,
    cargando: aplica && estado.para !== negocioId,
    datos: aplica && estado.para === negocioId ? estado.datos : null,
    recargar,
  };
}
