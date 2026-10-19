"use client";

// Piezas base (cartilla, sección 05).
//
// Reglas que estas piezas hacen cumplir solas:
// - Un solo botón azul por pantalla. El resto queda con borde.
// - Los botones se escriben verbo + objeto: "Guardar el caso", no "Aceptar".
// - Un botón apagado siempre dice por qué está apagado.
// - La ayuda de un campo va visible debajo de la etiqueta, nunca escondida.
// - El error va debajo del campo, con ícono, texto rojo y un ejemplo correcto.

import { useEffect, useRef, useState } from "react";
import Icono from "./Icono";

const BASE_BOTON =
  "inline-flex items-center justify-center gap-2 rounded-campo px-6 min-h-12 " +
  "font-cuerpo font-bold text-cuerpo transition-colors cursor-pointer " +
  "disabled:cursor-not-allowed";

const VARIANTES = {
  principal: "bg-azul text-white hover:bg-azul-apretado",
  borde: "bg-tarjeta text-azul border-2 border-azul hover:bg-azul-claro",
  // El rojo es sólo para lo que borra o no tiene vuelta. Una opción opuesta
  // pero reversible —"No lo hace"— va neutra: si no, se aprende que el rojo
  // es "la opción de la derecha" y no "cuidado" (auditoría, H5).
  peligro: "bg-tarjeta text-rojo border-2 border-rojo hover:bg-rojo/5",
  neutro: "bg-tarjeta text-tinta border-2 border-borde-fuerte hover:bg-superficie",
  plano: "bg-transparent text-azul hover:bg-azul-claro px-3",
};

export function Boton({
  variante = "borde",
  icono,
  children,
  motivo,
  className = "",
  ...props
}) {
  const apagado = Boolean(motivo) || props.disabled;

  return (
    <button
      type="button"
      {...props}
      disabled={apagado}
      className={[
        BASE_BOTON,
        apagado ? "bg-superficie text-tinta-suave border-2 border-borde" : VARIANTES[variante],
        className,
      ].join(" ")}
    >
      {icono && <Icono nombre={icono} className="size-6" />}
      <span>
        {children}
        {motivo && <span className="font-normal"> · {motivo}</span>}
      </span>
    </button>
  );
}

// Un interruptor de prendido y apagado. La etiqueta es parte del botón: así el
// área para tocar llega a los 48 px aunque la perilla sea chica, y el lector
// de pantalla dice el nombre y el estado juntos. El estado se dice con color,
// ícono —la tilde en la perilla— y palabra. Apagado, dice por qué, como Boton.
export function Interruptor({
  prendido,
  onChange,
  children,
  ayuda,
  palabras = ["Apagado", "Prendido"],
  motivo,
  disabled,
}) {
  const apagado = Boolean(motivo) || disabled;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={prendido}
      disabled={apagado}
      onClick={() => onChange(!prendido)}
      className="inline-flex min-h-12 cursor-pointer items-center gap-3 rounded-campo text-left disabled:cursor-not-allowed"
    >
      <span
        aria-hidden="true"
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          prendido ? "bg-azul" : "bg-borde-fuerte"
        } ${apagado ? "opacity-50" : ""}`}
      >
        <span
          className={`absolute top-0.5 left-0 flex size-6 items-center justify-center rounded-full bg-white text-azul transition-transform ${
            prendido ? "translate-x-5.5" : "translate-x-0.5"
          }`}
        >
          {prendido && <Icono nombre="check" className="size-4" />}
        </span>
      </span>
      <span>
        <span className="block font-bold">{children}</span>
        {ayuda && <span className="block text-tinta-media">{ayuda}</span>}
        <span className="block text-apoyo text-tinta-suave">
          {prendido ? palabras[1] : palabras[0]}
          {motivo && ` · ${motivo}`}
        </span>
      </span>
    </button>
  );
}

// Con el teléfono acostado quedan menos de 400 px de alto: ahí lo fijo no
// puede comerse la pantalla, así que el botón deja de ir clavado y acompaña
// al formulario (auditoría, criterio "funciona acostado").
// Las clases van escritas enteras y no armadas con una variable: Tailwind
// lee el código fuente buscando nombres completos, y un nombre partido en
// pedazos no genera ninguna regla.
const BOTON_SUELTO_ACOSTADO =
  "[@media(max-height:480px)]:static [@media(max-height:480px)]:mx-0 " +
  "[@media(max-height:480px)]:border-0 [@media(max-height:480px)]:bg-transparent " +
  "[@media(max-height:480px)]:p-0";

// El botón principal en celular va fijo abajo, 56 px de alto y ancho completo.
//
// Fijo, pero ENCIMA de la barra de secciones del celular, no detrás: las dos
// cosas se anclan abajo, y la barra (64 px, Navegacion.js) está por encima
// en el orden de capas. Por eso se clava al alto de la barra (--alto-barra,
// que publica Navegacion.js) y no a cero. Como
// es sticky y no fixed, ocupa su lugar en la página y el contenido no queda
// tapado. Desde md en adelante no hay barra abajo y el botón va en su lugar,
// con el mismo punto de quiebre que la barra.
export function BotonPrincipalFijo({ children, motivo, ...props }) {
  return (
    <div
      className={`sticky bottom-[var(--alto-barra,4rem)] z-10 -mx-4 mt-8 border-t border-borde bg-fondo p-4 sm:-mx-6 sm:px-6 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 ${BOTON_SUELTO_ACOSTADO}`}
    >
      <Boton
        variante="principal"
        motivo={motivo}
        {...props}
        className="min-h-14 w-full md:w-auto"
      >
        {children}
      </Boton>
    </div>
  );
}

export function Tarjeta({ children, className = "", ...props }) {
  return (
    <div
      {...props}
      className={`rounded-tarjeta border border-borde bg-tarjeta p-4 sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function TituloPantalla({ children, apoyo }) {
  return (
    <div className="mb-6">
      <h1 className="text-pantalla">{children}</h1>
      {apoyo && <p className="mt-1 text-cuerpo text-tinta-media">{apoyo}</p>}
    </div>
  );
}

export function TituloSeccion({ children, className = "", ...props }) {
  return (
    <h2 {...props} className={`text-seccion mb-4 scroll-mt-6 ${className}`}>
      {children}
    </h2>
  );
}

// Un punto al lado de la etiqueta de un campo que falta completar, cuando
// faltan varios y el botón apagado dice sólo cuántos. El punto es para la
// vista; el lector de pantalla oye "falta completar".
export function MarcaFalta() {
  return (
    <>
      <span
        aria-hidden="true"
        className="ml-2 inline-block size-2.5 rounded-full bg-espera align-middle"
      />
      <span className="sr-only">, falta completar</span>
    </>
  );
}

// El recuadro de un campo de texto. El borde dice el estado: rojo con error,
// verde cuando está bien.
const claseDeEntrada = ({ error, exito }) =>
  [
    "block w-full rounded-campo border-2 bg-tarjeta px-4 min-h-12 text-cuerpo",
    "placeholder:text-tinta-suave",
    error ? "border-rojo" : exito ? "border-completo" : "border-borde-fuerte",
  ].join(" ");

// Un campo por fila. La ayuda va debajo de la etiqueta, siempre visible.
//
// Va en 16 px y gris medio, no en los 15 px del gris suave: la cartilla
// reserva los 15 para datos de apoyo —una hora, el autor de un evento— y la
// ayuda del campo no es apoyo, es la instrucción que evita el error, y
// nuestro público es justo el que no llega a leerla (auditoría, H10). La
// auditoría pedía 17 px, que no existe en la escala de la cartilla (15 · 16 ·
// 18): gana la cartilla, y 16 es el más cercano hacia arriba.
export function Campo({
  etiqueta,
  ayuda,
  error,
  ejemplo,
  exito,
  falta = false,
  children,
  id,
  ...props
}) {
  const idAyuda = ayuda ? `${id}-ayuda` : undefined;
  const idError = error ? `${id}-error` : undefined;

  return (
    <div className="mb-6">
      <label htmlFor={id} className="block font-bold text-cuerpo">
        {etiqueta}
        {falta && <MarcaFalta />}
      </label>
      {ayuda && (
        <p id={idAyuda} className="mt-1 text-etiqueta text-tinta-media">
          {ayuda}
        </p>
      )}

      {children ?? (
        <input
          id={id}
          aria-describedby={[idAyuda, idError].filter(Boolean).join(" ") || undefined}
          aria-invalid={error ? "true" : undefined}
          className={`mt-2 ${claseDeEntrada({ error, exito })}`}
          {...props}
        />
      )}

      {error && (
        <p id={idError} className="mt-2 flex items-start gap-2 font-bold text-rojo text-etiqueta">
          <Icono nombre="alerta" className="size-5 mt-px" />
          <span>
            {error}
            {ejemplo && ` Por ejemplo: ${ejemplo}.`}
          </span>
        </p>
      )}
      {!error && exito && (
        <p className="mt-2 flex items-start gap-2 font-bold text-completo text-etiqueta">
          <Icono nombre="listo" className="size-5 mt-px" />
          <span>{exito}</span>
        </p>
      )}
    </div>
  );
}

// Un campo de contraseña con un ojo adentro para ver lo que se escribe. Lo
// que se ve es lo escrito en este campo: la contraseña guardada no la puede
// mostrar nadie, porque Supabase no la guarda, guarda una huella.
export function CampoContrasena({ etiqueta, ayuda, error, ejemplo, exito, falta, id, ...props }) {
  const [ver, setVer] = useState(false);
  const accion = ver ? "Ocultar la contraseña" : "Mostrar la contraseña";

  return (
    <Campo id={id} etiqueta={etiqueta} ayuda={ayuda} error={error} ejemplo={ejemplo} exito={exito} falta={falta}>
      <div className="relative mt-2">
        <input
          id={id}
          type={ver ? "text" : "password"}
          aria-describedby={[ayuda && `${id}-ayuda`, error && `${id}-error`].filter(Boolean).join(" ") || undefined}
          aria-invalid={error ? "true" : undefined}
          className={`${claseDeEntrada({ error, exito })} pr-14`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVer((v) => !v)}
          aria-label={accion}
          aria-pressed={ver}
          title={accion}
          className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center rounded-r-campo text-tinta-media hover:text-azul"
        >
          <Icono nombre={ver ? "ojo-tachado" : "ojo"} />
        </button>
      </div>
    </Campo>
  );
}

// El error que no es de un campo: no se pudo entrar, el mail ya tiene cuenta,
// el link venció. Va con role="alert" y se lleva el foco cuando aparece: el
// mensaje se dibuja arriba del botón, así que quien usa lector de pantalla
// tocaba "Iniciar sesión", no escuchaba nada y no sabía que había fallado
// (auditoría, H9).
export function ErrorGeneral({ children }) {
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.focus();
  }, [children]);

  return (
    <p
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="mb-6 flex items-start gap-2 font-bold text-rojo text-etiqueta focus:outline-none"
    >
      <Icono nombre="alerta" className="mt-px size-5" />
      <span>{children}</span>
    </p>
  );
}

// Lo que se ve cuando todavía no hay nada. Nunca una pantalla en blanco.
export function Vacio({ icono = "carpeta", titulo, children }) {
  return (
    <Tarjeta className="text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-superficie text-tinta-suave">
        <Icono nombre={icono} />
      </div>
      <p className="mt-3 font-bold text-subtitulo">{titulo}</p>
      {children && <p className="mt-1 text-tinta-media">{children}</p>}
    </Tarjeta>
  );
}

// Mientras llegan los datos: la forma de lo que va a aparecer —un título y
// unas filas—, en gris. Una palabra sola en una pantalla vacía se leía como
// que algo había fallado; ver la forma dice que se está en el lugar correcto
// y que hay que esperar (auditoría, H1). El lector de pantalla oye
// "Cargando…". El pulso se apaga si la persona pidió menos movimiento.
export function Cargando({ filas = 3 }) {
  return (
    <div role="status">
      <span className="sr-only">Cargando…</span>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="h-9 w-2/3 max-w-sm rounded-campo bg-superficie" />
        <div className="mt-3 h-5 w-full max-w-md rounded-campo bg-superficie" />
        <div className="mt-8 flex flex-col gap-3">
          {Array.from({ length: filas }, (_, i) => (
            <div key={i} className="rounded-tarjeta border border-borde bg-tarjeta p-4 sm:p-6">
              <div className="h-5 w-1/2 rounded-campo bg-superficie" />
              <div className="mt-3 h-4 w-3/4 rounded-campo bg-superficie" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
