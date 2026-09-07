"use client";

// "Confirmá tu mail" (SCRUM-28).
//
// Se llega acá después de crear la cuenta, cuando el proyecto de Supabase
// pide confirmar el mail. El enlace del mail vuelve solo a la aplicación y
// deja la sesión abierta, así que acá sólo hay que esperar — y poder pedir
// el mail de nuevo si no llegó.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, mailAConfirmar } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { Boton, Tarjeta, TituloPantalla } from "@/componentes/ui";
import Icono from "@/componentes/Icono";

export default function ConfirmaTuMail() {
  const { sesion, reenviarConfirmacion } = useAuth();
  useTitulo("Confirmá tu mail");

  const [mail, setMail] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [reenviado, setReenviado] = useState(false);
  const [error, setError] = useState(null);

  // El mail sale de la sesión si la hay, y si no de lo que guardó el alta.
  useEffect(() => {
    setMail(sesion?.user?.email ?? mailAConfirmar());
  }, [sesion]);

  async function reenviar() {
    if (!mail) return;
    setError(null);
    setEnviando(true);
    const r = await reenviarConfirmacion(mail);
    setEnviando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setReenviado(true);
  }

  return (
    <>
      <TituloPantalla apoyo="Falta un paso y ya entrás.">Confirmá tu mail</TituloPantalla>

      <Tarjeta>
        <p className="flex items-start gap-2 font-bold text-completo">
          <Icono nombre="sobre" className="mt-0.5 size-6" />
          <span>
            {mail
              ? `Te mandamos un mail a ${mail}.`
              : "Te mandamos un mail para confirmar la cuenta."}
          </span>
        </p>
        <p className="mt-2 max-w-[65ch] text-tinta-media">
          Abrilo y tocá el enlace. Con eso entrás directo y seguís con el nombre de tu
          negocio.
        </p>
        <p className="mt-2 max-w-[65ch] text-tinta-media">
          Si no aparece en unos minutos, fijate en la carpeta de correo no deseado.
        </p>

        {reenviado && (
          <p className="mt-4 flex items-start gap-2 font-bold text-completo text-etiqueta">
            <Icono nombre="listo" className="mt-px size-5" />
            <span>Listo, te lo mandamos de nuevo. Puede tardar un par de minutos.</span>
          </p>
        )}

        {error && (
          <p className="mt-4 flex items-start gap-2 font-bold text-rojo text-etiqueta">
            <Icono nombre="alerta" className="mt-px size-5" />
            <span>{error}</span>
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Boton
            icono="sobre"
            onClick={reenviar}
            motivo={!mail ? "no sabemos a qué mail" : enviando ? "mandando…" : null}
          >
            Mandármelo de nuevo
          </Boton>
        </div>
      </Tarjeta>

      <p className="mt-6 text-tinta-media">
        ¿Ya lo confirmaste?{" "}
        <Link href="/iniciar-sesion" className="font-bold text-azul">
          Iniciá sesión
        </Link>
        .
      </p>
    </>
  );
}
