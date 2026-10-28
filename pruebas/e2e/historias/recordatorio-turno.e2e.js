import { $, browser, expect } from "@wdio/globals";
import { entrar, noVerTexto, reemplazarTexto, tid, verTexto } from "./ayudas.js";
import { avisoEnPalabras } from "../../../src/lib/recordatorios.js";

// R-4b · Recordarle el turno al cliente (módulo Recordatorios).
//
// Necesita la API con R-4a (migración 050) y, para que el aviso se programe
// de verdad, el número de WhatsApp configurado en esa API (KAPSO_API_KEY y
// KAPSO_PHONE_NUMBER_ID): sin él, la API anota el turno y contesta que falta
// configurar WhatsApp. Ver el aviso enviado o fallido necesita además que el
// listado de turnos traiga el último aviso (pedido a la API, seguimiento de
// R-4a); eso lo cubre la prueba pura.
//
// "taller-completo" viene sin la agenda: la prueba la prende desde Módulos.
// Marcela Suárez (c1) tiene teléfono.

// "2026-10-16T10:00", la hora como la deja el <input type="datetime-local">,
// a "dias" de hoy.
function enDias(dias, hora = "10:00") {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const dos = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${hora}`;
}

// La frase que tiene que mostrar el turno: la misma cuenta que hace la API
// (empieza menos las horas), dicha por la lógica del front.
const fraseDelAviso = (horaLocal, horas) =>
  avisoEnPalabras({
    aviso: { estado: "pendiente", enviar_en: new Date(new Date(horaLocal).getTime() - horas * 3_600_000).toISOString() },
    ahora: Date.now(),
  }).frase;

// El <input type="datetime-local"> se escribe distinto según el idioma del
// navegador: se le pone el valor y se avisa a React.
async function ponerValor(selector, valor) {
  await browser.execute((sel, v) => {
    const input = document.querySelector(sel);
    const poner = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    poner.call(input, v);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, selector, valor);
}

async function prenderLaAgenda() {
  await browser.url("/negocio/modulos");
  await tid("modulo-alternar-agenda").click();
  await expect(tid("modulo-alternar-agenda")).toHaveAttribute("aria-checked", "true");
}

async function prenderElRecordatorioDeTurnos(horas = "24") {
  await browser.url("/negocio/recordatorios/turno");
  await tid("recordatorio-turno-interruptor").click();
  await reemplazarTexto("#turno-plazo", horas);
  await tid("recordatorio-guardar").click();
  await verTexto("«Antes del turno» quedó prendido");
}

async function anotarTurno({ cliente, telefono = null, motivo, cuando }) {
  await browser.url("/agenda");
  await tid("agenda-anotar").click();
  await $("#turno-cliente").setValue(cliente);
  if (telefono !== null) await $("#turno-telefono").setValue(telefono);
  await $("#turno-motivo").setValue(motivo);
  await ponerValor("#turno-cuando", cuando);
  await tid("turno-guardar").click();
  await verTexto(`El turno de ${motivo} quedó anotado`);
}

const filaDe = (motivo) => $(`li*=${motivo}`);

describe("Historia: recordarle el turno al cliente", () => {
  it("AC12: con la agenda apagada, sólo está el de después de entregar", async () => {
    await entrar("/negocio/recordatorios");
    await expect($("h1")).toHaveText("Recordatorios por WhatsApp");
    await verTexto("Después de entregar");
    await noVerTexto("Antes del turno");
  });

  it("AC1, AC3, AC5 y AC6: en Mi negocio están los dos, cada uno con su plazo y su frase", async () => {
    await entrar("/");
    await prenderLaAgenda();
    await browser.url("/negocio");
    await expect($("#recordatorios")).toBeDisplayed();
    await $("a=Ver y cambiar los recordatorios").click();
    // La lista tiene una fila por recordatorio; cada uno se edita en la suya.
    await verTexto("Antes del turno");
    await $('a[href="/negocio/recordatorios/turno"]').click();

    await tid("recordatorio-turno-interruptor").click();
    await expect($("#turno-plazo")).toHaveValue("24");
    await expect($("#turno-frase")).toHaveText("Le llega al cliente el día anterior a su turno, a la misma hora.");
    await reemplazarTexto("#turno-plazo", "2");
    await expect($("#turno-frase")).toHaveText("Le llega al cliente dos horas antes de su turno.");

    // AC4: el texto viene con la sugerencia del rubro y se edita.
    await expect($("#turno-mensaje")).not.toHaveValue("");

    // AC5: vacío, el botón se apaga y dice por qué.
    await reemplazarTexto("#turno-mensaje", " ");
    await expect(tid("recordatorio-guardar")).toBeDisabled();
    await expect(tid("recordatorio-guardar")).toHaveText(expect.stringContaining("falta el texto del mensaje"));
  });

  it("AC2: prender el de turnos no toca el de después de entregar", async () => {
    await entrar("/");
    await prenderLaAgenda();
    await prenderElRecordatorioDeTurnos();
    await browser.url("/negocio");
    await expect($("#recordatorios + div")).toHaveText(expect.stringContaining("Después de entregar: apagado."));
    await expect($("#recordatorios + div")).toHaveText(expect.stringContaining("Antes del turno: prendido."));
  });

  it("AC10: un turno de un cliente sin teléfono lo señala y ofrece completarlo", async () => {
    await entrar("/");
    await prenderLaAgenda();
    await prenderElRecordatorioDeTurnos();
    await anotarTurno({ cliente: "Persona Sin Teléfono", motivo: "revisar frenos", cuando: enDias(3) });
    const fila = await filaDe("revisar frenos");
    await expect(fila.$('[data-aviso="sin_telefono"]')).toBeDisplayed();
    await expect(tid("turno-completar-telefono", fila)).toBeDisplayed();
  });

  it("AC7 y AC11: el turno muestra cuándo le llega el aviso, y al moverlo, la fecha nueva", async () => {
    await entrar("/");
    await prenderLaAgenda();
    await prenderElRecordatorioDeTurnos("24");
    const cuando = enDias(3);
    await anotarTurno({ cliente: "Marcela Suárez", motivo: "cambio de aceite", cuando });

    let fila = await filaDe("cambio de aceite");
    await expect(fila.$('[data-aviso="programado"]')).toHaveText(fraseDelAviso(cuando, 24));

    const despues = enDias(4, "16:30");
    await tid("turno-cambiar-hora", fila).click();
    await ponerValor(`#mover-${await fila.getAttribute("data-turno")}`, despues);
    await tid("turno-mover-guardar", fila).click();
    await verTexto("El turno de cambio de aceite pasó a");

    fila = await filaDe("cambio de aceite");
    await expect(fila.$('[data-aviso="programado"]')).toHaveText(fraseDelAviso(despues, 24));
  });
});
