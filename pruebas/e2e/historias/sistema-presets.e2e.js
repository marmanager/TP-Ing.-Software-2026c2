import { $, browser, expect } from "@wdio/globals";
import {
  datosDePrueba,
  entrarComoDemoSinNegocio,
  entrarConDatosDePrueba,
  noVerTexto,
  verTexto,
} from "./ayudas.js";

const botonRubro = (nombre) =>
  $(`//button[.//span[normalize-space()="${nombre}"]]`);

describe("Historia parcial: Sistema de presets", () => {
  it("AC1-AC3: permite elegir entre varios rubros y anticipa sus módulos", async () => {
    await entrarComoDemoSinNegocio();

    await expect(botonRubro("Taller mecánico")).toBeDisplayed();
    await expect(botonRubro("Medicina")).toBeDisplayed();
    await expect(botonRubro("Service técnico")).toBeDisplayed();

    await botonRubro("Medicina").click();
    await expect(botonRubro("Medicina")).toHaveAttribute("aria-pressed", "true");
    await verTexto("Con «Medicina» vas a arrancar con:");
    await verTexto("Agenda");
    await verTexto("Presupuesto");
  });

  it("AC4 y AC6: aplica el preset elegido y lo conserva al recargar", async () => {
    await entrarComoDemoSinNegocio();
    await $("#nombre").setValue("Consultorio Norte");
    await botonRubro("Medicina").click();
    await $("button=Crear el negocio").click();

    await browser.waitUntil(async () => (await browser.getUrl()).endsWith("/"), {
      timeoutMsg: "El alta no llevó al inicio del negocio",
    });
    await browser.url("/negocio");
    await verTexto("Tu negocio es Medicina");
    await verTexto("Turno pedido");
    await verTexto("En consulta");

    await browser.refresh();
    await verTexto("Tu negocio es Medicina");
    await verTexto("Dado de alta");
  });

  it("AC7: permite cambiar el rubro antes de abrir el primer caso", async () => {
    const fixture = datosDePrueba();
    fixture.casos = [];
    fixture.pasos = [];
    fixture.eventos = [];
    await browser.url("/iniciar-sesion");
    await browser.execute((datos) => {
      window.localStorage.setItem("marmanager.demo.v1", "1");
      window.localStorage.setItem("marmanager.datos.v1", JSON.stringify(datos));
    }, fixture);
    await browser.url("/negocio");
    await browser.refresh();

    await $("button=Cambiar el rubro").click();
    await botonRubro("Service técnico").click();
    await $("button=Cambiar el rubro").click();
    await verTexto("Tu negocio es Service técnico");
    await verTexto("En reparación");

    await browser.refresh();
    await verTexto("Tu negocio es Service técnico");
  });

  it("AC8: bloquea el cambio de rubro después del primer caso", async () => {
    await entrarConDatosDePrueba("/negocio");
    await verTexto("Queda fijo desde que abriste el primer caso");
    await noVerTexto("Cambiar el rubro");
  });

  it.skip("[NO IMPLEMENTADA] AC1: permite seleccionar Sin preset", async () => {});
  it.skip("[NO IMPLEMENTADA] AC5: permite editar estados, roles, ejemplos, identificador y módulos", async () => {});
  it.skip("[NO IMPLEMENTADA] AC6: conserva la configuración manual al recargar", async () => {});
  it.skip("[NO IMPLEMENTADA] AC7: permite cambiar la configuración manual antes del primer caso", async () => {});
  it.skip("[NO IMPLEMENTADA] AC8: bloquea la configuración manual después del primer caso", async () => {});
});
