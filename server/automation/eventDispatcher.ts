import { z } from 'zod'

import {
  isSynchronousAutomationEvent,
  type AutomationEnvelope,
} from './eventTypes.js'
import { dispatchWebhook } from './webhookDispatcher.js'

const identityCodesSchema = z.object({
  userCode: z.string().regex(/^PB-USER-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  deviceCode: z.string().regex(/^PB-DEVICE-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
})

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

  return {
    ...envelope,
    deviceCode: licenseDeviceCode,
    receivedAt: new Date().toISOString(),
    source: envelope.source ?? 'private-balance-pwa',
  }
}

export async function dispatchAutomationEvent(input: {
  envelope: AutomationEnvelope
  licenseDeviceCode: string
}): Promise<AutomationDispatchResult> {
  const webhook = await dispatchWebhook({
    event: input.envelope.event,
    eventId: input.envelope.eventId,
    payload: buildN8nPayload(input.envelope, input.licenseDeviceCode),
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
