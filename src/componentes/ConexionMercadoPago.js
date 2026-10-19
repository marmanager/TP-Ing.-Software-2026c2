"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import Icono from "./Icono";
import { Boton, ErrorGeneral, Tarjeta } from "./ui";

export default function ConexionMercadoPago() {
  const { usuario } = useAuth();
  const { negocio, avisarExito, estadoMercadoPago, conectarMercadoPago, desvincularMercadoPago, pagosEnLinea } =
    useDatos();
  const [conectado, setConectado] = useState(null);
  const [vinculando, setVinculando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [desvinculando, setDesvinculando] = useState(false);
  const [error, setError] = useState(null);

  const puedeConfigurar = usuario?.rol === "duenio" || usuario?.rol === "encargado";

  // La vuelta de Mercado Pago, que pasa por Casos (vueltaDeMercadoPago).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mp") !== "conectado") return;
    window.sessionStorage.removeItem("marmanager.mp-desde");
    avisarExito("Mercado Pago quedó vinculado con este negocio.");
    document.getElementById("integraciones")?.scrollIntoView({ block: "start" });
    window.history.replaceState(null, "", window.location.pathname + "#integraciones");
    // Una vez, al llegar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let vivo = true;
    if (!puedeConfigurar) return;
    estadoMercadoPago().then((r) => {
      if (!vivo) return;
      if (r.ok) setConectado(r.conectado);
      else {
        setConectado(false);
        setError(r.error?.mensaje ?? "No pudimos consultar la conexión de Mercado Pago.");
      }
    });
    return () => { vivo = false; };
  }, [puedeConfigurar, negocio?.id]);

  if (!puedeConfigurar) return null;

  // La API arma el link de Mercado Pago; ahí la persona entra con su cuenta
  // y autoriza. Antes de irse se anota que salió de acá, para volver.
  async function vincular() {
    setVinculando(true);
    setError(null);
    const r = await conectarMercadoPago();
    if (!r.ok) {
      setVinculando(false);
      return setError(r.error ?? "No pudimos abrir Mercado Pago.");
    }
    window.sessionStorage.setItem("marmanager.mp-desde", "negocio");
    window.location.assign(r.url);
  }

  async function desvincular() {
    setDesvinculando(true);
    setError(null);
    const r = await desvincularMercadoPago();
    setDesvinculando(false);
    if (!r.ok) return setError(r.error?.mensaje ?? "No pudimos desvincular Mercado Pago.");
    setConectado(false);
    setConfirmando(false);
    avisarExito("Mercado Pago quedó desvinculado de este negocio.");
  }

  return (
    <Tarjeta className="mb-12">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`flex size-12 items-center justify-center rounded-full ${
          conectado ? "bg-completo-fondo text-completo" : "bg-superficie text-tinta-media"
        }`}>
          <Icono nombre={conectado ? "listo" : "llave"} className="size-6" />
        </span>
        <div className="mr-auto">
          <p className="font-bold">Mercado Pago</p>
          {conectado === null ? (
            <p className="text-tinta-media">Consultando la conexión…</p>
          ) : (
            <p className="text-tinta-media">
              {conectado
                ? `Vinculado con ${negocio?.nombre ?? "este negocio"}.`
                : "Vinculalo para cobrar por link o QR desde los casos."}
            </p>
          )}
        </div>
        {conectado === false && (
          <Boton
            motivo={!pagosEnLinea?.disponible ? pagosEnLinea?.motivo : vinculando ? "abriendo Mercado Pago" : null}
            onClick={vincular}
          >
            Vincular Mercado Pago
          </Boton>
        )}
        {conectado && !confirmando && (
          <Boton variante="peligro" icono="salir" onClick={() => setConfirmando(true)}>
            Desvincular Mercado Pago
          </Boton>
        )}
      </div>

      {error && <div className="mt-4"><ErrorGeneral>{error}</ErrorGeneral></div>}

      {confirmando && (
        <div className="mt-4 rounded-tarjeta bg-superficie p-4">
          <p className="font-bold">¿Desvincular Mercado Pago de este negocio?</p>
          <p className="mt-1 max-w-[65ch] text-tinta-media">
            Los cobros registrados se conservan. Los pedidos pendientes ya no podrán actualizarse
            ni conciliarse hasta que vuelvas a vincular una cuenta.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Boton
              variante="peligro"
              icono="salir"
              motivo={desvinculando ? "desvinculando" : null}
              onClick={desvincular}
            >
              Sí, desvincularla
            </Boton>
            <Boton variante="plano" disabled={desvinculando} onClick={() => setConfirmando(false)}>
              Dejarla vinculada
            </Boton>
          </div>
        </div>
      )}
    </Tarjeta>
  );
}
