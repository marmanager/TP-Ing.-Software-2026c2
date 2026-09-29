"use client";

// "¿A qué negocio entrás?" (docs/multinegocio.md).
//
// Aparece al iniciar sesión —con mail, con Google, o al confirmar la cuenta—,
// no cada vez que se abre la aplicación: la Guardia manda acá desde las
// pantallas de entrada. Si la cuenta tiene Inicio rápido con un
// predeterminado suyo, no se muestra: entra y sigue.
//
// Sin ningún negocio va a "Crear tu negocio", que es donde viven el aviso de
// mail recién confirmado y el de invitación pendiente.
//
// El modo de ejemplo tiene un negocio solo y no pasa por acá.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { alEntrar } from "@/lib/entrada";
import { useTitulo } from "@/lib/useTitulo";
import FilaNegocio, { FilaNuevoNegocio } from "@/componentes/FilaNegocio";
import Icono from "@/componentes/Icono";
import { Cargando, ErrorGeneral, TituloPantalla } from "@/componentes/ui";

export default function Negocios() {
  const router = useRouter();
  const { esDemo, usuario, misNegocios, entrarAlNegocio } = useAuth();
  useTitulo("Tus negocios");

  const [negocios, setNegocios] = useState(null);
  const [entrando, setEntrando] = useState(null);
  const [error, setError] = useState(null);

  async function entrar(id) {
    setError(null);
    setEntrando(id);
    // Al negocio en el que ya está no hace falta volver a entrar.
    if (id !== usuario?.negocio_id) {
      const r = await entrarAlNegocio(id);
      if (!r.ok) {
        setEntrando(null);
        setError(r.error);
        return;
      }
    }
    router.replace("/");
  }

  useEffect(() => {
    if (esDemo) {
      router.replace("/");
      return;
    }
    let vivo = true;
    (async () => {
      const r = await misNegocios();
      if (!vivo) return;
      // Sin la 038 corrida no hay lista: se entra al negocio activo, como
      // antes, o a crearlo.
      if (!r.ok) {
        router.replace(usuario?.negocio_id ? "/" : "/crear-negocio");
        return;
      }
      const paso = alEntrar({
        negocios: r.negocios,
        predeterminado: usuario?.negocio_predeterminado,
        inicioRapido: usuario?.inicio_rapido,
      });
      if (paso.ir === "crear") router.replace("/crear-negocio");
      else if (paso.ir === "entrar") entrar(paso.negocio);
      else setNegocios(r.negocios);
    })();
    return () => {
      vivo = false;
    };
    // Una vez, al llegar: es la decisión de recién iniciada la sesión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!negocios) return <Cargando filas={2} />;

  return (
    <>
      <TituloPantalla>¿A qué negocio entrás?</TituloPantalla>

      {error && <ErrorGeneral>{error}</ErrorGeneral>}

      <ul className="grid gap-3">
        {negocios.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              disabled={Boolean(entrando)}
              onClick={() => entrar(n.id)}
              className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-tarjeta border border-borde bg-tarjeta p-4 text-left hover:bg-superficie disabled:cursor-wait"
            >
              <FilaNegocio negocio={n} />
              {entrando === n.id ? (
                <span className="text-tinta-media">Entrando…</span>
              ) : (
                <Icono nombre="flecha" className="shrink-0 text-azul" />
              )}
            </button>
          </li>
        ))}
        <li>
          <FilaNuevoNegocio />
        </li>
      </ul>
    </>
  );
}
