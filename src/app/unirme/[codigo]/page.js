"use client";

// "Sumarme a un negocio" (SCRUM-34).
//
// Es la otra punta del link de invitación. Se abre en cualquier estado, así
// que la pantalla tiene que explicarse sola: sin cuenta, con cuenta y sin
// negocio, o con un negocio propio.
//
// Se puede ver a qué negocio te invitan ANTES de crearte la cuenta: crearse
// una cuenta a ciegas sería pedirle a alguien que firme sin leer.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth, recordarInvitacion } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { Boton, Campo, Tarjeta, TituloPantalla } from "@/componentes/ui";
import Icono from "@/componentes/Icono";

export default function Unirme() {
  const { codigo } = useParams();
  const router = useRouter();
  const { sesion, usuario, esDemo, cargando, verInvitacion, aceptarInvitacion } = useAuth();
  useTitulo("Sumarte a un negocio");

  const [mirando, setMirando] = useState(true);
  const [invitacion, setInvitacion] = useState(null);
  const [nombre, setNombre] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await verInvitacion(codigo);
      if (!vivo) return;
      if (!r.ok) setError(r.error);
      else setInvitacion(r);
      setMirando(false);
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo]);

  async function entrar() {
    setError(null);
    setEntrando(true);
    const r = await aceptarInvitacion(codigo, nombre.trim());
    setEntrando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.replace("/");
  }

  if (cargando || mirando) {
    return (
      <Tarjeta>
        <p className="text-tinta-suave" role="status">
          Cargando…
        </p>
      </Tarjeta>
    );
  }

  // El link no sirve: no existe, venció, lo dieron de baja o ya se usó.
  if (!invitacion || !invitacion.sirve) {
    return (
      <>
        <TituloPantalla>Este link no sirve</TituloPantalla>
        <Tarjeta>
          <p className="flex items-start gap-2 font-bold text-espera">
            <Icono nombre="alerta" className="mt-0.5 size-6" />
            <span>{invitacion?.motivo ?? error ?? "No pudimos leer la invitación."}</span>
          </p>
          <p className="mt-2 max-w-[65ch] text-tinta-media">
            Pedile a quien te invitó que te mande uno nuevo.
          </p>
          <div className="mt-6">
            <Link
              href="/iniciar-sesion"
              className="inline-flex min-h-12 items-center gap-2 font-bold text-azul"
            >
              <Icono nombre="volver" />
              Ir a iniciar sesión
            </Link>
          </div>
        </Tarjeta>
      </>
    );
  }

  const cabecera = (
    <TituloPantalla apoyo={`Te invitaron a trabajar en ${invitacion.negocio}.`}>
      Sumarte a {invitacion.negocio}
    </TituloPantalla>
  );

  // Todavía no entró: primero la cuenta, después la invitación.
  if (!sesion) {
    return (
      <>
        {cabecera}
        <Tarjeta>
          <p className="max-w-[65ch] text-tinta-media">
            Para sumarte necesitás tu propia cuenta. Creala y volvés acá solo.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/crear-cuenta"
              onClick={() => recordarInvitacion(codigo)}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-campo bg-azul px-6 font-bold text-cuerpo text-white hover:bg-azul-apretado"
            >
              <Icono nombre="persona-mas" />
              Crear mi cuenta
            </Link>
            <Link
              href="/iniciar-sesion"
              onClick={() => recordarInvitacion(codigo)}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-campo border-2 border-azul bg-tarjeta px-6 font-bold text-cuerpo text-azul hover:bg-azul-claro"
            >
              <Icono nombre="check" />
              Ya tengo cuenta
            </Link>
          </div>
        </Tarjeta>
      </>
    );
  }

  // Modo de ejemplo: no hay cuenta de verdad a la que atar nada.
  if (esDemo) {
    return (
      <>
        {cabecera}
        <Tarjeta>
          <p className="max-w-[65ch] text-tinta-media">
            Estás en el modo de ejemplo. Para sumarte a un negocio de verdad hace falta
            salir y entrar con tu propia cuenta.
          </p>
        </Tarjeta>
      </>
    );
  }

  // Ya tiene un negocio: no se puede estar en dos.
  if (usuario?.negocio_id) {
    return (
      <>
        {cabecera}
        <Tarjeta>
          <p className="max-w-[65ch] text-tinta-media">
            Tu cuenta ya está en un negocio, y por ahora cada cuenta puede estar en uno
            solo. Si querés sumarte a {invitacion.negocio}, pedile a quien te invitó que
            invite a otro mail tuyo.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex min-h-12 items-center gap-2 font-bold text-azul"
            >
              <Icono nombre="volver" />
              Ir a Hoy
            </Link>
          </div>
        </Tarjeta>
      </>
    );
  }

  return (
    <>
      {cabecera}
      <Tarjeta>
        <p className="mb-6 max-w-[65ch] text-tinta-media">
          Vas a poder ver y trabajar los casos de {invitacion.negocio}, y te van a poder
          asignar trabajos.
        </p>

        <Campo
          id="nombre"
          etiqueta="Cómo te van a ver en la lista"
          ayuda="Con tu nombre alcanza. Si lo dejás vacío usamos el de tu mail."
          autoComplete="name"
          value={nombre}
          onChange={(e) => {
            setError(null);
            setNombre(e.target.value);
          }}
        />

        {error && (
          <p className="mb-6 flex items-start gap-2 font-bold text-rojo text-etiqueta">
            <Icono nombre="alerta" className="mt-px size-5" />
            <span>{error}</span>
          </p>
        )}

        <Boton
          variante="principal"
          icono="check"
          motivo={entrando ? "sumándote…" : null}
          onClick={entrar}
          className="min-h-14 w-full"
        >
          Sumarme a {invitacion.negocio}
        </Boton>
      </Tarjeta>
    </>
  );
}
