# Auditoría: estado actual de la integración WhatsApp (Evolution API + n8n)

> Documento generado como Fase 1 (Auditoría) de la migración
> `feature/migrate-evolution-to-whatsapp-cloud`.
> Alcance: solo lectura / documentación. No se modificó código funcional.
> Fecha: 2026-07-31.

## 1. Resumen de la arquitectura actual

```
PWA/APK (React + Dexie)
   → automationOutbox (IndexedDB, cola local con reintentos)
   → JWT corto (15 min, emitido por /api/automation-token)
   → Vercel Functions /api/automation, /api/communication-channel
   → server/automation/* (gateway propio)
   → n8n (webhooks)
   → Evolution API (sesión WhatsApp Web)
   → WhatsApp del usuario
```

El frontend **nunca** llama directamente a Evolution API ni a n8n. Todo pasa
por un backend propio en Vercel (`api/` + `server/`) que actúa de gateway
autenticado hacia n8n, y es n8n quien orquesta Evolution API. Ese punto de
intermediación ya existe y está bien encapsulado, lo cual facilita sustituir
"n8n + Evolution" por "Backend Comunicaciones + WhatsApp Cloud API" sin tocar
el cliente PWA/APK.

## 2. Evolution API

No hay ningún cliente HTTP directo a Evolution API en este repositorio
(correctamente encapsulado en n8n, fuera del repo). Las referencias aquí son
documentales, de tipado y de copy de UI:

- `docs/05_EVOLUTION_API.md` — documento dedicado: rol de Evolution (gestión
  de instancias WhatsApp, conexión/desconexión, estado, envío de mensajes),
  regla de que frontend/APK nunca deben llamarla directamente, workflows n8n
  asociados, campos funcionales (`instanceName`, `instanceId`, `phoneNumber`,
  `ownerJid`, `profileName`, `profilePhoto`, `connectedAt`, `lastSeenAt`,
  `status`) y riesgos conocidos (resolución global de canal, credenciales en
  workflows legacy).
- `src/types/communicationChannel.ts:11` — `provider: 'evolution-api'` como
  literal fijo del tipo `CommunicationChannel`.
- `src/services/communicationChannelService.ts:82,123,215` — el frontend fija
  `provider: 'evolution-api'` al crear/actualizar el canal local; en
  `normalizeRemoteStatus`/`normalizeStatus` (líneas 94-104, 276-283) traduce
  estados propios de Evolution (`open`, `close`, `qr`, etc.) a estados
  internos.
- `src/pages/Settings/CommunicationChannelsPage.tsx:202,248,413` — textos de
  UI: "Notificaciones automáticas mediante n8n y Evolution API", "si
  Evolution no lo ofrece, se mostrará un QR alternativo", "Las credenciales
  de Evolution API permanecen fuera de este dispositivo".
- `docs/00_SYSTEM_ARCHITECTURE_MASTER.md:109-226,880,892-893` — diagrama y
  ADR-003 ("Evolution API as the WhatsApp provider", encapsulada).
- `docs/DECISIONS.md:21-26` — ADR-003 formal: Evolution gestiona WhatsApp,
  encapsulada en n8n, credenciales solo server-side.
- `docs/01_ARCHITECTURE.md:24,94` — regla "Evolution API no se consume desde
  el frontend; se encapsula en n8n".
- `docs/AUTOMATION_HUB.md:131` — "La API Key de Evolution se configura
  únicamente como credencial de n8n" (nunca en este repo).
- `.env.example:14` y `docs/AUTOMATION_HUB.md:55` — variable prohibida
  explícitamente bloqueada en build: `VITE_EVOLUTION_API_KEY`.
- `test/communicationChannelService.test.ts` — suite `'WhatsApp channel
  response contract'` que testea el mapeo de respuestas específicas de
  Evolution (pairing code vs QR, normalización de teléfono).

**Conclusión:** ninguna credencial ni endpoint de Evolution vive en este
repo; toda su lógica de negocio (crear instancia, pairing code/QR, estado)
vive en workflows n8n externos, referenciados solo documentalmente.

## 3. WhatsApp (integración de mensajería / UI)

No existen deep links `wa.me`, `whatsapp://` ni botones de "compartir por
WhatsApp" en ningún componente de `src/`. La integración es enteramente de
notificaciones salientes automatizadas vía backend, no de compartir
contenido desde el cliente.

- `src/types/communicationChannel.ts` — modelo completo del canal WhatsApp:
  `CommunicationChannel` (status, qrCode, phoneNumber, pairingCode,
  ownerJid, profileName, profilePhoto, preferencias de notificación
  `notifyIncomeCreated` / `notifyExpenseCreated` / `notifyCalendarReminder` /
  `notifyBackupCompleted`).
- `src/services/communicationChannelService.ts` (668 líneas) — servicio
  central: `connectWhatsApp`, `disconnectWhatsApp`, `refreshWhatsAppStatus`,
  `changeWhatsAppAccount`, `testWhatsAppNotification`,
  `updateWhatsAppNotificationPreferences`, más normalización exhaustiva de
  la respuesta remota (QR vs pairing code, distintos formatos de payload
  posibles desde Evolution/n8n, líneas 226-465).
- `src/pages/Settings/CommunicationChannelsPage.tsx` (420 líneas) — pantalla
  "Canales de comunicación": conectar/desconectar WhatsApp, mostrar QR o
  pairing code, polling de estado (cada 7s, timeout 90s, líneas 55-134),
  preferencias de notificación por checkbox, botón "Probar envío".
- `src/pages/Settings/SettingsPage.tsx:30` — entrada de menú "Conecta
  WhatsApp y elige qué notificaciones enviar."
- `src/database/db.ts:90,514,559,...` — tabla Dexie `communicationChannels`
  (índices `id,type,provider,status,updatedAt`).
- `docs/WHATSAPP_E2E_CHECKLIST.md` — checklist E2E de 6 casos de prueba para
  el flujo de licencia + canal WhatsApp.

**Conclusión:** el "envío" de WhatsApp ocurre fuera del repo (n8n/Evolution);
este repo solo gestiona el estado de conexión del canal y las preferencias
de notificación, y dispara eventos de negocio (ver sección 6).

## 4. n8n

n8n es el orquestador externo central.

- `docs/04_N8N_WORKFLOWS.md` — inventario de 4 workflows activos:
  - **01 Device Provisioning** — webhook `POST private-balance-device`,
    evento `device.provision.requested`.
  - **02 WhatsApp Management** — webhook `POST private-balance-whatsapp`,
    eventos `device.whatsapp.connect.requested`,
    `communication.whatsapp.status/disconnect/test.requested`,
    `communication.whatsapp.preferences.updated`,
    `communication.whatsapp.qr.requested` (legado). Nodos: "Listar/Crear/
    Conectar instancias Evolution", "Guardar canal Neon".
  - **03 WhatsApp Status** — webhook `POST evolution-whatsapp-status`,
    recibe callbacks de estado de Evolution.
  - **Nuevo Ingreso** — webhook `POST private-balance`, eventos
    `income.created`, `expense.created`, `calendar.created`, `backup.run`;
    idempotencia con `processed_events`, resolución contextual de canal
    WhatsApp, nodos "HTTP Request WhatsApp" hacia Evolution.
- `server/automation/webhookDispatcher.ts` — mapa `EVENT_WEBHOOKS` que
  enruta cada tipo de evento a una de 3 URLs de webhook n8n
  (`N8N_AUTOMATION_WEBHOOK_URL`, `N8N_DEVICE_PROVISIONING_WEBHOOK_URL`,
  `N8N_WHATSAPP_WEBHOOK_URL`), agrega headers `Authorization: Bearer
  <N8N_INTERNAL_TOKEN>`, `Idempotency-Key`, `X-Private-Balance-Event-Id`,
  timeout 10s, límite de respuesta 2.1MB.
- `server/automation/eventDispatcher.ts` — construye el payload exacto
  (`buildN8nPayload`) enviado a n8n por tipo de evento, incluyendo el objeto
  `communicationChannel` cuando aplica.
- `docs/AUTOMATION_HUB.md` — documento maestro: diagrama, variables de
  entorno, contrato JSON completo, tabla de enrutamiento evento→variable,
  configuración del lado n8n (Header Auth, Data Table
  `private_balance_events` para idempotencia), rotación de secretos.
- `docs/00_SYSTEM_ARCHITECTURE_MASTER.md:649-662,920,948` — sección "13.1
  Reglas n8n", deuda técnica `TD-003` ("n8n ramas sin respuesta"), sección
  "21.4 Dependencia operacional de n8n".
- `docs/DECISIONS.md:14-18` — ADR-002 "n8n as the automation engine".
- `test/automationGateway.test.ts`, `test/webhookDispatcher.test.ts` —
  tests del dispatcher y del contrato de payload hacia n8n.

**Conclusión:** n8n es el único consumidor final de Evolution API. Según el
documento de migración, n8n **se mantiene** como motor de automatización; lo
que cambia es que en vez de llamar a Evolution, un nuevo "Backend
Comunicaciones" hablará con WhatsApp Cloud API. Esto encaja con la
arquitectura ya existente: basta con insertar el nuevo backend entre n8n y
el proveedor de WhatsApp, sin tocar el contrato `api/automation.ts` /
`api/communication-channel.ts` hacia el cliente PWA/APK.

## 5. Backend propio como intermediario (`api/`, `server/`)

Confirmado: existe backend propio completo actuando de intermediario entre
el cliente y n8n/Evolution. No hay `functions/` ni `supabase/functions/`; el
backend vive en `api/` (Vercel Functions) + `server/` (lógica compartida).

**`api/`** (endpoints públicos Vercel):
- `api/automation-token.ts` — valida licencia firmada V2 y emite JWT HS256
  corto (15 min) para autorizar al dispositivo contra el gateway de
  automatización.
- `api/automation.ts` — endpoint principal: valida el JWT, valida el
  envelope del evento (Zod), llama a `dispatchAutomationEvent` que reenvía a
  n8n. Contiene un `console.log` de depuración del envelope completo
  (líneas 116-117, `'===== ENVELOPE RECIBIDO ====='`) — candidato a limpiar
  antes de producción/migración, aunque fuera del alcance de esta auditoría.
- `api/communication-channel.ts` — expone `GET` del canal WhatsApp resuelto
  en Neon para un `userCode`/`deviceCode` autenticado.
- `api/license-activate.ts`, `api/trial-start.ts`,
  `api/ai-provider-openai.ts` — no relacionados con WhatsApp/n8n.

**`server/`** (lógica compartida, no expuesta directamente):
- `server/automation/eventTypes.ts` — enum `AUTOMATION_EVENT_TYPES` (11
  eventos) y `SYNCHRONOUS_EVENTS` (los eventos WhatsApp son síncronos:
  esperan respuesta de n8n antes de responder al cliente).
- `server/automation/eventDispatcher.ts` — orquestador: resuelve el canal de
  comunicación activo antes de reenviar eventos financieros, construye el
  payload final hacia n8n.
- `server/automation/webhookDispatcher.ts` — cliente HTTP hacia n8n (fetch
  con Bearer token, timeout, manejo de error/409/204).
- `server/automation/communicationResolver.ts` — consultas SQL directas a
  Neon (`communication_channels`, `license_devices`) para resolver el canal
  WhatsApp activo por `userCode`/`deviceCode`.
- `server/communicationChannelStore.ts` — CRUD (`getCommunicationChannel`,
  `upsertCommunicationChannel`, `updateCommunicationChannel`) sobre la tabla
  `communication_channels` en Neon.
- `server/automationSecurity.ts` — verificación de licencia firmada V2
  (ECDSA P-256) y emisión/verificación de JWT HS256 propio (autenticación
  interna app↔backend, no relacionada con Meta).
- `server/apiUtils.ts` — CORS/seguridad genérica de los endpoints.
- `server/migrations/002_communication_channels.sql`,
  `004_whatsapp_channel_sessions.sql`,
  `005_communication_channel_device_scope.sql` — evolución del esquema
  `communication_channels` en Neon (columnas `instance_name`, `instance_id`,
  `owner_jid`, `profile_name`, `profile_photo`, `pairing_code`,
  `connected_at`, índices únicos `(user_code, device_code, provider)`).

**Conclusión:** este backend es exactamente el punto donde se debe
intervenir para migrar a WhatsApp Cloud API: sustituir/ampliar
`webhookDispatcher.ts` (o el nodo n8n equivalente) para hablar con el nuevo
Backend Comunicaciones, y adaptar `communicationChannelStore` /
`communicationResolver` dado que el modelo de "instancia" de Evolution
(instanceName/instanceId/QR/pairingCode) no existe en Cloud API.

## 6. Variables de entorno

**`.env.example`** (plantilla, sin secretos reales):
```
N8N_AUTOMATION_WEBHOOK_URL=https://n8n.orpira.es/webhook/private-balance
N8N_DEVICE_PROVISIONING_WEBHOOK_URL=https://n8n.orpira.es/webhook/private-balance-device
N8N_WHATSAPP_WEBHOOK_URL=https://n8n.orpira.es/webhook/private-balance-whatsapp
N8N_INTERNAL_TOKEN=replace-with-a-rotated-server-token
AUTOMATION_JWT_SECRET=replace-with-at-least-32-random-characters
PRIVATE_BALANCE_ALLOWED_ORIGINS=https://private-balance.orpira.es
```
Con comentario explícito: "Nunca definir variables `VITE_` para n8n, tokens
o Evolution API. El build falla intencionadamente si detecta una
integración directa."

**`.env.local`** (entorno real de desarrollo/Vercel, **no versionado** —
confirmado en `.gitignore` líneas 16-18, 43, 52): define las mismas 3 URLs
de webhook n8n, `N8N_INTERNAL_TOKEN`, `AUTOMATION_JWT_SECRET`, y
adicionalmente `N8N_API_KEY` (JWT de la API pública de n8n), además de
credenciales completas de Neon/Postgres y un token OIDC de Vercel.

**`vite.config.ts:5-20`** — guard de build (`FORBIDDEN_CLIENT_SECRETS`): la
build falla si detecta `VITE_N8N_WEBHOOK_URL`, `VITE_N8N_WHATSAPP_WEBHOOK_URL`,
`VITE_PRIVATE_BALANCE_TOKEN` o `VITE_EVOLUTION_API_KEY` en el entorno —
mecanismo de defensa para impedir que secretos de n8n/Evolution terminen en
el bundle cliente. Este guard deberá ampliarse en la migración para cubrir
también cualquier secreto de Meta Cloud API (App Secret, tokens de acceso).

**Otras referencias:**
- `docs/architecture/11_SECURITY.md:15,70,79` — lista `N8N_INTERNAL_TOKEN`,
  `AUTOMATION_JWT_SECRET`, `DATABASE_URL` como secretos de servidor.
- `docs/AUTOMATION_HUB.md:32-66` — sección "Variables" completa con
  explicación de cuáles son públicas (bundle) vs privadas (solo Vercel).

## 7. Eventos de negocio que disparan notificaciones

Mecanismo: outbox pattern con Dexie (IndexedDB) + reintentos con backoff
exponencial.

- `src/types/automation.ts` — 11 tipos de evento
  (`PRIVATE_BALANCE_AUTOMATION_EVENTS`): `income.created`,
  `service.completed`, `expense.created`, `calendar.created`,
  `device.provision.requested`, `device.whatsapp.connect.requested`,
  `communication.whatsapp.qr.requested` (legado),
  `communication.whatsapp.status/disconnect/test.requested`,
  `communication.whatsapp.preferences.updated`.
- `src/services/incomeService.ts:79-87` — al crear un ingreso, dentro de la
  misma transacción Dexie (`db.services` + `db.automationOutbox`), encola
  `enqueueAutomationEvent(createAutomationOutboxRecord('income.created',
  { income }))`.
- `src/services/expenseService.ts:65-80` — análogo para egresos: encola
  `expense.created` con el objeto `expense` en la misma transacción.
- `src/services/serviceTimerService.ts:122-124` — encola `service.completed`.
- `src/services/deviceIdentityService.ts:302-311,369` — encola/gestiona
  `device.provision.requested`.
- `src/services/automationOutboxService.ts` — cola de salida:
  `enqueueAutomationEvent`, `flushAutomationOutbox` (batch de 20, backoff
  exponencial base 15s hasta 24h), se dispara al reconectar (`online`
  listener) y al iniciar la app.
- `src/services/automationHubService.ts` — capa de transporte: obtiene JWT
  (`requestAutomationToken`, requiere licencia V2 activa), hace
  `POST /api/automation` con `Idempotency-Key`.
- `server/automation/eventDispatcher.ts:130-188` — al recibir
  `income.created`, `service.completed`, `expense.created` o
  `calendar.created`, **resuelve el canal WhatsApp activo del usuario**
  (`resolveActiveWhatsappChannel`) y si existe, enriquece el payload hacia
  n8n con `communicationChannel`, `instanceName`, `whatsappNumber` antes de
  reenviar. Si no hay canal conectado, el evento financiero se envía igual
  sin datos de WhatsApp (el flujo financiero nunca falla por falta de
  canal).

**Conclusión:** el disparo es 100% "evento de dominio → outbox local →
gateway propio → n8n"; nunca se llama a Evolution/Meta directamente desde
el dominio financiero. Esto es clave para la migración: basta con cambiar
qué hace n8n (o el nuevo Backend Comunicaciones) al recibir
`income.created` / `expense.created` con `communicationChannel` presente.

## 8. Estructuras JSON y autenticación

**Autenticación app↔backend propio** (no relacionada con Meta):
- Licencia firmada V2 (ECDSA P-256, `server/automationSecurity.ts:94-178`)
  → `POST /api/automation-token` → JWT HS256 propio
  (`AUTOMATION_JWT_SECRET`, 15 min, claims `iss=private-balance-automation`,
  `aud=private-balance-automation-proxy`, `sub=deviceCode`) → usado como
  Bearer en `/api/automation` y `/api/communication-channel`.

**Autenticación backend↔n8n:**
- Bearer estático `N8N_INTERNAL_TOKEN` en el header `Authorization` de cada
  llamada a los 3 webhooks n8n (`server/automation/webhookDispatcher.ts:113-123`).
- Headers de idempotencia: `Idempotency-Key` y `X-Private-Balance-Event-Id`
  (mismo valor, el `eventId` UUID).

**Autenticación n8n↔Evolution:** no vive en este repo (credencial de n8n
exclusivamente, según `docs/05_EVOLUTION_API.md` y
`docs/AUTOMATION_HUB.md:131`).

**Contrato JSON genérico enviado a n8n** (`docs/AUTOMATION_HUB.md:81-92`):
```json
{
  "eventId": "uuid-v4",
  "event": "income.created | expense.created | calendar.created | device.provision.requested | device.whatsapp.connect.requested | communication.whatsapp.*",
  "createdAt": "ISO-8601",
  "schemaVersion": 1,
  "data": {},
  "deviceCode": "PB-XXXX-XXXX-XXXX",
  "receivedAt": "ISO-8601",
  "source": "private-balance-pwa"
}
```
Con `communicationChannel`, `instanceName`, `whatsappNumber` añadidos cuando
hay canal WhatsApp activo (`server/automation/eventDispatcher.ts:118-125`).

**Payload específico para conexión WhatsApp** (evento síncrono, minimalista,
`docs/AUTOMATION_HUB.md:113-119`):
```json
{ "event": "device.whatsapp.connect.requested", "userCode": "PB-USER-<uuid>", "deviceCode": "PB-DEVICE-<uuid>" }
```

**Respuesta esperada de n8n para conexión** (normalizada en el cliente por
`normalizeWhatsAppConnectResponse`,
`src/services/communicationChannelService.ts:368-465`): `success`, `event`,
`instanceName`, `status`, `qrCode` (imagen HTTPS o base64 PNG/JPEG/WebP) y/o
`pairingCode`.

> **Punto de mayor acoplamiento a Evolution:** el modelo "instancia + QR +
> pairing code" es propio de WhatsApp Web (Evolution) y **no existe** en
> WhatsApp Cloud API (que usa `phone_number_id`, plantillas aprobadas por
> Meta y webhooks de Meta, sin QR/pairing). Este contrato tendrá que
> rediseñarse en la migración.

**Tabla Neon `communication_channels`** (esquema final tras migraciones):
`id, user_code, device_code, provider CHECK(whatsapp|email|telegram|signal|sms),
instance_name, instance_id, phone_number, status
CHECK(not_configured|pending|connecting|connected|disconnected|revoked|error),
preferences JSONB, provider_metadata JSONB, owner_jid, profile_name,
profile_photo, connected_at, last_seen_at, created_at, updated_at`, con
índice único `(user_code, device_code, provider)`.

## 9. Hallazgos negativos (ausencias confirmadas)

- No hay SDK ni dependencia npm de WhatsApp/Meta/Evolution/n8n en
  `package.json` — toda la integración es HTTP directa vía `fetch`.
- No hay deep links `wa.me`, `whatsapp://` ni botones "compartir por
  WhatsApp" en ningún componente de `src/`.
- No hay ninguna mención a "WhatsApp Cloud API", "Graph API" o "Meta
  Business" en `docs/` ni en el código — la migración es puramente
  greenfield sobre la arquitectura actual.
- No hay carpetas `functions/` ni `supabase/functions/`; el único backend
  es Vercel (`api/` + `server/`).
- No hay llamadas directas del cliente a Evolution API ni a n8n: todo pasa
  por `/api/automation*` y `/api/communication-channel`, reforzado por el
  guard de build en `vite.config.ts`.

## 10. Archivos clave a intervenir en la migración (referencia rápida)

| Área | Archivo |
|---|---|
| Router de eventos → webhook destino | `server/automation/webhookDispatcher.ts` |
| Construcción de payload hacia n8n | `server/automation/eventDispatcher.ts` |
| Resolución de canal activo (Neon) | `server/automation/communicationResolver.ts`, `server/communicationChannelStore.ts` |
| Endpoint público de eventos | `api/automation.ts` |
| Endpoint público de estado de canal | `api/communication-channel.ts` |
| Normalización de respuesta WhatsApp en cliente (QR/pairing, específico de Evolution) | `src/services/communicationChannelService.ts` |
| UI de conexión/gestión del canal | `src/pages/Settings/CommunicationChannelsPage.tsx` |
| Modelo de tipos del canal | `src/types/communicationChannel.ts` |
| Esquema Neon | `server/migrations/002_communication_channels.sql`, `004_whatsapp_channel_sessions.sql`, `005_communication_channel_device_scope.sql` |
| Variables de entorno | `.env.example`, `docs/AUTOMATION_HUB.md` |
| Documentación de arquitectura a actualizar | `docs/05_EVOLUTION_API.md`, `docs/04_N8N_WORKFLOWS.md`, `docs/01_ARCHITECTURE.md`, `docs/00_SYSTEM_ARCHITECTURE_MASTER.md`, `docs/DECISIONS.md` (ADR-003) |

## 11. Implicaciones para las fases siguientes

1. El punto de intermediación (`server/automation/*`, `api/*`) ya existe y
   está bien encapsulado: la migración no requiere tocar el cliente
   PWA/APK si se preserva el contrato hacia `api/automation.ts` y
   `api/communication-channel.ts`.
2. n8n se mantiene como motor de automatización (según el documento de
   migración); lo que cambia es el destino final de los mensajes de
   WhatsApp, que pasará por un nuevo "Backend Comunicaciones" hablando con
   WhatsApp Cloud API en vez de con Evolution.
3. El modelo de datos actual (`instance_name`, `instance_id`, `owner_jid`,
   QR, pairing code) es específico de Evolution/WhatsApp Web y deberá
   convivir en paralelo con un modelo nuevo basado en `phone_number_id` de
   Meta durante la transición, sin eliminar el existente hasta completar
   las pruebas (regla "no eliminar Evolution hasta finalizar todas las
   pruebas").
4. El guard de build en `vite.config.ts` (`FORBIDDEN_CLIENT_SECRETS`)
   deberá ampliarse para bloquear también cualquier secreto de Meta que
   intente filtrarse al bundle cliente.

---

*Esta auditoría no modificó ningún archivo de código funcional. Corresponde
a la Fase 1 ("Auditoría") de la estrategia de migración definida en el
documento de implementación.*

## Actualización — Fase 2 (Abstracción del proveedor)

La Fase 2 introdujo `server/automation/providers/whatsapp/*`, una interfaz
`WhatsAppProvider` con `EvolutionWhatsAppProvider` como única implementación
funcional, y la variable `WHATSAPP_PROVIDER` (por defecto `evolution`). El
comportamiento descrito en este documento no cambió: Evolution sigue
gestionándose enteramente dentro de n8n, y este backend sigue sin llamarla
directamente. Detalle completo en
[provider-abstraction.md](provider-abstraction.md) y
[n8n-current-contracts.md](n8n-current-contracts.md).
