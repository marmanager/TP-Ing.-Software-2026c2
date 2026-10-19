// B-1b: el teléfono tiene que poder llegar a WhatsApp. Se guarda en formato
// internacional, sólo dígitos y con código de país: 5493414567890.
//
// El país no se adivina ni se escribe: se elige en un selector al lado del
// campo, que arranca en el país del negocio (negocio.pais, de la 055) y
// muestra lo que se va a agregar (🇦🇷 +54 9). La persona escribe su número
// como lo escribe siempre. Es el patrón de WhatsApp, Stripe y Mercado Pago.
//
// Lo único que el sistema agrega es la regla de celular del país elegido (en
// Argentina, el 9 después del 54): es cómo numera ese país, no una
// suposición, y el chip del selector lo muestra para que no quede oculto.
//
// Un solo campo, y se asume celular (decisión 6 de la tarjeta, tomada en
// B-1a): es lo que sirve para WhatsApp y sirve igual para llamar. Un fijo no
// pasa.
//
// Por qué una tabla propia y no libphonenumber (decisión 9): ocho países
// alcanzan para el alcance del proyecto, la regla queda pura y se prueba
// entera, y no se suma una dependencia de cientos de kilos al navegador por
// un formulario. Si algún día hace falta cobertura mundial, se cambia el
// interior de normalizarTelefono() y armarTelefono() por libphonenumber-js, y
// las pantallas no se enteran.
//
// La misma tabla está en la API (compartido/telefono.ts). Mientras haya dos
// copias tienen que decir lo mismo: las dos se comparan con el patrón literal
// de supabase/055_telefono_internacional.sql (pruebas/historias/
// telefono-internacional.test.js de este lado).
//
// Pura, sin red ni base: la vigila pruebas/fronteras.test.js.

// Ordenados como se muestran en el selector. Los códigos no se pisan entre
// sí (ninguno es el principio de otro), así que el país sale sin ambigüedad
// del principio de un número completo.
export const PAISES = [
  {
    codigo: "AR", nombre: "Argentina", bandera: "🇦🇷", prefijo: "54", celular: "9", digitos: 10,
    // Las características empiezan con 1, 2 o 3, y ninguna es 15.
    patron: "(?:1[0-46-9]|[23][0-9])[0-9]{8}",
    formato: "Característica y número, sin el 0 ni el 15.", ejemplo: "341 456 7890",
  },
  {
    codigo: "UY", nombre: "Uruguay", bandera: "🇺🇾", prefijo: "598", celular: "", digitos: 8,
    patron: "9[0-9]{7}", formato: "El celular sin el 0 de adelante.", ejemplo: "94 123 456",
  },
  {
    codigo: "CL", nombre: "Chile", bandera: "🇨🇱", prefijo: "56", celular: "", digitos: 9,
    patron: "9[0-9]{8}", formato: "El celular, con el 9 de adelante.", ejemplo: "9 6123 4567",
  },
  {
    codigo: "BR", nombre: "Brasil", bandera: "🇧🇷", prefijo: "55", celular: "", digitos: 11,
    patron: "[1-9]{2}9[0-9]{8}", formato: "DDD y número, con el 9 del celular.", ejemplo: "11 91234 5678",
  },
  {
    codigo: "PY", nombre: "Paraguay", bandera: "🇵🇾", prefijo: "595", celular: "", digitos: 9,
    patron: "9[0-9]{8}", formato: "El celular sin el 0 de adelante.", ejemplo: "981 123 456",
  },
  {
    codigo: "BO", nombre: "Bolivia", bandera: "🇧🇴", prefijo: "591", celular: "", digitos: 8,
    patron: "[67][0-9]{7}", formato: "Los ocho dígitos del celular.", ejemplo: "712 34567",
  },
  {
    codigo: "ES", nombre: "España", bandera: "🇪🇸", prefijo: "34", celular: "", digitos: 9,
    patron: "[67][0-9]{8}", formato: "Los nueve dígitos del móvil.", ejemplo: "612 34 56 78",
  },
  {
    codigo: "US", nombre: "Estados Unidos", bandera: "🇺🇸", prefijo: "1", celular: "", digitos: 10,
    patron: "[2-9][0-9]{2}[2-9][0-9]{6}", formato: "Código de área y número.", ejemplo: "201 555 0123",
  },
];

// Cuándo unos dígitos son un celular completo de un país de la lista. Es el
// PATRON_TELEFONO_COMPLETO de la API y el literal de la 055: el 9 de
// Argentina es opcional porque así quedaron guardados algunos de antes, y la
// regla se lo agrega.
export const PATRON_TELEFONO_COMPLETO =
  `^(?:${PAISES.map((p) => p.prefijo + (p.celular ? `${p.celular}?` : "") + p.patron).join("|")})$`;

const POR_DEFECTO = PAISES[0];
const soloDigitos = (texto) => String(texto ?? "").replace(/\D/g, "");

export const paisPorCodigo = (codigo) => PAISES.find((p) => p.codigo === codigo) ?? null;

// Con qué país arranca el selector: el del negocio. Un negocio de antes de
// la 055, una cuenta que todavía no tiene negocio (crear cuenta) o un país
// que este front no conoce arrancan en Argentina, que es el de todos los que
// ya existen. Nunca vacío: elegir el país es corregir un valor, no completar
// un campo.
export const paisInicial = (negocio) => (paisPorCodigo(negocio?.pais) ?? POR_DEFECTO).codigo;

// Lo que muestra el selector: lo que de verdad se va a agregar al número.
export function chipDelPais(codigo) {
  const p = paisPorCodigo(codigo) ?? POR_DEFECTO;
  return `${p.bandera} +${p.prefijo}${p.celular ? ` ${p.celular}` : ""}`;
}

// Cómo se nombra cada opción para quien no ve la bandera: "Argentina, +54 9".
export const nombreDelPais = (codigo) => {
  const p = paisPorCodigo(codigo) ?? POR_DEFECTO;
  return `${p.nombre}, ${chipDelPais(p.codigo).split(" ").slice(1).join(" ")}`;
};

// Lo que se lee debajo de la etiqueta antes de escribir nada, y que cambia
// con el país.
export function ayudaDelPais(codigo) {
  const p = paisPorCodigo(codigo) ?? POR_DEFECTO;
  return `${p.formato} Ejemplo: ${p.ejemplo}.`;
}

// Los dígitos agrupados como el ejemplo del país: 3414567890 → 341 456 7890.
function agrupar(digitos, p) {
  if (digitos.length !== p.digitos) return digitos;
  let i = 0;
  return p.ejemplo
    .split(" ")
    .map((grupo) => digitos.slice(i, (i += grupo.length)))
    .join(" ");
}

const falla = (motivo, mensaje) => ({ ok: false, motivo, mensaje });

// El error dice qué pasa, qué se espera y un ejemplo del país elegido
// (cartilla, 07: "el error no acusa"). El ejemplo va como se escribe en el
// campo, sin el código: el código ya está en el selector.
const explica = (p, causa) => `${causa} ${p.formato} Por ejemplo: ${p.ejemplo}.`;

const NO_SOPORTADO = falla(
  "pais_no_soportado",
  `Ese código de país no está entre los que manejamos: ${PAISES.map((p) => p.nombre).join(", ")}. Elegí uno de la lista.`
);

// El 15 de los celulares argentinos, que se marca dentro del país y no va en
// el formato internacional: adelante de todo, o después de la característica
// (de dos a cuatro dígitos), y entonces sobran dos.
function conQuince(p, resto) {
  if (p.codigo !== "AR") return false;
  return resto.startsWith("15") || (resto.length === p.digitos + 2 && [2, 3, 4].some((i) => resto.startsWith("15", i)));
}

// Los dígitos que van después del código de un país, a internacional.
function delPais(p, digitosDespuesDelCodigo) {
  let resto = digitosDespuesDelCodigo;
  if (p.celular && resto.startsWith(p.celular)) resto = resto.slice(p.celular.length);
  if (resto.startsWith("0")) return falla("empieza_con_cero", explica(p, "Escribilo sin el 0 de adelante."));
  if (conQuince(p, resto)) return falla("con_quince", explica(p, "Escribilo sin el 15."));
  if (resto.length < p.digitos) return falla("corto", explica(p, `Al número le faltan dígitos para ${p.nombre}.`));
  if (resto.length > p.digitos) return falla("largo", explica(p, `Al número le sobran dígitos para ${p.nombre}.`));
  if (!new RegExp(`^${p.patron}$`).test(resto)) return falla("no_es_celular", explica(p, `No es un celular de ${p.nombre}.`));
  return { ok: true, telefono: p.prefijo + p.celular + resto, pais: p.codigo };
}

const sonCaracteresDeTelefono = (texto) => /^[\d\s()+.-]+$/.test(texto);

// Lo que se escribió en el campo del número, con el país del selector:
// { ok: true, telefono, pais } o { ok: false, motivo, mensaje }. Acepta
// espacios, guiones, paréntesis y puntos, como se escriben los números.
export function armarTelefono(codigo, numero) {
  const p = paisPorCodigo(codigo) ?? POR_DEFECTO;
  const escrito = String(numero ?? "").trim();
  if (!escrito) return falla("vacio", explica(p, "Falta el teléfono."));
  if (!sonCaracteresDeTelefono(escrito)) return falla("no_es_numero", explica(p, "El teléfono va sólo con números."));
  return delPais(p, soloDigitos(escrito));
}

// Un teléfono ya completo —guardado, o pegado de un contacto—, la misma regla
// que la API: con +, el código sale del principio; sin +, sólo vale lo que ya
// es un número internacional completo de un país de la lista. Todo lo demás
// es un número local: falta el país, y no se adivina.
export function normalizarTelefono(texto) {
  const escrito = String(texto ?? "").trim();
  if (!escrito || !sonCaracteresDeTelefono(escrito)) return falla("no_es_numero", "El teléfono va sólo con números.");
  const conMas = escrito.replace(/[\s()]/g, "").startsWith("+");
  const digitos = soloDigitos(escrito);
  const p = PAISES.find((x) => digitos.startsWith(x.prefijo));
  if (!conMas) {
    const r = p ? delPais(p, digitos.slice(p.prefijo.length)) : null;
    return r?.ok ? r : falla("sin_pais", "Falta el código de país. Elegí el país y escribí el número.");
  }
  if (!p) return NO_SOPORTADO;
  return delPais(p, digitos.slice(p.prefijo.length));
}

// Lo que se pega o se escribe en el campo del número. Si viene el número
// completo (+54 9 341…, o 5493414567890 copiado de un contacto), el campo lo
// entiende: elige el país y deja el resto, en vez de rechazarlo. Un + con un
// código que no está en la lista se avisa. Lo demás queda como se escribió.
export function separarLoEscrito(texto, paisActual) {
  const escrito = String(texto ?? "");
  const p = paisPorCodigo(paisActual) ?? POR_DEFECTO;
  const conMas = escrito.trim().replace(/[\s()]/g, "").startsWith("+");
  const digitos = soloDigitos(escrito);

  // Sin +, sólo se mira si ya no entra en el país elegido: un número local
  // que alguien está terminando de escribir no se toca.
  if (conMas || digitos.length > p.digitos + p.celular.length) {
    const r = normalizarTelefono(escrito);
    if (r.ok) {
      const del = paisPorCodigo(r.pais);
      return { pais: r.pais, numero: agrupar(r.telefono.slice(del.prefijo.length + del.celular.length), del) };
    }
    if (conMas && r.motivo === "pais_no_soportado") {
      return { pais: p.codigo, numero: escrito, motivo: r.motivo, mensaje: r.mensaje };
    }
    if (conMas) {
      // Un código conocido con el resto mal escrito: el país se elige igual
      // y el resto queda para que se corrija con el ejemplo del país.
      const del = PAISES.find((x) => digitos.startsWith(x.prefijo));
      if (del) return { pais: del.codigo, numero: digitos.slice(del.prefijo.length) };
    }
  }
  return { pais: p.codigo, numero: escrito };
}

// Un teléfono guardado, separado para corregirlo en el campo. Uno de antes,
// sin país, arranca en el país del negocio con sus dígitos de siempre: lo
// más probable es que sólo haya que confirmar el país y guardar. Sin país
// del negocio todavía (null), el país queda null: el campo lo completa
// cuando llegue el negocio.
export function paraEditar(guardado, paisNegocio) {
  const pais = paisPorCodigo(paisNegocio)?.codigo ?? null;
  if (!String(guardado ?? "").trim()) return { pais, numero: "" };
  return separarDelGuardado(guardado) ?? { pais, numero: String(guardado).trim() };
}

function separarDelGuardado(guardado) {
  const r = normalizarTelefono(guardado);
  if (!r.ok) return null;
  const p = paisPorCodigo(r.pais);
  return { pais: p.codigo, numero: agrupar(r.telefono.slice(p.prefijo.length + p.celular.length), p) };
}

// En pantalla: +54 9 341 456 7890, no 5493414567890. Uno de antes, sin
// país, se muestra como está: no se disfraza de internacional.
export function telefonoLegible(guardado) {
  const separado = separarDelGuardado(guardado);
  if (!separado) return String(guardado ?? "").trim();
  return `${chipDelPais(separado.pais).split(" ").slice(1).join(" ")} ${separado.numero}`;
}

// Para un link tel: el número entero con su +, o el de antes como está.
export function telefonoParaLlamar(guardado) {
  const r = normalizarTelefono(guardado);
  return r.ok ? `+${r.telefono}` : soloDigitos(guardado);
}

// Uno guardado antes de exigir el código de país, que así no le llega a
// nadie por WhatsApp. Si la API lo dice (cliente.telefono_incompleto, de la
// 055), manda la API. Sin teléfono no es incompleto: es no tener.
export function telefonoIncompleto(cliente) {
  if (typeof cliente?.telefono_incompleto === "boolean") return cliente.telefono_incompleto;
  return !!String(cliente?.telefono ?? "").trim() && !normalizarTelefono(cliente.telefono).ok;
}

export const FRASE_TELEFONO_INCOMPLETO =
  "A este teléfono le falta el código de país, así que no le llegan los mensajes por WhatsApp. Corregilo eligiendo el país.";
