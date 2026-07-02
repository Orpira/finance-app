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
  message?: string
}

export interface NormalizedWhatsAppConnectResponse {
  status: Extract<CommunicationChannelStatus, 'connected' | 'connecting' | 'disconnected' | 'error'>
  qrCode: string | null
  instanceName?: string
  message: string
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
  const channel = await db.communicationChannels.get(WHATSAPP_CHANNEL_ID)
  if (!channel) return null

  // Dexie puede contener el valor usado por versiones anteriores.
  if ((channel.status as string) === 'pending') {
    const migrated = { ...channel, status: 'connecting' as const }
    await db.communicationChannels.put(migrated)
    return migrated
  }

  return channel
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
    ['data', 'data', 'number'], ['data', 'number'], ['connectedNumber'], ['number'],
  ])
  const instanceName = firstString(data, [
    ['data', 'data', 'instanceName'], ['data', 'instanceName'], ['instanceName'],
  ])
  const pairingCode = firstString(data, [
    ['data', 'data', 'pairingCode'], ['data', 'pairingCode'], ['pairingCode'],
  ])

  const message = firstString(data, [
    ['data', 'data', 'message'], ['data', 'message'], ['message'],
  ])
  const success = valueAtPath(data, ['success'])

  return { qrCode, status, connectedNumber, instanceName, pairingCode, message, success }
}

export function normalizeWhatsAppConnectResponse(
  response?: Record<string, unknown>,
): NormalizedWhatsAppConnectResponse {
  const remote = responseChanges(response)

  if (remote.qrCode) {
    return {
      status: 'connecting',
      qrCode: remote.qrCode,
      ...(remote.instanceName ? { instanceName: remote.instanceName } : {}),
      message: remote.message ?? 'Escanea el QR para vincular WhatsApp.',
    }
  }

  if (remote.success === false) {
    return {
      status: 'error',
      qrCode: null,
      ...(remote.instanceName ? { instanceName: remote.instanceName } : {}),
      message: remote.message ?? 'No se pudo conectar WhatsApp.',
    }
  }

  if (remote.status === 'connected') {
    return {
      status: 'connected',
      qrCode: null,
      ...(remote.instanceName ? { instanceName: remote.instanceName } : {}),
      message: 'WhatsApp ya está conectado',
    }
  }

  if (remote.status === 'disconnected') {
    return {
      status: 'disconnected',
      qrCode: null,
      ...(remote.instanceName ? { instanceName: remote.instanceName } : {}),
      message: remote.message ?? 'WhatsApp está desconectado.',
    }
  }

  if (remote.status === 'connecting') {
    return {
      status: 'connecting',
      qrCode: null,
      ...(remote.instanceName ? { instanceName: remote.instanceName } : {}),
      message: remote.message ?? 'WhatsApp está pendiente de vinculación.',
    }
  }

  return {
    status: 'error',
    qrCode: null,
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
    qrCode: remote.qrCode ? '[QR recibido]' : null,
  })
  console.info('[Private Balance] Estado WhatsApp normalizado', {
    ...normalized,
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
  const channel = await createOrUpdateWhatsAppChannel({
    status: 'connecting',
    qrCode: undefined,
    pairingCode: undefined,
  })
  const result = await sendChannelEvent('device.whatsapp.connect.requested', channel)
  if (!result.delivered) return markDeliveryFailure(result.error)

  const remote = responseChanges(result.data)
  const normalized = normalizeWhatsAppConnectResponse(result.data)
  logWhatsAppResponse(result.data, normalized)

  const updated = await createOrUpdateWhatsAppChannel({
    status: normalized.status,
    qrCode: normalized.qrCode ?? undefined,
    ...(remote.connectedNumber ? { connectedNumber: remote.connectedNumber } : {}),
    ...(normalized.instanceName ? { instanceName: normalized.instanceName } : {}),
    pairingCode: remote.pairingCode,
  })
  return normalized.status === 'error'
    ? { channel: updated, delivered: false, error: normalized.message }
    : { channel: updated, delivered: true, message: normalized.message }
}

export async function refreshWhatsAppStatus(): Promise<CommunicationChannelActionResult> {
  const channel = await createOrUpdateWhatsAppChannel()
  const result = await sendChannelEvent('communication.whatsapp.status.requested', channel)
  if (!result.delivered) return markDeliveryFailure(result.error)

  const remote = responseChanges(result.data)
  const updated = await createOrUpdateWhatsAppChannel({
    status: remote.status ?? channel.status,
    qrCode: remote.status === 'connected' ? undefined : (remote.qrCode ?? channel.qrCode),
    ...(remote.connectedNumber ? { connectedNumber: remote.connectedNumber } : {}),
    ...(remote.instanceName ? { instanceName: remote.instanceName } : {}),
    pairingCode: remote.pairingCode ?? channel.pairingCode,
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
