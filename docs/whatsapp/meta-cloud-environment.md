# Variables de entorno — WhatsApp Cloud API (Meta)

> Fase 3. Todas exclusivas de servidor (Vercel); ninguna debe llevar el
> prefijo `VITE_`. Ver `.env.example` para la plantilla sin valores reales.

## Flags de habilitación

| Variable | Por defecto | Efecto |
|---|---|---|
| `WHATSAPP_CLOUD_ENABLED` | `false` | Habilita todo el backend Cloud. En `false`, ningún endpoint `/api/communication/*` exige variables `META_*` y todos responden "deshabilitado". |
| `WHATSAPP_CLOUD_ALLOW_REAL_SEND` | `false` | Permite llamadas reales a Graph API. En `false`, `send-text`/`send-template`/`mark-read` devuelven un resultado de simulación (`status: "simulated"`) sin contactar a Meta. |
| `WHATSAPP_CLOUD_WEBHOOK_ENABLED` | `false` | Habilita la verificación (`GET`) y el procesamiento de eventos (`POST`) del webhook. En `false`, ambos responden `403`. |
| `WHATSAPP_CLOUD_FORWARD_INBOUND_TO_N8N` | `false` | Reservada para la Fase 4. En `true` no ejecuta ningún reenvío todavía; solo deja constancia en el log de que la bandera está activa sin implementación. |

## Credenciales de Meta (obligatorias solo si `WHATSAPP_CLOUD_ENABLED=true`)

| Variable | Obligatoria si enabled=true | Descripción |
|---|---|---|
| `META_APP_ID` | No | Identificador de la app de Meta (informativo) |
| `META_APP_SECRET` | Sí | Usado para validar la firma HMAC de los webhooks |
| `META_ACCESS_TOKEN` | Sí | Token de acceso permanente/de sistema para llamar a Graph API |
| `META_VERIFY_TOKEN` | Sí | Token que Meta debe repetir en `hub.verify_token` al verificar el webhook |
| `META_WABA_ID` | No | ID de la cuenta de WhatsApp Business (informativo) |
| `META_PHONE_NUMBER_ID` | Sí | ID del número de teléfono usado como remitente en Graph API |
| `META_GRAPH_API_VERSION` | Sí | Versión explícita de Graph API, p. ej. `v21.0`. **No puede ser `latest` cuando `VERCEL_ENV=production`.** |

## Backend de comunicaciones

| Variable | Obligatoria si enabled=true | Descripción |
|---|---|---|
| `N8N_COMMUNICATION_API_KEY` | Sí | Clave compartida que n8n envía como `Authorization: Bearer <clave>` hacia `/api/communication/whatsapp/*` |

## Retención

| Variable | Por defecto | Descripción |
|---|---|---|
| `WHATSAPP_MESSAGE_RETENTION_DAYS` | `0` | Reservada; la purga automática de `communication_message_statuses` no está implementada en esta fase (ver meta-cloud-security.md) |
| `WHATSAPP_IDEMPOTENCY_RETENTION_DAYS` | `30` | Días que se conserva cada clave de idempotencia (salientes y entrantes) antes de purgarse |

## Reglas de validación (`getMetaCloudConfig`)

1. **`WHATSAPP_CLOUD_ENABLED` ausente o `false`** → no se valida ni se exige
   ninguna variable `META_*`; el backend arranca igual, Evolution sigue
   funcionando sin ningún cambio.
2. **`WHATSAPP_CLOUD_ENABLED=true`** → deben estar presentes
   `META_APP_SECRET`, `META_ACCESS_TOKEN`, `META_VERIFY_TOKEN`,
   `META_PHONE_NUMBER_ID`, `META_GRAPH_API_VERSION` y
   `N8N_COMMUNICATION_API_KEY`. Si falta alguna, se lanza
   `CommunicationConfigurationError` (503) nombrando exactamente qué
   variable falta — nunca arranca en un estado "a medias configurado".
3. **`META_GRAPH_API_VERSION=latest` en producción** (`VERCEL_ENV=production`)
   → rechazado explícitamente. Fuera de producción (desarrollo/preview) se
   permite, para facilitar pruebas contra la versión más reciente sin fijarla.
4. **`WHATSAPP_CLOUD_ALLOW_REAL_SEND`** siempre por defecto `false`; debe
   activarse explícitamente, nunca se infiere de otras variables.
5. Ningún test de este repositorio usa credenciales reales: todos mockean
   `getMetaCloudConfig`, `fetch` o el cliente de Meta (ver
   [meta-cloud-testing.md](meta-cloud-testing.md)).

## `WHATSAPP_PROVIDER` (Fase 2, sin cambios de comportamiento)

`WHATSAPP_PROVIDER` sigue controlando qué `WhatsAppProvider` gestiona los
eventos de canal (`device.whatsapp.connect.requested`,
`communication.whatsapp.*`) — es independiente de las flags `WHATSAPP_CLOUD_*`
de esta fase. Puede tener `MetaCloudWhatsAppProvider` implementado
(`WHATSAPP_PROVIDER=meta-cloud`) y al mismo tiempo `WHATSAPP_CLOUD_ENABLED=false`;
en ese caso, `MetaCloudWhatsAppProvider` responde consistentemente con
`status: "not_configured"` en vez de fallar.

## Ejemplo de configuración completa (solo referencia, sin valores reales)

```env
WHATSAPP_PROVIDER=evolution

WHATSAPP_CLOUD_ENABLED=false
WHATSAPP_CLOUD_ALLOW_REAL_SEND=false
WHATSAPP_CLOUD_WEBHOOK_ENABLED=false
WHATSAPP_CLOUD_FORWARD_INBOUND_TO_N8N=false

META_APP_ID=
META_APP_SECRET=
META_ACCESS_TOKEN=
META_VERIFY_TOKEN=
META_WABA_ID=
META_PHONE_NUMBER_ID=
META_GRAPH_API_VERSION=

N8N_COMMUNICATION_API_KEY=

WHATSAPP_MESSAGE_RETENTION_DAYS=0
WHATSAPP_IDEMPOTENCY_RETENTION_DAYS=30
```

Ver `.env.example` en la raíz del repositorio para la plantilla real
mantenida junto al resto de variables del proyecto.
