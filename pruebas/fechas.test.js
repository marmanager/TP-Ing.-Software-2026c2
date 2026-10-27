import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import {
  cuando,
  cuantoHace,
  diaLargo,
  diaPasado,
  diasDesde,
  elDia,
  haceCuanto,
  horaYMinutos,
  paraInput,
} from "../src/lib/fechas.js";

// "Ahora" queda fijo en el domingo 25 de octubre de 2026 a las 15:30, hora
// local: las funciones comparan contra la fecha de la máquina y el texto sale
// en su huso, así que las fechas de los tests también se arman en hora local.
const AHORA = new Date(2026, 9, 25, 15, 30);
const local = (dia, hora = 10, minuto = 15) => new Date(2026, 9, dia, hora, minuto).toISOString();

beforeEach(() => {
  jest.useFakeTimers({ now: AHORA });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("cuándo pasó algo, con la hora", () => {
  test("hoy y ayer llevan la hora en 24 horas", () => {
    expect(cuando(local(25, 10, 15))).toBe("Hoy 10:15");
    expect(cuando(local(24, 16, 40))).toBe("Ayer 16:40");
  });

  test("antes de ayer es sólo el día", () => {
    expect(cuando(local(2))).toBe("2 de octubre");
  });

  test("la hora sola", () => {
    expect(horaYMinutos(local(25, 15, 0))).toBe("15:00");
  });
});

describe("hace cuánto se abrió un caso", () => {
  test("hoy, ayer o hace tantos días", () => {
    expect(haceCuanto(local(25))).toBe("Abierto hoy");
    expect(haceCuanto(local(24, 15, 30))).toBe("Abierto ayer");
    expect(haceCuanto(local(13, 15, 30))).toBe("Abierto hace 12 días");
  });

  test("cuenta períodos de 24 horas, no días del calendario", () => {
    // Ayer a las 23 h, visto hoy a las 15:30, son 16 horas: todavía "hoy".
    expect(haceCuanto(local(24, 23, 0))).toBe("Abierto hoy");
  });

  test("lo que está en el futuro se lee como hoy", () => {
    expect(haceCuanto(local(26))).toBe("Abierto hoy");
  });

  test("para meter en una frase", () => {
    expect(cuantoHace(local(25))).toBe("hoy");
    expect(cuantoHace(local(24, 15, 30))).toBe("ayer");
    expect(cuantoHace(local(13, 15, 30))).toBe("hace 12 días");
  });

  test("los días que pasaron, como número", () => {
    expect(diasDesde(local(25))).toBe(0);
    expect(diasDesde(local(13, 15, 30))).toBe(12);
  });
});

describe("el día de la agenda, que mira hacia adelante", () => {
  test("hoy, mañana o el día con su nombre", () => {
    expect(diaLargo(local(25))).toBe("Hoy");
    expect(diaLargo(local(26))).toBe("Mañana");
    expect(diaLargo(local(27))).toBe("martes, 27 de octubre");
  });

  test("ayer no es mañana: sale con su nombre", () => {
    expect(diaLargo(local(24))).toBe("sábado, 24 de octubre");
  });
});

describe("el día de lo que ya pasó", () => {
  test("hoy, ayer o el día con su nombre", () => {
    expect(diaPasado(local(25))).toBe("Hoy");
    expect(diaPasado(local(24))).toBe("Ayer");
    expect(diaPasado(local(22))).toBe("jueves, 22 de octubre");
  });

  test("para meter en una frase", () => {
    expect(elDia(local(25))).toBe("hoy");
    expect(elDia(local(24))).toBe("ayer");
    expect(elDia(local(2))).toBe("el 2 de octubre");
  });

  test("ayer funciona también al cambiar de mes", () => {
    jest.setSystemTime(new Date(2026, 10, 1, 9, 0));
    expect(diaPasado(local(31))).toBe("Ayer");
    expect(cuando(local(31, 20, 5))).toBe("Ayer 20:05");
  });
});

describe("la fecha para un input datetime-local", () => {
  test("va en hora local, sin segundos ni huso", () => {
    expect(paraInput(new Date(2026, 9, 25, 9, 5))).toBe("2026-10-25T09:05");
  });

  test("sin fecha toma ahora", () => {
    expect(paraInput()).toBe("2026-10-25T15:30");
  });
});
