"use client";

// "¿A qué negocio entrás?" (docs/multinegocio.md).
//
// Aparece al iniciar sesión —con mail, con Google, o al confirmar la cuenta—,
// no cada vez que se abre la aplicación: la Guardia manda acá desde las
// pantallas de entrada. Si la cuenta tiene Inicio rápido con un
// predeterminado suyo, no se muestra: entra y sigue —salvo que haya una
// invitación pendiente, que se ofrece arriba de la lista.
//
// Sin ningún negocio va a "Crear tu negocio", que es donde viven el aviso de
// mail recién confirmado y el de invitación pendiente.
//
// El modo de ejemplo tiene un negocio solo y no pasa por acá.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, invitacionPendiente, olvidarInvitacion } from "@/lib/auth";
import { alEntrar } from "@/lib/entrada";
import { useTitulo } from "@/lib/useTitulo";
import FilaNegocio, { FilaNuevoNegocio } from "@/componentes/FilaNegocio";
import Icono from "@/componentes/Icono";
import { Boton, Cargando, ErrorGeneral, Tarjeta, TituloPantalla } from "@/componentes/ui";

export default function Negocios() {
  const router = useRouter();
  const { esDemo, usuario, misNegocios, entrarAlNegocio } = useAuth();
  useTitulo("Tus negocios");

  const [negocios, setNegocios] = useState(null);
  const [entrando, setEntrando] = useState(null);
  const [error, setError] = useState(null);
  const [invitacion, setInvitacion] = useState(null);

  async function entrar(id) {
    setError(null);
    setEntrando(id);
    // Al negocio en el que ya está no hace falta volver a entrar.
    if (id !== usuario?.negocio_id) {
      const r = await entrarAlNegocio(id);
      if (!r.ok) {
        setEntrando(null);
        setError(r.error);
        return false;
      }
    }
    router.replace("/");
    return true;
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
      // Quien llegó por una invitación y ya tenía negocios no puede entrar
      // directo: la invitación se perdería en silencio. Se muestra la lista,
      // con la invitación arriba.
      const pendiente = invitacionPendiente();
      setInvitacion(pendiente);
      if (paso.ir === "crear") router.replace("/crear-negocio");
      else if (paso.ir === "entrar" && !pendiente) {
        // Si entrar directo falla, se muestra la lista con el error: sin esto
        // quedaba el "Cargando" para siempre y el error no se veía.
        if (!(await entrar(paso.negocio)) && vivo) setNegocios(r.negocios);
      } else setNegocios(r.negocios);
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

      {/* "Ahora no" la olvida: una invitación vieja no puede frenar para
          siempre el Inicio rápido. */}
      {invitacion && (
        <Tarjeta className="mb-6">
          <p className="flex items-start gap-2 font-bold text-cuerpo">
            <Icono nombre="personas" className="mt-0.5 size-6" />
            <span>¿Venías por una invitación?</span>
          </p>
          <p className="mt-2 max-w-[65ch] text-tinta-media">
            Tenés una invitación pendiente. Podés sumarte ahora, y tus otros negocios
            siguen estando.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href={`/unirme/${invitacion}`}
              className="inline-flex min-h-12 items-center gap-2 font-bold text-azul"
            >
              <Icono nombre="flecha" />
              Ir a la invitación
            </Link>
            <Boton
              variante="plano"
              onClick={() => {
                olvidarInvitacion();
                setInvitacion(null);
              }}
            >
              Ahora no
            </Boton>
          </div>
        </Tarjeta>
      )}

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
