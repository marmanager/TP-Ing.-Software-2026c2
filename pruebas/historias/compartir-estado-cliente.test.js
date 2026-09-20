import { describe, expect, test } from "@jest/globals";
import { CAMPOS_PUBLICOS, casoPublico, totalAprobado } from "../../src/lib/seguimiento.js";

describe("Historia: Compartir estado con el cliente", () => {
  const codigo = "abc123";
  const datos = {
    negocio: { nombre: "Taller Sur", rubro: "taller", telefono: "341 222 3333", secreto: "interno" },
    clientes: [{ id: "c1", nombre: "Marcela Suárez", telefono: "999 888 7777" }],
    casos: [{ id: "k1", cliente_id: "c1", numero: 1, identificador: "AB123CD", servicio: "Frenos", estado: "esperando", que_falta: "un repuesto", diagnostico: "dato interno", seguimiento_codigo: codigo }],
    pasos: [
      { caso_id: "k1", nombre: "Pastillas", monto: 40000, estado: "aprobado", orden: 1 },
      { caso_id: "k1", nombre: "Discos", monto: 80000, estado: "esperando", orden: 2 },
    ],
    eventos: [],
  };

  test("publica sólo los campos permitidos", () => {
    const publico = casoPublico({ codigo, ...datos });
    expect(Object.keys(publico).sort()).toEqual([...CAMPOS_PUBLICOS].sort());
    expect(JSON.stringify(publico)).not.toContain("diagnostico");
    expect(publico.negocio_telefono).toBe("341 222 3333");
    expect(JSON.stringify(publico)).not.toContain(datos.clientes[0].telefono);
  });

  test("incluye sólo ítems aprobados y calcula su total", () => {
    const publico = casoPublico({ codigo, ...datos });
    expect(publico.pasos).toEqual([{ nombre: "Pastillas", monto: 40000 }]);
    expect(totalAprobado(publico.pasos)).toBe(40000);
  });

  test("un código inválido no revela información", () => {
    expect(casoPublico({ codigo: "otro", ...datos })).toEqual({ sirve: false });
  });
});
