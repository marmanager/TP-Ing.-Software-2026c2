import { $, browser, expect } from "@wdio/globals";

const iso = (dias = 0, horas = 0) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  fecha.setHours(fecha.getHours() + horas);
  return fecha.toISOString();
};

// La rama development ya no trae datos ficticios. Estas pruebas cargan un
// fixture propio para ser repetibles y no depender de una cuenta de Supabase.
export function datosDePrueba() {
  return {
    negocio: {
      id: "n1", nombre: "Taller Sur", descripcion: "Mecánica integral",
      rubro: "taller", foto: null, telefono: "341 222 3333",
      modulos_activos: ["equipo", "presupuesto", "clientes", "historial"],
    },
    empleados: [
      { id: "e1", negocio_id: "n1", nombre: "Diego", rol: "tecnico" },
      { id: "e2", negocio_id: "n1", nombre: "Nico", rol: "tecnico" },
      { id: "e3", negocio_id: "n1", nombre: "Sofía", rol: "encargado" },
    ],
    clientes: [
      { id: "c1", negocio_id: "n1", nombre: "Marcela Suárez", telefono: "341 456 7890", confirmado: true },
      { id: "c2", negocio_id: "n1", nombre: "Lucía Ferreyra", telefono: "341 555 1111", confirmado: true },
      { id: "c3", negocio_id: "n1", nombre: "Ana Sin Casos", telefono: "341 555 2222", confirmado: true },
    ],
    casos: [
      { id: "k248", negocio_id: "n1", cliente_id: "c1", numero: 248,
        identificador: "AB123CD", servicio: "Revisión general", estado: "esperando",
        que_falta: "la respuesta del cliente", responsable_id: "e1",
        abierto_en: iso(-2), actualizado_en: iso(-1), seguimiento_codigo: null },
      { id: "k239", negocio_id: "n1", cliente_id: "c1", numero: 239,
        identificador: "AA000AA", servicio: "Reparación de motor", estado: "revision_final",
        que_falta: "el control final", responsable_id: "e2",
        abierto_en: iso(-20), actualizado_en: iso(0, -2), seguimiento_codigo: null },
      { id: "k253", negocio_id: "n1", cliente_id: "c2", numero: 253,
        identificador: "AC456EF", servicio: "Cambio de aceite", estado: "nuevo",
        que_falta: "asignar responsable", responsable_id: null,
        abierto_en: iso(0, -3), actualizado_en: iso(0, -3), seguimiento_codigo: null },
      { id: "k210", negocio_id: "n1", cliente_id: "c1", numero: 210,
        identificador: "ZZ999ZZ", servicio: "Frenos", estado: "completado",
        que_falta: null, responsable_id: "e1", cobrado: 50000, cobrado_en: iso(-45),
        abierto_en: iso(-50), actualizado_en: iso(-45), seguimiento_codigo: null },
    ],
    pasos: [
      { id: "p1", caso_id: "k248", nombre: "Revisión completa", monto: 74000, estado: "aprobado", orden: 1, aprobado_en: iso(-1) },
      { id: "p2", caso_id: "k248", nombre: "Cambio de pieza", descripcion: "La pieza actual está desgastada.", monto: 22000, estado: "esperando", orden: 2, creado_en: iso(-1) },
      { id: "p4", caso_id: "k248", nombre: "Trabajo descartado", monto: 18000, estado: "rechazado", orden: 3, creado_en: iso(-1) },
      { id: "p3", caso_id: "k239", nombre: "Reparación", monto: 120000, estado: "aprobado", orden: 1, aprobado_en: iso(0, -4) },
    ],
    eventos: [
      { id: "v1", caso_id: "k248", titulo: "Caso abierto", detalle: "Ingresó al taller.", tipo: "entro", estado: "nuevo", icono: "carpeta", autor: "Diego", ocurrido_en: iso(-2) },
      { id: "v2", caso_id: "k248", titulo: "Empezó el trabajo", detalle: "Lo atiende Diego.", tipo: "estado", estado: "en_proceso", icono: "llave", autor: "Diego", ocurrido_en: iso(-1, -3) },
      { id: "v3", caso_id: "k248", titulo: "Aprobó Revisión completa", detalle: "Marcela dio el visto bueno.", tipo: "plata", monto: 74000, icono: "listo", autor: "Marcela", ocurrido_en: iso(-1) },
      { id: "v4", caso_id: "k248", titulo: "Quedó esperando", detalle: "Falta que el cliente conteste.", tipo: "estado", estado: "esperando", icono: "reloj", autor: "Diego", ocurrido_en: iso(0, -6) },
      { id: "v5", caso_id: "k239", titulo: "Caso abierto", detalle: "Ingresó al taller.", tipo: "entro", estado: "nuevo", icono: "carpeta", autor: "Nico", ocurrido_en: iso(-20) },
      { id: "v6", caso_id: "k239", titulo: "Terminó el trabajo", detalle: "Pasa al control final.", tipo: "estado", estado: "revision_final", icono: "nota", autor: "Nico", ocurrido_en: iso(0, -2) },
      { id: "v7", caso_id: "k253", titulo: "Caso abierto", detalle: "Ingresó al taller.", tipo: "entro", estado: "nuevo", icono: "carpeta", autor: "Sofía", ocurrido_en: iso(0, -3) },
      { id: "v8", caso_id: "k210", titulo: "Entregaron el trabajo", detalle: "El caso quedó cerrado.", tipo: "entrega", estado: "completado", icono: "listo", autor: "Diego", ocurrido_en: iso(-45) },
    ],
    insumos: [], turnos: [], invitaciones: [],
  };
}

export async function entrarConDatosDePrueba(ruta = "/") {
  await browser.url("/iniciar-sesion");
  await browser.execute((fixture) => {
    window.localStorage.setItem("marmanager.demo.v1", "1");
    window.localStorage.setItem("marmanager.datos.v1", JSON.stringify(fixture));
  }, datosDePrueba());
  await browser.url(ruta);
  // Fuerza un documento nuevo: AuthProvider lee la llave demo únicamente al
  // montarse y una navegación reutilizada podría conservar el valor anterior.
  await browser.refresh();
  await expect($("body")).toBeDisplayed();
}

export async function entrarComoDemoSinNegocio() {
  await browser.url("/iniciar-sesion");
  await browser.execute(() => {
    window.localStorage.setItem("marmanager.demo.v1", "1");
    window.localStorage.setItem(
      "marmanager.datos.v1",
      JSON.stringify({
        negocio: null,
        empleados: [],
        clientes: [],
        casos: [],
        pasos: [],
        eventos: [],
        insumos: [],
        turnos: [],
        invitaciones: [],
      })
    );
  });
  await browser.url("/crear-negocio");
  await browser.refresh();
  await expect($("body")).toBeDisplayed();
}

export async function cargarArchivoEnInput({ nombre, tipo, contenido }) {
  await browser.execute(({ nombre, tipo, contenido }) => {
    const input = document.querySelector('input[type="file"]');
    const bytes = Uint8Array.from(atob(contenido), (c) => c.charCodeAt(0));
    const archivo = new File([bytes], nombre, { type: tipo });
    const transferencia = new DataTransfer();
    transferencia.items.add(archivo);
    Object.defineProperty(input, "files", { value: transferencia.files, configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, { nombre, tipo, contenido });
}

export async function verTexto(texto) {
  await expect($("body")).toHaveText(expect.stringContaining(texto));
}

export async function noVerTexto(texto) {
  await expect($("body")).not.toHaveText(expect.stringContaining(texto));
}
