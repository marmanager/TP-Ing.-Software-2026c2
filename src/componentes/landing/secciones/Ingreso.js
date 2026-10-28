"use client";

import { useState } from "react";
import { entrarALanding, pedirCodigoDeLanding } from "@/lib/datos";
import { comoSeIdentifica } from "@/lib/presets";
import { textoDeError } from "@/lib/idioma";
import { useIdioma } from "@/lib/useIdioma";
import Icono from "@/componentes/Icono";
import { Boton, Campo, ErrorGeneral } from "@/componentes/ui";

// Entrar a la landing para ver lo suyo, sin cuenta ni contraseña
// (docs/landing-por-negocio.md, "Cómo se reconoce al cliente"). En dos pasos:
//
//   1. El identificador del rubro (la patente, en un taller) y dónde recibir un
//      código de 6 números:
//        · por mensaje: el teléfono entero; el código le llega a ese número, y
//          eso ya prueba que es él, así que no se piden los últimos 4;
//        · por mail: el mail (el negocio no guarda mails de clientes) y los
//          últimos 4 del teléfono, que es con lo que se lo reconoce.
//   2. El código que le llegó.
//
// Va en lugar de lo que muestra lo del cliente mientras no entró; "boton" dice
// qué se va a ver al entrar. Hay uno solo en la página (lo pone la página en la
// primera sección que muestra lo del cliente), con id "ingreso": las otras
// llevan hasta acá. "principal" lo decide la página: si está "Sacar turno", el
// botón azul es "Pedir el turno" y este va con borde (cartilla: uno solo por
// pantalla).
//
// Si los datos no coinciden, el mensaje es siempre el mismo y lo escribe la
// API: no dice cuál de los dos está mal, para no darle pistas a quien prueba.
//
// "aviso" es por qué se le vuelven a pedir los datos (la llave venció).
export default function Ingreso({ codigo, negocio, boton, aviso, principal, alEntrar }) {
  const { idioma, t } = useIdioma();
  const ident = comoSeIdentifica(negocio.rubro, idioma);
  const [identificador, setIdentificador] = useState("");
  const [canal, setCanal] = useState("mensaje");
  const [telefono, setTelefono] = useState("");
  const [mail, setMail] = useState("");
  const [ultimos4, setUltimos4] = useState("");
  const [codigoRecibido, setCodigoRecibido] = useState("");
  // Adónde se mandó el código (tapado, como lo devuelve la API); null mientras
  // todavía no pidió ninguno.
  const [enviadoA, setEnviadoA] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState(null);

  const faltaPedir = !identificador.trim()
    ? t("ui.validaciones.faltaIdentificador", { identificador: ident.enFrase })
    : canal === "mensaje"
      ? telefono.replace(/\D/g, "").length < 8
        ? t("landing.ingreso.faltaTelefono")
        : null
      : !mail.trim()
        ? t("landing.ingreso.faltaMail")
        : ultimos4.length !== 4
          ? t("landing.ingreso.faltan4")
          : null;

  const faltaEntrar = codigoRecibido.length !== 6 ? t("landing.ingreso.faltan6") : null;

  async function pedir(ev) {
    ev?.preventDefault();
    if (faltaPedir || trabajando) return;
    setError(null);
    setTrabajando(true);
    const r = await pedirCodigoDeLanding(codigo, { canal, identificador, telefono, mail, ultimos4 });
    setTrabajando(false);
    if (!r.ok) return setError({ codigo: r.codigo, mensaje: r.mensaje });
    setCodigoRecibido("");
    setEnviadoA(r.enviado_a);
  }

  async function entrar(ev) {
    ev.preventDefault();
    if (faltaEntrar || trabajando) return;
    setError(null);
    setTrabajando(true);
    const r = await entrarALanding(codigo, { identificador, codigoRecibido });
    setTrabajando(false);
    if (!r.ok) return setError({ codigo: r.codigo, mensaje: r.mensaje });
    alEntrar();
  }

  const avisoVencida = aviso && (
    <p role="status" className="mb-4 flex items-start gap-2 rounded-campo bg-espera-fondo p-4 font-bold text-espera">
      <Icono nombre="reloj" className="mt-0.5 size-5 shrink-0" />
      <span>{textoDeError(t, aviso)}</span>
    </p>
  );

  if (enviadoA) {
    return (
      <form id="ingreso" onSubmit={entrar} className="mt-2 scroll-mt-4">
        {avisoVencida}
        <p role="status" className="mb-6 max-w-[65ch] text-tinta-media">
          {t("landing.ingreso.enviado", { destino: enviadoA })}
        </p>

        <Campo
          id="ingreso-codigo"
          etiqueta={t("landing.ingreso.codigo")}
          ayuda={t("landing.ingreso.codigoAyuda")}
          value={codigoRecibido}
          onChange={(e) => setCodigoRecibido(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
        />

        {error && <ErrorGeneral>{textoDeError(t, error)}</ErrorGeneral>}

        <Boton
          type="submit"
          variante={principal ? "principal" : "borde"}
          icono="llave"
          data-testid="ingreso-entrar"
          className="min-h-14 w-full sm:min-h-12 sm:w-auto"
          motivo={trabajando ? t("landing.ingreso.entrando") : faltaEntrar}
        >
          {boton}
        </Boton>

        <div className="mt-4 flex flex-wrap gap-2">
          <Boton type="button" variante="plano" onClick={pedir} motivo={trabajando ? t("landing.ingreso.pidiendo") : null}>
            {t("landing.ingreso.otroCodigo")}
          </Boton>
          <Boton
            type="button"
            variante="plano"
            onClick={() => {
              setEnviadoA(null);
              setError(null);
            }}
          >
            {t("landing.ingreso.cambiarDatos")}
          </Boton>
        </div>
      </form>
    );
  }

  return (
    <form id="ingreso" onSubmit={pedir} className="mt-2 scroll-mt-4">
      {avisoVencida}

      <p className="mb-6 max-w-[65ch] text-tinta-media">
        {t("landing.ingreso.intro", { identificador: ident.enFrase, negocio: negocio.nombre })}
      </p>

      <Campo
        id="ingreso-identificador"
        etiqueta={ident.nombre}
        ayuda={t("landing.ingreso.identificadorAyuda", { ejemplo: ident.ejemplo })}
        value={identificador}
        onChange={(e) => setIdentificador(e.target.value)}
        maxLength={40}
        autoComplete="off"
        autoCapitalize="characters"
      />

      <fieldset className="mb-6">
        <legend className="block font-bold text-cuerpo">{t("landing.ingreso.canal")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            ["mensaje", t("landing.ingreso.porMensaje")],
            ["mail", t("landing.ingreso.porMail")],
          ].map(([clave, texto]) => (
            <label
              key={clave}
              className={[
                "flex min-h-12 cursor-pointer items-center gap-2 rounded-full border-2 px-4 text-etiqueta",
                canal === clave
                  ? "border-azul bg-azul-claro font-bold text-azul"
                  : "border-borde bg-tarjeta text-tinta-media hover:bg-superficie",
              ].join(" ")}
            >
              <input
                type="radio"
                name="ingreso-canal"
                value={clave}
                checked={canal === clave}
                onChange={() => {
                  setCanal(clave);
                  setError(null);
                }}
                className="size-4"
              />
              {texto}
            </label>
          ))}
        </div>
      </fieldset>

      {canal === "mensaje" ? (
        <Campo
          id="ingreso-telefono"
          etiqueta={t("landing.ingreso.telefono")}
          ayuda={t("landing.ingreso.telefonoAyuda", { negocio: negocio.nombre })}
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          inputMode="tel"
          autoComplete="tel"
        />
      ) : (
        <>
          <Campo
            id="ingreso-mail"
            etiqueta={t("landing.ingreso.mail")}
            ayuda={t("landing.ingreso.mailAyuda", { negocio: negocio.nombre })}
            value={mail}
            onChange={(e) => setMail(e.target.value)}
            type="email"
            inputMode="email"
            autoComplete="email"
          />
          <Campo
            id="ingreso-ultimos4"
            etiqueta={t("landing.ingreso.ultimos4")}
            ayuda={t("landing.ingreso.ultimos4Ayuda")}
            value={ultimos4}
            // Sólo números: el teclado numérico del celular igual deja pegar
            // otras cosas. Si pega el teléfono entero, quedan los últimos 4 (sin
            // maxLength, que se quedaría con los primeros y gastaría un intento
            // del bloqueo con datos que la persona no quiso mandar).
            onChange={(e) => setUltimos4(e.target.value.replace(/\D/g, "").slice(-4))}
            inputMode="numeric"
            autoComplete="off"
          />
        </>
      )}

      {error && <ErrorGeneral>{textoDeError(t, error)}</ErrorGeneral>}

      <Boton
        type="submit"
        variante={principal ? "principal" : "borde"}
        icono="llave"
        data-testid="ingreso-pedir"
        className="min-h-14 w-full sm:min-h-12 sm:w-auto"
        motivo={trabajando ? t("landing.ingreso.pidiendo") : faltaPedir}
      >
        {t("landing.ingreso.pedir")}
      </Boton>
    </form>
  );
}
