"use client";

// "Iniciar sesión" (SCRUM-9).
//
// Mail y contraseña para entrar a una cuenta ya creada, o la cuenta de
// Google (BotonGoogle). Es también adonde vuelve Google después de entrar.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import { useTitulo } from "@/lib/useTitulo";
import { Boton, Campo, Tarjeta, TituloPantalla, ErrorGeneral } from "@/componentes/ui";
import BotonGoogle, { SeparadorO } from "@/componentes/BotonGoogle";

export default function IniciarSesion() {
  const router = useRouter();
  const { iniciarSesion, haySupabase, hayGoogle } = useAuth();
  const { t } = useIdioma();
  useTitulo(t("acceso.ingreso.titulo"));

  const [email, setEmail] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [verContrasena, setVerContrasena] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState(null);

  const motivo = !email.trim()
    ? t("acceso.ingreso.faltaMail")
    : !contrasena
      ? t("acceso.ingreso.faltaContrasena")
      : enviando
        ? t("acceso.ingreso.entrando")
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
    router.replace("/negocios");
  }

  return (
    <>
      <TituloPantalla apoyo={t("acceso.ingreso.apoyo")}>
        {t("acceso.ingreso.titulo")}
      </TituloPantalla>

      <Tarjeta>
        {hayGoogle && (
          <>
            <BotonGoogle>{t("acceso.ingreso.conGoogle")}</BotonGoogle>
            <SeparadorO />
          </>
        )}

        <Campo
          id="email"
          etiqueta={t("acceso.ingreso.mail")}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={alEscribir(setEmail)}
        />

        <Campo
          id="contrasena"
          etiqueta={t("acceso.ingreso.contrasena")}
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
            {verContrasena ? t("acceso.ingreso.ocultar") : t("acceso.ingreso.mostrar")}
          </button>
          <Link
            href="/recuperar-contrasena"
            className="inline-flex min-h-12 items-center font-bold text-azul"
          >
            {t("acceso.ingreso.olvide")}
          </Link>
        </div>

        {errorGeneral && (
          <ErrorGeneral>{textoDeError(t, errorGeneral)}</ErrorGeneral>
        )}

        <Boton
          variante="principal"
          icono="check"
          motivo={motivo}
          onClick={entrar}
          className="min-h-14 w-full"
        >
          {t("acceso.ingreso.titulo")}
        </Boton>

        {!haySupabase && (
          <p className="mt-6 text-etiqueta text-tinta-media">
            {t("acceso.ingreso.sinApi")}
          </p>
        )}
      </Tarjeta>

      {/* Debajo de la tarjeta y como enlace, no como segundo botón de ancho
          completo: quien viene a entrar a su cuenta no está eligiendo entre
          dos caminos (auditoría, H8). */}
      <p className="mt-6 text-tinta-media">
        {t("acceso.ingreso.sinCuenta")}{" "}
        <Link href="/crear-cuenta" className="font-bold text-azul">
          {t("acceso.ingreso.crearUna")}
        </Link>
        .
      </p>
    </>
  );
}
