"use client";

// "Sumarme a un negocio" (SCRUM-34).
//
// Es la otra punta del link de invitación. Se abre en cualquier estado, así
// que la pantalla tiene que explicarse sola: sin cuenta, o con cuenta —con o
// sin negocios—. Sumarse a otro negocio no saca de los que ya se tiene: usar
// el link deja un pedido pendiente hasta que alguien con permiso lo acepta.
//
// Se puede ver a qué negocio te invitan ANTES de crearte la cuenta: crearse
// una cuenta a ciegas sería pedirle a alguien que firme sin leer.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth, recordarInvitacion, olvidarInvitacion } from "@/lib/auth";
import { pedirEntrar } from "@/lib/equipo";
import { useTitulo } from "@/lib/useTitulo";
import { Boton, Campo, Tarjeta, TituloPantalla, Cargando, ErrorGeneral } from "@/componentes/ui";
import Icono from "@/componentes/Icono";

export default function Unirme() {
  const { codigo } = useParams();
  const { sesion, cargando, verInvitacion } = useAuth();
  useTitulo("Sumarte a un negocio");

  const [mirando, setMirando] = useState(true);
  const [invitacion, setInvitacion] = useState(null);
  const [nombre, setNombre] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [pedido, setPedido] = useState(null);
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

  async function pedir() {
    setError(null);
    setEntrando(true);
    const r = await pedirEntrar(codigo, nombre.trim(), sesion?.access_token);
    setEntrando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    olvidarInvitacion();
    setPedido(r);
  }

  if (cargando || mirando) {
    return <Cargando filas={1} />;
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
    <TituloPantalla apoyo={`${invitacion.negocio} te invitó a su equipo.`}>
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

  // Ya pidió entrar: el acceso llega cuando el negocio lo acepte.
  if (pedido) {
    return (
      <>
        {cabecera}
        <Tarjeta>
          <p className="flex items-start gap-2 font-bold text-completo">
            <Icono nombre="listo" className="mt-0.5 size-6" />
            <span>
              {pedido.estado === "ya_estas"
                ? `Ya estás en ${pedido.negocio}.`
                : `Listo. Le avisamos a ${pedido.negocio}: vas a poder entrar cuando te acepten.`}
            </span>
          </p>
          <div className="mt-6">
            <Link href="/negocios" className="inline-flex min-h-12 items-center gap-2 font-bold text-azul">
              <Icono nombre="flecha" />
              Ir a mis negocios
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
          Cuando te acepten, vas a poder ver y trabajar los casos que te asignen.
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
          <ErrorGeneral>{error}</ErrorGeneral>
        )}

        <Boton
          variante="principal"
          icono="check"
          motivo={entrando ? "enviando…" : null}
          onClick={pedir}
          className="min-h-14 w-full"
        >
          Pedir entrar a {invitacion.negocio}
        </Boton>
      </Tarjeta>
    </>
  );
}
