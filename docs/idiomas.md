# Idiomas: castellano e inglés

Implementado. Plan: docs/idiomas-plan.md.

Diseño aprobado el 2026-10-20.

## Qué cambia

Hoy la app está escrita en castellano directamente en cada pantalla, con
`<html lang="es">` fijo y `"es-AR"` escrito a mano en cada formato de número y
fecha.

Pasa a estar **en castellano o en inglés según quien la mira**. La primera vez
decide el idioma del navegador; después, lo que la persona elija en el
selector. La dirección no cambia: `/agenda` es `/agenda` en los dos idiomas.

## Decisiones

- **Decide cada persona, no el negocio.** Dos personas del mismo equipo pueden
  ver la app en idiomas distintos. El cliente que abre un link de seguimiento
  la ve en el idioma de su navegador, no en el del negocio.
- **Orden:** cookie `idioma` → `Accept-Language` → `es`. Sólo `es` y `en`.
- **Sin país por IP.** El idioma del navegador acierta más que la ubicación:
  alguien en Argentina con el navegador en inglés quiere inglés.
- **Sin prefijo en la dirección (`/en/...`).** Casi toda la app está detrás de
  la sesión, así que no gana nada en buscadores. Además rompería los links que
  ya se mandaron por WhatsApp, metería el idioma del negocio en el link del
  cliente y obligaría a mover todo `src/app` a `src/app/[lang]`. Si algún día
  `/n/[codigo]` necesita buscadores en inglés, se le pone prefijo sólo a esa.
- **Sin librería.** Diccionarios propios, `t()` e `Intl.PluralRules`. Encaja
  con `vocabulario()`, que ya resuelve las palabras a mano.
- **La cookie y no la cuenta.** Como el tema (src/lib/tema.js), es de este
  aparato. Guardarla en el perfil para que siga a la persona entre aparatos
  queda para cuando alguien lo pida.
- **El layout raíz lee `cookies()` y `headers()` directo.** Hay un `proxy.js`
  mínimo, sólo para `?idioma=` en los links públicos (ver
  docs/idioma-en-links-publicos.md).

## Cómo se elige

`elegirIdioma(cookie, acceptLanguage)` en `src/lib/idioma.js`:

1. Si la cookie vale `es` o `en`, ese.
2. Si no, se recorre `Accept-Language` de mayor a menor `q` y gana el primero
   que empiece con `es` o `en` (`en-GB` → `en`, `es-MX` → `es`).
3. Si no, `es`.

`src/app/layout.js` lo llama con `(await cookies()).get("idioma")` y
`(await headers()).get("accept-language")`, pone `<html lang={idioma}>` y
envuelve la app en `<IdiomaProvider idioma diccionario>`.

Leer la cookie en el layout hace que todas las rutas se dibujen en cada pedido
y no como HTML estático. Se acepta: es una app con sesión, y la alternativa
(decidir en el navegador) muestra castellano y después salta a inglés.

## Diccionarios y t()

- `src/lib/idiomas/es.js` y `src/lib/idiomas/en.js`: objetos agrupados por
  pantalla. `es` es la fuente: toda clave existe en `es`.
- El provider manda el diccionario activo y, en inglés, también `es` como
  `base` (para el "si falta en `en`, usa `es`"). Además `es` va en el bundle
  del cliente aunque se mire en castellano, porque `tCastellano` (los `t` por
  defecto de `src/lib/`, los errores locales de `datos.js`) lo necesita.
- `useIdioma()` (cliente) devuelve `{ idioma, locale, t }`.
- `t("casos.cuantos", { n: 3 })`:
  - interpola `{n}`, `{nombre}`, etc.;
  - si la entrada es `{ one, other }`, elige con `Intl.PluralRules(locale)`;
  - **si falta en `en`, usa la de `es`.** Así se traduce de a una pantalla
    sin romper las demás.
- `locale`: `es` → `es-AR`, `en` → `en-US`.

## Presets de rubro

Los sustantivos de cada oficio no se declinan igual en los dos idiomas (un/una,
los/las contra a/an, the). Cada rubro tiene su versión en castellano y en
inglés con la misma forma (etiquetas, seguimiento, ejemplos, palabras):

- `PRESETS` queda como está, en castellano. Al lado, `src/lib/presets-en.js`
  trae **sólo los textos** de cada rubro en inglés (etiquetas, explica,
  seguimiento, ejemplos, palabras, identificador, espera, categorías, nombre,
  queEs). Los módulos y el resto no se repiten.
- `preset(rubro, idioma)` los superpone: `{ ...PRESETS[r], ...PRESETS_EN[r] }`.
  Lo que no esté en inglés queda en castellano, como en `t()`.
- `preset`, `vocabulario`, `etiquetaEstado`, `queSignificaPara` y el resto
  reciben el idioma; `es` por defecto, para no cambiar a nadie que no lo pase
  todavía.
- Las formas en inglés se escriben a mano, igual que en castellano:
  `{ uno: "part", varios: "parts" }`, `{ uno: "analysis", varios: "analyses", an: true }`.
- El "qué falta" de un caso queda guardado en el caso cuando se escribe: es
  texto ya creado y se ve como se guardó.

## Formatos

Los `Intl.*("es-AR")` y `toLocale*("es-AR")` pasan a usar `locale`. **La
moneda sigue en ARS y la zona horaria en Buenos Aires**: el negocio está en
Argentina aunque quien mira lea en inglés.

## Selector

- En **Mi perfil**, junto a Tema: Castellano / English.
- Uno chico en las pantallas sin sesión: iniciar sesión, crear cuenta,
  `/seguimiento/[codigo]`, y también en el encabezado de `/bienvenida`.
  `/n/[codigo]` y `/turnos/[codigo]` ya no lo tienen: el idioma viaja en el
  link (docs/idioma-en-links-publicos.md).
- Cada opción lleva su bandera (ES = Argentina, EN = Estados Unidos; SVG
  propios, sin librería) y el código del idioma.
- El título de la pestaña lo pone cada pantalla con `useTitulo`.
  `generateMetadata` del layout devuelve sólo la descripción: si devolviera
  `title`, Next lo manda en streaming y pisaría al de `useTitulo` después de
  hidratar.
- Al elegir: `document.cookie = "idioma=en; path=/; max-age=31536000; samesite=lax"`
  y `router.refresh()`.
- Cada idioma se escribe en su propio idioma ("English", no "Inglés").

## Qué no se traduce

**La regla:** se traduce la app (menús, botones, títulos, descripciones,
avisos, mensajes de error, textos de ayuda y los textos de base de los
presets). **Lo que alguien escribió queda como lo escribió.** Un producto de
inventario cargado como "Pastillas de freno" se ve "Pastillas de freno" en
inglés, y un caso llamado "Cambio de aceite" no pasa a "Oil change".

- Lo que carga el negocio o su equipo: nombres de casos, productos del
  inventario, categorías, clientes, sedes, roles, notas, motivos, plantillas
  de recordatorio y textos de la landing.
- Lo que el negocio renombró desde un preset: si cambió una etiqueta de
  estado, se ve como la escribió. Sólo se traducen las que siguen de fábrica.
- **Textos de fábrica reconocidos al leer.** Un nombre guardado igual al de
  fábrica del rubro, en castellano o en inglés (estados, roles), se muestra en
  el idioma de quien mira. Costo conocido: un rol o estado propio que se llame
  igual que uno de fábrica también se traduce.
- Las categorías de inventario se guardan en castellano (forma canónica) y se
  muestran en el idioma de quien mira.
- Los mails de Supabase (confirmar cuenta, recuperar contraseña).
- Los mensajes de WhatsApp que manda el negocio: salen en el idioma de quien
  los manda.
- Los errores se traducen **por código**: `textoDeError(t, error)` busca
  `errores.<codigo>` y, si no lo conoce, muestra el `mensaje` que vino. Un
  código nuevo de la API se ve en castellano hasta que se lo agregue al
  diccionario.

## Pruebas

- **Jest**
  - `elegirIdioma`: cookie válida, cookie inválida, pesos `q`, región
    (`en-GB`), sin encabezado.
  - `t()`: interpolación, plural `one`/`other` en los dos idiomas, clave que
    falta en `en`, clave que falta en los dos (devuelve la clave).
  - Claves: `en` no tiene claves que `es` no tenga, y los presets `en` tienen
    los mismos rubros y campos que los `es`.
- **wdio**: Chrome headless manda `en-US`. `wdio.conf.js` fija el idioma de
  Chrome (`--lang=es-AR` y la preferencia `intl.accept_languages`) en vez de la
  cookie, para que los e2e existentes sigan en castellano. Un e2e nuevo entra
  con `idioma=en` a iniciar sesión y ve el texto en inglés.

## Lo que escribe la API

Estos textos los escribe la API en castellano y se aceptan así, también cuando
se mira en inglés (limitación aceptada, no pendiente): los eventos del
historial (título, detalle y el autor "El cliente"), el `que_falta` de un caso,
las plantillas de recordatorio por defecto y los textos del feed ICS / Google
Calendar. Sólo se traduce lo que la API manda por código (`errores.<codigo>`).

## Orden

1. `idioma.js`, diccionarios vacíos, `IdiomaProvider`, layout y `lang`.
2. Selector en Mi perfil y en las pantallas públicas.
3. Pantalla piloto: iniciar sesión.
4. Formatos con `locale`.
5. Presets en inglés.
6. El resto de las pantallas, en tandas por sección (acceso, casos, agenda,
   clientes, inventario, negocio, dashboard).
