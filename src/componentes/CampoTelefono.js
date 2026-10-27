"use client";

// El campo de teléfono de todo el sistema (B-1b): uno solo, en las pantallas
// que piden un teléfono.
//
//   [🇦🇷 +54 9 ▾] [341 456 7890          ]
//
// El país no se escribe: se elige a la izquierda, y el selector muestra lo
// que de verdad se va a agregar al número. Arranca en el país del negocio,
// así que lo normal es no tocarlo. A la derecha va el número solo, como la
// persona lo escribe siempre. Arriba, antes de escribir, el formato y un
// ejemplo del país elegido; si cambia el país, cambian los dos.
//
// El selector es un <select> de verdad, transparente encima del chip: se
// abre con teclado (flechas, letras, Enter), el lector de pantalla lo anuncia
// con su etiqueta y el país elegido, y en el celular abre la lista nativa.
// El chip es sólo lo que se ve.
//
// Las reglas —qué países hay, cómo se arma el número, qué se dice cuando no
// sirve— están en src/lib/telefono.js. Este componente sólo las muestra.
//
// valor es { pais, numero }; pais null es "el del negocio" (paisPorDefecto),
// porque el negocio puede llegar después de que se abra el formulario. Para
// saber qué guardar, la pantalla usa armarTelefono(pais, numero).

import { useState } from "react";
import { Campo, claseDeEntrada } from "./ui";
import { useIdioma } from "@/lib/useIdioma";
import {
  armarTelefono,
  ayudaDelPais,
  chipDelPais,
  nombreDelPais,
  PAISES,
  paraEditar,
  separarLoEscrito,
} from "@/lib/telefono";

// El estado del campo para una pantalla: lo que se ve ({ pais, numero }), lo
// que se arma con eso y lo que se guarda. Así las pantallas no repiten la
// misma cuenta: telefono es el internacional si sirve, o lo escrito si no
// (y entonces armado dice por qué).
export function useTelefono(guardado, paisPorDefecto) {
  const { t } = useIdioma();
  const [valor, setValor] = useState(() => paraEditar(guardado, null));
  const armado = armarTelefono(valor.pais ?? paisPorDefecto, valor.numero, t);
  return {
    valor,
    setValor,
    vacio: !valor.numero.trim(),
    armado,
    telefono: armado.ok ? armado.telefono : valor.numero.trim(),
    // Poner uno guardado: el de un cliente elegido de la lista, o vaciarlo.
    cargar: (otro) => setValor(paraEditar(otro, null)),
  };
}

export default function CampoTelefono({
  id,
  etiqueta,
  // Lo que la pantalla quiera decir antes del formato del país: "Opcional.
  // Lo va a ver el cliente…".
  ayuda,
  valor,
  onChange,
  onBlur,
  paisPorDefecto = "AR",
  error,
  exito,
  falta = false,
  autoFocus,
}) {
  const { t } = useIdioma();
  const pais = valor?.pais ?? paisPorDefecto;
  const numero = valor?.numero ?? "";
  // Un + con un código que no está en la lista: se avisa al momento, sin
  // esperar a que se termine de escribir.
  const [aviso, setAviso] = useState(null);

  const idAyuda = `${id}-ayuda`;
  const errorVisible = aviso ?? error;
  const idError = errorVisible ? `${id}-error` : undefined;
  const describe = [idAyuda, idError].filter(Boolean).join(" ");

  const alEscribir = (texto) => {
    const r = separarLoEscrito(texto, pais, t);
    setAviso(r.mensaje ?? null);
    onChange({ pais: r.pais, numero: r.numero });
  };

  return (
    <Campo id={id} etiqueta={etiqueta ?? t("ui.telefono.etiqueta")} falta={falta} ayuda={[ayuda, ayudaDelPais(pais, t)].filter(Boolean).join(" ")} error={errorVisible} exito={exito}>
      <div className="mt-2 flex gap-2">
        <div
          className={[
            "relative flex shrink-0 items-center gap-1 rounded-campo border-2 bg-superficie px-3 min-h-12",
            "font-bold text-cuerpo text-tinta",
            "has-[select:focus-visible]:outline-3 has-[select:focus-visible]:outline-offset-2",
            "has-[select:focus-visible]:outline-azul",
            errorVisible ? "border-rojo" : "border-borde-fuerte",
          ].join(" ")}
        >
          <span aria-hidden="true" className="whitespace-nowrap">
            {chipDelPais(pais)}
          </span>
          <span aria-hidden="true" className="text-tinta-media">
            ▾
          </span>
          <select
            id={`${id}-pais`}
            aria-label={t("ui.telefono.pais")}
            aria-describedby={idAyuda}
            value={pais}
            onChange={(e) => {
              setAviso(null);
              onChange({ pais: e.target.value, numero });
            }}
            className="absolute inset-0 w-full cursor-pointer opacity-0"
          >
            {PAISES.map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.bandera} {nombreDelPais(p.codigo, t)}
              </option>
            ))}
          </select>
        </div>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          autoFocus={autoFocus}
          aria-describedby={describe}
          aria-invalid={errorVisible ? "true" : undefined}
          className={`min-w-0 flex-1 ${claseDeEntrada({ error: errorVisible, exito })}`}
          value={numero}
          onChange={(e) => alEscribir(e.target.value)}
          onBlur={onBlur}
        />
      </div>
    </Campo>
  );
}
