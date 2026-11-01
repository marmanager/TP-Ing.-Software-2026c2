"use client";

// El Asistente ya no es una pantalla: es un panel que se abre encima de
// cualquiera (src/componentes/asistente). Esta dirección queda para los
// enlaces y marcadores viejos: abre el chat a pantalla completa y deja
// atrás el Inicio, para que al achicarlo haya algo en qué trabajar.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAbrirAsistente } from "@/componentes/asistente/ContextoAsistente";
import { Cargando } from "@/componentes/ui";

export default function Asistente() {
  const router = useRouter();
  const { agrandar } = useAbrirAsistente();

  useEffect(() => {
    agrandar();
    router.replace("/");
  }, [agrandar, router]);

  return <Cargando />;
}
