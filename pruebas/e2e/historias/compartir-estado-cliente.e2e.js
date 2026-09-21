import { $, browser, expect } from "@wdio/globals";
import { entrarConDatosDePrueba, noVerTexto, verTexto } from "./ayudas.js";

describe("Historia: Compartir estado del trabajo con el cliente", () => {
  async function generarLink() {
    await entrarConDatosDePrueba("/casos/k248");
    await $("button=Armar el link para Marcela").click();
    const campo = await $("#link-seguimiento");
    await expect(campo).toBeDisplayed();
    return campo.getValue();
  }

  it("AC1: genera un enlace estable y compartible", async () => {
    const link = await generarLink();
    expect(link).toMatch(/\/seguimiento\/[a-f0-9]{32}$/);
    await browser.refresh();
    await expect($("#link-seguimiento")).toHaveValue(link);
  });

  it("AC2: el cliente consulta sin cuenta el estado y la identificación", async () => {
    const link = await generarLink();
    await browser.url(link);
    await verTexto("Hola Marcela");
    await verTexto("Patente AB123CD");
    await verTexto("Revisión general");
    await verTexto("Se está esperando");
  });

  it("AC3: separa lo aprobado de lo pendiente y no publica lo rechazado", async () => {
    const link = await generarLink();
    await browser.url(link);
    await verTexto("Revisión completa");
    await verTexto("Falta que contestes");
    await verTexto("Cambio de pieza");
    await verTexto("La pieza actual está desgastada.");
    await verTexto("$74.000");
    await noVerTexto("Trabajo descartado");
    await noVerTexto("diagnóstico");
  });

  it("AC6: permite aprobar un paso con confirmación, persiste y registra quién contestó", async () => {
    const link = await generarLink();
    await browser.url(link);

    await $("button=Lo apruebo").click();
    await verTexto("¿Aprobás «Cambio de pieza»?");
    await verTexto("lo que aprobaste pasa de $74.000 a $96.000");
    await $("button=Sí, lo apruebo").click();
    await verTexto("Listo, quedó aprobado");
    await verTexto("lo que aprobaste hasta ahora suma $96.000");

    await browser.refresh();
    await noVerTexto("Falta que contestes");
    await verTexto("$96.000");

    await browser.url("/casos/k248");
    await browser.refresh();
    await verTexto("Lo aprobó el cliente desde el link");
    await verTexto("El cliente");
  });

  it("AC7: permite rechazar un paso, no lo suma y lo retira de pendientes", async () => {
    const link = await generarLink();
    await browser.url(link);

    await $("button=No lo hago").click();
    await verTexto("¿Decís que no a «Cambio de pieza»?");
    await $("button=Sí, no lo hago").click();
    await verTexto("Listo, anotamos que no");
    await verTexto("Lo que aprobaste sigue siendo $74.000");

    await browser.refresh();
    await noVerTexto("Falta que contestes");
    await noVerTexto("Cambio de pieza");
    await verTexto("$74.000");
  });

  it("AC8: ofrece contactar al teléfono público del negocio", async () => {
    const link = await generarLink();
    await browser.url(link);

    const whatsapp = await $("a=Escribirle por WhatsApp");
    await expect(whatsapp).toHaveAttribute(
      "href",
      expect.stringContaining("https://wa.me/5493412223333")
    );
    await expect($("a=Llamar al 341 222 3333")).toHaveAttribute("href", "tel:3412223333");
  });

  it("AC9: el negocio puede modificar su teléfono y conservarlo", async () => {
    await entrarConDatosDePrueba("/negocio");
    await $("button=Editar").click();
    await $("#negocio-telefono").setValue("341 444 5566");
    await $("button=Guardar").click();
    await verTexto("Teléfono 341 444 5566");

    await browser.refresh();
    await verTexto("Teléfono 341 444 5566");
  });

  it("AC4: un enlace deshabilitado deja de revelar el caso", async () => {
    const link = await generarLink();
    await browser.url("/casos/k248");
    await $("button=Dejar de compartirlo").click();
    await $("button=Sí, dejar de compartirlo").click();
    await browser.url(link);
    await verTexto("Este link ya no sirve");
  });

  it("AC5: un código inexistente no revela si alguna vez fue válido", async () => {
    await entrarConDatosDePrueba("/seguimiento/codigo-inexistente");
    await verTexto("Este link ya no sirve");
  });
});
