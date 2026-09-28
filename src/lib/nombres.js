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

// Cómo nacen los nombres. "numero" es el de siempre, y el que tienen todos
// los negocios de antes de esta opción.
export const MODOS_DE_NOMBRE = ["numero", "cliente", "identificador", "servicio"];

// Con qué nombre nace un caso, según lo elegido en Mi negocio.
//
// Devuelve null cuando no hay nombre que poner —por número, o porque el dato
// elegido vino vacío—, y entonces el caso se ve con su número. Nunca un nombre
// en blanco: un título vacío en la lista de casos no se puede tocar ni leer.
export function nombreInicial(modo, { cliente, identificador, servicio } = {}) {
  const fuentes = { cliente, identificador, servicio };
  // Un modo que no es ninguno de estos —un negocio guardado antes de que
  // existiera la opción, o un valor roto— se trata como "por número".
  if (!Object.hasOwn(fuentes, modo)) return null;
  return fuentes[modo]?.trim() || null;
}

// Lo que se lee primero: el nombre, o "Caso 271" si no tiene.
export function tituloDelCaso(caso) {
  return caso?.nombre?.trim() || `Caso ${caso?.numero}`;
}

// La línea de abajo del título: lo que pidió y el cliente. Lo que ya dice el
// título no se repite: un caso nombrado por el cliente no lo nombra dos
// veces, y uno nombrado por lo que pidió no dice "Frenos" arriba y abajo.
export function lineaDelCaso(caso, nombreCliente) {
  const titulo = tituloDelCaso(caso);
  return [caso?.servicio, nombreCliente]
    .filter((parte) => parte && parte !== titulo)
    .join(" · ");
}

// El caso adentro de una frase: "caso 271" o "caso Hugo Peralta". El "el" lo
// pone la frase: `Listo. El ${casoEnFrase(caso)} quedó entregado.`
//
// Existe aparte de tituloDelCaso() a propósito: meter el título en una frase
// que ya dice "el caso" da "el caso Caso 271".
export function casoEnFrase(caso) {
  return `caso ${caso?.nombre?.trim() || caso?.numero}`;
}

// El número en chiquito, abajo del nombre. Sin nombre no hay subtítulo: el
// título ya es "Caso 271" y repetirlo abajo sería decir lo mismo dos veces.
export function subtituloDelCaso(caso) {
  return caso?.nombre?.trim() ? `Caso ${caso.numero}` : null;
}
