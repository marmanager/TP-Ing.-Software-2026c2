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
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import { useDatos } from "@/lib/datos";
import { useTitulo } from "@/lib/useTitulo";
import { contrasenaValida, motivoDeContrasenaNueva } from "@/lib/validaciones";
import { Boton, CampoContrasena, Tarjeta, TituloPantalla, ErrorGeneral } from "@/componentes/ui";
import Icono from "@/componentes/Icono";

export default function NuevaContrasena() {
  const router = useRouter();
  const { sesion, cargando, definirContrasena } = useAuth();
  const { t } = useIdioma();
  const { avisarExito } = useDatos();
  useTitulo(t("acceso.nueva.titulo"));

  const [contrasena, setContrasena] = useState("");
  const [repetida, setRepetida] = useState("");
  const [tocado, setTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const errorContrasena =
    tocado && contrasena && !contrasenaValida(contrasena)
      ? t("acceso.contrasenaCorta")
      : null;

  // Se pide dos veces, como en Mi perfil: se escribe sin verla.
  const motivo = !contrasena
    ? t("acceso.nueva.faltaContrasena")
    : enviando
      ? t("acceso.nueva.guardando")
      : motivoDeContrasenaNueva(contrasena, repetida, t);

  async function guardar() {
    setError(null);
    setEnviando(true);
    const r = await definirContrasena(contrasena);
    setEnviando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    avisarExito(t("acceso.nueva.exito"));
    router.replace("/");
  }

  if (cargando) return null;

  if (!sesion) {
    return (
      <>
        <TituloPantalla>{t("acceso.nueva.vencido.titulo")}</TituloPantalla>
        <Tarjeta>
          <p className="max-w-[65ch] text-tinta-media">
            {t("acceso.nueva.vencido.texto")}
          </p>
          <div className="mt-6">
            <Link
              href="/recuperar-contrasena"
              className="inline-flex min-h-12 items-center gap-2 font-bold text-azul"
            >
              <Icono nombre="sobre" />
              {t("acceso.nueva.vencido.pedir")}
            </Link>
          </div>
        </Tarjeta>
      </>
    );
  }

  return (
    <>
      <TituloPantalla apoyo={t("acceso.nueva.apoyo")}>
        {t("acceso.nueva.titulo")}
      </TituloPantalla>

      <Tarjeta>
        <CampoContrasena
          id="contrasena"
          etiqueta={t("acceso.nueva.contrasena")}
          ayuda={t("acceso.nueva.ayuda")}
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
          etiqueta={t("acceso.nueva.repetida")}
          error={repetida && contrasena !== repetida ? t("acceso.nueva.noIguales") : null}
          exito={repetida && contrasena === repetida ? t("acceso.nueva.coinciden") : null}
          autoComplete="new-password"
          value={repetida}
          onChange={(e) => {
            setError(null);
            setRepetida(e.target.value);
          }}
        />

        {error && (
          <ErrorGeneral>{textoDeError(t, error)}</ErrorGeneral>
        )}

        <Boton
          variante="principal"
          icono="check"
          motivo={motivo}
          onClick={guardar}
          className="min-h-14 w-full"
        >
          {t("acceso.nueva.boton")}
        </Boton>
      </Tarjeta>
    </>
  );
}
