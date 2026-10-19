import { describe, expect, test } from "@jest/globals";
import {
  configuracionEstadosValida,
  configuracionInicialEstados,
  presentacionEstado,
} from "../src/lib/presentacion-estados.js";

describe("presentación personalizada de estados", () => {
  test("usa el preset y el ícono base cuando el negocio todavía no personalizó nada", () => {
    expect(presentacionEstado({ rubro: "medicina" }, "en_proceso")).toMatchObject({
      nombre: "En consulta",
      icono: "llave",
    });
  });

  test("reemplaza sólo el nombre y el ícono visibles", () => {
    expect(presentacionEstado({
      rubro: "taller",
      estados: { esperando: { nombre: "Falta un repuesto", icono: "camion" } },
    }, "esperando")).toMatchObject({
      clave: "esperando",
      nombre: "Falta un repuesto",
      icono: "camion",
      fondo: "bg-espera-fondo",
    });
  });

  test("arma una configuración completa y rechaza vacíos o íconos desconocidos", () => {
    const completa = configuracionInicialEstados({ rubro: "service" });
    expect(configuracionEstadosValida(completa)).toBe(true);
    expect(configuracionEstadosValida({ ...completa, nuevo: { ...completa.nuevo, nombre: "" } })).toBe(false);
    expect(configuracionEstadosValida({ ...completa, nuevo: { ...completa.nuevo, icono: "inventado" } })).toBe(false);
  });
});
