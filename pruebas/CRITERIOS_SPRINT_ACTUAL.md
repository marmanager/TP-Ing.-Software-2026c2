# Trazabilidad de criterios de aceptación — Sprint actual

Revisión realizada sobre la rama `development`. Las pruebas WebdriverIO usan
un fixture aislado porque el modo demo de esta rama comienza vacío.

| Historia | Estado encontrado | Jest | WebdriverIO |
|---|---|---|---|
| Foto de perfil | **PARCIAL / ambigua.** Existe foto de la ficha del negocio (`/negocio`), no una foto personal por usuario. | `foto-negocio.test.js` | `foto-perfil.e2e.js` prueba lo existente y deja omitidos los criterios personales. |
| Marcar consulta completada | **IMPLEMENTADA.** Se puede entregar y cerrar cualquier caso abierto, registrar cobro, persistirlo y volver a abrirlo. | `marcar-consulta-completada.test.js` | `marcar-consulta-completada.e2e.js` |
| Historial de eventos | **IMPLEMENTADA.** Hay historial global, filtros por período/tipo, agrupación por fecha, caso/cliente y montos aprobados por ítem. | `historial-eventos.test.js` | `historial-eventos.e2e.js` |
| Historial completo del cliente | **IMPLEMENTADA.** La ficha lista todos sus casos ordenados, estado, servicio, fecha y cobro; contempla cliente sin antecedentes. | Cubierta por las reglas existentes de estados; el flujo completo se verifica en navegador. | `historial-cliente.e2e.js` |
| Compartir estado con el cliente | **IMPLEMENTADA.** Genera/revoca un link público sin cuenta, muestra estado, línea de tiempo y sólo ítems aprobados. | (lo recorta la API: `ver_seguimiento()`) | `compartir-estado-cliente.e2e.js` |
| Asignar trabajo a colaborador | **PARCIAL.** Funciona la asignación inicial, la reasignación desde el detalle y sus eventos. Falta el estado activo/inactivo de colaboradores. | `asignar-trabajo-colaborador.test.js` | `asignar-trabajo-colaborador.e2e.js` |
| Sistema de presets | **PARCIAL.** Los presets existentes se aplican, persisten y quedan fijos desde el primer caso. Falta “Sin preset” y la configuración manual. | `sistema-presets.test.js` | `sistema-presets.e2e.js` |
| Anotar cuándo le toca volver (R-1b, Recordatorios) | **IMPLEMENTADA.** La entrega va en dos pasos (el cobro, y después cuándo vuelve y el seguimiento) para no pasar los seis campos por pantalla de la cartilla; se envía todo junto al final. Al entregar se ofrece la fecha con el intervalo del rubro (taller 6 meses, medicina 12; service y personalizable sin intervalo); vacía entrega igual; una fecha pasada apaga el botón con su motivo; se corrige desde el caso cerrado y la ficha del cliente muestra la próxima. En un rubro sin intervalo, con tres visitas parejas se sugiere la fecha sin cargarla. El criterio 11 (modo sin credenciales) quedó sin objeto: el modo de ejemplo se sacó; se cubre con la cuenta sembrada. Necesita la API con R-1a (migración 048). | `recordatorios-volver.test.js` | `recordatorios-volver.e2e.js` (pasa contra la API local con R-1a) |
| Recordarle el turno al cliente (R-4b, Recordatorios) | **PARCIAL.** En Mi negocio hay una tarjeta con los dos recordatorios y su pantalla, `/negocio/recordatorios` (como Horarios y Módulos: los dos juntos son los seis campos de la cartilla y Mi negocio ya tiene su botón azul). Cada uno se prende por separado y se guarda sólo lo que cambió; el de turnos en horas y el posventa en días, cada uno con su frase de cuándo sale y con la palabra del rubro (en medicina, "consulta"); el texto viene sugerido por la API según el rubro; vacío, el botón se apaga y dice por qué. Con la agenda apagada, el de turnos no aparece. En la agenda, cada turno dice cuándo le llega el aviso, si salió o si falló (con una frase que dice qué hacer, nunca el error del proveedor) y, si falta el teléfono, ofrece completarlo; se le puede cambiar la hora y el aviso muestra la fecha nueva. **Falta en la API:** que el listado de turnos traiga el último aviso de cada uno; sin eso, "enviado" y "fallido" (AC8, AC9) no llegan al front y lo programado se deja de ver al recargar (pedido como seguimiento de R-4a). El criterio 13 (modo sin credenciales) quedó sin objeto, como en R-1b: se cubre con la cuenta sembrada. Necesita la API con R-4a (migración 050). | `recordatorio-turno.test.js` | `recordatorio-turno.e2e.js`: AC1–6, AC10 y AC12 pasan contra la API local de R-4a; AC7 y AC11 necesitan el número de WhatsApp configurado en la API (sin él contesta `whatsapp_no_configurado`) |

## Funcionalidades que todavía faltan

1. Foto personal de cada usuario, si “Foto de perfil” se refiere a la persona y no al negocio.
2. Marcar colaboradores como activos/inactivos y excluir los inactivos al asignar.
3. Ofrecer “Sin preset” al crear el negocio.
4. Permitir configurar y persistir manualmente estados, roles, ejemplos, identificador y módulos.
5. Permitir editar esa configuración antes del primer caso y bloquearla después.

## Controles que requieren integración real

El modo demo actúa como dueño y contiene un solo negocio. El aislamiento entre
negocios, las restricciones por rol y las políticas RLS deben ejecutarse contra
un proyecto Supabase de pruebas; no se pueden corroborar de punta a punta sólo
con `localStorage`.

## Ejecución

- Todas las pruebas unitarias con Jest: `npm test`
- Modo observación de Jest: `npm run test:watch`
- E2E de todas las historias: `npm run test:e2e`
- Un archivo E2E: `npx wdio run ./wdio.conf.js --spec ./pruebas/e2e/historias/<archivo>.e2e.js`
