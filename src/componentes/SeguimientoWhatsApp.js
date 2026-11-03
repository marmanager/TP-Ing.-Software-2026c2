"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Icono from "./Icono";
import { Boton, Campo } from "./ui";
import { erroresSeguimiento, SEGUIMIENTO_VACIO } from "@/lib/seguimiento-whatsapp";
import { textoDeError } from "@/lib/idioma";
import { useIdioma } from "@/lib/useIdioma";
import { avisosDelCliente, conPlantilla, versionElegida } from "@/lib/recordatorios";

// Sale por el canal del cliente (083): por WhatsApp o por mail. El nombre del
// componente quedó de cuando era sólo WhatsApp.
export default function SeguimientoWhatsApp({ datos, cliente, valor, alCambiar, guardando }) {
  const { t } = useIdioma();
  const [configuracion, setConfiguracion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [intento, setIntento] = useState(0);
  const [activando, setActivando] = useState(false);
  const acciones = useRef(datos);
  const montado = useRef(false);
  acciones.current = datos;
  const negocioId = datos.negocio?.id;

  useEffect(() => {
    let vivo = true;
    montado.current = true;
    setCargando(true);
    setError(null);
    setConfiguracion(null);
    alCambiar(SEGUIMIENTO_VACIO);
    (async () => {
      const r = await acciones.current.consultarSeguimiento();
      if (!vivo) return;
      setCargando(false);
      if (!r.ok) return setError(r.error);
      setConfiguracion(r.configuracion);
      alCambiar({
        enviar: false,
        dias: String(r.configuracion.dias),
        mensaje: r.configuracion.mensaje,
        mensajeGuardado: r.configuracion.mensaje,
      });
    })();
    return () => { vivo = false; montado.current = false; };
  }, [negocioId, intento, alCambiar]);

  async function activar() {
    setActivando(true);
    setError(null);
    const r = await acciones.current.configurarSeguimiento({ activo: true });
    if (!montado.current || acciones.current.negocio?.id !== negocioId) return;
    setActivando(false);
    if (!r.ok) return setError(r.error);
    setConfiguracion(r.configuracion);
  }

  const avisos = avisosDelCliente(cliente);
  const porMail = avisos.canal === "email";
  const errores = erroresSeguimiento(valor, t);
  const disponible = configuracion?.activo && avisos.puede && !activando;
  // Con la plantilla del posventa aprobada (FRONT-4), el texto es el de Meta:
  // se muestra cómo le llega, sin poder editarlo. La API le suma lo que se
  // hizo y el link al mandarlo.
  const plantilla = configuracion && conPlantilla(configuracion) ? versionElegida(configuracion) : null;
  const conDetalle = plantilla && plantilla.version !== "salud";

  return (
    <fieldset className="my-6 border-t border-borde pt-6" disabled={guardando}>
      {/* Flotando, la leyenda deja de ir encima del borde de arriba: queda
          debajo de la línea, como cualquier otro título. */}
      <legend className="float-left flex w-full items-center gap-2 font-titulo font-extrabold text-seccion">
        {porMail ? (
          <Icono nombre="sobre" className="size-6 text-azul" />
        ) : (
          <Icono nombre="whatsapp" className="size-6 text-completo" />
        )}
        {t(porMail ? "casos.seguimiento.tituloMail" : "casos.seguimiento.titulo")}
      </legend>
      <p className="clear-left mb-3 pt-2 text-etiqueta text-tinta-media">
        {plantilla ? t("casos.seguimiento.apoyoConPlantilla") : t("casos.seguimiento.apoyo")}
        {porMail && avisos.puede && <> {t("casos.seguimiento.leLlegaA", { email: avisos.destino })}</>}
      </p>
      <label className="inline-flex min-h-12 cursor-pointer items-center gap-3 font-bold text-cuerpo">
        <input
          type="checkbox"
          checked={Boolean(valor.enviar && disponible)}
          disabled={cargando || !disponible}
          onChange={(e) => alCambiar({ ...valor, enviar: e.target.checked })}
          aria-describedby="seguimiento-entrega-ayuda"
          className="size-5 accent-azul"
        />
        {t("casos.seguimiento.enviar")}
      </label>
      <p id="seguimiento-entrega-ayuda" className="mb-4 text-etiqueta text-tinta-media">
        {avisos.puede ? t("casos.seguimiento.soloSiAcepto")
          : porMail ? t("casos.seguimiento.sinMail")
            : t("casos.seguimiento.sinTelefono")}
      </p>
      {cargando && <p role="status" className="mb-4 text-tinta-media">{t("casos.seguimiento.cargando")}</p>}
      {error && <p role="alert" className="mb-4 font-bold text-rojo">{textoDeError(t, error)}</p>}
      {!cargando && !configuracion && (
        <Boton variante="plano" onClick={() => setIntento((n) => n + 1)}>{t("casos.seguimiento.volverACargar")}</Boton>
      )}
      {configuracion && !configuracion.activo && (
        <div className="mb-4 rounded-campo bg-espera-fondo p-4">
          <p className="mb-2 text-espera">{t("casos.seguimiento.desactivado")}</p>
          <Boton variante="borde" motivo={activando ? t("casos.seguimiento.activando") : null} onClick={activar}>
            {t("casos.seguimiento.activar")}
          </Boton>
        </div>
      )}
      {configuracion && (
        <div className="mt-4">
          <Campo
            id="seguimiento-entrega-dias"
            etiqueta={t("casos.seguimiento.cuantosDias")}
            ayuda={t("casos.seguimiento.cuantosDiasAyuda")}
            type="number" min="0" max="3650" step="1" inputMode="numeric"
            value={valor.dias}
            error={errores.dias}
            disabled={!valor.enviar || !disponible}
            onChange={(e) => alCambiar({ ...valor, dias: e.target.value })}
          />
          {plantilla ? (
            <div data-plantilla-posventa className="mb-6">
              <p className="font-bold text-cuerpo">{t("casos.seguimiento.leVaALlegar")}</p>
              {/* Como le llega: el globo del mensaje y, si la versión lo
                  tiene, el botón de abajo. La de salud no lleva resumen ni botón. */}
              <div className="mt-2 max-w-[65ch] rounded-campo bg-superficie p-3 sm:p-4">
                <div className="max-w-[52ch] overflow-hidden rounded-campo border border-borde bg-tarjeta">
                  <p className="whitespace-pre-wrap p-3 text-etiqueta text-tinta [overflow-wrap:anywhere]">{plantilla.vista_previa}</p>
                  {conDetalle && (
                    <p className="flex items-center justify-center gap-2 border-t border-borde p-2 text-etiqueta font-bold text-azul">
                      <Icono nombre="ojo" className="size-4" />
                      {t("casos.seguimiento.botonDelDetalle")}
                    </p>
                  )}
                </div>
              </div>
              <p className="mt-2 max-w-[65ch] text-apoyo text-tinta-suave">
                {conDetalle && `${t("casos.seguimiento.resumenDeEjemplo")} `}
                {t(porMail ? "casos.seguimiento.textoAprobadoMail" : "casos.seguimiento.textoAprobado")}{" "}
                <Link href="/negocio/recordatorios/cierre" className="font-bold text-azul underline">
                  {t("casos.seguimiento.irARecordatorios")}
                </Link>
              </p>
            </div>
          ) : (
          <Campo id="seguimiento-entrega-mensaje" etiqueta={t("casos.seguimiento.mensaje")} error={errores.mensaje}>
            <textarea
              id="seguimiento-entrega-mensaje" rows={5} maxLength={3000}
              value={valor.mensaje}
              disabled={!valor.enviar || !disponible}
              onChange={(e) => alCambiar({ ...valor, mensaje: e.target.value })}
              aria-invalid={errores.mensaje ? "true" : undefined}
              aria-describedby={errores.mensaje ? "seguimiento-entrega-mensaje-error" : undefined}
              className={`mt-2 block w-full resize-y rounded-campo border-2 bg-tarjeta p-4 text-cuerpo ${errores.mensaje ? "border-rojo" : "border-borde-fuerte"}`}
            />
          </Campo>
          )}
        </div>
      )}
    </fieldset>
  );
}
