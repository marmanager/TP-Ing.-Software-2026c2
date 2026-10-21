"use client";

// Arriba de todo mientras se mira una sede vinculada sin ser miembro
// (docs/roles.md, "Visitas"). Dice dónde se está, que no se puede cambiar
// nada, y cómo volver. Estado con color, ícono y palabra (cartilla).

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import { misSedes } from "@/lib/sedes";
import Icono from "./Icono";

export default function FranjaDeVisita() {
  const { usuario, sesion, entrarAlNegocio } = useAuth();
  const { negocio } = useDatos();
  const router = useRouter();
  const [sedes, setSedes] = useState([]);
  const [yendo, setYendo] = useState(false);
  const origenId = usuario?.visitando_desde;
  const token = sesion?.access_token;

  // El nombre de la sede propia: viene en la lista de sedes que se ven, que
  // desde la visita sigue siendo la de la red de origen.
  useEffect(() => {
    if (!origenId) return;
    let vivo = true;
    misSedes(token).then((r) => vivo && r.ok && setSedes(r.sedes));
    return () => {
      vivo = false;
    };
  }, [origenId, token]);

  if (!origenId) return null;

  const origen = sedes.find((s) => s.id === origenId);

  async function volver() {
    setYendo(true);
    const r = await entrarAlNegocio(origenId);
    setYendo(false);
    if (r.ok) router.replace("/");
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 border-l-4 border-l-espera bg-espera-fondo px-4 py-3 text-espera"
    >
      <Icono nombre="ojo" />
      <span className="font-bold">{negocio?.nombre} · Solo lectura</span>
      <button
        type="button"
        disabled={yendo}
        onClick={volver}
        className="ml-auto min-h-12 font-bold underline"
      >
        Volver a {origen?.nombre ?? "la sede propia"}
      </button>
    </div>
  );
}
