"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Boton } from "./ui";

export default function VincularGoogleCalendar() {
  const { sesion, esDemo } = useAuth();
  const [estado, setEstado] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!sesion || esDemo) return;
    let activo = true;
    fetch("/api/google-calendar", { headers: { authorization: `Bearer ${sesion.access_token}` } })
      .then(async r => {
        if (!r.ok) throw new Error("No se pudo consultar Google Calendar.");
        return r.json();
      })
      .then(data => { if (activo) setEstado(data); })
      .catch(e => { if (activo) setError(e.message); });
    return () => { activo = false; };
  }, [sesion?.access_token, esDemo]);

  if (!sesion || esDemo) return null;

  async function pedir(method, action) {
    setOcupado(true);
    setError(null);
    try {
      const response = await fetch("/api/google-calendar", {
        method,
        headers: { authorization: `Bearer ${sesion.access_token}`, "content-type": "application/json" },
        ...(action ? { body: JSON.stringify({ action }) } : {}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo conectar Google Calendar.");
      if (action === "connect") window.location.assign(data.url);
      else setEstado({ ...estado, conectado: false, error: null });
    } catch (e) { setError(e.message); }
    finally { setOcupado(false); }
  }

  const resultado = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("google") : null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      {estado?.conectado ? (
        <>
          <span className="font-bold text-azul">Google Calendar vinculado</span>
          <Boton variante="plano" motivo={ocupado ? "desconectando" : null}
            onClick={() => pedir("DELETE")}>Desvincular</Boton>
        </>
      ) : (
        <Boton icono="calendario"
          motivo={ocupado ? "conectando" : estado && !estado.disponible ? "falta configurar Google" : null}
          onClick={() => pedir("POST", "connect")}>Vincular con Google Calendar</Boton>
      )}
      <p className="w-full text-apoyo text-tinta-media">
        Tus turnos se copian a tu calendario principal. Se revisan al entrar,
        mientras usás la app y una vez al día cuando está cerrada. Los cambios
        en Google no modifican la app.
      </p>
      <p className="w-full text-apoyo text-tinta-suave">
        Si ya agregaste el link .ics a Google, quitá esa suscripción para no ver turnos duplicados.
      </p>
      {(error || estado?.error || resultado === "error") && (
        <p className="w-full text-rojo" role="alert">
          {error || estado?.error || "No se pudo completar la autorización con Google."}
        </p>
      )}
      {resultado === "conectado" && !error && !estado?.error && (
        <p className="w-full text-azul" role="status">Cuenta vinculada. Copiamos los turnos existentes.</p>
      )}
    </div>
  );
}
