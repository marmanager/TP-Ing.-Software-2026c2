# Asistencia local sin API

Esta primera versión es una demostración local, determinista y basada en reglas. No usa OpenAI ni otro servicio de inteligencia artificial, no agrega claves y no envía textos o datos del negocio fuera del navegador.

## Separación

- `src/lib/asistente/contratos.js` define la respuesta común: `estado`, `propuesta`, `explicacion`, `suposiciones` y `preguntas`.
- `src/lib/asistente/local.js` implementa el proveedor local con funciones puras. Sólo lee entradas y devuelve propuestas estructuradas.
- `src/lib/asistente/index.js` es la fachada pública. Las pantallas y componentes importan únicamente esta fachada.
- `src/componentes/asistente/` contiene la presentación y las confirmaciones. El proveedor no conoce React ni las acciones de datos.

Los estados posibles son `listo`, `falta_informacion` y `no_entendido`. No se calcula un porcentaje de confianza: si una regla no alcanza, se informa qué falta o que el patrón no es compatible.

## Límite de seguridad

El proveedor nunca cambia módulos, Inicio, casos, pasos, inventario, turnos, estados, dinero ni mensajes. Las propuestas se revisan en pantalla y las mutaciones continúan pasando por las acciones existentes de `useDatos`:

- módulos e Inicio requieren una segunda confirmación;
- el alta asistida sólo completa el formulario y no guarda el caso;
- los mensajes, resúmenes y pasos son borradores editables;
- las ecuaciones propuestas se abren en el editor y pasan por `nuevaEcuacion`;
- Agenda e Inventario reciben datos en sus formularios normales y conservan su botón Guardar;
- las consultas del Inicio sólo enlazan a datos reales.

No se persisten conversaciones ni los textos libres del asistente.

## Patrones cubiertos

El recomendador reconoce turnos, inventario, aprobaciones, equipo, ecuaciones, estadísticas y varias sedes. El alta de casos extrae datos explícitos y sólo asigna responsables con una coincidencia única. Las ecuaciones locales cubren precio por materiales/horas, superficie por ancho/alto y pintura por rendimiento. Las consultas del Inicio son intenciones cerradas; no son un chat abierto.

## Reemplazo futuro por un proveedor remoto

Un proveedor remoto debe implementar el mismo contrato detrás de `src/lib/asistente/index.js`. La llamada debe ejecutarse del lado del servidor, con autenticación y autorización verificadas allí. La clave nunca debe usar `NEXT_PUBLIC_*` ni llegar al cliente.

Antes de enviar datos, el servidor deberá limitar el contexto a los campos necesarios, aplicar retención y registro acordes a la política del producto y volver a validar toda propuesta con las reglas locales. Las pantallas no deberían cambiar: seguirán mostrando una propuesta, pidiendo confirmación y ejecutando las acciones existentes. El proveedor remoto tampoco tendrá acceso directo a las mutaciones.

