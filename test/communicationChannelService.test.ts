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

  it('maps code as pairingCode when Evolution returns code instead of pairingCode', () => {
    const result = normalizeWhatsAppConnectResponse({
      success: true,
      status: 'connecting',
      data: {
        code: 'WXYZ-1234',
      },
    })

    expect(result).toEqual(expect.objectContaining({
      status: 'connecting',
      pairingCode: 'WXYZ-1234',
      qrCode: null,
      action: 'retry_connect',
    }))
  })

  it('does not map long token-like code as manual pairingCode', () => {
    const result = normalizeWhatsAppConnectResponse({
      success: true,
      status: 'connecting',
      code: '2@Fm2RrWttrFxnJu4b227VKJ6iNBuHUyzx24RWlsEVlHe8zdGTFAQCUHcEBl/DJ36ndfrqvSWJnpy36QI9Q09R4F9/V2RA3L2ygko=,q9uq5ktsryDaAtXtK9mPaldjj0XD0G4LbzwVsFshEyY=',
      message: 'Código de vinculación generado.',
    })

    expect(result).toEqual(expect.objectContaining({
      status: 'error',
      pairingCode: null,
      qrCode: null,
      action: 'refresh_status',
      message: 'Evolution no devolvió un código de vinculación manual válido ni QR.',
    }))
  })

  it('maps code as qrCode when code is a data image payload', () => {
    const result = normalizeWhatsAppConnectResponse({
      success: true,
      status: 'connecting',
      code: `data:image/png;base64,${'A'.repeat(140)}`,
    })

    expect(result).toEqual(expect.objectContaining({
      status: 'connecting',
      pairingCode: null,
      action: 'retry_connect',
    }))
    expect(result.qrCode).toMatch(/^data:image\/png;base64,/)
  })

  it('maps qrcode/base64 as qrCode when Evolution returns nested qrcode payload', () => {
    const result = normalizeWhatsAppConnectResponse({
      success: true,
      status: 'connecting',
      data: {
        qrcode: {
          base64: 'A'.repeat(160),
        },
      },
    })

    expect(result).toEqual(expect.objectContaining({
      status: 'connecting',
      pairingCode: null,
      action: 'retry_connect',
    }))
    expect(result.qrCode).toMatch(/^data:image\/png;base64,|^A{100,}/)
  })

  it('returns error status when backend explicitly reports success false', () => {
    const result = normalizeWhatsAppConnectResponse({
      success: false,
      status: 'error',
      message: 'Evolution devolvió error.',
    })

    expect(result).toEqual(expect.objectContaining({
      status: 'error',
      pairingCode: null,
      qrCode: null,
      message: 'Evolution devolvió error.',
    }))
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
      action: 'show_connected',
    }))
  })

  it('emits an explicit error when Evolution returns connecting without valid artifacts', () => {
    const result = normalizeWhatsAppConnectResponse({
      success: true,
      status: 'connecting',
      message: 'Instancia existente en estado connecting sin QR disponible.',
    })

    expect(result).toEqual(expect.objectContaining({
      status: 'error',
      pairingCode: null,
      qrCode: null,
      action: 'refresh_status',
      message: 'Evolution no devolvió un código de vinculación manual válido ni QR.',
    }))
  })

  it('normalizes phone numbers for the Evolution pairing request', () => {
    expect(normalizeWhatsAppPhoneNumber('+34 600-111-222')).toBe('34600111222')
  })
})
