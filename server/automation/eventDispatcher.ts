import { z } from 'zod'

import {
  isSynchronousAutomationEvent,
  type AutomationEnvelope,
} from './eventTypes.js'
import { dispatchWebhook } from './webhookDispatcher.js'
import { resolveActiveWhatsappChannel } from './communicationResolver.js'
import { resolveActiveWhatsAppProvider } from './providers/whatsapp/WhatsAppProviderFactory.js'
import { isWhatsAppChannelEvent } from './providers/whatsapp/WhatsAppProvider.js'

export class AutomationIdentityMismatchError extends Error {
  constructor() {
    super('La identidad del evento no coincide con la sesión autenticada.')
    this.name = 'AutomationIdentityMismatchError'
  }
}

export interface CanonicalAutomationIdentity {
  userCode: string
  deviceCode: string
}

const identityCodesSchema = z.object({
  userCode: z.string().regex(/^PB-USER-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  deviceCode: z.string().regex(/^PB-DEVICE-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
})

const whatsappConnectDataSchema = identityCodesSchema.extend({
  phoneNumber: z.string().regex(/^\d{7,20}$/).optional(),
})

function nestedRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : undefined
}

function stringValues(...values: unknown[]): string[] {
  return values.filter((value): value is string => typeof value === 'string')
}

export function assertEnvelopeIdentityMatches(
  envelope: AutomationEnvelope,
  identity: CanonicalAutomationIdentity,
) {
  const nestedData = nestedRecord(envelope.data.data)
  const payload = nestedRecord(envelope.data.payload)
  const clientUserCodes = stringValues(
    envelope.data.userCode,
    nestedData?.userCode,
    payload?.userCode,
    envelope.userCode,
  )
  const clientDeviceCodes = stringValues(
    envelope.data.deviceCode,
    nestedData?.deviceCode,
    payload?.deviceCode,
    envelope.deviceCode,
  )

  if (clientDeviceCodes.some((value) => value !== identity.deviceCode)) {
    throw new AutomationIdentityMismatchError()
  }
  if (clientUserCodes.some((value) => value !== identity.userCode)) {
    throw new AutomationIdentityMismatchError()
  }
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
  identity: CanonicalAutomationIdentity,
  communicationChannel?: {
    provider: string
    instanceName?: string
    instanceId?: string
    phoneNumber?: string
    ownerJid?: string
    profileName?: string
    profilePhoto?: string
    connectedAt?: string
    lastSeenAt?: string
    status: string
    preferences?: unknown
    providerMetadata?: unknown
  },
) {
  if (envelope.event === 'device.whatsapp.connect.requested') {
    const data = whatsappConnectDataSchema.parse(envelope.data)
    return {
      event: envelope.event,
      userCode: identity.userCode,
      deviceCode: identity.deviceCode,
      phoneNumber: data.phoneNumber ?? null,
      timezone: envelope.timezone,
      locale: envelope.locale,
    }
  }

  if (envelope.event === 'device.provision.requested') {
    const data = provisionIdentityDataSchema.parse(envelope.data)
    return {
      event: envelope.event,
      userCode: identity.userCode,
      deviceCode: identity.deviceCode,
      deviceName: data.deviceName ?? null,
      platform: data.platform ?? 'unknown',
      appVersion: data.appVersion ?? null,
      timezone: envelope.timezone,
      locale: envelope.locale,
    }
  }

  const payload = {
    ...envelope,
    userCode: identity.userCode,
    deviceCode: identity.deviceCode,
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
  identity: CanonicalAutomationIdentity
}): Promise<AutomationDispatchResult> {
  assertEnvelopeIdentityMatches(input.envelope, input.identity)

  let communicationChannel

  if (
    input.envelope.event === 'income.created' ||
    input.envelope.event === 'service.completed' ||
    input.envelope.event === 'expense.created' ||
    input.envelope.event === 'calendar.created'
  ) {
    const channel = await resolveActiveWhatsappChannel(input.identity.userCode)
    if (channel) {
      communicationChannel = {
        provider: channel.provider,
        instanceName: channel.instanceName,
        instanceId: channel.instanceId,
        phoneNumber: channel.phoneNumber,
        ownerJid: channel.ownerJid,
        profileName: channel.profileName,
        profilePhoto: channel.profilePhoto,
        connectedAt: channel.connectedAt,
        lastSeenAt: channel.lastSeenAt,
        status: channel.status,
        preferences: channel.preferences,
        providerMetadata: channel.providerMetadata,
      }
    }
  }

  const payloadToN8N = buildN8nPayload(
    input.envelope,
    input.identity,
    communicationChannel,
  )
  const webhook = isWhatsAppChannelEvent(input.envelope.event)
    ? await resolveActiveWhatsAppProvider().dispatchChannelEvent({
        event: input.envelope.event,
        eventId: input.envelope.eventId,
        payload: payloadToN8N,
        userCode: input.identity.userCode,
        deviceCode: input.identity.deviceCode,
      })
    : await dispatchWebhook({
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
