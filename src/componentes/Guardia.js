"use client";

// Guardia de rutas (SCRUM-5).
//
// Decide, según el estado de la sesión, si se ve una pantalla de entrada o el
// sistema completo con su navegación, y manda a la persona a donde corresponde:
//   sin entrar            -> /iniciar-sesion
//   entró, falta confirmar -> /confirma-tu-mail
//   entró, sin negocio     -> /crear-negocio
//   entró y con negocio    -> el sistema

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { BarraLateral, BarraCelular } from "./Navegacion";
import PantallaEntrada from "./PantallaEntrada";
import Aviso from "./Aviso";

const RUTAS_ENTRADA = [
  "/iniciar-sesion",
  "/crear-cuenta",
  "/recuperar-contrasena",
  "/nueva-contrasena",
];
const RUTA_NEGOCIO = "/crear-negocio";
const RUTA_CONFIRMAR = "/confirma-tu-mail";

export default function Guardia({ children }) {
  const { cargando, esDemo, sesion, usuario, necesitaConfirmarMail, recuperando } = useAuth();
  const ruta = usePathname();
  const router = useRouter();

  const hayEntrada = esDemo || Boolean(sesion);
  const tieneNegocio = esDemo || Boolean(usuario?.negocio_id);

  // A dónde tendría que estar parada la persona según su estado.
  let destino = null;
  if (!cargando) {
    if (!hayEntrada) {
      if (!RUTAS_ENTRADA.includes(ruta)) destino = "/iniciar-sesion";
    } else if (recuperando && ruta === "/nueva-contrasena") {
      destino = null;
    } else if (!esDemo && necesitaConfirmarMail) {
      if (ruta !== RUTA_CONFIRMAR) destino = RUTA_CONFIRMAR;
    } else if (!tieneNegocio) {
      if (ruta !== RUTA_NEGOCIO) destino = RUTA_NEGOCIO;
    } else if (
      RUTAS_ENTRADA.includes(ruta) ||
      ruta === RUTA_NEGOCIO ||
      ruta === RUTA_CONFIRMAR
    ) {
      destino = "/";
    }
  }

  useEffect(() => {
    if (destino && destino !== ruta) router.replace(destino);
  }, [destino, ruta, router]);

  if (cargando || (destino && destino !== ruta)) {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-tinta-suave"
        role="status"
      >
        Cargando…
      </div>
    );
  }

  const enEntrada =
    !hayEntrada ||
    (!esDemo && necesitaConfirmarMail) ||
    !tieneNegocio ||
    RUTAS_ENTRADA.includes(ruta) ||
    ruta === RUTA_NEGOCIO ||
    ruta === RUTA_CONFIRMAR;

  if (enEntrada) return <PantallaEntrada>{children}</PantallaEntrada>;

  return (
    <>
      <div className="flex min-h-screen">
        <BarraLateral />
        <main className="min-w-0 flex-1 pb-20 md:pb-0">
          <div className="mx-auto w-full max-w-hoja px-4 py-6 sm:px-6 sm:py-8">
            <Aviso />
            {children}
          </div>
        </main>
      </div>
      <BarraCelular />
    </>
  );
}
