"use client";

// Ancho de una barra lateral que se cambia arrastrando su borde (o con las
// flechas, con el foco en el borde). Se recuerda en el navegador, por barra.
//
// lado: de qué lado de la barra está el borde. "derecha" para la barra de la
// izquierda (arrastrar a la derecha la agranda), "izquierda" para el panel de
// la derecha (arrastrar a la izquierda lo agranda).

import { useEffect, useState } from "react";

export function useAnchoDeBarra(llave, inicial, minimo, maximo) {
  const [ancho, setAncho] = useState(inicial);

  // Se lee después de montar: en el servidor no hay localStorage.
  useEffect(() => {
    try {
      const guardado = Number(window.localStorage.getItem(llave));
      if (guardado) setAncho(Math.min(maximo, Math.max(minimo, guardado)));
    } catch {
      // Sin almacenamiento arranca con el ancho de siempre.
    }
  }, [llave, minimo, maximo]);

  const cambiar = (nuevo) => {
    const acotado = Math.round(Math.min(maximo, Math.max(minimo, nuevo)));
    setAncho(acotado);
    try {
      window.localStorage.setItem(llave, String(acotado));
    } catch {
      // Si no se puede guardar, igual cambia; sólo no se recuerda.
    }
  };

  return [ancho, cambiar];
}

export default function BordeParaAchicar({ ancho, cambiar, lado, etiqueta, minimo, maximo }) {
  const signo = lado === "derecha" ? 1 : -1;

  const alApretar = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const desde = e.clientX;
    const anchoAlEmpezar = ancho;
    // Mientras se arrastra, el cursor y la selección de texto son del borde
    // en toda la pantalla, aunque el mouse se salga de la línea.
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const mover = (ev) => cambiar(anchoAlEmpezar + signo * (ev.clientX - desde));
    const soltar = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };

  const alTeclado = (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    cambiar(ancho + (e.key === "ArrowRight" ? 16 : -16) * signo);
  };

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
      className={`absolute top-0 z-10 hidden h-full w-2 cursor-col-resize hover:bg-azul/40 focus-visible:bg-azul/40 focus-visible:outline-none md:block ${
        // El panel de la derecha recorta lo que se sale: ahí va por adentro.
        lado === "derecha" ? "-right-1" : "left-0"
      }`}
    />
  );
}
