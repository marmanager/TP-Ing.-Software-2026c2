"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import Icono from "./Icono";
import { Boton, ErrorGeneral, Tarjeta } from "./ui";

export default function VincularGoogleCalendar({ comoIntegracion = false }) {
  const { sesion, esDemo, tokenActual } = useAuth();
  const [estado, setEstado] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    if (!sesion || esDemo) return;
    let activo = true;
    tokenActual()
      .then((token) => {
        if (!token) throw new Error("Tu sesión venció. Volvé a entrar.");
        return fetch("/api/google-calendar", { headers: { authorization: `Bearer ${token}` } });
      })
      .then(async r => {
        if (!r.ok) throw new Error("No se pudo consultar Google Calendar.");
        return r.json();
      })
      .then(data => { if (activo) setEstado(data); })
      .catch(e => { if (activo) setError(e.message); });
    return () => { activo = false; };
  }, [sesion?.access_token, esDemo, tokenActual]);

  if (!sesion || esDemo) return null;

  async function pedir(method, action) {
    setOcupado(true);
    setError(null);
    setMensaje(null);
    try {
      const token = await tokenActual();
      if (!token) throw new Error("Tu sesión venció. Volvé a entrar.");
      const response = await fetch("/api/google-calendar", {
        method,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        ...(action ? { body: JSON.stringify({
          action,
          volver: comoIntegracion ? "negocio" : "calendario",
        }) } : {}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo conectar Google Calendar.");
      if (action === "connect") window.location.assign(data.url);
      else {
        setEstado({ ...estado, conectado: false, error: null });
        setConfirmando(false);
        setMensaje("Google Calendar quedó desvinculado de tu cuenta.");
      }
    } catch (e) { setError(e.message); }
    finally { setOcupado(false); }
  }

  const resultado = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("google") : null;

  if (comoIntegracion) return (
    <Tarjeta className="mb-12">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`flex size-12 items-center justify-center rounded-full ${
          estado?.conectado ? "bg-completo-fondo text-completo" : "bg-superficie text-tinta-media"
        }`}>
          <Icono nombre={estado?.conectado ? "listo" : "calendario"} className="size-6" />
        </span>
        <div className="mr-auto">
          <p className="font-bold">Google Calendar</p>
          <p className="max-w-[65ch] text-tinta-media">
            {estado === null
              ? "Consultando la conexión…"
              : estado.conectado
                ? "Vinculado con tu cuenta. Tus turnos se copian automáticamente."
                : "Vinculá tu cuenta para copiar tus turnos a tu calendario principal."}
          </p>
        </div>
        {estado && !estado.conectado && (
          <Boton
            icono="calendario"
            motivo={ocupado ? "conectando" : !estado.disponible ? "falta configurar Google" : null}
            onClick={() => pedir("POST", "connect")}
          >
            Vincular Google Calendar
          </Boton>
        )}
        {estado?.conectado && !confirmando && (
          <Boton variante="peligro" icono="salir" onClick={() => setConfirmando(true)}>
            Desvincular Google Calendar
          </Boton>
        )}
      </div>

      <p className="mt-4 max-w-[65ch] text-apoyo text-tinta-suave">
        Los cambios hechos en Google no modifican la app. Si antes agregaste el link .ics,
        quitá esa suscripción para evitar turnos duplicados.
      </p>

      {(error || estado?.error || resultado === "error") && (
        <div className="mt-4">
          <ErrorGeneral>{error || estado?.error || "No se pudo completar la autorización con Google."}</ErrorGeneral>
        </div>
      )}
      {(mensaje || (resultado === "conectado" && !error && !estado?.error)) && (
        <p className="mt-4 font-bold text-completo" role="status">
          {mensaje || "Google Calendar quedó vinculado. Copiamos los turnos existentes."}
        </p>
      )}

      {confirmando && (
        <div className="mt-4 rounded-tarjeta bg-superficie p-4">
          <p className="font-bold">¿Desvincular Google Calendar de tu cuenta?</p>
          <p className="mt-1 max-w-[65ch] text-tinta-media">
            Los turnos que ya se copiaron quedan en Google. Los nuevos turnos y cambios dejan
            de sincronizarse hasta que vuelvas a vincular una cuenta.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Boton
              variante="peligro"
              icono="salir"
              motivo={ocupado ? "desvinculando" : null}
              onClick={() => pedir("DELETE")}
            >
              Sí, desvincularla
            </Boton>
            <Boton variante="plano" disabled={ocupado} onClick={() => setConfirmando(false)}>
              Dejarla vinculada
            </Boton>
          </div>
        </div>
      )}
    </Tarjeta>
  );

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
