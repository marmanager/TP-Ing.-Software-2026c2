"use client";

// "Sedes vinculadas", en Mi negocio (docs/red-de-sedes.md).
//
// La lista de sedes de la red y, para quien puede (vincular_sedes), vincular
// otra y desvincular ésta. La base vuelve a verificar todo: los botones sólo
// evitan ofrecer lo que va a rechazar.

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import { useDatos } from "@/lib/datos";
import { puede, QUIEN_PUEDE } from "@/lib/permisos";
import { candidatosParaVincular, desvincularSede, misSedes, vincularSede, visitarSede } from "@/lib/sedes";
import Icono from "./Icono";
import FilaNegocio from "./FilaNegocio";
import { Boton, ErrorGeneral, Tarjeta } from "./ui";

export default function SedesVinculadas() {
  const { usuario, sesion, misNegocios } = useAuth();
  const { t } = useIdioma();
  const { negocio, avisarExito } = useDatos();
  const token = sesion?.access_token;
  const puedeVincular = puede(usuario, "vincular_sedes");
  const [sedes, setSedes] = useState(null);
  const [candidatos, setCandidatos] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  // El nombre de la sede recién vinculada, mientras se muestra lo que destrabó.
  const [desbloqueo, setDesbloqueo] = useState(null);

  useEffect(() => {
    let vivo = true;
    misSedes(token).then((r) => {
      if (!vivo) return;
      setSedes(r.ok ? r.sedes : []);
      if (!r.ok) setError(r.error);
    });
    return () => {
      vivo = false;
    };
  }, [token, negocio?.id]);

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
    setDesbloqueo(otro.nombre);
  }

  // Entra a mirar otra sede (sólo lectura). Se recarga la aplicación entera,
  // como al cambiar de negocio: todos los datos son de la otra sede.
  async function visitar(id) {
    setOcupado(true);
    setError(null);
    const r = await visitarSede(id, token);
    if (r.ok) return window.location.assign("/");
    setOcupado(false);
    setError(r.error);
  }

  async function desvincular() {
    setOcupado(true);
    setError(null);
    const r = await desvincularSede(token);
    setOcupado(false);
    if (!r.ok) return setError(r.error);
    setSedes([]);
    setConfirmando(false);
    avisarExito(t("inventario.vinculadas.desvinculada"));
  }

  return (
    <Tarjeta className="mb-12">
      {/* Arriba y no abajo como los otros avisos: no es una confirmación sino
          una novedad, y lo que destraba hay que prenderlo en Módulos
          ("Todas las sedes" es a pedido). */}
      {desbloqueo && (
        <div
          role="status"
          className="fixed inset-x-3 top-3 z-40 flex flex-wrap items-start gap-3 rounded-tarjeta border border-borde border-l-4 border-l-completo bg-completo-fondo p-4 text-completo shadow-lg md:inset-x-auto md:left-1/2 md:w-[min(36rem,calc(100vw-3rem))] md:-translate-x-1/2"
        >
          <Icono nombre="tienda" className="size-6" />
          <div className="min-w-0 flex-1 text-cuerpo">
            <p className="font-bold">
              {t("inventario.vinculadas.vinculadas", { negocio: negocio?.nombre, sede: desbloqueo })}
            </p>
            <ul className="mt-1 list-disc pl-5">
              <li>{t("inventario.vinculadas.desbloqueoSedes")}</li>
              <li>{t("inventario.vinculadas.desbloqueoVisita")}</li>
            </ul>
            <Link
              href="/negocio/modulos"
              className="mt-2 inline-flex min-h-12 items-center gap-2 font-bold text-azul"
            >
              <Icono nombre="cajas" /> {t("inventario.vinculadas.irAModulos")}
            </Link>
          </div>
          <Boton variante="plano" onClick={() => setDesbloqueo(null)}>
            {t("ui.aviso.entendido")}
          </Boton>
        </div>
      )}
      {sedes === null ? (
        <p className="text-tinta-media">{t("inventario.vinculadas.buscando")}</p>
      ) : sedes.length === 0 && error ? null : sedes.length === 0 && !error ? (
        <p className="max-w-[65ch] text-tinta-media">
          {t("inventario.vinculadas.sinVincular")}
        </p>
      ) : (
        <ul className="grid gap-3">
          {sedes.map((s) => (
            <li key={s.id} className="flex items-center gap-3">
              <FilaNegocio negocio={s} />
              {s.id === negocio?.id && <span className="text-tinta-media">{t("inventario.vinculadas.esta")}</span>}
              {s.soy_miembro === false && (
                <>
                  <span className="flex items-center gap-1 font-bold text-tinta-media">
                    <Icono nombre="ojo" className="size-5" /> {t("inventario.vinculadas.soloLectura")}
                  </span>
                  <Boton motivo={ocupado ? t("inventario.vinculadas.entrando") : null} onClick={() => visitar(s.id)}>
                    {t("inventario.vinculadas.verLaSede")}
                  </Boton>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="mt-4">
          <ErrorGeneral>{textoDeError(t, error)}</ErrorGeneral>
        </div>
      )}

      {!puedeVincular ? (
        <p className="mt-4 text-tinta-media">{QUIEN_PUEDE.vincular_sedes}</p>
      ) : candidatos ? (
        <div className="mt-4 rounded-tarjeta bg-superficie p-4">
          <p className="font-bold">{t("inventario.vinculadas.conCual")}</p>
          {candidatos.length === 0 ? (
            <p className="mt-1 max-w-[65ch] text-tinta-media">
              {t("inventario.vinculadas.sinCandidatos")}
            </p>
          ) : (
            <ul className="mt-3 grid gap-3">
              {candidatos.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3">
                  <FilaNegocio negocio={c} />
                  <Boton motivo={ocupado ? t("inventario.vinculadas.vinculando") : null} onClick={() => vincular(c)}>
                    {t("inventario.vinculadas.vincular")}
                  </Boton>
                </li>
              ))}
            </ul>
          )}
          <Boton variante="plano" className="mt-3" onClick={() => setCandidatos(null)}>
            {t("inventario.vinculadas.cerrar")}
          </Boton>
        </div>
      ) : confirmando ? (
        <div className="mt-4 rounded-tarjeta bg-superficie p-4">
          <p className="font-bold">{t("inventario.vinculadas.desvincularPregunta")}</p>
          <p className="mt-1 max-w-[65ch] text-tinta-media">
            {t("inventario.vinculadas.desvincularTexto")}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Boton variante="peligro" icono="salir" motivo={ocupado ? t("inventario.vinculadas.desvinculando") : null} onClick={desvincular}>
              {t("inventario.vinculadas.siDesvincular")}
            </Boton>
            <Boton variante="plano" disabled={ocupado} onClick={() => setConfirmando(false)}>
              {t("inventario.vinculadas.dejarVinculada")}
            </Boton>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          <Boton icono="mas" motivo={sedes === null ? t("inventario.vinculadas.buscandoMotivo") : null} onClick={abrirCandidatos}>
            {t("inventario.vinculadas.vincularOtra")}
          </Boton>
          {sedes?.length > 0 && (
            <Boton variante="peligro" icono="salir" onClick={() => setConfirmando(true)}>
              {t("inventario.vinculadas.desvincular")}
            </Boton>
          )}
        </div>
      )}
    </Tarjeta>
  );
}
