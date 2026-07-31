# Integración n8n ↔ Backend de Comunicaciones (WhatsApp Cloud API)

> Fase 4. Estado: infraestructura y workflows de **staging** listos para
> revisión manual. No conectada a producción. `WHATSAPP_CLOUD_ALLOW_REAL_SEND=false`
> por defecto en todo momento.

## Advertencia sobre el alcance de esta fase

Esta sesión no tiene acceso a una instancia real de n8n (no hay credenciales
ni MCP de n8n disponibles aquí, a diferencia de la auditoría de la Fase 1).
Los tres workflows de `n8n/workflows/whatsapp-cloud/*.json` son plantillas
de exportación **escritas a mano**, sanitizadas, pensadas para que un
operador con acceso real a n8n las importe, revise y active manualmente. No
fueron probadas contra un n8n en ejecución. Todo lo que sí se probó
end-to-end (con mocks, sin red real) es el lado del backend: persistencia,
reenvío, idempotencia, correlación — ver
[staging-test-plan.md](staging-test-plan.md).

## Arquitectura de esta fase

```
Flujo saliente:
Private Balance → Backend automatización → Webhook n8n → Workflow n8n
  → Backend de Comunicaciones (/api/communication/whatsapp/send-text|send-template)
  → WhatsApp Cloud API → Destinatario

Flujo entrante:
Usuario de WhatsApp → WhatsApp Cloud API → Webhook Meta
  → Backend de Comunicaciones (normaliza, aplica idempotencia)
  → Webhook n8n de entrada (server/communication/services/n8nInboundForwarder.ts)
  → Workflow n8n → (opcional) Backend de Comunicaciones → WhatsApp Cloud API
```

n8n sigue siendo quien decide QUÉ notificación enviar y CUÁNDO responder.
El backend nunca decide contenido de negocio — solo transporta, autentica,
valida, aplica idempotencia y ventana de conversación.

## requestId

Formato: `pb:<eventType>:<eventId>:<recipientHash>` (los workflows de
staging lo generan con un nodo Code, hasheando el destinatario con SHA-256
truncado). Reutilizar el mismo `requestId` en reintentos del mismo evento es
responsabilidad de n8n — el backend aplica idempotencia por `requestId`
(ver [meta-cloud-backend.md](meta-cloud-backend.md)), así que un
`requestId` nuevo en cada intento anularía esa protección.

## Contrato de salida (n8n → backend)

`POST /api/communication/whatsapp/send-text`, con
`context.eventId`/`context.workflowId`/`context.userReference`/
`context.deviceReference` — estos 4 campos se añadieron al esquema Zod en
esta fase (antes solo existían `eventType`/`workflowId`/`userReference`).
Ver [meta-cloud-backend.md](meta-cloud-backend.md) para el contrato
completo actualizado.

## Decisión texto vs. plantilla

El workflow de envío llama primero a `send-text`. Si el backend responde
`error.code === "WHATSAPP_TEMPLATE_REQUIRED"` (ventana de 24h cerrada), el
workflow selecciona una plantilla mediante un **mapeo explícito**
(`event → nombre de plantilla`), nunca automático/heurístico:

| Evento | Plantilla |
|---|---|
| `income.created` | `income_registered` |
| `appointment.reminder` | `appointment_reminder` |
| `conversation.reactivation` | `conversation_reactivation` |

## Plantilla `income_registered`

- Idioma: `es`.
- Contenido recomendado: *"Private Balance confirma que se registró
  correctamente un nuevo movimiento."*
- La primera versión **no incluye el importe**, por privacidad. Habilitar el
  importe requerirá una preferencia explícita del usuario, en una fase
  posterior.
- Esta plantilla **no se crea ni se aprueba automáticamente en Meta** — debe
  configurarse manualmente en Meta Business Manager antes de poder usarse.

## Modo simulación en los workflows

Los tres workflows de staging llaman al backend sin condicionar su lógica a
`ALLOW_REAL_SEND` — es el backend quien decide simular o enviar de verdad
(ver [meta-cloud-backend.md](meta-cloud-backend.md)). El workflow trata
`status: "simulated"` como un resultado válido y técnico, nunca como
"entregado": no debe mostrarse al usuario final como confirmación de
entrega real.

## Correlación

`server/communication/repositories/correlationRepository.ts` (migración
007, tabla `communication_message_correlations`) guarda:
`eventId, workflowId, requestId, providerMessageId, userReference,
deviceReference, status` — nunca el ingreso/gasto completo. Se registra en
`outboundMessageService` (tanto en simulación como en envío real) y se
actualiza cuando llega el estado correspondiente vía webhook
(`updateCorrelationStatusByProviderMessageId`).

## Reintentos hacia n8n

Ver [n8n-inbound-workflow.md](n8n-inbound-workflow.md) y
[meta-cloud-webhooks.md](meta-cloud-webhooks.md) para el detalle completo:
un único intento por evento, clasificado como reintentable o no, sin
`setTimeout` de larga duración (incompatible con funciones serverless). La
re-ejecución programada queda para la Fase 5.

## Evitar envíos duplicados (Evolution + Meta simultáneos)

`WHATSAPP_PROVIDER` es la única fuente de verdad sobre qué backend es "el
efectivo" (ver [provider-routing.md](provider-routing.md)). No existe
ningún camino de código donde ambos backends se invoquen para el mismo
evento: `eventDispatcher.ts` resuelve un único proveedor por
`isWhatsAppChannelEvent` → `resolveActiveWhatsAppProvider()`, nunca ambos.
No hay fallback automático de meta-cloud a Evolution ni viceversa.

## Preparación para el número de prueba de Meta

1. Configurar `META_*` en un entorno de **staging/preview** de Vercel (nunca
   producción) con las credenciales del número de prueba que entrega Meta
   for Developers.
2. `WHATSAPP_CLOUD_ENABLED=true`, `WHATSAPP_CLOUD_ALLOW_REAL_SEND=false`
   primero — validar todo el flujo en simulación.
3. Solo tras validar manualmente: `WHATSAPP_CLOUD_ALLOW_REAL_SEND=true` +
   `WHATSAPP_CLOUD_TEST_RECIPIENT` apuntando a un número autorizado de
   prueba (nunca el número personal de producción).
4. Ver [staging-test-plan.md](staging-test-plan.md) para la secuencia
   completa.
