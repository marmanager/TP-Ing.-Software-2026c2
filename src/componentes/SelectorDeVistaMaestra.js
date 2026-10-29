"use client";

// El selector de negocios de la vista maestra (docs/vista-maestra.md): uno a
// la vez, con su foto y su nombre para saber cuál es cuál. Tocar uno cambia la
// pantalla en la que se está a ese negocio, sin moverse de sección. Alt+1…9
// eligen por posición. El puntito avisa si hay casos atrasados o stock bajo.

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useIdioma } from "@/lib/useIdioma";
import { delSelector, hayUrgencia, negocioDelAtajo, verVistaMaestra } from "@/lib/vista-maestra";
import Icono from "./Icono";
import { ErrorGeneral } from "./ui";

export default function SelectorDeVistaMaestra() {
  const { usuario, sesion, mirarEnVistaMaestra } = useAuth();
  const { t } = useIdioma();
  const token = sesion?.access_token;
  const enVista = Boolean(usuario?.vista_maestra_desde);
  const mirandoId = usuario?.negocio_id;
  const [vista, setVista] = useState(null);
  const [yendo, setYendo] = useState(null);
  const [error, setError] = useState(null);
  // Un cambio a la vez, y la última lectura pedida es la que vale: si dos
  // respuestas llegan cruzadas, la vieja no pisa a la nueva.
  const cambiando = useRef(false);
  const pedido = useRef(0);

  const pedir = useCallback(() => {
    const mio = ++pedido.current;
    verVistaMaestra(token).then((r) => r.ok && mio === pedido.current && setVista(r.vista));
  }, [token]);

  // Al entrar y cada vez que el desplegable guarda algo.
  useEffect(() => {
    if (!enVista) return;
    pedir();
    window.addEventListener("vista-maestra:cambio", pedir);
    return () => {
      pedido.current++; // lo que venga en camino ya no vale
      window.removeEventListener("vista-maestra:cambio", pedir);
    };
  }, [enVista, pedir]);

  const selector = delSelector(vista?.negocios);

  const mirar = useCallback(async (id) => {
    if (!id || id === mirandoId || cambiando.current) return;
    cambiando.current = true;
    setYendo(id);
    setError(null);
    const r = await mirarEnVistaMaestra(id);
    cambiando.current = false;
    setYendo(null);
    if (!r.ok) setError(r.error.mensaje);
  }, [mirandoId, mirarEnVistaMaestra]);

  // Alt+número, también con el foco en un campo: en vista maestra no hay nada
  // escrito que se pierda. Sólo se frena la tecla si había un negocio en esa
  // posición: así Alt sola, Alt+0 o una posición vacía siguen haciendo lo de siempre.
  useEffect(() => {
    if (!enVista) return;
    const alApretar = (e) => {
      const id = negocioDelAtajo(e, selector);
      if (!id) return;
      e.preventDefault();
      mirar(id);
    };
    window.addEventListener("keydown", alApretar);
    return () => window.removeEventListener("keydown", alApretar);
  }, [enVista, selector, mirar]);

  if (!enVista || !vista) return null;

  const urgencia = (id) => vista.urgencias?.find((u) => u.negocio_id === id);
  const textoDeUrgencia = (u) => hayUrgencia(u)
    ? [u.casos_atrasados > 0 && t("vistaMaestra.casosAtrasados", { n: u.casos_atrasados }),
       u.stock_bajo > 0 && t("vistaMaestra.stockBajo", { n: u.stock_bajo })].filter(Boolean).join(" · ")
    : t("vistaMaestra.sinUrgencias");

  const boton = (n, i, enTira) => {
    const u = urgencia(n.id);
    const aca = n.id === mirandoId;
    const titulo = `${n.nombre} · ${textoDeUrgencia(u)}${i < 9 ? ` · ${t("vistaMaestra.atajo", { n: i + 1 })}` : ""}`;
    return (
      <li key={n.id}>
        <button
          type="button"
          onClick={() => mirar(n.id)}
          aria-current={aca ? "true" : undefined}
          aria-keyshortcuts={i < 9 ? `Alt+${i + 1}` : undefined}
          aria-busy={yendo === n.id}
          title={titulo}
          className={[
            "relative flex min-h-12 items-center gap-2 rounded-campo px-2 text-left",
            enTira ? "shrink-0" : "w-full",
            aca ? "bg-azul-claro font-bold text-azul" : "text-tinta-media hover:bg-superficie",
          ].join(" ")}
        >
          {n.foto ? (
            <img src={n.foto} alt="" className="size-9 shrink-0 rounded-campo object-cover" />
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-campo bg-azul text-white">
              <Icono nombre="tienda" />
            </span>
          )}
          <span className="max-w-40 truncate">{n.nombre}</span>
          {hayUrgencia(u) && (
            <span className="flex items-center text-rojo">
              <Icono nombre="alerta" className="size-5" />
              <span className="sr-only">{textoDeUrgencia(u)}</span>
            </span>
          )}
        </button>
      </li>
    );
  };

  const fallo = error && <ErrorGeneral>{error}</ErrorGeneral>;

  return (
    <>
      <nav aria-label={t("vistaMaestra.selector")}
        className="fixed top-1/2 right-4 z-30 hidden max-h-[70dvh] w-56 -translate-y-1/2 overflow-y-auto rounded-campo border border-borde bg-fondo p-2 shadow-lg md:block">
        <ul className="flex flex-col gap-1">{selector.map((n, i) => boton(n, i, false))}</ul>
        {fallo}
      </nav>
      <nav aria-label={t("vistaMaestra.selector")}
        className="sticky top-0 z-30 overflow-x-auto border-b border-borde bg-fondo px-2 py-2 md:hidden">
        <ul className="flex gap-2">{selector.map((n, i) => boton(n, i, true))}</ul>
        {fallo}
      </nav>
    </>
  );
}
