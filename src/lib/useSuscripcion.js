"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./auth";
import { traer, mandar } from "./api";
import { urlDePago } from "./suscripcion";

// Guardia pide la suscripción una sola vez y la comparte con Planes, Prueba y
// Mi perfil: si cada uno tuviera la suya, al pagar o al empezar la prueba
// Guardia seguiría con la vieja y mandaría a la persona de vuelta a Planes.
export const ContextoSuscripcion = createContext(null);
export const useSuscripcionCompartida = () => useContext(ContextoSuscripcion);

// La suscripción del negocio activo. Se vuelve a pedir al cambiar de negocio
// y con recargar() (al volver de pagar, el aviso de Mercado Pago puede tardar).
//
// datos: la respuesta de GET /v1/suscripcion, o null si la API no contestó.
export function useSuscripcion() {
  const { sesion, usuario } = useAuth();
  const token = sesion?.access_token;
  const negocioId = usuario?.negocio_id ?? null;
  const aplica = Boolean(token) && Boolean(negocioId);

  const [estado, setEstado] = useState({ para: null, datos: null });
  const [vuelta, setVuelta] = useState(0);

  const recargar = useCallback(() => setVuelta((v) => v + 1), []);

  useEffect(() => {
    if (!aplica) return;
    let vivo = true;
    (async () => {
      const r = await traer("/suscripcion", token);
      if (vivo) setEstado({ para: negocioId, datos: r.ok ? r.datos : null });
    })();
    return () => { vivo = false; };
    // El token se renueva solo: pedir de nuevo en cada renovación sería ruido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aplica, negocioId, vuelta]);

  // Los planes con sus precios en dólares y en pesos, y la cotización.
  const traerPlanes = useCallback(() => traer("/suscripcion/planes", token), [token]);

  // El mes gratis. Si sale bien, se vuelve a pedir el estado: así Guardia ya
  // sabe que hay acceso antes de que la persona toque "Ir a la app".
  const empezarPrueba = useCallback(async () => {
    const r = await mandar("/suscripcion/prueba", undefined, token);
    if (r.ok) recargar();
    return r;
  }, [token, recargar]);

  // Crea la suscripción y devuelve adónde mandar a pagar. Pagar es del dueño:
  // la API lo comprueba.
  const suscribirse = useCallback(async (precioId) => {
    const r = await mandar("/suscripcion", { precioId }, token);
    if (!r.ok) return r;
    const url = urlDePago(r.datos?.checkoutUrl);
    return url
      ? { ok: true, url }
      : { ok: false, error: { codigo: "sin_link", mensaje: "No pudimos abrir el pago. Probá de nuevo." } };
  }, [token]);

  return {
    cargando: aplica && estado.para !== negocioId,
    datos: aplica && estado.para === negocioId ? estado.datos : null,
    recargar,
    traerPlanes,
    empezarPrueba,
    suscribirse,
  };
}
