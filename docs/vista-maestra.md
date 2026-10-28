# Vista maestra — diseño

Estado: **borrador, en preguntas** (rama `vista-maestra`).
Fecha: 28 de octubre de 2026.

## La historia

> "Tengo 5 negocios y no quiero entrar a cada uno para ver qué está pasando.
> Quiero ver todo al mismo tiempo."

Hoy, para mirar cinco negocios hay que entrar a cada uno desde Mi perfil
(`entrar_al_negocio`), o visitar sedes vinculadas de a una (`entrar_de_visita`).
La vista maestra pone todos los negocios de la cuenta **a un toque**, **estén
vinculados en una red de sedes o no**, y en **sólo lectura**.

## Qué se pidió

### Entrar

- Un botón **"Vista maestra"** en Mi perfil, arriba a la derecha, alineado con el
  título grande "Mi perfil" (`<h1>` de `src/app/perfil/page.js`).
- Estando ya en vista maestra, ese botón queda **apagado** y dice *"Ya estás en
  vista maestra"* (cartilla: un botón apagado dice por qué).

### Toda la aplicación, un negocio a la vez

- En vista maestra **se accede a todo**: cada sección de la barra (Inicio,
  Casos, Agenda, Clientes, Inventario, Tablero…) funciona igual que siempre,
  pero **sin poder cambiar nada**.
- No se suman ni se mezclan negocios: se mira **uno a la vez** y se cambia de
  uno a otro al instante.

### El selector de la derecha

- Una **pseudo barra lateral a la derecha**: flotante, centrada en alto (no
  llega ni arriba ni al fondo), con **la foto (o ícono de local) y el nombre**
  de cada negocio, para saber bien cuál es cuál.
- Tocar un negocio lo elige (**uno solo a la vez**) y la pantalla en la que se
  está cambia a ese negocio, sin moverse de sección.

### La barra lateral de la izquierda

- Donde hoy van la foto y el nombre del negocio activo (`Navegacion.js`,
  encabezado de la barra), dice **"Vista maestra"**.
- A la derecha de "Vista maestra", una **flechita** que despliega **qué
  negocios aparecen en el selector de la derecha**: un interruptor por negocio y
  los **grupos**.
- El botón del pie **"Mi negocio"** pasa a ser **"Salir de vista"** y se
  intercambia de lugar con "Mi perfil", así que queda **abajo de todo**.

### Grupos: etiquetas libres

- Se crean grupos con nombre ("Celulares", "Zona sur").
- Un negocio puede estar en **varios** grupos.
- Tocar un grupo prende o apaga todos sus negocios en el selector, así no hay
  que apagar 5 del mismo rubro de a uno.

### Quién

- **Cualquier cuenta con más de un negocio**, con el rol que tiene en cada uno:
  en cada negocio ve sólo lo que su rol ve ahí, como en la visita entre sedes.

## Cómo encaja con lo que hay

- **El negocio activo vive en `usuario.negocio_id`** y toda la RLS cuelga de
  `mi_negocio()` (docs/multinegocio.md, decisión 1).
- **Ya existe un modo de sólo lectura que hace casi esto**: la visita a sedes
  (`entrar_de_visita`, `usuario.visitando_desde`, `FranjaDeVisita.js`,
  docs/roles.md "Visitas entre sedes"). Mueve `negocio_id` a la sede visitada y
  ningún permiso de *cambiar* vale. La vista maestra es lo mismo pero entre los
  negocios **propios**, sin pedir que estén en la misma red, y con un selector
  para saltar entre ellos.
- **Las pantallas ya esconden lo que el rol no puede** (`puede()` de
  `permisos.js`). En vista maestra "puede cambiar" es siempre no, así que los
  botones de editar desaparecen solos.

## Sobre "cargar sólo los GET"

Tiene razón en que no hay que cargar de más, con un matiz: el navegador no
"carga" los POST, son llamadas que sólo salen al tocar Guardar. Lo que sí se
ahorra en sólo lectura es **lo que se pide únicamente para editar**: las listas
para los desplegables (equipo para asignar, estados, insumos para elegir),
borradores, formularios. La primera versión reutiliza los GET de cada pantalla tal
cual; dejar de pedir lo que es sólo para editar se hace después, si al medir
el salto entre negocios se nota lento.

## Opinión: ¿sólo lectura? Sí.

1. **Seguridad simple.** Nada escribe fuera del negocio activo; las políticas y
   `mi_negocio()` no se tocan. La base rechaza cualquier cambio en vista
   maestra, igual que en una visita: **falla cerrado**.
2. **No hay ambigüedad de "¿a qué negocio va esto?"**.
3. **Para actuar, un atajo**: "Editar en este negocio" sale de la vista maestra
   y entra a ese negocio (`entrar_al_negocio`).

## Cuidados que salen del código

- **Permisos por negocio.** Dueño en uno, técnico en otro: en cada negocio, lo
  que su rol ve ahí.
- **Vista maestra con un solo negocio** no tiene sentido: el botón se apaga y
  dice *"Hace falta más de un negocio"*.
- **Modo de ejemplo** ("Probá sin cuenta"): sin vista maestra, como con
  multinegocio.
- **Otro dispositivo**: ver decisión 1.
- **La visita entre sedes y la vista maestra no se mezclan**: entrar a vista
  maestra desde una visita termina la visita (y "Salir de vista" vuelve a la
  sede propia). Estando en vista maestra no se entra de visita: la base lo
  rechaza con *"Salí de la vista maestra para visitar otra sede."*.
- **Mi perfil también es de sólo lectura en vista maestra**: guardar el nombre
  escribe en la ficha del equipo. Los campos quedan apagados con *"Salí de la
  vista maestra para cambiar tus datos."*. El tema y el idioma, que son del
  navegador, siguen andando.
- **El bloqueo es en tres capas**: la base frena cualquier escritura con un
  trigger en cada tabla (falla cerrado, también dentro de las funciones
  `security definer`); la API corta los pedidos que no son GET antes de hacer
  nada (así no manda un WhatsApp o un mail que después la base no deja
  guardar); y el front no muestra los botones, porque `puede()` da no.
- **Google Calendar**: el sincronizador ya tolera estar parado en otra sucursal
  (plan de multinegocio, punto 3). Revisar que la vista maestra no lo
  desconecte.

## Decisiones (Q&A)

**1. Cambiar de negocio es como la visita.** Cada toque en el selector mueve
`usuario.negocio_id` al negocio elegido (una función tipo `entrar_de_visita`,
que verifica que la cuenta tenga ficha ahí) y deja la marca
`usuario.vista_maestra_desde = <negocio de antes>`. Con la marca puesta, la base
rechaza todo cambio. Pantallas, API y RLS sirven sin tocarlas.

*Qué significa "por cuenta":* la vista maestra es de la cuenta, para todos los
negocios donde participa — eso es lo que se quiere. La contracara es la misma
que ya aceptó multinegocio: el negocio que se está mirando también es uno solo
por cuenta. Si la compu quedó abierta en "Centro" y desde el celular se entra a
vista maestra y se elige "Sur", al volver a la pestaña de la compu aparece
*"Desde otro dispositivo pasaste a Sur"* con **Recargar**, y mientras tanto la
base no deja guardar nada en "Centro" desde esa pestaña. Nunca mezcla negocios.

**2. "Salir de vista" vuelve al negocio de antes** (`vista_maestra_desde`, con
`entrar_al_negocio`), como "Volver a tu sede" de la visita. Si ya no se tiene
ficha ahí, al selector `/negocios`.

**3. En el celular, el selector es una tira arriba**, horizontal, con foto y
nombre, que se desliza de costado.

**4. Entran en esta versión:**
- **Puntito de urgente** en cada negocio del selector (casos atrasados, stock
  bajo, turnos sin confirmar). Lo acerca a "ver todo al mismo tiempo" sin
  mezclar datos. Necesita una lectura nueva que mire todos los negocios de la
  cuenta a la vez (ver preguntas).
- **Franja de sólo lectura** arriba: *"Vista maestra · sólo lectura ·
  {negocio}"*, la misma idea que `FranjaDeVisita`.
- **"Editar en este negocio"**: sale de la vista maestra y entra a ese negocio
  (`entrar_al_negocio`).
- **Recordar en la cuenta** qué negocios y grupos están prendidos (base, como
  el predeterminado de multinegocio): igual en todos los dispositivos.

**5. Atajos de teclado: Alt + número.** Alt+1 elige el primer negocio del
selector, Alt+2 el segundo, y así hasta Alt+9 (cuentan sólo los prendidos, en
el orden del selector). Se escucha `event.code` (`Digit1`…`Digit9`), no la
tecla escrita, para que ande igual con cualquier distribución de teclado y en
la Mac con Option (que con `event.key` daría `¡`, `™`…). Cada negocio del
selector muestra su número al pasar el mouse (*"Alt+2"*), para que el atajo se
descubra. Sólo en vista maestra; fuera de ella no hace nada.

## Sugerencias que quedan para después

- **Precargar** el negocio siguiente para que el salto sea instantáneo, si
  medido hace falta.

**6. Urgente = casos atrasados o stock bajo.** El puntito se prende si el
negocio tiene alguno de estos:

- **Caso atrasado**: no está completado y hace **14 días** que no tiene avance
  (ni cambio en el caso, ni en sus pasos, ni en su historial). **No cuenta**
  si se está esperando a un tercero: el caso está en *Esperando* (una pieza,
  el proveedor) o tiene un paso del presupuesto que el cliente todavía no
  aprobó. Los casos no tienen fecha prometida en la base, por eso se mide el
  avance.
- **Stock bajo**: un producto en stock con cantidad 0 o menor o igual a su
  mínimo, la misma regla que el tablero (`estadisticas-inventario.ts`).

 Lo calcula una función de la base,
`urgencias_de_mis_negocios()` (`security definer`, como `mis_negocios()`), que
recorre sólo los negocios donde la cuenta tiene ficha y sólo cuenta lo que su
rol ve ahí: si en un negocio no ve inventario, el stock bajo de ése no cuenta.
Devuelve, por negocio, cuántos de cada cosa, y el selector lo dice con color,
ícono y palabra al pasar el mouse (*"2 casos atrasados · 1 con stock bajo"*).

**7. Los grupos se crean y editan en el desplegable de la flechita**, donde se
usan: *"+ Nuevo grupo"*, renombrar, borrar, y en cada negocio qué etiquetas
tiene. Mi perfil no los muestra.

**8. El orden del selector se arma arrastrando** en el desplegable, y queda
guardado en la cuenta. Así Alt+1 es siempre el que uno eligió, y sumar un
negocio no corre los números (el nuevo va al final). Arrastrar no alcanza para
quien usa teclado o lector de pantalla: cada fila tiene también **Subir** y
**Bajar**.

**9. El negocio que se está mirando no se puede apagar.** Su interruptor queda
apagado y dice *"Estás mirándolo"*. Para sacarlo del selector, primero se elige
otro. Lo mismo al apagar un grupo que lo incluye: se apagan los demás y ése
queda prendido, con el mismo motivo.

## Lo que se guarda en la base

Todo por funciones, nada escrito desde el navegador (regla de la 035):

- `usuario.vista_maestra_desde uuid` — el negocio al que vuelve "Salir de
  vista". Nulo = no se está en vista maestra.
- `grupo_de_negocios (id, usuario_id, nombre)` y `grupo_negocio (grupo_id,
  negocio_id)` — las etiquetas de cada cuenta. Un negocio sólo entra si la
  cuenta tiene ficha ahí.
- `vista_maestra_negocio (usuario_id, negocio_id, prendido, orden)` — qué se ve
  en el selector y en qué orden.
- Funciones: `entrar_a_vista_maestra()`, `mirar_en_vista_maestra(p_negocio)`,
  `salir_de_vista_maestra()`, `mi_vista_maestra()` (lo que muestra el
  desplegable), `guardar_negocios_de_vista_maestra(p_negocios)` (prendidos y
  orden), `guardar_grupo_de_negocios(p_grupo, p_nombre, p_negocios)`,
  `borrar_grupo_de_negocios(p_grupo)` y `urgencias_de_mis_negocios()`.
- `en_vista_maestra()`, y con ella `permisos_efectivos()` deja sólo los de
  mirar y `mis_permisos()` dice `es_duenio = false`.

## Preguntas abiertas

Ninguna por ahora. Lo que salga al escribir el plan se agrega acá.

## Qué queda afuera (por ahora)

- Hacer cambios desde la vista maestra.
- Sumar o comparar números de varios negocios en una misma pantalla.
