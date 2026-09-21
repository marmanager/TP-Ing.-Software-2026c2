# Trazabilidad de criterios de aceptación — Sprint actual

Revisión realizada sobre la rama `development`. Las pruebas WebdriverIO usan
un fixture aislado porque el modo demo de esta rama comienza vacío.

| Historia | Estado encontrado | Jest | WebdriverIO |
|---|---|---|---|
| Foto de perfil | **PARCIAL / ambigua.** Existe foto de la ficha del negocio (`/negocio`), no una foto personal por usuario. | `foto-negocio.test.js` | `foto-perfil.e2e.js` prueba lo existente y deja omitidos los criterios personales. |
| Marcar consulta completada | **IMPLEMENTADA.** Se puede entregar y cerrar cualquier caso abierto, registrar cobro, persistirlo y volver a abrirlo. | `marcar-consulta-completada.test.js` | `marcar-consulta-completada.e2e.js` |
| Historial de eventos | **IMPLEMENTADA.** Hay historial global, filtros por período/tipo, agrupación por fecha, caso/cliente y montos aprobados por ítem. | `historial-eventos.test.js` | `historial-eventos.e2e.js` |
| Historial completo del cliente | **IMPLEMENTADA.** La ficha lista todos sus casos ordenados, estado, servicio, fecha y cobro; contempla cliente sin antecedentes. | Cubierta por las reglas existentes de estados; el flujo completo se verifica en navegador. | `historial-cliente.e2e.js` |
| Compartir estado con el cliente | **IMPLEMENTADA.** Genera/revoca un link público sin cuenta, muestra estado, línea de tiempo y sólo ítems aprobados. | `compartir-estado-cliente.test.js` | `compartir-estado-cliente.e2e.js` |
| Asignar trabajo a colaborador | **PARCIAL.** Funciona la asignación inicial, la reasignación desde el detalle y sus eventos. Falta el estado activo/inactivo de colaboradores. | `asignar-trabajo-colaborador.test.js` | `asignar-trabajo-colaborador.e2e.js` |
| Sistema de presets | **PARCIAL.** Los presets existentes se aplican, persisten y quedan fijos desde el primer caso. Falta “Sin preset” y la configuración manual. | `sistema-presets.test.js` | `sistema-presets.e2e.js` |

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
