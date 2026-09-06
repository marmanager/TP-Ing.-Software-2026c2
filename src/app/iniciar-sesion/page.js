"use client";

// "Iniciar sesión" (SCRUM-9).
//
// Mail y contraseña para entrar a una cuenta ya creada. Aparte queda la vía
// de escape: recorrer el sistema con los datos de ejemplo, sin contraseña.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { Boton, Campo, Tarjeta, TituloPantalla } from "@/componentes/ui";
import Icono from "@/componentes/Icono";

export default function IniciarSesion() {
  const router = useRouter();
  const { iniciarSesion, entrarComoDemo, haySupabase } = useAuth();
  useTitulo("Iniciar sesión");

  const [email, setEmail] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [verContrasena, setVerContrasena] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState(null);

  const motivo = !email.trim()
    ? "falta el mail"
    : !contrasena
      ? "falta la contraseña"
      : enviando
        ? "entrando…"
        : null;

  const alEscribir = (set) => (e) => {
    setErrorGeneral(null);
    set(e.target.value);
  };

  async function entrar() {
    setErrorGeneral(null);
    setEnviando(true);
    const r = await iniciarSesion({ email, contrasena });
    setEnviando(false);
    if (!r.ok) {
      setErrorGeneral(r.error);
      return;
    }
    router.replace("/");
  }

  function verEjemplo() {
    entrarComoDemo();
    router.replace("/");
  }

  return (
    <>
      <TituloPantalla apoyo="Entrá para ver los casos de tu negocio.">
        Iniciar sesión
      </TituloPantalla>

      <Tarjeta>
        <Campo
          id="email"
          etiqueta="Tu mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={alEscribir(setEmail)}
        />

        <Campo
          id="contrasena"
          etiqueta="Tu contraseña"
          type={verContrasena ? "text" : "password"}
          autoComplete="current-password"
          value={contrasena}
          onChange={alEscribir(setContrasena)}
        />
        <div className="-mt-3 mb-6 flex flex-wrap items-center justify-between gap-x-4">
          <button
            type="button"
            onClick={() => setVerContrasena((v) => !v)}
            className="inline-flex min-h-12 items-center font-bold text-azul"
          >
            {verContrasena ? "Ocultar la contraseña" : "Mostrar la contraseña"}
          </button>
          <Link
            href="/recuperar-contrasena"
            className="inline-flex min-h-12 items-center font-bold text-azul"
          >
            Me olvidé la contraseña
          </Link>
        </div>

        {errorGeneral && (
          <p className="mb-6 flex items-start gap-2 font-bold text-rojo text-etiqueta">
            <Icono nombre="alerta" className="mt-px size-5" />
            <span>{errorGeneral}</span>
          </p>
        )}

        <Boton
          variante="principal"
          icono="check"
          motivo={motivo}
          onClick={entrar}
          className="min-h-14 w-full"
        >
          Iniciar sesión
        </Boton>

        <p className="mt-6 text-apoyo text-tinta-suave">
          {haySupabase
            ? "¿Solo querés recorrer el sistema?"
            : "Todavía no hay una base de Supabase conectada. Podés recorrer todo el sistema con los datos de ejemplo."}
        </p>
        <div className="mt-2">
          <Boton icono="tienda" onClick={verEjemplo} className="w-full">
            Entrar con los datos de ejemplo
          </Boton>
        </div>
      </Tarjeta>

      <p className="mt-6 text-tinta-media">
        ¿No tenés cuenta?{" "}
        <Link href="/crear-cuenta" className="font-bold text-azul">
          Creá una
        </Link>
        .
      </p>
    </>
  );
}
