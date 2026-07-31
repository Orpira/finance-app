# Contratos actuales con n8n

> Documento de referencia para la Fase 2 (Abstracción) de la migración
> `feature/migrate-evolution-to-whatsapp-cloud`. Describe exactamente lo que
> este backend (`api/` + `server/automation/*`) envía y espera de n8n hoy, sin
> modificar ningún workflow. Sirve como contrato de compatibilidad: mientras
> n8n siga respondiendo así, cualquier proveedor de WhatsApp (Evolution o,
> más adelante, el Backend Comunicaciones con Meta Cloud API) puede
> sustituirse detrás de esta interfaz sin romper nada.

## Rutas y autenticación

Todas las llamadas salen desde `server/automation/webhookDispatcher.ts`
(`dispatchWebhook`), invocado hoy directamente para eventos no-WhatsApp y, a
partir de la Fase 2, a través de `EvolutionWhatsAppProvider.dispatchChannelEvent`
para los eventos de canal WhatsApp (mismo código, sin cambios de comportamiento).

| Variable de entorno | URL de ejemplo | Workflow consumidor |
|---|---|---|
| `N8N_AUTOMATION_WEBHOOK_URL` | `https://n8n.orpira.es/webhook/private-balance` | Private Balance - Nuevo Ingreso |
| `N8N_DEVICE_PROVISIONING_WEBHOOK_URL` | `https://n8n.orpira.es/webhook/private-balance-device` | Private Balance - 01 Device Provisioning |
| `N8N_WHATSAPP_WEBHOOK_URL` | `https://n8n.orpira.es/webhook/private-balance-whatsapp` | Private Balance - 02 WhatsApp Management |

- **Método:** `POST` en las tres rutas.
- **Autenticación:** header `Authorization: Bearer <N8N_INTERNAL_TOKEN>`
  (token estático rotable, solo servidor).
- **Idempotencia:** headers `Idempotency-Key` y `X-Private-Balance-Event-Id`,
  ambos con el mismo valor (`eventId` UUID de la solicitud).
- **Timeout:** 10 segundos (`N8N_TIMEOUT_MS`).
- **Límite de respuesta:** 2.1 MB (`MAX_N8N_RESPONSE_BYTES`).
- **HTTPS obligatorio:** el dispatcher rechaza URLs que no usen `https:`.

El workflow **Private Balance - 03 WhatsApp Status** (`POST
evolution-whatsapp-status`) no aparece en esta tabla porque no lo invoca este
backend: es un webhook *inbound* que Evolution llama directamente sobre n8n
para reportar cambios de estado de sesión. Este repositorio no participa en
esa llamada.

## Router evento → webhook

```ts
// server/automation/webhookDispatcher.ts
const EVENT_WEBHOOKS: Record<AutomationEvent, N8nWebhookEnvironment> = {
  'income.created': 'N8N_AUTOMATION_WEBHOOK_URL',
  'service.completed': 'N8N_AUTOMATION_WEBHOOK_URL',
  'expense.created': 'N8N_AUTOMATION_WEBHOOK_URL',
  'calendar.created': 'N8N_AUTOMATION_WEBHOOK_URL',
  'device.provision.requested': 'N8N_DEVICE_PROVISIONING_WEBHOOK_URL',
  'device.whatsapp.connect.requested': 'N8N_WHATSAPP_WEBHOOK_URL',
  'communication.whatsapp.qr.requested': 'N8N_WHATSAPP_WEBHOOK_URL',
  'communication.whatsapp.status.requested': 'N8N_WHATSAPP_WEBHOOK_URL',
  'communication.whatsapp.disconnect.requested': 'N8N_WHATSAPP_WEBHOOK_URL',
  'communication.whatsapp.test.requested': 'N8N_WHATSAPP_WEBHOOK_URL',
  'communication.whatsapp.preferences.updated': 'N8N_WHATSAPP_WEBHOOK_URL',
}
```

Los seis eventos que apuntan a `N8N_WHATSAPP_WEBHOOK_URL` son exactamente los
que `WhatsAppProvider.isWhatsAppChannelEvent` reconoce como "eventos de canal
WhatsApp" (ver `server/automation/providers/whatsapp/WhatsAppProvider.ts`).

## Payload enviado (genérico)

```json
{
  "eventId": "uuid-v4",
  "event": "income.created | expense.created | calendar.created | device.provision.requested",
  "createdAt": "ISO-8601",
  "schemaVersion": 1,
  "data": { "...": "objeto de dominio (income, expense, calendar, etc.)" },
  "deviceCode": "PB-DEVICE-XXXXXXXX-XXXX-4XXX-8XXX-XXXXXXXXXXXX",
  "receivedAt": "ISO-8601",
  "source": "private-balance-pwa",
  "communicationChannel": { "...": "solo si hay un canal WhatsApp conectado" },
  "instanceName": "solo si communicationChannel está presente",
  "whatsappNumber": "solo si communicationChannel está presente"
}
```

`communicationChannel` (cuando existe) tiene esta forma, construida en
`resolveActiveWhatsappChannel` (`server/automation/communicationResolver.ts`):

```json
{
  "provider": "whatsapp",
  "instanceName": "string | undefined",
  "instanceId": "string | undefined",
  "phoneNumber": "string | undefined",
  "ownerJid": "string | undefined",
  "profileName": "string | undefined",
  "profilePhoto": "string | undefined",
  "connectedAt": "string | undefined",
  "lastSeenAt": "string | undefined",
  "status": "connected",
  "preferences": "objeto JSONB de Neon",
  "providerMetadata": "objeto JSONB de Neon"
}
```

Consumidor: **Private Balance - Nuevo Ingreso** (`income.created`,
`expense.created`, `calendar.created`), y el nodo "Upsert WhatsApp Channel"
de **01 Device Provisioning** para `device.provision.requested`.

## Payload de conexión WhatsApp (minimalista)

Construido en `buildN8nPayload` para `device.whatsapp.connect.requested`,
NO usa el envelope genérico:

```json
{
  "event": "device.whatsapp.connect.requested",
  "userCode": "PB-USER-...",
  "deviceCode": "PB-DEVICE-...",
  "phoneNumber": "string | null",
  "timezone": "string | undefined",
  "locale": "string | undefined"
}
```

Consumidor: **Private Balance - 02 WhatsApp Management**.

## Respuestas de n8n

`dispatchWebhook` (y, por extensión, `EvolutionWhatsAppProvider.dispatchChannelEvent`,
que lo delega sin transformarlo) trata la respuesta así:

- `204 No Content` → `{ status: 204, empty: true, successful: true }`.
- `2xx` o `409` con JSON válido → `{ status, body: <json>, empty: false, successful: true }`.
  - `2xx` o `409` sin JSON válido → error `n8n no devolvió una respuesta JSON válida.` (mapeado a `502`).
- Cualquier otro status → `{ status, body: <json o texto>, empty: false, successful: false }`,
  y se registra con `console.error`.
- Timeout (10s) o red caída → error mapeado a `504`.
- Configuración ausente (`URL`/token no definidos) o URL sin HTTPS → error
  mapeado a `503`.
- Respuesta mayor a 2.1 MB → error mapeado a `502`.

Para los eventos **síncronos** (los 6 de WhatsApp), `dispatchAutomationEvent`
devuelve la respuesta de n8n tal cual al cliente (mismo status, mismo body).
Para los eventos **asíncronos** (`income.created`, `service.completed`,
`expense.created`, `calendar.created`), si la entrega fue exitosa el cliente
recibe siempre `202 { accepted: true, eventId }`, independientemente del body
real devuelto por n8n.

## Respuesta esperada de conexión WhatsApp (contrato específico de Evolution)

El cliente normaliza la respuesta de `device.whatsapp.connect.requested` /
`communication.whatsapp.status.requested` con múltiples formas posibles
aceptadas (ver `src/services/communicationChannelService.ts`,
`responseChanges` y `normalizeWhatsAppConnectResponse`):

- `success: boolean`
- `status: string` (variantes: `open`, `connected`, `connecting`, `pending`,
  `qr`, `close`, `closed`, `disconnected`, `revoked`, `error`, `failed`, ...)
- `qrCode` / `qrcode` / `base64` en varias rutas anidadas posibles
  (`data.data.base64`, `data.qrcode.base64`, `qrcode`, ...)
- `pairingCode` / `code` en varias rutas anidadas posibles
- `instanceName`, `instanceId`, `connectedNumber`/`phoneNumber`/`number`,
  `ownerJid`, `profileName`, `profilePhoto`/`profilePictureUrl`,
  `connectedAt`, `lastSeenAt`, `providerMetadata`, `message`, `action`

Esta tolerancia a formas anidadas variables es deuda técnica heredada de
iteraciones del workflow de n8n; **no se debe replicar** para un futuro
proveedor Meta Cloud API. El nuevo Backend Comunicaciones deberá emitir un
contrato único y estable.

## Errores propagados al cliente

`api/automation.ts` traduce los errores internos así (sin cambios en esta
fase, solo documentado):

| Origen | Tipo de error | Status HTTP |
|---|---|---|
| Validación del envelope (Zod) | `z.ZodError` | 422 |
| Dispatcher de webhook (n8n) | `WebhookDispatchError` | el que traiga el error (503/502/504) |
| Proveedor de WhatsApp (nuevo, Fase 2) | `WhatsAppProviderError` y subclases | el que traiga el error (401/422/500/501/502/503) |
| Cualquier otro | — | 504 genérico (`No se pudo contactar con n8n.`) |

## Qué NO cambia con la abstracción de proveedores (Fase 2)

- Las URLs, el método, la autenticación y los headers de idempotencia.
- El payload exacto enviado a n8n para los 6 eventos de canal WhatsApp.
- El body y status HTTP que n8n devuelve para esos eventos síncronos.
- El comportamiento de `income.created` / `expense.created` /
  `calendar.created` / `service.completed` / `device.provision.requested`
  (no pasan por la abstracción de proveedores, siguen yendo directo a
  `dispatchWebhook`).

Lo único que cambia es la ruta interna de código: los 6 eventos de canal
WhatsApp pasan ahora por `resolveActiveWhatsAppProvider().dispatchChannelEvent(...)`
en vez de llamar a `dispatchWebhook` directamente. Para `WHATSAPP_PROVIDER=evolution`
(el valor por defecto), esa función delega en el mismo `dispatchWebhook` de
siempre, con el mismo payload.
