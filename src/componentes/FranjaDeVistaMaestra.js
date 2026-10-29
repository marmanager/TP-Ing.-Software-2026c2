"use client";

// Arriba de todo en vista maestra (docs/vista-maestra.md): qué negocio se está
// mirando, que no se puede cambiar nada, y cómo ir a cambiar algo ahí. Estado
// con color, ícono y palabra (cartilla), como la franja de visita.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import Icono from "./Icono";
import { ErrorGeneral } from "./ui";

export default function FranjaDeVistaMaestra() {
  const { usuario, entrarAlNegocio } = useAuth();
  const { negocio } = useDatos();
  const { t } = useIdioma();
  const router = useRouter();
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState(null);

  if (!usuario?.vista_maestra_desde) return null;

  // Sale de la vista maestra y entra a éste, con su rol de siempre (076).
  async function editarAca() {
    setYendo(true);
    setError(null);
    const r = await entrarAlNegocio(usuario.negocio_id ?? negocio.id);
    setYendo(false);
    if (r.ok) router.refresh();
    else setError(textoDeError(t, r.error));
  }

  return (
    <div role="status" className="flex flex-wrap items-center gap-3 border-l-4 border-l-espera bg-espera-fondo px-4 py-3 text-espera">
      <Icono nombre="ojo" />
      <span className="font-bold">{t("vistaMaestra.soloLectura", { negocio: negocio?.nombre ?? "" })}</span>
      <button type="button" disabled={yendo || !negocio} onClick={editarAca} className="ml-auto min-h-12 font-bold underline">
        {t("vistaMaestra.editarAca")}
      </button>
      {error && <div className="w-full"><ErrorGeneral>{error}</ErrorGeneral></div>}
    </div>
  );
}
