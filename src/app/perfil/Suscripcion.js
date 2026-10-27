"use client";

// "Suscripción", en Mi perfil: en qué está el negocio (pago, prueba o acceso
// de desarrollo) y el camino a los planes, que es donde se elige y se paga.

import { useRouter } from "next/navigation";
import { diasQueQuedan } from "@/lib/suscripcion";
import { useSuscripcionCompartida } from "@/lib/useSuscripcion";
import { useIdioma } from "@/lib/useIdioma";
import { Boton, Cargando, Tarjeta } from "@/componentes/ui";

function texto(datos, t) {
  if (!datos) return [t("cuenta.suscripcion.noConsulta"), t("cuenta.suscripcion.noConsultaApoyo")];
  const dias = diasQueQuedan(datos.prueba?.hasta);
  if (datos.motivo === "pago") return [t("cuenta.suscripcion.pago"), t("cuenta.suscripcion.pagoApoyo")];
  if (datos.motivo === "prueba") return [t("cuenta.suscripcion.prueba"), t("cuenta.suscripcion.pruebaDias", { n: dias })];
  if (datos.motivo === "acceso_libre") return [t("cuenta.suscripcion.libre"), t("cuenta.suscripcion.libreApoyo")];
  if (datos.estado === "pending") return [t("cuenta.suscripcion.pendiente"), t("cuenta.suscripcion.pendienteApoyo")];
  return [t("cuenta.suscripcion.sin"), t("cuenta.suscripcion.sinApoyo")];
}

export default function Suscripcion() {
  const router = useRouter();
  const { t } = useIdioma();
  const { cargando, datos, recargar } = useSuscripcionCompartida();

  if (cargando) return <Cargando filas={1} />;

  const [titulo, apoyo] = texto(datos, t);

  return (
    <Tarjeta className="mb-12">
      <p className="font-bold">{titulo}</p>
      <p className="mt-1 text-tinta-media">{apoyo}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Boton onClick={() => router.push("/planes")}>{t("cuenta.suscripcion.verPlanes")}</Boton>
        {(!datos || datos.estado === "pending") && <Boton onClick={recargar}>{t("cuenta.suscripcion.volverAConsultar")}</Boton>}
      </div>
    </Tarjeta>
  );
}
