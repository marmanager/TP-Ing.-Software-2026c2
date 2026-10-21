"use client";

// "Suscripción", en Mi perfil: en qué está el negocio (pago, prueba o acceso
// de desarrollo) y el camino a los planes, que es donde se elige y se paga.

import { useRouter } from "next/navigation";
import { diasQueQuedan } from "@/lib/suscripcion";
import { useSuscripcionCompartida } from "@/lib/useSuscripcion";
import { Boton, Cargando, Tarjeta } from "@/componentes/ui";

function texto(datos) {
  if (!datos) return ["No pudimos consultar la suscripción", "Probá de nuevo en un rato."];
  const dias = diasQueQuedan(datos.prueba?.hasta);
  if (datos.motivo === "pago") return ["Suscripción activa", "Todo el equipo del negocio puede usar la app."];
  if (datos.motivo === "prueba") return ["Mes de prueba", `Te ${dias === 1 ? "queda 1 día" : `quedan ${dias} días`}.`];
  if (datos.motivo === "acceso_libre") return ["Acceso de desarrollo", "Tu cuenta usa la app sin suscripción."];
  if (datos.estado === "pending") return ["Esperando el pago", "La confirmación de Mercado Pago puede tardar unos minutos."];
  return ["Sin suscripción", "Elegí un plan para usar la app."];
}

export default function Suscripcion() {
  const router = useRouter();
  const { cargando, datos, recargar } = useSuscripcionCompartida();

  if (cargando) return <Cargando filas={1} />;

  const [titulo, apoyo] = texto(datos);

  return (
    <Tarjeta className="mb-12">
      <p className="font-bold">{titulo}</p>
      <p className="mt-1 text-tinta-media">{apoyo}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Boton onClick={() => router.push("/planes")}>Ver planes</Boton>
        {(!datos || datos.estado === "pending") && <Boton onClick={recargar}>Volver a consultar</Boton>}
      </div>
    </Tarjeta>
  );
}
