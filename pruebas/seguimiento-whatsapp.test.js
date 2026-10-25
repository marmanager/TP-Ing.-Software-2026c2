import { describe, expect, test } from "@jest/globals";
import {
  erroresSeguimiento,
  seguimientoParaLaApi,
  SEGUIMIENTO_VACIO,
} from "../src/lib/seguimiento-whatsapp.js";

const valido = (extra = {}) => ({ enviar: true, dias: "30", mensaje: "¿Cómo anda todo?", ...extra });

describe("errores del seguimiento por WhatsApp", () => {
  test("sin enviar no hay nada que revisar", () => {
    expect(erroresSeguimiento(SEGUIMIENTO_VACIO)).toEqual({});
    expect(erroresSeguimiento({ enviar: false, dias: "x", mensaje: "" })).toEqual({});
    expect(erroresSeguimiento(undefined)).toEqual({});
  });

  test("un seguimiento completo no tiene errores", () => {
    expect(erroresSeguimiento(valido())).toEqual({});
  });

  test("los días tienen que ser enteros entre 0 y 3650", () => {
    const error = { dias: "Elegí una cantidad de días enteros entre 0 y 3650." };
    expect(erroresSeguimiento(valido({ dias: "0" }))).toEqual({});
    expect(erroresSeguimiento(valido({ dias: "3650" }))).toEqual({});
    expect(erroresSeguimiento(valido({ dias: 15 }))).toEqual({});
    expect(erroresSeguimiento(valido({ dias: "3651" }))).toEqual(error);
    expect(erroresSeguimiento(valido({ dias: "" }))).toEqual(error);
    expect(erroresSeguimiento(valido({ dias: null }))).toEqual(error);
    expect(erroresSeguimiento(valido({ dias: "-1" }))).toEqual(error);
    expect(erroresSeguimiento(valido({ dias: "2.5" }))).toEqual(error);
    expect(erroresSeguimiento(valido({ dias: "diez" }))).toEqual(error);
  });

  test("el mensaje no puede quedar vacío", () => {
    const error = { mensaje: "Escribí el mensaje que va a recibir el cliente." };
    expect(erroresSeguimiento(valido({ mensaje: "" }))).toEqual(error);
    expect(erroresSeguimiento(valido({ mensaje: "   " }))).toEqual(error);
    expect(erroresSeguimiento(valido({ mensaje: undefined }))).toEqual(error);
  });

  test("el mensaje no puede superar 3000 caracteres, sin contar los espacios de los bordes", () => {
    expect(erroresSeguimiento(valido({ mensaje: "a".repeat(3000) }))).toEqual({});
    expect(erroresSeguimiento(valido({ mensaje: `  ${"a".repeat(3000)}  ` }))).toEqual({});
    expect(erroresSeguimiento(valido({ mensaje: "a".repeat(3001) }))).toEqual({
      mensaje: "El mensaje no puede superar 3000 caracteres.",
    });
  });

  test("días y mensaje mal a la vez se dicen los dos", () => {
    expect(Object.keys(erroresSeguimiento(valido({ dias: "x", mensaje: "" })))).toEqual(["dias", "mensaje"]);
  });
});

describe("el seguimiento que va a la API", () => {
  test("sin enviar va apagado y sin días ni mensaje", () => {
    expect(seguimientoParaLaApi(SEGUIMIENTO_VACIO)).toEqual({ seguimiento: false });
    expect(seguimientoParaLaApi(null)).toEqual({ seguimiento: false });
  });

  test("con enviar van los días como número y el mensaje recortado", () => {
    expect(seguimientoParaLaApi(valido({ dias: "7", mensaje: "  Hola  " }))).toEqual({
      seguimiento: true,
      seguimiento_dias: 7,
      seguimiento_mensaje: "Hola",
    });
  });
});
