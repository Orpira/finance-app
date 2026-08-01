# Workflow n8n — Mensajes entrantes (staging)

> Fase 4. Archivo: `n8n/workflows/whatsapp-cloud/inbound-message.staging.json`.
> No probado contra una instancia real de n8n — ver advertencia en
> [n8n-meta-cloud-integration.md](n8n-meta-cloud-integration.md).

## Cuándo se activa el reenvío

El backend reenvía cada mensaje entrante nuevo (no duplicado) a este
webhook únicamente cuando **ambas** condiciones se cumplen:

```env
WHATSAPP_CLOUD_FORWARD_INBOUND_TO_N8N=true
WHATSAPP_CLOUD_WEBHOOK_ENABLED=true
```

Por defecto ambas son `false`: sin ellas, el backend sigue normalizando y
registrando el mensaje técnico (idempotencia, `last_inbound_at` del canal),
pero no llama a n8n.

## Contrato (backend → n8n)

Construido en `server/communication/services/n8nInboundForwarder.ts`
(`forwardInboundMessage`):

```json
{
  "event": "whatsapp.message.received",
  "eventId": "meta:wamid.xxxxx",
  "provider": "meta-cloud",
  "occurredAt": "2026-07-31T17:30:00Z",
  "message": {
    "providerMessageId": "wamid.xxxxx",
    "senderPhone": "34600000000",
    "senderName": "Nombre opcional",
    "type": "text",
    "text": "Hola",
    "timestamp": "2026-07-31T17:30:00Z"
  },
  "channel": { "phoneNumberId": "configured-phone-number-id-reference" }
}
```

**Decisión sobre el teléfono completo:** se envía `senderPhone` en claro
(no una referencia hasheada), porque n8n lo necesita para poder responder
(`send-text` exige un `recipient` real). El backend nunca lo registra en
logs (`logCommunicationEvent` redacta cualquier valor con forma de
teléfono), y el webhook de n8n hacia el que se envía está protegido con
`N8N_WHATSAPP_FORWARD_AUTH_TOKEN` (ver
[meta-cloud-security.md](meta-cloud-security.md)).

## Autenticación del webhook de n8n

`Authorization: Bearer <N8N_WHATSAPP_FORWARD_AUTH_TOKEN>` — configurado como
credencial "PB WhatsApp Forward Auth Token (staging)" en n8n (Header Auth),
nunca embebido en el JSON del workflow.

## Pasos del workflow (`inbound-message.staging.json`)

1. Webhook (POST, autenticado por header).
2. Validar `event === 'whatsapp.message.received'`, `provider === 'meta-cloud'`,
   `message.providerMessageId` presente → si no, `400`.
3. Clasificar el mensaje (ver más abajo).
4. `SAFE_AUTOMATIC` → construir una respuesta fija de staging (sin IA, sin
   datos financieros) → `POST send-text` → `200`.
5. `REQUIRES_REVIEW` → marcar para revisión manual (nodo NoOp, sin ninguna
   acción sensible) → `200`.
6. `UNSUPPORTED` → registrar como no soportado (NoOp) → `200`.

## Clasificación (sección 21 del documento de la Fase 4)

| Categoría | Ejemplos | Acción en staging |
|---|---|---|
| `SAFE_AUTOMATIC` | saludo, "ayuda", "prueba", agradecimiento | Responde automáticamente con un texto fijo |
| `REQUIRES_REVIEW` | consulta sobre importe/saldo/agenda/cita, datos personales | No responde automáticamente |
| `UNSUPPORTED` | multimedia no soportada, mensaje vacío, tipo desconocido | No responde automáticamente |

La clasificación del workflow de staging usa patrones de texto simples
(`RegExp`), documentados en el propio nodo Code — no hay IA ni servicio
externo involucrado en esta fase. Solo `SAFE_AUTOMATIC` puede disparar una
respuesta automática; el resto queda pendiente de revisión humana o sin
acción, deliberadamente, para no activar automatizaciones reales todavía.

## Idempotencia

El backend ya garantiza que cada `providerMessageId` se reenvía **como
máximo una vez** (idempotencia aplicada antes de llamar al forwarder, ver
`server/communication/services/metaWebhookService.ts`). El workflow de
staging no necesita volver a comprobarlo para evitar duplicados funcionales,
pero si se re-ejecuta manualmente en n8n (reintento manual de un item), el
`requestId` de la respuesta (`pb:whatsapp.reply:<providerMessageId>:<hash>`)
es determinista para el mismo mensaje entrante, así que una re-ejecución no
produce un segundo mensaje aceptado por el backend (protegido por la
idempotencia de `send-text`).

## Reintentos

`n8nInboundForwarder.ts` hace **un único intento** por mensaje, con
timeout de 8s. Clasifica el resultado:

- Reintentable: 429, 500, 502, 503, 504, timeout, error de red.
- No reintentable: 400, 401, 403 (y cualquier otro 4xx no listado).

No hay ejecución de reintentos programada en esta fase (ver
"Reintentos" en [meta-cloud-webhooks.md](meta-cloud-webhooks.md) para el
razonamiento completo sobre por qué no se implementa un scheduler dentro de
una función serverless). El resultado (`forwarded`, `status`, `retryable`)
queda en el log técnico (`whatsapp.inbound.forward`).
