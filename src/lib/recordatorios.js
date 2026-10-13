// Recordatorios: avisarle al cliente lo que le sirve, con datos que el
// sistema ya tiene (../Modulo-recordatorios.md).
//
// Esta es la primera pieza (R-1b): cuándo le toca volver. Se anota al
// entregar el caso, con la fecha típica del rubro ya cargada, y la ficha del
// cliente muestra la próxima. De acá van a colgar las reglas de R-4 a R-6.
//
// Dos reglas que valen para todo el archivo:
//
//   · "hoy" entra por parámetro, en todas las funciones. Nunca new Date()
//     adentro: si no, un test que dice "una fecha anterior a hoy se rechaza"
//     empieza a fallar solo según el día.
//
//   · Las fechas son días del calendario, como strings "2026-10-13", de
//     punta a punta. No pasan por Date ni por toISOString(): eso las vuelve
//     un instante, y el huso horario corre una entrega de las 22 h al día
//     siguiente (el aviso de pruebas/calendario.test.js). Las cuentas se
//     hacen con números de día, sin hora.
//
// No tiene React ni red adentro, como lib/seguimiento.js: así lo corre Jest
// y lo vigila pruebas/fronteras.test.js.

import { cadaCuantoVuelve } from "./presets.js";

// ------------------------------------------------------------
// Días del calendario
// ------------------------------------------------------------

const DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

const partes = (fecha) => {
  const m = DIA.exec(fecha ?? "");
  return m ? { a: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
};

const dosCifras = (n) => String(n).padStart(2, "0");
const escribir = ({ a, m, d }) => `${String(a).padStart(4, "0")}-${dosCifras(m)}-${dosCifras(d)}`;

const bisiesto = (a) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
const diasDelMes = (a, m) => [31, bisiesto(a) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

// El número de día desde una fecha fija, para restar y sumar días sin Date.
// Es la cuenta de "días desde el 1/1/1970" del calendario gregoriano.
function numeroDeDia({ a, m, d }) {
  const año = m <= 2 ? a - 1 : a;
  const era = Math.floor(año / 400);
  const dentroDeLaEra = año - era * 400;
  const delAño = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const deLaEra = dentroDeLaEra * 365 + Math.floor(dentroDeLaEra / 4) - Math.floor(dentroDeLaEra / 100) + delAño;
  return era * 146097 + deLaEra - 719468;
}

function deNumeroDeDia(n) {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const deLaEra = z - era * 146097;
  const dentroDeLaEra = Math.floor(
    (deLaEra - Math.floor(deLaEra / 1460) + Math.floor(deLaEra / 36524) - Math.floor(deLaEra / 146096)) / 365
  );
  const delAño = deLaEra - (365 * dentroDeLaEra + Math.floor(dentroDeLaEra / 4) - Math.floor(dentroDeLaEra / 100));
  const mp = Math.floor((5 * delAño + 2) / 153);
  const d = delAño - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { a: dentroDeLaEra + era * 400 + (m <= 2 ? 1 : 0), m, d };
}

const sumarDias = (fecha, dias) => escribir(deNumeroDeDia(numeroDeDia(partes(fecha)) + dias));

const diasEntre = (desde, hasta) => numeroDeDia(partes(hasta)) - numeroDeDia(partes(desde));

// "En seis meses" desde el 31 de agosto es el último de febrero, no el 3 de
// marzo: el día se recorta al largo del mes al que se llega.
function sumarMeses(fecha, meses) {
  const { a, m, d } = partes(fecha);
  const total = a * 12 + (m - 1) + meses;
  const año = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  return escribir({ a: año, m: mes, d: Math.min(d, diasDelMes(año, mes)) });
}

// Las fechas tienen la misma forma, así que el orden de los strings es el
// orden del calendario.
const yaPaso = (fecha, hoy) => fecha < hoy;

// ------------------------------------------------------------
// Cuándo le toca volver
// ------------------------------------------------------------

// La fecha que se ofrece ya cargada al entregar: hoy más el intervalo típico
// del rubro. Un rubro sin intervalo no sugiere nada.
export function fechaSugerida({ rubro, hoy }) {
  const intervalo = cadaCuantoVuelve(rubro);
  return intervalo ? sumarMeses(hoy, intervalo.meses) : null;
}

// Por qué no sirve la fecha, o null si sirve. Vacía sirve: no todos los
// trabajos tienen una próxima vez, y entregar no se traba por eso. Hoy
// sirve. Es la misma regla que valida la API (422 volver_en_pasado): acá se
// mira antes para no ofrecer un botón que va a fallar.
export function errorDeVolverEn(fecha, hoy) {
  if (!fecha) return null;
  if (!partes(fecha)) return "Elegí un día del calendario.";
  return yaPaso(fecha, hoy) ? "la fecha ya pasó" : null;
}

// La próxima visita de un cliente: de las fechas de sus casos, la más
// cercana que todavía no pasó. El dato vive en el caso y no en el cliente
// porque un cliente de taller puede tener dos autos con mantenimientos
// distintos; la ficha muestra la que viene primero.
export function proximaVisita(casos = [], hoy) {
  const futuras = (casos ?? [])
    .map((c) => c?.volver_en)
    .filter((f) => partes(f) && !yaPaso(f, hoy))
    .sort();
  return futuras[0] ?? null;
}

// Para los clientes que vienen de antes y no tienen fecha anotada: si sus
// visitas están espaciadas parejo, cada cuánto viene. Lo sugiere, no lo
// impone: la pantalla lo ofrece y el encargado decide.
//
// Pide tres visitas como mínimo (dos intervalos que comparar) y que cada
// intervalo no se aleje más de un cuarto del promedio. Con menos, o con un
// ritmo desparejo, adivinar se equivoca más de lo que ayuda.
const MINIMO_DE_VISITAS = 3;
const TOLERANCIA = 0.25;

export function intervaloDeducido(visitas = [], hoy) {
  const fechas = [...new Set((visitas ?? []).filter((f) => partes(f) && !(f > hoy)))].sort();
  if (fechas.length < MINIMO_DE_VISITAS) return null;

  const intervalos = fechas.slice(1).map((f, i) => diasEntre(fechas[i], f));
  const promedio = intervalos.reduce((s, n) => s + n, 0) / intervalos.length;
  if (promedio < 1) return null;
  if (intervalos.some((n) => Math.abs(n - promedio) > promedio * TOLERANCIA)) return null;

  const dias = Math.round(promedio);
  return { dias, fecha: sumarDias(hoy, dias) };
}

// Lo que viaja a la API (R-1a): el día tal cual, o null cuando el campo
// quedó vacío. null es "sin fecha" —al entregar, y borra una que había al
// corregir—; un string vacío la API lo rechazaría como fecha que no es.
export const volverEnParaLaApi = (valor) => (valor ?? "").trim() || null;
