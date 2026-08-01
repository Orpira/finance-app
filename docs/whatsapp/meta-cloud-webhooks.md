# Webhooks de Meta (WhatsApp Cloud API)

> Fase 3. Ruta: `api/communication/meta/webhook.ts`. Deshabilitado por
> defecto (`WHATSAPP_CLOUD_WEBHOOK_ENABLED=false`). No activa respuestas
> automáticas ni reenvía a workflows reales de n8n.

## Verificación de suscripción (`GET`)

Meta llama a esta ruta al configurar el webhook en el panel de Meta for
Developers, con query params `hub.mode`, `hub.verify_token`, `hub.challenge`.

```
GET /api/communication/meta/webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
```

Comportamiento:

- Si `WHATSAPP_CLOUD_ENABLED=true`, `WHATSAPP_CLOUD_WEBHOOK_ENABLED=true`,
  `hub.mode === "subscribe"` y `hub.verify_token === META_VERIFY_TOKEN` →
  responde `200` con el cuerpo `hub.challenge` (texto plano).
- En cualquier otro caso → responde `403`, sin cuerpo.
- Nunca se registra (`console.*`) el `hub.verify_token` recibido ni el
  esperado, en ningún caso — ni en éxito ni en fallo.
- No exige autenticación de n8n en esta ruta: la única prueba de identidad
  es `META_VERIFY_TOKEN`, que es justamente para lo que Meta lo definió.

## Eventos entrantes (`POST`)

```
POST /api/communication/meta/webhook
X-Hub-Signature-256: sha256=<hex>
Content-Type: application/json

{ "object": "whatsapp_business_account", "entry": [ ... ] }
```

### Body sin parsear (raw body)

La ruta exporta `export const config = { api: { bodyParser: false } }` para
que Vercel no consuma ni parsee el stream antes de que este código lo lea.
`readRawRequestBody` (`server/communication/security/rawBody.ts`) acumula
los bytes exactos del stream (`request.on('data'/'end')`), con un límite de
tamaño (1 MB). La firma se calcula y compara **sobre esos bytes originales**,
nunca sobre `JSON.parse(rawBody)` reserializado — una re-serialización puede
reordenar claves o cambiar espacios y produciría una firma distinta a la que
Meta calculó sobre el body que realmente envió.

### Validación de firma

`verifyMetaWebhookSignature` (`server/communication/security/verifyMetaSignature.ts`):

1. Exige el prefijo `sha256=`.
2. Calcula `HMAC-SHA256(rawBody, META_APP_SECRET)`.
3. Compara en tiempo constante (`crypto.timingSafeEqual`) contra el valor
   recibido, evitando ataques de temporización sobre la comparación byte a
   byte.
4. Cualquier fallo (ausente, prefijo incorrecto, no hexadecimal, longitud
   distinta, o no coincide) devuelve `false` de forma uniforme.

Si la firma no es válida: `401`, no se procesa nada, no se guarda el
contenido del payload, y solo se registra el evento técnico
`whatsapp.webhook.signature_invalid` sin datos del cuerpo.

### Procesamiento

Si `WHATSAPP_CLOUD_ENABLED=false` o `WHATSAPP_CLOUD_WEBHOOK_ENABLED=false` →
`403` inmediato, antes de leer el body.

Con firma válida:

1. `JSON.parse(rawBody)`.
2. `normalizeMetaWebhookPayload` (`server/communication/contracts/metaWebhook.ts`)
   recorre `entry[].changes[].value.{messages,statuses}` y produce:
   - `NormalizedInboundWhatsAppMessage[]` — `provider`, `providerMessageId`,
     `phoneNumberId`, `senderPhone`, `senderName?`, `timestamp`, `type`
     (`text|image|audio|video|document|interactive|location|unknown`),
     `text?` (solo si `type === 'text'`).
   - `NormalizedWhatsAppMessageStatus[]` — `provider`, `providerMessageId`,
     `recipientPhone?`, `status` (`sent|delivered|read|failed|unknown`),
     `timestamp`, `errorCode?`, `errorMessage?`.
   - Cualquier `change` con forma inesperada incrementa `unknownEntries` en
     lugar de lanzar un error — un campo desconocido o un evento futuro de
     Meta no tumba el webhook completo.
3. `processNormalizedWebhookEvent` (`server/communication/services/metaWebhookService.ts`)
   aplica idempotencia por mensaje/estado (ver más abajo), registra la
   ventana de conversación para cada mensaje entrante
   (`serviceWindowService.registerInbound`), guarda el estado técnico de
   cada actualización de estado (`messageStatusService.processInboundStatus`)
   y registra un evento de log redactado por cada mensaje/estado nuevo.
4. Responde `200` sin cuerpo.

**Por qué se espera (await) todo el procesamiento antes de responder:** en el
runtime serverless de Vercel no hay garantía de que código lanzado después
de enviar la respuesta siga ejecutándose — la instancia puede congelarse o
reciclarse. "Responder rápidamente" se interpretó como "no bloquear más de
lo necesario" (las operaciones son unas pocas consultas a Neon, del orden de
milisegundos), no como "responder antes de terminar de procesar", que en
este entorno arriesgaría perder escrituras.

Un error durante el `JSON.parse` o la normalización/procesamiento se
registra (`whatsapp.webhook.processing_error`, solo el mensaje del error, sin
el body) y **igualmente responde `200`**: así Meta no reintenta
indefinidamente un evento que nuestro código no puede procesar, evitando
además que un solo entry malformado bloquee el resto del payload.

### Detección de duplicados (idempotencia de entrada)

Mismo mecanismo que la idempotencia de salida
(ver [meta-cloud-backend.md](meta-cloud-backend.md)), aplicado por evento:

- Mensajes: clave `inbound:<providerMessageId>`.
- Estados: clave `status:<providerMessageId>:<status>:<timestamp>`.

Un webhook reentregado por Meta (reintento tras timeout, por ejemplo) con el
mismo `providerMessageId` no vuelve a registrar la ventana de conversación
ni a duplicar el estado técnico guardado; se cuenta como
`duplicateMessages`/`duplicateStatuses` en el resultado logueado.

### Eventos desconocidos

Un `change` sin `messages` ni `statuses` reconocibles (por ejemplo, un tipo
de evento nuevo de Meta que esta versión todavía no modela) se cuenta en
`unknownEntries` y se ignora sin producir un error global — el resto del
payload se procesa igual.

## Reintentos

Meta reintenta la entrega de un webhook si no recibe `2xx` a tiempo. Como
este handler responde `200` incluso ante errores internos de procesamiento
(solo no ante firma inválida o servicio deshabilitado), los reintentos de
Meta por fallos internos nuestros deberían ser infrecuentes; los reintentos
por fallos de firma (`401`) o servicio deshabilitado (`403`) son intencional
y correctamente no-200, ya que Meta no debería seguir insistiendo con una
firma que nunca va a validar sin cambiar el App Secret.

## Reenvío a n8n (implementado en la Fase 4)

Con `WHATSAPP_CLOUD_FORWARD_INBOUND_TO_N8N=true` (mensajes) y/o
`WHATSAPP_CLOUD_FORWARD_STATUS_TO_N8N=true` (estados), cada evento nuevo
(no duplicado) se reenvía mediante
`server/communication/services/n8nInboundForwarder.ts` a
`N8N_WHATSAPP_INBOUND_WEBHOOK_URL` / `N8N_WHATSAPP_STATUS_WEBHOOK_URL`
respectivamente, autenticado con `N8N_WHATSAPP_FORWARD_AUTH_TOKEN`. Es un
único intento (sin reintentos programados, ver
[n8n-inbound-workflow.md](n8n-inbound-workflow.md) para el razonamiento
completo) con timeout de 8s; el resultado se clasifica como reintentable o
no y se registra en el log técnico, pero nunca bloquea ni hace fallar la
respuesta al webhook de Meta — el reenvío ocurre después de que el evento
ya quedó normalizado y persistido. Contratos completos en
[n8n-inbound-workflow.md](n8n-inbound-workflow.md) y
[n8n-status-workflow.md](n8n-status-workflow.md).
