# WhatsApp Cloud staging validation report

Fecha: 2026-07-31  
Rama: `feature/migrate-evolution-to-whatsapp-cloud`  
Commit local probado: `1b7edbc`  
Estado de la fase: validacion local completada; validacion real de staging pendiente.

## Resumen

Este reporte documenta la ejecucion controlada posible desde el repositorio para la Fase 5 de WhatsApp Cloud API con Meta y n8n.

La sesion no dispone de acceso real a Meta for Developers, instancia n8n de staging, backend desplegado de staging, gestor de secretos ni Neon de staging. Por tanto, ningun paso externo se declara aprobado. Los pasos que requieren esos accesos quedan marcados como `NO EJECUTADO` y deben ejecutarse por un operador con credenciales de staging.

No se usaron credenciales reales, no se envio trafico a Meta, no se importaron workflows en n8n real, no se aplicaron migraciones en staging y no se envio informacion financiera a servicios externos.

## Entorno local validado

- Rama actual: `feature/migrate-evolution-to-whatsapp-cloud`.
- Working tree inicial: limpio.
- Commit probado localmente: `1b7edbc`.
- PWA/APK: sin cambios.
- `main`: no modificado desde esta sesion.
- Version n8n utilizada: `NO EJECUTADO` (sin acceso a instancia n8n).
- Version Graph API utilizada: `NO EJECUTADO` (sin credenciales Meta ni app de desarrollo configurada en esta sesion).
- Entorno desplegado: `NO EJECUTADO` (sin acceso a staging desplegado).

## Artefactos revisados

- `n8n/workflows/whatsapp-cloud/send-notification.staging.json`
- `n8n/workflows/whatsapp-cloud/inbound-message.staging.json`
- `n8n/workflows/whatsapp-cloud/message-status.staging.json`
- `n8n/workflows/whatsapp-cloud/README.md`
- `docs/whatsapp/staging-test-plan.md`
- `docs/whatsapp/meta-cloud-testing.md`
- `server/migrations/006_add_meta_cloud_channel_fields.sql`
- `server/migrations/007_communication_message_correlations.sql`

## Validaciones locales ejecutadas

| Validacion | Resultado |
|---|---|
| Rama obligatoria | `PASS` (`feature/migrate-evolution-to-whatsapp-cloud`) |
| Working tree inicial limpio | `PASS` |
| JSON de workflows parseable | `PASS` |
| Placeholders de credenciales en workflows | `PASS` (`REPLACE_WITH_CREDENTIAL_ID`, `REPLACE_WITH_STAGING_WEBHOOK_ID`) |
| Escaneo rapido de posibles secretos | `PASS` con falsos positivos documentales; no se encontraron tokens reales en workflows |
| Typecheck | `PASS` |
| Lint | `PASS` |
| Tests | `PASS` (155 archivos, 1936 tests pasados, 1 todo) |
| Build | `PASS` |

Nota: el build mantiene la advertencia existente de Vite sobre chunks mayores a 500 kB. No bloquea la fase y no esta relacionada con WhatsApp Cloud.

## Resultados de staging

| Paso | Resultado |
|---|---|
| Migraciones aplicadas en staging | `NO EJECUTADO` |
| Workflows importados en n8n staging | `NO EJECUTADO` |
| Correcciones realizadas a workflows en n8n | `NO EJECUTADO` |
| Exportaciones sanitizadas actualizadas tras importacion real | `NO EJECUTADO` |
| `GET /api/communication/whatsapp/health` en staging | `NO EJECUTADO` |
| `GET /api/communication/whatsapp/status` en staging | `NO EJECUTADO` |
| Autenticacion n8n -> backend | `NO EJECUTADO` |
| Autenticacion backend -> n8n | `NO EJECUTADO` |
| Verificacion GET Meta | `NO EJECUTADO` |
| Firma POST Meta | `NO EJECUTADO` |
| Primer mensaje entrante real | `NO EJECUTADO` |
| Reenvio entrante hacia n8n | `NO EJECUTADO` |
| Clasificacion de mensajes en n8n | `NO EJECUTADO` |
| Primer envio real con numero de prueba | `NO EJECUTADO` |
| ProviderMessageId recibido | `NO EJECUTADO` |
| Estados `sent`, `delivered`, `read`, `failed` | `NO EJECUTADO` |
| Plantilla Meta aprobada | `NO EJECUTADO` |
| Prueba de ventana de 24 horas | `NO EJECUTADO` |
| Idempotencia en staging real | `NO EJECUTADO` |
| Correlacion en Neon staging | `NO EJECUTADO` |
| Connect Meta | `NO EJECUTADO` |
| Status Meta | `NO EJECUTADO` |
| Disconnect Meta | `NO EJECUTADO` |
| Coexistencia de registros Evolution/meta-cloud en staging | `NO EJECUTADO` |
| Rollback manual a Evolution | `NO EJECUTADO` |

## Errores encontrados

No se encontraron errores locales de compilacion, lint, typecheck, tests, build ni parseo de workflows.

El unico bloqueo real de la Fase 5 es operativo: esta sesion no tiene acceso externo autorizado a Meta, n8n, Neon staging, gestor de secretos ni backend desplegado.

## Correcciones aplicadas

No se aplicaron correcciones de codigo ni de workflows. Se agrego este reporte para dejar trazabilidad de la validacion local y de los pasos pendientes.

## Riesgos pendientes

- Los workflows siguen siendo plantillas sanitizadas hasta que se importen y ejecuten en n8n real de staging.
- La compatibilidad exacta con la version real de n8n no esta validada.
- La verificacion de webhook Meta y la firma `X-Hub-Signature-256` no estan validadas contra trafico real.
- La idempotencia y correlacion estan cubiertas por tests automatizados, pero no por ejecucion real n8n -> backend -> Meta -> webhook.
- El modo `test` frente a `simulation` debe confirmarse durante la validacion real antes de habilitar envio controlado.
- No se debe avanzar a produccion ni migrar el numero real hasta completar staging.

## Deuda tecnica

- `server/communicationChannelStore.ts` permanece identificado como codigo legado o desalineado con el esquema real. No se uso para persistencia Meta, no se modifico y no debe eliminarse hasta una retirada controlada.
- Las exportaciones n8n deben reexportarse desde la instancia real una vez validadas y volver al repositorio en formato sanitizado.

## Procedimiento pendiente para completar Fase 5

1. Desplegar backend en staging con secretos gestionados, nunca en el repositorio.
2. Aplicar `006_add_meta_cloud_channel_fields.sql` y `007_communication_message_correlations.sql` en base de staging con snapshot previo.
3. Importar los tres workflows en n8n staging, mantenerlos inicialmente desactivados y asignar credenciales administradas.
4. Ejecutar validacion de health/status y autenticacion en modo simulacion.
5. Configurar app Meta de desarrollo, numero de prueba, destinatario autorizado, verify token y webhook.
6. Validar GET del webhook y firma POST con fixtures y trafico real.
7. Validar mensaje entrante real, reenvio a n8n, estados, plantilla, idempotencia y correlacion.
8. Ejecutar un unico envio real controlado con `WHATSAPP_CLOUD_ALLOW_REAL_SEND=true` solo en staging y volver a `false` al terminar.
9. Probar connect/status/disconnect, coexistencia con Evolution y rollback manual.
10. Reexportar workflows sanitizados, actualizar este reporte con evidencias y ejecutar regresion completa.

## Confirmaciones

- Evolution operativo: `PENDIENTE DE VALIDACION REAL` en staging; no fue modificado localmente.
- PWA/APK sin cambios: `CONFIRMADO`.
- `main` intacta: `CONFIRMADO` para esta sesion; no se hizo merge ni push forzado.
- Ausencia de secretos en cambios realizados: `CONFIRMADO`; este reporte no contiene valores reales.
- Preparacion para Fase 6: `NO LISTA`; primero debe completarse Fase 5 real con evidencias sanitizadas.
