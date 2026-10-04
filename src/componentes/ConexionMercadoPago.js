"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import { quitar, traer } from "@/lib/api";
import Icono from "./Icono";
import { Boton, ErrorGeneral, Tarjeta } from "./ui";

export default function ConexionMercadoPago() {
  const { sesion, usuario } = useAuth();
  const { negocio, casosPorApi, avisarExito } = useDatos();
  const [conectado, setConectado] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [desvinculando, setDesvinculando] = useState(false);
  const [error, setError] = useState(null);

  const puedeConfigurar = usuario?.rol === "duenio" || usuario?.rol === "encargado";

  useEffect(() => {
    let vivo = true;
    if (!casosPorApi || !puedeConfigurar || !sesion?.access_token) return;
    traer("/cobros/mercadopago/status", sesion.access_token).then((r) => {
      if (!vivo) return;
      if (r.ok) setConectado(Boolean(r.datos?.conectado));
      else {
        setConectado(false);
        setError(r.error?.mensaje ?? "No pudimos consultar la conexión de Mercado Pago.");
      }
    });
    return () => { vivo = false; };
  }, [casosPorApi, puedeConfigurar, sesion?.access_token, negocio?.id]);

  if (!casosPorApi || !puedeConfigurar) return null;

  async function desvincular() {
    setDesvinculando(true);
    setError(null);
    const r = await quitar("/cobros/mercadopago/vinculacion", sesion.access_token);
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
                : "No está vinculado con este negocio."}
            </p>
          )}
        </div>
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
