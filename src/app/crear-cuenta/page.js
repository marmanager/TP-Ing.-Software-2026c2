"use client";

// "Crear tu cuenta" (SCRUM-10).
//
// Cuatro datos: nombre, mail, teléfono y contraseña. Con esto la cuenta queda
// hecha; el nombre del negocio y el rubro se piden después (SCRUM-12).
//
// El nombre es de la persona, no del negocio. Va acá porque con él se firma
// el historial de los casos: sin pedirlo, quien abrió el negocio termina
// firmando con la parte de su mail antes del arroba, y el equipo lee "qué
// pasó, cuándo y quién lo hizo" con una dirección de correo en vez de una
// persona. Son cuatro campos: la sección 05 permite hasta seis.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useIdioma } from "@/lib/useIdioma";
import { textoDeError } from "@/lib/idioma";
import { useTitulo } from "@/lib/useTitulo";
import { emailValido, contrasenaValida } from "@/lib/validaciones";
import { paisInicial } from "@/lib/telefono";
import CampoTelefono, { useTelefono } from "@/componentes/CampoTelefono";
import { Boton, Campo, Tarjeta, TituloPantalla, ErrorGeneral } from "@/componentes/ui";
import Icono from "@/componentes/Icono";
import BotonGoogle, { SeparadorO } from "@/componentes/BotonGoogle";

export default function CrearCuenta() {
  const router = useRouter();
  const { crearCuenta, hayGoogle } = useAuth();
  const { t } = useIdioma();
  useTitulo(t("acceso.crearCuenta.titulo"));

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  // Todavía no hay negocio del que sacar el país: arranca en Argentina, y se
  // cambia en el selector.
  const paisPorDefecto = paisInicial(null);
  const tel = useTelefono("", paisPorDefecto);
  const telefono = tel.telefono;
  const [contrasena, setContrasena] = useState("");
  const [verContrasena, setVerContrasena] = useState(false);
  const [tocado, setTocado] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState(null);

  // Cada vez que se toca un campo, se borra el error general del último intento.
  const alEscribir = (set) => (e) => {
    setErrorGeneral(null);
    set(e.target.value);
  };

  const errorEmail =
    tocado.email && email.trim() && !emailValido(email)
      ? t("acceso.crearCuenta.mailIncorrecto")
      : null;
  const errorTelefono = tocado.telefono && !tel.vacio && !tel.armado.ok ? tel.armado.mensaje : null;
  const errorContrasena =
    tocado.contrasena && contrasena && !contrasenaValida(contrasena)
      ? t("acceso.contrasenaCorta")
      : null;

  const motivo = !nombre.trim()
    ? t("acceso.crearCuenta.faltaNombre")
    : !email.trim()
      ? t("acceso.crearCuenta.faltaMail")
      : !emailValido(email)
        ? t("acceso.crearCuenta.mailFormato")
        : tel.vacio
          ? t("acceso.crearCuenta.faltaTelefono")
          : !tel.armado.ok
            ? t("acceso.crearCuenta.telefonoInvalido")
            : !contrasena
              ? t("acceso.crearCuenta.faltaContrasena")
              : !contrasenaValida(contrasena)
                ? t("acceso.crearCuenta.contrasenaMuyCorta")
                : enviando
                  ? t("acceso.crearCuenta.creando")
                  : null;

  async function crear() {
    setErrorGeneral(null);
    setEnviando(true);
    const r = await crearCuenta({ nombre, email, telefono, contrasena });
    setEnviando(false);
    if (!r.ok) {
      setErrorGeneral(r.error);
      return;
    }
    router.replace(r.necesitaConfirmar ? "/confirma-tu-mail" : "/crear-negocio");
  }

  return (
    <>
      <TituloPantalla apoyo={t("acceso.crearCuenta.apoyo")}>
        {t("acceso.crearCuenta.encabezado")}
      </TituloPantalla>

      <Tarjeta>
        {/* Con Google no hace falta nada de lo de abajo: el nombre y el mail
            salen de la cuenta de Google, y no hay contraseña que inventar. */}
        {hayGoogle && (
          <>
            <BotonGoogle>{t("acceso.crearCuenta.conGoogle")}</BotonGoogle>
            <SeparadorO />
          </>
        )}

        <Campo
          id="nombre"
          etiqueta={t("acceso.crearCuenta.nombre")}
          ayuda={t("acceso.crearCuenta.nombreAyuda")}
          ejemplo="Mateo Guevara"
          autoComplete="name"
          value={nombre}
          onChange={alEscribir(setNombre)}
        />

        <Campo
          id="email"
          etiqueta={t("acceso.crearCuenta.mail")}
          ayuda={t("acceso.crearCuenta.mailAyuda", { ejemplo: t("acceso.ejemploMail") })}
          error={errorEmail}
          ejemplo={t("acceso.ejemploMail")}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={alEscribir(setEmail)}
          onBlur={() => setTocado((antes) => ({ ...antes, email: true }))}
        />

        <CampoTelefono
          id="telefono"
          etiqueta={t("acceso.crearCuenta.telefono")}
          paisPorDefecto={paisPorDefecto}
          error={errorTelefono}
          exito={tel.armado.ok ? t("acceso.crearCuenta.telefonoListo") : null}
          valor={tel.valor}
          onChange={(v) => {
            setErrorGeneral(null);
            tel.setValor(v);
          }}
          onBlur={() => setTocado((antes) => ({ ...antes, telefono: true }))}
        />

        <Campo
          id="contrasena"
          etiqueta={t("acceso.crearCuenta.contrasena")}
          ayuda={t("acceso.crearCuenta.contrasenaAyuda")}
          error={errorContrasena}
          type={verContrasena ? "text" : "password"}
          autoComplete="new-password"
          value={contrasena}
          onChange={alEscribir(setContrasena)}
          onBlur={() => setTocado((antes) => ({ ...antes, contrasena: true }))}
        />
        <button
          type="button"
          onClick={() => setVerContrasena((v) => !v)}
          className="-mt-3 mb-6 inline-flex min-h-12 items-center font-bold text-azul"
        >
          {verContrasena ? t("ui.ocultarContrasena") : t("ui.mostrarContrasena")}
        </button>

        {errorGeneral && (
          <ErrorGeneral>{textoDeError(t, errorGeneral)}</ErrorGeneral>
        )}

        <Boton
          variante="principal"
          icono="check"
          motivo={motivo}
          onClick={crear}
          className="min-h-14 w-full"
        >
          {t("acceso.crearCuenta.titulo")}
        </Boton>
      </Tarjeta>

      <p className="mt-6 text-tinta-media">
        {t("acceso.crearCuenta.yaTenes")}{" "}
        <Link href="/iniciar-sesion" className="font-bold text-azul">
          {t("acceso.iniciaSesion")}
        </Link>
        .
      </p>
    </>
  );
}
