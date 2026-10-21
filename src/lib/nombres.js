// El nombre de un caso (SCRUM-119).
//
// Cada negocio elige en Mi negocio con qué nace el nombre de sus casos: el
// número de siempre, el nombre del cliente, la patente —o la ficha, o el
// número de serie, según el rubro— o lo que pidió. Después se edita a mano.
//
// El nombre es interno. El cliente, en su link de seguimiento y en los
// WhatsApp, sigue viendo "Caso 271": un nombre que alguien del negocio le puso
// al caso no tiene por qué llegarle.
//
// Tiene test: pruebas/nombres.test.js
//
// "Caso 271" es texto de la app y sale en el idioma de quien mira: `t` va al
// final, y sin él sale en castellano. El nombre que alguien le puso al caso
// se muestra tal cual.

import { tCastellano } from "./idioma.js";

// Lo que se lee primero: el nombre, o "Caso 271" si no tiene.
export function tituloDelCaso(caso, t = tCastellano) {
  return caso?.nombre?.trim() || t("casos.nombre.caso", { numero: caso?.numero });
}

// La línea de abajo del título: lo que pidió y el cliente. Lo que ya dice el
// título no se repite: un caso nombrado por el cliente no lo nombra dos
// veces, y uno nombrado por lo que pidió no dice "Frenos" arriba y abajo.
export function lineaDelCaso(caso, nombreCliente, t = tCastellano) {
  const titulo = tituloDelCaso(caso, t);
  return [caso?.servicio, nombreCliente]
    .filter((parte) => parte && parte !== titulo)
    .join(" · ");
}

// El caso adentro de una frase: "caso 271" o "caso Hugo Peralta". El "el" lo
// pone la frase: `Listo. El ${casoEnFrase(caso)} quedó entregado.`
//
// Existe aparte de tituloDelCaso() a propósito: meter el título en una frase
// que ya dice "el caso" da "el caso Caso 271".
export function casoEnFrase(caso, t = tCastellano) {
  return caso?.nombre?.trim()
    ? t("casos.nombre.enFrase", { numero: caso.nombre.trim() })
    : t("casos.nombre.enFrase", { numero: caso?.numero });
}

// El número en chiquito, abajo del nombre. Sin nombre no hay subtítulo: el
// título ya es "Caso 271" y repetirlo abajo sería decir lo mismo dos veces.
export function subtituloDelCaso(caso, t = tCastellano) {
  return caso?.nombre?.trim() ? t("casos.nombre.caso", { numero: caso.numero }) : null;
}
