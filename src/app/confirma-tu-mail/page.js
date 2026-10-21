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
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import { useTitulo } from "@/lib/useTitulo";
import { Boton, Tarjeta, TituloPantalla } from "@/componentes/ui";
import Icono from "@/componentes/Icono";

export default function ConfirmaTuMail() {
  const { sesion, reenviarConfirmacion } = useAuth();
  const { t } = useIdioma();
  useTitulo(t("acceso.confirmaMail.titulo"));

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
      <TituloPantalla apoyo={t("acceso.confirmaMail.apoyo")}>{t("acceso.confirmaMail.titulo")}</TituloPantalla>

      <Tarjeta>
        <p className="flex items-start gap-2 font-bold text-completo">
          <Icono nombre="sobre" className="mt-0.5 size-6" />
          <span>
            {mail
              ? t("acceso.confirmaMail.mandamos", { mail })
              : t("acceso.confirmaMail.mandamosSinMail")}
          </span>
        </p>
        <p className="mt-2 max-w-[65ch] text-tinta-media">
          {t("acceso.confirmaMail.abrilo")}
        </p>
        <p className="mt-2 max-w-[65ch] text-tinta-media">
          {t("acceso.confirmaMail.spam")}
        </p>

        {reenviado && (
          <p className="mt-4 flex items-start gap-2 font-bold text-completo text-etiqueta">
            <Icono nombre="listo" className="mt-px size-5" />
            <span>{t("acceso.confirmaMail.reenviado")}</span>
          </p>
        )}

        {error && (
          <p className="mt-4 flex items-start gap-2 font-bold text-rojo text-etiqueta">
            <Icono nombre="alerta" className="mt-px size-5" />
            <span>{textoDeError(t, error)}</span>
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Boton
            icono="sobre"
            onClick={reenviar}
            motivo={!mail ? t("acceso.confirmaMail.sinMail") : enviando ? t("acceso.confirmaMail.mandando") : null}
          >
            {t("acceso.confirmaMail.reenviar")}
          </Boton>
        </div>
      </Tarjeta>

      <p className="mt-6 text-tinta-media">
        {t("acceso.confirmaMail.yaConfirmaste")}{" "}
        <Link href="/iniciar-sesion" className="font-bold text-azul">
          {t("acceso.iniciaSesion")}
        </Link>
        .
      </p>
    </>
  );
}
