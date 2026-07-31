# Backend de comunicaciones — WhatsApp Cloud API (Meta)

> Fase 3 de la migración `feature/migrate-evolution-to-whatsapp-cloud`.
> Estado: infraestructura implementada, deshabilitada por defecto
> (`WHATSAPP_CLOUD_ENABLED=false`). No conectado todavía a los workflows de
> producción de n8n ni al número real. Evolution sigue siendo el proveedor
> activo (`WHATSAPP_PROVIDER=evolution`).

## Arquitectura

```
n8n
  ↓ POST /api/communication/whatsapp/{send-text,send-template,mark-read}
  ↓ Authorization: Bearer <N8N_COMMUNICATION_API_KEY>
Private Balance (Vercel Functions)
  ↓ server/communication/*
  ↓ Authorization: Bearer <META_ACCESS_TOKEN>
WhatsApp Cloud API (Graph API de Meta)
  ↓ POST /api/communication/meta/webhook (firmado con META_APP_SECRET)
Private Balance (Vercel Functions)
```

n8n sigue siendo el motor de automatización (decide qué notificación enviar,
prepara el contenido, selecciona destinatarios). Este backend es la única
pieza que conoce credenciales de Meta, construye llamadas a Graph API y
valida webhooks entrantes. Ni n8n ni la PWA/APK llaman a Graph API
directamente.

## Ubicación en el repositorio

Reutiliza la estructura de backend ya existente (`api/` + `server/`), igual
que el resto de la aplicación — no se creó un segundo backend.

```
server/communication/
  config/metaCloudConfig.ts          lectura y validación de variables
  contracts/outboundMessage.ts       esquemas Zod de send-text/send-template/mark-read
  contracts/metaWebhook.ts           normalización de payloads entrantes de Meta
  contracts/communicationResult.ts   forma de respuesta success/error
  errors/communicationErrors.ts      jerarquía de errores normalizados
  security/authenticateAutomationClient.ts   auth n8n → backend
  security/verifyMetaSignature.ts    validación HMAC del webhook
  security/rawBody.ts                lectura del body sin parsear
  security/rateLimiter.ts            limitador en memoria (ver meta-cloud-security.md)
  security/redactCommunicationData.ts  redacción de logs
  services/metaCloudClient.ts        único cliente HTTP hacia Graph API
  services/outboundMessageService.ts envío de texto/plantilla/mark-read + idempotencia + ventana
  services/metaWebhookService.ts     procesamiento de eventos entrantes normalizados
  services/idempotencyService.ts     comparación de hash + réplica de resultado
  services/serviceWindowService.ts   ventana de conversación de 24h
  services/messageStatusService.ts   registro de estados técnicos
  repositories/idempotencyRepository.ts      Neon: communication_idempotency_keys
  repositories/messageStatusRepository.ts    Neon: communication_message_statuses
  repositories/serviceWindowRepository.ts    Neon: communication_service_windows
  routeHelpers.ts                    respuestas de error/"deshabilitado" comunes a las rutas
  index.ts                           barrel de exports públicos

api/communication/
  whatsapp/[action].ts               dispatcher: send-text/send-template/mark-read/status/health
  meta/webhook.ts
```

`whatsapp/[action].ts` es una ruta dinámica de Vercel: un único archivo (una
sola Serverless Function) que resuelve internamente las 5 acciones según el
segmento de la URL, sin cambiar ninguna de las rutas públicas. Se consolidó
así para no superar el límite de 12 Serverless Functions del plan Hobby de
Vercel (`api/` pasó de 13 a 9 funciones).

## Endpoints

Todos (salvo `health` y el `GET` de verificación del webhook) requieren
`Authorization: Bearer <N8N_COMMUNICATION_API_KEY>`.

| Método | Ruta | Propósito | Auth |
|---|---|---|---|
| POST | `/api/communication/whatsapp/send-text` | Enviar texto libre | n8n |
| POST | `/api/communication/whatsapp/send-template` | Enviar plantilla aprobada | n8n |
| POST | `/api/communication/whatsapp/mark-read` | Marcar un mensaje como leído | n8n |
| GET | `/api/communication/whatsapp/status` | Estado de configuración/servicio | n8n (si hay clave configurada) |
| GET | `/api/communication/whatsapp/health` | Liveness check | pública |
| GET | `/api/communication/meta/webhook` | Verificación de suscripción de Meta | `hub.verify_token` |
| POST | `/api/communication/meta/webhook` | Eventos entrantes de Meta | firma `X-Hub-Signature-256` |

Con `WHATSAPP_CLOUD_ENABLED=false`, los 5 primeros endpoints responden
`503 { success: false, error: { code: "WHATSAPP_CLOUD_DISABLED", ... } }`
(o el equivalente en `health`/webhook) sin intentar contactar Meta ni exigir
ninguna variable `META_*`.

## Contrato interno de envío

```json
// POST /api/communication/whatsapp/send-text
{
  "requestId": "uuid",
  "recipient": "34600000000",
  "text": "Se registró correctamente un nuevo ingreso.",
  "context": {
    "eventType": "income.created",
    "workflowId": "income-notification",
    "userReference": "opaque-user-reference"
  }
}
```

Los esquemas Zod (`sendTextRequestSchema`, `sendTemplateRequestSchema`,
`markAsReadRequestSchema`) usan `.strict()` en cada nivel: cualquier campo no
listado —un objeto de ingreso completo, un balance, metadata con tokens—
hace que la solicitud se rechace con `422 COMMUNICATION_VALIDATION_ERROR`
antes de tocar ninguna lógica de negocio.

Respuesta de éxito (real o simulada):

```json
{ "success": true, "requestId": "uuid", "provider": "meta-cloud", "status": "accepted", "providerMessageId": "wamid..." }
{ "success": true, "requestId": "uuid", "provider": "meta-cloud", "status": "simulated", "simulation": true }
```

Respuesta de error:

```json
{ "success": false, "requestId": "uuid", "provider": "meta-cloud", "error": { "code": "WHATSAPP_TEMPLATE_REQUIRED", "message": "..." } }
```

Nunca se devuelve el access token, el app secret, la URL completa de Graph
API, el payload íntegro de Meta, cabeceras internas, ni números de teléfono
sin enmascarar en logs (ver [meta-cloud-security.md](meta-cloud-security.md)).

## `metaCloudClient` — único punto que habla con Graph API

`server/communication/services/metaCloudClient.ts` construye
`https://graph.facebook.com/{version}/{phoneNumberId}/messages`, añade el
Bearer token, aplica un timeout de 10 s y normaliza la respuesta. Ninguna
ruta ni servicio de este backend construye URLs de Graph API por su cuenta.

Mapeo de errores de Meta:

| Origen | Error interno | HTTP |
|---|---|---|
| 401 / 403 de Meta | `CommunicationAuthenticationError` | 401 |
| 429 de Meta | `CommunicationRateLimitError` | 429 |
| 4xx de Meta (resto) | `CommunicationProviderError` | 422 |
| 5xx de Meta | `CommunicationProviderError` | 502 |
| Timeout / red caída | `CommunicationProviderUnavailableError` | 502 |
| Meta responde 200 sin `messages[0].id` | `CommunicationProviderError` | 502 |

## Modo simulación

Con `WHATSAPP_CLOUD_ALLOW_REAL_SEND=false` (valor por defecto),
`outboundMessageService` **nunca** llama a `metaCloudClient`: devuelve
`{ status: "simulated", simulation: true }`. No existe ningún camino que
finja `status: "accepted"` sin haber llamado realmente a Meta — evita que un
despliegue con la bandera apagada por error parezca estar entregando
mensajes.

## Idempotencia

Ver también [meta-cloud-webhooks.md](meta-cloud-webhooks.md) para el lado
entrante. Estrategia igual a la que ya usa n8n en `processed_events` (ver
`docs/04_N8N_WORKFLOWS.md`): claves con el mismo hash de payload devuelven
el resultado guardado (`replayed: true`); claves repetidas con payload
distinto se rechazan como `CommunicationDuplicateRequestError` (409).

- Salientes: `outbound:<requestId>` (y `outbound:mark-read:<requestId>` para mark-read).
- Entrantes (mensajes): `inbound:<providerMessageId>`.
- Entrantes (estados): `status:<providerMessageId>:<status>:<timestamp>`.

Persistido en Neon (`communication_idempotency_keys`), no en memoria de
proceso — necesario porque cada invocación de una función serverless de
Vercel puede correr en una instancia distinta.

## Ventana de conversación

`serviceWindowService` calcula 24 horas desde el último mensaje entrante
(`communication_service_windows` en Neon, `contact_reference` = número del
remitente). `send-text` exige la ventana abierta cuando hay envío real
(`ALLOW_REAL_SEND=true`); si está cerrada, responde
`422 WHATSAPP_TEMPLATE_REQUIRED` en vez de intentar el envío. `send-template`
no comprueba la ventana (las plantillas existen precisamente para cuando
está cerrada). n8n sigue decidiendo qué notificación enviar; este backend
solo garantiza que el tipo de mensaje sea válido para el estado de la
conversación.

## Feature flags

| Variable | Efecto |
|---|---|
| `WHATSAPP_CLOUD_ENABLED` | Habilita/deshabilita todo el backend Cloud |
| `WHATSAPP_CLOUD_ALLOW_REAL_SEND` | Permite llamadas reales a Graph API (si no, modo simulación) |
| `WHATSAPP_CLOUD_WEBHOOK_ENABLED` | Habilita la verificación y el procesamiento del webhook |
| `WHATSAPP_CLOUD_FORWARD_INBOUND_TO_N8N` | Reservada para la Fase 4; hoy solo registra un aviso si está en `true` sin ejecutar ningún reenvío |
| `WHATSAPP_PROVIDER` | Sigue controlando `WhatsAppProvider` (Fase 2); independiente de las flags anteriores |

Ver [meta-cloud-environment.md](meta-cloud-environment.md) para la tabla
completa de variables y reglas de validación.

## Alcance de la Fase 3 (histórico, resuelto en la Fase 4)

Los tres primeros puntos de esta sección (persistencia del canal por
usuario, reenvío real de mensajes entrantes/estados, `lastInboundAt`/
`lastOutboundAt` siempre `null`) quedaron resueltos en la Fase 4: ver
[meta-channel-persistence.md](meta-channel-persistence.md),
[n8n-inbound-workflow.md](n8n-inbound-workflow.md) y
[n8n-status-workflow.md](n8n-status-workflow.md).

El `console.log` de depuración en `api/automation.ts` (líneas 116-117,
detectado en la Fase 1) sigue sin tocarse — deuda técnica de otro módulo,
todavía fuera del alcance de esta migración.

## Alcance de la Fase 4 (qué queda fuera deliberadamente)

- **`MetaCloudWhatsAppProvider` no distingue `mode: 'test'` de
  `'simulation'`/`'production'` automáticamente.** Hoy solo alterna entre
  `'simulation'` y `'production'` según `WHATSAPP_CLOUD_ALLOW_REAL_SEND`.
- **El reenvío hacia n8n es de un único intento**, sin reintentos
  programados (ver "Reintentos" en
  [meta-cloud-webhooks.md](meta-cloud-webhooks.md) y
  [n8n-inbound-workflow.md](n8n-inbound-workflow.md)). Una cola o Vercel
  Cron para reintentos reales queda para una fase posterior.
- **Los workflows n8n de `n8n/workflows/whatsapp-cloud/` son plantillas
  escritas a mano**, no verificadas contra una instancia real de n8n (esta
  sesión no tuvo acceso a una). Requieren revisión e importación manual —
  ver `n8n/workflows/whatsapp-cloud/README.md`.
- **`communicationChannelStore.ts` sigue siendo código muerto** con un
  esquema incompatible con la tabla real de `communication_channels`
  (hallazgo documentado en
  [meta-channel-persistence.md](meta-channel-persistence.md)). No se tocó
  en esta fase.
