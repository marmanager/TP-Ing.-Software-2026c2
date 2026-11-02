# Avisos por mail: plan de implementación

Lo que se decidió:

- **El canal es del cliente, no del aviso.** Cada cliente tiene uno: WhatsApp o mail. Arranca
  en WhatsApp si tiene teléfono y en mail si no tiene teléfono pero sí mail. Se cambia desde
  la ficha. El selector "Por dónde se manda" de cada recordatorio (074) se va.
- **Los mismos avisos en los dos canales.** Si un aviso existiera sólo por WhatsApp, el cliente
  de mail no lo recibiría por otro lado: se quedaría sin él. Cada aviso se configura una sola
  vez (si sale, cuándo, qué versión) y vale para los dos.

| Mensaje | Por dónde sale | Por mail |
|---|---|---|
| Avance ("Notificar") | Canal del cliente | El texto de la plantilla, con el link de seguimiento |
| Posventa | Canal del cliente | El texto de la plantilla |
| Turno | Canal del cliente | Los botones "Confirmo" y "No puedo" van como links |
| Volver | Canal del cliente | El texto de la plantilla |
| Presupuesto | Canal del cliente | El texto de la plantilla, con el link del caso |
| Conversación, mensaje a mano, "Retomar" | Sólo WhatsApp | No existe: depende de la ventana de 24 h |
| Mails de cuenta (código, contraseña) | Sólo mail, al equipo | No son avisos al cliente |

- **El mail es la plantilla.** Sale la versión elegida, con las mismas variables. No hay un
  texto aparte para mail.
- **Resend en lugar de Gmail.** Con Resend se pueden mandar los encabezados de baja en un clic
  y se gana reputación en un dominio propio.

## Dos reglas de diseño

**1. Mandar un mail no está atado a la cola.** La API *sabe mandar un mail*, y la cola es una
de las que lo usan, como pasa con `enviarTexto` en WhatsApp. Hoy ya lo usan dos: el procesador
y los códigos de ingreso de la landing. Una factura sería la tercera, sin tocar nada.
- `src/lib/mail.ts` no sabe de casos, avisos, plantillas, canal ni baja. Recibe a quién,
  asunto, texto (y html), encabezados y adjuntos, y devuelve el id del mail.
- Lo que es de los avisos (el pie con el link de baja, List-Unsubscribe, los links del turno)
  lo arma el procesador y se lo pasa como texto y encabezados.

**2. La baja es "no recibe avisos automáticos", no "no recibe mails".** Un cliente dado de baja
igual tiene derecho a su comprobante, y mandárselo no viola nada.
- `avisos_baja_en` ya se llama así. Que siga así: no le cambiamos el nombre a `mail_baja_en`
  ni nada parecido.
- La baja la revisa *quien programa un aviso automático* (como hoy hace `pidioLaBaja` en cada
  `reglas-*`), y el procesador antes de mandar. **Nunca `lib/mail.ts` ni `lib/kapso.ts`.**
- Los textos dicen "avisos automáticos": la confirmación de baja, la ficha y
  `SIN_AVISO_POR_BAJA`.
- Una prueba lo deja fijo: `enviarMail` a un cliente dado de baja sale igual.

Las tareas `API-n` son del repo `TP-IngeSoft-API` y las `FRONT-n` de este repo. Cada una es un PR.

---

## API-1 · Mandar un mail (Resend)
- `src/lib/mail.ts` con `enviarMail({ para, asunto, texto, html?, encabezados?, adjuntos? })`
  → id. Sobre la API HTTP de Resend, con timeout de 30 s y `httpStatus` en el error, como
  `gmail.ts`. `mailListo()` y `exigirMail()` (503 `mail_no_configurado`).
- Config: `RESEND_API_KEY`, `MAIL_REMITENTE` (en un dominio verificado). Se suman al
  `.env.example`.
- Se pasan a `mail.ts` los dos que lo usan hoy (el procesador y la landing) y se borra
  `gmail.ts`. `describirFallo` dice "Resend".
- Pruebas: con `espia.ts`, nunca contra Resend.

## API-2 · El canal y la baja en el cliente (migración) — hecho
Migración `083_canal_del_cliente.sql`, en la rama `avisos-por-mail` del front.
- `cliente.canal` (`whatsapp` o `email`, not null). Si no se dice al crearlo, un trigger
  elige: WhatsApp si tiene teléfono, mail si no tiene teléfono y sí mail. Los clientes que ya
  existían se completaron con la misma regla.
- `cliente.avisos_baja_via` (`whatsapp` o `mail`). Las bajas anteriores quedaron como
  `whatsapp`. La cuida el mismo trigger que `avisos_baja_en`, y revertir la borra.
- `baja_por_link`: **un link por mail mandado**, en lugar de un token por cliente. Se guarda
  sólo la huella (sha256). Usar cualquiera de los links de un cliente lo da de baja, y
  después ese link no hace nada más, así que no vuelve a dar de baja a alguien a quien el
  negocio se la revirtió.
- `cambiar_estado_con_notificacion` y `entregar_caso_con_seguimiento` aceptan un destino por
  mail.
- **`negocio_seguimiento.canal` no se borra todavía**: la API que está desplegada lo lee. Se
  borra en otra migración, después del deploy.

## API-3 · Programar por el canal del cliente — hecho
- Los cinco avisos salen por `cliente.canal` (`canalDe` en `preparar.ts`).
- Canal mail sin mail válido: no se programa. Los recordatorios dan el motivo
  `email_invalido`; el avance y el posventa, `email_seguimiento_invalido`.
- `PATCH /v1/clientes/:id` y el alta aceptan `canal`. **Se puede elegir mail sin tener mail
  cargado** (la historia 6 lo da por posible); el aviso no se programa, con su motivo.
- `PATCH /v1/negocio/seguimiento` ya no acepta `canal`: si llega, responde 422.

## API-4 · El procesador manda mails — hecho
- El pie del link de baja lo pone el procesador al mandar. Al programar, el mensaje queda sin
  pie, y a los mails viejos se les saca el que tenían. En la cola queda guardado el texto
  sin el link, porque el token es sólo del mail.
- `List-Unsubscribe: <{API_PUBLIC_URL}/v1/publico/baja/{token}>` y
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.
- `idempotencia: seguimiento-{id}`: aunque se reintente, Resend no lo manda dos veces.
- Si Resend está caído, no hay red o hay demasiados pedidos (sin estado HTTP, 429 o 5xx), el
  aviso vuelve a `pendiente` con el error anotado. Si Resend rechaza el mail en sí (otro
  4xx), queda `fallido`. Un error no corta el lote.
- **No hay una ventana horaria configurable.** Ni WhatsApp ni el mail la tienen: los avisos
  salen cuando llega su `enviar_en`. Si el criterio 3 la pide, es una tarea aparte.

## API-5 · La baja por link — hecho
- `GET` y `POST /v1/publico/baja/{token}`, sin sesión, con límite por IP. Un token que no
  existe o está mal escrito responde `{ sirve: false }`, sin datos.
- El POST da de baja con vía `mail`, lo anota en la ficha ("Pidió no recibir avisos") y
  cancela los avisos automáticos pendientes de ese cliente.
- Contestar BAJA por WhatsApp anota la vía `whatsapp`.

## API-6 · Contestar el turno por mail — hecho
- Migración 085: `turno_por_link`, con un link por recordatorio que se guarda con huella,
  y `turno.respuesta_cliente_via` (`whatsapp` o `mail`).
- Los botones son los mismos que tiene hoy el WhatsApp (082), «Confirmo» y «Cancelo»
  (no «No puedo»). «Cancelo» cancela el turno, y la página pide confirmarlo una vez.
- El mail trae "Para confirmar o cancelar, entrá acá: {link}". `GET` y
  `POST /v1/publico/turno/:token` (`{ respuesta }`). Un link contesta una sola vez, y sólo
  si el turno sigue en pie.
- La página es `/turno/[token]`. La agenda dice "Confirmó desde el mail" o "Canceló desde
  el mail".
- **Mail del negocio (084):** `negocio.email`, en Mi negocio. Va como «Responder a» en
  cada aviso por mail.

### Lo planeado
- `POST /v1/turno/{token}/confirmo` y `/no-puedo`: anotan lo mismo que la respuesta por
  WhatsApp (070). El token es uno por aviso y de un solo uso.

## FRONT-1 · El canal en la ficha del cliente — hecho
- No había cómo cargar el mail de un cliente: ni la API lo aceptaba ni la ficha lo mostraba.
  Ahora `PATCH /v1/clientes/:id` acepta `email` (vacío lo saca) y la ficha lo muestra y lo
  corrige, igual que el teléfono.
- El canal se elige con dos opciones que dicen a dónde llega cada una
  (`componentes/CanalDelCliente.js`). Si eligió mail y no tiene mail, se avisa al lado.
- La baja dice por dónde la pidió, y la conversación de un cliente de mail no ofrece
  contestar por WhatsApp.

### Lo planeado
- Elegir WhatsApp o mail, con una frase que explique qué significa: "Los avisos automáticos le
  llegan por acá. Uno solo, no los dos." Si elige mail y no hay mail cargado, se avisa al lado
  del campo.
- La baja muestra la fecha y la vía ("Se dio de baja desde el mail, el 3/11"). Se revierte
  como ya hace R-8.
- En un cliente de mail no aparece "Contestar" en la conversación.

## FRONT-2 · Recordatorios sin canal — hecho (además, el título pasa a "Recordatorios")
- Se saca el selector de `src/app/negocio/recordatorios/[tipo]/page.js` y `canal` de
  `cambiosDelRecordatorio`.
- Donde se dice cuándo le llega el aviso, se dice también por dónde: "por WhatsApp o por mail,
  según lo que elegiste en cada cliente".
- En el turno, si la anticipación es de menos de un día: "Por mail conviene avisar con un día:
  se lee más tarde."

## FRONT-3 · Páginas públicas de baja y de turno
- **`/baja/[token]` — hecho.** Pública en `Guardia.js`. Pide confirmar con un botón, y
  después dice "Listo, ya no te escribimos" (o "Ya estabas dado de baja" si se vuelve a
  abrir), con el nombre del negocio y las palabras de su rubro. Un link que no existe dice
  "Este link no sirve".
- `/turno/[token]`: hecho con API-6.
- **El mail también se carga al crear un cliente** (Clientes, Nuevo caso, Nuevo turno), y
  siempre es opcional. En Nuevo turno el teléfono también es opcional, así que un cliente
  con sólo mail arranca en mail.

### Lo planeado
- `/baja/[token]`: un botón "Darme de baja", que hace el POST. Así el antivirus que abre los
  links no da de baja a nadie. Después, la confirmación con las palabras del rubro. Sin
  sesión, y en los dos idiomas (docs/idioma-en-links-publicos.md).
- `/turno/[token]`: "Confirmo" o "No puedo", también con un botón. Lo que respondió, con las
  palabras del rubro.
