# Release Notes — WhatsApp Cloud API (v1.0.0-whatsapp-cloud)

Rama: `feature/migrate-evolution-to-whatsapp-cloud`
Fecha: 2026-08-01

## Resumen

Esta release introduce **WhatsApp Cloud API de Meta** como segundo proveedor de WhatsApp para Private Balance, seleccionable mediante la variable de entorno `WHATSAPP_PROVIDER` (`evolution` | `meta-cloud`), sin necesidad de cambios de código para alternar entre uno y otro. Evolution API sigue siendo el proveedor por defecto (compatibilidad hacia atrás); `meta-cloud` queda disponible para activarse de forma explícita cuando el entorno esté configurado y validado.

La integración se construyó de forma aislada del dominio financiero: ningún cambio de esta release toca cálculos de ingresos/gastos, autenticación, licencias, PWA ni IndexedDB.

## Qué incluye

### Backend de comunicaciones (`server/communication/`)

- **Webhook entrante de Meta** (`api/communication/meta/webhook.ts`):
  - Verificación GET (`hub.mode`/`hub.verify_token`/`hub.challenge`) contra `META_VERIFY_TOKEN`.
  - Verificación de firma `X-Hub-Signature-256` (HMAC-SHA256 en tiempo constante) sobre el **raw body exacto**, antes de cualquier parseo JSON (`bodyParser: false`).
  - Normalización de payloads reales de WhatsApp Cloud API (`entry → changes → value → messages/statuses`), tolerante a formas inesperadas (`unknownEntries` en vez de fallar el webhook completo).
  - Normalización determinista de timestamps Unix (`normalizeMetaTimestamp`): acepta cadena de dígitos o número, valida rango, y usa un marcador fijo (época Unix) — no la hora de recepción — ante valores ausentes o inválidos, para no romper la idempotencia de estados repetidos.
  - Idempotencia persistida en Neon (`communication_idempotency_keys`): claves `inbound:<providerMessageId>` para mensajes y `status:<providerMessageId>:<status>:<timestamp>` para estados. La reclama de idempotencia se libera automáticamente si el procesamiento posterior falla, y el fallo de un elemento no bloquea al resto del lote.
- **Endpoints salientes** consolidados en una sola función serverless (`api/communication/whatsapp/[action].ts`, por límite de funciones del plan Hobby de Vercel): `health`, `status`, `send-text`, `send-template`, `mark-read`. Protegidos con `Authorization: Bearer <N8N_COMMUNICATION_API_KEY>` (comparación en tiempo constante, rate limiting sobre fallos de autenticación).
- **Cliente de Graph API** (`metaCloudClient.ts`): timeout de 10s, traduce errores 401/403/429/5xx a tipos propios, nunca expone el access token en logs.
- **Persistencia técnica**: estado del canal por usuario/dispositivo (`communication_channels`, ampliada en la migración 006 para que Evolution y meta-cloud coexistan sin pisarse), correlaciones técnicas envío↔estado (`communication_message_correlations`, migración 007), estados de mensaje (`communication_message_statuses`) — nunca se persiste el texto financiero ni el teléfono completo sin necesidad.
- **Reenvío opcional a n8n** (`WHATSAPP_CLOUD_FORWARD_INBOUND_TO_N8N`/`_STATUS_TO_N8N`): intento único, sin reintentos que dupliquen eventos, desactivado por defecto.
- **Feature flags estrictos**: `WHATSAPP_CLOUD_ENABLED`, `WHATSAPP_CLOUD_WEBHOOK_ENABLED`, `WHATSAPP_CLOUD_ALLOW_REAL_SEND` solo aceptan literalmente `"true"`/`"false"` (sin distinguir mayúsculas) — cualquier otro valor lanza un error explícito en vez de degradar en silencio.

### Abstracción de proveedor

- `WhatsAppProvider` (interfaz común) con implementaciones `EvolutionWhatsAppProvider` y `MetaCloudWhatsAppProvider`, seleccionadas por `WhatsAppProviderFactory` según `WHATSAPP_PROVIDER`.
- `MetaCloudWhatsAppProvider` implementa las mismas operaciones de canal (connect/status/disconnect/test/preferences) que Evolution, declarando explícitamente qué capacidades no soporta (p. ej. `supportsQr`).

### n8n (preparado, no activado)

- Workflows de staging sanitizados en `n8n/workflows/whatsapp-cloud/` (mensaje entrante, estado, envío) — plantillas de exportación, no importadas ni probadas contra una instancia real de n8n.
- El reenvío real hacia n8n permanece desactivado (`false`) hasta validar recepción real, idempotencia, envío saliente, estados y seguridad de forma independiente.

## Seguridad

- Ningún secreto (`META_APP_SECRET`, `META_ACCESS_TOKEN`, `N8N_COMMUNICATION_API_KEY`, etc.) se registra en logs. `redactCommunicationData` sustituye tokens y hashea teléfonos antes de cualquier `console.info`.
- El guard de build que impide exponer secretos con prefijo `VITE_` (`vite.config.ts`) cubre por patrón todo el dominio `VITE_META_*`/`VITE_N8N_*`, no solo los nombres históricos de Evolution.
- Corregido un `console.log` residual en `api/automation.ts` que volcaba sin redactar el envelope completo (incluye eventos de conexión de WhatsApp con número de teléfono) a los logs de Vercel.
- `npm audit fix` aplicado (no disruptivo): corrige vulnerabilidades de `brace-expansion` y `postcss`. `react-router` mantiene una advertencia de auditoría sobre su modo RSC (Server Components) — esta aplicación es una SPA cliente que no usa ese modo, por lo que no es explotable en este código; se documenta como riesgo aceptado y monitoreado, no se fuerza una actualización que rompería el rango semver declarado.
- Eliminadas 3 clases de error sin consumidores y una función de creación de esquema nunca invocada (`ensureCommunicationSchema`) que recreaba un índice único ya reemplazado por la migración 006 — mantenerla era un riesgo latente de romper la coexistencia Evolution/meta-cloud si alguna vez se hubiera invocado accidentalmente.

## Pruebas

- 155 archivos de test, **1966 casos en verde** (1 `it.todo` documentado, sin relación con esta integración).
- `tsc --noEmit` (app + api), `eslint .` y `npm run build` sin errores.
- Cobertura específica: contrato del webhook (payloads reales, timestamps, eventos desconocidos), verificación de firma HMAC (firma válida/inválida/ausente/body reserializado), idempotencia (entrante, saliente, fallo parcial con liberación de reclama), configuración estricta (booleanos, variables requeridas, `META_GRAPH_API_VERSION` no puede ser `"latest"` en producción), endpoints salientes (autenticación, validación de payload, modo simulación vs. envío real), abstracción de proveedor.

## Qué NO incluye esta release

- **Validación end-to-end contra Meta en tráfico real**: la recepción de mensajes reales (no solo el botón "Test" de Meta) y el primer envío saliente real no se han confirmado completos — ver [staging-validation-report.md](staging-validation-report.md), que documenta explícitamente ~20 pasos como `NO EJECUTADO`.
- **Activación del reenvío a n8n**: `WHATSAPP_CLOUD_FORWARD_INBOUND_TO_N8N`/`_STATUS_TO_N8N` quedan en `false`.
- **Publicación de la app de Meta ni token de sistema permanente**: se documenta el procedimiento en [meta-cloud-security.md](meta-cloud-security.md), pero no se ejecuta en esta release.
- Cambios de dominio, DNS o infraestructura de Vercel: requieren decisión y ejecución manual del propietario (ver informe de entrega de la sesión).

## Rollback

Sin necesidad de revertir ningún commit ni migración:

```env
WHATSAPP_PROVIDER=evolution          # vuelve a Evolution de inmediato
WHATSAPP_CLOUD_ALLOW_REAL_SEND=false # si solo se quiere detener el envío real
WHATSAPP_CLOUD_ENABLED=false         # desactiva meta-cloud por completo
```

Las migraciones 006/007 son aditivas (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`) y no eliminan ni modifican datos de Evolution; no requieren revertirse para hacer rollback funcional.

## Commits incluidos

```
1b7edbc docs: document n8n WhatsApp Cloud staging workflows and channel persistence
14b69ab feat: add n8n staging workflows for WhatsApp Cloud
293b53a docs: document WhatsApp Cloud backend integration
2b6545e feat: forward WhatsApp inbound events and statuses to n8n
48ec066 feat: implement Meta Cloud channel provider
54b29f3 feat: add Meta Cloud communication configuration
604e076 refactor: encapsulate Evolution WhatsApp provider
69d0b1e feat: add outbound messaging, webhook processing, idempotency and service window
75999f0 feat: correlate outbound messages with n8n's event/workflow references
7e13fd2 refactor: resolve active WhatsApp provider
7f99389 test: cover WhatsApp Cloud communication backend
8262859 feat: add communication security utilities
8fd7269 refactor: add WhatsApp provider contracts
a4140c9 feat: persist Meta Cloud channel state per user/device
ade7cd4 docs: add WhatsApp Cloud staging validation report
b49fcda feat: add secure Meta Cloud API client and persistence repositories
ee6b748 docs: document WhatsApp provider abstraction
ee9bbd1 test: cover WhatsApp provider abstraction
e2f4087 fix: agregar compilerOptions al tsconfig.json raíz para builds de Vercel
e8598c8 fix: eliminar dependencia de lib ES2022 en clases de error y castear input de zod en trial-start
61ebd96 fix: consolidar endpoints WhatsApp Cloud en una sola función serverless
283f942 fix: normalize Meta webhook Unix timestamps
1401b7a feat: add WhatsApp Cloud outbound endpoints and Meta webhook route
ef6f89b fix: honor WhatsApp real send environment flag strictly
5f1100a fix: normalize Meta webhook timestamps deterministically
5da7e45 fix: release Meta webhook idempotency claim on partial failure
```

Más los commits de la revisión de producción de esta sesión (limpieza de dependencias, seguridad, documentación) — ver [el changelog técnico](../CHANGELOG.md) y el informe de entrega para el detalle y los hashes finales.

## Documentación relacionada

- [Documentación técnica de WhatsApp](./) — configuración, seguridad, webhooks, pruebas y contratos n8n.
- [Changelog técnico](../CHANGELOG.md) — entrada detallada de esta migración.
- [README principal](../../README.md) — estado del proyecto y arquitectura actualizados.