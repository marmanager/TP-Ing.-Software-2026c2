import { $, expect } from "@wdio/globals";
import { iniciarCon, reemplazarTexto, tid, verTexto } from "./ayudas.js";
import { sembrar } from "../siembra.js";
import { avisoEnviado, cambiar, respuesta, turno } from "./respuestas-en-la-base.js";

// FRONT-4 · Las plantillas de WhatsApp en el front.
//
// Necesita la API con API-4 y API-4b y la base con la 081 y la 082. En las
// pruebas WHATSAPP_PLANTILLAS está vacío: ninguna plantilla está prendida, así
// que las versiones se ven "todavía no aprobadas" y retomar contesta 503.
//
// Una cuenta para toda la historia: Taller Sur, sin dirección cargada (la
// siembra no la trae), con
//   · Marcela (c1), que escribió hace más de 24 horas;
//   · Lucía (c2), que canceló su turno con el botón "Cancelo".

const HORA = 3_600_000;
const instante = (ms) => new Date(ms).toISOString();

let datos;

describe("Historia: las plantillas de WhatsApp en el front", () => {
  before(async () => {
    datos = await sembrar("taller-completo");
    const { ids } = datos;
    const ahora = Date.now();
    const negocio_id = ids.n1;

    // Marcela escribió hace 30 horas, sobre el caso 248: la ventana se cerró.
    const avisoDelCaso = await avisoEnviado({
      negocio_id, tipo: "presupuesto", telefono: "5493414567890", caso_id: ids.k248,
      procesado_en: instante(ahora - 40 * HORA), mensaje_id: "wamid.f4-k248",
    });
    await respuesta({ aviso: avisoDelCaso, cliente_id: ids.c1, texto: "¿Ya está?", enviado_en: instante(ahora - 30 * HORA) });

    // Lucía tocó "Cancelo" en el recordatorio: el turno quedó cancelado.
    const empieza_en = instante(ahora + 2 * 24 * HORA);
    const fila = await turno({ negocio_id, cliente_id: ids.c2, motivo: "Ruido en el tren delantero", empieza_en });
    const aviso = await avisoEnviado({
      negocio_id, tipo: "turno", telefono: "5493415551111", turno_id: fila.id, turno_empieza_en: empieza_en,
      procesado_en: instante(ahora - 5 * HORA), mensaje_id: "wamid.f4-turno",
    });
    const cancelo = instante(ahora - HORA);
    const toque = await respuesta({ aviso, cliente_id: ids.c2, texto: "Cancelo", enviado_en: cancelo });
    await cambiar("seguimiento_whatsapp_respuesta", toque.id, { resolvio: "cancelo" });
    await cambiar("turno", fila.id, { estado: "cancelado", respuesta_cliente: "cancelo", respuesta_cliente_en: cancelo });

    // El recordatorio del turno sólo se configura con la agenda prendida.
    await iniciarCon(datos, "/negocio/modulos");
    await $('[data-testid="modulo-alternar-agenda"]').click();
    await expect($('[data-testid="modulo-alternar-agenda"]')).toHaveAttribute("aria-checked", "true");
  });

  it("sin dirección, el recordatorio del turno dice qué falta y no deja prenderlo", async () => {
    await iniciarCon(datos, "/negocio/recordatorios/turno");
    const falta = $("[data-faltan-datos]");
    await expect(falta).toHaveText(expect.stringContaining("la dirección"));
    await expect(falta.$('a[href="/negocio"]')).toBeDisplayed();

    await tid("recordatorio-turno-interruptor").click();
    await expect(tid("recordatorio-guardar")).toHaveText(expect.stringContaining("falta completar los datos del negocio"));
  });

  it("con la dirección en Mi negocio, se elige la versión con su vista previa", async () => {
    await iniciarCon(datos, "/negocio");
    await tid("negocio-editar").click();
    await reemplazarTexto("#negocio-direccion", "Av. Pellegrini 1520, Rosario");
    await tid("negocio-guardar").click();
    await verTexto("Dirección: Av. Pellegrini 1520, Rosario");

    await iniciarCon(datos, "/negocio/recordatorios/turno");
    await expect($("[data-faltan-datos]")).not.toExist();
    await tid("recordatorio-turno-interruptor").click();
    const taller = $('[data-version="taller"]');
    await expect(taller).toHaveText(expect.stringContaining("Av. Pellegrini 1520, Rosario"));
    // En las pruebas ninguna plantilla está prendida: sale el texto libre.
    await expect(taller).toHaveText(expect.stringContaining("Todavía no está aprobado"));
    await expect($("#turno-mensaje")).toBeDisplayed();
  });

  it("pasadas las 24 horas, sin la plantilla para retomar queda el chat del negocio", async () => {
    await iniciarCon(datos, "/clientes/{c1}");
    const cerrada = $('[data-escribir="cerrada"]');
    await expect(cerrada).toHaveText(expect.stringContaining("Pasaron más de 24 horas"));
    await cerrada.$("button=Retomar la conversación").click();
    // La API contesta 503 plantilla_no_configurada: el botón se va y queda wa.me.
    await expect(cerrada.$("button=Retomar la conversación")).not.toExist();
    await expect(cerrada.$("a*=Escribirle desde tu WhatsApp")).toHaveAttribute("href", "https://wa.me/5493414567890");
  });

  it("«Cancelo» se ve en la agenda y en la conversación", async () => {
    await iniciarCon(datos, "/agenda");
    await expect($('[data-respuesta="cancelo"]')).toHaveText(expect.stringContaining("Canceló por WhatsApp"));

    await iniciarCon(datos, "/clientes/{c2}");
    await expect($("[data-respuestas-del-cliente]")).toHaveText(expect.stringContaining("Se anotó solo: canceló su turno."));
  });
});
