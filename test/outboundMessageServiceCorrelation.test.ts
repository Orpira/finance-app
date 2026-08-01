import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getIdempotencyRecord, saveIdempotencyRecord, getServiceWindowStatus,
  recordOutboundStatus, touchMetaChannelOutbound, recordCorrelation,
  createMetaCloudClient, sendText,
} = vi.hoisted(() => ({
  getIdempotencyRecord: vi.fn(),
  saveIdempotencyRecord: vi.fn(),
  getServiceWindowStatus: vi.fn(),
  recordOutboundStatus: vi.fn(),
  touchMetaChannelOutbound: vi.fn(),
  recordCorrelation: vi.fn(),
  createMetaCloudClient: vi.fn(),
  sendText: vi.fn(),
}))

vi.mock('../server/communication/repositories/idempotencyRepository', () => ({ getIdempotencyRecord, saveIdempotencyRecord }))
vi.mock('../server/communication/services/serviceWindowService', () => ({ getStatus: getServiceWindowStatus }))
vi.mock('../server/communication/services/messageStatusService', () => ({ recordOutboundStatus }))
vi.mock('../server/communication/repositories/metaChannelRepository', () => ({ touchMetaChannelOutbound }))
vi.mock('../server/communication/repositories/correlationRepository', () => ({ recordCorrelation }))
vi.mock('../server/communication/services/metaCloudClient', () => ({ createMetaCloudClient }))

import { sendTextMessage } from '../server/communication/services/outboundMessageService'

const REQUEST_ID = '11111111-1111-4111-8111-111111111111'
const ENABLED_CONFIG = {
  enabled: true as const, allowRealSend: true, webhookEnabled: false, forwardInboundToN8n: false,
  forwardStatusToN8n: false, messageRetentionDays: 0, idempotencyRetentionDays: 30,
  appSecret: 's', accessToken: 't', verifyToken: 'v', phoneNumberId: '123', graphApiVersion: 'v21.0',
  n8nCommunicationApiKey: 'n8n-key',
}

beforeEach(() => {
  getIdempotencyRecord.mockReset()
  saveIdempotencyRecord.mockReset()
  getServiceWindowStatus.mockReset()
  recordOutboundStatus.mockReset()
  touchMetaChannelOutbound.mockReset()
  recordCorrelation.mockReset()
  createMetaCloudClient.mockReset()
  sendText.mockReset()
  getIdempotencyRecord.mockResolvedValue(null)
  createMetaCloudClient.mockReturnValue({ sendText })
})

describe('sendTextMessage — correlación y actividad del canal (Fase 4)', () => {
  it('registra la correlación con las referencias opacas de n8n al enviar de verdad', async () => {
    getServiceWindowStatus.mockResolvedValue({ open: true })
    sendText.mockResolvedValue({ providerMessageId: 'wamid.1' })

    await sendTextMessage({
      requestId: REQUEST_ID,
      recipient: '34600000000',
      text: 'Se registró correctamente un nuevo ingreso.',
      context: { eventType: 'income.created', eventId: '01HXYZ', workflowId: 'pb-whatsapp-cloud-send-staging', userReference: 'opaque-user', deviceReference: 'opaque-device' },
    }, ENABLED_CONFIG)

    expect(recordCorrelation).toHaveBeenCalledWith(expect.objectContaining({
      requestId: REQUEST_ID,
      eventId: '01HXYZ',
      workflowId: 'pb-whatsapp-cloud-send-staging',
      userReference: 'opaque-user',
      deviceReference: 'opaque-device',
      providerMessageId: 'wamid.1',
      status: 'accepted',
    }))
    expect(touchMetaChannelOutbound).toHaveBeenCalledWith('34600000000', expect.any(String))
  })

  it('registra la correlación como "simulated" cuando ALLOW_REAL_SEND=false, sin tocar el canal', async () => {
    await sendTextMessage({
      requestId: REQUEST_ID,
      recipient: '34600000000',
      text: 'Se registró correctamente un nuevo ingreso.',
    }, { ...ENABLED_CONFIG, allowRealSend: false })

    expect(recordCorrelation).toHaveBeenCalledWith(expect.objectContaining({ requestId: REQUEST_ID, status: 'simulated' }))
    expect(touchMetaChannelOutbound).not.toHaveBeenCalled()
    expect(sendText).not.toHaveBeenCalled()
  })
})
