"use client";

// "Crear tu negocio" (SCRUM-12).
//
// Segundo y último paso del alta: nombre del negocio y preset del rubro.
// El preset renombra los estados y decide qué módulos vienen prendidos
// (SCRUM-23/25). No se puede seguir sin elegir un rubro (SCRUM-24).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, invitacionPendiente, mailAConfirmar, olvidarMail } from "@/lib/auth";
import { misPedidos } from "@/lib/equipo";
import { useDatos } from "@/lib/datos";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import { useTitulo } from "@/lib/useTitulo";
import { RUBROS, preset, ejemplosDe } from "@/lib/presets";
import { modulosDe, traducirModulo } from "@/lib/modulos";
import { Boton, Campo, Tarjeta, TituloPantalla } from "@/componentes/ui";
import Icono from "@/componentes/Icono";

export default function CrearNegocio() {
  const router = useRouter();
  const { usuario, sesion, refrescarUsuario } = useAuth();
  const { crearNegocio } = useDatos();
  const { t, idioma } = useIdioma();
  useTitulo(t("acceso.crearNegocio.titulo"));

  const [nombre, setNombre] = useState("");
  const [rubro, setRubro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState(null);
  // Si llegó por una invitación y se creó la cuenta en el camino, capaz no
  // quiere un negocio propio sino sumarse al que lo invitó.
  const [invitacion, setInvitacion] = useState(null);
  // Si venía de confirmar el mail, conviene decírselo: tocó un enlace
  // esperando entrar y le aparece otro formulario. Sin esto parece que algo
  // salió mal, cuando en realidad falta un paso.
  const [reciénConfirmado, setReciénConfirmado] = useState(false);
  // Negocios a los que ya pidió entrar y todavía no lo aceptaron.
  const [esperando, setEsperando] = useState([]);

  useEffect(() => {
    setInvitacion(invitacionPendiente());
    if (mailAConfirmar()) {
      setReciénConfirmado(true);
      olvidarMail();
    }
    let vivo = true;
    misPedidos(sesion?.access_token).then((r) => {
      if (vivo) setEsperando(r.ok ? r.pedidos : []);
    });
    return () => {
      vivo = false;
    };
    // Una vez, al llegar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const elegido = rubro ? preset(rubro, idioma) : null;
  const motivo = !nombre.trim()
    ? t("acceso.crearNegocio.faltaNombre")
    : !rubro
      ? t("acceso.crearNegocio.elegiRubro")
      : enviando
        ? t("acceso.crearNegocio.creando")
        : null;

  async function crear() {
    setErrorGeneral(null);
    setEnviando(true);
    const creado = await crearNegocio({ nombre: nombre.trim(), rubro });
    setEnviando(false);
    if (!creado.ok) {
      setErrorGeneral(creado.error);
      return;
    }
    // La base ya dejó la cuenta adentro, como dueña (038). Se vuelve a leer
    // la fila entera y no sólo el negocio: el rol también cambió.
    await refrescarUsuario();
    router.replace("/");
  }

  return (
    <>
      <TituloPantalla apoyo={t("acceso.crearNegocio.apoyo")}>
        {t("acceso.crearNegocio.titulo")}
      </TituloPantalla>

      {reciénConfirmado && (
        <Tarjeta className="mb-6">
          <p className="flex items-start gap-2 font-bold text-completo">
            <Icono nombre="listo" className="mt-0.5 size-6" />
            <span>{t("acceso.crearNegocio.confirmado")}</span>
          </p>
          <p className="mt-2 max-w-[65ch] text-tinta-media">
            {t("acceso.crearNegocio.confirmadoTexto")}
          </p>
        </Tarjeta>
      )}

      {esperando.length > 0 && (
        <Tarjeta className="mb-6">
          <p className="flex items-start gap-2 font-bold text-cuerpo">
            <Icono nombre="reloj" className="mt-0.5 size-6" />
            <span>{t("acceso.crearNegocio.esperando", { negocios: esperando.map((p) => p.negocio_nombre).join(", ") })}</span>
          </p>
          <p className="mt-2 max-w-[65ch] text-tinta-media">
            {t("acceso.crearNegocio.esperandoTexto")}
          </p>
        </Tarjeta>
      )}

      {invitacion && (
        <Tarjeta className="mb-6">
          <p className="flex items-start gap-2 font-bold text-cuerpo">
            <Icono nombre="personas" className="mt-0.5 size-6" />
            <span>{t("acceso.crearNegocio.venias")}</span>
          </p>
          <p className="mt-2 max-w-[65ch] text-tinta-media">
            {t("acceso.crearNegocio.venisTexto")}
          </p>
          <div className="mt-4">
            <Link
              href={`/unirme/${invitacion}`}
              className="inline-flex min-h-12 items-center gap-2 font-bold text-azul"
            >
              <Icono nombre="volver" />
              {t("acceso.crearNegocio.volverInvitacion")}
            </Link>
          </div>
        </Tarjeta>
      )}

      <Tarjeta>
        <Campo
          id="nombre"
          etiqueta={t("acceso.crearNegocio.nombre")}
          ayuda={t("acceso.crearNegocio.nombreAyuda", { ejemplo: ejemplosDe(rubro, idioma).negocio })}
          autoComplete="off"
          value={nombre}
          onChange={(e) => {
            setErrorGeneral(null);
            setNombre(e.target.value);
          }}
        />

        <p className="font-bold text-cuerpo">{t("acceso.crearNegocio.dedica")}</p>
        <p className="mt-1 mb-3 text-apoyo text-tinta-suave">
          {t("acceso.crearNegocio.dedicaAyuda")}
        </p>
        <ul className="grid gap-3">
          {RUBROS.map((rubroEs) => {
            const r = preset(rubroEs.clave, idioma);
            const sel = r.clave === rubro;
            return (
              <li key={r.clave}>
                <button
                  type="button"
                  aria-pressed={sel}
                  onClick={() => {
                    setErrorGeneral(null);
                    setRubro(r.clave);
                  }}
                  className={[
                    "flex w-full flex-col rounded-tarjeta border-2 p-4 text-left",
                    sel
                      ? "border-azul bg-azul-claro"
                      : "border-borde bg-tarjeta hover:bg-superficie",
                  ].join(" ")}
                >
                  <span
                    className={`flex items-center gap-2 font-bold text-subtitulo ${sel ? "text-azul" : ""}`}
                  >
                    {sel && <Icono nombre="listo" className="size-6" />}
                    {r.nombre}
                  </span>
                  <span className="mt-1 text-tinta-media">{r.queEs}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* "Personalizable" no trae módulos: una lista vacía bajo "vas a
            arrancar con" parecería un error. */}
        {elegido && modulosDe(elegido.modulos).length === 0 && (
          <div className="mt-6 rounded-tarjeta bg-superficie p-4">
            <p className="font-bold text-cuerpo">{t("acceso.crearNegocio.sinSecciones")}</p>
            <p className="mt-2 text-tinta-media">
              {t("acceso.crearNegocio.sinSeccionesTexto")}
            </p>
          </div>
        )}

        {elegido && modulosDe(elegido.modulos).length > 0 && (
          <div className="mt-6 rounded-tarjeta bg-superficie p-4">
            <p className="font-bold text-cuerpo">{t("acceso.crearNegocio.arrancas", { rubro: elegido.nombre })}</p>
            <ul className="mt-2 flex flex-col gap-2">
              {modulosDe(elegido.modulos).map((m) => traducirModulo(m, t)).map((m) => (
                <li key={m.clave} className="flex items-start gap-2 text-tinta-media">
                  <Icono nombre={m.icono} className="mt-0.5 size-5" />
                  <span>
                    <span className="font-bold text-tinta">{m.nombre}</span> · {m.descripcion}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-apoyo text-tinta-suave">
              {t("acceso.crearNegocio.prendeApaga")}
            </p>
          </div>
        )}

        {errorGeneral && (
          <p className="mt-6 flex items-start gap-2 font-bold text-rojo text-etiqueta">
            <Icono nombre="alerta" className="mt-px size-5" />
            <span>{textoDeError(t, errorGeneral)}</span>
          </p>
        )}

        <div className="mt-6">
          <Boton
            variante="principal"
            icono="check"
            motivo={motivo}
            onClick={crear}
            className="min-h-14 w-full"
          >
            {t("acceso.crearNegocio.boton")}
          </Boton>
        </div>
      </Tarjeta>

      {/* Quien ya está en un negocio llega acá desde "Nuevo negocio", y puede
          arrepentirse. */}
      {usuario?.negocio_id && (
        <div className="mt-6">
          <Link href="/" className="inline-flex min-h-12 items-center gap-2 font-bold text-azul">
            <Icono nombre="volver" />
            {t("acceso.crearNegocio.volverSinCrear")}
          </Link>
        </div>
      )}
    </>
  );
}
