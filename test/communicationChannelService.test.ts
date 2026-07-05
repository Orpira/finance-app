import { describe, expect, it } from 'vitest'

import {
  normalizeWhatsAppConnectResponse,
  normalizeWhatsAppPhoneNumber,
} from '../src/services/communicationChannelService'

describe('WhatsApp channel response contract', () => {
  it('prioritizes a pairing code over a QR fallback', () => {
    const result = normalizeWhatsAppConnectResponse({
      success: true,
      status: 'connecting',
      instanceName: '=pb-device-1',
      pairingCode: 'ABCD-EFGH',
      qrCode: 'data:image/png;base64,AAAA',
    })

    expect(result).toEqual(expect.objectContaining({
      status: 'connecting',
      instanceName: 'pb-device-1',
      pairingCode: 'ABCD-EFGH',
      qrCode: null,
    }))
  })

  it('uses QR only when Evolution does not return a pairing code', () => {
    const result = normalizeWhatsAppConnectResponse({
      success: true,
      status: 'connecting',
      qrCode: `data:image/png;base64,${'A'.repeat(120)}`,
    })

    expect(result.pairingCode).toBeNull()
    expect(result.qrCode).toMatch(/^data:image\/png;base64,/)
  })

  it('clears authorization artifacts when the channel is already connected', () => {
    const result = normalizeWhatsAppConnectResponse({
      success: true,
      status: 'open',
      pairingCode: 'ABCD-EFGH',
      qrCode: `data:image/png;base64,${'A'.repeat(120)}`,
      phoneNumber: '34600111222',
      ownerJid: '34600111222@s.whatsapp.net',
      lastSeenAt: '2026-07-04T12:00:00.000Z',
    })

    expect(result).toEqual(expect.objectContaining({
      status: 'connected',
      phoneNumber: '34600111222',
      pairingCode: null,
      qrCode: null,
    }))
  })

  it('normalizes phone numbers for the Evolution pairing request', () => {
    expect(normalizeWhatsAppPhoneNumber('+34 600-111-222')).toBe('34600111222')
  })
})
