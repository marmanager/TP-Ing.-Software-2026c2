import { $, browser, expect } from "@wdio/globals";
import { entrar, noVerTexto, reemplazarTexto, ruta, verTexto } from "./ayudas.js";
import { fechaSugerida } from "../../../src/lib/recordatorios.js";
import { diaDeArgentina, diaEnPalabras } from "../../../src/lib/fechas.js";

// R-1b · Anotar cuándo le toca volver (módulo Recordatorios).
//
// Necesita la API con R-1a (volver_en, migración 048). "taller-completo" es
// un taller: el intervalo típico es de seis meses. El caso 239 es de
// Marcela Suárez (c1), que no tiene ninguna fecha anotada al empezar.

const HOY = diaDeArgentina();

// El <input type="date"> se escribe distinto según el idioma del navegador
// (dd/mm/aaaa, mm/dd/aaaa). Se le pone el valor como lo deja el
// calendario, "2027-05-20", y se avisa a React como si se hubiera elegido.
async function ponerFecha(selector, dia) {
  await browser.execute((sel, valor) => {
    const input = document.querySelector(sel);
    const poner = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    poner.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, selector, dia);
}

// La entrega va en dos pasos: el cobro, y después cuándo vuelve y el
// seguimiento. Deja abierto el segundo.
async function abrirEntrega() {
  await $("button=Entregar y cerrar").click();
  await $("button=Siguiente").click();
  await expect($("#volver-en")).toBeDisplayed();
}

async function irALaFicha() {
  await browser.url(ruta("/clientes/{c1}"));
  await expect($("h1")).toHaveText(expect.stringContaining("Marcela"));
}

describe("Historia: anotar cuándo le toca volver", () => {
  beforeEach(async () => {
    await entrar("/casos/{k239}");
    await expect($("h1")).toHaveText(expect.stringContaining("Caso 239"));
  });

  it("AC1 y AC2: al entregar, la fecha viene cargada con el intervalo del rubro y explicada", async () => {
    await abrirEntrega();
    await expect($("#volver-en")).toHaveValue(fechaSugerida({ rubro: "taller", hoy: HOY }));
    await expect($("#volver-en-ayuda")).toHaveText(expect.stringContaining("dejalo vacío"));
  });

  it("volver al cobro no borra la fecha elegida, y nada se guarda hasta el final", async () => {
    await abrirEntrega();
    await ponerFecha("#volver-en", "2030-05-20");
    await $("button=Volver al cobro").click();
    await expect($("button=Siguiente")).toBeDisplayed();
    await $("button=Siguiente").click();
    await expect($("#volver-en")).toHaveValue("2030-05-20");
    await noVerTexto("El caso está cerrado");
  });

  it("si la API rechaza el cobro, el error se muestra en el paso del cobro", async () => {
    await $("button=Entregar y cerrar").click();
    await $("button=Cobré otra cosa").click();
    // Más de lo aprobado ($120.000): la API no lo deja anotar.
    await reemplazarTexto("#cobro", "125000");
    await $("button=Siguiente").click();
    await $("button=Sí, entregar y cerrar").click();

    await expect($("#cobro")).toBeDisplayed();
    await expect($("p[role=alert]")).toHaveText(expect.stringContaining("supera lo que falta cobrar"));
    await noVerTexto("El caso está cerrado");
  });

  it("AC5: con una fecha que ya pasó, el botón queda apagado y dice por qué", async () => {
    await abrirEntrega();
    await ponerFecha("#volver-en", "2020-01-01");
    const boton = $("button*=la fecha ya pasó");
    await expect(boton).toBeDisplayed();
    await expect(boton).toBeDisabled();
    await verTexto("Esa fecha ya pasó.");
  });

  it("AC3 y AC9: sin fecha el caso se entrega igual, y la ficha no muestra una sección vacía", async () => {
    await abrirEntrega();
    await $("button=No tiene que volver").click();
    await expect($("#volver-en")).toHaveValue("");
    await $("button=Sí, entregar y cerrar").click();

    await verTexto("El caso está cerrado");
    await verTexto("No anotaste cuándo le toca volver.");
    await irALaFicha();
    await noVerTexto("Le toca volver");
  });

  it("AC6, AC7 y AC8: se entrega con fecha, sigue al recargar, se ve en la ficha y se corrige", async () => {
    await abrirEntrega();
    await ponerFecha("#volver-en", "2030-05-20");
    await $("button=Sí, entregar y cerrar").click();
    await verTexto("El caso está cerrado");

    await browser.refresh();
    await verTexto(`Le toca volver el ${diaEnPalabras("2030-05-20")}`);

    // Corregirla desde el caso ya entregado.
    await $("button=Cambiar la fecha").click();
    await ponerFecha("#volver-en-cerrado", "2030-06-03");
    await $("button=Guardar la fecha").click();
    await verTexto(`Le toca volver el ${diaEnPalabras("2030-06-03")}`);

    await irALaFicha();
    await verTexto("Le toca volver");
    await verTexto(`El ${diaEnPalabras("2030-06-03")}`);
  });
});
