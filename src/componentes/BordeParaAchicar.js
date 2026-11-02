"use client";

// Ancho de una barra lateral que se cambia arrastrando su borde (o con las
// flechas, con el foco en el borde). Se recuerda en el navegador, por barra.
//
// El ancho vive en una variable CSS de la barra ("variable", sin unidad).
// Mientras se arrastra se escribe directo en esa variable, sin pasar por
// React: así la barra sigue al mouse cuadro a cuadro, sin re-dibujar toda la
// lista en cada movimiento. Al soltar se guarda.
//
// lado: de qué lado de la barra está el borde. "derecha" para la barra de la
// izquierda (arrastrar a la derecha la agranda), "izquierda" para el panel de
// la derecha (arrastrar a la izquierda lo agranda).

import { useEffect, useState } from "react";

const acotar = (n, minimo, maximo) => Math.round(Math.min(maximo, Math.max(minimo, n)));

export function useAnchoDeBarra(llave, inicial, minimo, maximo) {
  const [ancho, setAncho] = useState(inicial);

  // Se lee después de montar: en el servidor no hay localStorage.
  useEffect(() => {
    try {
      const guardado = Number(window.localStorage.getItem(llave));
      if (guardado) setAncho(acotar(guardado, minimo, maximo));
    } catch {
      // Sin almacenamiento arranca con el ancho de siempre.
    }
  }, [llave, minimo, maximo]);

  const cambiar = (nuevo) => {
    const acotado = acotar(nuevo, minimo, maximo);
    setAncho(acotado);
    try {
      window.localStorage.setItem(llave, String(acotado));
    } catch {
      // Si no se puede guardar, igual cambia; sólo no se recuerda.
    }
  };

  return [ancho, cambiar];
}

export default function BordeParaAchicar({ barra, variable, ancho, cambiar, lado, etiqueta, minimo, maximo }) {
  const [arrastrando, setArrastrando] = useState(false);
  const signo = lado === "derecha" ? 1 : -1;

  const alApretar = (e) => {
    if (e.button !== 0 || !barra.current) return;
    e.preventDefault();
    const elemento = barra.current;
    const desde = e.clientX;
    let ultimo = ancho;
    setArrastrando(true);
    // Mientras se arrastra, el cursor y la selección de texto son del borde
    // en toda la pantalla, aunque el mouse se salga de la línea.
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const mover = (ev) => {
      ultimo = acotar(ancho + signo * (ev.clientX - desde), minimo, maximo);
      elemento.style.setProperty(variable, String(ultimo));
    };
    const soltar = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      setArrastrando(false);
      cambiar(ultimo);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };

  const alTeclado = (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    cambiar(ancho + (e.key === "ArrowRight" ? 16 : -16) * signo);
  };

  // Una franja invisible para agarrar, y adentro una línea fina sobre el
  // borde que aparece al pasar el mouse (con un respiro, para que no titile
  // al cruzarla de paso) y se pone azul mientras se arrastra.
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={etiqueta}
      aria-valuenow={ancho}
      aria-valuemin={minimo}
      aria-valuemax={maximo}
      tabIndex={0}
      onPointerDown={alApretar}
      onKeyDown={alTeclado}
      className={`group absolute top-0 z-10 hidden h-full w-3 cursor-col-resize focus-visible:outline-none md:block ${
        // El panel de la derecha recorta lo que se sale: ahí va por adentro.
        lado === "derecha" ? "-right-1.5" : "left-0"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 w-0.5 transition-[opacity,background-color] duration-150 ${
          lado === "derecha" ? "left-1/2 -translate-x-1/2" : "left-0"
        } ${
          arrastrando
            ? "bg-azul opacity-100"
            : "bg-borde-fuerte opacity-0 group-hover:opacity-100 group-hover:delay-200 group-focus-visible:bg-azul group-focus-visible:opacity-100"
        }`}
      />
    </div>
  );
}
