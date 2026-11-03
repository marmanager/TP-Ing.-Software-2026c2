import { describe, expect, test } from "@jest/globals";
import { avisosDelCliente } from "../src/lib/recordatorios.js";

// El aviso de avance y el seguimiento salen por el canal del cliente (083):
// la pantalla los ofrece por ese canal y pide el dato de ese canal.
describe("por dónde le llegan los avisos a un cliente", () => {
  test("un cliente de WhatsApp necesita un teléfono con código de país", () => {
    expect(avisosDelCliente({ canal: "whatsapp", telefono: "5493414567890" }))
      .toEqual({ canal: "whatsapp", puede: true, destino: "5493414567890" });
    expect(avisosDelCliente({ canal: "whatsapp", telefono: "3414567890" }).puede).toBe(false);
  });

  test("un cliente de mail necesita un mail, aunque tenga teléfono", () => {
    expect(avisosDelCliente({ canal: "email", email: "ana@gmail.com", telefono: "5493414567890" }))
      .toEqual({ canal: "email", puede: true, destino: "ana@gmail.com" });
    expect(avisosDelCliente({ canal: "email", email: null, telefono: "5493414567890" }).puede).toBe(false);
    expect(avisosDelCliente({ canal: "email", email: "ana@" }).puede).toBe(false);
  });

  test("sin canal, o sin cliente, es WhatsApp como en la API", () => {
    expect(avisosDelCliente({ telefono: "5493414567890" }).canal).toBe("whatsapp");
    expect(avisosDelCliente(undefined)).toEqual({ canal: "whatsapp", puede: false, destino: null });
  });
});
