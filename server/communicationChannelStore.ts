import { randomUUID } from 'node:crypto'

import { getNeonClient } from './neonClient.js'

export interface CommunicationChannelRecord {
  id: string
  userCode: string
  deviceCode: string
  provider: 'whatsapp'
  instanceName: string
  instanceId: string | null
  phoneNumber: string | null
  ownerJid: string | null
  profileName: string | null
  profilePhoto: string | null
  status: string
  pairingCode: string | null
  providerMetadata: Record<string, unknown> | null
  connectedAt: string | null
  lastSeenAt: string | null
  createdAt: string
  updatedAt: string
}

const PROVIDER = 'whatsapp'

async function migrate(sql: ReturnType<typeof getNeonClient>) {
  await sql`CREATE TABLE IF NOT EXISTS communication_channels (
    id TEXT PRIMARY KEY,
    user_code TEXT NOT NULL,
    device_code TEXT NOT NULL,
    provider TEXT NOT NULL,
    instance_name TEXT NOT NULL,
    instance_id TEXT,
    phone_number TEXT,
    owner_jid TEXT,
    profile_name TEXT,
    profile_photo TEXT,
    status TEXT NOT NULL,
    pairing_code TEXT,
    provider_metadata JSONB,
    connected_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  )`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS communication_channels_unique ON communication_channels (user_code, device_code, provider)`
}

async function getSqlClient() {
  const sql = getNeonClient()
  await migrate(sql)
  return sql
}

function mapRow(row: Record<string, unknown>): CommunicationChannelRecord {
  return {
    id: String(row.id),
    userCode: String(row.user_code),
    deviceCode: String(row.device_code),
    provider: 'whatsapp',
    instanceName: String(row.instance_name ?? ''),
    instanceId: row.instance_id === null || row.instance_id === undefined ? null : String(row.instance_id),
    phoneNumber: row.phone_number === null || row.phone_number === undefined ? null : String(row.phone_number),
    ownerJid: row.owner_jid === null || row.owner_jid === undefined ? null : String(row.owner_jid),
    profileName: row.profile_name === null || row.profile_name === undefined ? null : String(row.profile_name),
    profilePhoto: row.profile_photo === null || row.profile_photo === undefined ? null : String(row.profile_photo),
    status: String(row.status ?? 'not_configured'),
    pairingCode: row.pairing_code === null || row.pairing_code === undefined ? null : String(row.pairing_code),
    providerMetadata: row.provider_metadata === null || row.provider_metadata === undefined ? null : (row.provider_metadata as Record<string, unknown>),
    connectedAt: row.connected_at === null || row.connected_at === undefined ? null : new Date(row.connected_at as string).toISOString(),
    lastSeenAt: row.last_seen_at === null || row.last_seen_at === undefined ? null : new Date(row.last_seen_at as string).toISOString(),
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  }
}

export async function getCommunicationChannel(userCode: string, deviceCode: string) {
  const sql = await getSqlClient()
  const rows = await sql`
    SELECT * FROM communication_channels
    WHERE user_code = ${userCode}
      AND device_code = ${deviceCode}
      AND provider = ${PROVIDER}
    LIMIT 1
  ` as Record<string, unknown>[]
  if (rows.length === 0) return null
  return mapRow(rows[0])
}

export interface UpsertChannelInput {
  userCode: string
  deviceCode: string
  instanceName: string
  status: string
  pairingCode?: string | null
  instanceId?: string | null
  providerMetadata?: Record<string, unknown> | null
  phoneNumber?: string | null
  ownerJid?: string | null
  profileName?: string | null
  profilePhoto?: string | null
  connectedAt?: string | null
  lastSeenAt?: string | null
}

export async function upsertCommunicationChannel(input: UpsertChannelInput) {
  const sql = await getSqlClient()
  const now = new Date().toISOString()
  const id = randomUUID()
  const rows = await sql`
    INSERT INTO communication_channels (
      id, user_code, device_code, provider,
      instance_name, status, pairing_code, provider_metadata,
      instance_id, phone_number, owner_jid, profile_name, profile_photo,
      connected_at, last_seen_at,
      created_at, updated_at
    ) VALUES (
      ${id}, ${input.userCode}, ${input.deviceCode}, ${PROVIDER},
      ${input.instanceName}, ${input.status}, ${input.pairingCode ?? null}, ${input.providerMetadata ?? null},
      ${input.instanceId ?? null}, ${input.phoneNumber ?? null}, ${input.ownerJid ?? null}, ${input.profileName ?? null}, ${input.profilePhoto ?? null},
      ${input.connectedAt ?? null}, ${input.lastSeenAt ?? null},
      ${now}, ${now}
    )
    ON CONFLICT (user_code, device_code, provider)
    DO UPDATE SET
      instance_name = EXCLUDED.instance_name,
      status = EXCLUDED.status,
      pairing_code = EXCLUDED.pairing_code,
      provider_metadata = EXCLUDED.provider_metadata,
      instance_id = EXCLUDED.instance_id,
      phone_number = EXCLUDED.phone_number,
      owner_jid = EXCLUDED.owner_jid,
      profile_name = EXCLUDED.profile_name,
      profile_photo = EXCLUDED.profile_photo,
      connected_at = EXCLUDED.connected_at,
      last_seen_at = EXCLUDED.last_seen_at,
      updated_at = ${now}
    RETURNING *
  ` as Record<string, unknown>[]
  return mapRow(rows[0])
}

export interface UpdateChannelInput {
  userCode: string
  deviceCode: string
  updates: Partial<Omit<CommunicationChannelRecord, 'id' | 'userCode' | 'deviceCode' | 'provider' | 'createdAt'>>
}

export async function updateCommunicationChannel(input: UpdateChannelInput) {
  const sql = await getSqlClient()
  const now = new Date().toISOString()
  const current = await getCommunicationChannel(input.userCode, input.deviceCode)
  if (!current) return null

  const merged: CommunicationChannelRecord = {
    ...current,
    ...input.updates,
    updatedAt: now,
  }

  await sql`
    UPDATE communication_channels SET
      instance_name = ${merged.instanceName},
      status = ${merged.status},
      pairing_code = ${merged.pairingCode},
      provider_metadata = ${merged.providerMetadata},
      instance_id = ${merged.instanceId},
      phone_number = ${merged.phoneNumber},
      owner_jid = ${merged.ownerJid},
      profile_name = ${merged.profileName},
      profile_photo = ${merged.profilePhoto},
      connected_at = ${merged.connectedAt},
      last_seen_at = ${merged.lastSeenAt},
      updated_at = ${now}
    WHERE user_code = ${input.userCode}
      AND device_code = ${input.deviceCode}
      AND provider = ${PROVIDER}
  `

  return merged
}
