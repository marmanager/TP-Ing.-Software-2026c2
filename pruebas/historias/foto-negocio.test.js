import { describe, expect, test } from "@jest/globals";
import { medidasPara, PESO_MAXIMO, revisarArchivo } from "../../src/lib/imagen.js";

describe("Historia parcial: Foto del perfil del negocio", () => {
  test("reduce el lado mayor a 256 px sin deformar", () => {
    expect(medidasPara(1024, 512)).toEqual({ ancho: 256, alto: 128 });
  });

  test("acepta imágenes dentro del límite", () => {
    expect(revisarArchivo({ type: "image/png", size: 1000 })).toBeNull();
  });

  test("rechaza archivos que no son imagen o exceden 10 MB", () => {
    expect(revisarArchivo({ type: "text/plain", size: 10 })).toMatch(/no es una imagen/i);
    expect(revisarArchivo({ type: "image/jpeg", size: PESO_MAXIMO + 1 })).toMatch(/muy pesada/i);
  });
});
