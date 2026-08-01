# Persistencia del canal meta-cloud

> Fase 4 de la migración `feature/migrate-evolution-to-whatsapp-cloud`.

## Hallazgo previo: dos definiciones en conflicto de `communication_channels`

Antes de diseñar esta migración se auditó el esquema real, tal como pide la
Fase 4 ("Analizar primero: estructura de communication_channels..."). El
resultado fue relevante:

- `server/migrations/002_communication_channels.sql` (+ 004 + 005) definen
  `communication_channels` con **`id BIGSERIAL`**, sin columna
  `pairing_code`, `instance_name` opcional. Es el esquema real: coincide con
  lo que reportan `scripts/list-tables.mjs` /
  `scripts/query-insert_communication_channels.mjs` contra la base de datos
  de verdad, y con `server/automation/communicationResolver.ts`.
- `server/communicationChannelStore.ts` define su **propia** tabla
  `communication_channels`, con **`id TEXT`**, `pairing_code`,
  `instance_name TEXT NOT NULL` — un esquema distinto e incompatible con el
  anterior. Sus funciones de escritura (`upsertCommunicationChannel`,
  `updateCommunicationChannel`) no tienen ningún caller en el repositorio
  (confirmado por búsqueda exhaustiva); solo `getCommunicationChannel` se usa
  (lectura pura vía `SELECT *`, que no falla aunque falten columnas). Es
  código muerto que nunca llegó a aplicarse en producción.

**Decisión:** la migración 006 y el nuevo repositorio
(`server/communication/repositories/metaChannelRepository.ts`) extienden
**únicamente** el esquema real (BIGSERIAL). No se tocó
`communicationChannelStore.ts` — arreglarlo o retirarlo es una decisión
independiente, fuera del alcance de esta fase, y se documenta aquí como
deuda técnica conocida.

## Qué significa `provider` frente a `whatsapp_backend`

En el esquema real, `provider` es el **tipo de canal** (`whatsapp`, `email`,
`telegram`, `signal`, `sms` — CHECK constraint de la migración 002) y para
WhatsApp siempre vale `'whatsapp'`, tanto para Evolution como para
meta-cloud. La migración 006 añade una columna **nueva y distinta**,
`whatsapp_backend` (`'evolution' | 'meta-cloud'`), para esa segunda
dimensión — sin reinterpretar ni romper el significado original de
`provider`.

## Por qué cada backend tiene su propia fila

El índice único anterior
(`communication_channels_user_device_provider_idx`, de la migración 005) era
`(user_code, device_code, provider)`. Como `provider` siempre es
`'whatsapp'`, ese índice solo permitía **una fila de WhatsApp por
usuario/dispositivo**, sin importar el backend. Eso habría tenido dos
consecuencias no deseadas:

1. Conectar meta-cloud sobrescribiría la fila de Evolution (perdiendo su
   `instance_name`/`owner_jid`/etc.), y viceversa.
2. El rollback (`WHATSAPP_PROVIDER=evolution`) no podría restaurar el último
   estado conocido de Evolution, porque ya no existiría.

La migración 006 amplía el índice único a
`(user_code, device_code, provider, whatsapp_backend)` — cada backend
conserva su propia fila. Qué backend es "el efectivo" para un usuario lo
decide la aplicación (`WHATSAPP_PROVIDER`), no una restricción de base de
datos: ver [provider-routing.md](provider-routing.md).

## Migraciones

- `server/migrations/006_add_meta_cloud_channel_fields.sql` — columnas
  nuevas (aditivas, todas `NOT NULL DEFAULT` o nullable), backfill de
  `whatsapp_backend='evolution'` para filas existentes, ampliación del
  índice único, extensión del CHECK de `status` (añade `configuring` y
  `disabled`). Incluye bloque de rollback manual comentado.
- `server/migrations/007_communication_message_correlations.sql` — tabla
  nueva, sin relación con Evolution; se autoaplica en tiempo de ejecución
  (patrón ya usado por los repositorios de la Fase 3), a diferencia de 006
  que, como toda la familia 002/004/005, se aplica manualmente contra Neon.

## Modelo final (columnas relevantes para meta-cloud)

| Columna | Origen | Uso |
|---|---|---|
| `user_code`, `device_code`, `provider` | 002 | Identidad + tipo de canal (siempre `'whatsapp'`) |
| `whatsapp_backend` | 006 | `'evolution'` \| `'meta-cloud'` |
| `status` | 002 (CHECK ampliado en 006) | `not_configured\|pending\|connecting\|configuring\|connected\|disconnected\|disabled\|revoked\|error` |
| `mode` | 006 | `'simulation'\|'test'\|'production'` |
| `enabled` | 006 | Activación lógica del canal |
| `phone_number` | 002 | Número del destinatario (la propietaria) — mismo campo que usa Evolution |
| `phone_number_id`, `waba_id` | 006 | Identificadores de Meta (globales al entorno, guardados aquí solo como referencia) |
| `webhook_enabled`, `automation_enabled`, `inbound_forwarding_enabled` | 006 | Reflejan las flags de configuración en el momento del connect |
| `connected_at` | 002 | Reutilizado tal cual para "última conexión" |
| `last_disconnected_at`, `last_inbound_at`, `last_outbound_at`, `last_error_code`, `last_error_at` | 006 | Actividad técnica, ver más abajo |
| `provider_metadata` | 002 | Reutilizado para preferencias sin columna dedicada |

**No se guarda:** `META_ACCESS_TOKEN`, `META_APP_SECRET`,
`META_VERIFY_TOKEN`, `N8N_COMMUNICATION_API_KEY`, ni el texto de ningún
mensaje. Esos permanecen exclusivamente en variables de entorno.

## `metaChannelRepository.ts`

```ts
getMetaChannel(userCode, deviceCode): Promise<MetaChannelRecord | null>
getMetaChannelByPhoneNumber(phoneNumber): Promise<MetaChannelRecord | null>
upsertMetaChannel(input): Promise<MetaChannelRecord>
touchMetaChannelInbound(phoneNumber, timestamp): Promise<void>
touchMetaChannelOutbound(phoneNumber, timestamp): Promise<void>
```

`getMetaChannelByPhoneNumber` existe porque los eventos entrantes/salientes
solo traen un número de teléfono (`senderPhone`/`recipient`), no
`userCode`/`deviceCode` — es la búsqueda inversa que permite actualizar
`last_inbound_at`/`last_outbound_at` sin que el backend necesite conocer la
identidad del usuario en ese punto del flujo.

## Comportamiento de `MetaCloudWhatsAppProvider` (actualizado)

- **connect**: si `WHATSAPP_CLOUD_ENABLED=false` → `not_configured`, sin
  persistir nada. Si está habilitado pero no se pudo resolver `userCode` →
  error explícito, sin persistir (evita crear filas huérfanas). Si todo está
  bien → `upsertMetaChannel` con `status='connected'`,
  `mode` = `'production'` si `ALLOW_REAL_SEND=true`, si no `'simulation'`
  (`'test'` queda reservado para cuando exista una señal explícita de
  entorno de prueba distinta de simulación — no se distingue todavía, ver
  "Deuda técnica").
- **disconnect**: `status='disabled'`, `enabled=false`,
  `automation_enabled=false`, `last_disconnected_at=ahora`. No revoca
  tokens de Meta ni borra la fila.
- **status**: combina la fila persistida (si `userCode` se pudo resolver)
  con `metaCloudConfig` — refleja lo global (¿está habilitado el servicio?)
  y lo particular (¿este usuario tiene el canal conectado?).
- **test**: sin cambios de persistencia respecto a la Fase 3 (sigue usando
  `metaCloudClient` directamente cuando hay envío real autorizado).
- **preferences.updated**: si el canal ya existe, persiste el payload de
  preferencias en `provider_metadata.preferences` y responde
  `persisted: true` (antes, en la Fase 3, siempre respondía `false`). Si el
  canal no existe todavía, sigue respondiendo `false` — no tiene sentido
  guardar preferencias de un canal no conectado.

## Pruebas de coexistencia (sección 39 de la Fase 4)

`test/metaChannelRepository.test.ts` cubre lectura/escritura contra el mock
de Neon. La coexistencia Evolution/meta-cloud en filas separadas se
garantiza por diseño del índice único ampliado (no requiere lógica de
aplicación adicional) — documentado aquí en vez de con un test de
integración contra una base de datos real, que este entorno no tiene
disponible.

## Deuda técnica

- El modo `'test'` (distinto de `'simulation'`/`'production'`) no se
  determina automáticamente todavía; hoy solo se alterna entre los otros
  dos según `WHATSAPP_CLOUD_ALLOW_REAL_SEND`.
- `communicationChannelStore.ts` sigue siendo código muerto con un esquema
  incompatible con la tabla real. No se tocó en esta fase (fuera de
  alcance), pero debería limpiarse o corregirse en una fase posterior.
- `provider_metadata.preferences` no está tipado ni validado — es un
  volcado del payload recibido, consistente con cómo Evolution/n8n ya
  manejan preferencias hoy.
