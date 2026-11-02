"use client";

// El selector de negocios de la vista maestra (docs/vista-maestra.md): uno a
// la vez, con su foto y su nombre para saber cuál es cuál. Tocar uno cambia la
// pantalla en la que se está a ese negocio, sin moverse de sección. Alt+1…9
// eligen por posición. El puntito avisa si hay casos atrasados o stock bajo.
//
// En computadora es una tarjeta flotante que se lleva a cualquier lado de la
// pantalla con la manija de puntos de arriba. Con el chat de Remi abierto se
// queda a la izquierda del chat, así no se pisan.

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useIdioma } from "@/lib/useIdioma";
import { delSelector, hayUrgencia, negocioDelAtajo, verVistaMaestra } from "@/lib/vista-maestra";
import Icono from "./Icono";
import { ErrorGeneral } from "./ui";
import { useAsistente } from "./asistente/ContextoAsistente";

// El ancho de la pantalla sin la barra de desplazamiento: contra eso se mide
// el `right` de lo que es fixed.
const anchoVisible = () => document.documentElement.clientWidth;

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
  const tarjeta = useRef(null);
  // Dónde la dejó el usuario, en px desde la derecha y desde arriba. Null:
  // donde arranca, a la derecha y a media altura.
  const [lugar, setLugar] = useState(null);
  const [arrastrando, setArrastrando] = useState(false);
  // Lo que ocupa el chat de Remi desde el borde derecho (0 si está cerrado).
  // Se vuelve a medir cuando lo achican o agrandan arrastrando su borde.
  const { modo } = useAsistente();
  const [chat, setChat] = useState(0);
  useEffect(() => {
    const el = modo === "panel" && document.getElementById("panel-asistente");
    if (!el) { setChat(0); return; }
    const medir = new ResizeObserver(() => setChat(Math.max(0, anchoVisible() - el.getBoundingClientRect().left)));
    medir.observe(el);
    return () => medir.disconnect();
  }, [modo]);

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

  // Siempre adentro de la pantalla y nunca abajo del chat.
  const acomodar = (right, top) => {
    const r = tarjeta.current.getBoundingClientRect();
    return {
      right: Math.min(Math.max(right, chat ? chat + 16 : 0), anchoVisible() - r.width),
      top: Math.min(Math.max(top, 0), window.innerHeight - r.height),
    };
  };

  // Mientras se arrastra se escribe directo en el estilo, una vez por cuadro
  // y sin pasar por React: así sigue al mouse liso. Al soltar se guarda.
  const alApretar = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = tarjeta.current;
    const r = el.getBoundingClientRect();
    // De dónde se la agarró, así no salta a quedar con la esquina en el mouse.
    const dx = e.clientX - r.right;
    const dy = e.clientY - r.top;
    let ultimo = { right: anchoVisible() - r.right, top: r.top };
    let cuadro = 0;
    setLugar(ultimo);
    setArrastrando(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
    const mover = (ev) => {
      ultimo = acomodar(anchoVisible() - ev.clientX + dx, ev.clientY - dy);
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => {
        el.style.right = `${ultimo.right}px`;
        el.style.top = `${ultimo.top}px`;
      });
    };
    const soltar = () => {
      cancelAnimationFrame(cuadro);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      setArrastrando(false);
      setLugar(ultimo);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };

  const alTeclado = (e) => {
    const paso = { ArrowLeft: [16, 0], ArrowRight: [-16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }[e.key];
    if (!paso) return;
    e.preventDefault();
    const r = tarjeta.current.getBoundingClientRect();
    setLugar(acomodar(anchoVisible() - r.right + paso[0], r.top + paso[1]));
  };

  const derecha = Math.max(lugar?.right ?? 16, chat ? chat + 16 : 0);

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
      <nav ref={tarjeta} aria-label={t("vistaMaestra.selector")}
        style={{ right: derecha, top: lugar?.top }}
        // Se desliza al abrir o cerrar el chat y con las flechas; mientras se
        // arrastra, no: iría atrasada del mouse. Agarrada se levanta un poco.
        className={`fixed z-30 hidden max-h-[70dvh] w-56 overflow-y-auto rounded-campo border border-borde bg-fondo px-2 pb-2 lg:block ${
          lugar ? "" : "top-1/2 -translate-y-1/2"
        } ${
          arrastrando
            ? "scale-[1.02] shadow-2xl"
            : "shadow-lg transition-[right,top,scale,box-shadow] duration-300 ease-out motion-reduce:transition-none"
        }`}>
        {/* La manija para llevarla a otro lado: seis puntos, tres y tres. */}
        <div className="sticky top-0 z-10 flex justify-end bg-fondo pt-1">
          <button
            type="button"
            onPointerDown={alApretar}
            onKeyDown={alTeclado}
            aria-label={t("vistaMaestra.mover")}
            title={t("vistaMaestra.mover")}
            className="flex h-6 w-8 cursor-grab touch-none items-center justify-center rounded-campo text-tinta-suave hover:bg-superficie hover:text-azul active:cursor-grabbing"
          >
            <span aria-hidden="true" className="leading-none">⋮⋮</span>
          </button>
        </div>
        <ul className="flex flex-col gap-1">{selector.map((n, i) => boton(n, i, false))}</ul>
        {fallo}
      </nav>
      <nav aria-label={t("vistaMaestra.selector")}
        className="sticky top-0 z-30 overflow-x-auto border-b border-borde bg-fondo px-2 py-2 lg:hidden">
        <ul className="flex gap-2">{selector.map((n, i) => boton(n, i, true))}</ul>
        {fallo}
      </nav>
    </>
  );
}
