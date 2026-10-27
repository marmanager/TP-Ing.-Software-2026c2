// Una frase del diccionario con elementos en medio (una palabra en negrita, un
// enlace). La frase se escribe entera, con marcadores {nombre} en el lugar de
// cada elemento, y se corta ahí: nunca se arma pegando pedazos traducidos
// (docs/idiomas.md). Los marcadores que no están en "partes" quedan como están.
//
//   <Frase texto={t("negocio.horarios.atiendes", { desde, hasta })}
//          partes={{ dias: <b>{dias}</b> }} />
//
// Para que un marcador llegue acá sin reemplazar, no se pasa en los vars de t().

import { Fragment } from "react";

export default function Frase({ texto, partes }) {
  return (
    <>
      {String(texto ?? "").split(/(\{\w+\})/).map((trozo, i) => {
        const clave = /^\{(\w+)\}$/.exec(trozo)?.[1];
        return clave && clave in partes ? <Fragment key={i}>{partes[clave]}</Fragment> : trozo;
      })}
    </>
  );
}
