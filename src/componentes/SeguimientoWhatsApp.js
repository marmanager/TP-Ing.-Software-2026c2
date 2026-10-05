"use client";

import { useEffect, useRef, useState } from "react";
import Icono from "./Icono";
import { Boton, Campo } from "./ui";
import { erroresSeguimiento, SEGUIMIENTO_VACIO, telefonoWhatsAppValido } from "@/lib/seguimiento-whatsapp";

export default function SeguimientoWhatsApp({ datos, telefono, valor, alCambiar, guardando }) {
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
  const errores = erroresSeguimiento(valor);
  const disponible = configuracion?.activo && conTelefono && !activando;

  return (
    <fieldset className="my-6 border-t border-borde pt-6" disabled={guardando}>
      <legend className="flex items-center gap-2 pt-6 font-titulo font-extrabold text-seccion">
        <Icono nombre="whatsapp" className="size-6 text-completo" />
        Seguimiento por WhatsApp
      </legend>
      <p className="mb-3 text-etiqueta text-tinta-media">
        El mensaje que uses quedará guardado para los próximos casos. Los días se aplican a este cierre.
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
        Enviar mensaje de seguimiento
      </label>
      <p id="seguimiento-entrega-ayuda" className="mb-4 text-etiqueta text-tinta-media">
        {!conTelefono
          ? "Agregá al cliente un teléfono con código de país para poder avisarle."
          : "Marcá esta opción sólo si el cliente aceptó recibir el mensaje."}
      </p>
      {cargando && <p role="status" className="mb-4 text-tinta-media">Cargando la configuración del seguimiento…</p>}
      {error && <p role="alert" className="mb-4 font-bold text-rojo">{error}</p>}
      {!cargando && !configuracion && (
        <Boton variante="plano" onClick={() => setIntento((n) => n + 1)}>Volver a cargar</Boton>
      )}
      {configuracion && !configuracion.activo && (
        <div className="mb-4 rounded-campo bg-espera-fondo p-4">
          <p className="mb-2 text-espera">El seguimiento está desactivado para este negocio.</p>
          <Boton variante="borde" motivo={activando ? "activando" : null} onClick={activar}>
            Activar seguimiento en el negocio
          </Boton>
        </div>
      )}
      {configuracion && (
        <div className="mt-4">
          <Campo
            id="seguimiento-entrega-dias"
            etiqueta="¿Cuántos días después del cierre?"
            ayuda="Poné 0 para enviarlo al cerrar el caso."
            type="number" min="0" max="3650" step="1" inputMode="numeric"
            value={valor.dias}
            error={errores.dias}
            disabled={!valor.enviar || !disponible}
            onChange={(e) => alCambiar({ ...valor, dias: e.target.value })}
          />
          <Campo id="seguimiento-entrega-mensaje" etiqueta="Mensaje para el cliente" error={errores.mensaje}>
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
        </div>
      )}
    </fieldset>
  );
}
