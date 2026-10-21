"use client";

import { useState } from "react";
import { useIdioma } from "@/lib/useIdioma";
import { errorPeriodo, periodoDashboard, PERIODOS_DASHBOARD, textoPeriodo } from "@/lib/dashboard";
import { Boton, Campo, ErrorGeneral, Tarjeta } from "@/componentes/ui";

export default function PeriodoDashboard({ periodo, cambiar }) {
  const { locale } = useIdioma();
  const [opcion, setOpcion] = useState("mes");
  const [borrador, setBorrador] = useState(periodo);
  const [error, setError] = useState(null);

  function elegir(clave) {
    setOpcion(clave);
    setError(null);
    if (clave === "personalizado") setBorrador(periodo);
    else cambiar(periodoDashboard(clave));
  }

  function aplicar(evento) {
    evento.preventDefault();
    const problema = errorPeriodo(borrador);
    setError(problema);
    if (!problema) cambiar(borrador);
  }

  return (
    <Tarjeta className="mb-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <label htmlFor="dashboard-periodo" className="font-bold">Período</label>
        <select id="dashboard-periodo" value={opcion} onChange={(e) => elegir(e.target.value)}
          className="min-h-12 max-w-full rounded-campo border-2 border-borde-fuerte bg-tarjeta px-3 text-cuerpo">
          {PERIODOS_DASHBOARD.map((p) => <option key={p.clave} value={p.clave}>{p.nombre}</option>)}
        </select>
        <p className="text-etiqueta text-tinta-media">{textoPeriodo(periodo, locale)} · Hora de Argentina</p>
      </div>
      {opcion === "personalizado" && (
        <form onSubmit={aplicar} noValidate className="mt-5">
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Campo id="dashboard-desde" etiqueta="Desde" type="date" value={borrador.desde}
              onChange={(e) => { setBorrador({ ...borrador, desde: e.target.value }); setError(null); }} />
            <Campo id="dashboard-hasta" etiqueta="Hasta" type="date" value={borrador.hasta}
              onChange={(e) => { setBorrador({ ...borrador, hasta: e.target.value }); setError(null); }} />
          </div>
          {error && <ErrorGeneral>{error}</ErrorGeneral>}
          <Boton type="submit">Aplicar período</Boton>
        </form>
      )}
    </Tarjeta>
  );
}
