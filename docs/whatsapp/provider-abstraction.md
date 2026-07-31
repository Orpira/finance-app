# Abstracción del proveedor de WhatsApp

> Fase 2 de la migración `feature/migrate-evolution-to-whatsapp-cloud`.
> Estado: implementado. Evolution sigue siendo el único proveedor funcional;
> Meta Cloud API se implementará en una fase posterior.

## Objetivo

Desacoplar la lógica de canal WhatsApp de Evolution API mediante una
interfaz común (`WhatsAppProvider`), de modo que Evolution y, más adelante,
WhatsApp Cloud API puedan implementarse como proveedores intercambiables sin
tocar el resto del backend, la PWA ni el APK.

## Punto de partida importante (ajuste respecto al documento de la Fase 2)

La auditoría de la Fase 1 identificó `communicationChannelService.ts` como el
mayor punto de acoplamiento a Evolution. Al revisar el código en detalle para
esta fase se confirmó un matiz importante: **ese archivo vive en `src/services/`
(cliente PWA/APK) y nunca llama a Evolution ni a n8n directamente** — llama a
`/api/automation` en este mismo backend. El acoplamiento real a "conceptos de
Evolution" (QR, pairing code, modelo de instancia) está en cómo ese servicio
*normaliza la respuesta* que le llega desde el backend, no en una integración
directa.

Además, **este backend nunca envía mensajes de WhatsApp**. El envío real
(por ejemplo, el aviso de un ingreso nuevo) ocurre enteramente dentro del
workflow n8n "Nuevo Ingreso" (nodo "HTTP Request WhatsApp" hacia Evolution),
fuera de este repositorio. Lo único que este backend hace hoy en relación a
WhatsApp es:

1. Reenviar los 6 eventos de gestión de canal (`device.whatsapp.connect.requested`,
   `communication.whatsapp.*`) al webhook de WhatsApp de n8n.
2. Resolver y guardar el estado del canal (`communication_channels` en Neon)
   para enriquecer los eventos financieros con `communicationChannel`.

Por eso la interfaz `WhatsAppProvider` implementada aquí es una versión
**adaptada** de la sugerida en el documento de la Fase 2: se preserva su
espíritu (capacidades declaradas, factory, errores normalizados,
configuración explícita) pero no incluye métodos de envío de mensajes
(`sendText`, `sendTemplate`, `markAsRead`) porque hoy no existe ningún punto
del código donde este backend realice esa operación — añadirlos ahora habría
significado fabricar una capacidad ficticia. Esta decisión se documenta aquí
explícitamente como el ajuste más relevante de la fase; ver "Estrategia para
Meta Cloud API" más abajo para cuándo se espera que esos métodos aparezcan.

Respetando la regla "no modificar la PWA ni el APK" del documento de
migración, `src/services/communicationChannelService.ts` **no se modificó**
en esta fase.

## Ubicación

```
server/automation/providers/whatsapp/
  WhatsAppProvider.ts        interfaz + tipos + WhatsAppChannelEvent
  errors.ts                  jerarquía de errores normalizados
  config.ts                  lectura/validación de WHATSAPP_PROVIDER
  capabilityGuard.ts         assertProviderCapability(...)
  EvolutionWhatsAppProvider.ts
  WhatsAppProviderFactory.ts
```

## Interfaz `WhatsAppProvider`

```ts
export interface WhatsAppProvider {
  readonly name: WhatsAppProviderName // 'evolution' | 'meta-cloud'
  getCapabilities(): WhatsAppProviderCapabilities
  dispatchChannelEvent(input: WhatsAppChannelEventInput): Promise<WhatsAppChannelEventResult>
}
```

`WhatsAppChannelEventInput` = `{ event: WhatsAppChannelEvent; eventId: string; payload: unknown }`,
donde `WhatsAppChannelEvent` es el subconjunto de `AutomationEvent` que
gestiona el canal (los 6 eventos `device.whatsapp.connect.requested` /
`communication.whatsapp.*`). `WhatsAppChannelEventResult` es exactamente
`WebhookDispatchResult` (`{ status, body, empty, successful }`), para que el
resultado sea intercambiable con el de `dispatchWebhook` sin adaptar
`eventDispatcher.ts` más allá de la llamada.

`WhatsAppProviderCapabilities`:

```ts
{
  supportsQr: boolean
  supportsPairingCode: boolean
  supportsTemplates: boolean
  supportsMessageStatus: boolean
  supportsInboundWebhooks: boolean
  supportsCoexistence: boolean
}
```

## Proveedores

### `EvolutionWhatsAppProvider`

Encapsula el comportamiento actual sin reescribirlo: `dispatchChannelEvent`
delega directamente en `dispatchWebhook` (el mismo cliente HTTP hacia n8n que
ya existía), reenviando el evento al webhook de WhatsApp de n8n
(`N8N_WHATSAPP_WEBHOOK_URL`). No hay transformación de payload porque no hace
falta: n8n sigue esperando exactamente lo mismo que antes (ver
[n8n-current-contracts.md](n8n-current-contracts.md)).

Capacidades declaradas (basadas en lo confirmado por la auditoría, no en
suposiciones):

| Capacidad | Valor | Evidencia |
|---|---|---|
| `supportsQr` | `true` | `docs/05_EVOLUTION_API.md`, `normalizeQrCode` en el cliente |
| `supportsPairingCode` | `true` | columna `pairing_code` en Neon, `isValidManualPairingCode` |
| `supportsTemplates` | `false` | Evolution envía texto libre, sin plantillas aprobadas por Meta |
| `supportsMessageStatus` | `false` | el workflow "03 WhatsApp Status" solo documenta callbacks de estado de *sesión*, no acuses de recibo/lectura por mensaje |
| `supportsInboundWebhooks` | `true` | workflow "03 WhatsApp Status" recibe callbacks de Evolution |
| `supportsCoexistence` | `false` | concepto específico de WhatsApp Cloud API, sin equivalente en Evolution/WhatsApp Web |

### `meta-cloud` (no implementado)

`createWhatsAppProvider('meta-cloud')` lanza `ProviderNotImplementedError`
(HTTP 501) de forma explícita y controlada. No existe ninguna clase
`MetaCloudWhatsAppProvider` todavía — se añadirá en una fase posterior junto
con el Backend Comunicaciones real.

## Factory / resolver

```ts
export function createWhatsAppProvider(providerName: WhatsAppProviderName): WhatsAppProvider
export function resolveActiveWhatsAppProvider(): WhatsAppProvider // lee WHATSAPP_PROVIDER
```

`resolveActiveWhatsAppProvider` no cachea instancias entre llamadas (el
constructor de cada proveedor es trivial); cada invocación relee
`WHATSAPP_PROVIDER` y construye el proveedor correspondiente.

## Configuración: `WHATSAPP_PROVIDER`

Añadida a `.env.example`. Reglas:

- **Ausente** → `evolution` (compatibilidad con despliegues existentes que
  aún no definen la variable; no requiere ningún cambio en Vercel para seguir
  funcionando igual que antes).
- **`evolution`** → `EvolutionWhatsAppProvider`.
- **`meta-cloud`** → `ProviderNotImplementedError` (501), explícito.
- **Cualquier otro valor** → `WhatsAppProviderConfigurationError` (503),
  explícito. Nunca cae en Evolution por defecto cuando el valor está
  presente pero es inválido — solo cuando está completamente ausente.

## Errores normalizados

Todos extienden `WhatsAppProviderError` (`{ message, status, code }`):

| Clase | HTTP | Código | Uso |
|---|---|---|---|
| `WhatsAppProviderConfigurationError` | 503 | `WHATSAPP_PROVIDER_CONFIGURATION_ERROR` | `WHATSAPP_PROVIDER` inválido |
| `WhatsAppProviderAuthenticationError` | 401 | `WHATSAPP_PROVIDER_AUTHENTICATION_ERROR` | reservado para credenciales del proveedor (sin uso aún) |
| `WhatsAppProviderUnavailableError` | 502 | `WHATSAPP_PROVIDER_UNAVAILABLE` | fallo inesperado no tipado al hablar con el proveedor |
| `UnsupportedProviderCapabilityError` | 422 | `WHATSAPP_PROVIDER_CAPABILITY_UNSUPPORTED` | se pidió una operación (p. ej. QR) que el proveedor activo no admite |
| `UnsupportedWhatsAppProviderError` | 500 | `WHATSAPP_PROVIDER_UNSUPPORTED` | nombre de proveedor no reconocido por la factory |
| `ProviderNotImplementedError` | 501 | `WHATSAPP_PROVIDER_NOT_IMPLEMENTED` | proveedor válido pero aún sin implementación (`meta-cloud`) |

`toWhatsAppProviderErrorBody(error, provider?)` da la forma de respuesta
pública: `{ success: false, provider?, error: { code, message } }`. Nunca
incluye tokens, URLs internas de n8n ni el body crudo devuelto por el
proveedor.

**Compatibilidad con `WebhookDispatchError`:** cuando `dispatchWebhook` falla
con un `WebhookDispatchError` (n8n no configurado, timeout, respuesta
inválida...), `EvolutionWhatsAppProvider` **relanza ese mismo error sin
envolverlo**. Esto es deliberado: `api/automation.ts` ya sabía manejar
`WebhookDispatchError` antes de esta fase, y envolverlo habría cambiado el
status HTTP devuelto al cliente para casos que ya funcionaban. Solo se lanza
un `WhatsAppProviderUnavailableError` propio cuando ocurre un error
verdaderamente inesperado (no un `WebhookDispatchError`).

## Guard de capacidades

```ts
export function assertProviderCapability(
  provider: WhatsAppProvider,
  capability: keyof WhatsAppProviderCapabilities,
  message?: string,
): void
```

Lanza `UnsupportedProviderCapabilityError` si el proveedor activo no declara
esa capacidad. Hoy no tiene ningún punto de llamada en producción: con un
único proveedor implementado (Evolution, que admite QR y pairing code) no hay
ninguna ruta real donde la comprobación pueda fallar. Queda cubierto por
tests unitarios y listo para cuando una ruta de conexión necesite decidir en
tiempo de ejecución entre flujos QR/pairing (Evolution) y flujos de
activación por `phone_number_id` (Meta Cloud API).

## Flujo de envío (eventos de canal WhatsApp)

Antes de esta fase, `eventDispatcher.ts` llamaba a `dispatchWebhook`
directamente para los 11 tipos de evento. Ahora:

```ts
const webhook = isWhatsAppChannelEvent(input.envelope.event)
  ? await resolveActiveWhatsAppProvider().dispatchChannelEvent({ event, eventId, payload })
  : await dispatchWebhook({ event, eventId, payload })
```

Los 5 eventos financieros/de aprovisionamiento (`income.created`,
`expense.created`, `calendar.created`, `service.completed`,
`device.provision.requested`) **no** pasan por la abstracción de proveedor:
no son operaciones de "canal WhatsApp", van al webhook general de
automatización con independencia de qué proveedor de WhatsApp esté activo.

## Endpoint de capacidades

`GET /api/communication-channel/capabilities` (nuevo, requiere el mismo
Bearer JWT que `/api/communication-channel`):

```json
{
  "provider": "evolution",
  "capabilities": {
    "supportsQr": true,
    "supportsPairingCode": true,
    "supportsTemplates": false,
    "supportsMessageStatus": false,
    "supportsInboundWebhooks": true,
    "supportsCoexistence": false
  }
}
```

Pensado para que la UI (en una fase posterior) pueda adaptar el flujo de
conexión sin hardcodear supuestos sobre Evolution. No se modificó la UI en
esta fase.

## Compatibilidad

- Evolution sigue funcionando exactamente igual: mismo payload, misma URL,
  mismo token, mismo comportamiento síncrono/asíncrono.
- `/api/automation`, `/api/communication-channel` y sus contratos públicos
  no cambiaron para ningún caso ya soportado; solo se añadió manejo
  adicional para la nueva familia de errores (`WhatsAppProviderError`), que
  antes no existía.
- n8n no requiere ningún cambio: sigue recibiendo las mismas 3 rutas, los
  mismos headers y los mismos payloads. Ver
  [n8n-current-contracts.md](n8n-current-contracts.md).
- Los tests existentes (`automationGateway.test.ts`, `webhookDispatcher.test.ts`,
  `automationHandler.test.ts`, `communicationChannelService.test.ts`, ...)
  siguen pasando sin modificaciones en su lógica de aserción.

## Estrategia para Meta Cloud API (fases posteriores)

Cuando se implemente `MetaCloudWhatsAppProvider`:

1. Su `dispatchChannelEvent` probablemente **no** llamará a
   `dispatchWebhook` (n8n): según el documento de arquitectura de la
   migración, hablará directamente con el Backend Comunicaciones / Graph API
   de Meta, o con una nueva ruta de n8n si se decide mantenerlo en el
   camino. Es decisión de una fase posterior, no de esta.
2. Sus capacidades serán al menos: `supportsQr: false`,
   `supportsPairingCode: false` (Cloud API se activa con `phone_number_id` y
   Embedded Signup, no QR/pairing de WhatsApp Web), `supportsTemplates: true`
   (Meta exige plantillas aprobadas fuera de la ventana de 24 h),
   `supportsCoexistence`: según se implemente.
3. Cuando este backend empiece a enviar mensajes realmente (en vez de que lo
   haga n8n de forma opaca), la interfaz `WhatsAppProvider` se ampliará con
   los métodos de envío (`sendText`/`sendTemplate` u equivalentes) — no antes,
   para no fabricar una capacidad sin implementación real detrás.
4. La UI podrá usar `GET /api/communication-channel/capabilities` para dejar
   de asumir QR/pairing code como único flujo de conexión.

## Estrategia de retirada de Evolution

No aplica todavía a esta fase (regla explícita: "no eliminar Evolution").
Cuando llegue el momento (Fase 9 del documento de migración):

1. `WHATSAPP_PROVIDER=meta-cloud` deberá estar en producción y validado
   end-to-end durante un periodo de convivencia.
2. Los workflows n8n "02 WhatsApp Management" y "03 WhatsApp Status" podrán
   retirarse solo después de confirmar que ningún canal activo en
   `communication_channels` sigue usando `provider = 'evolution'` con datos
   de instancia/QR/pairing pendientes de vencer.
3. `EvolutionWhatsAppProvider` se elimina en último lugar, no antes: sirve
   como red de seguridad para hacer rollback (`WHATSAPP_PROVIDER=evolution`)
   mientras exista.
