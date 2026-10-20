"use client";

// "Suscripción", en Mi perfil: si el negocio puede usar la app y, si no,
// cómo pagarla. Paga el dueño (POST /v1/suscripcion devuelve el link de
// Mercado Pago); el resto del equipo ve a quién pedírselo.

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { pesos } from "@/lib/estados";
import { useSuscripcionCompartida } from "@/lib/useSuscripcion";
import { Boton, Cargando, ErrorGeneral, Tarjeta } from "@/componentes/ui";

export default function Suscripcion() {
  const { usuario } = useAuth();
  const { cargando, datos, recargar, suscribirse: pedirLink } = useSuscripcionCompartida();
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState(null);

  async function suscribirme() {
    setYendo(true);
    setError(null);
    const r = await pedirLink();
    if (r.ok) {
      window.location.assign(r.url);
      return;
    }
    setYendo(false);
    setError(r.error);
  }

  if (cargando) return <Cargando filas={1} />;

  if (!datos) {
    return (
      <Tarjeta className="mb-12">
        <p>No pudimos consultar la suscripción. Probá de nuevo en un rato.</p>
        <Boton className="mt-4" onClick={recargar}>Volver a consultar</Boton>
      </Tarjeta>
    );
  }

  const { activa, motivo, estado, plan } = datos;
  const esDuenio = Boolean(usuario?.es_duenio);

  return (
    <Tarjeta className="mb-12">
      {activa ? (
        <>
          <p className="font-bold">
            {motivo === "acceso_libre" ? "Acceso de desarrollo" : "Suscripción activa"}
          </p>
          <p className="mt-1 text-tinta-media">
            {motivo === "acceso_libre"
              ? "Tu cuenta usa la app sin suscripción."
              : "Todo el equipo del negocio puede usar la app."}
          </p>
        </>
      ) : (
        <>
          <p className="font-bold">Este negocio no tiene la suscripción activa</p>
          <p className="mt-1 text-tinta-media">
            Para usar la app hace falta suscribirse.{" "}
            {plan && <>{plan.nombre}: {pesos(plan.precio)} por mes, para todo el equipo.</>}
          </p>
          {estado === "pending" && (
            <p className="mt-3 text-tinta-media">
              Si ya pagaste, la confirmación de Mercado Pago puede tardar unos minutos.
            </p>
          )}
          {error && <ErrorGeneral>{error.mensaje}</ErrorGeneral>}
          {esDuenio ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <Boton variante="principal" onClick={suscribirme} disabled={yendo || !plan}>
                {yendo ? "Abriendo Mercado Pago…" : "Suscribirme"}
              </Boton>
              {estado === "pending" && <Boton onClick={recargar}>Revisar si ya se confirmó</Boton>}
            </div>
          ) : (
            <p className="mt-4 font-bold">Pedile al dueño del negocio que active la suscripción.</p>
          )}
        </>
      )}
    </Tarjeta>
  );
}
