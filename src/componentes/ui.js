"use client";

// Piezas base (cartilla, sección 05).
//
// Reglas que estas piezas hacen cumplir solas:
// - Un solo botón azul por pantalla. El resto queda con borde.
// - Los botones se escriben verbo + objeto: "Guardar el caso", no "Aceptar".
// - Un botón apagado siempre dice por qué está apagado.
// - La ayuda de un campo va visible debajo de la etiqueta, nunca escondida.
// - El error va debajo del campo, con ícono, texto rojo y un ejemplo correcto.

import Icono from "./Icono";

const BASE_BOTON =
  "inline-flex items-center justify-center gap-2 rounded-campo px-6 min-h-12 " +
  "font-cuerpo font-bold text-cuerpo transition-colors cursor-pointer " +
  "disabled:cursor-not-allowed";

const VARIANTES = {
  principal: "bg-azul text-white hover:bg-azul-apretado",
  borde: "bg-tarjeta text-azul border-2 border-azul hover:bg-azul-claro",
  peligro: "bg-tarjeta text-rojo border-2 border-rojo hover:bg-rojo/5",
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

// El botón principal en celular va fijo abajo, 56 px de alto y ancho completo.
//
// Fijo, pero ENCIMA de la barra de secciones del celular, no detrás: las dos
// cosas se anclan abajo, y la barra (64 px, Navegacion.js) está por encima
// en el orden de capas. Por eso se clava a 4rem del borde y no a cero. Como
// es sticky y no fixed, ocupa su lugar en la página y el contenido no queda
// tapado. Desde md en adelante no hay barra abajo y el botón va en su lugar,
// con el mismo punto de quiebre que la barra.
export function BotonPrincipalFijo({ children, motivo, ...props }) {
  return (
    <div className="sticky bottom-16 z-10 -mx-4 mt-8 border-t border-borde bg-fondo p-4 sm:-mx-6 sm:px-6 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
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

export function TituloSeccion({ children, className = "" }) {
  return <h2 className={`text-seccion mb-4 ${className}`}>{children}</h2>;
}

// Un campo por fila. La ayuda va debajo de la etiqueta, siempre visible.
export function Campo({
  etiqueta,
  ayuda,
  error,
  ejemplo,
  exito,
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
      </label>
      {ayuda && (
        <p id={idAyuda} className="mt-1 text-apoyo text-tinta-suave">
          {ayuda}
        </p>
      )}

      {children ?? (
        <input
          id={id}
          aria-describedby={[idAyuda, idError].filter(Boolean).join(" ") || undefined}
          aria-invalid={error ? "true" : undefined}
          className={[
            "mt-2 block w-full rounded-campo border-2 bg-tarjeta px-4 min-h-12 text-cuerpo",
            "placeholder:text-tinta-suave",
            error ? "border-rojo" : exito ? "border-completo" : "border-borde-fuerte",
          ].join(" ")}
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

export function Cargando() {
  return (
    <div className="p-6 text-tinta-suave" role="status">
      Cargando…
    </div>
  );
}
