# Workflow n8n — Estados de mensaje (staging)

> Fase 4. Archivo: `n8n/workflows/whatsapp-cloud/message-status.staging.json`.
> No probado contra una instancia real de n8n — ver advertencia en
> [n8n-meta-cloud-integration.md](n8n-meta-cloud-integration.md).

## Cuándo se activa el reenvío

```env
WHATSAPP_CLOUD_FORWARD_STATUS_TO_N8N=true
WHATSAPP_CLOUD_WEBHOOK_ENABLED=true
```

Por defecto ambas son `false`. Sin ellas, el backend sigue registrando el
estado técnico (`communication_message_statuses`, Fase 3) y actualizando la
correlación (`communication_message_correlations`, Fase 4), pero no llama a
n8n.

## Contrato (backend → n8n)

Construido en `n8nInboundForwarder.ts` (`forwardMessageStatus`):

```json
{
  "event": "whatsapp.message.status.updated",
  "eventId": "status:wamid.xxxxx:delivered:2026-07-31T17:31:00Z",
  "provider": "meta-cloud",
  "occurredAt": "2026-07-31T17:31:00Z",
  "status": {
    "providerMessageId": "wamid.xxxxx",
    "state": "delivered",
    "timestamp": "2026-07-31T17:31:00Z",
    "errorCode": null,
    "errorMessage": null
  }
}
```

Estados soportados: `sent`, `delivered`, `read`, `failed`, `unknown`
(mismo vocabulario que `NormalizedWhatsAppMessageStatus`, ver
[meta-cloud-webhooks.md](meta-cloud-webhooks.md)).

## Autenticación

Misma credencial que el workflow de entrada: `Authorization: Bearer
<N8N_WHATSAPP_FORWARD_AUTH_TOKEN>` ("PB WhatsApp Forward Auth Token
(staging)").

## Pasos del workflow (`message-status.staging.json`)

1. Webhook (POST, autenticado por header).
2. Validar `event === 'whatsapp.message.status.updated'`,
   `provider === 'meta-cloud'`, `status.providerMessageId` presente y
   `status.state` dentro del vocabulario conocido → si no, `400`.
3. Registrar el estado técnico (nodo Code — solo `providerMessageId`,
   `state`, `timestamp`, `errorCode`; nunca el texto del mensaje original).
4. Si `state === 'failed'` → marcar para revisión (NoOp). Si no → sin acción
   adicional (NoOp).
5. `200`.

No se implementan callbacks de producción ni acciones automáticas sobre el
estado en esta fase — el workflow de staging solo dejaría constancia de
fallos para revisión manual futura.

## Correlación con `requestId`

La correlación entre este estado y el envío original (`requestId`,
`eventId`, `workflowId`) ya la resuelve el backend antes de reenviar
(`updateCorrelationStatusByProviderMessageId`, ver
[n8n-meta-cloud-integration.md](n8n-meta-cloud-integration.md)) — el
workflow de n8n no necesita volver a correlacionarlo por su cuenta salvo
que quiera consultarlo (fuera de alcance de esta plantilla de staging).
