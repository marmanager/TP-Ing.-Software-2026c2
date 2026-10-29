import { $, browser, expect } from "@wdio/globals";
import { entrar, noVerTexto, tid, verTexto } from "./ayudas.js";

// La landing pública de un negocio (docs/landing-por-negocio.md, pasos 3 a
// 5): lo que ven sus clientes desde el link que el negocio pone en su
// Instagram.
//
// Necesita la API con el módulo landing y la base con la 053. "taller-completo"
// es Taller Sur: Marcela (341 456 7890) tiene los casos 248 (AB123CD,
// "Revisión general") y 239 (AA000AA, "Reparación de motor") abiertos, y el
// 210 (ZZ999ZZ, "Frenos") completado. Viene sin la Agenda y sin horarios: la
// prueba de sacar turno los prende por la UI, como recordatorio-turno.e2e.js.
//
// Cada sección de la landing es un <section aria-labelledby="seccion-<clave>">.

const seccion = (clave) => $(`section[aria-labelledby="seccion-${clave}"]`);

// Publica la landing desde el editor y devuelve el link. El link nace en el
// navegador (origen + /n/<código>): toHaveValue espera a que el campo se
// llene en vez de leerlo vacío.
async function publicarLaLanding() {
  await browser.url("/negocio/landing");
  await expect($("h1=Tu landing")).toBeDisplayed();
  await tid("link-armar").click();
  const campo = await $("#link-landing");
  await expect(campo).toHaveValue(expect.stringContaining("/n/"));
  return campo.getValue();
}

async function abrirLaLanding() {
  await entrar("/negocio/landing");
  const link = await publicarLaLanding();
  await browser.url(link);
  await expect($("h1=Taller Sur")).toBeDisplayed();
  return link;
}

// Se pide el código por mensaje con el teléfono entero. Llega a la API de
// mentira de WhatsApp (local/api.mjs), que lo guarda en el puerto 4199.
async function codigoPedido() {
  let texto = "";
  for (let intento = 0; intento < 20; intento++) {
    try {
      texto = await (await fetch("http://127.0.0.1:4199/ultimo")).text();
    } catch (error) {
      texto = String(error);
    }
    const codigo = /"body":"[^"]*?(\d{6})/.exec(texto)?.[1];
    if (codigo) return codigo;
    await browser.pause(250);
  }
  throw new Error(`No llegó ningún código por WhatsApp (lo último fue: ${texto}).`);
}

async function pedirCodigoComo(identificador, telefono) {
  await $("#ingreso-identificador").setValue(identificador);
  await $("#ingreso-telefono").setValue(telefono);
  await tid("ingreso-pedir").click();
  await expect($("#ingreso-codigo")).toBeDisplayed();
}

// El botón dice "Ver mis casos" a secas recién con los 6 números del código;
// antes está apagado y dice qué falta.
async function entrarComo(identificador, telefono, codigo) {
  await pedirCodigoComo(identificador, telefono);
  await $("#ingreso-codigo").setValue(codigo ?? (await codigoPedido()));
  await tid("ingreso-entrar").click();
}

async function prenderLaAgenda() {
  await browser.url("/negocio/modulos");
  await tid("modulo-alternar-agenda").click();
  await expect(tid("modulo-alternar-agenda")).toHaveAttribute("aria-checked", "true");
}

// Los de fábrica: de lunes a viernes, de 9 a 18, cortando al mediodía.
async function guardarLosHorariosDeFabrica() {
  await browser.url("/negocio/horarios");
  await tid("horarios-configurar").click();
  await tid("horarios-guardar").click();
  await verTexto("Listo, tus horarios quedaron guardados.");
}

// Prender la Agenda y guardar los horarios se mandan a la API por atrás: la
// pantalla dice "listo" antes de que lleguen. Antes de publicar se espera a
// que la API los tenga, recargando el editor (que los lee de nuevo) hasta que
// "Sacar turno" deje de decir "Aparece cuando…". Si no, el link se abre con
// lo de antes y la landing no muestra "Sacar turno".
async function esperarQueLaApiTengaLaAgenda() {
  await browser.waitUntil(
    async () => {
      await browser.url("/negocio/landing");
      const titulo = await $("ol[data-orden]").$("h3=Sacar turno");
      // Sin tirar: un error acá cortaría la espera con otro mensaje.
      if (!(await titulo.waitForDisplayed({ timeout: 5000 }).catch(() => false))) return false;
      return !(await titulo.parentElement().getText()).includes("Aparece cuando");
    },
    {
      timeout: 20000,
      interval: 1000,
      timeoutMsg:
        "La API todavía no tiene la Agenda prendida y los horarios guardados: en el editor, «Sacar turno» sigue diciendo «Aparece cuando…».",
    }
  );
}

describe("Historia: Los clientes usan la landing del negocio", () => {
  it("el dueño publica la landing y al abrir el link se ve el negocio, y Mis casos pide los datos", async () => {
    await abrirLaLanding();
    await expect(seccion("negocio")).toBeDisplayed();
    await expect(seccion("mis_casos").$("#ingreso-identificador")).toBeDisplayed();
    await expect(seccion("mis_casos").$("#ingreso-telefono")).toBeDisplayed();
    // Sin la Agenda no hay turnos que sacar ni que mostrar.
    await expect(seccion("sacar_turno")).not.toBeExisting();
    await expect(seccion("mis_turnos")).not.toBeExisting();
  });

  it("Marcela entra con la patente como le salga, su teléfono entero y el código que le llega, y ve sus casos abiertos", async () => {
    await abrirLaLanding();
    await entrarComo("ab 123-cd", "+54 9 341 456 7890");
    await expect(seccion("mis_casos")).toHaveText(expect.stringContaining("Revisión general"));
    await expect(seccion("mis_casos")).toHaveText(expect.stringContaining("Reparación de motor"));
    // El completado no aparece.
    await noVerTexto("Frenos");
    await expect(tid("landing-salir")).toBeDisplayed();
  });

  it("con un teléfono que no es el suyo no recibe código, y con el código mal no entra: no ve ningún caso", async () => {
    await abrirLaLanding();
    await $("#ingreso-identificador").setValue("AB123CD");
    await $("#ingreso-telefono").setValue("+54 9 341 456 0000");
    await tid("ingreso-pedir").click();
    await verTexto("Esos datos no coinciden");
    await noVerTexto("Revisión general");

    await $("#ingreso-telefono").setValue("+54 9 341 456 7890");
    await tid("ingreso-pedir").click();
    await expect($("#ingreso-codigo")).toBeDisplayed();
    await $("#ingreso-codigo").setValue("000000");
    await tid("ingreso-entrar").click();
    await verTexto("Ese código no sirve");
    await noVerTexto("Revisión general");
  });

  it("desde Mis casos abre un caso, el seguimiento vuelve a la landing y sigue adentro", async () => {
    await abrirLaLanding();
    await entrarComo("AB123CD", "+54 9 341 456 7890");
    await tid("landing-caso-seguimiento-248").click();
    const volver = await tid("seguimiento-volver-landing");
    await expect(volver).toBeDisplayed();
    // La llave sigue en la pestaña: volver no pide los datos de nuevo.
    await volver.click();
    await expect(seccion("mis_casos")).toHaveText(expect.stringContaining("Revisión general"));
  });

  it("alguien nuevo saca turno desde la landing, queda adentro y lo ve en Mis turnos", async () => {
    await entrar("/");
    await prenderLaAgenda();
    await guardarLosHorariosDeFabrica();
    await esperarQueLaApiTengaLaAgenda();
    const link = await publicarLaLanding();
    await browser.url(link);

    const sacarTurno = await seccion("sacar_turno");
    await expect(sacarTurno).toBeDisplayed();
    // Sin entrar, un solo Ingreso: el de Mis casos. Mis turnos lleva hasta él.
    await expect(seccion("mis_casos").$("#ingreso-identificador")).toBeDisplayed();
    await expect(seccion("mis_turnos").$('a[href="#ingreso"]')).toBeDisplayed();

    // El primer horario libre del día que muestra el calendario. Su nombre
    // es "<día> a las <hora>".
    const horario = tid("calendario-horario", sacarTurno);
    const hora = await horario.getAttribute("data-hora");
    await horario.click();

    await $("#turno-motivo").setValue("Ruido en el motor");
    await $("#turno-nombre").setValue("Julián Nuevo");
    await $("#turno-telefono").setValue("341 999 0000");
    await $("#turno-identificador").setValue("AD111AA");
    await tid("landing-pedir-turno").click();

    await expect(sacarTurno).toHaveText(expect.stringContaining("Listo, quedaste anotado"));
    await expect(sacarTurno).toHaveText(expect.stringContaining(`a las ${hora}`));
    // Registrarse lo dejó adentro, sin poner los datos aparte.
    await expect(tid("landing-salir")).toBeDisplayed();
    await expect(seccion("mis_turnos")).toHaveText(expect.stringContaining("Ruido en el motor"));
    await expect(seccion("mis_turnos")).toHaveText(expect.stringContaining(`a las ${hora}`));
  });
});
