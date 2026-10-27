import { $, $$, browser, expect } from "@wdio/globals";
import { iniciarCon, noVerTexto, verTexto } from "./ayudas.js";
import { sembrar } from "../siembra.js";
import { avisoEnviado, cambiar, respuesta, turno } from "./respuestas-en-la-base.js";

// R-10b · Mostrar las respuestas del cliente (módulo Recordatorios).
//
// Necesita la API con R-10a y la base con la 069 y la 070 (sin la 070, lo
// que contestan a un recordatorio de turno no entra ni se ve). Lo que
// contestó cada cliente se carga directo en la base de Docker
// (respuestas-en-la-base.js): en las pruebas no sale ningún WhatsApp, así
// que no hay avisos de verdad que contestar.
//
// Una sola cuenta para toda la historia: Taller Sur, con
//   · Marcela (c1), que confirmó su turno con un «sí» y además preguntó dos
//     cosas sobre el caso 248, una citando el aviso y otra no;
//   · Lucía (c2), que avisó que no puede venir a su turno;
//   · Ana (c3), que recibió el recordatorio y todavía no contestó.

const HORA = 3_600_000;
const instante = (ms) => new Date(ms).toISOString();

let datos;

describe("Historia: las respuestas del cliente", () => {
  before(async () => {
    datos = await sembrar("taller-completo");
    const { ids } = datos;
    const ahora = Date.now();
    const negocio_id = ids.n1;

    // Los tres turnos, en los próximos días, con su recordatorio ya enviado.
    const turnos = [
      { cliente: "c1", telefono: "5493414567890", motivo: "Service de los 10.000", dias: 2 },
      { cliente: "c2", telefono: "5493415551111", motivo: "Ruido en el tren delantero", dias: 3 },
      { cliente: "c3", telefono: "5493415552222", motivo: "Revisión de frenos", dias: 4 },
    ];
    const anotados = {};
    for (const t of turnos) {
      const empieza_en = instante(ahora + t.dias * 24 * HORA);
      const fila = await turno({ negocio_id, cliente_id: ids[t.cliente], motivo: t.motivo, empieza_en });
      const aviso = await avisoEnviado({
        negocio_id, tipo: "turno", telefono: t.telefono, turno_id: fila.id, turno_empieza_en: empieza_en,
        procesado_en: instante(ahora - 5 * HORA), mensaje_id: `wamid.aviso-${t.cliente}`,
      });
      anotados[t.cliente] = { fila, aviso };
    }

    // Lo que contestaron al recordatorio, como lo deja la API: el mensaje
    // en las respuestas y lo que quiso decir en el turno, con la misma hora.
    const confirmo = instante(ahora - 2 * HORA);
    await respuesta({ aviso: anotados.c1.aviso, cliente_id: ids.c1, texto: "sí", enviado_en: confirmo, citada: true });
    await cambiar("turno", anotados.c1.fila.id, { estado: "confirmado", respuesta_cliente: "confirmo", respuesta_cliente_en: confirmo });

    const noPuede = instante(ahora - HORA);
    await respuesta({ aviso: anotados.c2.aviso, cliente_id: ids.c2, texto: "no puedo", enviado_en: noPuede });
    await cambiar("turno", anotados.c2.fila.id, { respuesta_cliente: "no_puede", respuesta_cliente_en: noPuede });

    // Dos preguntas sobre el caso 248, que no resolvió nada sola. La
    // primera, a las 22:30 del 19 de octubre en Argentina (01:30 del 20 en
    // UTC) y citando el aviso del presupuesto; la segunda, sin citar.
    const avisoDelCaso = await avisoEnviado({
      negocio_id, tipo: "presupuesto", telefono: "5493414567890", caso_id: ids.k248,
      procesado_en: "2026-10-19T13:00:00.000Z", mensaje_id: "wamid.aviso-k248",
    });
    await respuesta({
      aviso: avisoDelCaso, cliente_id: ids.c1, citada: true,
      texto: "¿Cuánto sale la pieza?  🙏\nla de adelante", enviado_en: "2026-10-20T01:30:00.000Z",
      creado_en: instante(ahora - 30 * HORA),
    });
    await respuesta({
      aviso: avisoDelCaso, cliente_id: ids.c1, texto: "dale, gracias",
      enviado_en: "2026-10-21T15:00:00.000Z", creado_en: instante(ahora - 29 * HORA),
    });

    // La agenda viene apagada en la siembra.
    await iniciarCon(datos, "/negocio/modulos");
    await $("button=Prender Agenda").click();
    await expect($("button=Apagar Agenda")).toBeDisplayed();
  });

  it("AC4 y AC5: la agenda dice quién confirmó, quién no puede y quién no contestó", async () => {
    await iniciarCon(datos, "/agenda");
    await expect($('li*=Service de los 10.000').$('[data-respuesta="confirmo"]'))
      .toHaveText(expect.stringContaining("Confirmó por WhatsApp hoy a las"));
    await expect($('li*=Ruido en el tren delantero').$('[data-respuesta="no_puede"]'))
      .toHaveText(expect.stringContaining("Avisó por WhatsApp que no puede venir a su turno"));
    await expect($('li*=Revisión de frenos').$('[data-respuesta="sin_respuesta"]'))
      .toHaveText("Todavía no contestó el recordatorio.");
  });

  it("AC6: el que no puede se nota al abrir la agenda, sin rojo ni ícono de alerta", async () => {
    await iniciarCon(datos, "/agenda");
    const resumen = $("[data-no-pueden]");
    await expect(resumen).toHaveText(expect.stringContaining("Un cliente avisó que no puede venir"));
    await expect(resumen).toHaveText(expect.stringContaining("Lucía Ferreyra"));
    // Antes que la lista de turnos: se ve sin buscar.
    const arriba = await browser.execute(() => {
      const resumen = document.querySelector("[data-no-pueden]");
      const lista = document.querySelector("[data-turno]");
      return Boolean(resumen.compareDocumentPosition(lista) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(arriba).toBe(true);
    // Sin rojo: ni el resumen ni la línea del turno. (En la fila sí está en
    // rojo «Cancelar el turno», que es un botón de borrar, como siempre.)
    const linea = $('li*=Ruido en el tren delantero').$('[data-respuesta="no_puede"]');
    for (const lugar of [resumen, linea]) {
      await expect(lugar).not.toHaveElementClass("text-rojo");
      await expect(lugar.$(".text-rojo")).not.toExist();
      await expect(lugar.$("[role=alert]")).not.toExist();
    }
    await expect(linea).toHaveElementClass("text-espera");
    // La fila lleva la barra de "esperando" a la izquierda, no una roja.
    await expect($('li*=Ruido en el tren delantero')).toHaveElementClass("border-l-espera");
    // Y el color que se ve no es el rojo de borrar (#A32116).
    const color = await browser.execute(() =>
      getComputedStyle(document.querySelector('[data-respuesta="no_puede"]')).color);
    expect(color).not.toBe("rgb(163, 33, 22)");
  });

  it("AC7, AC10 y AC12: la bandeja tiene sólo lo que no se resolvió, tal cual y con wa.me", async () => {
    await iniciarCon(datos, "/respuestas");
    await expect($("h1")).toHaveText("Respuestas por WhatsApp");
    const pendientes = $$("[data-respuesta-pendiente]");
    await expect(pendientes).toBeElementsArrayOfSize(2);
    // De la más vieja a la más nueva.
    await expect(pendientes[0]).toHaveText(expect.stringContaining("¿Cuánto sale la pieza?"));
    await expect(pendientes[1]).toHaveText(expect.stringContaining("dale, gracias"));
    // El «sí» y el «no puedo» ya se ven en la agenda: acá no.
    await noVerTexto("no puedo");
    // El texto tal cual, con su salto de línea y sus espacios.
    const escrito = await pendientes[0].$("blockquote").getProperty("textContent");
    expect(escrito).toBe("¿Cuánto sale la pieza?  🙏\nla de adelante");
    await expect(pendientes[0].$("a*=Contestarle por WhatsApp"))
      .toHaveAttribute("href", "https://wa.me/5493414567890");
  });

  it("AC2 y AC13: la ficha lista lo que contestó, con la fecha de Argentina", async () => {
    await iniciarCon(datos, "/clientes/{c1}");
    const lista = $("[data-respuestas-del-cliente]");
    await expect(lista).toHaveText(expect.stringContaining("Lo que te contestó"));
    const filas = lista.$$("[data-respuesta]");
    await expect(filas).toBeElementsArrayOfSize(3);
    // De la más nueva a la más vieja: el «sí» de hoy, después las del caso.
    await expect(filas[0]).toHaveText(expect.stringContaining("sí"));
    await expect(filas[2]).toHaveText(expect.stringContaining("19 de octubre a las 22:30"));
  });

  it("AC3 y AC11: el caso dice a qué contestó, y si es una deducción lo dice", async () => {
    await iniciarCon(datos, "/casos/{k248}");
    const seccion = $("[data-respuestas-del-caso]");
    await expect(seccion).toHaveText(expect.stringContaining("Lo que contestó el cliente"));
    await expect(seccion.$('[data-certeza="citada"]')).toHaveText(
      "Contestó al aviso del presupuesto sin respuesta que le mandamos el 19 de octubre."
    );
    await expect(seccion.$('[data-certeza="deducida"]')).toHaveText(
      "Parece contestar al aviso del presupuesto sin respuesta, que fue lo último que le mandamos, el 19 de octubre."
    );
  });

  it("AC9: sin nada pendiente, la bandeja muestra el vacío y no una lista vacía", async () => {
    await iniciarCon(await sembrar("taller-completo"), "/respuestas");
    await verTexto("No hay respuestas para leer");
    await expect($$("[data-respuesta-pendiente]")).toBeElementsArrayOfSize(0);
  });
});
