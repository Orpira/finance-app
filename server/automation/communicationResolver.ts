import { neon } from '@neondatabase/serverless'

export interface ActiveCommunicationChannel {
  id: string
  userCode: string
  provider: string
  status: string
  instanceName?: string
  instanceId?: string
  phoneNumber?: string
  ownerJid?: string
  profileName?: string
  profilePhoto?: string
  connectedAt?: string
  lastSeenAt?: string
  preferences?: unknown
  providerMetadata?: unknown
}

interface CommunicationChannelRow {
  id: string | number
  user_code: string
  provider: string
  instance_name: string | null
  instance_id: string | null
  phone_number: string | null
  owner_jid: string | null
  profile_name: string | null
  profile_photo: string | null
  connected_at: string | null
  last_seen_at: string | null
  status: string
  preferences: unknown
  provider_metadata: unknown
}

function isMissingCommunicationTable(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const databaseError = error as { code?: string; message?: string }
  return databaseError.code === '42P01' ||
    databaseError.message?.includes('communication_channels') === true
}

export function normalizeCommunicationInstanceName(value: string | null) {
  return value?.replace(/^=+/, '').trim() || undefined
}

function mapCommunicationChannelRow(row: CommunicationChannelRow) {
  return {
    id: String(row.id),
    userCode: row.user_code,
    provider: row.provider,
    status: row.status,
    instanceName: normalizeCommunicationInstanceName(row.instance_name),
    instanceId: row.instance_id ?? undefined,
    phoneNumber: row.phone_number ?? undefined,
    ownerJid: row.owner_jid ?? undefined,
    profileName: row.profile_name ?? undefined,
    profilePhoto: row.profile_photo ?? undefined,
    connectedAt: row.connected_at ?? undefined,
    lastSeenAt: row.last_seen_at ?? undefined,
    preferences: row.preferences,
    providerMetadata: row.provider_metadata,
  }
}

export async function resolveActiveCommunicationChannels(
  userCode: string,
): Promise<ActiveCommunicationChannel[]> {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) return []

  try {
    const sql = neon(databaseUrl)
    const rows = await sql`
      SELECT id, user_code, provider, instance_name, instance_id, phone_number,
        owner_jid, profile_name, profile_photo, connected_at, last_seen_at,
        status, preferences, provider_metadata
      FROM communication_channels
      WHERE user_code = ${userCode}
        AND status = 'connected'
    ` as CommunicationChannelRow[]

    return rows.map(mapCommunicationChannelRow)
  } catch (error) {
    if (isMissingCommunicationTable(error)) return []
    throw error
  }
}

export async function resolveActiveWhatsappChannel(userCode: string) {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) return null

  try {
    const sql = neon(databaseUrl)
    const rows = await sql`
      SELECT id, user_code, provider, instance_name, instance_id, phone_number,
        owner_jid, profile_name, profile_photo, connected_at, last_seen_at,
        status, preferences, provider_metadata
      FROM communication_channels
      WHERE user_code = ${userCode}
        AND provider = 'whatsapp'
        AND status = 'connected'
      ORDER BY updated_at DESC
      LIMIT 1
    ` as CommunicationChannelRow[]

    const row = rows[0]
    if (!row) return null

    return mapCommunicationChannelRow(row)
  } catch (error) {
    if (isMissingCommunicationTable(error)) return null
    throw error
  }
}
