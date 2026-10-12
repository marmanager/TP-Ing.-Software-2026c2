"use client";

// "Sedes vinculadas", en Mi negocio (docs/red-de-sedes.md).
//
// La lista de sedes de la red y, para quien puede (vincularSedes), vincular
// otra y desvincular ésta. La base vuelve a verificar todo: los botones sólo
// evitan ofrecer lo que va a rechazar.

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import { puede, QUIEN_PUEDE } from "@/lib/permisos";
import { candidatosParaVincular, desvincularSede, misSedes, vincularSede } from "@/lib/sedes";
import FilaNegocio from "./FilaNegocio";
import { Boton, ErrorGeneral, Tarjeta } from "./ui";

export default function SedesVinculadas() {
  const { esDemo, usuario, sesion, misNegocios } = useAuth();
  const { negocio, avisarExito } = useDatos();
  const token = sesion?.access_token;
  const puedeVincular = puede(usuario?.rol, "vincularSedes");
  const [sedes, setSedes] = useState(null);
  const [candidatos, setCandidatos] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (esDemo) return;
    let vivo = true;
    misSedes(token).then((r) => {
      if (!vivo) return;
      setSedes(r.ok ? r.sedes : []);
      if (!r.ok) setError(r.error);
    });
    return () => {
      vivo = false;
    };
  }, [esDemo, token, negocio?.id]);

  if (esDemo) {
    return (
      <Tarjeta className="mb-12">
        <p className="text-tinta-media">En el modo de ejemplo hay una sola sede.</p>
      </Tarjeta>
    );
  }

  async function abrirCandidatos() {
    setError(null);
    const r = await misNegocios();
    if (!r.ok) return setError(r.error);
    setCandidatos(candidatosParaVincular(r.negocios, sedes ?? [], negocio?.id));
  }

  async function vincular(otro) {
    setOcupado(true);
    setError(null);
    const r = await vincularSede(otro.id, token);
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    setSedes(r.sedes);
    setCandidatos(null);
    avisarExito(`Listo. ${negocio?.nombre} y ${otro.nombre} quedaron vinculadas.`);
  }

  async function desvincular() {
    setOcupado(true);
    setError(null);
    const r = await desvincularSede(token);
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    setSedes([]);
    setConfirmando(false);
    avisarExito("Listo. Esta sede ya no está vinculada con las otras.");
  }

  return (
    <Tarjeta className="mb-12">
      {sedes === null ? (
        <p className="text-tinta-media">Buscando tus sedes…</p>
      ) : sedes.length === 0 && error ? null : sedes.length === 0 && !error ? (
        <p className="max-w-[65ch] text-tinta-media">
          Esta sede todavía no está vinculada con otras. Al vincularlas, en Inventario → Todas las
          sedes ves el stock de todas juntas.
        </p>
      ) : (
        <ul className="grid gap-3">
          {sedes.map((s) => (
            <li key={s.id} className="flex items-center gap-3">
              <FilaNegocio negocio={s} />
              {s.id === negocio?.id && <span className="text-tinta-media">(ésta)</span>}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="mt-4">
          <ErrorGeneral>{error}</ErrorGeneral>
        </div>
      )}

      {!puedeVincular ? (
        <p className="mt-4 text-tinta-media">{QUIEN_PUEDE.vincularSedes}</p>
      ) : candidatos ? (
        <div className="mt-4 rounded-tarjeta bg-superficie p-4">
          <p className="font-bold">¿Con cuál la vinculás?</p>
          {candidatos.length === 0 ? (
            <p className="mt-1 max-w-[65ch] text-tinta-media">
              No tenés otros negocios donde puedas vincular. Podés crear uno desde Nuevo negocio.
            </p>
          ) : (
            <ul className="mt-3 grid gap-3">
              {candidatos.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3">
                  <FilaNegocio negocio={c} />
                  <Boton motivo={ocupado ? "vinculando" : null} onClick={() => vincular(c)}>
                    Vincular
                  </Boton>
                </li>
              ))}
            </ul>
          )}
          <Boton variante="plano" className="mt-3" onClick={() => setCandidatos(null)}>
            Cerrar
          </Boton>
        </div>
      ) : confirmando ? (
        <div className="mt-4 rounded-tarjeta bg-superficie p-4">
          <p className="font-bold">¿Desvincular esta sede?</p>
          <p className="mt-1 max-w-[65ch] text-tinta-media">
            Las otras sedes dejan de ver el inventario de ésta, y ésta el de ellas.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Boton variante="peligro" icono="salir" motivo={ocupado ? "desvinculando" : null} onClick={desvincular}>
              Sí, desvincularla
            </Boton>
            <Boton variante="plano" disabled={ocupado} onClick={() => setConfirmando(false)}>
              Dejarla vinculada
            </Boton>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          <Boton icono="mas" motivo={sedes === null ? "buscando tus sedes" : null} onClick={abrirCandidatos}>
            Vincular otra sede
          </Boton>
          {sedes?.length > 0 && (
            <Boton variante="peligro" icono="salir" onClick={() => setConfirmando(true)}>
              Desvincular esta sede
            </Boton>
          )}
        </div>
      )}
    </Tarjeta>
  );
}
