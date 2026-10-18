"use client";

import { useState } from "react";
import { entrarALanding } from "@/lib/datos";
import { comoSeIdentifica } from "@/lib/presets";
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
  const ident = comoSeIdentifica(negocio.rubro);
  const [identificador, setIdentificador] = useState("");
  const [ultimos4, setUltimos4] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState(null);

  const falta = !identificador.trim()
    ? `falta ${ident.enFrase}`
    : ultimos4.length !== 4
      ? "faltan los 4 números"
      : null;

  async function entrar(ev) {
    ev.preventDefault();
    if (falta || entrando) return;
    setError(null);
    setEntrando(true);
    const r = await entrarALanding(codigo, { identificador, ultimos4 });
    setEntrando(false);
    if (!r.ok) return setError(r.mensaje);
    alEntrar();
  }

  return (
    <form id="ingreso" onSubmit={entrar} className="mt-2 scroll-mt-4">
      {aviso && (
        <p role="status" className="mb-4 flex items-start gap-2 rounded-campo bg-espera-fondo p-4 font-bold text-espera">
          <Icono nombre="reloj" className="mt-0.5 size-5 shrink-0" />
          <span>{aviso}</span>
        </p>
      )}

      <p className="mb-6 max-w-[65ch] text-tinta-media">
        Para ver lo tuyo, poné {ident.enFrase} y los últimos 4 números del teléfono que
        le diste a {negocio.nombre}. No hace falta crear ninguna cuenta.
      </p>

      <Campo
        id="ingreso-identificador"
        etiqueta={ident.nombre}
        ayuda={`Por ejemplo: ${ident.ejemplo}. Con espacios o sin, da igual.`}
        value={identificador}
        onChange={(e) => setIdentificador(e.target.value)}
        maxLength={40}
        autoComplete="off"
        autoCapitalize="characters"
      />
      <Campo
        id="ingreso-ultimos4"
        etiqueta="Los últimos 4 números de tu teléfono"
        ayuda="Si tu número es 341 456 7890, son 7890. Si el negocio no tiene tu teléfono, pedile que lo cargue."
        value={ultimos4}
        // Sólo números: el teclado numérico del celular igual deja pegar
        // otras cosas. Si pega el teléfono entero, quedan los últimos 4 (sin
        // maxLength, que se quedaría con los primeros y gastaría un intento
        // del bloqueo con datos que la persona no quiso mandar).
        onChange={(e) => setUltimos4(e.target.value.replace(/\D/g, "").slice(-4))}
        inputMode="numeric"
        autoComplete="off"
      />

      {error && <ErrorGeneral>{error}</ErrorGeneral>}

      <Boton
        type="submit"
        variante={principal ? "principal" : "borde"}
        icono="llave"
        className="min-h-14 w-full sm:min-h-12 sm:w-auto"
        motivo={entrando ? "entrando" : falta}
      >
        {boton}
      </Boton>
    </form>
  );
}
