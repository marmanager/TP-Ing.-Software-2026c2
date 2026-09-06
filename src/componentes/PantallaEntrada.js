"use client";

// Marco de las pantallas de entrada (crear cuenta, iniciar sesión, crear
// negocio): una sola columna centrada, sin la navegación del sistema.

import Icono from "./Icono";
import Aviso from "./Aviso";

export default function PantallaEntrada({ children }) {
  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-[440px]">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-campo bg-azul text-white">
            <Icono nombre="tienda" />
          </span>
          <span className="font-titulo font-extrabold text-subtitulo leading-tight">
            Tu negocio, en orden
          </span>
        </div>

        <Aviso />
        {children}

        <p className="mt-10 text-apoyo text-tinta-suave">
          Sistema de gestión de casos para negocios de servicio.
        </p>
      </div>
    </div>
  );
}
