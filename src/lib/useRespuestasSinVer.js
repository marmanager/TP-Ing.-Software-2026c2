"use client";

// Las respuestas por WhatsApp que nadie vio, de a una fila por cliente: el
// bloque del Inicio, las marcas de Casos y Clientes y la bandeja usan esto.
// Las lee la primera pantalla que las necesita y las demás usan las mismas
// (datos.respuestasSinVer). Qué cuenta como pendiente y cómo se agrupa está
// en lib/recordatorios.js, con sus pruebas.

import { useEffect, useRef } from "react";
import { useDatos } from "./datos";
import { useAuth } from "./auth";
import { puede } from "./permisos";
import { agruparPorCliente, respuestasPendientes } from "./recordatorios";

export function useRespuestasSinVer() {
  const datos = useDatos();
  const { usuario } = useAuth();
  const { respuestasSinVer, turnos, clientes, cargando } = datos;
  const acciones = useRef(datos);
  acciones.current = datos;

  // Las ve quien ve la cola de avisos, el mismo permiso que pide la API.
  const autorizado = puede(usuario, "entregar_y_reabrir");

  useEffect(() => {
    if (autorizado && !cargando && respuestasSinVer === null) acciones.current.leerRespuestasSinVer();
  }, [autorizado, cargando, respuestasSinVer]);

  const grupos = respuestasSinVer?.lista
    ? agruparPorCliente(respuestasPendientes({ respuestas: respuestasSinVer.lista, turnos, clientes }))
    : [];

  return {
    autorizado,
    leyendo: autorizado && respuestasSinVer === null,
    error: respuestasSinVer?.error ?? null,
    // Si eran demasiadas para leerlas todas, las que faltan son las más viejas.
    completas: respuestasSinVer?.completas ?? true,
    grupos,
    // Para las marcas: qué casos y qué clientes tienen algo sin ver.
    casosConRespuesta: new Set(grupos.flatMap((g) => g.mensajes.map((m) => m.caso_id).filter(Boolean))),
    clientesConRespuesta: new Set(grupos.map((g) => g.clienteId).filter(Boolean)),
    verlo: (grupo) => acciones.current.marcarRespuestasVistas({ clienteId: grupo.clienteId, telefono: grupo.telefono }),
  };
}
