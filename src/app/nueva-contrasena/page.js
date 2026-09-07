"use client";

// "Poner una contraseña nueva" (SCRUM-33).
//
// Se llega desde el enlace del mail de recuperación, que deja abierta una
// sesión corta. Si el enlace venció o alguien entra de prendido, no hay
// sesión y se lo manda a pedir uno nuevo.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { contrasenaValida } from "@/lib/validaciones";
import { Boton, Campo, Tarjeta, TituloPantalla } from "@/componentes/ui";
import Icono from "@/componentes/Icono";

export default function NuevaContrasena() {
  const router = useRouter();
  const { sesion, cargando, definirContrasena } = useAuth();
  const { avisarExito } = useDatos();
  useTitulo("Poner una contraseña nueva");

  const [contrasena, setContrasena] = useState("");
  const [verContrasena, setVerContrasena] = useState(false);
  const [tocado, setTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const errorContrasena =
    tocado && contrasena && !contrasenaValida(contrasena)
      ? "La contraseña necesita al menos 8 caracteres."
      : null;

  const motivo = !contrasena
    ? "falta la contraseña"
    : !contrasenaValida(contrasena)
      ? "la contraseña es muy corta"
      : enviando
        ? "guardando…"
        : null;

  async function guardar() {
    setError(null);
    setEnviando(true);
    const r = await definirContrasena(contrasena);
    setEnviando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    avisarExito("Listo, ya tenés una contraseña nueva.");
    router.replace("/");
  }

  if (cargando) return null;

  if (!sesion) {
    return (
      <>
        <TituloPantalla>Este enlace ya no sirve</TituloPantalla>
        <Tarjeta>
          <p className="max-w-[65ch] text-tinta-media">
            Los enlaces para cambiar la contraseña duran un rato corto. Pedí uno nuevo y
            usalo apenas te llegue.
          </p>
          <div className="mt-6">
            <Link
              href="/recuperar-contrasena"
              className="inline-flex min-h-12 items-center gap-2 font-bold text-azul"
            >
              <Icono nombre="sobre" />
              Pedir un enlace nuevo
            </Link>
          </div>
        </Tarjeta>
      </>
    );
  }

  return (
    <>
      <TituloPantalla apoyo="La vas a usar la próxima vez que entres.">
        Poner una contraseña nueva
      </TituloPantalla>

      <Tarjeta>
        <Campo
          id="contrasena"
          etiqueta="Tu contraseña nueva"
          ayuda="Al menos 8 caracteres."
          error={errorContrasena}
          type={verContrasena ? "text" : "password"}
          autoComplete="new-password"
          value={contrasena}
          onChange={(e) => {
            setError(null);
            setContrasena(e.target.value);
          }}
          onBlur={() => setTocado(true)}
        />
        <button
          type="button"
          onClick={() => setVerContrasena((v) => !v)}
          className="-mt-3 mb-6 inline-flex min-h-12 items-center font-bold text-azul"
        >
          {verContrasena ? "Ocultar la contraseña" : "Mostrar la contraseña"}
        </button>

        {error && (
          <p className="mb-6 flex items-start gap-2 font-bold text-rojo text-etiqueta">
            <Icono nombre="alerta" className="mt-px size-5" />
            <span>{error}</span>
          </p>
        )}

        <Boton
          variante="principal"
          icono="check"
          motivo={motivo}
          onClick={guardar}
          className="min-h-14 w-full"
        >
          Guardar la contraseña
        </Boton>
      </Tarjeta>
    </>
  );
}
