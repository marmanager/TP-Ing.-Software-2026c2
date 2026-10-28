# Idioma en los links públicos

Decisión de diseño del 2026-10-28. Implementada. Modifica lo que decía
docs/idiomas.md sobre el selector en las pantallas públicas.

## Qué cambia

- **Se saca el selector de idioma** de "Pedir turno" (`/turnos/[codigo]`) y de
  la landing de cada negocio (`/n/[codigo]`).
- **El idioma lo trae el link.** Al armar el link para compartir (la agenda en
  "Cuándo atendés" y la landing en su editor), se le agrega `?idioma=es` o
  `?idioma=en`, según el idioma que quien lo arma tiene elegido en **Mi perfil**.
- **Quien abre el link ve la pantalla en ese idioma**, sin tocar nada.

## Por qué

- Quien pide un turno vino a elegir un día y una hora. Un selector de idioma
  debajo del calendario es ruido en la pantalla más importante para el cliente.
- El negocio sabe en qué idioma le habla a su gente. Si reparte el link en
  inglés, el cliente lo recibe en inglés; hoy tenía que adivinar el selector.
- Un solo lugar para decidir el idioma al compartir (Mi perfil), en vez de uno
  por pantalla pública.

## Cómo funciona

1. `LinkCompartido` arma `origen + ruta + código + "?idioma=" + idioma`, con el
   `idioma` de `useIdioma()` (el de Mi perfil de quien está logueado). Lo usan
   los dos links; el mensaje de WhatsApp también sale con el parámetro.
2. `src/proxy.js` corre sólo en `/turnos/:codigo` y `/n/:codigo`. Si trae
   `?idioma=es|en`, guarda la cookie `idioma` y redirige a la misma dirección
   sin el parámetro. El layout raíz ya lee esa cookie, así que la primera
   pantalla sale en el idioma bueno, sin saltar.
3. Un valor que no es `es` ni `en` se ignora. Sin parámetro, sigue el orden de
   siempre: cookie → idioma del navegador → castellano.

## Decisiones y costos

- **Se revierte "Sin `proxy.js`"** de docs/idiomas.md. Hace falta porque el
  layout no puede leer la dirección y decidir en el navegador mostraría
  castellano y saltaría a inglés. El proxy se limita a esas dos rutas.
- **Sin prefijo `/en/` en la dirección**, igual que antes: el idioma va como
  parámetro y se limpia.
- **El idioma queda en la cookie del cliente.** Si después abre su seguimiento
  en el mismo aparato, lo ve en ese idioma. Es lo esperado: es el idioma en que
  el negocio le habló.
- **Los links ya repartidos** (sin parámetro) siguen andando: caen al idioma del
  navegador. Se actualizan solos al volver a copiarlos desde el editor.
- **El cliente ya no puede cambiar el idioma** en estas dos pantallas. Si
  entra a un link en inglés y lo quiere en castellano, no tiene cómo. Queda
  asumido: lo resuelve pedirle al negocio otro link. Si molesta, se vuelve a
  poner el selector sólo ahí.
- **Sin cambios** en `/seguimiento/[codigo]`, iniciar sesión, crear cuenta y
  `/bienvenida`: conservan su selector.
- El idioma de Mi perfil sigue siendo de este aparato (cookie), no de la cuenta:
  el link sale en el idioma con que se está mirando la app al copiarlo.
