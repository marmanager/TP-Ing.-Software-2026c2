"use client";

// "Crear tu cuenta" (SCRUM-10).
//
// Tres datos: mail, teléfono y contraseña. Con esto la cuenta queda hecha;
// el nombre del negocio y el rubro se piden después (SCRUM-12).

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { emailValido, telefonoValido, contrasenaValida } from "@/lib/validaciones";
import { Boton, Campo, Tarjeta, TituloPantalla } from "@/componentes/ui";
import Icono from "@/componentes/Icono";

export default function CrearCuenta() {
  const router = useRouter();
  const { crearCuenta } = useAuth();
  useTitulo("Crear cuenta");

  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [verContrasena, setVerContrasena] = useState(false);
  const [tocado, setTocado] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [avisadoAlMail, setAvisadoAlMail] = useState(null);

  // Cada vez que se toca un campo, se borra el error general del último intento.
  const alEscribir = (set) => (e) => {
    setErrorGeneral(null);
    set(e.target.value);
  };

  const errorEmail =
    tocado.email && email.trim() && !emailValido(email)
      ? "Ese mail no tiene forma de mail."
      : null;
  const errorTelefono =
    tocado.telefono && telefono.trim() && !telefonoValido(telefono)
      ? "El teléfono no es válido. Escribilo con característica y sin el 0 ni el 15:"
      : null;
  const errorContrasena =
    tocado.contrasena && contrasena && !contrasenaValida(contrasena)
      ? "La contraseña necesita al menos 8 caracteres."
      : null;

  const motivo = !email.trim()
    ? "falta el mail"
    : !emailValido(email)
      ? "el mail no tiene forma de mail"
      : !telefono.trim()
        ? "falta el teléfono"
        : !telefonoValido(telefono)
          ? "el teléfono no es válido"
          : !contrasena
            ? "falta la contraseña"
            : !contrasenaValida(contrasena)
              ? "la contraseña es muy corta"
              : enviando
                ? "creando la cuenta…"
                : null;

  async function crear() {
    setErrorGeneral(null);
    setEnviando(true);
    const r = await crearCuenta({ email, telefono, contrasena });
    setEnviando(false);
    if (!r.ok) {
      setErrorGeneral(r.error);
      return;
    }
    if (r.necesitaConfirmar) {
      setAvisadoAlMail(r.email);
      return;
    }
    router.replace("/crear-negocio");
  }

  if (avisadoAlMail) {
    return (
      <>
        <TituloPantalla apoyo="Falta un paso y ya entrás.">Confirmá tu mail</TituloPantalla>
        <Tarjeta>
          <p className="flex items-start gap-2 font-bold text-completo">
            <Icono nombre="sobre" className="mt-0.5 size-6" />
            <span>
              Te mandamos un mail a {avisadoAlMail}. Abrilo y tocá el enlace para confirmar
              la cuenta.
            </span>
          </p>
          <p className="mt-3 text-tinta-media">
            Si no aparece en unos minutos, fijate en la carpeta de correo no deseado.
          </p>
          <div className="mt-6">
            <Link
              href="/iniciar-sesion"
              className="inline-flex min-h-12 items-center gap-2 font-bold text-azul"
            >
              <Icono nombre="volver" />
              Volver a iniciar sesión
            </Link>
          </div>
        </Tarjeta>
      </>
    );
  }

  return (
    <>
      <TituloPantalla apoyo="Con esto empezás. El nombre del negocio se pone después.">
        Crear tu cuenta
      </TituloPantalla>

      <Tarjeta>
        <Campo
          id="email"
          etiqueta="Tu mail"
          ayuda="Con este mail vas a entrar. Ejemplo: nombre@taller.com."
          error={errorEmail}
          ejemplo="nombre@taller.com"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={alEscribir(setEmail)}
          onBlur={() => setTocado((t) => ({ ...t, email: true }))}
        />

        <Campo
          id="telefono"
          etiqueta="Tu teléfono"
          ayuda="Con característica, sin el 0 ni el 15."
          error={errorTelefono}
          ejemplo="341 456 7890"
          exito={
            telefono.trim() && telefonoValido(telefono)
              ? "Listo. Te vamos a poder avisar por acá."
              : null
          }
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={telefono}
          onChange={alEscribir(setTelefono)}
          onBlur={() => setTocado((t) => ({ ...t, telefono: true }))}
        />

        <Campo
          id="contrasena"
          etiqueta="Una contraseña"
          ayuda="Al menos 8 caracteres."
          error={errorContrasena}
          type={verContrasena ? "text" : "password"}
          autoComplete="new-password"
          value={contrasena}
          onChange={alEscribir(setContrasena)}
          onBlur={() => setTocado((t) => ({ ...t, contrasena: true }))}
        />
        <button
          type="button"
          onClick={() => setVerContrasena((v) => !v)}
          className="-mt-3 mb-6 inline-flex min-h-12 items-center font-bold text-azul"
        >
          {verContrasena ? "Ocultar la contraseña" : "Mostrar la contraseña"}
        </button>

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
          onClick={crear}
          className="min-h-14 w-full"
        >
          Crear cuenta
        </Boton>
      </Tarjeta>

      <p className="mt-6 text-tinta-media">
        ¿Ya tenés cuenta?{" "}
        <Link href="/iniciar-sesion" className="font-bold text-azul">
          Iniciá sesión
        </Link>
        .
      </p>
    </>
  );
}
