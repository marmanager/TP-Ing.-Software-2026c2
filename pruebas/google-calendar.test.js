import { describe, test, expect } from "@jest/globals";
import { eventoGoogle, idEventoGoogle } from "../src/lib/google-calendar.js";

describe("copiar turnos a Google", () => {
  test("usa un ID estable y conserva la hora y duración en UTC", () => {
    const turno = {
      id: "71b0ad84-4f5a-4ba4-8b36-562286f517a1",
      motivo: "Consulta",
      empieza_en: "2026-09-22T21:00:00Z",
      minutos_reservados: 45,
    };
    const evento = eventoGoogle(turno, { nombre: "Pedro", telefono: "123" });
    expect(evento.id).toBe(idEventoGoogle(turno.id));
    expect(evento.start.dateTime).toBe("2026-09-22T21:00:00.000Z");
    expect(evento.end.dateTime).toBe("2026-09-22T21:45:00.000Z");
    expect(evento.summary).toContain("Pedro");
  });
});
