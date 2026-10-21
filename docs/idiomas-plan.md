# Idiomas — plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguir el avance.

**Objetivo:** que la app se vea en castellano o en inglés según quien la mira, sin cambiar las direcciones.

**Arquitectura:** el layout raíz (servidor) elige el idioma con la cookie `idioma` y `Accept-Language`, y le pasa el diccionario activo a un `IdiomaProvider` de cliente. Las pantallas usan `useIdioma()` → `{ idioma, locale, t }`. Los presets de rubro tienen una capa en inglés que se superpone a la castellana.

**Tecnología:** Next 16 (App Router, `cookies()`/`headers()` de `next/headers`), React 19, `Intl.PluralRules`/`Intl.*`, Jest 30 (ESM, sin transformar JSX), WebdriverIO 9.

**Spec:** docs/idiomas.md

## Restricciones generales

- Sólo dos idiomas: `es` (fuente, por defecto) y `en`. Locales: `es` → `es-AR`, `en` → `en-US`.
- Orden: cookie `idioma` → `Accept-Language` → `es`. Sin país por IP, sin prefijo en la dirección, sin `proxy.js`.
- Cookie: `idioma=<es|en>; path=/; max-age=31536000; samesite=lax`.
- Sin dependencias nuevas.
- **Lo que alguien escribió no se traduce:** nombres de casos, productos, categorías, clientes, sedes, roles, notas, motivos, plantillas de recordatorio, textos de la landing, el "qué falta" guardado en un caso. Se traducen menús, botones, títulos, descripciones, avisos, errores, ayudas y los textos de fábrica de los presets.
- Moneda ARS y zona horaria `America/Argentina/Buenos_Aires` quedan fijas en los dos idiomas.
- Los mensajes de WhatsApp que arma el negocio (src/lib/seguimiento-whatsapp.js) salen en el idioma de quien los manda: usan el `t` de su pantalla.
- Cada idioma se nombra en su idioma: "Castellano", "English".
- Los tests de Jest no pueden importar archivos con JSX (`transform: {}` en jest.config.js): la lógica que se prueba va en módulos sin JSX.
- Antes de tocar APIs de Next, leer la guía en `node_modules/next/dist/docs/` (AGENTS.md).
- Los comentarios siguen el estilo del repo: en castellano, explicando el porqué.

## Receta de migración de una pantalla

Las tareas 8 a 14 aplican esta receta a cada archivo de su lista:

1. `const { t, locale } = useIdioma();` (de `@/lib/useIdioma`) en cada componente que muestre texto.
2. Cada texto fijo pasa a `t("<seccion>.<pantalla>.<clave>")`, con la clave nueva en `src/lib/idiomas/es.js` (el texto actual, sin cambiar ni una letra) y en `src/lib/idiomas/en.js` (la traducción). Las claves se agrupan como las rutas: `casos.nuevo.titulo`, `inventario.sedes.vacio`.
3. Texto con variables: `t("casos.cuantos", { n })` con `{ one: "{n} caso", other: "{n} casos" }`. Nunca se arma una frase pegando pedazos traducidos.
4. `useTitulo("Iniciar sesión")` → `useTitulo(t("acceso.ingreso.titulo"))`.
5. `"es-AR"` → `locale`. Una función de `src/lib/` que formatea recibe `locale` como último parámetro, con `"es-AR"` por defecto.
6. Una función de `src/lib/` que devuelve texto para mostrar recibe `t` como último parámetro. No se usa un `t` global: en el servidor un módulo se comparte entre pedidos y mezclaría idiomas.
7. Errores: donde se muestra `r.error.mensaje` (o el `error` que devuelve auth.js), se muestra `textoDeError(t, r.error)`. Cada código nuevo va a `errores` en los dos diccionarios.
8. Presets: `preset(rubro)` → `preset(rubro, idioma)`, y lo mismo con `vocabulario`, `etiquetaEstado`, `comoSeIdentifica`, `ejemplosDe`, `comoSeEspera`, `categoriasDe` y `queSignificaPara`.
9. Los datos (lo que viene de Supabase o la API) se muestran tal cual.
10. Verificar: `npm run test:unit` en verde; levantar el preview (`front-roles` en .claude/launch.json), recorrer cada pantalla de la lista con la cookie en `es` (tiene que verse igual que antes) y en `en` (ningún texto de la app queda en castellano, salvo los datos).

## Qué mirar en la revisión

1. **Navegador en otro idioma (`fr-FR,fr;q=0.9`):** cae en `es`, no en la clave cruda ni en un error. Lo cubre la Tarea 1.
2. **Cookie basura (`idioma=xx`):** se ignora y decide `Accept-Language`. Lo cubre la Tarea 1.
3. **Una clave que falta en `en`:** se ve en castellano, nunca `casos.nuevo.titulo` en pantalla. Lo cubre la Tarea 1 (fallback) y la Tarea 2 (claves de `en` ⊆ `es`).
4. **Un código de error que la app no conoce:** se ve el mensaje que vino de la API y no `errores.algo_nuevo`. Lo cubre la Tarea 1.
5. **Los e2e existentes con Chrome en inglés:** siguen viendo castellano. Lo cubre la Tarea 5.

---

### Tarea 0: Rama

- [ ] **Paso 1: Crear la rama desde main**

```bash
git fetch origin
git switch -c idiomas origin/main
git add docs/idiomas.md docs/idiomas-plan.md
git commit -m "Idiomas: diseño y plan"
```

---

### Tarea 1: Elegir el idioma y traducir (lógica pura)

**Archivos:**
- Crear: `src/lib/idioma.js`
- Test: `pruebas/idioma.test.js`

**Interfaces:**
- Produce:
  - `IDIOMAS: ["es", "en"]`
  - `LOCALES: { es: "es-AR", en: "en-US" }`
  - `NOMBRES_IDIOMA: { es: "Castellano", en: "English" }`
  - `elegirIdioma(cookie?: string, acceptLanguage?: string): "es" | "en"`
  - `traducir({ diccionario, base, locale }, clave: string, vars?: object, siFalta?: string): string`
  - `textoDeError(t, error?: { codigo, mensaje }): string`
  - `cookieDeIdioma(idioma: string): string`

- [ ] **Paso 1: Escribir los tests**

```js
// Correr con: npm test
//
// Cómo se elige el idioma (cookie, navegador, castellano) y cómo se busca un
// texto en el diccionario (docs/idiomas.md).

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { elegirIdioma, traducir, textoDeError, cookieDeIdioma } from "../src/lib/idioma.js";

test("la cookie manda si es un idioma conocido", () => {
  assert.equal(elegirIdioma("en", "es-AR,es;q=0.9"), "en");
  assert.equal(elegirIdioma("es", "en-US"), "es");
});

test("una cookie desconocida se ignora", () => {
  assert.equal(elegirIdioma("xx", "en-US,en;q=0.9"), "en");
});

test("sin cookie decide el navegador, por peso q y sin región", () => {
  assert.equal(elegirIdioma(undefined, "en-GB,en;q=0.9"), "en");
  assert.equal(elegirIdioma(undefined, "es-MX"), "es");
  assert.equal(elegirIdioma(undefined, "en;q=0.5,es;q=0.8"), "es");
  assert.equal(elegirIdioma(undefined, "fr-FR,fr;q=0.9,en;q=0.7"), "en");
});

test("sin nada conocido, castellano", () => {
  assert.equal(elegirIdioma(undefined, "fr-FR,fr;q=0.9"), "es");
  assert.equal(elegirIdioma(undefined, null), "es");
  assert.equal(elegirIdioma(undefined, ""), "es");
  assert.equal(elegirIdioma(undefined, "en;q=0"), "es");
});

const es = {
  ingreso: { titulo: "Iniciar sesión", hola: "Hola, {nombre}", soloEs: "Sólo acá" },
  casos: { cuantos: { one: "{n} caso", other: "{n} casos" } },
  errores: { sin_permiso: "No tenés permiso para hacer eso." },
};
const en = {
  ingreso: { titulo: "Sign in", hola: "Hi, {nombre}" },
  casos: { cuantos: { one: "{n} case", other: "{n} cases" } },
};
const enIngles = { diccionario: en, base: es, locale: "en-US" };
const enCastellano = { diccionario: es, base: null, locale: "es-AR" };

test("busca por clave con puntos e interpola", () => {
  assert.equal(traducir(enIngles, "ingreso.titulo"), "Sign in");
  assert.equal(traducir(enIngles, "ingreso.hola", { nombre: "Ana" }), "Hi, Ana");
  assert.equal(traducir(enCastellano, "ingreso.hola", { nombre: "Ana" }), "Hola, Ana");
});

test("una variable que no se pasó queda escrita, no como undefined", () => {
  assert.equal(traducir(enIngles, "ingreso.hola"), "Hi, {nombre}");
});

test("plural según el idioma", () => {
  assert.equal(traducir(enIngles, "casos.cuantos", { n: 1 }), "1 case");
  assert.equal(traducir(enIngles, "casos.cuantos", { n: 3 }), "3 cases");
  assert.equal(traducir(enCastellano, "casos.cuantos", { n: 0 }), "0 casos");
});

test("lo que falta en inglés se ve en castellano", () => {
  assert.equal(traducir(enIngles, "ingreso.soloEs"), "Sólo acá");
});

test("lo que falta en los dos devuelve siFalta, o la clave", () => {
  assert.equal(traducir(enIngles, "no.existe"), "no.existe");
  assert.equal(traducir(enIngles, "no.existe", {}, "Otro texto"), "Otro texto");
});

test("un error se traduce por código y, si no se conoce, muestra su mensaje", () => {
  const t = (clave, vars, siFalta) => traducir(enCastellano, clave, vars, siFalta);
  assert.equal(textoDeError(t, { codigo: "sin_permiso", mensaje: "x" }), "No tenés permiso para hacer eso.");
  assert.equal(textoDeError(t, { codigo: "algo_nuevo", mensaje: "Lo dijo la API" }), "Lo dijo la API");
  assert.equal(textoDeError(t, { mensaje: "Sin código" }), "Sin código");
  assert.equal(textoDeError(t, null), "");
});

test("la cookie dura un año y vale para toda la app", () => {
  assert.equal(cookieDeIdioma("en"), "idioma=en; path=/; max-age=31536000; samesite=lax");
});
```

- [ ] **Paso 2: Correr y ver que fallan**

Correr: `npm run test:unit -- pruebas/idioma.test.js`
Esperado: FALLA con "Cannot find module '../src/lib/idioma.js'".

- [ ] **Paso 3: Escribir `src/lib/idioma.js`**

```js
// El idioma de la app (docs/idiomas.md): castellano o inglés según quien la
// mira. Decide la cookie "idioma" si la persona eligió en el selector; si no,
// el idioma del navegador; si no, castellano.
//
// Sin JSX a propósito: los tests lo importan directo (jest no transforma).
// El contexto de React vive en useIdioma.js.

export const IDIOMAS = ["es", "en"];

// La moneda y la zona horaria no cambian con el idioma: el negocio está en
// Argentina aunque quien mira lea en inglés.
export const LOCALES = { es: "es-AR", en: "en-US" };

// Cada idioma se nombra en su idioma: quien no lee castellano no busca "Inglés".
export const NOMBRES_IDIOMA = { es: "Castellano", en: "English" };

// "en-GB,en;q=0.9,es;q=0.5" → el primero conocido de mayor peso. La región no
// importa: en-GB y en-US son "en". q=0 quiere decir "éste no".
export function elegirIdioma(cookie, acceptLanguage) {
  if (IDIOMAS.includes(cookie)) return cookie;
  const pedidos = (acceptLanguage ?? "")
    .split(",")
    .map((parte) => {
      const [etiqueta, ...params] = parte.trim().toLowerCase().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { idioma: etiqueta.split("-")[0], q: q ? Number(q.slice(2)) : 1 };
    })
    .filter((p) => p.q > 0)
    .sort((a, b) => b.q - a.q);
  return pedidos.find((p) => IDIOMAS.includes(p.idioma))?.idioma ?? "es";
}

const buscar = (diccionario, clave) => clave.split(".").reduce((o, k) => o?.[k], diccionario);

// "base" es el castellano cuando se mira en inglés: lo que todavía no se
// tradujo se ve en castellano y no como una clave. En castellano es null.
//
// Un texto con plural es { one, other } y elige Intl.PluralRules con vars.n.
export function traducir({ diccionario, base, locale }, clave, vars = {}, siFalta = clave) {
  let texto = buscar(diccionario, clave) ?? buscar(base, clave);
  if (texto == null) return siFalta;
  if (typeof texto === "object") {
    texto = texto[new Intl.PluralRules(locale).select(vars.n ?? 1)] ?? texto.other;
  }
  return texto.replace(/\{(\w+)\}/g, (todo, k) => (k in vars ? String(vars[k]) : todo));
}

// Los errores se traducen por código (src/lib/api.js). Un código que la app
// todavía no conoce muestra el mensaje que vino, en el idioma en que vino.
export const textoDeError = (t, error) =>
  error ? (error.codigo ? t(`errores.${error.codigo}`, {}, error.mensaje) : error.mensaje) : "";

export const cookieDeIdioma = (idioma) => `idioma=${idioma}; path=/; max-age=31536000; samesite=lax`;
```

- [ ] **Paso 4: Correr y ver que pasan**

Correr: `npm run test:unit -- pruebas/idioma.test.js`
Esperado: PASA (11 tests).

- [ ] **Paso 5: Commit**

```bash
git add src/lib/idioma.js pruebas/idioma.test.js
git commit -m "Idiomas: elegir el idioma y buscar textos"
```

---

### Tarea 2: Diccionarios y test de claves

**Archivos:**
- Crear: `src/lib/idiomas/es.js`, `src/lib/idiomas/en.js`
- Test: `pruebas/diccionarios.test.js`

**Interfaces:**
- Produce: `export default` de cada archivo, un objeto con secciones `idioma` y `errores`. Las tareas siguientes agregan secciones.

- [ ] **Paso 1: Escribir el test**

```js
// Correr con: npm test
//
// El castellano es la fuente: el inglés no puede tener claves que el
// castellano no tenga (serían textos que nadie ve), y un plural tiene que
// traer "one" y "other".

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import es from "../src/lib/idiomas/es.js";
import en from "../src/lib/idiomas/en.js";

const esPlural = (v) => v && typeof v === "object" && "other" in v;

function claves(o, prefijo = "") {
  return Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" && !esPlural(v) ? claves(v, `${prefijo}${k}.`) : [`${prefijo}${k}`]
  );
}

function valor(o, clave) {
  return clave.split(".").reduce((x, k) => x?.[k], o);
}

test("toda clave en inglés existe en castellano", () => {
  const deEs = new Set(claves(es));
  const sobran = claves(en).filter((c) => !deEs.has(c));
  assert.deepEqual(sobran, []);
});

test("cada plural trae one y other, en los dos idiomas", () => {
  for (const dicc of [es, en]) {
    for (const c of claves(dicc)) {
      const v = valor(dicc, c);
      if (typeof v === "object") {
        assert.equal(typeof v.one, "string", `${c} sin one`);
        assert.equal(typeof v.other, "string", `${c} sin other`);
      }
    }
  }
});

test("los códigos de error de api.js están en los dos idiomas", () => {
  for (const codigo of ["sesion_vencida", "sin_permiso", "no_esta", "choque", "datos_invalidos", "muchos_intentos", "sin_conexion", "error"]) {
    assert.equal(typeof es.errores[codigo], "string", `es sin ${codigo}`);
    assert.equal(typeof en.errores[codigo], "string", `en sin ${codigo}`);
  }
});
```

- [ ] **Paso 2: Correr y ver que falla**

Correr: `npm run test:unit -- pruebas/diccionarios.test.js`
Esperado: FALLA con "Cannot find module '../src/lib/idiomas/es.js'".

- [ ] **Paso 3: Leer los códigos reales de `src/lib/api.js`**

Abrir `src/lib/api.js` líneas 45-130. Los códigos de la tabla por estado (401-429) están arriba. Los de "sin conexión", "error genérico" y "sin configurar" (líneas ~62, ~67, ~127) tienen su propio `codigo`. Si alguno no se llama `sin_conexion` o `error`, corregir la lista del test del Paso 1 con el nombre real y agregar el que falte (por ejemplo, el de la línea 127).

- [ ] **Paso 4: Escribir `src/lib/idiomas/es.js`**

Los textos de `errores` se copian **letra por letra** de `src/lib/api.js`.

```js
// Los textos de la app en castellano (docs/idiomas.md). Es la fuente: toda
// clave existe acá, y lo que falta en inglés se ve con este texto.
//
// Se agrupan como las rutas: casos.nuevo.titulo, inventario.sedes.vacio. Un
// plural es { one, other } con {n} adentro.

export default {
  idioma: {
    titulo: "Idioma",
    apoyo: "En qué idioma ves la app en este dispositivo.",
  },
  errores: {
    sesion_vencida: "Tu sesión venció. Volvé a entrar y probá de nuevo.",
    sin_permiso: "No tenés permiso para hacer eso.",
    no_esta: "Eso ya no está.",
    choque: "Alguien más lo cambió mientras tanto. Volvé a abrirlo.",
    datos_invalidos: "Revisá los datos: hay algo que no está bien.",
    muchos_intentos: "Probá de nuevo en un minuto: se hicieron muchos intentos seguidos.",
    sin_conexion: "No pudimos conectarnos. Fijate que tengas internet y volvé a probar.",
    error: "No pudimos completar la operación. Probá de nuevo en un rato.",
  },
};
```

- [ ] **Paso 5: Escribir `src/lib/idiomas/en.js`**

```js
// The app's English texts (docs/idiomas.md). Every key here must exist in
// es.js; anything missing here shows in Spanish.

export default {
  idioma: {
    titulo: "Language",
    apoyo: "The language you see the app in on this device.",
  },
  errores: {
    sesion_vencida: "Your session expired. Sign in again and try once more.",
    sin_permiso: "You don't have permission to do that.",
    no_esta: "That's no longer there.",
    choque: "Someone else changed it in the meantime. Open it again.",
    datos_invalidos: "Check the details: something isn't right.",
    muchos_intentos: "Try again in a minute: there were too many attempts in a row.",
    sin_conexion: "We couldn't connect. Check your internet connection and try again.",
    error: "We couldn't complete that. Try again in a little while.",
  },
};
```

- [ ] **Paso 6: Correr y ver que pasa**

Correr: `npm run test:unit -- pruebas/diccionarios.test.js`
Esperado: PASA (3 tests).

- [ ] **Paso 7: Commit**

```bash
git add src/lib/idiomas pruebas/diccionarios.test.js
git commit -m "Idiomas: diccionarios en castellano e inglés"
```

---

### Tarea 3: Provider y layout

**Archivos:**
- Crear: `src/lib/useIdioma.js`
- Modificar: `src/app/layout.js` (función `RootLayout` y el `<html lang="es">`)

**Interfaces:**
- Consume: `elegirIdioma`, `LOCALES`, `traducir` (Tarea 1); diccionarios (Tarea 2).
- Produce: `IdiomaProvider({ idioma, diccionario, base, children })` y `useIdioma(): { idioma, locale, t(clave, vars?, siFalta?) }`.

- [ ] **Paso 1: Leer la guía de Next**

Leer `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md` y `headers.md` (o buscarlos con `grep -rl "cookies()" node_modules/next/dist/docs/01-app/03-api-reference`). Confirmar que en Next 16 son `async` (`await cookies()`).

- [ ] **Paso 2: Escribir `src/lib/useIdioma.js`**

```js
"use client";

// El idioma para los componentes de cliente (src/lib/idioma.js). El layout
// raíz lo elige en el servidor y lo pasa acá con su diccionario, así la
// primera pantalla ya sale en el idioma bueno y no salta después.

import { createContext, useContext, useMemo } from "react";
import { LOCALES, traducir } from "./idioma";

const Contexto = createContext(null);

export function IdiomaProvider({ idioma, diccionario, base, children }) {
  const valor = useMemo(() => {
    const locale = LOCALES[idioma];
    const fuente = { diccionario, base, locale };
    return { idioma, locale, t: (clave, vars, siFalta) => traducir(fuente, clave, vars, siFalta) };
  }, [idioma, diccionario, base]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const useIdioma = () => useContext(Contexto);
```

- [ ] **Paso 3: Modificar `src/app/layout.js`**

Agregar a los imports:

```js
import { cookies, headers } from "next/headers";
import { elegirIdioma } from "@/lib/idioma";
import { IdiomaProvider } from "@/lib/useIdioma";
import es from "@/lib/idiomas/es";
import en from "@/lib/idiomas/en";
```

Reemplazar `export default function RootLayout({ children }) {` y el `return` por:

```js
// Leer la cookie acá hace que cada ruta se dibuje en cada pedido y no quede
// como HTML estático. Se acepta (docs/idiomas.md): decidirlo en el navegador
// mostraría castellano y después saltaría a inglés.
export default async function RootLayout({ children }) {
  const idioma = elegirIdioma(
    (await cookies()).get("idioma")?.value,
    (await headers()).get("accept-language")
  );

  return (
    // suppressHydrationWarning: el script del tema pone data-tema en <html>
    // antes de que React hidrate, y eso no es un error.
    <html lang={idioma} className={`${figtree.variable} ${sourceSans.variable} ${inter.variable} ${serif.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: CSS_APARIENCIA }} />
        <ScriptTema />
      </head>
      <body className="antialiased">
        {/* Por fuera de todo: auth y datos también muestran textos. Al
            cliente va sólo el diccionario activo, y el castellano de base
            cuando se mira en inglés. */}
        <IdiomaProvider idioma={idioma} diccionario={idioma === "en" ? en : es} base={idioma === "en" ? es : null}>
          <AuthProvider>
            <DatosProvider>
              <Guardia>{children}</Guardia>
            </DatosProvider>
          </AuthProvider>
        </IdiomaProvider>
      </body>
    </html>
  );
}
```

- [ ] **Paso 4: Verificar en el preview**

Levantar `front-roles` con preview_start. Con `javascript_tool`:
- `document.documentElement.lang` → `"es"` (el navegador del panel puede mandar `en`; en ese caso da `"en"`, y también está bien).
- `document.cookie = "idioma=en; path=/"; location.reload()` → después, `document.documentElement.lang` da `"en"`.
- `document.cookie = "idioma=es; path=/"; location.reload()` → `"es"`.

`read_console_messages` sin errores de hidratación. `npm run build` termina sin errores (las rutas pasan a ser dinámicas: `ƒ` en la tabla del build; es lo esperado).

- [ ] **Paso 5: Commit**

```bash
git add src/lib/useIdioma.js src/app/layout.js
git commit -m "Idiomas: el layout elige el idioma y lo pasa a la app"
```

---

### Tarea 4: Selector de idioma

**Archivos:**
- Crear: `src/componentes/SelectorIdioma.js`
- Modificar: `src/app/perfil/page.js:537-538` (después de `<Tema />`), `src/componentes/PantallaEntrada.js` (al pie), `src/app/seguimiento/[codigo]/page.js`, `src/app/turnos/[codigo]/page.js`, `src/app/n/[codigo]/page.js` (al pie de cada una)

**Interfaces:**
- Consume: `IDIOMAS`, `NOMBRES_IDIOMA`, `cookieDeIdioma` (Tarea 1); `useIdioma` (Tarea 3); claves `idioma.titulo`, `idioma.apoyo` (Tarea 2).
- Produce: `<SelectorIdioma />` (sin props).

- [ ] **Paso 1: Escribir `src/componentes/SelectorIdioma.js`**

```js
"use client";

// Elegir el idioma (docs/idiomas.md). Queda en una cookie de este
// dispositivo, como el tema; router.refresh() vuelve a pedir la pantalla
// para que el layout la dibuje en el idioma nuevo sin perder lo escrito.

import { useRouter } from "next/navigation";
import { IDIOMAS, NOMBRES_IDIOMA, cookieDeIdioma } from "@/lib/idioma";
import { useIdioma } from "@/lib/useIdioma";

export default function SelectorIdioma() {
  const router = useRouter();
  const { idioma, t } = useIdioma();

  function elegir(nuevo) {
    if (nuevo === idioma) return;
    document.cookie = cookieDeIdioma(nuevo);
    router.refresh();
  }

  return (
    <div role="group" aria-label={t("idioma.titulo")} className="flex flex-wrap gap-x-4">
      {IDIOMAS.map((clave) => (
        <button
          key={clave}
          type="button"
          lang={clave}
          aria-pressed={idioma === clave}
          onClick={() => elegir(clave)}
          className="inline-flex min-h-12 items-center font-bold text-azul aria-pressed:underline aria-pressed:underline-offset-4"
        >
          {NOMBRES_IDIOMA[clave]}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Paso 2: Sumarlo a Mi perfil**

En `src/app/perfil/page.js`, importar `SelectorIdioma` y `useIdioma`. Después de `<Tema />` (línea ~538):

```js
      <TituloSeccion id="idioma">{t("idioma.titulo")}</TituloSeccion>
      <Tarjeta>
        <p className="mb-2 text-tinta-media">{t("idioma.apoyo")}</p>
        <SelectorIdioma />
      </Tarjeta>
```

con `const { t } = useIdioma();` en el componente de la página.

- [ ] **Paso 3: Sumarlo a las pantallas sin sesión**

En `src/componentes/PantallaEntrada.js`, al pie del `max-w-[440px]` y después del último `<p>`: `<div className="mt-4"><SelectorIdioma /></div>`. Eso cubre iniciar sesión, crear cuenta y crear negocio. En `seguimiento/[codigo]`, `turnos/[codigo]` y `n/[codigo]`, el mismo `<div className="mt-4"><SelectorIdioma /></div>` como último hijo del contenedor principal de la página.

- [ ] **Paso 4: Verificar en el preview**

En `/iniciar-sesion`: tocar "English" → `document.cookie` incluye `idioma=en` y `document.documentElement.lang === "en"` sin recargar a mano. "English" queda con `aria-pressed="true"`. Tocar "Castellano" vuelve. En `/perfil` (con sesión de prueba sembrada) aparece la sección "Idioma". Captura de pantalla de las dos.

- [ ] **Paso 5: Commit**

```bash
git add src/componentes/SelectorIdioma.js src/app/perfil/page.js src/componentes/PantallaEntrada.js "src/app/seguimiento/[codigo]/page.js" "src/app/turnos/[codigo]/page.js" "src/app/n/[codigo]/page.js"
git commit -m "Idiomas: selector en Mi perfil y en las pantallas sin sesión"
```

---

### Tarea 5: e2e en castellano fijo, y uno en inglés

**Archivos:**
- Modificar: `wdio.conf.js` (`capabilities`)
- Crear: `pruebas/e2e/idioma.e2e.js`

- [ ] **Paso 1: Fijar el castellano en Chrome**

En `wdio.conf.js`, reemplazar `capabilities` por:

```js
  // Chrome headless manda Accept-Language en inglés: sin esto los e2e, que
  // buscan textos en castellano, verían la app en inglés (docs/idiomas.md).
  capabilities: [
    {
      browserName: "chrome",
      "wdio:enforceWebDriverClassic": true,
      "goog:chromeOptions": { args: ["--lang=es-AR"], prefs: { "intl.accept_languages": "es-AR,es" } },
    },
  ],
```

- [ ] **Paso 2: Escribir `pruebas/e2e/idioma.e2e.js`**

```js
// El idioma se elige por cookie y la dirección no cambia (docs/idiomas.md).

import { browser, $, expect } from "@wdio/globals";

describe("Idioma", () => {
  afterEach(async () => {
    await browser.deleteCookies(["idioma"]);
  });

  it("sin cookie, con Chrome en castellano, se ve en castellano", async () => {
    await browser.url("/iniciar-sesion");
    await expect($("html")).toHaveAttribute("lang", "es");
    await expect($("h1")).toHaveText("Iniciar sesión");
  });

  it("con la cookie en inglés se ve en inglés, en la misma dirección", async () => {
    await browser.url("/iniciar-sesion");
    await browser.setCookies({ name: "idioma", value: "en", path: "/" });
    await browser.refresh();
    await expect($("html")).toHaveAttribute("lang", "en");
    await expect($("h1")).toHaveText("Sign in");
    await expect(browser).toHaveUrl(expect.stringContaining("/iniciar-sesion"));
  });

  it("el selector cambia el idioma y lo recuerda", async () => {
    await browser.url("/iniciar-sesion");
    await $("button=English").click();
    await expect($("h1")).toHaveText("Sign in");
    await browser.refresh();
    await expect($("h1")).toHaveText("Sign in");
  });
});
```

Si el título de la pantalla no es `h1`, usar el selector que dibuja `TituloPantalla` en `src/componentes/ui.js`. Este e2e pasa recién después de la Tarea 6.

- [ ] **Paso 3: Commit**

```bash
git add wdio.conf.js pruebas/e2e/idioma.e2e.js
git commit -m "Idiomas: e2e en castellano fijo y prueba del selector"
```

---

### Tarea 6: Pantalla piloto, iniciar sesión, y errores por código

**Archivos:**
- Modificar: `src/app/iniciar-sesion/page.js`, `src/lib/auth.js` (los `return { ok: false, error: ... }`, líneas ~228-326), `src/componentes/PantallaEntrada.js` ("Tu negocio, en orden" y el pie), `src/componentes/BotonGoogle.js`, `src/lib/idiomas/es.js`, `src/lib/idiomas/en.js`

**Interfaces:**
- Consume: `useIdioma`, `textoDeError`.
- Produce: `auth.js` devuelve `{ ok: false, error: { codigo, mensaje } }` en vez de un texto. Las pantallas que lo muestran usan `textoDeError(t, r.error)`.

- [ ] **Paso 1: `auth.js` devuelve el error entero**

En cada `return { ok: false, error: r.error.mensaje }` → `return { ok: false, error: r.error }`. En los textos escritos ahí mismo (`"No hay una sesión abierta."`, `"Para recuperar la contraseña hace falta..."`) → `{ codigo: "sin_sesion", mensaje: "No hay una sesión abierta." }` y `{ codigo: "sin_api_recuperar", mensaje: "..." }`, con las dos claves nuevas en `errores` de ambos diccionarios. Actualizar el comentario de la línea 228: ahora devuelven `{ ok: false, error: { codigo, mensaje } }`.

- [ ] **Paso 2: Buscar quién muestra esos errores**

Correr: `grep -rn "useAuth" src/app src/componentes`. En cada pantalla que guarda `r.error` para mostrarlo (por ejemplo `setErrorGeneral(r.error)`), mostrar `textoDeError(t, errorGeneral)`. Sin esto, React rompe con "Objects are not valid as a React child".

- [ ] **Paso 3: Migrar `iniciar-sesion/page.js`, `PantallaEntrada.js` y `BotonGoogle.js` con la receta**

Las claves quedan así (castellano tal cual, inglés traducido):

```js
// es.js
  acceso: {
    marca: "Tu negocio, en orden",
    ingreso: {
      titulo: "Iniciar sesión",
      apoyo: "Entrá para ver los casos de tu negocio.",
      conGoogle: "Entrar con Google",
      mail: "Tu mail",
      contrasena: "Tu contraseña",
      mostrar: "Mostrar la contraseña",
      ocultar: "Ocultar la contraseña",
      olvide: "Me olvidé la contraseña",
      faltaMail: "falta el mail",
      faltaContrasena: "falta la contraseña",
      entrando: "entrando…",
      sinApi: "El sistema todavía no está conectado a la API: por ahora no se puede entrar.",
      sinCuenta: "¿No tenés cuenta?",
      crearUna: "Creá una",
    },
  },
```

```js
// en.js
  acceso: {
    marca: "Your business, in order",
    ingreso: {
      titulo: "Sign in",
      apoyo: "Sign in to see your business's cases.",
      conGoogle: "Sign in with Google",
      mail: "Your email",
      contrasena: "Your password",
      mostrar: "Show password",
      ocultar: "Hide password",
      olvide: "I forgot my password",
      faltaMail: "email missing",
      faltaContrasena: "password missing",
      entrando: "signing in…",
      sinApi: "The system isn't connected to the API yet: you can't sign in for now.",
      sinCuenta: "Don't have an account?",
      crearUna: "Create one",
    },
  },
```

El resto de los textos de `PantallaEntrada.js` y `BotonGoogle.js` (pie, separador "o") van a `acceso.*` de la misma forma.

- [ ] **Paso 4: Verificar**

`npm run test:unit` en verde. En el preview, `/iniciar-sesion` en `es` se ve igual que antes, y en `en` no queda castellano. Con credenciales incorrectas, el error se ve traducido en los dos idiomas. Con la app corriendo, `npm run test:e2e` (incluye `idioma.e2e.js`) pasa.

- [ ] **Paso 5: Commit**

```bash
git add src/app/iniciar-sesion/page.js src/lib/auth.js src/componentes/PantallaEntrada.js src/componentes/BotonGoogle.js src/lib/idiomas src/app src/componentes
git commit -m "Idiomas: iniciar sesión en los dos idiomas, errores por código"
```

---

### Tarea 7: Presets en inglés

**Archivos:**
- Crear: `src/lib/presets-en.js`
- Modificar: `src/lib/presets.js` (`preset`, `etiquetaEstado`, `comoSeIdentifica`, `ejemplosDe`, `comoSeEspera`, `cadaCuantoVuelve`, `formas`, `vocabulario`, `categoriasDe`, `queSignificaPara`)
- Test: `pruebas/presets.test.js` (agregar al final)

**Interfaces:**
- Produce:
  - `PRESETS_EN: { [rubro]: { nombre, queEs, etiquetas, explica, seguimiento, ejemplos, palabras, identificador, espera, categorias } }`
  - `SEGUIMIENTO_GENERICO_EN`
  - `preset(rubro, idioma = "es")`
  - `etiquetaEstado(rubro, estado, idioma = "es")`
  - `vocabulario(rubro, idioma = "es")`
  - `queSignificaPara(rubro, estado, idioma = "es")`
  - `formasEn({ uno, varios, an })` → `{ palabra, un, el, cuantos, segun }`
  - El resto de los helpers reciben `idioma` como último parámetro.

- [ ] **Paso 1: Escribir los tests (al final de `pruebas/presets.test.js`)**

```js
import { PRESETS_EN, SEGUIMIENTO_GENERICO_EN } from "../src/lib/presets-en.js";
import { vocabulario, etiquetaEstado, formasEn } from "../src/lib/presets.js";

// Mismas claves en los dos idiomas: un texto de fábrica que falta en inglés
// se vería en castellano en medio de una pantalla en inglés.
const camposDeTexto = ["etiquetas", "explica", "seguimiento", "ejemplos", "palabras", "identificador", "espera"];

test("cada rubro tiene sus textos en inglés, con las mismas claves", () => {
  for (const r of RUBROS) {
    const en = PRESETS_EN[r.clave];
    assert.ok(en, `${r.clave} sin inglés`);
    assert.equal(typeof en.nombre, "string");
    for (const campo of camposDeTexto) {
      if (r[campo] == null) continue;
      assert.deepEqual(
        Object.keys(en[campo] ?? {}).sort(),
        Object.keys(r[campo]).sort(),
        `${r.clave}.${campo}`
      );
    }
    assert.equal((en.categorias ?? []).length, (r.categorias ?? []).length, `${r.clave}.categorias`);
  }
});

test("el seguimiento genérico tiene los cinco estados en inglés", () => {
  assert.deepEqual(Object.keys(SEGUIMIENTO_GENERICO_EN).sort(), Object.keys(SEGUIMIENTO_GENERICO).sort());
});

test("en inglés, a/an y the, sin género", () => {
  const parte = formasEn({ uno: "part", varios: "parts" });
  assert.equal(parte.un(), "a part");
  assert.equal(parte.el(1), "the part");
  assert.equal(parte.el(2), "the parts");
  assert.equal(parte.cuantos(1), "1 part");
  assert.equal(parte.cuantos(3), "3 parts");
  assert.equal(formasEn({ uno: "analysis", varios: "analyses", an: true }).un(), "an analysis");
});

test("sin idioma, todo sigue en castellano", () => {
  assert.equal(etiquetaEstado("taller", "en_proceso"), "Está en el taller");
  assert.equal(preset("taller").nombre, "Taller mecánico");
});

test("en inglés, el preset y el vocabulario salen en inglés", () => {
  assert.notEqual(etiquetaEstado("taller", "en_proceso", "en"), "Está en el taller");
  assert.notEqual(preset("taller", "en").nombre, "Taller mecánico");
  assert.ok(vocabulario("taller", "en").insumo.un().match(/^an? /));
});

test("los módulos no se traducen: son los mismos en los dos idiomas", () => {
  for (const r of RUBROS) assert.deepEqual(preset(r.clave, "en").modulos, preset(r.clave).modulos);
});

test("queSignificaPara en inglés, y personalizable usa el genérico en inglés", () => {
  assert.equal(queSignificaPara("personalizable", "nuevo", "en"), SEGUIMIENTO_GENERICO_EN.nuevo);
  assert.equal(queSignificaPara("taller", "nuevo", "en"), PRESETS_EN.taller.seguimiento.nuevo);
});
```

Si el campo de módulos de un preset no se llama `modulos`, usar el nombre que tiene en `PRESETS`. Si `vocabulario` o `etiquetaEstado` ya se importan arriba del archivo, sumar `formasEn` a ese import en vez de repetirlos (un nombre importado dos veces es un error de sintaxis).

- [ ] **Paso 2: Correr y ver que fallan**

Correr: `npm run test:unit -- pruebas/presets.test.js`
Esperado: FALLA con "Cannot find module '../src/lib/presets-en.js'".

- [ ] **Paso 3: Escribir `src/lib/presets-en.js`**

Leer `PRESETS` entero (`src/lib/presets.js` líneas 25-266). Por cada rubro (`taller`, `medicina`, `service`, `personalizable`), escribir un objeto con **sólo** los campos de texto que ese rubro tenga: `nombre`, `queEs`, `etiquetas`, `explica`, `seguimiento`, `ejemplos`, `palabras`, `identificador`, `espera`, `categorias`. Mismas claves, textos en inglés.

- `palabras`: `{ uno, varios }`, más `an: true` si la palabra empieza con sonido de vocal. Sin `genero`.
- `identificador`: las mismas claves que en castellano (`nombre`, `enFrase`, ...).
- `categorias`: misma cantidad y mismo orden.
- `seguimiento` le habla al cliente en segunda persona ("your vehicle"), como en castellano.

Arriba del archivo:

```js
// Los textos de fábrica de cada rubro en inglés (docs/idiomas.md). Sólo los
// textos: los módulos, los estados y todo lo demás vienen de PRESETS, en
// presets.js, y preset(rubro, "en") superpone esto encima.
//
// "palabras" no llevan género; "an: true" pide "an" en vez de "a".

export const PRESETS_EN = {
  taller: {
    nombre: "Auto repair shop",
    // ...
  },
  // medicina, service, personalizable
};

export const SEGUIMIENTO_GENERICO_EN = {
  nuevo: "It's been logged. We haven't started working on it yet.",
  en_proceso: "We're working on this right now.",
  esperando: "We've paused until we have what's needed to continue.",
  revision_final: "We're done and checking that everything is right before handing it over.",
  completado: "Finished and handed over.",
};
```

- [ ] **Paso 4: Modificar `src/lib/presets.js`**

```js
import { PRESETS_EN, SEGUIMIENTO_GENERICO_EN } from "./presets-en.js";

// En inglés se superponen los textos de presets-en.js. Lo que falte queda en
// castellano, como en t() (docs/idiomas.md).
export const preset = (rubro, idioma = "es") => {
  const base = PRESETS[rubro] ?? PRESETS.taller;
  return idioma === "en" ? { ...base, ...PRESETS_EN[base.clave] } : base;
};

export const etiquetaEstado = (rubro, estado, idioma = "es") =>
  preset(rubro, idioma).etiquetas[estado] ?? estado;

export const comoSeIdentifica = (rubro, idioma = "es") => preset(rubro, idioma).identificador;
export const ejemplosDe = (rubro, idioma = "es") => preset(rubro, idioma).ejemplos;
export const comoSeEspera = (rubro, idioma = "es") => preset(rubro, idioma).espera;
export const categoriasDe = (rubro, idioma = "es") => preset(rubro, idioma).categorias ?? [];

// En inglés no hay género: "a part", "the parts". segun() devuelve la
// primera forma; quien la llama en inglés ya pasa un texto de t().
export function formasEn({ uno, varios, an }) {
  return {
    palabra: (n = 1) => (n === 1 ? uno : varios),
    un: () => `${an ? "an" : "a"} ${uno}`,
    el: (n = 1) => `the ${n === 1 ? uno : varios}`,
    cuantos: (n) => `${n} ${n === 1 ? uno : varios}`,
    segun: (masculino) => masculino,
  };
}

export function vocabulario(rubro, idioma = "es") {
  const palabras = preset(rubro, idioma).palabras ?? {};
  const armar = idioma === "en" ? formasEn : formas;
  return Object.fromEntries(Object.entries(palabras).map(([clave, palabra]) => [clave, armar(palabra)]));
}

export function queSignificaPara(rubro, estado, idioma = "es") {
  const propios = idioma === "en" ? PRESETS_EN[rubro]?.seguimiento : PRESETS[rubro]?.seguimiento;
  const generico = idioma === "en" ? SEGUIMIENTO_GENERICO_EN : SEGUIMIENTO_GENERICO;
  return (propios ?? generico)[estado];
}
```

Conservar los comentarios que ya tienen esas funciones. `cadaCuantoVuelve` no cambia: es un número.

- [ ] **Paso 5: Correr y ver que pasan**

Correr: `npm run test:unit`
Esperado: PASA, incluidos los tests de presets que ya existían.

- [ ] **Paso 6: Commit**

```bash
git add src/lib/presets.js src/lib/presets-en.js pruebas/presets.test.js
git commit -m "Idiomas: presets de rubro en inglés"
```

---

### Tarea 8: Formatos de número y fecha con el locale

**Archivos:**
- Modificar: `src/lib/fechas.js`, `src/lib/estados.js`, `src/lib/inventario.js`, `src/lib/ecuaciones.js`, `src/lib/dashboard.js`, `src/lib/dashboard-clientes.js`, `src/lib/dashboard-inventario.js`, `src/lib/dashboard-periodos.js` y los que aparezcan en el Paso 1
- Test: `pruebas/fechas.test.js` (crear si no existe) o el test existente del módulo

- [ ] **Paso 1: Listar cada uso**

Correr: `grep -rn "es-AR\|toLocale[A-Za-z]*(\"es\")" src`

- [ ] **Paso 2: Escribir un test en inglés por cada función de `src/lib/` que formatee**

Ejemplo para una función de fechas que hoy da el día y el mes (usar el nombre real que exporta `src/lib/fechas.js` en su línea 14):

```js
test("el día y el mes, en el idioma de quien mira", () => {
  const d = new Date("2026-10-20T15:00:00-03:00");
  assert.equal(diaYMes(d), "20 de octubre");
  assert.equal(diaYMes(d, "en-US"), "October 20");
});
```

- [ ] **Paso 3: Correr y ver que falla**

Correr: `npm run test:unit -- pruebas/fechas.test.js`
Esperado: FALLA (sale "20 de octubre" en los dos casos).

- [ ] **Paso 4: Pasar `locale` como último parámetro, con `"es-AR"` por defecto**

```js
export const diaYMes = (d, locale = "es-AR") =>
  new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(d);
```

`timeZone: "America/Argentina/Buenos_Aires"` y `currency: "ARS"` no se tocan. En los componentes (`src/app/...`, `src/componentes/...`), `"es-AR"` → `locale` de `useIdioma()`, y se le pasa `locale` a la función de `src/lib/` que lo use.

- [ ] **Paso 5: Correr y ver que pasa**

Correr: `npm run test:unit`
Esperado: PASA.

- [ ] **Paso 6: Commit**

```bash
git add src pruebas
git commit -m "Idiomas: números y fechas en el formato de quien mira"
```

---

### Tarea 9: Migrar acceso y cuenta

**Archivos:** `src/app/crear-cuenta/page.js`, `src/app/confirma-tu-mail/page.js`, `src/app/recuperar-contrasena/page.js`, `src/app/nueva-contrasena/page.js`, `src/app/bienvenida/page.js`, `src/app/crear-negocio/page.js`, `src/app/negocios/page.js`, `src/app/unirme/[codigo]/page.js`, `src/app/perfil/page.js`, `src/app/perfil/Tema.js`, `src/app/perfil/Suscripcion.js`, `src/app/perfil/TusNegocios.js`, `src/app/planes/page.js`, `src/componentes/CampoTelefono.js`, `src/componentes/FilaNegocio.js`, `src/componentes/BorrarNegocio.js`, `src/componentes/Guardia.js`, `src/componentes/Aviso.js`, `src/componentes/ui.js`, `src/lib/validaciones.js`, `src/lib/telefono.js`, `src/lib/tema.js` (las `palabra` de cada opción)

- [ ] **Paso 1:** aplicar la **Receta de migración** a cada archivo de la lista. Las claves van a `acceso.*`, `cuenta.*` (perfil), `planes.*` y `ui.*` (textos de `ui.js`, como "Cargando").
- [ ] **Paso 2:** `npm run test:unit` en verde. Si un test viejo compara un texto que ahora sale de `t()`, el test pasa a pasar un `t` de castellano: `const t = (c, v, s) => traducir({ diccionario: es, base: null, locale: "es-AR" }, c, v, s)`.
- [ ] **Paso 3:** recorrer las pantallas de la lista en `es` y en `en` en el preview y sacar capturas de las dos. `npm run test:e2e` pasa.
- [ ] **Paso 4: Commit**

```bash
git add src pruebas
git commit -m "Idiomas: acceso y cuenta en los dos idiomas"
```

---

### Tarea 10: Migrar casos e historial

**Archivos:** `src/app/casos/page.js`, `src/app/casos/nuevo/page.js`, `src/app/casos/[id]/page.js`, `src/app/casos/[id]/pasos/page.js`, `src/app/historial/page.js`, `src/app/aprobar/page.js`, `src/componentes/FilaCaso.js`, `src/componentes/ChipEstado.js`, `src/componentes/SelectorEstado.js`, `src/componentes/ConfiguracionEstados.js`, `src/componentes/Cobros.js`, `src/componentes/LinkCompartido.js`, `src/componentes/SeguimientoWhatsApp.js`, `src/componentes/Buscador.js`, `src/lib/estados.js`, `src/lib/presentacion-estados.js`, `src/lib/historial.js`, `src/lib/cobros.js`, `src/lib/seguimiento-whatsapp.js`

- [ ] **Paso 1:** aplicar la **Receta de migración** a cada archivo de la lista. Las claves van a `casos.*`, `historial.*` y `aprobar.*`. Los presets se llaman con `idioma`. El "qué falta" que se **guarda** en un caso se escribe en el idioma de quien lo crea y después se muestra tal cual (docs/idiomas.md, "Presets de rubro").
- [ ] **Paso 2:** `npm run test:unit` en verde. Si un test viejo compara un texto que ahora sale de `t()`, el test pasa a pasar un `t` de castellano: `const t = (c, v, s) => traducir({ diccionario: es, base: null, locale: "es-AR" }, c, v, s)`.
- [ ] **Paso 3:** recorrer las pantallas de la lista en `es` y en `en` en el preview, con un caso de prueba creado en cada idioma, y sacar capturas. Un caso llamado "Cambio de aceite" se ve "Cambio de aceite" en inglés. `npm run test:e2e` pasa.
- [ ] **Paso 4: Commit**

```bash
git add src pruebas
git commit -m "Idiomas: casos e historial en los dos idiomas"
```

---

### Tarea 11: Migrar agenda, turnos y seguimiento público

**Archivos:** `src/app/agenda/page.js`, `src/app/agenda/calendario/page.js`, `src/app/turnos/[codigo]/page.js`, `src/app/seguimiento/[codigo]/page.js`, `src/componentes/AltaDeTurno.js`, `src/componentes/AvisoDelTurno.js`, `src/componentes/CalendarioDeTurnos.js`, `src/componentes/SemanaDeTurnos.js`, `src/componentes/MoverTurno.js`, `src/componentes/FranjaDeVisita.js`, `src/componentes/CuandoVuelve.js`, `src/componentes/VincularGoogleCalendar.js`, `src/lib/turnos.js`, `src/lib/horarios.js`, `src/lib/calendario.js`, `src/lib/seguimiento.js`, `src/lib/fechas.js`, `src/lib/useRecordatorioVolver.js`

- [ ] **Paso 1:** aplicar la **Receta de migración** a cada archivo de la lista. Las claves van a `agenda.*`, `turnos.*` y `seguimiento.*`. En `seguimiento/[codigo]`, `queSignificaPara(rubro, estado, idioma)`. Los nombres de los días y meses salen de `Intl` con `locale`, no del diccionario.
- [ ] **Paso 2:** `npm run test:unit` en verde. Si un test viejo compara un texto que ahora sale de `t()`, el test pasa a pasar un `t` de castellano: `const t = (c, v, s) => traducir({ diccionario: es, base: null, locale: "es-AR" }, c, v, s)`.
- [ ] **Paso 3:** recorrer las pantallas de la lista en `es` y en `en` en el preview y sacar capturas. Abrir un link de seguimiento sin sesión con la cookie en `en`: se ve en inglés aunque el negocio use la app en castellano. `npm run test:e2e` pasa.
- [ ] **Paso 4: Commit**

```bash
git add src pruebas
git commit -m "Idiomas: agenda, turnos y seguimiento en los dos idiomas"
```

---

### Tarea 12: Migrar clientes, inventario y sedes

**Archivos:** `src/app/clientes/page.js`, `src/app/clientes/[id]/page.js`, `src/app/inventario/page.js`, `src/app/inventario/en-camino/page.js`, `src/app/inventario/sedes/page.js`, `src/componentes/Producto.js`, `src/componentes/SedesVinculadas.js`, `src/lib/inventario.js`, `src/lib/cambios-stock.js`, `src/lib/sedes.js`, `src/lib/nombres.js`, `src/lib/listas.js`

- [ ] **Paso 1:** aplicar la **Receta de migración** a cada archivo de la lista. Las claves van a `clientes.*` e `inventario.*`. Las categorías de fábrica salen de `categoriasDe(rubro, idioma)`; las que el negocio agregó y los productos se ven como se escribieron.
- [ ] **Paso 2:** `npm run test:unit` en verde. Si un test viejo compara un texto que ahora sale de `t()`, el test pasa a pasar un `t` de castellano: `const t = (c, v, s) => traducir({ diccionario: es, base: null, locale: "es-AR" }, c, v, s)`.
- [ ] **Paso 3:** recorrer las pantallas de la lista en `es` y en `en` en el preview y sacar capturas. Un producto "Pastillas de freno" se ve "Pastillas de freno" en inglés. `npm run test:e2e` pasa.
- [ ] **Paso 4: Commit**

```bash
git add src pruebas
git commit -m "Idiomas: clientes e inventario en los dos idiomas"
```

---

### Tarea 13: Migrar negocio, equipo, roles y landing

**Archivos:** `src/app/negocio/page.js`, `src/app/negocio/horarios/page.js`, `src/app/negocio/landing/page.js`, `src/app/negocio/modulos/page.js`, `src/app/negocio/recordatorios/page.js`, `src/app/negocio/recordatorios/[tipo]/page.js`, `src/app/negocio/roles/page.js`, `src/app/negocio/roles/[id]/page.js`, `src/app/equipo/page.js`, `src/app/equipo/invitaciones/page.js`, `src/app/n/[codigo]/page.js`, `src/componentes/SumarAlEquipo.js`, `src/componentes/ConexionMercadoPago.js`, `src/componentes/ResumenRecordatorios.js`, `src/componentes/landing/Lienzo.js`, `src/componentes/landing/VistaPrevia.js`, `src/componentes/landing/secciones/*.js`, `src/lib/modulos.js`, `src/lib/permisos.js`, `src/lib/recordatorios.js`, `src/lib/equipo.js`, `src/lib/landing.js`, `src/lib/suscripcion.js`, `src/lib/pagos.js`

- [ ] **Paso 1:** aplicar la **Receta de migración** a cada archivo de la lista. Las claves van a `negocio.*`, `equipo.*` y `landing.*`. `src/app/equipo/invitaciones/page.js` es componente de servidor: ahí se usa `traducir` con el idioma de `elegirIdioma(...)`, leído igual que en el layout. Las plantillas de recordatorio y los textos de la landing que escribió el negocio no se tocan. Sí se traducen las etiquetas fijas de las secciones de la landing ("Sacar turno", "Mis casos").
- [ ] **Paso 2:** `npm run test:unit` en verde. Si un test viejo compara un texto que ahora sale de `t()`, el test pasa a pasar un `t` de castellano: `const t = (c, v, s) => traducir({ diccionario: es, base: null, locale: "es-AR" }, c, v, s)`.
- [ ] **Paso 3:** recorrer las pantallas de la lista en `es` y en `en` en el preview y sacar capturas. `npm run test:e2e` pasa (incluye `roles.e2e.js`).
- [ ] **Paso 4: Commit**

```bash
git add src pruebas
git commit -m "Idiomas: negocio, equipo y landing en los dos idiomas"
```

---

### Tarea 14: Migrar inicio, navegación y dashboard

**Archivos:** `src/app/page.js`, `src/app/dashboard/page.js`, `src/app/ecuaciones/page.js`, `src/app/prueba/page.js`, `src/componentes/Navegacion.js`, `src/componentes/Pestanas.js`, `src/componentes/inicio/Modulo.js`, `src/componentes/inicio/cuerpos.js`, `src/componentes/dashboard/*.js`, `src/lib/inicio.js`, `src/lib/dashboard*.js`, `src/lib/ecuaciones.js`, `src/lib/entrada.js`, `src/lib/useTitulo.js` (`"Mi negocio"`)

- [ ] **Paso 1:** aplicar la **Receta de migración** a cada archivo de la lista. Las claves van a `inicio.*`, `navegacion.*` y `dashboard.*`. Los ejes y las leyendas de recharts usan `t()`, y sus números usan `locale`.
- [ ] **Paso 2:** `npm run test:unit` en verde. Si un test viejo compara un texto que ahora sale de `t()`, el test pasa a pasar un `t` de castellano: `const t = (c, v, s) => traducir({ diccionario: es, base: null, locale: "es-AR" }, c, v, s)`.
- [ ] **Paso 3:** recorrer las pantallas de la lista en `es` y en `en` en el preview y sacar capturas.
- [ ] **Paso 4: Barrido final.** Correr `grep -rnE ">[^<{]*[áéíóúñ¿¡][^<]*<|\"[A-ZÁÉÍÓÚ¿¡][a-záéíóúñ ]{3,}[^\"]*\"" src/app src/componentes`. Lo que aparezca y no sea un comentario, una clave de dato o un texto del negocio se migra con la receta.
- [ ] **Paso 5:** `npm test` completo en verde.
- [ ] **Paso 6: Commit**

```bash
git add src pruebas
git commit -m "Idiomas: inicio, navegación y dashboard en los dos idiomas"
```
