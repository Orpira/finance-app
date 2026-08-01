# Plan de pruebas de staging — WhatsApp Cloud API

> Fase 4. Secuencia para validar la integración antes de considerar
> cualquier envío real, incluso en staging.

## Configuración de staging (backend)

```env
WHATSAPP_PROVIDER=meta-cloud
WHATSAPP_CLOUD_ENABLED=true
WHATSAPP_CLOUD_ALLOW_REAL_SEND=false
WHATSAPP_CLOUD_WEBHOOK_ENABLED=true
WHATSAPP_CLOUD_FORWARD_INBOUND_TO_N8N=true
WHATSAPP_CLOUD_FORWARD_STATUS_TO_N8N=true
```

Aplicar **solo** en un entorno de Vercel preview/staging, nunca en
producción. `WHATSAPP_CLOUD_ALLOW_REAL_SEND` empieza siempre en `false`.

## Fase A — Validación en modo simulación (sin Meta real)

1. Desplegar el backend con la configuración anterior.
2. `GET /api/communication/whatsapp/health` → confirmar
   `enabled: true`, `webhookEnabled: true`.
3. Importar los 3 workflows de `n8n/workflows/whatsapp-cloud/` (ver su
   README) en una instancia de n8n de staging, sin activarlos todavía.
4. Configurar las credenciales de staging (`Private Balance Communication
   Backend (staging)`, `PB WhatsApp Forward Auth Token (staging)`) con
   valores reales de staging — nunca de producción.
5. Activar el workflow **send-notification.staging**.
6. Disparar manualmente el webhook con un payload de ejemplo
   (`event: "income.created"`, `recipient` de prueba) y confirmar:
   - El workflow responde `200`.
   - La respuesta incluye `status: "simulated"`, `simulation: true`.
   - `communication_message_correlations` tiene una fila nueva con
     `status = 'simulated'`.
7. Repetir el mismo `requestId` → confirmar que el backend no ejecuta el
   envío dos veces (idempotencia) y que la respuesta es la misma.
8. Activar **inbound-message.staging** y **message-status.staging** (sin
   enviar tráfico real todavía — solo quedan escuchando).

## Fase B — Verificación del webhook de Meta (sin credenciales reales)

1. `GET /api/communication/meta/webhook?hub.mode=subscribe&hub.verify_token=<token de staging>&hub.challenge=abc123` →
   confirmar `200` con cuerpo `abc123`.
2. Repetir con un `hub.verify_token` incorrecto → confirmar `403`.
3. (Opcional, si se dispone de un payload de ejemplo de Meta) `POST` con una
   firma HMAC válida calculada con `META_APP_SECRET` de staging → confirmar
   `200` y que se registra el evento en logs de forma redactada.

## Fase C — Configurar el número de prueba de Meta

1. En Meta for Developers, crear/usar una app con WhatsApp Cloud API en
   modo de prueba y obtener: `META_APP_ID`, `META_APP_SECRET`,
   `META_ACCESS_TOKEN` (token temporal o de sistema), `META_PHONE_NUMBER_ID`
   del número de prueba, `META_WABA_ID`.
2. Configurar esas variables en el entorno de staging de Vercel
   (nunca en `.env.example` ni en el repositorio).
3. Añadir un número de destino autorizado como "recipient" de prueba en el
   panel de Meta (los números de prueba solo pueden escribir a
   destinatarios explícitamente autorizados).
4. Configurar `WHATSAPP_CLOUD_TEST_RECIPIENT` con ese número autorizado
   (solo en variables de entorno de Vercel, nunca en el repositorio).
5. Configurar el webhook de Meta apuntando a
   `https://<staging>/api/communication/meta/webhook` con el
   `META_VERIFY_TOKEN` de staging.

## Fase D — Primer envío real controlado

1. `WHATSAPP_CLOUD_ALLOW_REAL_SEND=true` **solo en staging**.
2. Ejecutar `communication.whatsapp.test.requested` (vía
   `/api/automation` con `WHATSAPP_PROVIDER=meta-cloud`) usando un payload
   que incluya `testRecipient` = el número autorizado — confirmar
   `simulation: false` y un `providerMessageId` real (`wamid...`).
3. Confirmar en el número de prueba (WhatsApp real) que el mensaje llegó.
4. Responder desde ese número → confirmar que el webhook de Meta recibe el
   mensaje, lo normaliza, actualiza `last_inbound_at` del canal, y (si
   `WHATSAPP_CLOUD_FORWARD_INBOUND_TO_N8N=true`) que el workflow
   **inbound-message.staging** lo recibe y lo clasifica.
5. Si el mensaje de prueba entra en `SAFE_AUTOMATIC` (p. ej. "hola"),
   confirmar que llega la respuesta fija de staging.

## Fase E — Notificación funcional real (income.created)

1. Registrar un ingreso de prueba en Private Balance (entorno de
   desarrollo/staging de la app, no producción).
2. Confirmar que el evento llega al workflow **send-notification.staging**
   con los datos mínimos esperados (sin el registro financiero completo).
3. Si la ventana de conversación está cerrada, confirmar que el workflow
   cae a `send-template` con `income_registered` — **requiere que esa
   plantilla ya esté aprobada manualmente en Meta Business Manager**; si no
   lo está, Meta rechazará el envío con un error de plantilla, que debe
   normalizarse como `CommunicationProviderError` (no como éxito).

## Criterios de salida de esta fase

- Todos los pasos A y B pasan sin necesitar credenciales reales de Meta.
- Los pasos C-E se ejecutan en staging con el número de prueba,
  documentando el resultado (no forma parte de esta implementación —
  requiere acceso real a Meta for Developers y a la instancia de n8n, que
  esta sesión no tiene).
- `WHATSAPP_CLOUD_ALLOW_REAL_SEND=true` nunca se activa fuera de staging
  durante esta fase.
- Antes de considerar producción: plantillas aprobadas en Meta, número real
  migrado (explícitamente fuera de alcance de la Fase 4), y una fase
  adicional de revisión de seguridad.
