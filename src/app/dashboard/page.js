"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { puede, QUIEN_PUEDE } from "@/lib/permisos";
import EnlaceModuloDashboard from "@/componentes/dashboard/EnlaceModuloDashboard";
import PeriodoDashboard from "@/componentes/dashboard/PeriodoDashboard";
import ResumenDashboard from "@/componentes/dashboard/ResumenDashboard";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { categoriasDashboard, periodoDashboard } from "@/lib/dashboard";
import Icono from "@/componentes/Icono";
import { Cargando, Tarjeta, TituloPantalla, Vacio } from "@/componentes/ui";

const CasosDashboard = dynamic(() => import("@/componentes/dashboard/CasosDashboard"), {
  loading: () => <Cargando filas={4} />,
});

const CobrosDashboard = dynamic(() => import("@/componentes/dashboard/CobrosDashboard"), {
  loading: () => <Cargando filas={4} />,
});

const InventarioDashboard = dynamic(() => import("@/componentes/dashboard/InventarioDashboard"), {
  loading: () => <Cargando filas={4} />,
});

const ClientesDashboard = dynamic(() => import("@/componentes/dashboard/ClientesDashboard"), {
  loading: () => <Cargando filas={4} />,
});

export default function Dashboard() {
  const { cargando, negocio } = useDatos();
  const { usuario } = useAuth();
  const [periodo, setPeriodo] = useState(() => periodoDashboard());
  const [elegida, setElegida] = useState("resumen");
  useTitulo("Dashboard");

  useEffect(() => {
    setElegida("resumen");
  }, [negocio?.id]);

  const categorias = categoriasDashboard(negocio?.modulos_activos ?? []);
  // Si se apaga el módulo de la categoría elegida, vuelve a Resumen.
  const actual = categorias.find((categoria) => categoria.clave === elegida) ?? categorias[0];

  if (cargando) return <Cargando />;
  if (!puede(usuario, "ver_todos_los_casos"))
    return <Vacio icono="grafico" titulo="No tenés permiso para consultar el Dashboard">{QUIEN_PUEDE.ver_todos_los_casos}</Vacio>;

  return (
    <>
      <TituloPantalla apoyo="La actividad de tu negocio, organizada por categoría.">
        Dashboard
      </TituloPantalla>

      <div role="group" aria-label="Categorías del Dashboard" className="mb-6 flex flex-wrap gap-2">
        {categorias.map((categoria) => {
          const seleccionada = actual.clave === categoria.clave;
          return (
            <button
              key={categoria.clave}
              type="button"
              aria-pressed={seleccionada}
              aria-controls="dashboard-categoria"
              onClick={() => setElegida(categoria.clave)}
              className={[
                "flex min-h-12 cursor-pointer items-center gap-2 rounded-full border-2 px-4 text-etiqueta",
                seleccionada
                  ? "border-azul bg-azul-claro font-bold text-azul"
                  : "border-borde bg-tarjeta text-tinta-media hover:bg-superficie",
              ].join(" ")}
            >
              <Icono nombre={categoria.icono} className="size-5" />
              {categoria.nombre}
            </button>
          );
        })}
      </div>

      <PeriodoDashboard periodo={periodo} cambiar={setPeriodo} />

      <section id="dashboard-categoria" aria-labelledby="dashboard-categoria-titulo">
        {actual.clave === "resumen" ? <ResumenDashboard key={negocio.id} periodo={periodo} /> : actual.clave === "casos" ? <CasosDashboard key={negocio.id} periodo={periodo} /> : actual.clave === "cobros" ? <CobrosDashboard key={negocio.id} periodo={periodo} /> : actual.clave === "clientes" ? <ClientesDashboard key={negocio.id} periodo={periodo} /> : actual.clave === "inventario" ? <InventarioDashboard key={negocio.id} /> : <Tarjeta>
          <h2 id="dashboard-categoria-titulo" className="flex items-center gap-2 text-seccion">
            <Icono nombre={actual.icono} className="size-6 text-azul" />
            {actual.nombre}
          </h2>
          <p className="mt-2 text-tinta-media">{actual.descripcion}</p>
          <p className="mt-4 text-etiqueta text-tinta-media">
            Los indicadores de esta categoría estarán disponibles próximamente.
          </p>
        </Tarjeta>}
        {actual.clave !== "resumen" && <div className="mt-6 flex justify-end">
          <EnlaceModuloDashboard categoria={actual.clave} activos={negocio.modulos_activos ?? []} />
        </div>}
      </section>
    </>
  );
}
