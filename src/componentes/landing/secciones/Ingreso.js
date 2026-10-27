"use client";

import { useState } from "react";
import { entrarALanding } from "@/lib/datos";
import { comoSeIdentifica } from "@/lib/presets";
import { textoDeError } from "@/lib/idioma";
import { useIdioma } from "@/lib/useIdioma";
import Icono from "@/componentes/Icono";
import { Boton, Campo, ErrorGeneral } from "@/componentes/ui";

// Entrar a la landing para ver lo suyo, sin cuenta ni contraseña: el
// identificador del rubro (la patente, en un taller) y los últimos 4 números
// del teléfono que el cliente le dio al negocio (docs/landing-por-negocio.md,
// "Cómo se reconoce al cliente"). Va en lugar de lo que muestra lo del
// cliente mientras no entró; "boton" dice qué se va a ver al entrar.
//
// Hay uno solo en la página (lo pone la página en la primera sección que
// muestra lo del cliente), con id "ingreso": las otras llevan hasta acá.
// "principal" lo decide la página: si está "Sacar turno", el botón azul es
// "Pedir el turno" y este va con borde (cartilla: uno solo por pantalla).
//
// Si los datos no coinciden, el mensaje es siempre el mismo y lo escribe la
// API: no dice cuál de los dos está mal, para no darle pistas a quien prueba.
//
// "aviso" es por qué se le vuelven a pedir los datos (la llave venció).
export default function Ingreso({ codigo, negocio, boton, aviso, principal, alEntrar }) {
  const { idioma, t } = useIdioma();
  const ident = comoSeIdentifica(negocio.rubro, idioma);
  const [identificador, setIdentificador] = useState("");
  const [ultimos4, setUltimos4] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState(null);

  const falta = !identificador.trim()
    ? t("ui.validaciones.faltaIdentificador", { identificador: ident.enFrase })
    : ultimos4.length !== 4
      ? t("landing.ingreso.faltan4")
      : null;

  async function entrar(ev) {
    ev.preventDefault();
    if (falta || entrando) return;
    setError(null);
    setEntrando(true);
    const r = await entrarALanding(codigo, { identificador, ultimos4 });
    setEntrando(false);
    if (!r.ok) return setError({ codigo: r.codigo, mensaje: r.mensaje });
    alEntrar();
  }

  return (
    <form id="ingreso" onSubmit={entrar} className="mt-2 scroll-mt-4">
      {aviso && (
        <p role="status" className="mb-4 flex items-start gap-2 rounded-campo bg-espera-fondo p-4 font-bold text-espera">
          <Icono nombre="reloj" className="mt-0.5 size-5 shrink-0" />
          <span>{textoDeError(t, aviso)}</span>
        </p>
      )}

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

      {error && <ErrorGeneral>{textoDeError(t, error)}</ErrorGeneral>}

      <Boton
        type="submit"
        variante={principal ? "principal" : "borde"}
        icono="llave"
        className="min-h-14 w-full sm:min-h-12 sm:w-auto"
        motivo={entrando ? t("landing.ingreso.entrando") : falta}
      >
        {boton}
      </Boton>
    </form>
  );
}
