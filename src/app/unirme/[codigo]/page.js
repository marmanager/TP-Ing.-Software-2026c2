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
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import { pedirEntrar } from "@/lib/equipo";
import { useTitulo } from "@/lib/useTitulo";
import { Boton, Campo, Tarjeta, TituloPantalla, Cargando, ErrorGeneral } from "@/componentes/ui";
import Icono from "@/componentes/Icono";

export default function Unirme() {
  const { codigo } = useParams();
  const { sesion, cargando, verInvitacion } = useAuth();
  const { t } = useIdioma();
  useTitulo(t("acceso.unirme.titulo"));

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
        <TituloPantalla>{t("acceso.unirme.noSirve")}</TituloPantalla>
        <Tarjeta>
          <p className="flex items-start gap-2 font-bold text-espera">
            <Icono nombre="alerta" className="mt-0.5 size-6" />
            <span>{invitacion?.motivo ?? (textoDeError(t, error) || t("acceso.unirme.noPudimosLeer"))}</span>
          </p>
          <p className="mt-2 max-w-[65ch] text-tinta-media">
            {t("acceso.unirme.pedileUno")}
          </p>
          <div className="mt-6">
            <Link
              href="/iniciar-sesion"
              className="inline-flex min-h-12 items-center gap-2 font-bold text-azul"
            >
              <Icono nombre="volver" />
              {t("acceso.unirme.irAIniciar")}
            </Link>
          </div>
        </Tarjeta>
      </>
    );
  }

  const cabecera = (
    <TituloPantalla apoyo={t("acceso.unirme.cabeceraApoyo", { negocio: invitacion.negocio })}>
      {t("acceso.unirme.cabecera", { negocio: invitacion.negocio })}
    </TituloPantalla>
  );

  // Todavía no entró: primero la cuenta, después la invitación.
  if (!sesion) {
    return (
      <>
        {cabecera}
        <Tarjeta>
          <p className="max-w-[65ch] text-tinta-media">
            {t("acceso.unirme.necesitasCuenta")}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/crear-cuenta"
              onClick={() => recordarInvitacion(codigo)}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-campo bg-azul px-6 font-bold text-cuerpo text-white hover:bg-azul-apretado"
            >
              <Icono nombre="persona-mas" />
              {t("acceso.unirme.crearMiCuenta")}
            </Link>
            <Link
              href="/iniciar-sesion"
              onClick={() => recordarInvitacion(codigo)}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-campo border-2 border-azul bg-tarjeta px-6 font-bold text-cuerpo text-azul hover:bg-azul-claro"
            >
              <Icono nombre="check" />
              {t("acceso.unirme.yaTengoCuenta")}
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
                ? t("acceso.unirme.yaEstas", { negocio: pedido.negocio })
                : t("acceso.unirme.listo", { negocio: pedido.negocio })}
            </span>
          </p>
          <div className="mt-6">
            <Link href="/negocios" className="inline-flex min-h-12 items-center gap-2 font-bold text-azul">
              <Icono nombre="flecha" />
              {t("acceso.unirme.irAMisNegocios")}
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
          {t("acceso.unirme.cuandoAcepten")}
        </p>

        <Campo
          id="nombre"
          etiqueta={t("acceso.unirme.nombre")}
          ayuda={t("acceso.unirme.nombreAyuda")}
          autoComplete="name"
          value={nombre}
          onChange={(e) => {
            setError(null);
            setNombre(e.target.value);
          }}
        />

        {error && (
          <ErrorGeneral>{textoDeError(t, error)}</ErrorGeneral>
        )}

        <Boton
          variante="principal"
          icono="check"
          motivo={entrando ? t("acceso.unirme.enviando") : null}
          onClick={pedir}
          data-testid="unirme-pedir"
          className="min-h-14 w-full"
        >
          {t("acceso.unirme.pedir", { negocio: invitacion.negocio })}
        </Boton>
      </Tarjeta>
    </>
  );
}
