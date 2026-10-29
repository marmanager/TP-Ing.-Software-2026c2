"use client";

import Link from "next/link";
import { destinoDashboard } from "@/lib/dashboard";
import { useIdioma } from "@/lib/useIdioma";

export default function EnlaceModuloDashboard({ categoria, activos }) {
  const { t } = useIdioma();
  const destino = destinoDashboard(categoria, activos, t);
  if (!destino) return null;
  return <Link href={destino.href} className="inline-flex min-h-12 items-center justify-center rounded-campo border-2 border-azul bg-tarjeta px-5 py-2 text-etiqueta font-bold text-azul hover:bg-azul-claro">
    {destino.texto}
  </Link>;
}
