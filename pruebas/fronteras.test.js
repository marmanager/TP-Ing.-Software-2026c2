// Correr con: npm run test:unit
//
// Las fronteras del front, verificadas leyendo el código fuente.
//
// No prueban lo que el sistema hace: prueban DÓNDE ESTÁ ESCRITA cada cosa.
// Es lo único que evita que, mientras dura la migración a la API, alguien
// abra un atajo que después hay que perseguir por veinte archivos.
//
// El reparto que vigilan (docs/api.md):
//
//   Pantalla  →  acción de datos.js  →  api.js  →  API  →  base
//
//   · Una pantalla no habla con la base ni con la API: pide a useDatos().
//   · Sólo api.js conoce la dirección de la API.
//   · Los módulos de lógica pura no tocan la red: por eso se pueden probar.
//
// Es el mismo tipo de test que el de "qué falta" en que-falta.test.js: lee
// archivos y falla si aparece algo que no corresponde.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative, sep } from "node:path";

const raiz = fileURLToPath(new URL("../", import.meta.url));

// Todos los .js de una carpeta, con la ruta escrita como en el repo
// ("src/app/casos/[id]/page.js"), para que el mensaje de un test que falla
// se pueda copiar y pegar.
const archivosDe = (carpeta) =>
  readdirSync(join(raiz, carpeta), { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".js"))
    .map((e) => relative(raiz, join(e.parentPath ?? e.path, e.name)).split(sep).join("/"))
    .sort();

const leer = (archivo) => readFileSync(join(raiz, archivo), "utf8");

// Las excepciones llevan motivo. Una excepción sin motivo es un agujero que
// nadie va a cerrar.
const PERMITIDOS = {
  // Es una ruta de servidor (route handler), no una pantalla: corre en el
  // servidor de Next y necesita leer la agenda para armar el .ics.
  "src/app/calendario/[codigo]/route.js": "ruta de servidor, no es una pantalla",
  // Los fetch de Mercado Pago entraron con la integración de pagos. Tienen
  // que pasar a una acción de datos.js cuando se migre ese módulo.
  "src/componentes/Cobros.js": "los fetch de Mercado Pago, hasta que pasen a datos.js",
};

const permitido = (archivo) => Object.hasOwn(PERMITIDOS, archivo);

// ------------------------------------------------------------
// 1. Las pantallas no hablan con la base
// ------------------------------------------------------------

test("ninguna pantalla ni componente habla con Supabase", () => {
  const culpables = [...archivosDe("src/app"), ...archivosDe("src/componentes")]
    .filter((a) => !permitido(a))
    .filter((a) => {
      const fuente = leer(a);
      return /from ["']@\/lib\/supabase["']/.test(fuente) || /\bsupabase\.(from|rpc|auth|storage)\b/.test(fuente);
    });

  assert.equal(
    culpables.length,
    0,
    `estas pantallas hablan con Supabase directo; los datos se piden a useDatos():\n${culpables.join("\n")}`
  );
});

// ------------------------------------------------------------
// 2. Las pantallas no hablan con la API
// ------------------------------------------------------------
// Sí pueden llamar a una ruta propia de Next ("/api/..."), que es parte del
// front. Lo que no pueden es salir a la API del sistema por su cuenta.

test("ninguna pantalla ni componente llama a la API directo", () => {
  const culpables = [...archivosDe("src/app"), ...archivosDe("src/componentes")]
    .filter((a) => !permitido(a))
    .filter((a) => {
      const fuente = leer(a);
      if (/NEXT_PUBLIC_API_URL/.test(fuente)) return true;
      // fetch(`${ALGO}/...`) o fetch("https://...") es salir afuera;
      // fetch("/api/...") es una ruta propia y está bien.
      return /fetch\(\s*[`"']?\s*(\$\{|https?:)/.test(fuente);
    });

  assert.equal(
    culpables.length,
    0,
    `estas pantallas llaman a la API por su cuenta; agregá una acción en datos.js:\n${culpables.join("\n")}`
  );
});

// ------------------------------------------------------------
// 3. Sólo api.js conoce la dirección de la API
// ------------------------------------------------------------

test("la dirección de la API se nombra en un solo lugar", () => {
  // pagos.js es la costura anterior, con la misma idea: se unifica con
  // api.js cuando se migre el módulo de cobros.
  const suyos = ["src/lib/api.js", "src/lib/pagos.js"];

  const culpables = archivosDe("src/lib")
    .filter((a) => !suyos.includes(a))
    .filter((a) => /NEXT_PUBLIC_API_URL/.test(leer(a)));

  assert.equal(culpables.length, 0, `sólo api.js arma la dirección de la API:\n${culpables.join("\n")}`);
});

// ------------------------------------------------------------
// 4. La lógica pura no toca la red
// ------------------------------------------------------------
// Estos módulos son los que se pueden probar sin navegador y sin base. Si
// aparece un fetch o una consulta acá adentro, es que la regla se está
// mezclando con la comunicación, y el día que la regla se mude a la API va a
// haber que desenredarla.

const PUROS = [
  "src/lib/estados.js",
  "src/lib/cobros.js",
  "src/lib/horarios.js",
  "src/lib/presets.js",
  "src/lib/validaciones.js",
  "src/lib/seguimiento.js",
  "src/lib/inicio.js",
  "src/lib/turnos.js",
  "src/lib/historial.js",
  "src/lib/permisos.js",
  "src/lib/nombres.js",
  "src/lib/modulos.js",
  "src/lib/fechas.js",
];

for (const archivo of PUROS) {
  test(`${archivo} no toca la red`, () => {
    const fuente = leer(archivo);
    // Se mira el código, no los comentarios: varios de estos archivos
    // explican en prosa qué hace la base, y eso está bien.
    const codigo = fuente
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");

    assert.ok(!/\bfetch\(/.test(codigo), `${archivo} hace fetch: eso va en api.js`);
    assert.ok(
      !/\bsupabase\.(from|rpc|auth|storage)\b/.test(codigo),
      `${archivo} consulta la base: eso va en datos.js`
    );
  });
}
