// Correr con: npm run test:unit
//
// R-8b · Mostrar la baja de avisos y poder revertirla (módulo Recordatorios).
//
// El cliente se da de baja contestando BAJA por WhatsApp (R-8a, en la API):
// queda cliente.avisos_baja_en con cuándo lo pidió, y desde ahí no se le
// programa ningún aviso, de ningún tipo. Acá se prueba lo que la pantalla
// dice de eso, con la lógica pura de src/lib/recordatorios.js.
//
// La baja no es un error: el cliente ejerció un derecho. Las frases lo
// informan, y nunca repiten el texto técnico de la API (cartilla, 07).

import { describe, expect, test } from "@jest/globals";
import {
  bajaDeAvisos,
  errorAlRevertirBaja,
  porQueNoHayAviso,
  porQueNoSeAviso,
} from "../../src/lib/recordatorios.js";

const turno = { id: "t1", cliente_id: "c1", empieza_en: "2026-10-20T13:00:00+00:00", estado: "agendado" };

const CON_TELEFONO = "+54 9 341 456 7890";
// El 14 de octubre de 2026 a las 11:15 en Argentina.
const PIDIO_LA_BAJA = "2026-10-14T14:15:00+00:00";

describe("Historia: el cliente pidió no recibir avisos", () => {
  test("un cliente dado de baja no tiene aviso de turno, y el motivo lo dice", () => {
    const r = porQueNoHayAviso({
      turno,
      cliente: { id: "c1", telefono: CON_TELEFONO, avisos_baja_en: PIDIO_LA_BAJA },
      rubro: "taller",
    });
    expect(r.motivo).toBe("baja_de_avisos");
    expect(r.frase).toBe("Pidió no recibir mensajes automáticos, así que no le llega el recordatorio de su turno.");
  });

  test('el motivo de "pidió la baja" gana sobre "no tiene teléfono"', () => {
    // Completar el teléfono no cambiaría nada: la pantalla no puede mandar
    // a la persona a cargarlo.
    for (const telefono of [null, "", "15 1234"]) {
      const r = porQueNoHayAviso({
        turno,
        cliente: { id: "c1", telefono, avisos_baja_en: PIDIO_LA_BAJA },
        rubro: "taller",
      });
      expect(r.motivo).toBe("baja_de_avisos");
      expect(r.frase).not.toMatch(/teléfono/);
    }
    // Un turno sin cliente sigue siendo eso: no hay a quién dar de baja.
    expect(porQueNoHayAviso({ turno: { ...turno, cliente_id: null }, cliente: null, rubro: "taller" }).motivo)
      .toBe("sin_cliente");
  });

  test("un cliente sin baja mantiene su aviso normal", () => {
    for (const avisos_baja_en of [null, undefined]) {
      const cliente = { id: "c1", telefono: CON_TELEFONO, avisos_baja_en };
      expect(porQueNoHayAviso({ turno, cliente, rubro: "taller" })).toBeNull();
      expect(bajaDeAvisos({ cliente, rubro: "taller" })).toBeNull();
    }
    // Y sin teléfono, el motivo sigue siendo el teléfono.
    expect(porQueNoHayAviso({ turno, cliente: { id: "c1", telefono: null, avisos_baja_en: null }, rubro: "taller" }).motivo)
      .toBe("sin_telefono");
  });

  test("la fecha de la baja se muestra en palabras", () => {
    const r = bajaDeAvisos({ cliente: { id: "c1", avisos_baja_en: PIDIO_LA_BAJA }, rubro: "taller" });
    expect(r.dia).toBe("2026-10-14");
    expect(r.frase).toBe("Pidió no recibir mensajes automáticos el 14 de octubre de 2026.");

    // Lo pidió el 14 a las 22:30 en Argentina, que en UTC ya es el 15: la
    // fecha es la del cliente, no la de Greenwich.
    const deNoche = bajaDeAvisos({ cliente: { id: "c1", avisos_baja_en: "2026-10-15T01:30:00.000Z" }, rubro: "taller" });
    expect(deNoche.dia).toBe("2026-10-14");
    expect(deNoche.frase).toMatch(/el 14 de octubre de 2026/);
  });

  test("el texto de la baja usa el vocabulario del rubro", () => {
    const taller = bajaDeAvisos({ cliente: { id: "c1", avisos_baja_en: PIDIO_LA_BAJA }, rubro: "taller" });
    expect(taller.consecuencia)
      .toBe("No le van a llegar los recordatorios de sus turnos ni los mensajes de seguimiento por WhatsApp.");

    const consultorio = bajaDeAvisos({ cliente: { id: "c1", avisos_baja_en: PIDIO_LA_BAJA }, rubro: "medicina" });
    expect(consultorio.consecuencia).toMatch(/los recordatorios de sus consultas/);

    const enElTurno = porQueNoHayAviso({
      turno,
      cliente: { id: "c1", telefono: CON_TELEFONO, avisos_baja_en: PIDIO_LA_BAJA },
      rubro: "medicina",
    });
    expect(enElTurno.frase).toMatch(/el recordatorio de su consulta\.$/);
  });

  // ------------------------------------------------------------
  // Lo que dice la API, traducido (criterio 6)
  // ------------------------------------------------------------

  test("al entregar o cambiar de estado, por qué no se programó el mensaje se dice con nuestra frase", () => {
    // La API manda su "mensaje"; la pantalla dice lo suyo según el motivo.
    const dePrueba = { motivo: "baja_de_avisos", mensaje: "texto de la API que no se muestra" };
    expect(porQueNoSeAviso(dePrueba)).toBe("No se programó el mensaje porque el cliente pidió no recibir avisos.");
    expect(porQueNoSeAviso({ motivo: "otro_que_no_conocemos", mensaje: "texto de la API" }))
      .toBe("No se programó el mensaje por WhatsApp.");
    expect(porQueNoSeAviso(null)).toBeNull();
    expect(porQueNoSeAviso(undefined)).toBeNull();
  });

  test("un error al revertir la baja se traduce a qué pasa, sin el texto técnico", () => {
    const tecnico = "PGRST116 JSON object requested, multiple (or no) rows returned";
    const frase = (codigo) => errorAlRevertirBaja({ codigo, mensaje: tecnico });

    expect(frase("sin_permiso")).toBe("Que el cliente vuelva a recibir avisos lo decide el dueño o el encargado del negocio.");
    for (const codigo of ["cliente_no_encontrado", "no_esta"]) {
      expect(frase(codigo)).toBe("No encontramos a este cliente. Volvé a la lista de clientes y buscalo de nuevo.");
    }
    expect(frase("sin_conexion")).toMatch(/^Se cortó internet/);
    expect(frase("sesion_vencida")).toMatch(/Tu sesión venció/);
    for (const codigo of ["error_interno", "algo_nuevo", undefined]) {
      expect(frase(codigo)).toBe("No pudimos volver a activar sus avisos. Probá de nuevo en un rato.");
    }
    for (const codigo of ["sin_permiso", "no_esta", "sin_conexion", "error_interno"]) {
      expect(frase(codigo)).not.toMatch(/PGRST|JSON|rows/);
    }
  });
});
