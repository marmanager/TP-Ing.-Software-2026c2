"use client";

// El mes de prueba: a dónde llega quien lo empieza desde Planes, y adonde
// puede volver para ver cuánto le queda. Va sin la barra de navegación.

import { useRouter } from "next/navigation";
import { useTitulo } from "@/lib/useTitulo";
import { diasQueQuedan } from "@/lib/suscripcion";
import { useSuscripcionCompartida } from "@/lib/useSuscripcion";
import { Boton, Cargando, Tarjeta, TituloPantalla } from "@/componentes/ui";

const fecha = (iso) => new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "long" });

export default function Prueba() {
  useTitulo("Mes de prueba");
  const router = useRouter();
  const { cargando, datos } = useSuscripcionCompartida();

  if (cargando) return <div className="mx-auto w-full max-w-hoja px-4 py-6 sm:px-6 sm:py-8"><Cargando /></div>;

  const hasta = datos?.prueba?.hasta;
  const dias = diasQueQuedan(hasta);
  const activa = datos?.motivo === "prueba";

  return (
    <div className="mx-auto w-full max-w-hoja px-4 py-6 sm:px-6 sm:py-8">
      {activa ? (
        <>
          <TituloPantalla apoyo={`Te ${dias === 1 ? "queda 1 día" : `quedan ${dias} días`}: hasta el ${fecha(hasta)}.`}>
            Tu mes de prueba está activo
          </TituloPantalla>
          <Tarjeta>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>Todo el sistema, para vos y todo tu equipo.</li>
              <li>No te pedimos tarjeta.</li>
              <li>Cuando termine, elegís un plan para seguir. Lo que cargaste queda guardado.</li>
            </ul>
          </Tarjeta>
          <div className="mt-6 flex flex-wrap gap-3">
            <Boton variante="principal" onClick={() => router.push("/")}>Ir a la app</Boton>
            <Boton onClick={() => router.push("/planes")}>Elegir un plan ahora</Boton>
          </div>
        </>
      ) : (
        <>
          <TituloPantalla
            apoyo={hasta ? `Terminó el ${fecha(hasta)}. Para seguir, elegí un plan.` : "Lo podés empezar desde los planes."}
          >
            {hasta ? "Tu mes de prueba terminó" : "Todavía no empezaste tu mes de prueba"}
          </TituloPantalla>
          <Boton variante="principal" onClick={() => router.push("/planes")}>Ver planes</Boton>
        </>
      )}
    </div>
  );
}
