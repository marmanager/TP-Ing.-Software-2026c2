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

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, invitacionPendiente, olvidarInvitacion } from "@/lib/auth";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import { alEntrar } from "@/lib/entrada";
import { misPedidos } from "@/lib/equipo";
import { useTitulo } from "@/lib/useTitulo";
import FilaNegocio, { FilaNuevoNegocio } from "@/componentes/FilaNegocio";
import Icono from "@/componentes/Icono";
import { Boton, Cargando, ErrorGeneral, Tarjeta, TituloPantalla } from "@/componentes/ui";

export default function Negocios() {
  const router = useRouter();
  const { usuario, sesion, misNegocios, entrarAlNegocio } = useAuth();
  const { t } = useIdioma();
  useTitulo(t("acceso.negocios.titulo"));

  const [negocios, setNegocios] = useState(null);
  const [entrando, setEntrando] = useState(null);
  const [error, setError] = useState(null);
  const [invitacion, setInvitacion] = useState(null);
  const [esperando, setEsperando] = useState([]);

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
    let vivo = true;
    (async () => {
      // Los negocios a los que pidió entrar y todavía no lo aceptaron, en
      // paralelo con la lista para no sumar una ida y vuelta.
      const [r, p] = await Promise.all([misNegocios(), misPedidos(sesion?.access_token)]);
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
      setEsperando(p.ok ? p.pedidos : []);
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
      <TituloPantalla>{t("acceso.negocios.encabezado")}</TituloPantalla>

      {error && <ErrorGeneral>{textoDeError(t, error)}</ErrorGeneral>}

      {esperando.length > 0 && (
        <Tarjeta className="mb-6">
          <p className="flex items-start gap-2 font-bold text-cuerpo">
            <Icono nombre="reloj" className="mt-0.5 size-6" />
            <span>{t("acceso.negocios.esperando", { negocios: esperando.map((p) => p.negocio_nombre).join(", ") })}</span>
          </p>
        </Tarjeta>
      )}

      {/* "Ahora no" la olvida: una invitación vieja no puede frenar para
          siempre el Inicio rápido. */}
      {invitacion && (
        <Tarjeta className="mb-6">
          <p className="flex items-start gap-2 font-bold text-cuerpo">
            <Icono nombre="personas" className="mt-0.5 size-6" />
            <span>{t("acceso.negocios.venias")}</span>
          </p>
          <p className="mt-2 max-w-[65ch] text-tinta-media">
            {t("acceso.negocios.invitacionTexto")}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href={`/unirme/${invitacion}`}
              className="inline-flex min-h-12 items-center gap-2 font-bold text-azul"
            >
              <Icono nombre="flecha" />
              {t("acceso.negocios.irAlLink")}
            </Link>
            <Boton
              variante="plano"
              onClick={() => {
                olvidarInvitacion();
                setInvitacion(null);
              }}
            >
              {t("acceso.negocios.ahoraNo")}
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
                <span className="text-tinta-media">{t("acceso.negocios.entrando")}</span>
              ) : (
                <Icono nombre="flecha" className="size-6 text-azul" />
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
