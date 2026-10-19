"use client";

// "Poner una contraseña nueva" (SCRUM-33).
//
// Se llega desde el enlace del mail de recuperación: el de "Me olvidé la
// contraseña" y el de "Cambiar contraseña → Por mail" de Mi perfil (el único
// camino para quien entra sólo con Google). El enlace deja abierta una sesión
// corta y sirve una sola vez: Supabase lo invalida al usarlo. Si venció, ya
// se usó o alguien entra de prendido, no hay sesión y se lo manda a pedir uno
// nuevo. Al guardar, lleva al Inicio.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { contrasenaValida, motivoDeContrasenaNueva } from "@/lib/validaciones";
import { Boton, CampoContrasena, Tarjeta, TituloPantalla, ErrorGeneral } from "@/componentes/ui";
import Icono from "@/componentes/Icono";

export default function NuevaContrasena() {
  const router = useRouter();
  const { sesion, cargando, definirContrasena } = useAuth();
  const { avisarExito } = useDatos();
  useTitulo("Poner una contraseña nueva");

  const [contrasena, setContrasena] = useState("");
  const [repetida, setRepetida] = useState("");
  const [tocado, setTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const errorContrasena =
    tocado && contrasena && !contrasenaValida(contrasena)
      ? "La contraseña necesita al menos 8 caracteres."
      : null;

  // Se pide dos veces, como en Mi perfil: se escribe sin verla.
  const motivo = !contrasena
    ? "falta la contraseña"
    : enviando
      ? "guardando…"
      : motivoDeContrasenaNueva(contrasena, repetida);

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
        <CampoContrasena
          id="contrasena"
          etiqueta="Tu contraseña nueva"
          ayuda="Al menos 8 caracteres."
          error={errorContrasena}
          autoComplete="new-password"
          value={contrasena}
          onChange={(e) => {
            setError(null);
            setContrasena(e.target.value);
          }}
          onBlur={() => setTocado(true)}
        />
        <CampoContrasena
          id="contrasena-repetida"
          etiqueta="Escribila de nuevo"
          error={repetida && contrasena !== repetida ? "Las dos no son iguales." : null}
          exito={repetida && contrasena === repetida ? "Coinciden." : null}
          autoComplete="new-password"
          value={repetida}
          onChange={(e) => {
            setError(null);
            setRepetida(e.target.value);
          }}
        />

        {error && (
          <ErrorGeneral>{error}</ErrorGeneral>
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
