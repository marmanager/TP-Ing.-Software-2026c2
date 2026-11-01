"use client";

import { useEffect, useRef, useState } from "react";
import Icono from "./Icono";
import { Boton, Campo } from "./ui";
import { erroresSeguimiento, SEGUIMIENTO_VACIO, telefonoWhatsAppValido } from "@/lib/seguimiento-whatsapp";
import { textoDeError } from "@/lib/idioma";
import { useIdioma } from "@/lib/useIdioma";
import { conPlantilla, versionElegida } from "@/lib/recordatorios";

export default function SeguimientoWhatsApp({ datos, telefono, valor, alCambiar, guardando }) {
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

  const conTelefono = telefonoWhatsAppValido(telefono);
  const errores = erroresSeguimiento(valor, t);
  const disponible = configuracion?.activo && conTelefono && !activando;
  // Con la plantilla del posventa aprobada (FRONT-4), el texto es el de Meta:
  // se muestra cómo le llega, sin poder editarlo. La API le suma lo que se
  // hizo y el link al mandarlo.
  const plantilla = configuracion && conPlantilla(configuracion) ? versionElegida(configuracion) : null;

  return (
    <fieldset className="my-6 border-t border-borde pt-6" disabled={guardando}>
      <legend className="flex items-center gap-2 pt-6 font-titulo font-extrabold text-seccion">
        <Icono nombre="whatsapp" className="size-6 text-completo" />
        {t("casos.seguimiento.titulo")}
      </legend>
      <p className="mb-3 text-etiqueta text-tinta-media">
        {t("casos.seguimiento.apoyo")}
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
        {!conTelefono
          ? t("casos.seguimiento.sinTelefono")
          : t("casos.seguimiento.soloSiAcepto")}
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
              <p className="mt-2 max-w-[65ch] whitespace-pre-wrap rounded-campo bg-superficie p-4 text-etiqueta text-tinta-media [overflow-wrap:anywhere]">
                {plantilla.vista_previa}
              </p>
              <p className="mt-1 text-apoyo text-tinta-suave">{t("casos.seguimiento.textoAprobado")}</p>
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
