"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useIdioma } from "@/lib/useIdioma";
import Icono from "./Icono";
import { Boton, ErrorGeneral, Tarjeta } from "./ui";

// Los textos que arma este componente (errores, avisos) se guardan como clave
// del diccionario y se traducen al dibujarlos, así siguen al idioma si cambia.
// Lo que viene escrito de /api/google-calendar (data.error) se muestra tal cual.
const EN_DICCIONARIO = "agenda.google.";

export default function VincularGoogleCalendar({ comoIntegracion = false }) {
  const { t } = useIdioma();
  const verTexto = (texto) => (texto?.startsWith?.(EN_DICCIONARIO) ? t(texto) : texto);
  const { sesion, tokenActual } = useAuth();
  const [estado, setEstado] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    if (!sesion) return;
    let activo = true;
    tokenActual()
      .then((token) => {
        if (!token) throw new Error("agenda.google.sesionVencida");
        return fetch("/api/google-calendar", { headers: { authorization: `Bearer ${token}` } });
      })
      .then(async r => {
        if (!r.ok) throw new Error("agenda.google.noSePudoConsultar");
        return r.json();
      })
      .then(data => { if (activo) setEstado(data); })
      .catch(e => { if (activo) setError(e.message); });
    return () => { activo = false; };
  }, [sesion?.access_token, tokenActual]);

  if (!sesion) return null;

  async function pedir(method, action) {
    setOcupado(true);
    setError(null);
    setMensaje(null);
    try {
      const token = await tokenActual();
      if (!token) throw new Error("agenda.google.sesionVencida");
      const response = await fetch("/api/google-calendar", {
        method,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        ...(action ? { body: JSON.stringify({
          action,
          volver: comoIntegracion ? "negocio" : "calendario",
        }) } : {}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "agenda.google.noSePudoConectar");
      if (action === "connect") window.location.assign(data.url);
      else {
        setEstado({ ...estado, conectado: false, error: null });
        setConfirmando(false);
        setMensaje("agenda.google.desvinculado");
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
              ? t("agenda.google.consultando")
              : estado.conectado
                ? t("agenda.google.vinculado")
                : t("agenda.google.vincular")}
          </p>
        </div>
        {estado && !estado.conectado && (
          <Boton
            icono="calendario"
            motivo={ocupado ? t("agenda.google.conectando") : !estado.disponible ? t("agenda.google.faltaConfigurar") : null}
            onClick={() => pedir("POST", "connect")}
          >
            {t("agenda.google.botonVincular")}
          </Boton>
        )}
        {estado?.conectado && !confirmando && (
          <Boton variante="peligro" icono="salir" onClick={() => setConfirmando(true)}>
            {t("agenda.google.botonDesvincular")}
          </Boton>
        )}
      </div>

      <p className="mt-4 max-w-[65ch] text-apoyo text-tinta-suave">
        {t("agenda.google.avisoIntegracion")}
      </p>

      {(error || estado?.error || resultado === "error") && (
        <div className="mt-4">
          <ErrorGeneral>{verTexto(error || estado?.error) || t("agenda.google.autorizacion")}</ErrorGeneral>
        </div>
      )}
      {(mensaje || (resultado === "conectado" && !error && !estado?.error)) && (
        <p className="mt-4 font-bold text-completo" role="status">
          {verTexto(mensaje) || t("agenda.google.quedoVinculado")}
        </p>
      )}

      {confirmando && (
        <div className="mt-4 rounded-tarjeta bg-superficie p-4">
          <p className="font-bold">{t("agenda.google.confirmarTitulo")}</p>
          <p className="mt-1 max-w-[65ch] text-tinta-media">
            {t("agenda.google.confirmarTexto")}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Boton
              variante="peligro"
              icono="salir"
              motivo={ocupado ? t("agenda.google.desvinculando") : null}
              onClick={() => pedir("DELETE")}
            >
              {t("agenda.google.siDesvincular")}
            </Boton>
            <Boton variante="plano" disabled={ocupado} onClick={() => setConfirmando(false)}>
              {t("agenda.google.dejarVinculada")}
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
          <span className="font-bold text-azul">{t("agenda.google.estaVinculado")}</span>
          <Boton variante="plano" motivo={ocupado ? t("agenda.google.desconectando") : null}
            onClick={() => pedir("DELETE")}>{t("agenda.google.desvincular")}</Boton>
        </>
      ) : (
        <Boton icono="calendario"
          motivo={ocupado ? t("agenda.google.conectando") : estado && !estado.disponible ? t("agenda.google.faltaConfigurar") : null}
          onClick={() => pedir("POST", "connect")}>{t("agenda.google.vincularCon")}</Boton>
      )}
      <p className="w-full text-apoyo text-tinta-media">
        {t("agenda.google.explicacion")}
      </p>
      <p className="w-full text-apoyo text-tinta-suave">
        {t("agenda.google.avisoIcs")}
      </p>
      {(error || estado?.error || resultado === "error") && (
        <p className="w-full text-rojo" role="alert">
          {verTexto(error || estado?.error) || t("agenda.google.autorizacion")}
        </p>
      )}
      {resultado === "conectado" && !error && !estado?.error && (
        <p className="w-full text-azul" role="status">{t("agenda.google.cuentaVinculada")}</p>
      )}
    </div>
  );
}
