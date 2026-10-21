// Una frase del diccionario con un elemento adentro (una negrita, un enlace).
//
// La frase se escribe entera, con un marcador {nombre} donde va el elemento
// (patrón de Guardia.js y perfil/page.js), y acá se parte en el marcador: no se
// arma pegando pedazos traducidos. Un marcador sin elemento queda como está.
//
//   conElementos(t("casos.detalle.yaPago", { aprobado }), { pagado: <b>{monto}</b> })
//
// Sin JSX a propósito, como idioma.js: lo pueden importar los tests.

import { Fragment, createElement } from "react";

export function conElementos(texto, elementos) {
  return texto.split(/(\{\w+\})/).map((parte, i) => {
    const elemento = elementos[parte.slice(1, -1)];
    return parte.startsWith("{") && elemento !== undefined
      ? createElement(Fragment, { key: i }, elemento)
      : parte;
  });
}
