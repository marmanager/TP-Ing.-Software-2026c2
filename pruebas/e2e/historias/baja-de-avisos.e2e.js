import { $, $$, browser, expect } from "@wdio/globals";
import { entrar, noVerTexto, reemplazarTexto, verTexto } from "./ayudas.js";

// R-8b · Mostrar la baja de avisos y poder revertirla (módulo Recordatorios).
//
// Necesita la API con R-8a (migración 054) y su siembra con Rubén Sin
// Avisos (c4), que contestó BAJA hace tres días: la 054 no deja poner esa
// fecha con una sesión de persona, así que la e2e no la puede armar sola.
//
// Al revertir, la API no le vuelve a programar el recordatorio a un turno
// que ya estaba anotado: se programa si se mueve. Sin el número de WhatsApp
// configurado en la API, el turno movido dice whatsapp_no_configurado en vez
// de "programado"; lo que importa acá es que ya no diga baja_de_avisos.

// "2026-10-16T10:00", como lo deja el <input type="datetime-local">.
function enDias(dias, hora = "10:00") {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const dos = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${hora}`;
}

async function ponerValor(selector, valor) {
  await browser.execute((sel, v) => {
    const input = document.querySelector(sel);
    const poner = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    poner.call(input, v);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, selector, valor);
}

async function prenderLaAgendaYElRecordatorio() {
  await browser.url("/negocio/modulos");
  await $("button=Prender Agenda").click();
  await expect($("button=Apagar Agenda")).toBeDisplayed();
  await browser.url("/negocio/recordatorios");
  await $('button[role="switch"]*=Recordatorio del turno').click();
  await reemplazarTexto("#turno-plazo", "24");
  await $("button*=Guardar los recordatorios").click();
  await verTexto("Quedaron prendidos el de antes del turno");
}

async function anotarTurno({ cliente, motivo, cuando }) {
  await browser.url("/agenda");
  await $("button=Anotar un turno").click();
  await $("#turno-cliente").setValue(cliente);
  await $("#turno-motivo").setValue(motivo);
  await ponerValor("#turno-cuando", cuando);
  await $("button=Guardar el turno").click();
  await verTexto(`El turno de ${motivo} quedó anotado`);
}

const filaDe = (motivo) => $(`li*=${motivo}`);

describe("Historia: el cliente pidió no recibir avisos", () => {
  it("AC1 y AC2: la ficha dice cuándo lo pidió y qué quiere decir, sin rojo ni alerta", async () => {
    await entrar("/clientes/{c4}");
    const baja = $("[data-baja-de-avisos]");
    await expect(baja).toHaveText(expect.stringContaining("Pidió no recibir mensajes automáticos el "));
    await expect(baja).toHaveText(
      expect.stringContaining("No le van a llegar los recordatorios de sus turnos ni los mensajes de seguimiento por WhatsApp.")
    );
    await expect(baja.$(".text-rojo")).not.toExist();

    // Un cliente que nunca la pidió no tiene nada de esto.
    await browser.url("/clientes");
    await $("a*=Marcela Suárez").click();
    await expect($("h1")).toHaveText("Marcela Suárez");
    await expect($("[data-baja-de-avisos]")).not.toExist();
  });

  it("AC7: la lista de clientes marca a los que la pidieron", async () => {
    await entrar("/clientes");
    await expect($$("[data-baja-de-avisos]")).toBeElementsArrayOfSize(1);
    const tarjeta = $("li*=Rubén Sin Avisos");
    await expect(tarjeta.$("[data-baja-de-avisos]")).toHaveText("Pidió no recibir avisos");
    await expect($("li*=Marcela Suárez").$("[data-baja-de-avisos]")).not.toExist();
  });

  it("AC4: su turno dice que no le llega el recordatorio y por qué, sin pedir el teléfono", async () => {
    await entrar("/");
    await prenderLaAgendaYElRecordatorio();
    await anotarTurno({ cliente: "Rubén Sin Avisos", motivo: "alinear y balancear", cuando: enDias(3) });

    const fila = await filaDe("alinear y balancear");
    await expect(fila.$('[data-aviso="baja_de_avisos"]')).toHaveText(
      "Pidió no recibir mensajes automáticos, así que no le llega el recordatorio de su turno."
    );
    await expect(fila.$("a=Completar el teléfono")).not.toExist();
    await expect(fila.$('[data-aviso="baja_de_avisos"].text-rojo')).not.toExist();
  });

  it("AC3: se revierte desde la ficha, y su turno deja de mostrar la baja", async () => {
    const ids = await entrar("/");
    await prenderLaAgendaYElRecordatorio();
    await anotarTurno({ cliente: "Rubén Sin Avisos", motivo: "cambiar la batería", cuando: enDias(3) });
    await expect((await filaDe("cambiar la batería")).$('[data-aviso="baja_de_avisos"]')).toBeDisplayed();

    await browser.url(`/clientes/${ids.c4}`);
    await verTexto("Usalo sólo si el cliente te pidió volver a recibirlos.");
    await $("button*=Volver a mandarle avisos").click();
    await verTexto("Listo. Rubén Sin Avisos va a volver a recibir avisos.");
    await expect($("[data-baja-de-avisos]")).not.toExist();

    // Quedó guardado: al volver a cargar, sigue sin la baja.
    await browser.url(`/clientes/${ids.c4}`);
    await expect($("h1")).toHaveText("Rubén Sin Avisos");
    await expect($("[data-baja-de-avisos]")).not.toExist();

    // El turno ya no dice que pidió la baja.
    await browser.url("/agenda");
    let fila = await filaDe("cambiar la batería");
    await expect(fila).toBeDisplayed();
    await expect(fila.$('[data-aviso="baja_de_avisos"]')).not.toExist();

    // Y al moverlo, la API ya no contesta baja_de_avisos: se programa (o,
    // sin WhatsApp configurado en la API, dice eso).
    await fila.$("button=Cambiar la hora").click();
    await ponerValor(`#mover-${await fila.getAttribute("data-turno")}`, enDias(4, "16:30"));
    await fila.$("button*=Guardar la hora nueva").click();
    await verTexto("El turno de cambiar la batería pasó a");

    fila = await filaDe("cambiar la batería");
    const aviso = fila.$("[data-aviso]");
    await expect(aviso).toBeDisplayed();
    const motivo = await aviso.getAttribute("data-aviso");
    expect(["programado", "whatsapp_no_configurado"]).toContain(motivo);
    await noVerTexto("Pidió no recibir mensajes automáticos");
  });
});
