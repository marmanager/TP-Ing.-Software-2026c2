"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import { puede } from "@/lib/permisos";
import { motivoDePagos } from "@/lib/pagos";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import Icono from "./Icono";
import { Boton, ErrorGeneral, Tarjeta } from "./ui";

export default function ConexionMercadoPago() {
  const { t } = useIdioma();
  const { usuario } = useAuth();
  const { negocio, avisarExito, estadoMercadoPago, conectarMercadoPago, desvincularMercadoPago, pagosEnLinea } =
    useDatos();
  const [conectado, setConectado] = useState(null);
  const [vinculando, setVinculando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [desvinculando, setDesvinculando] = useState(false);
  // Un error de la API (objeto o texto) o, si no vino ninguno, la clave del texto
  // propio: se traduce al dibujar, así sigue al idioma si cambia.
  const [error, setError] = useState(null);
  const textoDelError = (e) => (e?.fallback ? t(e.fallback) : textoDeError(t, e));

  const puedeConfigurar = puede(usuario, "conectar_mercadopago");

  // La vuelta de Mercado Pago, que pasa por Casos (vueltaDeMercadoPago).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mp") !== "conectado") return;
    window.sessionStorage.removeItem("marmanager.mp-desde");
    avisarExito(t("negocio.mercadoPago.vinculadoListo"));
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
        setError(r.error?.codigo || r.error?.mensaje ? r.error : { fallback: "negocio.mercadoPago.noPudimosConsultar" });
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
      return setError(r.error || { fallback: "negocio.mercadoPago.noPudimosAbrir" });
    }
    window.sessionStorage.setItem("marmanager.mp-desde", "negocio");
    window.location.assign(r.url);
  }

  async function desvincular() {
    setDesvinculando(true);
    setError(null);
    const r = await desvincularMercadoPago();
    setDesvinculando(false);
    if (!r.ok) return setError(r.error?.codigo || r.error?.mensaje ? r.error : { fallback: "negocio.mercadoPago.noPudimosDesvincular" });
    setConectado(false);
    setConfirmando(false);
    avisarExito(t("negocio.mercadoPago.desvinculadoListo"));
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
            <p className="text-tinta-media">{t("negocio.mercadoPago.consultando")}</p>
          ) : (
            <p className="text-tinta-media">
              {conectado
                ? t("negocio.mercadoPago.vinculadoCon", { negocio: negocio?.nombre ?? t("negocio.mercadoPago.esteNegocio") })
                : t("negocio.mercadoPago.vincularTexto")}
            </p>
          )}
        </div>
        {conectado === false && (
          <Boton
            motivo={!pagosEnLinea?.disponible ? motivoDePagos(pagosEnLinea, t) : vinculando ? t("negocio.mercadoPago.abriendo") : null}
            onClick={vincular}
          >
            {t("negocio.mercadoPago.vincular")}
          </Boton>
        )}
        {conectado && !confirmando && (
          <Boton variante="peligro" icono="salir" onClick={() => setConfirmando(true)}>
            {t("negocio.mercadoPago.desvincular")}
          </Boton>
        )}
      </div>

      {error && <div className="mt-4"><ErrorGeneral>{textoDelError(error)}</ErrorGeneral></div>}

      {confirmando && (
        <div className="mt-4 rounded-tarjeta bg-superficie p-4">
          <p className="font-bold">{t("negocio.mercadoPago.confirmarTitulo")}</p>
          <p className="mt-1 max-w-[65ch] text-tinta-media">
            {t("negocio.mercadoPago.confirmarTexto")}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Boton
              variante="peligro"
              icono="salir"
              motivo={desvinculando ? t("negocio.mercadoPago.desvinculando") : null}
              onClick={desvincular}
            >
              {t("negocio.mercadoPago.siDesvincular")}
            </Boton>
            <Boton variante="plano" disabled={desvinculando} onClick={() => setConfirmando(false)}>
              {t("negocio.mercadoPago.dejarVinculada")}
            </Boton>
          </div>
        </div>
      )}
    </Tarjeta>
  );
}
