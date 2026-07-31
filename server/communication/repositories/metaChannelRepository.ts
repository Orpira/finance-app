import { getNeonClient } from '../../neonClient.js'

/**
 * Persiste el estado del canal meta-cloud sobre la tabla real
 * `communication_channels` (BIGSERIAL id, definida en
 * server/migrations/002_communication_channels.sql y ampliada en
 * server/migrations/006_add_meta_cloud_channel_fields.sql). Deliberadamente
 * NO reutiliza server/communicationChannelStore.ts: ese archivo define su
 * propia tabla con id TEXT y columnas distintas (pairing_code,
 * instance_name NOT NULL) que nunca llegó a aplicarse en producción — ver
 * la nota al inicio de la migración 006.
 *
 * `provider` sigue siendo siempre 'whatsapp' (tipo de canal); el backend
 * (evolution | meta-cloud) vive en la columna nueva `whatsapp_backend`, y
 * cada backend tiene su propia fila por (user_code, device_code) gracias al
 * índice único ampliado en la migración 006 — así Evolution y meta-cloud
 * conservan su estado por separado y el rollback (WHATSAPP_PROVIDER=evolution)
 * no pierde datos.
 */
const PROVIDER = 'whatsapp'
const BACKEND = 'meta-cloud'

export interface MetaChannelRecord {
  id: string
  userCode: string
  deviceCode: string | null
  status: string
  mode: string | null
  enabled: boolean
  phoneNumber: string | null
  phoneNumberId: string | null
  wabaId: string | null
  maskedPhoneNumber: string | null
  displayName: string | null
  webhookEnabled: boolean
  automationEnabled: boolean
  inboundForwardingEnabled: boolean
  connectedAt: string | null
  lastDisconnectedAt: string | null
  lastSeenAt: string | null
  lastInboundAt: string | null
  lastOutboundAt: string | null
  lastErrorCode: string | null
  lastErrorAt: string | null
  providerMetadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

function toIso(value: unknown): string | null {
  return value ? new Date(value as string).toISOString() : null
}

function toStringOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value)
}

function mapRow(row: Record<string, unknown>): MetaChannelRecord {
  return {
    id: String(row.id),
    userCode: String(row.user_code),
    deviceCode: toStringOrNull(row.device_code),
    status: String(row.status),
    mode: toStringOrNull(row.mode),
    enabled: Boolean(row.enabled),
    phoneNumber: toStringOrNull(row.phone_number),
    phoneNumberId: toStringOrNull(row.phone_number_id),
    wabaId: toStringOrNull(row.waba_id),
    maskedPhoneNumber: toStringOrNull(row.masked_phone_number),
    displayName: toStringOrNull(row.display_name),
    webhookEnabled: Boolean(row.webhook_enabled),
    automationEnabled: Boolean(row.automation_enabled),
    inboundForwardingEnabled: Boolean(row.inbound_forwarding_enabled),
    connectedAt: toIso(row.connected_at),
    lastDisconnectedAt: toIso(row.last_disconnected_at),
    lastSeenAt: toIso(row.last_seen_at),
    lastInboundAt: toIso(row.last_inbound_at),
    lastOutboundAt: toIso(row.last_outbound_at),
    lastErrorCode: toStringOrNull(row.last_error_code),
    lastErrorAt: toIso(row.last_error_at),
    providerMetadata: (row.provider_metadata as Record<string, unknown> | null) ?? null,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  }
}

export async function getMetaChannel(userCode: string, deviceCode: string): Promise<MetaChannelRecord | null> {
  const sql = getNeonClient()
  const rows = await sql`
    SELECT * FROM communication_channels
    WHERE user_code = ${userCode}
      AND device_code = ${deviceCode}
      AND provider = ${PROVIDER}
      AND whatsapp_backend = ${BACKEND}
    LIMIT 1
  ` as Record<string, unknown>[]
  return rows[0] ? mapRow(rows[0]) : null
}

export async function getMetaChannelByPhoneNumber(phoneNumber: string): Promise<MetaChannelRecord | null> {
  const sql = getNeonClient()
  const rows = await sql`
    SELECT * FROM communication_channels
    WHERE phone_number = ${phoneNumber}
      AND provider = ${PROVIDER}
      AND whatsapp_backend = ${BACKEND}
    ORDER BY updated_at DESC
    LIMIT 1
  ` as Record<string, unknown>[]
  return rows[0] ? mapRow(rows[0]) : null
}

export interface UpsertMetaChannelInput {
  userCode: string
  deviceCode: string
  status: string
  mode: string | null
  enabled: boolean
  phoneNumber?: string | null
  phoneNumberId?: string | null
  wabaId?: string | null
  maskedPhoneNumber?: string | null
  displayName?: string | null
  webhookEnabled: boolean
  automationEnabled: boolean
  inboundForwardingEnabled: boolean
  providerMetadata?: Record<string, unknown> | null
  connectedAt?: string | null
  lastDisconnectedAt?: string | null
  lastErrorCode?: string | null
  lastErrorAt?: string | null
}

export async function upsertMetaChannel(input: UpsertMetaChannelInput): Promise<MetaChannelRecord> {
  const sql = getNeonClient()
  const now = new Date().toISOString()
  const rows = await sql`
    INSERT INTO communication_channels (
      user_code, device_code, provider, whatsapp_backend, instance_name,
      status, mode, enabled,
      phone_number, phone_number_id, waba_id, masked_phone_number, display_name,
      webhook_enabled, automation_enabled, inbound_forwarding_enabled,
      provider_metadata, connected_at, last_disconnected_at, last_error_code, last_error_at,
      last_seen_at, created_at, updated_at
    ) VALUES (
      ${input.userCode}, ${input.deviceCode}, ${PROVIDER}, ${BACKEND}, ${BACKEND},
      ${input.status}, ${input.mode}, ${input.enabled},
      ${input.phoneNumber ?? null}, ${input.phoneNumberId ?? null}, ${input.wabaId ?? null},
      ${input.maskedPhoneNumber ?? null}, ${input.displayName ?? null},
      ${input.webhookEnabled}, ${input.automationEnabled}, ${input.inboundForwardingEnabled},
      ${JSON.stringify(input.providerMetadata ?? {})}, ${input.connectedAt ?? null},
      ${input.lastDisconnectedAt ?? null}, ${input.lastErrorCode ?? null}, ${input.lastErrorAt ?? null},
      ${now}, ${now}, ${now}
    )
    ON CONFLICT (user_code, device_code, provider, whatsapp_backend) DO UPDATE SET
      status = EXCLUDED.status,
      mode = EXCLUDED.mode,
      enabled = EXCLUDED.enabled,
      phone_number = COALESCE(EXCLUDED.phone_number, communication_channels.phone_number),
      phone_number_id = COALESCE(EXCLUDED.phone_number_id, communication_channels.phone_number_id),
      waba_id = COALESCE(EXCLUDED.waba_id, communication_channels.waba_id),
      masked_phone_number = COALESCE(EXCLUDED.masked_phone_number, communication_channels.masked_phone_number),
      display_name = COALESCE(EXCLUDED.display_name, communication_channels.display_name),
      webhook_enabled = EXCLUDED.webhook_enabled,
      automation_enabled = EXCLUDED.automation_enabled,
      inbound_forwarding_enabled = EXCLUDED.inbound_forwarding_enabled,
      provider_metadata = EXCLUDED.provider_metadata,
      connected_at = COALESCE(EXCLUDED.connected_at, communication_channels.connected_at),
      last_disconnected_at = COALESCE(EXCLUDED.last_disconnected_at, communication_channels.last_disconnected_at),
      last_error_code = EXCLUDED.last_error_code,
      last_error_at = EXCLUDED.last_error_at,
      last_seen_at = NOW(),
      updated_at = NOW()
    RETURNING *
  ` as Record<string, unknown>[]
  return mapRow(rows[0]!)
}

export async function touchMetaChannelInbound(phoneNumber: string, timestamp: string): Promise<void> {
  const sql = getNeonClient()
  await sql`
    UPDATE communication_channels
    SET last_inbound_at = ${timestamp}, updated_at = NOW()
    WHERE phone_number = ${phoneNumber}
      AND provider = ${PROVIDER}
      AND whatsapp_backend = ${BACKEND}
  `
}

export async function touchMetaChannelOutbound(phoneNumber: string, timestamp: string): Promise<void> {
  const sql = getNeonClient()
  await sql`
    UPDATE communication_channels
    SET last_outbound_at = ${timestamp}, updated_at = NOW()
    WHERE phone_number = ${phoneNumber}
      AND provider = ${PROVIDER}
      AND whatsapp_backend = ${BACKEND}
  `
}
