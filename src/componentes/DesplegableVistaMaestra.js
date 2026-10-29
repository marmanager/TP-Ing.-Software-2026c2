"use client";

// El desplegable de la flechita, en vista maestra (docs/vista-maestra.md):
// qué negocios aparecen en el selector de la derecha, en qué orden, y los
// grupos para prender o apagar varios de una. Se guarda al tocar, en la cuenta
// (076), así el celular ve lo mismo.

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useIdioma } from "@/lib/useIdioma";
import {
  borrarGrupo, cambiarGrupo, conGrupo, conPrendido, crearGrupo, estadoDelGrupo,
  guardarNegociosDeVista, mover, moverA, verVistaMaestra,
} from "@/lib/vista-maestra";
import Icono from "./Icono";
import { Boton, Campo, ErrorGeneral, Interruptor } from "./ui";

// El selector de la derecha escucha esto para volver a pedir la vista.
const avisar = () => window.dispatchEvent(new Event("vista-maestra:cambio"));

export default function DesplegableVistaMaestra({ id }) {
  const { sesion, usuario } = useAuth();
  const { t } = useIdioma();
  const token = sesion?.access_token;
  const mirandoId = usuario?.negocio_id;
  const [vista, setVista] = useState(null);
  const [error, setError] = useState(null);
  const [arrastrado, setArrastrado] = useState(null);
  const [grupoEditado, setGrupoEditado] = useState(null); // { id|null, nombre, negocios }
  // Una sola escritura a la vez: si dos viajaran juntas, la que llega última
  // pisaría a la otra con una vista vieja. El ref frena el doble toque antes
  // de que React llegue a apagar los botones.
  const [guardando, setGuardando] = useState(false);
  const enCurso = useRef(false);

  async function una(tarea) {
    if (enCurso.current) return;
    enCurso.current = true;
    setGuardando(true);
    try {
      await tarea();
    } finally {
      enCurso.current = false;
      setGuardando(false);
    }
  }

  useEffect(() => {
    let vivo = true;
    verVistaMaestra(token).then((r) => vivo && (r.ok ? setVista(r.vista) : setError(r.error.mensaje)));
    return () => { vivo = false; };
  }, [token]);

  // Optimista: se muestra ya y, si la base dice que no, se vuelve atrás.
  const guardar = (negocios) => una(async () => {
    const antes = vista;
    setVista({ ...vista, negocios });
    setError(null);
    const r = await guardarNegociosDeVista(negocios, token);
    if (r.ok) { setVista(r.vista); avisar(); }
    else { setVista(antes); setError(r.error.mensaje); }
  });

  const guardarGrupo = () => una(async () => {
    const { id: gid, nombre, negocios } = grupoEditado;
    const r = gid ? await cambiarGrupo(gid, { nombre, negocios }, token) : await crearGrupo({ nombre, negocios }, token);
    if (r.ok) { setVista(r.vista); setGrupoEditado(null); setError(null); avisar(); }
    else setError(r.error.mensaje);
  });

  const quitarGrupo = (gid) => una(async () => {
    const r = await borrarGrupo(gid, token);
    if (r.ok) { setVista(r.vista); setGrupoEditado(null); setError(null); avisar(); }
    else setError(r.error.mensaje);
  });

  if (!vista) {
    return (
      <div id={id} className="mt-3 px-3 text-apoyo text-tinta-suave">
        {error ? <ErrorGeneral>{error}</ErrorGeneral> : "…"}
      </div>
    );
  }
  const negocios = [...vista.negocios].sort((a, b) => a.orden - b.orden);

  return (
    <div id={id} className="mt-3 flex max-h-[60dvh] flex-col gap-4 overflow-y-auto rounded-campo border border-borde bg-superficie p-3">
      {error && <ErrorGeneral>{error}</ErrorGeneral>}
      {guardando && <p role="status" className="text-apoyo text-tinta-suave">{t("vistaMaestra.desplegable.guardando")}</p>}

      <section aria-labelledby={`${id}-grupos`}>
        <h2 id={`${id}-grupos`} className="mb-2 font-bold">{t("vistaMaestra.desplegable.grupos")}</h2>
        <ul className="flex flex-col gap-1">
          {vista.grupos.map((g) => {
            const estado = estadoDelGrupo(negocios, g);
            return (
              <li key={g.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Interruptor
                    prendido={estado === "prendido"}
                    disabled={guardando}
                    onChange={() => guardar(conGrupo(negocios, g, estado !== "prendido", mirandoId))}
                    ayuda={estado === "mezclado" ? t("vistaMaestra.desplegable.mezclado") : undefined}
                  >
                    {g.nombre}
                  </Interruptor>
                </div>
                <button type="button" disabled={guardando} className="min-h-12 px-2 text-apoyo font-bold text-azul disabled:opacity-40"
                  onClick={() => setGrupoEditado({ id: g.id, nombre: g.nombre, negocios: g.negocios })}>
                  {t("vistaMaestra.desplegable.cambiarGrupo")}
                </button>
              </li>
            );
          })}
        </ul>
        {grupoEditado ? (
          <div className="mt-2 flex flex-col gap-2">
            <Campo
              id={`${id}-nombre`}
              etiqueta={t("vistaMaestra.desplegable.nombreGrupo")}
              value={grupoEditado.nombre}
              maxLength={60}
              onChange={(e) => setGrupoEditado({ ...grupoEditado, nombre: e.target.value })}
            />
            {negocios.map((n) => (
              <label key={n.id} className="flex min-h-12 items-center gap-3">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={grupoEditado.negocios.includes(n.id)}
                  onChange={(e) => setGrupoEditado({
                    ...grupoEditado,
                    negocios: e.target.checked
                      ? [...grupoEditado.negocios, n.id]
                      : grupoEditado.negocios.filter((x) => x !== n.id),
                  })}
                />
                {n.nombre}
              </label>
            ))}
            <div className="flex flex-wrap gap-2">
              <Boton onClick={guardarGrupo} motivo={guardando ? t("vistaMaestra.desplegable.guardando") : grupoEditado.nombre.trim() ? undefined : t("vistaMaestra.desplegable.nombreGrupo")}>
                {t("vistaMaestra.desplegable.guardarGrupo")}
              </Boton>
              {grupoEditado.id && (
                <Boton icono="tacho" onClick={() => quitarGrupo(grupoEditado.id)} motivo={guardando ? t("vistaMaestra.desplegable.guardando") : undefined}>
                  {t("vistaMaestra.desplegable.borrarGrupo")}
                </Boton>
              )}
              <Boton onClick={() => setGrupoEditado(null)}>{t("vistaMaestra.desplegable.cerrar")}</Boton>
            </div>
          </div>
        ) : (
          <Boton icono="mas" className="mt-2" motivo={guardando ? t("vistaMaestra.desplegable.guardando") : undefined} onClick={() => setGrupoEditado({ id: null, nombre: "", negocios: [] })}>
            {t("vistaMaestra.desplegable.nuevoGrupo")}
          </Boton>
        )}
      </section>

      <section aria-labelledby={`${id}-negocios`}>
        <h2 id={`${id}-negocios`} className="font-bold">{t("vistaMaestra.desplegable.negocios")}</h2>
        <p className="mb-2 text-apoyo text-tinta-suave">{t("vistaMaestra.desplegable.arrastrar")}</p>
        <ol className="flex flex-col gap-1">
          {negocios.map((n, i) => (
            <li
              key={n.id}
              draggable={!guardando}
              onDragStart={() => setArrastrado(n.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (arrastrado && arrastrado !== n.id) guardar(moverA(negocios, arrastrado, n.id)); setArrastrado(null); }}
              className="flex items-center gap-1 rounded-campo bg-fondo"
            >
              <span aria-hidden="true" className="cursor-grab px-1 text-tinta-suave">⋮⋮</span>
              <div className="min-w-0 flex-1">
                <Interruptor
                  prendido={n.prendido}
                  disabled={guardando}
                  onChange={() => guardar(conPrendido(negocios, n.id, !n.prendido, mirandoId))}
                  motivo={n.id === mirandoId ? t("vistaMaestra.mirando") : undefined}
                >
                  {n.nombre}
                </Interruptor>
              </div>
              <button type="button" disabled={guardando || i === 0} onClick={() => guardar(mover(negocios, n.id, -1))}
                aria-label={t(i === 0 ? "vistaMaestra.desplegable.subirPrimero" : "vistaMaestra.desplegable.subir", { negocio: n.nombre })}
                title={i === 0 ? t("vistaMaestra.desplegable.subirPrimero", { negocio: n.nombre }) : undefined}
                className="flex size-12 items-center justify-center rounded-campo disabled:opacity-40">
                <Icono nombre="flecha-arriba" />
              </button>
              <button type="button" disabled={guardando || i === negocios.length - 1} onClick={() => guardar(mover(negocios, n.id, 1))}
                aria-label={t(i === negocios.length - 1 ? "vistaMaestra.desplegable.bajarUltimo" : "vistaMaestra.desplegable.bajar", { negocio: n.nombre })}
                title={i === negocios.length - 1 ? t("vistaMaestra.desplegable.bajarUltimo", { negocio: n.nombre }) : undefined}
                className="flex size-12 items-center justify-center rounded-campo disabled:opacity-40">
                <Icono nombre="flecha-abajo" />
              </button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
