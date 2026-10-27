"use client";

import { useEffect, useRef, useState } from "react";
import { useTitulo } from "@/lib/useTitulo";
import { useIdioma } from "@/lib/useIdioma";
import { nombreDeModulo } from "@/lib/modulos";
import { apilar, COLORES, GROSORES, puntasDeFlecha, radio, rectangulo } from "@/lib/lienzo";
import Icono from "@/componentes/Icono";
import { Boton, Tarjeta, TituloPantalla } from "@/componentes/ui";

const HERRAMIENTAS = ["lapiz", "pincel", "linea", "flecha", "rectangulo", "circulo", "borrador"];
const LIBRES = ["lapiz", "pincel", "borrador"];
const ALTO = 560;

export default function Lienzo() {
  const { t } = useIdioma();
  const [herramienta, setHerramienta] = useState("lapiz");
  const [color, setColor] = useState(COLORES[0]);
  const [grosor, setGrosor] = useState(GROSORES[1]);
  const [hayQueDeshacer, setHayQueDeshacer] = useState(false);
  const canvas = useRef(null);
  // Todo lo del trazo en curso va en una ref: no hace falta volver a pintar React.
  const trazo = useRef({ activo: false, inicio: null, foto: null, puntos: [] });
  const pila = useRef([]);
  useTitulo(nombreDeModulo("lienzo", t));

  const ctx = () => canvas.current.getContext("2d", { willReadFrequently: true });
  const blanco = () => {
    const c = ctx();
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = "#fff";
    c.fillRect(0, 0, canvas.current.width, canvas.current.height);
    c.restore();
  };
  const foto = () => ctx().getImageData(0, 0, canvas.current.width, canvas.current.height);

  // El tamaño se fija una vez al montar, según el ancho disponible y la densidad
  // de píxeles. ponytail: si la ventana cambia de tamaño el lienzo no se
  // reajusta (redimensionar borraría el dibujo); recargar la pantalla lo arregla.
  useEffect(() => {
    const el = canvas.current;
    const dpr = window.devicePixelRatio || 1;
    el.width = Math.round(el.parentElement.clientWidth * dpr);
    el.height = Math.round(ALTO * dpr);
    el.style.height = `${ALTO}px`;
    ctx().scale(dpr, dpr);
    blanco();
  }, []);

  const punto = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const estilo = () => {
    const c = ctx();
    const borrador = herramienta === "borrador";
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = borrador ? "#fff" : color;
    c.lineWidth = borrador ? grosor * 2 : grosor;
    c.globalAlpha = herramienta === "pincel" ? 0.5 : 1;
  };

  const libre = LIBRES.includes(herramienta);

  const dibujarForma = (a, b) => {
    const c = ctx();
    c.beginPath();
    if (herramienta === "rectangulo") {
      const { x, y, w, h } = rectangulo(a, b);
      c.rect(x, y, w, h);
    } else if (herramienta === "circulo") {
      c.arc(a.x, a.y, radio(a, b), 0, Math.PI * 2);
    } else {
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      if (herramienta === "flecha") {
        for (const p of puntasDeFlecha(a, b, grosor)) {
          c.moveTo(b.x, b.y);
          c.lineTo(p.x, p.y);
        }
      }
    }
    c.stroke();
  };

  // El pincel es translúcido: si se pintara tramo a tramo, cada empalme
  // quedaría más oscuro. Por eso repinta el trazo entero sobre la foto del inicio.
  const dibujarLibre = () => {
    const { puntos, foto: base } = trazo.current;
    const c = ctx();
    if (herramienta === "pincel") c.putImageData(base, 0, 0);
    c.beginPath();
    const desde = herramienta === "pincel" ? 0 : Math.max(0, puntos.length - 2);
    c.moveTo(puntos[desde].x, puntos[desde].y);
    for (const p of puntos.slice(desde + 1)) c.lineTo(p.x, p.y);
    if (puntos.length === 1) c.lineTo(puntos[0].x, puntos[0].y); // un toque deja un punto
    c.stroke();
  };

  const empezar = (e) => {
    if (e.button > 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const base = foto();
    pila.current = apilar(pila.current, base);
    setHayQueDeshacer(true);
    const p = punto(e);
    trazo.current = { activo: true, inicio: p, foto: base, puntos: [p] };
    estilo();
    if (libre) dibujarLibre();
  };

  const mover = (e) => {
    const tr = trazo.current;
    if (!tr.activo) return;
    const p = punto(e);
    if (libre) {
      tr.puntos.push(p);
      dibujarLibre();
    } else {
      ctx().putImageData(tr.foto, 0, 0);
      dibujarForma(tr.inicio, p);
    }
  };

  const terminar = () => {
    trazo.current.activo = false;
    ctx().globalAlpha = 1;
  };

  const deshacer = () => {
    const ultima = pila.current.at(-1);
    if (!ultima) return;
    ctx().putImageData(ultima, 0, 0);
    pila.current = pila.current.slice(0, -1);
    setHayQueDeshacer(pila.current.length > 0);
  };

  const limpiar = () => {
    pila.current = apilar(pila.current, foto());
    setHayQueDeshacer(true);
    blanco();
  };

  const descargar = () =>
    canvas.current.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = t("lienzo.archivo");
      a.click();
      URL.revokeObjectURL(a.href);
    });

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <TituloPantalla apoyo={t("lienzo.apoyo")}>{nombreDeModulo("lienzo", t)}</TituloPantalla>

      <Tarjeta className="mb-4 space-y-4">
        <div role="group" aria-label={t("lienzo.herramientas")} className="flex flex-wrap gap-2">
          {HERRAMIENTAS.map((h) => (
            <button
              key={h}
              type="button"
              aria-label={t(`lienzo.${h}`)}
              aria-pressed={herramienta === h}
              title={t(`lienzo.${h}`)}
              onClick={() => setHerramienta(h)}
              className={`flex size-12 cursor-pointer items-center justify-center rounded-campo border-2 ${herramienta === h ? "border-azul bg-azul-claro text-azul" : "border-borde-fuerte bg-tarjeta text-tinta hover:bg-superficie"}`}
            >
              <Icono nombre={h} className="size-7" />
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div role="group" aria-label={t("lienzo.color")} className="flex flex-wrap items-center gap-2">
            {COLORES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={t("lienzo.colorN", { color: c })}
                aria-pressed={color === c}
                title={c}
                onClick={() => setColor(c)}
                style={{ background: c }}
                className={`size-12 cursor-pointer rounded-full border-2 ${color === c ? "border-tinta ring-2 ring-azul ring-offset-2" : "border-borde-fuerte"}`}
              />
            ))}
            <label className="ml-1 flex items-center gap-2 font-bold">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="size-12 cursor-pointer rounded-campo border-2 border-borde-fuerte bg-tarjeta p-1" />
              {t("lienzo.otroColor")}
            </label>
          </div>

          <div role="group" aria-label={t("lienzo.grosor")} className="flex items-center gap-2">
            {GROSORES.map((g, i) => (
              <button
                key={g}
                type="button"
                aria-label={t("lienzo.grosorN", { n: i + 1 })}
                aria-pressed={grosor === g}
                title={t("lienzo.grosorN", { n: i + 1 })}
                onClick={() => setGrosor(g)}
                className={`flex size-12 cursor-pointer items-center justify-center rounded-campo border-2 ${grosor === g ? "border-azul bg-azul-claro" : "border-borde-fuerte bg-tarjeta"}`}
              >
                <span className="rounded-full bg-tinta" style={{ width: g + 4, height: g + 4 }} />
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Boton variante="neutro" icono="deshacer" onClick={deshacer} disabled={!hayQueDeshacer}>{t("lienzo.deshacer")}</Boton>
          <Boton variante="peligro" icono="tacho" onClick={limpiar}>{t("lienzo.limpiar")}</Boton>
          <Boton variante="principal" onClick={descargar}>{t("lienzo.descargar")}</Boton>
        </div>
      </Tarjeta>

      <div className="overflow-hidden rounded-campo border-2 border-borde-fuerte bg-white">
        <canvas
          ref={canvas}
          role="img"
          aria-label={t("lienzo.area")}
          className="block w-full cursor-crosshair"
          style={{ touchAction: "none" }}
          onPointerDown={empezar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerCancel={terminar}
        />
      </div>
    </main>
  );
}
