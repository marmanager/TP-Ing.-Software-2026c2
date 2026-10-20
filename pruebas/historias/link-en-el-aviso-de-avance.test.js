// Correr con: npm run test:unit
//
// R-11 · El link en el aviso de que el caso avanzó.
//
// El aviso de avance es el de "Notificar" al cambiar el estado del caso. La
// API le suma el link de seguimiento que el caso ya tiene (R-11, API). Si el
// caso no tiene link, el aviso sale igual, sin link: la pantalla lo dice
// antes de mandarlo y ofrece generarlo ahí mismo. Un link público es una
// decisión del dueño, no un efecto de mandar un mensaje.
//
// Generarlo es compartir el caso (SCRUM-68): si tiene pasos sin contestar,
// el caso queda esperando la respuesta del cliente. Eso también se dice
// antes, para que nadie lo descubra después.

import { describe, expect, test } from "@jest/globals";
import { linkDelAvisoDeAvance } from "../../src/lib/seguimiento-whatsapp.js";

const caso = (extra = {}) => ({ id: "caso-1", estado: "en_proceso", seguimiento_codigo: null, ...extra });
const paso = (estado) => ({ id: `p-${estado}`, caso_id: "caso-1", estado });

describe("Historia: el link en el aviso de avance", () => {
  test("al avisar un caso sin link, la pantalla lo dice y ofrece generarlo", () => {
    expect(linkDelAvisoDeAvance({ caso: caso(), pasos: [] })).toEqual({
      frase: "Este caso no tiene link para que el cliente vea cómo va: el aviso sale sin link.",
      boton: "Generar el link",
      consecuencia: null,
    });
  });

  test("con link no hay nada que decir: el aviso ya lo lleva", () => {
    expect(linkDelAvisoDeAvance({ caso: caso({ seguimiento_codigo: "abc123" }), pasos: [] })).toBeNull();
  });

  test("si tiene pasos sin contestar, dice que generarlo lo deja esperando", () => {
    const r = linkDelAvisoDeAvance({ caso: caso(), pasos: [paso("esperando"), paso("aprobado")] });
    expect(r.consecuencia).toBe("Tiene pasos sin contestar: al generarlo, el caso queda esperando la respuesta del cliente.");
  });

  test("si ya está esperando, o no le queda nada por contestar, generarlo no lo mueve", () => {
    expect(linkDelAvisoDeAvance({ caso: caso({ estado: "esperando" }), pasos: [paso("esperando")] }).consecuencia).toBeNull();
    expect(linkDelAvisoDeAvance({ caso: caso(), pasos: [paso("aprobado")] }).consecuencia).toBeNull();
    // Los pasos de otro caso no cuentan.
    expect(linkDelAvisoDeAvance({ caso: caso(), pasos: [{ ...paso("esperando"), caso_id: "otro" }] }).consecuencia).toBeNull();
  });
});
