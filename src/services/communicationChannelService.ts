import { db } from '../database/db'
import type { PrivateBalanceEvent } from '../types/automation'
import type {
  CommunicationChannel,
  CommunicationChannelStatus,
  WhatsAppNotificationPreferences,
} from '../types/communicationChannel'
import {
  automationGatewayRequest,
  parseAutomationGatewayJson,
  sendAutomationEvent,
} from './automationHubService'
import { getOrCreateDeviceIdentity } from './deviceIdentityService'

const WHATSAPP_CHANNEL_ID = 'whatsapp' as const
const DEFAULT_INSTANCE_NAME = 'private-balance'

interface RemoteCommunicationChannel {
  instanceName?: string
  instanceId?: string | null
  phoneNumber?: string | null
  ownerJid?: string | null
  profileName?: string | null
  profilePhoto?: string | null
  status?: string
  pairingCode?: string | null
  providerMetadata?: Record<string, unknown> | null
  connectedAt?: string | null
  lastSeenAt?: string | null
  updatedAt?: string
}

export interface CommunicationChannelActionResult {
  channel: CommunicationChannel
  delivered: boolean
  error?: string
  message?: string
}

export interface NormalizedWhatsAppConnectResponse {
  status: Extract<CommunicationChannelStatus, 'connected' | 'connecting' | 'disconnected' | 'error'>
  qrCode: string | null
  pairingCode: string | null
  instanceName?: string
  instanceId?: string
  phoneNumber?: string
  ownerJid?: string
  profileName?: string
  profilePhoto?: string
  connectedAt?: string
  lastSeenAt?: string
  providerMetadata?: Record<string, unknown>
  message: string
}

function normalizeInstanceName(value?: string) {
  return value?.replace(/^=+/, '').trim() || undefined
}

export function normalizeWhatsAppPhoneNumber(value: string) {
  return value.replace(/[^0-9]/g, '')
}

function createEventId() {
  if (typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`
}

function createDefaultChannel(): CommunicationChannel {
  const now = new Date().toISOString()
  return {
    id: WHATSAPP_CHANNEL_ID,
    type: 'whatsapp',
    provider: 'evolution-api',
    instanceName: DEFAULT_INSTANCE_NAME,
    status: 'not_configured',
    notifyIncomeCreated: false,
    notifyExpenseCreated: false,
    notifyCalendarReminder: false,
    notifyBackupCompleted: false,
    createdAt: now,
    updatedAt: now,
  }
}

function normalizeRemoteStatus(value?: string): CommunicationChannelStatus | undefined {
  const status = value?.toLowerCase().replace(/[\s-]+/g, '_')
  if (['open', 'connected', 'conectado'].includes(status ?? '')) return 'connected'
  if (['connecting', 'pending', 'qr', 'pendiente'].includes(status ?? '')) return 'connecting'
  if (['close', 'closed', 'disconnected', 'revoked', 'desconectado'].includes(status ?? '')) {
    return 'disconnected'
  }
  if (['not_configured', 'notconfigured'].includes(status ?? '')) return 'not_configured'
  if (['error', 'failed'].includes(status ?? '')) return 'error'
  return undefined
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function mapRemoteChannelToLocal(
  remote: RemoteCommunicationChannel,
  existing: CommunicationChannel | null,
): CommunicationChannel {
  const status = normalizeRemoteStatus(remote.status) ?? existing?.status ?? 'not_configured'
  const now = new Date().toISOString()

  return {
    ...(existing ?? createDefaultChannel()),
    id: WHATSAPP_CHANNEL_ID,
    type: 'whatsapp',
    provider: 'evolution-api',
    instanceName:
      normalizeInstanceName(remote.instanceName) ||
      normalizeInstanceName(existing?.instanceName) ||
      DEFAULT_INSTANCE_NAME,
    ...(remote.instanceId ? { instanceId: remote.instanceId } : {}),
    ...(remote.phoneNumber
      ? {
          phoneNumber: String(remote.phoneNumber),
          connectedNumber: String(remote.phoneNumber),
        }
      : {}),
    ...(remote.ownerJid ? { ownerJid: String(remote.ownerJid) } : {}),
    ...(remote.profileName ? { profileName: String(remote.profileName) } : {}),
    ...(remote.profilePhoto ? { profilePhoto: String(remote.profilePhoto) } : {}),
    status,
    pairingCode: status === 'connected' ? undefined : (remote.pairingCode ?? existing?.pairingCode),
    qrCode: status === 'connected' ? undefined : existing?.qrCode,
    ...(remote.providerMetadata ? { providerMetadata: remote.providerMetadata } : {}),
    ...(remote.connectedAt ? { connectedAt: String(remote.connectedAt) } : {}),
    ...(remote.lastSeenAt
      ? { lastSeenAt: String(remote.lastSeenAt) }
      : remote.updatedAt
        ? { lastSeenAt: String(remote.updatedAt) }
        : {}),
    updatedAt: remote.updatedAt ?? now,
  }
}

async function fetchRemoteWhatsAppChannel() {
  const response = await automationGatewayRequest('/api/communication-channel', {
    method: 'GET',
    headers: { 'X-Private-Balance-User-Code': (await getOrCreateDeviceIdentity()).userCode },
  })

  if (!response.ok) return null

  const body = await parseAutomationGatewayJson(response)
  const payload = asObject(body)
  const channel = asObject(payload?.channel)
  if (!channel) return null

  return {
    instanceName: typeof channel.instanceName === 'string' ? channel.instanceName : undefined,
    instanceId: typeof channel.instanceId === 'string' ? channel.instanceId : null,
    phoneNumber: typeof channel.phoneNumber === 'string' ? channel.phoneNumber : null,
    ownerJid: typeof channel.ownerJid === 'string' ? channel.ownerJid : null,
    profileName: typeof channel.profileName === 'string' ? channel.profileName : null,
    profilePhoto: typeof channel.profilePhoto === 'string' ? channel.profilePhoto : null,
    status: typeof channel.status === 'string' ? channel.status : undefined,
    pairingCode: typeof channel.pairingCode === 'string' ? channel.pairingCode : null,
    providerMetadata: asObject(channel.providerMetadata) ?? null,
    connectedAt: typeof channel.connectedAt === 'string' ? channel.connectedAt : null,
    lastSeenAt: typeof channel.lastSeenAt === 'string' ? channel.lastSeenAt : null,
    updatedAt: typeof channel.updatedAt === 'string' ? channel.updatedAt : undefined,
  } satisfies RemoteCommunicationChannel
}

export async function getWhatsAppChannel() {
  const channel = await db.communicationChannels.get(WHATSAPP_CHANNEL_ID)

  // Dexie puede contener el valor usado por versiones anteriores.
  if (channel && (channel.status as string) === 'pending') {
    const migrated = { ...channel, status: 'connecting' as const }
    await db.communicationChannels.put(migrated)
  }

  const local = channel
    ? { ...channel, status: (channel.status as string) === 'pending' ? 'connecting' : channel.status }
    : null

  try {
    const remote = await fetchRemoteWhatsAppChannel()
    if (!remote) return local
    const synced = mapRemoteChannelToLocal(remote, local)
    await db.communicationChannels.put(synced)
    return synced
  } catch {
    // Si no hay JWT o la red falla, mantenemos el último estado local.
    return local
  }
}

export async function createOrUpdateWhatsAppChannel(
  changes: Partial<Omit<CommunicationChannel, 'id' | 'type' | 'provider' | 'createdAt'>> = {},
) {
  const existing = await getWhatsAppChannel()
  const channel: CommunicationChannel = {
    ...(existing ?? createDefaultChannel()),
    ...changes,
    id: WHATSAPP_CHANNEL_ID,
    type: 'whatsapp',
    provider: 'evolution-api',
    instanceName:
      normalizeInstanceName(changes.instanceName) ||
      normalizeInstanceName(existing?.instanceName) ||
      DEFAULT_INSTANCE_NAME,
    updatedAt: new Date().toISOString(),
  }
  await db.communicationChannels.put(channel)
  return channel
}

function valueAtPath(value: unknown, path: string[]): unknown {
  let current = value
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

function firstString(value: unknown, paths: string[][]) {
  for (const path of paths) {
    const match = valueAtPath(value, path)
    if (typeof match === 'string' && match.trim()) return match.trim()
  }
  return undefined
}

function firstRecord(value: unknown, paths: string[][]) {
  for (const path of paths) {
    const match = valueAtPath(value, path)
    if (match && typeof match === 'object' && !Array.isArray(match)) {
      return match as Record<string, unknown>
    }
  }
  return undefined
}

function normalizeQrCode(value?: string) {
  if (!value || value.length > 2_000_000) return undefined
  if (/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(value)) return value
  if (/^https:\/\//i.test(value)) return value
  if (/^[a-z0-9+/=\s]+$/i.test(value) && value.replace(/\s/g, '').length > 100) {
    return `data:image/png;base64,${value.replace(/\s/g, '')}`
  }
  return undefined
}

function normalizeStatus(value?: string): CommunicationChannelStatus | undefined {
  const status = value?.toLowerCase().replace(/[\s-]+/g, '_')
  if (['open', 'connected', 'conectado'].includes(status ?? '')) return 'connected'
  if (['connecting', 'pending', 'qr', 'pendiente'].includes(status ?? '')) return 'connecting'
  if (['close', 'closed', 'disconnected', 'desconectado'].includes(status ?? '')) return 'disconnected'
  if (['error', 'failed'].includes(status ?? '')) return 'error'
  return undefined
}

function responseChanges(data?: Record<string, unknown>) {
  const qrCode = normalizeQrCode(firstString(data, [
    ['data', 'data', 'base64'], ['data', 'base64'], ['data', 'qrCode'],
    ['data', 'qrcode'], ['base64'], ['qrCode'], ['qrcode'], ['pairing', 'qrCode'],
  ]))
  const status = normalizeStatus(firstString(data, [
    ['data', 'data', 'instance', 'state'], ['data', 'instance', 'state'],
    ['data', 'data', 'status'], ['data', 'status'], ['status'], ['state'],
  ]))
  const connectedNumber = firstString(data, [
    ['data', 'data', 'connectedNumber'], ['data', 'connectedNumber'],
    ['data', 'data', 'phoneNumber'], ['data', 'phoneNumber'],
    ['data', 'data', 'number'], ['data', 'number'],
    ['connectedNumber'], ['phoneNumber'], ['number'],
  ])
  const instanceName = normalizeInstanceName(firstString(data, [
    ['data', 'data', 'instanceName'], ['data', 'instanceName'], ['instanceName'],
  ]))
  const instanceId = firstString(data, [
    ['data', 'data', 'instanceId'], ['data', 'instanceId'], ['instanceId'],
  ])
  const pairingCode = firstString(data, [
    ['data', 'data', 'pairingCode'], ['data', 'pairingCode'],
    ['data', 'data', 'qrcode', 'pairingCode'], ['data', 'qrcode', 'pairingCode'],
    ['qrcode', 'pairingCode'], ['pairingCode'],
  ])
  const ownerJid = firstString(data, [
    ['data', 'data', 'ownerJid'], ['data', 'ownerJid'], ['ownerJid'],
  ])
  const profileName = firstString(data, [
    ['data', 'data', 'profileName'], ['data', 'profileName'], ['profileName'],
  ])
  const profilePhoto = firstString(data, [
    ['data', 'data', 'profilePhoto'], ['data', 'profilePhoto'],
    ['data', 'data', 'profilePictureUrl'], ['data', 'profilePictureUrl'],
    ['profilePhoto'], ['profilePictureUrl'],
  ])
  const connectedAt = firstString(data, [
    ['data', 'data', 'connectedAt'], ['data', 'connectedAt'], ['connectedAt'],
  ])
  const lastSeenAt = firstString(data, [
    ['data', 'data', 'lastSeenAt'], ['data', 'lastSeenAt'], ['lastSeenAt'],
  ])
  const providerMetadata = firstRecord(data, [
    ['data', 'data', 'providerMetadata'],
    ['data', 'providerMetadata'],
    ['providerMetadata'],
  ])

  const message = firstString(data, [
    ['data', 'data', 'message'], ['data', 'message'], ['message'],
  ])
  const success = valueAtPath(data, ['success'])

  return {
    qrCode,
    status,
    connectedNumber,
    instanceName,
    instanceId,
    pairingCode,
    ownerJid,
    profileName,
    profilePhoto,
    connectedAt,
    lastSeenAt,
    providerMetadata,
    message,
    success,
  }
}

export function normalizeWhatsAppConnectResponse(
  response?: Record<string, unknown>,
): NormalizedWhatsAppConnectResponse {
  const remote = responseChanges(response)

  if (remote.status === 'connected') {
    return {
      status: 'connected',
      qrCode: null,
      pairingCode: null,
      ...(remote.instanceName ? { instanceName: remote.instanceName } : {}),
      ...(remote.instanceId ? { instanceId: remote.instanceId } : {}),
      ...(remote.connectedNumber ? { phoneNumber: remote.connectedNumber } : {}),
      ...(remote.ownerJid ? { ownerJid: remote.ownerJid } : {}),
      ...(remote.profileName ? { profileName: remote.profileName } : {}),
      ...(remote.profilePhoto ? { profilePhoto: remote.profilePhoto } : {}),
      ...(remote.connectedAt ? { connectedAt: remote.connectedAt } : {}),
      ...(remote.lastSeenAt ? { lastSeenAt: remote.lastSeenAt } : {}),
      ...(remote.providerMetadata ? { providerMetadata: remote.providerMetadata } : {}),
      message: remote.message ?? 'WhatsApp ya está conectado.',
    }
  }

  if (remote.success === false) {
    return {
      status: 'error',
      qrCode: null,
      pairingCode: null,
      ...(remote.instanceName ? { instanceName: remote.instanceName } : {}),
      message: remote.message ?? 'No se pudo conectar WhatsApp.',
    }
  }

  if (remote.pairingCode) {
    return {
      status: 'connecting',
      qrCode: null,
      pairingCode: remote.pairingCode,
      ...(remote.instanceName ? { instanceName: remote.instanceName } : {}),
      ...(remote.instanceId ? { instanceId: remote.instanceId } : {}),
      ...(remote.connectedNumber ? { phoneNumber: remote.connectedNumber } : {}),
      message: remote.message ?? 'Código de vinculación generado.',
    }
  }

  if (remote.qrCode) {
    return {
      status: 'connecting',
      qrCode: remote.qrCode,
      pairingCode: null,
      ...(remote.instanceName ? { instanceName: remote.instanceName } : {}),
      ...(remote.instanceId ? { instanceId: remote.instanceId } : {}),
      message: remote.message ?? 'QR alternativo generado.',
    }
  }

  if (remote.status === 'disconnected') {
    return {
      status: 'disconnected',
      qrCode: null,
      pairingCode: null,
      ...(remote.instanceName ? { instanceName: remote.instanceName } : {}),
      message: remote.message ?? 'WhatsApp está desconectado.',
    }
  }

  if (remote.status === 'connecting') {
    return {
      status: 'connecting',
      qrCode: null,
      pairingCode: null,
      ...(remote.instanceName ? { instanceName: remote.instanceName } : {}),
      message: remote.message ?? 'WhatsApp está pendiente de vinculación.',
    }
  }

  return {
    status: 'error',
    qrCode: null,
    pairingCode: null,
    ...(remote.instanceName ? { instanceName: remote.instanceName } : {}),
    message: remote.message ?? 'No se pudo interpretar la respuesta de WhatsApp.',
  }
}

function logWhatsAppResponse(
  response: Record<string, unknown> | undefined,
  normalized: NormalizedWhatsAppConnectResponse,
) {
  if (!import.meta.env.DEV) return

  const remote = responseChanges(response)
  console.info('[Private Balance] Respuesta de /api/automation', {
    success: remote.success,
    status: remote.status,
    instanceName: remote.instanceName,
    message: remote.message,
    pairingCode: remote.pairingCode ? '[código recibido]' : null,
    qrCode: remote.qrCode ? '[QR recibido]' : null,
  })
  console.info('[Private Balance] Estado WhatsApp normalizado', {
    ...normalized,
    pairingCode: normalized.pairingCode ? '[código recibido]' : null,
    qrCode: normalized.qrCode ? '[QR recibido]' : null,
  })
}

async function sendChannelEvent(
  event: PrivateBalanceEvent,
  channel: CommunicationChannel,
  additionalData: Record<string, unknown> = {},
) {
  const identity = await getOrCreateDeviceIdentity()
  const data = event === 'device.whatsapp.connect.requested'
    ? {
        userCode: identity.userCode,
        deviceCode: identity.deviceCode,
        ...additionalData,
      }
    : {
        userCode: identity.userCode,
        deviceCode: identity.deviceCode,
        deviceName: identity.deviceName,
        platform: identity.platform,
        appVersion: identity.appVersion,
        provider: channel.provider,
        instanceName: channel.instanceName,
        ...additionalData,
      }

  return sendAutomationEvent({
    eventId: createEventId(),
    event,
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
    source: 'private-balance-pwa',
    data,
  })
}

async function markDeliveryFailure(error?: string) {
  const updated = await createOrUpdateWhatsAppChannel({ status: 'error' })
  return {
    channel: updated,
    delivered: false,
    error: error ?? 'n8n no respondió. Puedes reintentar sin cerrar la aplicación.',
  }
}

export async function connectWhatsApp(
  requestedPhoneNumber = '',
): Promise<CommunicationChannelActionResult> {
  const phoneNumber = normalizeWhatsAppPhoneNumber(requestedPhoneNumber)
  const channel = await createOrUpdateWhatsAppChannel({
    status: 'connecting',
    qrCode: undefined,
    pairingCode: undefined,
    ...(phoneNumber ? { phoneNumber } : {}),
  })
  const result = await sendChannelEvent(
    'device.whatsapp.connect.requested',
    channel,
    phoneNumber ? { phoneNumber } : {},
  )
  if (!result.delivered) return markDeliveryFailure(result.error)

  const normalized = normalizeWhatsAppConnectResponse(result.data)
  logWhatsAppResponse(result.data, normalized)

  const updated = await createOrUpdateWhatsAppChannel({
    status: normalized.status,
    qrCode: normalized.qrCode ?? undefined,
    pairingCode: normalized.pairingCode ?? undefined,
    ...(normalized.phoneNumber ? {
      phoneNumber: normalized.phoneNumber,
      connectedNumber: normalized.phoneNumber,
    } : {}),
    ...(normalized.instanceName ? { instanceName: normalized.instanceName } : {}),
    ...(normalized.instanceId ? { instanceId: normalized.instanceId } : {}),
    ...(normalized.ownerJid ? { ownerJid: normalized.ownerJid } : {}),
    ...(normalized.profileName ? { profileName: normalized.profileName } : {}),
    ...(normalized.profilePhoto ? { profilePhoto: normalized.profilePhoto } : {}),
    ...(normalized.connectedAt ? { connectedAt: normalized.connectedAt } : {}),
    ...(normalized.lastSeenAt ? { lastSeenAt: normalized.lastSeenAt } : {}),
    ...(normalized.providerMetadata ? { providerMetadata: normalized.providerMetadata } : {}),
  })
  return normalized.status === 'error'
    ? { channel: updated, delivered: false, error: normalized.message }
    : { channel: updated, delivered: true, message: normalized.message }
}

/** @deprecated Use connectWhatsApp. Kept for already imported callers. */
export const requestWhatsAppQr = connectWhatsApp

export async function refreshWhatsAppStatus(): Promise<CommunicationChannelActionResult> {
  const channel = await createOrUpdateWhatsAppChannel()
  const result = await sendChannelEvent('communication.whatsapp.status.requested', channel)
  if (!result.delivered) return markDeliveryFailure(result.error)

  const remote = responseChanges(result.data)
  const normalized = normalizeWhatsAppConnectResponse(result.data)
  const updated = await createOrUpdateWhatsAppChannel({
    status: normalized.status,
    qrCode: normalized.status === 'connected' ? undefined : (normalized.qrCode ?? channel.qrCode),
    pairingCode: normalized.status === 'connected'
      ? undefined
      : (normalized.pairingCode ?? channel.pairingCode),
    ...(normalized.phoneNumber ? {
      phoneNumber: normalized.phoneNumber,
      connectedNumber: normalized.phoneNumber,
    } : {}),
    ...(remote.instanceName ? { instanceName: remote.instanceName } : {}),
    ...(remote.instanceId ? { instanceId: remote.instanceId } : {}),
    ...(remote.ownerJid ? { ownerJid: remote.ownerJid } : {}),
    ...(remote.profileName ? { profileName: remote.profileName } : {}),
    ...(remote.profilePhoto ? { profilePhoto: remote.profilePhoto } : {}),
    ...(remote.connectedAt ? { connectedAt: remote.connectedAt } : {}),
    lastSeenAt: remote.lastSeenAt ?? new Date().toISOString(),
    ...(remote.providerMetadata ? { providerMetadata: remote.providerMetadata } : {}),
  })
  return normalized.status === 'error'
    ? { channel: updated, delivered: false, error: normalized.message }
    : { channel: updated, delivered: true, message: normalized.message }
}

export async function disconnectWhatsApp(): Promise<CommunicationChannelActionResult> {
  const channel = await createOrUpdateWhatsAppChannel()
  const result = await sendChannelEvent('communication.whatsapp.disconnect.requested', channel)
  if (!result.delivered) return markDeliveryFailure(result.error)

  const updated = await createOrUpdateWhatsAppChannel({
    status: 'disconnected',
    qrCode: undefined,
    pairingCode: undefined,
    phoneNumber: undefined,
    connectedNumber: undefined,
    ownerJid: undefined,
    connectedAt: undefined,
    lastSeenAt: new Date().toISOString(),
  })
  return { channel: updated, delivered: true }
}

export async function changeWhatsAppAccount() {
  const channel = await createOrUpdateWhatsAppChannel()
  const result = await sendChannelEvent(
    'communication.whatsapp.disconnect.requested',
    channel,
    { changeAccount: true },
  )
  if (!result.delivered) return markDeliveryFailure(result.error)

  const updated = await createOrUpdateWhatsAppChannel({
    status: 'not_configured',
    qrCode: undefined,
    pairingCode: undefined,
    phoneNumber: undefined,
    connectedNumber: undefined,
    ownerJid: undefined,
    profileName: undefined,
    profilePhoto: undefined,
    connectedAt: undefined,
    lastSeenAt: new Date().toISOString(),
  })
  return { channel: updated, delivered: true, message: 'Puedes vincular otra cuenta.' }
}

export async function testWhatsAppNotification(): Promise<CommunicationChannelActionResult> {
  const channel = await createOrUpdateWhatsAppChannel()
  const result = await sendChannelEvent('communication.whatsapp.test.requested', channel)
  if (!result.delivered) return markDeliveryFailure(result.error)
  return { channel, delivered: true }
}

export async function updateWhatsAppNotificationPreferences(
  preferences: WhatsAppNotificationPreferences,
): Promise<CommunicationChannelActionResult> {
  const channel = await createOrUpdateWhatsAppChannel(preferences)
  const result = await sendChannelEvent(
    'communication.whatsapp.preferences.updated',
    channel,
    { preferences },
  )
  if (!result.delivered) return markDeliveryFailure(result.error)
  return { channel, delivered: true }
}
