# Workflows n8n — WhatsApp Cloud API (staging)

> Fase 4 de la migración `feature/migrate-evolution-to-whatsapp-cloud`.
> Estos archivos son plantillas de exportación **sanitizadas**, escritas a
> mano para este repositorio. Esta sesión no tuvo acceso a una instancia real
> de n8n (a diferencia de la auditoría de la Fase 1, hecha vía MCP con acceso
> de solo lectura) — **no fueron importadas ni probadas contra un n8n real**.
> Un operador con acceso a n8n debe revisarlas, importarlas manualmente y
> validarlas en staging antes de activarlas.

## Propósito

| Archivo | Sustituye/complementa | Webhook (staging) |
|---|---|---|
| `send-notification.staging.json` | Punto de partida para migrar el envío que hoy hace **Private Balance - Nuevo Ingreso** hacia Evolution | `POST /webhook/pb-whatsapp-cloud-send-staging` |
| `inbound-message.staging.json` | Nuevo — no existe equivalente en Evolution dentro de este repositorio | `POST /webhook/pb-whatsapp-cloud-inbound-staging` |
| `message-status.staging.json` | Nuevo — Evolution reporta esto a `evolution-whatsapp-status`, con otro contrato | `POST /webhook/pb-whatsapp-cloud-status-staging` |

Ninguno de los tres sustituye ni modifica los workflows de producción
existentes (**01 Device Provisioning**, **02 WhatsApp Management**,
**03 WhatsApp Status**, **Nuevo Ingreso**, ver
`docs/04_N8N_WORKFLOWS.md`). Son workflows nuevos, independientes, activos
solo mientras se prueba la integración.

## Variables de entorno de n8n

Estos workflows leen `{{ $env.PRIVATE_BALANCE_COMMUNICATION_BASE_URL }}`
(la URL base de este backend, p. ej. `https://private-balance.orpira.es`) —
configúrala como variable de entorno de la instancia de n8n, nunca como
texto embebido en el nodo.

## Credenciales (por nombre, nunca embebidas)

| Nombre lógico de credencial | Tipo n8n | Usada en |
|---|---|---|
| `Private Balance Communication Backend (staging)` | Header Auth (`Authorization: Bearer <N8N_COMMUNICATION_API_KEY de staging>`) | Nodos HTTP Request de los 3 workflows hacia `/api/communication/whatsapp/*` |
| `PB WhatsApp Forward Auth Token (staging)` | Header Auth (`Authorization: Bearer <N8N_WHATSAPP_FORWARD_AUTH_TOKEN de staging>`) | Autenticación del propio webhook de n8n en `inbound-message.staging.json` y `message-status.staging.json` |

Ninguno de los 3 JSON contiene el valor real de estas credenciales, ninguna
URL de producción, ni ningún número de teléfono real — los campos
`credentials.*.id` llevan el placeholder `REPLACE_WITH_CREDENTIAL_ID` y los
`webhookId` llevan `REPLACE_WITH_STAGING_WEBHOOK_ID`; n8n los completa al
importar/activar.

## Importación

1. En n8n: **Workflows → Import from File** y seleccionar el JSON.
2. Crear (o reutilizar) las dos credenciales de la tabla anterior con los
   valores reales de **staging** (nunca de producción).
3. Asignar la credencial correspondiente a cada nodo HTTP Request / Webhook
   que quedó con `REPLACE_WITH_CREDENTIAL_ID`.
4. Copiar el `webhookId` que n8n asigna al activar el workflow si se
   necesita referenciarlo desde fuera.
5. **No activar** el workflow todavía — revisar primero la sección
   "Pruebas" de `docs/whatsapp/staging-test-plan.md`.

## Activación

Requiere en el backend (Vercel, entorno de staging/preview, nunca
producción):

```env
WHATSAPP_PROVIDER=meta-cloud
WHATSAPP_CLOUD_ENABLED=true
WHATSAPP_CLOUD_ALLOW_REAL_SEND=false
WHATSAPP_CLOUD_WEBHOOK_ENABLED=true
WHATSAPP_CLOUD_FORWARD_INBOUND_TO_N8N=true
WHATSAPP_CLOUD_FORWARD_STATUS_TO_N8N=true
N8N_WHATSAPP_INBOUND_WEBHOOK_URL=https://<tu-n8n-staging>/webhook/pb-whatsapp-cloud-inbound-staging
N8N_WHATSAPP_STATUS_WEBHOOK_URL=https://<tu-n8n-staging>/webhook/pb-whatsapp-cloud-status-staging
N8N_WHATSAPP_FORWARD_AUTH_TOKEN=<mismo valor que la credencial de staging>
```

Ver `docs/whatsapp/staging-test-plan.md` para la secuencia completa de
pruebas antes de activar `WHATSAPP_CLOUD_ALLOW_REAL_SEND=true`.

## Rollback

Ninguno de estos workflows toca `WHATSAPP_PROVIDER`. Volver a Evolution es
un cambio de una sola variable en el backend
(`WHATSAPP_PROVIDER=evolution`), sin desactivar ni modificar estos
workflows de staging — pueden quedar inactivos o activos sin efecto,
porque n8n seguirá enviando los eventos financieros al webhook de
Evolution de siempre (`N8N_AUTOMATION_WEBHOOK_URL`) mientras
`WHATSAPP_PROVIDER=evolution`. Ver
`docs/whatsapp/provider-routing.md`.

## Diferencias staging / producción

- Staging: `WHATSAPP_CLOUD_ALLOW_REAL_SEND=false` (modo simulación),
  destinatario de prueba explícito (`WHATSAPP_CLOUD_TEST_RECIPIENT`, solo en
  variables de entorno de staging, nunca en este repositorio), plantilla de
  prueba sin aprobar en Meta.
- Producción: fuera del alcance de esta fase. Requiere el número de
  producción migrado (fase posterior, explícitamente no autorizada todavía),
  plantillas aprobadas por Meta, y activar estos workflows (o sus
  equivalentes de producción) con `WHATSAPP_CLOUD_ALLOW_REAL_SEND=true`.

## Pruebas

Ver [`docs/whatsapp/staging-test-plan.md`](../../../docs/whatsapp/staging-test-plan.md).
