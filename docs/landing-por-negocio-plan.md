# Landing por negocio, pasos 1 y 2 — plan de implementación

> **Para quien lo ejecute:** usar superpowers:subagent-driven-development
> (recomendado) o superpowers:executing-plans, tarea por tarea. Los pasos usan
> casillas (`- [ ]`) para ir marcando.

**Objetivo:** que el dueño arme la landing de su negocio desde "Mi negocio":
elegir el orden de las secciones, los colores y la fuente, verlo en una vista
previa mientras edita, volver a la de fábrica y guardar (SCRUM-196 a 199).

**Arquitectura:** la personalización vive en `negocio.landing` (jsonb, null =
la de fábrica). La API la valida con zod al guardar (`PUT /v1/negocio/landing`,
sólo el dueño) y el front la normaliza al leer (`src/lib/landing.js`). La
vista previa usa `Lienzo`, un contenedor que pisa las variables de color y de
fuente de `globals.css`, así los componentes de siempre se pintan con lo que
eligió el negocio.

**Tecnología:** front en Next.js 16.3 (App Router) + React 19 + Tailwind 4,
Jest (`npm run test:unit`) y WebdriverIO (e2e con cuentas sembradas). API en
Express 5 + TypeScript + zod 4, pruebas con `node:test` y un Supabase falso.

**Diseño:** [`docs/landing-por-negocio.md`](landing-por-negocio.md). Se leen
los dos. Este plan cubre **sólo los pasos 1 y 2**; los pasos 3 a 5 (el link, la
página pública, el ingreso del cliente y los turnos) llevan su propio plan.

## Reglas para todas las tareas

- Textos y comentarios en castellano rioplatense, con el estilo del repo
  (comentarios que explican el porqué).
- Cartilla: un solo botón azul por pantalla; áreas táctiles de 48 px
  (`min-h-12`); un botón apagado dice por qué (`motivo`); los errores con
  ícono `alerta` + texto en `text-rojo`.
- TDD de la cátedra: primero el commit `Test en rojo: …` con la prueba
  fallando, después el arreglo en otro commit.
- `git add` por nombre de archivo, nunca `git add .` ni `-A`. Cada mensaje de
  commit termina con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No tocar `.env.local` ni el `.env` de la API: las variables las carga la
  persona. Si falta una, se le pide.
- No matar procesos por nombre (`node`, `chrome`): puede ser el servidor o el
  Chrome de la persona. Si hay que cortar algo, por PID y sólo lo que se
  levantó en esta tarea.
- Las claves de las secciones (`negocio`, `sacar_turno`, `mis_casos`,
  `mis_turnos`) y de las fuentes (`fabrica`, `nunito`, `montserrat`, `lora`,
  `merriweather`) están en los dos repos: en el front en `src/lib/landing.js` y
  en la API en `src/modulos/negocio/esquemas.ts`. Tienen que coincidir.

Repos:

- **Front:** `C:\Users\bauti\OneDrive\Desktop\TP-Ing.-Software-2026c2`, rama
  `landing-por-negocio` (sale de `origin/development`).
- **API:** `C:\Users\bauti\OneDrive\Desktop\TP-IngeSoft-API`, rama
  `landing-editor`, que se crea en la Tarea 2 desde `origin/master`.

## Lo que el plan agrega al diseño

Lo encontrado al leer el código, ya volcado en el diseño:

1. **El modo de ejemplo no existe más** (commit `1193b6c`, 12/10). El front sólo
   habla con la API, y las e2e entran con cuentas sembradas
   (`pruebas/e2e/siembra.js`).
2. **El link de la landing pasa a los pasos 3 y 4.** Un botón de "publicar" sin
   la página pública haría repartir un link que no anda. La 052 trae sólo
   `negocio.landing`.
3. **La fuente de fábrica es el par de la app** (Figtree en los títulos y Source
   Sans 3 en el texto, que ya carga `layout.js`). Su clave es `fabrica`.
4. **Lienzo se marca con `data-lienzo`**: la clase `landing` es de
   `/bienvenida`. Sus reglas van en `@layer base` de `globals.css`.
5. **Guardar no es optimista.** `guardarLanding` espera a la API y devuelve
   `{ ok }` o `{ ok: false, error }`, como `compartirAgenda`: el editor tiene un
   botón Guardar y tiene que poder decir si salió.

## Archivos

| Archivo | Repo | Tarea | Qué |
|---|---|---|---|
| `supabase/052_landing.sql` | front | 1 | Crear: la columna `negocio.landing`. |
| `src/lib/database.types.ts` | API | 2 | Sumar `landing` a la tabla `negocio`. |
| `src/modulos/negocio/esquemas.ts` | API | 2 | Esquema `landing`. |
| `src/modulos/negocio/casos-de-uso.ts` | API | 2 | `cambiarLanding`. |
| `src/modulos/negocio/rutas.ts` | API | 2 | `PUT /negocio/landing`. |
| `pruebas/casos-de-uso/negocio-y-cuenta.test.ts` | API | 2 | Pruebas de casos de uso. |
| `pruebas/contrato/recursos-restantes.test.ts` | API | 2 | Prueba de contrato. |
| `MIGRACION.md` | API | 2 | La 052 antes de desplegar, y la ruta nueva. |
| `src/lib/landing.js` | front | 3 | Crear: la lógica pura. |
| `pruebas/landing.test.js` | front | 3 | Crear: sus pruebas. |
| `src/componentes/landing/fuentes.js` | front | 4 | Crear: las fuentes con `next/font`. |
| `src/componentes/landing/Lienzo.js` | front | 4 | Crear: el contenedor que pinta. |
| `src/componentes/landing/VistaPrevia.js` | front | 4 | Crear: la landing en chico. |
| `src/app/globals.css` | front | 4 | Las reglas de `[data-lienzo]`. |
| `pruebas/e2e/historias/landing-editor.e2e.js` | front | 5 | Crear: la e2e del editor. |
| `src/lib/datos.js` | front | 5 | La acción `guardarLanding`. |
| `src/app/negocio/landing/page.js` | front | 5 | Crear: el editor. |
| `src/app/negocio/page.js` | front | 5 | El enlace "Armar tu landing". |

---

### Tarea 1: la base — `052_landing.sql`

**Archivos:**
- Crear: `supabase/052_landing.sql` (front)

**Interfaces:**
- Produce: la columna `negocio.landing jsonb` (null = de fábrica). `GET /v1/datos`
  ya trae `select("*")` del negocio (API, `src/modulos/datos/repositorio.ts:24`),
  así que llega sola a `useDatos().negocio.landing`.

- [ ] **Paso 1: escribir la migración**

```sql
-- ============================================================
-- 052_landing.sql — la personalización de la landing de cada negocio
--
-- Correr entero en el SQL Editor de Supabase, después de la 051. Es
-- idempotente. Diseño: docs/landing-por-negocio.md (pasos 1 y 2).
--
-- QUÉ AGREGA:
--   negocio.landing   el orden de las secciones, los colores y la fuente que
--                     eligió el dueño. null = la de fábrica.
--
-- El link público, la página y el ingreso de los clientes vienen en la 053.
--
-- Se valida en la API (PUT /v1/negocio/landing) y no acá, como el Inicio
-- (006): un valor viejo o mal formado no tiene que romper nada, tiene que
-- caer en la de fábrica. Eso lo hace normalizarLanding() en
-- src/lib/landing.js. Acá sólo se asegura que sea un objeto, como los
-- estados (046).
-- ============================================================

alter table negocio
  add column if not exists landing jsonb;

-- Aparte de la columna: "add column if not exists" no vuelve a poner la
-- regla si la columna ya estaba (033).
alter table negocio drop constraint if exists negocio_landing_es_objeto;
alter table negocio add constraint negocio_landing_es_objeto
  check (landing is null or jsonb_typeof(landing) = 'object');

comment on column negocio.landing is
  'La landing del negocio: {orden, colores: {fondo, cajas, botones, acento: {color, texto}}, fuente}. '
  'null = nunca se tocó, vale la de fábrica.';
```

- [ ] **Paso 2: commitear**

```bash
git add supabase/052_landing.sql
git commit -m "052: la personalización de la landing de cada negocio" -m "negocio.landing (jsonb, null = la de fábrica). La forma la valida la API al guardar y el front la tolera al leer, como el Inicio (006)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Paso 3: pedirle a la persona que la corra en Supabase**

Decirle: abrir el SQL Editor del proyecto `akprfdmyphmuzgwfzton`, pegar
`supabase/052_landing.sql` entero y correrlo. Después, esta consulta tiene que
devolver una fila con `landing | jsonb`:

```sql
select column_name, data_type from information_schema.columns
 where table_name = 'negocio' and column_name = 'landing';
```

Sin la 052 corrida, guardar desde el editor da 500 (la columna no existe). Las
pruebas de la API no la necesitan: usan el Supabase falso.

---

### Tarea 2: la API — `PUT /v1/negocio/landing`

**Archivos (todos en el repo de la API):**
- Modificar: `pruebas/casos-de-uso/negocio-y-cuenta.test.ts`
- Modificar: `pruebas/contrato/recursos-restantes.test.ts`
- Modificar: `src/lib/database.types.ts` (tabla `negocio`, ~líneas 661-718)
- Modificar: `src/modulos/negocio/esquemas.ts`
- Modificar: `src/modulos/negocio/casos-de-uso.ts`
- Modificar: `src/modulos/negocio/rutas.ts`
- Modificar: `MIGRACION.md` (líneas 62 y 607)

**Interfaces:**
- Consume: la columna `negocio.landing` (Tarea 1).
- Produce: `PUT /v1/negocio/landing` con `{ valor: Landing | null }`. Responde
  `200 { ok: true, datos: { negocio } }` con la fila entera; `403 sin_permiso`
  si no es el dueño; `422 datos_invalidos` con `campo` (por ejemplo
  `valor.fuente`) si la forma no va. `Landing` es:
  `{ orden: string[4], colores: { fondo, cajas, botones, acento: { color, texto } }, fuente }`.

- [ ] **Paso 1: crear la rama**

```bash
cd C:/Users/bauti/OneDrive/Desktop/TP-IngeSoft-API
git fetch origin
git switch -c landing-editor origin/master
```

- [ ] **Paso 2: escribir las pruebas de casos de uso**

En `pruebas/casos-de-uso/negocio-y-cuenta.test.ts`, después de la constante
`ESTADOS` (que está antes de `describe("negocio", ...)`), agregar:

```ts
// La landing de fábrica (docs/landing-por-negocio.md del front).
const LANDING = {
    orden: ["negocio", "sacar_turno", "mis_casos", "mis_turnos"],
    colores: {
        fondo: { color: "#fbf8f4", texto: "#241f1b" },
        cajas: { color: "#ffffff", texto: "#241f1b" },
        botones: { color: "#1f4e8c", texto: "#ffffff" },
        acento: { color: "#9a3d1e", texto: "#ffffff" },
    },
    fuente: "fabrica",
};
```

Y adentro de `describe("negocio", ...)`, al final (antes del `});` que lo
cierra), agregar:

```ts
    test("la landing la guarda el dueño, entera, y null vuelve a la de fábrica", async () => {
        const { repo, llamadas } = negocioFalso();
        await Negocio.cambiarLanding({ repo, quien: quien("duenio") }, { valor: LANDING });
        assert.equal(llamadas[0], `actualizar negocio-a ${JSON.stringify({ landing: LANDING })}`);
        await Negocio.cambiarLanding({ repo, quien: quien("duenio") }, { valor: null });
        assert.equal(llamadas[1], `actualizar negocio-a ${JSON.stringify({ landing: null })}`);
        for (const rol of ["encargado", "tecnico"]) {
            await fallaCon(Negocio.cambiarLanding({ repo, quien: quien(rol) }, { valor: LANDING }), "sin_permiso", 403);
        }
    });

    test("la landing lleva cada sección una vez, colores #rrggbb y una fuente de la lista", async () => {
        const { repo } = negocioFalso();
        const con = (cambio: Record<string, unknown>) =>
            Negocio.cambiarLanding({ repo, quien: quien("duenio") }, { valor: { ...LANDING, ...cambio } });
        await noPasaElEsquema(con({ orden: ["negocio", "negocio", "mis_casos", "mis_turnos"] }));
        await noPasaElEsquema(con({ orden: ["negocio", "sacar_turno", "mis_casos"] }));
        await noPasaElEsquema(con({ orden: ["negocio", "sacar_turno", "mis_casos", "mis_turnos", "inventada"] }));
        await noPasaElEsquema(con({ colores: { ...LANDING.colores, fondo: { color: "rojo", texto: "#241f1b" } } }));
        await noPasaElEsquema(con({ colores: { ...LANDING.colores, cajas: { color: "#fff", texto: "#241f1b" } } }));
        await noPasaElEsquema(con({ fuente: "comic-sans" }));
        await noPasaElEsquema(con({ sobra: 1 }));
        await noPasaElEsquema(Negocio.cambiarLanding({ repo, quien: quien("duenio") }, {}));
    });
```

- [ ] **Paso 3: escribir la prueba de contrato**

En `pruebas/contrato/recursos-restantes.test.ts`, después de la línea que
define `como` (la constante que arma el encabezado `Authorization`), agregar:

```ts
const LANDING = {
    orden: ["negocio", "sacar_turno", "mis_casos", "mis_turnos"],
    colores: {
        fondo: { color: "#fbf8f4", texto: "#241f1b" },
        cajas: { color: "#ffffff", texto: "#241f1b" },
        botones: { color: "#1f4e8c", texto: "#ffffff" },
        acento: { color: "#9a3d1e", texto: "#ffffff" },
    },
    fuente: "fabrica",
};
```

Y adentro de `describe("negocio", ...)`, al final, agregar:

```ts
    test("guarda la landing del dueño y rechaza la que no tiene forma", async () => {
        const res = await request(app).put("/v1/negocio/landing").set(como("duenia")).send({ valor: LANDING });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.deepEqual(res.body.datos.negocio.landing, LANDING);
        const deFabrica = await request(app).put("/v1/negocio/landing").set(como("duenia")).send({ valor: null });
        assert.equal(deFabrica.body.datos.negocio.landing, null);
        assert.equal((await request(app).put("/v1/negocio/landing").set(como("tecnico")).send({ valor: LANDING })).status, 403);
        const mal = await request(app).put("/v1/negocio/landing").set(como("duenia"))
            .send({ valor: { ...LANDING, fuente: "comic-sans" } });
        assert.equal(mal.status, 422, JSON.stringify(mal.body));
        assert.equal(mal.body.error.campo, "valor.fuente");
    });
```

- [ ] **Paso 4: correr las pruebas y ver que fallan**

```bash
node --import tsx --test pruebas/casos-de-uso/negocio-y-cuenta.test.ts pruebas/contrato/recursos-restantes.test.ts
```

Esperado: las dos de casos de uso fallan con
`TypeError: Negocio.cambiarLanding is not a function`, y la de contrato con
`404` (`no_encontrado`, "Eso ya no está."). El resto pasa.

- [ ] **Paso 5: commitear el rojo**

```bash
git add pruebas/casos-de-uso/negocio-y-cuenta.test.ts pruebas/contrato/recursos-restantes.test.ts
git commit -m "Test en rojo: el dueño no puede guardar la landing de su negocio" -m "PUT /v1/negocio/landing con la personalización entera (o null para la de fábrica), sólo el dueño, y la forma validada: cada sección una vez, colores #rrggbb y una fuente de la lista (docs/landing-por-negocio.md del front)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Paso 6: sumar la columna a los tipos**

En `src/lib/database.types.ts`, tabla `negocio`:

En `Row`, reemplazar

```ts
          inicio: Json | null
          modulos_activos: Json
```

por

```ts
          inicio: Json | null
          landing: Json | null
          modulos_activos: Json
```

En `Insert` y en `Update` (el mismo texto aparece dos veces: usar reemplazar
todas), reemplazar

```ts
          inicio?: Json | null
          modulos_activos?: Json
```

por

```ts
          inicio?: Json | null
          landing?: Json | null
          modulos_activos?: Json
```

Antes de reemplazar, comprobar que esos dos textos aparecen sólo en la tabla
`negocio` (`grep -n "modulos_activos" src/lib/database.types.ts` tiene que
mostrar 3 líneas, las tres de `negocio`).

- [ ] **Paso 7: el esquema**

En `src/modulos/negocio/esquemas.ts`, al final del archivo, agregar:

```ts
// La landing del negocio (docs/landing-por-negocio.md del front). Las claves
// son las de SECCIONES y FUENTES de src/lib/landing.js del front: si se suma
// una sección o una fuente, se suma en los dos lados.
const SECCIONES = ["negocio", "sacar_turno", "mis_casos", "mis_turnos"] as const;
const FUENTES = ["fabrica", "nunito", "montserrat", "lora", "merriweather"] as const;
const color = z.string({ error: "Cada color va como #rrggbb." })
    .regex(/^#[0-9a-fA-F]{6}$/, { error: "Cada color va como #rrggbb." });
const parte = z.strictObject({ color, texto: color }, { error: "Cada parte lleva su color y el de su texto." });

export const landing = z.object({
    valor: z.strictObject({
        orden: z.array(z.enum(SECCIONES, { error: "Esa sección no existe." }), { error: "El orden va en una lista." })
            .refine((o) => o.length === SECCIONES.length && new Set(o).size === SECCIONES.length,
                { error: "El orden lleva cada sección una sola vez." }),
        colores: z.strictObject({ fondo: parte, cajas: parte, botones: parte, acento: parte },
            { error: "Son cuatro partes: fondo, cajas, botones y acento." }),
        fuente: z.enum(FUENTES, { error: "Esa fuente no está en la lista." }),
    }, { error: "La landing lleva el orden, los colores y la fuente, y nada más." }).nullable(),
}, { error: "Falta cómo queda la landing." });
```

Ojo con `pruebas/casos-de-uso/mensajes.test.ts`: recorre solo todos los
esquemas exportados y falla si un mensaje contiene palabras en inglés como
`invalid`, `string`, `object`, `array`, `pattern` o `must`. "inválido" sin
tilde contiene `invalid`: no usarlo.

- [ ] **Paso 8: el caso de uso**

En `src/modulos/negocio/casos-de-uso.ts`, después de `cambiarInicio`, agregar:

```ts
// La landing (docs/landing-por-negocio.md del front): entera, o null para
// volver a la de fábrica. Como el Inicio, sin versión: la nueva reemplaza a
// la anterior.
export async function cambiarLanding({ repo, quien }: Contexto, entrada: unknown) {
    exigirDuenio(quien);
    const { valor } = Esquemas.landing.parse(entrada ?? {});
    return { negocio: (await repo.actualizar(quien.negocioId, { landing: valor as Json })) as Negocio | null };
}
```

- [ ] **Paso 9: la ruta**

En `src/modulos/negocio/rutas.ts`, después del bloque de
`rutasNegocio.put("/negocio/inicio", ...)`, agregar:

```ts
rutasNegocio.put("/negocio/landing", async (req, res) => {
    res.json(ok(await CasosDeUso.cambiarLanding(await contexto(req), req.body)));
});
```

- [ ] **Paso 10: correr las pruebas y ver que pasan**

```bash
node --import tsx --test pruebas/casos-de-uso/negocio-y-cuenta.test.ts pruebas/contrato/recursos-restantes.test.ts pruebas/casos-de-uso/mensajes.test.ts
npm run tipos
```

Esperado: todo en verde, y `npm run tipos` sin errores. Si
`mensajes.test.ts` falla, el mensaje que dice está en inglés: buscar qué parte
del esquema `landing` no tiene su `{ error }`.

- [ ] **Paso 11: MIGRACION.md**

En `MIGRACION.md`, línea 62, al final del párrafo (después de
`` (filtran por `tipo`). ``), agregar:

```markdown
 La `052_landing.sql` va **antes** de desplegar la API de la landing: sin ella, `PUT /v1/negocio/landing` da 500 (la columna `landing` no existe).
```

Y en la línea 607, reemplazar

```markdown
`PUT /v1/negocio/modulos` e `/inicio`, compartir
```

por

```markdown
`PUT /v1/negocio/modulos`, `/inicio` y `/landing` (`docs/landing-por-negocio.md` del front), compartir
```

- [ ] **Paso 12: correr la suite entera**

```bash
npm test
```

Esperado: compila (`tsc`) y pasan todas las pruebas, con la de aislamiento
salteada si faltan sus variables.

Ojo: sin `.env` en la API, `aviso-de-turno.test.ts`, `recordatorio-turno.test.ts`
y `turnos.test.ts` fallan al cargar ("faltan variables de entorno
obligatorias"). Ya fallan así en `origin/master` y no son de esta tarea: no
importan `pruebas/apoyo/entorno.js`. Para ver la suite entera en verde sin
tocar el `.env`, correrla con las variables de mentira de
`pruebas/apoyo/entorno.ts` puestas sólo en el proceso (Git Bash):

```bash
SUPABASE_URL=https://supabase-falso.test SUPABASE_ANON_KEY=anon-falsa SUPABASE_SERVICE_ROLE_KEY=secreta-falsa ORIGENES_PERMITIDOS=http://localhost:3000 MERCADOPAGO_CLIENT_ID=x MERCADOPAGO_CLIENT_SECRET=x MERCADOPAGO_ACCESS_TOKEN=x MERCADOPAGO_REDIRECT_URI=http://localhost/callback MERCADOPAGO_BACK_URL=http://localhost/back MERCADOPAGO_WEBHOOK_SECRET=x API_PUBLIC_URL=https://api-falsa.test npm test
```

Verificado al armar el plan: así da 576 en verde, 0 fallas y 2 salteadas (las
de aislamiento).

- [ ] **Paso 13: commitear el verde**

```bash
git add src/lib/database.types.ts src/modulos/negocio/esquemas.ts src/modulos/negocio/casos-de-uso.ts src/modulos/negocio/rutas.ts MIGRACION.md
git commit -m "El dueño guarda la landing de su negocio (PUT /v1/negocio/landing)" -m "Entera o null para volver a la de fábrica. El esquema exige cada sección una vez, colores #rrggbb y una fuente de la lista; las claves son las mismas que src/lib/landing.js del front. Necesita la 052 corrida antes de desplegar (MIGRACION.md)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 3: la lógica — `src/lib/landing.js`

**Archivos (front):**
- Crear: `pruebas/landing.test.js`
- Crear: `src/lib/landing.js`

**Interfaces:**
- Consume: `LISTA_MODULOS` y `estaPrendido(clave, activos)` de
  `src/lib/modulos.js` (Agenda no viene de fábrica: `estaPrendido("agenda", [])`
  es `false`).
- Produce (lo usan las Tareas 4 y 5):
  - `SECCIONES: { clave, nombre, queMuestra, modulo }[]`
  - `PARTES: { clave, nombre, ayuda }[]` (fondo, cajas, botones, acento)
  - `FUENTES: { clave, nombre }[]`
  - `TINTA = "#241f1b"`, `BLANCO = "#ffffff"`, `CONTRASTE_MINIMO = 4.5`
  - `PRESET`
  - `normalizarLanding(guardada) → Landing`
  - `esDeFabrica(landing) → boolean`
  - `moverSeccion(orden, clave, paso) → string[]`
  - `estadoDeSecciones(orden, modulosActivos) → { ...seccion, visible, motivo }[]`
  - `contraste(a, b) → number`, `seLee(color, texto) → boolean`,
    `textoRecomendado(color) → TINTA | BLANCO`
  - `cambiarColor(landing, parte, color) → Landing`,
    `cambiarTexto(landing, parte, texto) → Landing`
  - `variablesDeColor(landing) → { "--color-…": string }`,
    `variablesDeFuente(landing) → { "--font-titulo"?, "--font-cuerpo"? }`

Jest corre ESM puro (`transform: {}`) y no resuelve `@/`: este archivo importa
con rutas relativas y extensión, y no puede tener JSX.

- [ ] **Paso 1: escribir las pruebas**

`pruebas/landing.test.js`:

```js
// Correr con: npm run test:unit -- pruebas/landing.test.js
//
// La landing de cada negocio (docs/landing-por-negocio.md): lo que se guarda,
// cómo se completa al leerlo, el orden de las secciones, los colores que se
// leen y lo que se le pasa a Lienzo.

import { test } from "@jest/globals";
import assert from "node:assert/strict";
import {
  BLANCO,
  PARTES,
  PRESET,
  TINTA,
  cambiarColor,
  cambiarTexto,
  contraste,
  esDeFabrica,
  estadoDeSecciones,
  moverSeccion,
  normalizarLanding,
  seLee,
  textoRecomendado,
  variablesDeColor,
  variablesDeFuente,
} from "../src/lib/landing.js";

test("una landing que nunca se tocó es la de fábrica", () => {
  assert.deepEqual(normalizarLanding(null), PRESET);
  assert.deepEqual(normalizarLanding(undefined), PRESET);
  assert.deepEqual(normalizarLanding("cualquier cosa"), PRESET);
  assert.equal(esDeFabrica(null), true);
});

test("normalizar no cambia la de fábrica guardada a mano", () => {
  const copia = JSON.parse(JSON.stringify(PRESET));
  assert.deepEqual(normalizarLanding(copia), PRESET);
  assert.equal(esDeFabrica(copia), true);
});

test("un orden viejo suma al final las secciones que faltan y saca las que no existen", () => {
  const { orden } = normalizarLanding({ orden: ["mis_casos", "inventada", "mis_casos"] });
  assert.deepEqual(orden, ["mis_casos", "negocio", "sacar_turno", "mis_turnos"]);
});

test("un color mal escrito o una fuente que no existe caen en la de fábrica", () => {
  const l = normalizarLanding({
    colores: { fondo: { color: "rojo", texto: "#FFD400" } },
    fuente: "comic-sans",
  });
  assert.equal(l.colores.fondo.color, PRESET.colores.fondo.color);
  assert.equal(l.colores.fondo.texto, "#ffd400");
  assert.deepEqual(l.colores.botones, PRESET.colores.botones);
  assert.equal(l.fuente, "fabrica");
  assert.equal(esDeFabrica(l), false);
});

test("subir y bajar una sección; en las puntas no se mueve", () => {
  const orden = ["a", "b", "c"];
  assert.deepEqual(moverSeccion(orden, "b", -1), ["b", "a", "c"]);
  assert.deepEqual(moverSeccion(orden, "b", 1), ["a", "c", "b"]);
  assert.deepEqual(moverSeccion(orden, "a", -1), ["a", "b", "c"]);
  assert.deepEqual(moverSeccion(orden, "c", 1), ["a", "b", "c"]);
  assert.deepEqual(orden, ["a", "b", "c"]);
});

test("sin Agenda, las secciones de turnos no aparecen y dicen por qué", () => {
  const sinAgenda = estadoDeSecciones(PRESET.orden, []);
  const turno = sinAgenda.find((s) => s.clave === "sacar_turno");
  assert.equal(turno.visible, false);
  assert.equal(turno.motivo, "Aparece cuando prendés el módulo Agenda.");
  assert.equal(sinAgenda.find((s) => s.clave === "mis_turnos").visible, false);
  assert.equal(sinAgenda.find((s) => s.clave === "mis_casos").visible, true);
  assert.equal(sinAgenda.find((s) => s.clave === "mis_casos").motivo, null);
  assert.ok(estadoDeSecciones(PRESET.orden, ["agenda"]).every((s) => s.visible));
});

test("las secciones salen en el orden elegido", () => {
  const orden = ["mis_turnos", "mis_casos", "sacar_turno", "negocio"];
  assert.deepEqual(estadoDeSecciones(orden, ["agenda"]).map((s) => s.clave), orden);
});

test("el contraste es el de WCAG: de 1 a 21", () => {
  assert.equal(contraste("#000000", "#ffffff").toFixed(1), "21.0");
  assert.equal(contraste("#ffffff", "#000000").toFixed(1), "21.0");
  assert.equal(contraste("#1f4e8c", "#1f4e8c").toFixed(1), "1.0");
  // Valores del medio: las puntas dan 21 y 1 con cualquier luminancia, aunque
  // le falte la corrección de gamma.
  assert.equal(contraste("#767676", "#ffffff").toFixed(2), "4.54");
  assert.equal(contraste("#1f4e8c", "#ffffff").toFixed(2), "8.31");
});

test("el texto recomendado es el que más se lee", () => {
  assert.equal(textoRecomendado("#ffffff"), TINTA);
  assert.equal(textoRecomendado("#1f4e8c"), BLANCO);
  assert.equal(textoRecomendado("#ffd400"), TINTA);
  assert.equal(textoRecomendado("#112233"), BLANCO);
  // Cerca del cruce: contra negro puro ganaría el oscuro; contra la tinta de
  // la app, que es un poco más clara, gana el blanco.
  assert.equal(textoRecomendado("#767676"), BLANCO);
});

test("se lee desde 4,5:1, el mínimo de WCAG AA", () => {
  assert.equal(seLee("#767676", BLANCO), true);
  assert.equal(seLee("#777777", BLANCO), false);
});

test("en la de fábrica, cada texto es el recomendado y se lee", () => {
  for (const { clave } of PARTES) {
    const { color, texto } = PRESET.colores[clave];
    assert.equal(texto, textoRecomendado(color), clave);
    assert.equal(seLee(color, texto), true, clave);
  }
});

test("blanco sobre amarillo no se lee", () => {
  assert.equal(seLee("#ffd400", BLANCO), false);
  assert.equal(seLee("#ffd400", TINTA), true);
});

test("cambiar un color lleva el texto al recomendado, salvo que el dueño haya elegido otro", () => {
  const oscuro = cambiarColor(PRESET, "fondo", "#112233");
  assert.deepEqual(oscuro.colores.fondo, { color: "#112233", texto: BLANCO });
  assert.equal(PRESET.colores.fondo.color, "#fbf8f4");

  const elegido = cambiarTexto(PRESET, "fondo", "#ff0000");
  assert.deepEqual(cambiarColor(elegido, "fondo", "#112233").colores.fondo, { color: "#112233", texto: "#ff0000" });
});

test("las variables de color pisan las de la app con las del negocio", () => {
  const v = variablesDeColor(PRESET);
  assert.equal(v["--color-fondo"], "#fbf8f4");
  assert.equal(v["--color-tinta"], TINTA);
  assert.equal(v["--color-tarjeta"], "#ffffff");
  assert.equal(v["--lienzo-cajas-texto"], TINTA);
  assert.equal(v["--color-azul"], "#1f4e8c");
  assert.equal(v["--color-white"], BLANCO);
  assert.equal(v["--color-terracota"], "#9a3d1e");
  assert.equal(v["--lienzo-acento-texto"], BLANCO);
  assert.match(v["--color-tinta-suave"], /^color-mix\(in oklab, #241f1b 70%, #fbf8f4\)$/);
});

test("la fuente de fábrica no pisa nada; las otras, títulos y texto", () => {
  assert.deepEqual(variablesDeFuente(PRESET), {});
  const lora = variablesDeFuente({ ...PRESET, fuente: "lora" });
  assert.equal(lora["--font-titulo"], 'var(--fuente-landing), "Segoe UI", system-ui, sans-serif');
  assert.equal(lora["--font-cuerpo"], lora["--font-titulo"]);
});
```

- [ ] **Paso 2: correr y ver que falla**

```bash
npm run test:unit -- pruebas/landing.test.js
```

Esperado: FAIL con `Cannot find module '../src/lib/landing.js'`. En
PowerShell la salida de Jest sale por stderr y aparece como
`NativeCommandError`: es normal, lo que importa es el resultado.

- [ ] **Paso 3: commitear el rojo**

```bash
git add pruebas/landing.test.js
git commit -m "Test en rojo: no hay lógica de la landing de cada negocio" -m "El orden de las secciones, los colores con su texto recomendado y la fuente, completados con la de fábrica al leer (docs/landing-por-negocio.md)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Paso 4: escribir `src/lib/landing.js`**

```js
// La landing de cada negocio (docs/landing-por-negocio.md): qué secciones
// tiene, cómo viene de fábrica, qué colores se leen y cómo se pinta.
//
// Lógica pura, sin React: la usan el editor (/negocio/landing), la vista
// previa y, más adelante, la página pública. Pruebas: pruebas/landing.test.js.
//
// Las claves de SECCIONES y FUENTES están también en la API
// (src/modulos/negocio/esquemas.ts), que no deja guardar otras. Si se suma
// una, se suma en los dos lados.

import { LISTA_MODULOS, estaPrendido } from "./modulos.js";

// El modelo fijo: el negocio no crea ni borra secciones, sólo las ordena.
// "modulo" es el módulo sin el cual la sección no tiene sentido: sin Agenda
// no hay turnos que sacar ni que mostrar.
export const SECCIONES = [
  {
    clave: "negocio",
    nombre: "El negocio",
    queMuestra: "Tu nombre, tu teléfono, tus horarios y un botón para escribirte por WhatsApp.",
    modulo: null,
  },
  {
    clave: "sacar_turno",
    nombre: "Sacar turno",
    queMuestra: "Los días y horarios que te quedan libres, para que el cliente se anote solo.",
    modulo: "agenda",
  },
  {
    clave: "mis_casos",
    nombre: "Mis casos",
    queMuestra: "Los casos abiertos del cliente, con cómo viene cada uno.",
    modulo: null,
  },
  {
    clave: "mis_turnos",
    nombre: "Mis turnos",
    queMuestra: "Los próximos turnos que sacó el cliente.",
    modulo: "agenda",
  },
];

// Los cuatro colores que elige el negocio, cada uno con el de su texto.
export const PARTES = [
  { clave: "fondo", nombre: "Fondo", ayuda: "El color de toda la página." },
  { clave: "cajas", nombre: "Cajas", ayuda: "Donde va cada sección y cada dato." },
  { clave: "botones", nombre: "Botones", ayuda: "Lo que se toca: botones y links." },
  { clave: "acento", nombre: "Acento", ayuda: "Las marcas que llaman la atención, como el estado de un caso." },
];

// "fabrica" es la de la app: Figtree en los títulos y Source Sans 3 en el
// texto. Las otras van en toda la página (src/componentes/landing/fuentes.js).
export const FUENTES = [
  { clave: "fabrica", nombre: "La de la app" },
  { clave: "nunito", nombre: "Nunito" },
  { clave: "montserrat", nombre: "Montserrat" },
  { clave: "lora", nombre: "Lora" },
  { clave: "merriweather", nombre: "Merriweather" },
];

// La tinta de la app y el blanco: entre los dos sale el texto recomendado.
export const TINTA = "#241f1b";
export const BLANCO = "#ffffff";

// WCAG 2.1 AA para texto normal.
export const CONTRASTE_MINIMO = 4.5;

// Los colores y las fuentes de la app (globals.css). En cada parte, el texto
// es el recomendado (hay una prueba que lo cuida).
export const PRESET = {
  orden: SECCIONES.map((s) => s.clave),
  colores: {
    fondo: { color: "#fbf8f4", texto: TINTA },
    cajas: { color: "#ffffff", texto: TINTA },
    botones: { color: "#1f4e8c", texto: BLANCO },
    acento: { color: "#9a3d1e", texto: BLANCO },
  },
  fuente: "fabrica",
};

const esColor = (x) => typeof x === "string" && /^#[0-9a-f]{6}$/i.test(x);

// Lo guardado, completado con la de fábrica donde falte o no se entienda.
// Un valor viejo no rompe nada: el orden suma al final las secciones que se
// agregaron después y saca las que ya no existen.
export function normalizarLanding(guardada) {
  const g = guardada && typeof guardada === "object" ? guardada : {};
  const claves = SECCIONES.map((s) => s.clave);
  const propias = Array.isArray(g.orden)
    ? g.orden.filter((c, i, o) => claves.includes(c) && o.indexOf(c) === i)
    : [];

  const colores = Object.fromEntries(
    PARTES.map(({ clave }) => {
      const parte = g.colores?.[clave] ?? {};
      const fabrica = PRESET.colores[clave];
      return [
        clave,
        {
          color: esColor(parte.color) ? parte.color.toLowerCase() : fabrica.color,
          texto: esColor(parte.texto) ? parte.texto.toLowerCase() : fabrica.texto,
        },
      ];
    })
  );

  return {
    orden: [...propias, ...claves.filter((c) => !propias.includes(c))],
    colores,
    fuente: FUENTES.some((f) => f.clave === g.fuente) ? g.fuente : PRESET.fuente,
  };
}

export const esDeFabrica = (landing) =>
  JSON.stringify(normalizarLanding(landing)) === JSON.stringify(PRESET);

// Sube (paso -1) o baja (paso 1) una sección. En las puntas no hace nada.
export function moverSeccion(orden, clave, paso) {
  const i = orden.indexOf(clave);
  const j = i + paso;
  if (i < 0 || j < 0 || j >= orden.length) return [...orden];
  const nuevo = [...orden];
  [nuevo[i], nuevo[j]] = [nuevo[j], nuevo[i]];
  return nuevo;
}

// Las secciones en el orden elegido, con si aparecen y, si no, por qué. El
// editor las muestra todas; la vista previa, sólo las visibles.
export function estadoDeSecciones(orden, modulosActivos = []) {
  return normalizarLanding({ orden }).orden.map((clave) => {
    const seccion = SECCIONES.find((s) => s.clave === clave);
    const visible = !seccion.modulo || estaPrendido(seccion.modulo, modulosActivos);
    const modulo = LISTA_MODULOS.find((m) => m.clave === seccion.modulo);
    return {
      ...seccion,
      visible,
      motivo: visible ? null : `Aparece cuando prendés el módulo ${modulo?.nombre ?? seccion.modulo}.`,
    };
  });
}

// La luminancia relativa y el contraste de WCAG 2.1.
const canal = (valor) => {
  const c = valor / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminancia = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
};

export function contraste(a, b) {
  const [clara, oscura] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (clara + 0.05) / (oscura + 0.05);
}

export const seLee = (color, texto) => contraste(color, texto) >= CONTRASTE_MINIMO;

export const textoRecomendado = (color) =>
  contraste(color, TINTA) >= contraste(color, BLANCO) ? TINTA : BLANCO;

// Cambiar el color de una parte. Si su texto era el recomendado, pasa al
// recomendado del color nuevo; si el dueño eligió otro, se respeta.
export function cambiarColor(landing, parte, color) {
  const actual = landing.colores[parte];
  const texto =
    actual.texto === textoRecomendado(actual.color) ? textoRecomendado(color) : actual.texto;
  return { ...landing, colores: { ...landing.colores, [parte]: { color, texto } } };
}

export const cambiarTexto = (landing, parte, texto) => ({
  ...landing,
  colores: { ...landing.colores, [parte]: { ...landing.colores[parte], texto } },
});

// Lo que Lienzo pisa en su style. Los tonos que el negocio no elige (el texto
// suave, los bordes, el botón apretado) salen de mezclar los que sí eligió,
// así siguen leyéndose sobre cualquier fondo. Los links (text-azul) toman el
// color de los botones.
const mezcla = (a, b, porcentaje) => `color-mix(in oklab, ${a} ${porcentaje}%, ${b})`;

export function variablesDeColor({ colores: { fondo, cajas, botones, acento } }) {
  return {
    "--color-fondo": fondo.color,
    "--color-tinta": fondo.texto,
    "--color-tinta-media": mezcla(fondo.texto, fondo.color, 85),
    "--color-tinta-suave": mezcla(fondo.texto, fondo.color, 70),
    "--color-superficie": mezcla(fondo.texto, fondo.color, 6),
    "--color-borde": mezcla(fondo.texto, fondo.color, 15),
    "--color-borde-fuerte": mezcla(fondo.texto, fondo.color, 30),
    "--color-tarjeta": cajas.color,
    "--lienzo-cajas-texto": cajas.texto,
    "--color-azul": botones.color,
    "--color-white": botones.texto,
    "--color-azul-apretado": mezcla(botones.color, "#000000", 82),
    "--color-azul-claro": mezcla(botones.color, cajas.color, 14),
    "--color-terracota": acento.color,
    "--lienzo-acento-texto": acento.texto,
  };
}

// La de fábrica ya es la de la app. Las otras declaran --fuente-landing
// (fuentes.js), y acá pasa a títulos y texto.
const PILA = '"Segoe UI", system-ui, sans-serif';

export const variablesDeFuente = ({ fuente }) =>
  fuente === "fabrica"
    ? {}
    : {
        "--font-titulo": `var(--fuente-landing), ${PILA}`,
        "--font-cuerpo": `var(--fuente-landing), ${PILA}`,
      };
```

- [ ] **Paso 5: correr y ver que pasa**

```bash
npm run test:unit -- pruebas/landing.test.js
npm run test:unit
```

Esperado: `pruebas/landing.test.js` en verde, y la suite entera sin fallas
nuevas.

- [ ] **Paso 6: commitear el verde**

```bash
git add src/lib/landing.js
git commit -m "La lógica de la landing de cada negocio" -m "Secciones, partes, fuentes y la de fábrica; normalizar lo guardado, ordenar, el contraste de WCAG con el texto recomendado, y las variables que pisa Lienzo. Las claves coinciden con el esquema de la API." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 4: Lienzo, las fuentes y la vista previa

**Archivos (front):**
- Crear: `src/componentes/landing/fuentes.js`
- Crear: `src/componentes/landing/Lienzo.js`
- Crear: `src/componentes/landing/VistaPrevia.js`
- Modificar: `src/app/globals.css` (al final del archivo)

**Interfaces:**
- Consume: `variablesDeColor`, `variablesDeFuente` (Tarea 3).
- Produce:
  - `FUENTES_LANDING: { nunito, montserrat, lora, merriweather }`, cada una con
    `.className` y `.variable` de `next/font`.
  - `<Lienzo landing className? {...props}>`: un `div` con `data-lienzo`.
  - `<VistaPrevia landing negocio secciones>`: `secciones` son las visibles de
    `estadoDeSecciones`.

Antes de escribir `fuentes.js`, leer (AGENTS.md lo exige para Next 16):
`node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md` y
`node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md`
(en particular `preload`, `variable` y "Reusing fonts").

Esta tarea no tiene prueba propia: la lógica está en `lib/landing.js` (Tarea 3)
y lo que se ve lo prueba la e2e del editor (Tarea 5), que lee el `style` de
`[data-lienzo]`. Se verifica con el build.

- [ ] **Paso 1: las fuentes**

`src/componentes/landing/fuentes.js`:

```js
import { Lora, Merriweather, Montserrat, Nunito } from "next/font/google";

// Las fuentes que el dueño puede elegir para su landing (FUENTES de
// src/lib/landing.js). "fabrica" no está acá: es la de la app, que ya carga
// layout.js.
//
// preload: false para que una pantalla que importa esto no precargue las
// cuatro: el navegador baja sólo la que algún texto usa. Todas declaran la
// misma variable; Lienzo pone la clase de la elegida y variablesDeFuente()
// la pasa a títulos y texto.
//
// Lora no pasa de 700: los títulos extra negritas de la cartilla (800) se
// ven en 700.
const nunito = Nunito({ subsets: ["latin"], variable: "--fuente-landing", display: "swap", preload: false });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--fuente-landing", display: "swap", preload: false });
const lora = Lora({ subsets: ["latin"], variable: "--fuente-landing", display: "swap", preload: false });
const merriweather = Merriweather({ subsets: ["latin"], variable: "--fuente-landing", display: "swap", preload: false });

export const FUENTES_LANDING = { nunito, montserrat, lora, merriweather };
```

- [ ] **Paso 2: Lienzo**

`src/componentes/landing/Lienzo.js`:

```jsx
import { FUENTES_LANDING } from "./fuentes";
import { variablesDeColor, variablesDeFuente } from "@/lib/landing";

// El contenedor de la landing: pisa en su style las variables de color y de
// fuente de globals.css con las del negocio. Así todo lo de adentro —también
// los componentes de siempre, como Boton y Tarjeta— se pinta con lo que
// eligió. Funciona porque el tema es "@theme" y no "@theme inline": las
// utilidades usan var(--color-…).
//
// Las reglas que lo completan ([data-lienzo]) están al final de globals.css.
// Es un atributo y no la clase "landing", que es de /bienvenida.
export default function Lienzo({ landing, className = "", children, ...props }) {
  return (
    <div
      data-lienzo=""
      className={[FUENTES_LANDING[landing.fuente]?.variable ?? "", className].join(" ")}
      style={{ ...variablesDeColor(landing), ...variablesDeFuente(landing) }}
      {...props}
    >
      {children}
    </div>
  );
}
```

- [ ] **Paso 3: las reglas de `[data-lienzo]`**

Al final de `src/app/globals.css`, agregar:

```css
/* ------------------------------------------------------------
   La landing de cada negocio (src/componentes/landing/Lienzo.js).

   Lienzo pisa las variables en su style. Esto vuelve a declarar el fondo,
   el color y la fuente, que body ya resolvió con los de la app, y les da a
   las cajas su propio texto: las tarjetas no fijan color, lo heredan. Lo
   que va dentro de una caja (un hover, un botón apagado, un borde) sale de
   los colores de la caja y no de los del fondo, con los mismos porcentajes
   que variablesDeColor() usa para el fondo.

   Va en la capa base para que las utilidades sigan ganando: un botón con
   fondo de caja y text-azul tiene que seguir siendo azul.
   ------------------------------------------------------------ */
@layer base {
  [data-lienzo] {
    background-color: var(--color-fondo);
    color: var(--color-tinta);
    font-family: var(--font-cuerpo);
  }

  [data-lienzo] .bg-tarjeta {
    --color-tinta: var(--lienzo-cajas-texto);
    --color-tinta-media: color-mix(in oklab, var(--lienzo-cajas-texto) 85%, var(--color-tarjeta));
    --color-tinta-suave: color-mix(in oklab, var(--lienzo-cajas-texto) 70%, var(--color-tarjeta));
    --color-superficie: color-mix(in oklab, var(--lienzo-cajas-texto) 6%, var(--color-tarjeta));
    --color-borde: color-mix(in oklab, var(--lienzo-cajas-texto) 15%, var(--color-tarjeta));
    --color-borde-fuerte: color-mix(in oklab, var(--lienzo-cajas-texto) 30%, var(--color-tarjeta));
    color: var(--color-tinta);
  }

  [data-lienzo] .lienzo-acento {
    background-color: var(--color-terracota);
    color: var(--lienzo-acento-texto);
  }
}
```

- [ ] **Paso 4: la vista previa**

`src/componentes/landing/VistaPrevia.js`:

```jsx
import Lienzo from "./Lienzo";
import Icono from "@/componentes/Icono";

// La landing en chico, con datos de ejemplo, para ver cómo queda mientras se
// edita. Es una imitación: los botones son de mentira (no se pueden tocar ni
// enfocar). Cuando exista la página pública (paso 4 del diseño), sus
// secciones reemplazan a estas.

function Seccion({ titulo, children }) {
  return (
    <section className="rounded-tarjeta border border-borde bg-tarjeta p-4">
      <h3 className="text-subtitulo font-extrabold">{titulo}</h3>
      <div className="mt-2 grid justify-items-start gap-2 text-tinta-media">{children}</div>
    </section>
  );
}

function BotonDeMentira({ icono, children }) {
  return (
    <span className="inline-flex min-h-11 items-center gap-2 rounded-campo bg-azul px-4 font-bold text-white">
      {icono && <Icono nombre={icono} className="size-5" />}
      {children}
    </span>
  );
}

const CONTENIDO = {
  negocio: (negocio) => (
    <>
      <p>{negocio?.telefono || "341 555 1234"}</p>
      <p>Lunes a viernes, de 9 a 18.</p>
      <BotonDeMentira icono="whatsapp">Escribinos</BotonDeMentira>
    </>
  ),
  sacar_turno: () => (
    <>
      <div className="flex flex-wrap gap-2">
        {["Lun 20", "Mar 21", "Mié 22"].map((dia) => (
          <span key={dia} className="rounded-campo bg-azul-claro px-3 py-2 font-bold text-azul">
            {dia}
          </span>
        ))}
      </div>
      <BotonDeMentira>Pedir turno</BotonDeMentira>
    </>
  ),
  mis_casos: () => (
    <>
      <p className="flex flex-wrap items-center gap-2 text-tinta">
        Caso 248
        <span className="lienzo-acento rounded-full px-3 py-1 font-bold text-etiqueta">
          En proceso
        </span>
      </p>
      <span className="font-bold text-azul">Ver cómo viene</span>
    </>
  ),
  mis_turnos: () => <p>Martes 21, 10:00 · Cambio de aceite</p>,
};

export default function VistaPrevia({ landing, negocio, secciones }) {
  return (
    <figure>
      <figcaption className="mb-2 font-bold text-etiqueta text-tinta-media">
        Así la ve tu cliente
      </figcaption>
      <Lienzo landing={landing} className="mx-auto max-w-sm rounded-tarjeta border border-borde-fuerte p-4">
        <h2 className="text-seccion font-extrabold">{negocio?.nombre ?? "Tu negocio"}</h2>
        <div className="mt-4 grid gap-3">
          {secciones.map((s) => (
            <Seccion key={s.clave} titulo={s.nombre}>
              {CONTENIDO[s.clave](negocio)}
            </Seccion>
          ))}
        </div>
      </Lienzo>
    </figure>
  );
}
```

- [ ] **Paso 5: verificar el build**

```bash
npm run build
```

Esperado: compila sin errores. `next/font` baja las cuatro fuentes en el build,
así que necesita internet. Si falla por `next/font`, releer `font.md` y
corregir las opciones: no tocar `layout.js`.

- [ ] **Paso 6: commitear**

```bash
git add src/componentes/landing/fuentes.js src/componentes/landing/Lienzo.js src/componentes/landing/VistaPrevia.js src/app/globals.css
git commit -m "Lienzo y la vista previa de la landing" -m "Lienzo pisa las variables de color y de fuente de la app con las del negocio, así los componentes de siempre se pintan sin tocarlos. Marca con data-lienzo porque la clase landing es de /bienvenida; sus reglas van en la capa base para que las utilidades sigan ganando. Las cuatro fuentes con preload: false." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 5: el editor — `/negocio/landing`

**Archivos (front):**
- Crear: `pruebas/e2e/historias/landing-editor.e2e.js`
- Modificar: `src/lib/datos.js` (después de `dejarDeCompartirAgenda`, ~línea 1153)
- Crear: `src/app/negocio/landing/page.js`
- Modificar: `src/app/negocio/page.js` (después del bloque de Módulos, ~línea 443)

**Interfaces:**
- Consume: todo `src/lib/landing.js` (Tarea 3); `FUENTES_LANDING` y
  `VistaPrevia` (Tarea 4); `PUT /v1/negocio/landing` (Tarea 2).
- Produce: `datos.guardarLanding(valor) → Promise<{ ok: true } | { ok: false, error: string }>`.

**Para correr la e2e hace falta** (lo prepara la persona; no tocar los `.env`):

1. La 052 corrida en Supabase (Tarea 1, paso 3).
2. La API de la rama `landing-editor` levantada en el puerto 4000, con su `.env`
   completo (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `ORIGENES_PERMITIDOS` con `http://localhost:3000`, las seis de Mercado Pago y
   `SEMILLA_CLAVE`). En PowerShell, desde el repo de la API:
   `$env:PORT=4000; npm run dev`.
3. En el `.env.local` del front: `NEXT_PUBLIC_API_URL=http://localhost:4000/v1`,
   `E2E_API_URL=http://localhost:4000` y `E2E_SEMILLA_CLAVE` con el mismo valor
   que `SEMILLA_CLAVE`.
4. El front levantado: `npm run dev` (puerto 3000).

Con eso, un solo spec corre con
`npx wdio run ./wdio.conf.js --spec ./pruebas/e2e/historias/landing-editor.e2e.js`
(está en `pruebas/CRITERIOS_SPRINT_ACTUAL.md`). No usar `npm run test:e2e` en
esta máquina: `start-server-and-test` necesita `wmic`, que Windows 11 no trae,
y deja el servidor colgado.

- [ ] **Paso 1: escribir la e2e**

`pruebas/e2e/historias/landing-editor.e2e.js`:

```js
import { $, $$, browser, expect } from "@wdio/globals";
import { entrar, verTexto } from "./ayudas.js";

// SCRUM-196 a 199: el editor de la landing (docs/landing-por-negocio.md).
// Entra como dueño de un negocio sembrado, cambia, guarda y comprueba que
// quedó después de refrescar. La vista previa se lee por el style de
// [data-lienzo], que es lo que pinta.

// Un <input type="color"> no se escribe: se le pone el valor como lo haría
// el selector del navegador, y se avisa a React con el evento input.
async function elegirColor(etiqueta, valor) {
  await browser.execute(
    (etiqueta, valor) => {
      const input = document.querySelector(`input[aria-label="${etiqueta}"]`);
      const poner = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      poner.call(input, valor);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    },
    etiqueta,
    valor
  );
}

const estiloDeLaVistaPrevia = () => $("[data-lienzo]").getAttribute("style");

async function primeraSeccion() {
  const titulos = await $$("[data-orden] li h3");
  return titulos[0].getText();
}

describe("Historia: El dueño arma la landing de su negocio", () => {
  beforeEach(async () => {
    await entrar("/negocio/landing");
    await expect($("h1=Tu landing")).toBeDisplayed();
  });

  it("SCRUM-196: se llega desde Mi negocio", async () => {
    await browser.url("/negocio");
    await $("a=Armar tu landing").click();
    await expect($("h1=Tu landing")).toBeDisplayed();
  });

  it("SCRUM-197: cambia el orden de las secciones y queda guardado", async () => {
    expect(await primeraSeccion()).toBe("El negocio");
    await $('button[aria-label="Bajar El negocio"]').click();
    expect(await primeraSeccion()).toBe("Sacar turno");
    await $("button=Guardar").click();
    await verTexto("Tu landing quedó guardada");
    await browser.refresh();
    await expect($("h1=Tu landing")).toBeDisplayed();
    expect(await primeraSeccion()).toBe("Sacar turno");
  });

  it("SCRUM-198: elige los colores, la vista previa los muestra y quedan guardados", async () => {
    await elegirColor("Color de Fondo", "#112233");
    expect(await estiloDeLaVistaPrevia()).toContain("--color-fondo: #112233");
    // El texto del fondo pasa solo al recomendado: sobre azul oscuro, blanco.
    expect(await estiloDeLaVistaPrevia()).toContain("--color-tinta: #ffffff");
    await $("button=Guardar").click();
    await verTexto("Tu landing quedó guardada");
    await browser.refresh();
    await expect($("[data-lienzo]")).toBeDisplayed();
    expect(await estiloDeLaVistaPrevia()).toContain("--color-fondo: #112233");
  });

  it("SCRUM-198: avisa cuando el texto elegido no se lee", async () => {
    await elegirColor("Color de Botones", "#ffd400");
    await elegirColor("Texto de Botones", "#ffffff");
    await verTexto("Con este texto cuesta leer");
  });

  it("SCRUM-198: elige la fuente y queda guardada", async () => {
    await $("label=Lora").click();
    expect(await estiloDeLaVistaPrevia()).toContain("--font-titulo: var(--fuente-landing)");
    await $("button=Guardar").click();
    await verTexto("Tu landing quedó guardada");
    await browser.refresh();
    await expect($("[data-lienzo]")).toBeDisplayed();
    expect(await estiloDeLaVistaPrevia()).toContain("--font-titulo: var(--fuente-landing)");
  });

  it("SCRUM-199: vuelve a la de fábrica", async () => {
    await elegirColor("Color de Fondo", "#112233");
    await $("button=Guardar").click();
    await verTexto("Tu landing quedó guardada");
    await $("button=Volver a la de fábrica").click();
    expect(await estiloDeLaVistaPrevia()).toContain("--color-fondo: #fbf8f4");
    await $("button=Guardar").click();
    // El aviso del primer guardado sigue en pantalla (no se va solo), así que
    // verTexto no esperaría nada. Guardar vuelve a decir "no cambiaste nada"
    // recién cuando la API contestó; refrescar antes puede cortar el guardado.
    await expect($("button*=no cambiaste nada")).toBeDisplayed();
    await browser.refresh();
    await expect($("[data-lienzo]")).toBeDisplayed();
    expect(await estiloDeLaVistaPrevia()).toContain("--color-fondo: #fbf8f4");
  });
});
```

- [ ] **Paso 2: correr y ver que falla**

Con todo levantado (ver arriba):

```bash
npx wdio run ./wdio.conf.js --spec ./pruebas/e2e/historias/landing-editor.e2e.js
```

Esperado: falla el `beforeEach` esperando `h1=Tu landing` (la página no existe y
`/negocio/landing` da 404). Mocha lo reporta como un solo fallo ("before each"
hook) y no corre las otras pruebas del describe: es el rojo esperado. Si falla
antes, en `sembrar`, falta algo del entorno: no seguir hasta que la siembra
ande.

- [ ] **Paso 3: commitear el rojo**

```bash
git add pruebas/e2e/historias/landing-editor.e2e.js
git commit -m "Test en rojo: no hay editor de la landing" -m "SCRUM-196 a 199: llegar desde Mi negocio, cambiar el orden, los colores y la fuente, ver la vista previa, volver a la de fábrica y que quede guardado." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Paso 4: la acción de `datos.js`**

En `src/lib/datos.js`, después de `dejarDeCompartirAgenda() { ... },`
(~línea 1153), agregar:

```js
      // La landing del negocio (docs/landing-por-negocio.md): la
      // personalización entera, o null para volver a la de fábrica. No es
      // optimista como cambiarInicio: el editor tiene un botón Guardar y
      // tiene que poder decir si salió.
      async guardarLanding(valor) {
        const r = await reemplazar("/negocio/landing", { valor }, await tokenDeSesion());
        if (!r.ok) return { ok: false, error: r.error.mensaje };
        if (r.datos.negocio) ponerNegocio(r.datos.negocio);
        return { ok: true };
      },
```

`reemplazar`, `tokenDeSesion` y `ponerNegocio` ya existen en ese archivo
(`reemplazar` se importa de `./api.js` en la línea 18).

- [ ] **Paso 5: la pantalla**

`src/app/negocio/landing/page.js`:

```jsx
"use client";

// "Tu landing" (SCRUM-196 a 199, docs/landing-por-negocio.md).
//
// La página pública de cada negocio sale de un modelo fijo: el dueño sólo
// elige el orden de las secciones, los colores y la fuente. Acá lo edita, lo
// ve en la vista previa mientras cambia, y recién al guardar queda.
//
// Se llega desde "Mi negocio", como Módulos. La edita sólo el dueño; la API
// también lo frena (403). El link para compartirla llega con la página
// pública (paso 4 del diseño).

import { useState } from "react";
import Link from "next/link";
import { useDatos } from "@/lib/datos";
import { useAuth } from "@/lib/auth";
import { useTitulo } from "@/lib/useTitulo";
import { puede, QUIEN_PUEDE } from "@/lib/permisos";
import {
  CONTRASTE_MINIMO,
  FUENTES,
  PARTES,
  cambiarColor,
  cambiarTexto,
  contraste,
  esDeFabrica,
  estadoDeSecciones,
  moverSeccion,
  normalizarLanding,
  seLee,
  textoRecomendado,
} from "@/lib/landing";
import Icono from "@/componentes/Icono";
import { FUENTES_LANDING } from "@/componentes/landing/fuentes";
import VistaPrevia from "@/componentes/landing/VistaPrevia";
import { Boton, Cargando, Tarjeta, TituloPantalla, TituloSeccion } from "@/componentes/ui";

// 4.5 → "4,5", como se escribe acá.
const conComa = (n) => n.toFixed(1).replace(".", ",");

const CAMPO_COLOR =
  "h-12 w-16 cursor-pointer rounded-campo border-2 border-borde-fuerte bg-tarjeta p-1";

export default function EditorDeLanding() {
  const datos = useDatos();
  const { cargando, negocio } = datos;
  const { usuario } = useAuth();
  useTitulo("Tu landing");

  // null = sin cambios: se ve lo guardado.
  const [borrador, setBorrador] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  if (cargando) return <Cargando />;

  const puedeConfigurar = puede(usuario?.rol, "configurarNegocio");
  const guardada = normalizarLanding(negocio?.landing);
  const actual = borrador ?? guardada;
  const hayCambios = borrador !== null && JSON.stringify(borrador) !== JSON.stringify(guardada);
  const secciones = estadoDeSecciones(actual.orden, negocio?.modulos_activos ?? []);

  const mover = (clave, paso) =>
    setBorrador({ ...actual, orden: moverSeccion(actual.orden, clave, paso) });

  const guardar = async () => {
    setError(null);
    setGuardando(true);
    // La de fábrica se guarda como null: así, si un día cambia, el negocio
    // que nunca la tocó recibe la nueva.
    const r = await datos.guardarLanding(esDeFabrica(actual) ? null : actual);
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    setBorrador(null);
    datos.avisarExito("Listo. Tu landing quedó guardada.");
  };

  return (
    <>
      <Link
        href="/negocio"
        className="mb-4 inline-flex min-h-12 items-center gap-2 font-bold text-azul"
      >
        <Icono nombre="volver" />
        Volver a Mi negocio
      </Link>

      <TituloPantalla apoyo="La página que van a ver tus clientes. Elegí el orden, los colores y la letra.">
        Tu landing
      </TituloPantalla>

      {!puedeConfigurar ? (
        <Tarjeta>
          <p className="max-w-[65ch] text-tinta-media">{QUIEN_PUEDE.configurarNegocio}</p>
        </Tarjeta>
      ) : (
        // Las columnas por el ancho del bloque (@container de Guardia.js) y no
        // de la ventana: la barra lateral se lleva 256 px. Con 56rem de bloque
        // quedan unos 480 px para el editor.
        <div className="grid gap-8 @4xl:grid-cols-[minmax(0,1fr)_24rem] @4xl:items-start">
          <div>
            <TituloSeccion>Orden</TituloSeccion>
            <Tarjeta className="mb-8">
              <p className="mb-4 max-w-[65ch] text-tinta-media">
                Las secciones son siempre las mismas. Elegí en qué orden aparecen.
              </p>
              <ol data-orden="" className="grid gap-3">
                {secciones.map((s, i) => (
                  <li
                    key={s.clave}
                    className={[
                      "flex flex-wrap items-center justify-between gap-3 rounded-tarjeta border border-borde p-4",
                      s.visible ? "" : "bg-superficie",
                    ].join(" ")}
                  >
                    <div className="min-w-0">
                      <h3 className="font-bold text-cuerpo">{s.nombre}</h3>
                      <p className="max-w-[55ch] text-apoyo text-tinta-suave">
                        {s.motivo ?? s.queMuestra}
                      </p>
                    </div>
                    {/* Con palabra: la cartilla no permite botones de sólo
                        ícono (Icono.js). El aria-label suma de qué sección se
                        habla, y empieza con la palabra visible (WCAG 2.5.3). */}
                    <div className="flex flex-wrap gap-2">
                      <Boton
                        variante="plano"
                        icono="flecha-arriba"
                        aria-label={`Subir ${s.nombre}`}
                        motivo={i === 0 ? "ya va primera" : null}
                        onClick={() => mover(s.clave, -1)}
                      >
                        Subir
                      </Boton>
                      <Boton
                        variante="plano"
                        icono="flecha-abajo"
                        aria-label={`Bajar ${s.nombre}`}
                        motivo={i === secciones.length - 1 ? "ya va última" : null}
                        onClick={() => mover(s.clave, 1)}
                      >
                        Bajar
                      </Boton>
                    </div>
                  </li>
                ))}
              </ol>
            </Tarjeta>

            <TituloSeccion>Colores</TituloSeccion>
            <Tarjeta className="mb-8">
              <p className="mb-6 max-w-[65ch] text-tinta-media">
                Cada parte lleva su color y el de su texto. Te marcamos el texto que mejor se
                lee; si elegís otro, te avisamos cuando cueste leerlo.
              </p>
              <div className="grid gap-8">
                {PARTES.map((p) => {
                  const { color, texto } = actual.colores[p.clave];
                  const recomendado = textoRecomendado(color);
                  return (
                    <fieldset key={p.clave} className="grid gap-3">
                      <legend className="font-bold text-cuerpo">{p.nombre}</legend>
                      <p className="text-apoyo text-tinta-suave">{p.ayuda}</p>
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="inline-flex min-h-12 items-center gap-2">
                          <input
                            type="color"
                            aria-label={`Color de ${p.nombre}`}
                            value={color}
                            onChange={(ev) =>
                              setBorrador(cambiarColor(actual, p.clave, ev.target.value))
                            }
                            className={CAMPO_COLOR}
                          />
                          Color
                        </label>
                        <label className="inline-flex min-h-12 items-center gap-2">
                          <input
                            type="color"
                            aria-label={`Texto de ${p.nombre}`}
                            value={texto}
                            onChange={(ev) =>
                              setBorrador(cambiarTexto(actual, p.clave, ev.target.value))
                            }
                            className={CAMPO_COLOR}
                          />
                          Texto
                        </label>
                        {texto === recomendado ? (
                          // Sin el verde ni el ícono "listo": son del estado
                          // Completado, y acá no se completa nada.
                          <span className="inline-flex items-center gap-1.5 font-bold text-etiqueta text-tinta-media">
                            <Icono nombre="check" className="size-5" />
                            Recomendado
                          </span>
                        ) : (
                          <Boton
                            variante="plano"
                            onClick={() => setBorrador(cambiarTexto(actual, p.clave, recomendado))}
                          >
                            Usar el recomendado
                          </Boton>
                        )}
                      </div>
                      {!seLee(color, texto) && (
                        <p className="flex items-start gap-2 font-bold text-rojo">
                          <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
                          <span>
                            Con este texto cuesta leer: el contraste es{" "}
                            {conComa(contraste(color, texto))} a 1 y lo mínimo es{" "}
                            {conComa(CONTRASTE_MINIMO)} a 1.
                          </span>
                        </p>
                      )}
                      {/* Los links (text-azul) van con el color de los
                          botones y sobre las cajas: un botón claro deja los
                          links ilegibles aunque su propio texto se lea. */}
                      {p.clave === "botones" && !seLee(actual.colores.cajas.color, color) && (
                        <p className="flex items-start gap-2 font-bold text-rojo">
                          <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
                          <span>
                            Los links van con este color y sobre las cajas cuesta leerlos: el
                            contraste es {conComa(contraste(actual.colores.cajas.color, color))} a
                            1 y lo mínimo es {conComa(CONTRASTE_MINIMO)} a 1.
                          </span>
                        </p>
                      )}
                    </fieldset>
                  );
                })}
              </div>
            </Tarjeta>

            <TituloSeccion>Letra</TituloSeccion>
            <Tarjeta className="mb-8">
              <fieldset className="grid gap-3">
                <legend className="mb-3 max-w-[65ch] text-tinta-media">
                  La letra de toda la página. Cada opción está escrita con la suya.
                </legend>
                {FUENTES.map((f) => (
                  <label
                    key={f.clave}
                    className={[
                      "flex min-h-12 cursor-pointer items-center gap-3 rounded-campo border-2 px-4",
                      actual.fuente === f.clave ? "border-azul" : "border-borde",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="fuente"
                      value={f.clave}
                      checked={actual.fuente === f.clave}
                      onChange={() => setBorrador({ ...actual, fuente: f.clave })}
                      className="size-5"
                    />
                    <span className={`text-cuerpo ${FUENTES_LANDING[f.clave]?.className ?? ""}`}>
                      {f.nombre}
                    </span>
                  </label>
                ))}
              </fieldset>
            </Tarjeta>

            {error && (
              <p className="mb-4 flex items-start gap-2 font-bold text-rojo">
                <Icono nombre="alerta" className="mt-0.5 size-6 shrink-0" />
                <span>{error}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Boton
                variante="principal"
                icono="check"
                onClick={guardar}
                motivo={guardando ? "guardando" : hayCambios ? null : "no cambiaste nada"}
              >
                Guardar
              </Boton>
              {hayCambios && (
                <Boton variante="plano" onClick={() => setBorrador(null)}>
                  Descartar los cambios
                </Boton>
              )}
              {!esDeFabrica(actual) && (
                <Boton
                  variante="plano"
                  icono="deshacer"
                  onClick={() => setBorrador(normalizarLanding(null))}
                >
                  Volver a la de fábrica
                </Boton>
              )}
            </div>
          </div>

          <div className="@4xl:sticky @4xl:top-6">
            <VistaPrevia
              landing={actual}
              negocio={negocio}
              secciones={secciones.filter((s) => s.visible)}
            />
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Paso 6: el enlace desde Mi negocio**

En `src/app/negocio/page.js`, reemplazar

```jsx
            {puedeConfigurar ? "Ver y cambiar los módulos" : "Ver los módulos"}
          </Link>
        </div>
      </Tarjeta>
```

por

```jsx
            {puedeConfigurar ? "Ver y cambiar los módulos" : "Ver los módulos"}
          </Link>
        </div>
      </Tarjeta>

      {/* La landing la arma sólo el dueño: el resto del equipo no tiene nada
          que hacer en esa pantalla. */}
      {puedeConfigurar && (
        <>
          <TituloSeccion id="landing">Tu landing</TituloSeccion>
          <Tarjeta className="mb-12">
            <p className="max-w-[65ch] text-tinta-media">
              Elegí cómo se ve la página que van a ver tus clientes: el orden de las secciones,
              los colores y la letra.
            </p>
            <div className="mt-4">
              <Link
                href="/negocio/landing"
                className="inline-flex min-h-12 items-center gap-2 font-bold text-azul"
              >
                <Icono nombre="pincel" />
                Armar tu landing
              </Link>
            </div>
          </Tarjeta>
        </>
      )}
```

`TituloSeccion`, `Tarjeta`, `Link` e `Icono` ya están importados en ese archivo
(líneas 12, 22 y 27).

- [ ] **Paso 7: correr la e2e y ver que pasa**

```bash
npx wdio run ./wdio.conf.js --spec ./pruebas/e2e/historias/landing-editor.e2e.js
```

Esperado: los seis en verde. Si "SCRUM-198: elige los colores" falla porque el
`style` no cambia, revisar que `onChange` del `input type="color"` use
`ev.target.value` y que `elegirColor` encuentre el `aria-label` exacto.

- [ ] **Paso 8: correr las unitarias y el build**

```bash
npm run test:unit
npm run build
```

Esperado: sin fallas nuevas. `pruebas/fronteras.test.js` prohíbe que una
pantalla llame a la API directo: la pantalla sólo usa `datos.guardarLanding`.

- [ ] **Paso 9: mirarlo**

Con el front levantado, abrir `http://localhost:3000/negocio/landing` en el
navegador de la app y comprobar:
- en el celular (375 px de ancho) la vista previa queda abajo y nada se sale
  de la pantalla;
- con el contenido de 900 px o más (ventana ancha), la vista previa queda a la
  derecha y acompaña al bajar;
- con botones `#ffd400` aparece el aviso de que los links cuestan leerse;
- con fondo `#112233` el texto de la vista previa se lee, y las cajas siguen
  blancas con texto oscuro;
- con Lora elegida, los títulos de la vista previa cambian de letra y los de
  la pantalla no.

- [ ] **Paso 10: commitear el verde**

```bash
git add src/lib/datos.js src/app/negocio/landing/page.js src/app/negocio/page.js
git commit -m "El dueño arma la landing de su negocio (SCRUM-196 a 199)" -m "Desde Mi negocio: el orden de las secciones, los cuatro colores con su texto recomendado y el aviso de contraste, la letra, la vista previa que cambia mientras se edita y volver a la de fábrica. Guardar espera a la API para poder decir si salió." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 6: verificación final y PRs

- [ ] **Paso 1: la suite de la API**

```bash
cd C:/Users/bauti/OneDrive/Desktop/TP-IngeSoft-API
npm test
```

Esperado: compila y pasa todo.

- [ ] **Paso 2: las suites del front**

```bash
cd C:/Users/bauti/OneDrive/Desktop/TP-Ing.-Software-2026c2
npm run test:unit
npm run build
npx wdio run ./wdio.conf.js
```

Esperado: unitarias y build sin fallas; las e2e, todas en verde (no sólo la del
editor: el cambio en `globals.css` y en Mi negocio toca pantallas de todos).

- [ ] **Paso 3: pedir permiso para subir**

No subir sin el OK de la persona. Decirle:

- **API:** subir `landing-editor` y abrir el PR a `master`. Render despliega
  `master` solo, así que **la 052 tiene que estar corrida en Supabase antes de
  mergear**: sin ella, `PUT /v1/negocio/landing` da 500.
- **Front:** subir `landing-por-negocio` y abrir el PR a `development`, **después
  de que la API esté desplegada**: sin la ruta, Guardar da 404.

Con el OK, escribir el cuerpo de cada PR en un archivo del scratchpad
(`pr-api.md` y `pr-front.md`) con: qué hace, cómo se probó (los comandos de
arriba con su resultado real), el orden de despliegue (052 → API → front) y,
como última línea, `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
Después, desde cada repo:

```bash
git push -u origin landing-editor
gh pr create --base master --title "La landing de cada negocio: guardar la personalización" --body-file <scratchpad>/pr-api.md
```

```bash
git push -u origin landing-por-negocio
gh pr create --base development --title "El dueño arma la landing de su negocio (SCRUM-196 a 199)" --body-file <scratchpad>/pr-front.md
```

(`<scratchpad>` es la carpeta de scratchpad de la sesión.)
