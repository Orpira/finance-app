import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getIdempotencyRecord, saveIdempotencyRecord, touchMetaChannelInbound,
  updateCorrelationStatusByProviderMessageId, registerInbound, processInboundStatus,
  forwardInboundMessage, forwardMessageStatus,
} = vi.hoisted(() => ({
  getIdempotencyRecord: vi.fn(),
  saveIdempotencyRecord: vi.fn(),
  touchMetaChannelInbound: vi.fn(),
  updateCorrelationStatusByProviderMessageId: vi.fn(),
  registerInbound: vi.fn(),
  processInboundStatus: vi.fn(),
  forwardInboundMessage: vi.fn(),
  forwardMessageStatus: vi.fn(),
}))

vi.mock('../server/communication/repositories/idempotencyRepository', () => ({ getIdempotencyRecord, saveIdempotencyRecord }))
vi.mock('../server/communication/repositories/metaChannelRepository', () => ({ touchMetaChannelInbound }))
vi.mock('../server/communication/repositories/correlationRepository', () => ({ updateCorrelationStatusByProviderMessageId }))
vi.mock('../server/communication/services/serviceWindowService', () => ({ registerInbound }))
vi.mock('../server/communication/services/messageStatusService', () => ({ processInboundStatus }))
vi.mock('../server/communication/services/n8nInboundForwarder', () => ({ forwardInboundMessage, forwardMessageStatus }))

import { processNormalizedWebhookEvent } from '../server/communication/services/metaWebhookService'
import type { NormalizedMetaWebhookEvent } from '../server/communication/contracts/metaWebhook'

const MESSAGE = {
  provider: 'meta-cloud' as const, providerMessageId: 'wamid.1', phoneNumberId: 'pnid-1',
  senderPhone: '34600000000', timestamp: '2026-07-31T10:00:00.000Z', type: 'text' as const, text: 'Hola',
}
const STATUS = {
  provider: 'meta-cloud' as const, providerMessageId: 'wamid.1', status: 'delivered' as const, timestamp: '2026-07-31T10:01:00.000Z',
}

const BASE_CONFIG = {
  enabled: true as const, allowRealSend: false, webhookEnabled: true, forwardInboundToN8n: false,
  forwardStatusToN8n: false, messageRetentionDays: 0, idempotencyRetentionDays: 30,
  appSecret: 's', accessToken: 't', verifyToken: 'v', phoneNumberId: '123', graphApiVersion: 'v21.0',
  n8nCommunicationApiKey: 'n8n-key',
}

function event(overrides: Partial<NormalizedMetaWebhookEvent> = {}): NormalizedMetaWebhookEvent {
  return { messages: [], statuses: [], unknownEntries: 0, ...overrides }
}

beforeEach(() => {
  getIdempotencyRecord.mockReset()
  saveIdempotencyRecord.mockReset()
  touchMetaChannelInbound.mockReset()
  updateCorrelationStatusByProviderMessageId.mockReset()
  registerInbound.mockReset()
  processInboundStatus.mockReset()
  forwardInboundMessage.mockReset()
  forwardMessageStatus.mockReset()
  getIdempotencyRecord.mockResolvedValue(null)
  forwardInboundMessage.mockResolvedValue({ forwarded: true, status: 200 })
  forwardMessageStatus.mockResolvedValue({ forwarded: true, status: 200 })
})

describe('processNormalizedWebhookEvent — reenvío condicionado por flags', () => {
  it('no reenvía mensajes ni estados cuando ambas banderas están en false', async () => {
    const result = await processNormalizedWebhookEvent(event({ messages: [MESSAGE], statuses: [STATUS] }), BASE_CONFIG)

    expect(forwardInboundMessage).not.toHaveBeenCalled()
    expect(forwardMessageStatus).not.toHaveBeenCalled()
    expect(result).toMatchObject({ processedMessages: 1, processedStatuses: 1, forwardedMessages: 0, forwardedStatuses: 0 })
  })

  it('reenvía mensajes cuando forwardInboundToN8n=true', async () => {
    await processNormalizedWebhookEvent(event({ messages: [MESSAGE] }), { ...BASE_CONFIG, forwardInboundToN8n: true })
    expect(forwardInboundMessage).toHaveBeenCalledWith(MESSAGE)
  })

  it('reenvía estados cuando forwardStatusToN8n=true', async () => {
    await processNormalizedWebhookEvent(event({ statuses: [STATUS] }), { ...BASE_CONFIG, forwardStatusToN8n: true })
    expect(forwardMessageStatus).toHaveBeenCalledWith(STATUS)
  })

  it('un mensaje duplicado no actualiza el canal ni reenvía de nuevo', async () => {
    getIdempotencyRecord.mockResolvedValue({ key: 'inbound:wamid.1', payloadHash: 'x', resultStatus: 200, resultBody: null, createdAt: '' })

    const result = await processNormalizedWebhookEvent(event({ messages: [MESSAGE] }), { ...BASE_CONFIG, forwardInboundToN8n: true })

    expect(touchMetaChannelInbound).not.toHaveBeenCalled()
    expect(forwardInboundMessage).not.toHaveBeenCalled()
    expect(result.duplicateMessages).toBe(1)
  })

  it('un mensaje nuevo actualiza la actividad del canal (touchMetaChannelInbound)', async () => {
    await processNormalizedWebhookEvent(event({ messages: [MESSAGE] }), BASE_CONFIG)
    expect(touchMetaChannelInbound).toHaveBeenCalledWith(MESSAGE.senderPhone, MESSAGE.timestamp)
  })

  it('un estado nuevo actualiza la correlación por providerMessageId', async () => {
    await processNormalizedWebhookEvent(event({ statuses: [STATUS] }), BASE_CONFIG)
    expect(updateCorrelationStatusByProviderMessageId).toHaveBeenCalledWith('wamid.1', 'delivered')
  })
})
