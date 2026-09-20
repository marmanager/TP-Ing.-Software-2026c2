import { describe, expect, test } from "@jest/globals";
import {
  agruparPorDia,
  filtrarHistorial,
  plataAprobada,
  resumirHistorial,
} from "../../src/lib/historial.js";

describe("Historia: Historial de eventos", () => {
  const ahora = new Date("2026-09-20T12:00:00.000Z");
  const eventos = [
    { id: "e1", caso_id: "c1", tipo: "entro", ocurrido_en: "2026-09-20T10:00:00.000Z" },
    { id: "e2", caso_id: "c2", tipo: "plata", ocurrido_en: "2026-09-19T10:00:00.000Z" },
    { id: "e3", caso_id: "c1", tipo: "entrega", ocurrido_en: "2026-08-01T10:00:00.000Z" },
  ];

  test("filtra por período y tipo y ordena de más nuevo a más viejo", () => {
    expect(filtrarHistorial(eventos, { periodo: "semana", tipo: "plata", ahora })).toEqual([eventos[1]]);
  });

  test("resume ingresos y entregas del conjunto visible", () => {
    expect(resumirHistorial(eventos)).toEqual({ entraron: 1, entregados: 1 });
  });

  test("suma sólo pasos aprobados dentro del período", () => {
    const pasos = [
      { estado: "aprobado", monto: 74000, aprobado_en: "2026-09-19T10:00:00.000Z" },
      { estado: "esperando", monto: 22000, aprobado_en: null },
      { estado: "aprobado", monto: 50000, aprobado_en: "2026-08-01T10:00:00.000Z" },
    ];
    expect(plataAprobada(pasos, { periodo: "semana", ahora })).toEqual({ total: 74000, pasos: 1 });
  });

  test("agrupa eventos consecutivos por día", () => {
    const grupos = agruparPorDia(eventos);
    expect(grupos).toHaveLength(3);
    expect(grupos[0].eventos[0].id).toBe("e1");
  });
});
