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

function nestedRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : undefined
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string')
}

async function resolveEnvelopeUserCode(
  envelope: AutomationEnvelope,
  fallbackDeviceCode?: string,
): Promise<string | undefined> {
  const nestedData = nestedRecord(envelope.data.data)
  const payload = nestedRecord(envelope.data.payload)
  const userCode = firstString(
    envelope.data.userCode,
    nestedData?.userCode,
    payload?.userCode,
    envelope.userCode,
  )
  const deviceCode = firstString(
    envelope.data.deviceCode,
    nestedData?.deviceCode,
    payload?.deviceCode,
    envelope.deviceCode,
    fallbackDeviceCode,
  )

  console.log('[AUTOMATION] deviceCode:', deviceCode)
  console.log('[AUTOMATION] userCode:', userCode)

  if (userCode) return userCode
  if (!deviceCode) return undefined
  const resolvedUserCode = await resolveUserCodeFromDeviceCode(deviceCode)
  console.log('[AUTOMATION] resolvedUserCode:', resolvedUserCode)
  return resolvedUserCode ?? undefined
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
    const userCode = await resolveEnvelopeUserCode(input.envelope, input.licenseDeviceCode)
    if (typeof userCode === 'string') {
      const channel = await resolveActiveWhatsappChannel(userCode)
      console.log('[AUTOMATION] communicationChannel:', channel)
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

  const payloadToN8N = buildN8nPayload(
    input.envelope,
    input.licenseDeviceCode,
    communicationChannel,
  )
  console.log('[AUTOMATION] payloadToN8N:', payloadToN8N)

  const webhook = await dispatchWebhook({
    event: input.envelope.event,
    eventId: input.envelope.eventId,
    payload: payloadToN8N,
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
