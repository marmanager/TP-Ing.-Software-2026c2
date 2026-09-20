import { $, $$, expect } from "@wdio/globals";
import { entrarConDatosDePrueba, noVerTexto, verTexto } from "./ayudas.js";

describe("Historia: Historial global de eventos", () => {
  beforeEach(async () => {
    await entrarConDatosDePrueba("/historial");
    await expect($("h1=Historial")).toBeDisplayed();
  });

  it("AC1: reúne sucesos de distintos trabajos e identifica caso y cliente", async () => {
    await verTexto("Caso 248 de Marcela Suárez");
    await verTexto("Caso 253 de Lucía Ferreyra");
  });

  it("AC2: muestra los importes por ítem y el total aprobado", async () => {
    await verTexto("$74.000");
    await verTexto("$194.000");
  });

  it("AC3: filtra por tipo sin cambiar los totales del período", async () => {
    await $("button=Plata").click();
    await verTexto("Aprobó Revisión completa");
    await noVerTexto("Quedó esperando");
    await verTexto("$194.000");
  });

  it("AC4: permite aislar todo lo ocurrido en un caso", async () => {
    await $('[aria-label="Ver sólo lo del caso 248"]').click();
    await verTexto("Mostrando sólo el caso 248 de Marcela Suárez");
    await noVerTexto("Caso 253 de Lucía Ferreyra");
    await expect(await $$("a[href='/casos/k248']")).toBeElementsArrayOfSize(4);
  });
});
