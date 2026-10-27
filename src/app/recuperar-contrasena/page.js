"use client";

// "Me olvidé la contraseña" (SCRUM-13).
//
// Se pide el mail y sale un enlace para poner una contraseña nueva. La
// respuesta es siempre la misma exista o no la cuenta: si dijéramos "ese
// mail no está", cualquiera podría averiguar quién tiene cuenta.

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import { useTitulo } from "@/lib/useTitulo";
import { emailValido } from "@/lib/validaciones";
import { Boton, Campo, Tarjeta, TituloPantalla, ErrorGeneral } from "@/componentes/ui";
import Icono from "@/componentes/Icono";

export default function RecuperarContrasena() {
  const { pedirResetContrasena } = useAuth();
  const { t } = useIdioma();
  useTitulo(t("acceso.recuperar.titulo"));

  const [email, setEmail] = useState("");
  const [tocado, setTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mandado, setMandado] = useState(false);
  const [error, setError] = useState(null);

  const errorEmail =
    tocado && email.trim() && !emailValido(email)
      ? t("acceso.recuperar.mailMalo")
      : null;

  const motivo = !email.trim()
    ? t("acceso.recuperar.faltaMail")
    : !emailValido(email)
      ? t("acceso.recuperar.mailForma")
      : enviando
        ? t("acceso.recuperar.mandando")
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
        <TituloPantalla apoyo={t("acceso.recuperar.mandado.apoyo")}>{t("acceso.recuperar.mandado.titulo")}</TituloPantalla>
        <Tarjeta>
          <p className="flex items-start gap-2 font-bold text-completo">
            <Icono nombre="sobre" className="mt-0.5 size-6" />
            <span>
              {t("acceso.recuperar.mandado.mensaje", { mail: email.trim() })}
            </span>
          </p>
          <p className="mt-2 max-w-[65ch] text-tinta-media">
            {t("acceso.recuperar.mandado.duracion")}
          </p>
          <div className="mt-6">
            <Link
              href="/iniciar-sesion"
              className="inline-flex min-h-12 items-center gap-2 font-bold text-azul"
            >
              <Icono nombre="volver" />
              {t("acceso.recuperar.mandado.volver")}
            </Link>
          </div>
        </Tarjeta>
      </>
    );
  }

  return (
    <>
      <TituloPantalla apoyo={t("acceso.recuperar.apoyo")}>
        {t("acceso.recuperar.titulo")}
      </TituloPantalla>

      <Tarjeta>
        <Campo
          id="email"
          etiqueta={t("acceso.recuperar.mail")}
          ayuda={t("acceso.recuperar.mailAyuda")}
          error={errorEmail}
          ejemplo={t("acceso.ejemploMail")}
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
          <ErrorGeneral>{textoDeError(t, error)}</ErrorGeneral>
        )}

        <Boton
          variante="principal"
          icono="sobre"
          motivo={motivo}
          onClick={mandar}
          className="min-h-14 w-full"
        >
          {t("acceso.recuperar.boton")}
        </Boton>
      </Tarjeta>

      <p className="mt-6 text-tinta-media">
        {t("acceso.recuperar.acordaste")}{" "}
        <Link href="/iniciar-sesion" className="font-bold text-azul">
          {t("acceso.iniciaSesion")}
        </Link>
        .
      </p>
    </>
  );
}
