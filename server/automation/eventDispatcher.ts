import { z } from 'zod'

import {
  isSynchronousAutomationEvent,
  type AutomationEnvelope,
} from './eventTypes.js'
import { dispatchWebhook } from './webhookDispatcher.js'
import { resolveActiveWhatsappChannel, resolveUserCodeFromDeviceCode } from './communicationResolver.js'

const identityCodesSchema = z.object({
  userCode: z.string().regex(/^PB-USER-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  deviceCode: z.string().regex(/^PB-DEVICE-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
})

/**
 * Extrae el userCode de forma robusta desde múltiples ubicaciones del envelope
 * Si no lo encuentra, intenta resolverlo desde deviceCode usando license_devices
 */
async function extractUserCode(data: Record<string, unknown>, deviceCode?: string): Promise<string | undefined> {
  // Intenta obtener desde envelope.data.userCode
  if (typeof data.userCode === 'string') {
    return data.userCode
  }
  
  // Intenta obtener desde envelope.data.data?.userCode
  if (typeof data.data === 'object' && data.data !== null && 'userCode' in data.data) {
    const nestedUserCode = (data.data as Record<string, unknown>).userCode
    if (typeof nestedUserCode === 'string') {
      return nestedUserCode
    }
  }
  
  // Intenta obtener desde envelope.data.payload?.userCode
  if (typeof data.payload === 'object' && data.payload !== null && 'userCode' in data.payload) {
    const payloadUserCode = (data.payload as Record<string, unknown>).userCode
    if (typeof payloadUserCode === 'string') {
      return payloadUserCode
    }
  }
  
  // Intenta resolver desde deviceCode usando license_devices
  if (typeof deviceCode === 'string') {
    const resolvedUserCode = await resolveUserCodeFromDeviceCode(deviceCode)
    if (resolvedUserCode) {
      return resolvedUserCode
    }
  }
  
  return undefined
}

const provisionIdentityDataSchema = identityCodesSchema.extend({
  deviceName: z.string().min(1).max(200).optional(),
  platform: z.enum(['web', 'android', 'ios', 'unknown']).default('unknown'),
  appVersion: z.string().min(1).max(100).optional(),
}).passthrough()

export interface AutomationDispatchResult {
  status: number
  body?: unknown
  empty: boolean
}

export function buildN8nPayload(
  envelope: AutomationEnvelope,
  licenseDeviceCode: string,
  communicationChannel?: {
    provider: string
    instanceName?: string
    phoneNumber?: string
    status: string
    preferences?: unknown
    providerMetadata?: unknown
  },
) {
  if (envelope.event === 'device.whatsapp.connect.requested') {
    const identity = identityCodesSchema.parse(envelope.data)
    return {
      event: envelope.event,
      userCode: identity.userCode,
      deviceCode: identity.deviceCode,
      timezone: envelope.timezone,
      locale: envelope.locale,
    }
  }

  if (envelope.event === 'device.provision.requested') {
    const identity = provisionIdentityDataSchema.parse(envelope.data)
    return {
      event: envelope.event,
      userCode: identity.userCode,
      deviceCode: identity.deviceCode,
      deviceName: identity.deviceName ?? null,
      platform: identity.platform ?? 'unknown',
      appVersion: identity.appVersion ?? null,
      timezone: envelope.timezone,
      locale: envelope.locale,
    }
  }

  const payload = {
    ...envelope,
    deviceCode: licenseDeviceCode,
    receivedAt: new Date().toISOString(),
    source: envelope.source ?? 'private-balance-pwa',
  }

  if (communicationChannel) {
    return {
      ...payload,
      communicationChannel,
      instanceName: communicationChannel.instanceName,
      whatsappNumber: communicationChannel.phoneNumber,
    }
  }

  return payload
}

export async function dispatchAutomationEvent(input: {
  envelope: AutomationEnvelope
  licenseDeviceCode: string
}): Promise<AutomationDispatchResult> {
  let communicationChannel

  if (
    input.envelope.event === 'income.created' ||
    input.envelope.event === 'expense.created' ||
    input.envelope.event === 'calendar.created'
  ) {
    const userCode = await extractUserCode(input.envelope.data, input.licenseDeviceCode)
    if (typeof userCode === 'string') {
      const channel = await resolveActiveWhatsappChannel(userCode)
      if (channel) {
        communicationChannel = {
          provider: channel.provider,
          instanceName: channel.instanceName,
          phoneNumber: channel.phoneNumber,
          status: channel.status,
          preferences: channel.preferences,
          providerMetadata: channel.providerMetadata,
        }
      }
    }
  }

  const webhook = await dispatchWebhook({
    event: input.envelope.event,
    eventId: input.envelope.eventId,
    payload: buildN8nPayload(
      input.envelope,
      input.licenseDeviceCode,
      communicationChannel,
    ),
  })

  if (!webhook.successful || isSynchronousAutomationEvent(input.envelope.event)) {
    return {
      status: webhook.status,
      body: webhook.body,
      empty: webhook.empty,
    }
  }

  return {
    status: 202,
    body: { accepted: true, eventId: input.envelope.eventId },
    empty: false,
  }
}
