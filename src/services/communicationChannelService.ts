import { db } from '../database/db'
import type { PrivateBalanceEvent } from '../types/automation'
import type {
  CommunicationChannel,
  CommunicationChannelStatus,
  WhatsAppNotificationPreferences,
} from '../types/communicationChannel'
import { sendAutomationEvent } from './automationHubService'
import { getOrCreateDeviceIdentity } from './deviceIdentityService'

const WHATSAPP_CHANNEL_ID = 'whatsapp' as const
const DEFAULT_INSTANCE_NAME = 'private-balance'

export interface CommunicationChannelActionResult {
  channel: CommunicationChannel
  delivered: boolean
  error?: string
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

export async function getWhatsAppChannel() {
  return (await db.communicationChannels.get(WHATSAPP_CHANNEL_ID)) ?? null
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
    instanceName: changes.instanceName?.trim() || existing?.instanceName || DEFAULT_INSTANCE_NAME,
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
  if (['connecting', 'pending', 'qr', 'pendiente'].includes(status ?? '')) return 'pending'
  if (['close', 'closed', 'disconnected', 'desconectado'].includes(status ?? '')) return 'disconnected'
  if (['error', 'failed'].includes(status ?? '')) return 'error'
  return undefined
}

function responseChanges(data?: Record<string, unknown>) {
  const qrCode = normalizeQrCode(firstString(data, [
    ['data', 'data', 'base64'], ['data', 'base64'], ['data', 'qrCode'],
    ['data', 'qrcode'], ['base64'], ['qrCode'], ['qrcode'],
  ]))
  const status = normalizeStatus(firstString(data, [
    ['data', 'data', 'instance', 'state'], ['data', 'instance', 'state'],
    ['data', 'data', 'status'], ['data', 'status'], ['status'], ['state'],
  ]))
  const connectedNumber = firstString(data, [
    ['data', 'data', 'connectedNumber'], ['data', 'connectedNumber'],
    ['data', 'data', 'number'], ['data', 'number'], ['connectedNumber'], ['number'],
  ])

  return { qrCode, status, connectedNumber }
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

export async function requestWhatsAppQr(): Promise<CommunicationChannelActionResult> {
  const channel = await createOrUpdateWhatsAppChannel({ status: 'pending' })
  const result = await sendChannelEvent('device.whatsapp.connect.requested', channel)
  if (!result.delivered) return markDeliveryFailure(result.error)

  if (import.meta.env.DEV) {
    console.info('[Private Balance] Evento WhatsApp QR enviado')
  }

  const remote = responseChanges(result.data)
  const updated = await createOrUpdateWhatsAppChannel({
    status: remote.status ?? 'pending',
    ...(remote.qrCode ? { qrCode: remote.qrCode } : {}),
    ...(remote.connectedNumber ? { connectedNumber: remote.connectedNumber } : {}),
  })
  return { channel: updated, delivered: true }
}

export async function refreshWhatsAppStatus(): Promise<CommunicationChannelActionResult> {
  const channel = await createOrUpdateWhatsAppChannel()
  const result = await sendChannelEvent('communication.whatsapp.status.requested', channel)
  if (!result.delivered) return markDeliveryFailure(result.error)

  const remote = responseChanges(result.data)
  const updated = await createOrUpdateWhatsAppChannel({
    status: remote.status ?? channel.status,
    ...(remote.qrCode ? { qrCode: remote.qrCode } : {}),
    ...(remote.connectedNumber ? { connectedNumber: remote.connectedNumber } : {}),
  })
  return { channel: updated, delivered: true }
}

export async function disconnectWhatsApp(): Promise<CommunicationChannelActionResult> {
  const channel = await createOrUpdateWhatsAppChannel()
  const result = await sendChannelEvent('communication.whatsapp.disconnect.requested', channel)
  if (!result.delivered) return markDeliveryFailure(result.error)

  const updated = await createOrUpdateWhatsAppChannel({
    status: 'disconnected',
    qrCode: undefined,
    connectedNumber: undefined,
  })
  return { channel: updated, delivered: true }
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
