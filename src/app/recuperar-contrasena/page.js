"use client";

// "Me olvidé la contraseña" (SCRUM-13).
//
// Se pide el mail y sale un enlace para poner una contraseña nueva. La
// respuesta es siempre la misma exista o no la cuenta: si dijéramos "ese
// mail no está", cualquiera podría averiguar quién tiene cuenta.

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { emailValido } from "@/lib/validaciones";
import { Boton, Campo, Tarjeta, TituloPantalla } from "@/componentes/ui";
import Icono from "@/componentes/Icono";

export default function RecuperarContrasena() {
  const { pedirResetContrasena } = useAuth();
  useTitulo("Recuperar la contraseña");

  const [email, setEmail] = useState("");
  const [tocado, setTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mandado, setMandado] = useState(false);
  const [error, setError] = useState(null);

  const errorEmail =
    tocado && email.trim() && !emailValido(email)
      ? "Ese mail no tiene forma de mail."
      : null;

  const motivo = !email.trim()
    ? "falta el mail"
    : !emailValido(email)
      ? "el mail no tiene forma de mail"
      : enviando
        ? "mandando…"
        : null;

  async function mandar() {
    setError(null);
    setEnviando(true);
    const r = await pedirResetContrasena(email);
    setEnviando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setMandado(true);
  }

  if (mandado) {
    return (
      <>
        <TituloPantalla apoyo="Fijate en tu mail.">Te mandamos el enlace</TituloPantalla>
        <Tarjeta>
          <p className="flex items-start gap-2 font-bold text-completo">
            <Icono nombre="sobre" className="mt-0.5 size-6" />
            <span>
              Si hay una cuenta con {email.trim()}, te va a llegar un enlace para poner
              una contraseña nueva.
            </span>
          </p>
          <p className="mt-2 max-w-[65ch] text-tinta-media">
            El enlace dura un rato corto. Si no aparece en unos minutos, fijate en la
            carpeta de correo no deseado.
          </p>
          <div className="mt-6">
            <Link
              href="/iniciar-sesion"
              className="inline-flex min-h-12 items-center gap-2 font-bold text-azul"
            >
              <Icono nombre="volver" />
              Volver a iniciar sesión
            </Link>
          </div>
        </Tarjeta>
      </>
    );
  }

  return (
    <>
      <TituloPantalla apoyo="Te mandamos un enlace para poner una nueva.">
        Recuperar la contraseña
      </TituloPantalla>

      <Tarjeta>
        <Campo
          id="email"
          etiqueta="Tu mail"
          ayuda="El mismo con el que entrás."
          error={errorEmail}
          ejemplo="nombre@taller.com"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setError(null);
            setEmail(e.target.value);
          }}
          onBlur={() => setTocado(true)}
        />

        {error && (
          <p className="mb-6 flex items-start gap-2 font-bold text-rojo text-etiqueta">
            <Icono nombre="alerta" className="mt-px size-5" />
            <span>{error}</span>
          </p>
        )}

        <Boton
          variante="principal"
          icono="sobre"
          motivo={motivo}
          onClick={mandar}
          className="min-h-14 w-full"
        >
          Mandarme el enlace
        </Boton>
      </Tarjeta>

      <p className="mt-6 text-tinta-media">
        ¿Te acordaste?{" "}
        <Link href="/iniciar-sesion" className="font-bold text-azul">
          Iniciá sesión
        </Link>
        .
      </p>
    </>
  );
}
