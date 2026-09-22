"use client";

// "Entrar con Google": la otra puerta de entrada, al lado de mail y
// contraseña. Va en Iniciar sesión y en Crear cuenta, porque con Google es
// la misma acción: si la cuenta no existe, se crea.
//
// No es azul: el azul de esas pantallas es el de mail y contraseña, y la
// cartilla pide uno solo por pantalla. Lleva la "G" de Google porque es lo
// que la gente reconoce, y siempre con la palabra al lado (cartilla, 06).
//
// Además del botón, muestra el error si Google devolvió a la persona sin
// dejarla entrar (canceló, o el ingreso no está activado en Supabase).

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { errorDelIngreso } from "@/lib/ingreso-google";
import { ErrorGeneral } from "@/componentes/ui";

export default function BotonGoogle({ children = "Entrar con Google" }) {
  const { entrarConGoogle, hayGoogle } = useAuth();
  const [saliendo, setSaliendo] = useState(false);
  const [error, setError] = useState(null);

  // El error de la vuelta viene en la dirección: se lee una vez y se saca,
  // para que recargar la página no lo vuelva a mostrar.
  useEffect(() => {
    const deLaVuelta = errorDelIngreso(window.location.href);
    if (!deLaVuelta) return;
    setError(deLaVuelta);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  // Sin Google activado en Supabase, el botón llevaría a una página de error.
  // El error de la vuelta sí se muestra igual, si lo hubo.
  if (!hayGoogle) return error ? <ErrorGeneral>{error}</ErrorGeneral> : null;

  return (
    <div>
      {error && <ErrorGeneral>{error}</ErrorGeneral>}
      <button
        type="button"
        disabled={saliendo}
        onClick={async () => {
          setError(null);
          setSaliendo(true);
          const r = await entrarConGoogle();
          // Si salió bien, el navegador ya se está yendo a Google.
          if (!r.ok) {
            setSaliendo(false);
            setError(r.error);
          }
        }}
        className="flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-campo border-2 border-borde-fuerte bg-tarjeta px-4 font-bold text-cuerpo text-tinta hover:bg-superficie disabled:cursor-wait disabled:text-tinta-suave"
      >
        <LogoGoogle />
        <span>
          {children}
          {saliendo && <span className="font-normal"> · abriendo Google…</span>}
        </span>
      </button>
    </div>
  );
}

// La "G" de Google, con sus colores. Decorativa: el texto del botón ya dice
// qué hace.
function LogoGoogle() {
  return (
    <svg viewBox="0 0 48 48" className="size-6 shrink-0" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

// La raya con la "o" entre las dos formas de entrar.
export function SeparadorO({ children = "o con tu mail" }) {
  return (
    <div className="my-6 flex items-center gap-3 text-tinta-media" role="separator">
      <span className="h-px flex-1 bg-borde" aria-hidden="true" />
      <span>{children}</span>
      <span className="h-px flex-1 bg-borde" aria-hidden="true" />
    </div>
  );
}
