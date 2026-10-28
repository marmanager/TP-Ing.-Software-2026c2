import { $, browser, expect } from "@wdio/globals";
import { Key } from "webdriverio";

import { sembrar } from "../siembra.js";

// Cada prueba entra con una cuenta nueva sembrada por la API (../siembra.js):
// datos de verdad, en la base de pruebas, que la prueba puede cambiar sin
// pisar a la siguiente. Los escenarios están en la API
// (src/modulos/semilla/escenarios.ts): "taller-completo" es Taller Sur, con
// Diego, Nico y Sofía, Marcela, Lucía y Ana, y los casos 248, 239, 253 y 210.

// Donde el front guarda la sesión: LLAVE en src/lib/sesion.js.
const LLAVE_SESION = "marmanager.sesion.v1";

// El uuid de cada clave del último escenario sembrado ("k248", "c1").
let ids = {};

// "/casos/{k248}" → "/casos/<uuid del caso 248>".
export const ruta = (plantilla) =>
  plantilla.replace(/\{(\w+)\}/g, (_, clave) => {
    if (!ids[clave]) throw new Error(`El escenario sembrado no tiene «${clave}»`);
    return ids[clave];
  });

// Deja guardada la sesión de una cuenta ya sembrada (lo que devuelve sembrar)
// como la deja entrar (src/lib/sesion.js) y abre la ruta. Sirve para pasar de
// una cuenta a otra dentro de una misma prueba. Devuelve los ids.
export async function iniciarCon(datos, destino = "/") {
  ids = datos.ids;
  const sesion = {
    token: datos.token,
    refresh_token: datos.refresh_token,
    vence_en: Number(datos.vence_en),
    auth_usuario: datos.auth_usuario,
    recuperando: false,
  };
  await browser.url("/iniciar-sesion");
  await browser.execute((llave, valor) => {
    window.localStorage.clear();
    window.localStorage.setItem(llave, valor);
  }, LLAVE_SESION, JSON.stringify(sesion));
  // Un documento nuevo: la sesión se lee al montar la app.
  await browser.url(ruta(destino));
  await expect($("body")).toBeDisplayed();
  return ids;
}

// Siembra el escenario y entra con esa cuenta. Devuelve los ids.
export async function entrar(destino = "/", escenario = "taller-completo") {
  return iniciarCon(await sembrar(escenario), destino);
}

// Un negocio recién creado desde la app no tiene suscripción y Guardia lo
// manda a /planes (lib/suscripcion.js). Los sembrados ya traen el mes de
// prueba; uno nuevo lo empieza como lo haría la dueña.
export async function empezarElMesGratis() {
  await browser.waitUntil(async () => (await browser.getUrl()).includes("/planes"), {
    timeoutMsg: "El alta no llevó a elegir un plan",
  });
  await $("button=Empezar mi mes gratis").click();
  await $("button=Ir a la app").click();
}

// Cambia lo que ya dice un campo como lo haría una persona: lo selecciona
// entero y escribe encima. setValue a veces borra sin que React se entere, y
// lo nuevo queda pegado a lo de antes ("341 222 3333341 444 5566").
export async function reemplazarTexto(selector, texto) {
  await $(selector).click();
  await browser.keys([Key.Ctrl, "a"]);
  await browser.keys(texto);
}

export async function cargarArchivoEnInput({ nombre, tipo, contenido }) {
  await browser.execute(({ nombre, tipo, contenido }) => {
    const input = document.querySelector('input[type="file"]');
    const bytes = Uint8Array.from(atob(contenido), (c) => c.charCodeAt(0));
    const archivo = new File([bytes], nombre, { type: tipo });
    const transferencia = new DataTransfer();
    transferencia.items.add(archivo);
    Object.defineProperty(input, "files", { value: transferencia.files, configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, { nombre, tipo, contenido });
}

// Un elemento por su data-testid: no depende del texto, del idioma ni del
// estilo. Convención: pantalla-elemento, en kebab-case (caso-estado).
export const tid = (id) => $(`[data-testid="${id}"]`);

export async function verTexto(texto) {
  await expect($("body")).toHaveText(expect.stringContaining(texto));
}

export async function noVerTexto(texto) {
  await expect($("body")).not.toHaveText(expect.stringContaining(texto));
}
