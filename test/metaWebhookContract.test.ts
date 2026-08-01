import { describe, expect, it } from 'vitest'

import { normalizeMetaTimestamp, normalizeMetaWebhookPayload } from '../server/communication/contracts/metaWebhook'

function envelope(value: unknown) {
  return { object: 'whatsapp_business_account', entry: [{ id: 'waba-1', changes: [{ field: 'messages', value }] }] }
}

function isoFromUnixSeconds(seconds: number): string {
  return new Date(seconds * 1000).toISOString()
}

describe('normalizeMetaWebhookPayload — mensajes entrantes', () => {
  it('normaliza un mensaje de texto entrante', () => {
    const result = normalizeMetaWebhookPayload(envelope({
      metadata: { phone_number_id: 'pnid-1' },
      contacts: [{ profile: { name: 'Ana' }, wa_id: '34600000000' }],
      messages: [{ id: 'wamid.1', from: '34600000000', timestamp: '1700000000', type: 'text', text: { body: 'Hola' } }],
    }))

    expect(result.messages).toEqual([{
      provider: 'meta-cloud',
      providerMessageId: 'wamid.1',
      phoneNumberId: 'pnid-1',
      senderPhone: '34600000000',
      senderName: 'Ana',
      timestamp: isoFromUnixSeconds(1700000000),
      type: 'text',
      text: 'Hola',
    }])
    expect(result.unknownEntries).toBe(0)
  })

  it('normaliza tipos no textuales sin campo text', () => {
    const result = normalizeMetaWebhookPayload(envelope({
      metadata: { phone_number_id: 'pnid-1' },
      messages: [{ id: 'wamid.2', from: '34600000000', timestamp: '1700000001', type: 'image' }],
    }))
    expect(result.messages[0]).toMatchObject({ type: 'image' })
    expect(result.messages[0]?.text).toBeUndefined()
  })

  it('clasifica un tipo desconocido como "unknown" sin fallar', () => {
    const result = normalizeMetaWebhookPayload(envelope({
      messages: [{ id: 'wamid.3', from: '34600000000', timestamp: '1700000002', type: 'sticker' }],
    }))
    expect(result.messages[0]?.type).toBe('unknown')
  })
})

describe('normalizeMetaWebhookPayload — estados', () => {
  it('normaliza un estado delivered', () => {
    const result = normalizeMetaWebhookPayload(envelope({
      statuses: [{ id: 'wamid.1', status: 'delivered', timestamp: '1700000010', recipient_id: '34600000000' }],
    }))
    expect(result.statuses).toEqual([{
      provider: 'meta-cloud',
      providerMessageId: 'wamid.1',
      recipientPhone: '34600000000',
      status: 'delivered',
      timestamp: isoFromUnixSeconds(1700000010),
    }])
  })

  it('normaliza un estado failed con código y mensaje de error', () => {
    const result = normalizeMetaWebhookPayload(envelope({
      statuses: [{
        id: 'wamid.2', status: 'failed', timestamp: '1700000011',
        errors: [{ code: 131047, title: 'Re-engagement message' }],
      }],
    }))
    expect(result.statuses[0]).toMatchObject({ status: 'failed', errorCode: '131047', errorMessage: 'Re-engagement message' })
  })

  it('un valor de estado desconocido se normaliza como "unknown"', () => {
    const result = normalizeMetaWebhookPayload(envelope({
      statuses: [{ id: 'wamid.3', status: 'queued', timestamp: '1700000012' }],
    }))
    expect(result.statuses[0]?.status).toBe('unknown')
  })
})

describe('normalizeMetaTimestamp', () => {
  it('convierte un timestamp Unix válido (segundos, como cadena) a ISO 8601', () => {
    expect(normalizeMetaTimestamp('1504902988')).toBe(isoFromUnixSeconds(1504902988))
  })

  it('usa la hora actual cuando el timestamp está ausente', () => {
    const before = Date.now()
    const result = normalizeMetaTimestamp(undefined)
    const after = Date.now()

    const resultMs = new Date(result).getTime()
    expect(resultMs).toBeGreaterThanOrEqual(before)
    expect(resultMs).toBeLessThanOrEqual(after)
  })

  it('usa la hora actual cuando el timestamp es inválido (no son solo dígitos)', () => {
    const before = Date.now()
    const result = normalizeMetaTimestamp('not-a-timestamp')
    const after = Date.now()

    const resultMs = new Date(result).getTime()
    expect(resultMs).toBeGreaterThanOrEqual(before)
    expect(resultMs).toBeLessThanOrEqual(after)
  })
})

describe('normalizeMetaWebhookPayload — timestamps', () => {
  it('normaliza el timestamp de un mensaje entrante a ISO 8601', () => {
    const result = normalizeMetaWebhookPayload(envelope({
      messages: [{ id: 'wamid.ts-1', from: '34600000000', timestamp: '1504902988', type: 'text', text: { body: 'Hola' } }],
    }))
    expect(result.messages[0]?.timestamp).toBe(isoFromUnixSeconds(1504902988))
  })

  it('usa la hora actual cuando el mensaje no trae timestamp', () => {
    const before = Date.now()
    const result = normalizeMetaWebhookPayload(envelope({
      messages: [{ id: 'wamid.ts-2', from: '34600000000', type: 'text', text: { body: 'Hola' } }],
    }))
    const after = Date.now()

    const resultMs = new Date(result.messages[0]?.timestamp ?? '').getTime()
    expect(resultMs).toBeGreaterThanOrEqual(before)
    expect(resultMs).toBeLessThanOrEqual(after)
  })

  it('normaliza el timestamp de un estado a ISO 8601', () => {
    const result = normalizeMetaWebhookPayload(envelope({
      statuses: [{ id: 'wamid.ts-3', status: 'sent', timestamp: '1504902988' }],
    }))
    expect(result.statuses[0]?.timestamp).toBe(isoFromUnixSeconds(1504902988))
  })

  it('usa la hora actual cuando el estado no trae timestamp', () => {
    const before = Date.now()
    const result = normalizeMetaWebhookPayload(envelope({
      statuses: [{ id: 'wamid.ts-4', status: 'sent' }],
    }))
    const after = Date.now()

    const resultMs = new Date(result.statuses[0]?.timestamp ?? '').getTime()
    expect(resultMs).toBeGreaterThanOrEqual(before)
    expect(resultMs).toBeLessThanOrEqual(after)
  })
})

describe('normalizeMetaWebhookPayload — eventos desconocidos', () => {
  it('un payload sin entry no lanza error y no produce mensajes ni estados', () => {
    const result = normalizeMetaWebhookPayload({ object: 'whatsapp_business_account' })
    expect(result).toEqual({ messages: [], statuses: [], unknownEntries: 0 })
  })

  it('un change sin messages ni statuses se cuenta como unknownEntries sin lanzar error', () => {
    const result = normalizeMetaWebhookPayload(envelope({ metadata: { phone_number_id: 'pnid-1' } }))
    expect(result.unknownEntries).toBe(1)
    expect(result.messages).toEqual([])
    expect(result.statuses).toEqual([])
  })

  it('un payload completamente ajeno a la forma esperada no lanza error', () => {
    expect(() => normalizeMetaWebhookPayload('no es un objeto')).not.toThrow()
    expect(() => normalizeMetaWebhookPayload(null)).not.toThrow()
    expect(() => normalizeMetaWebhookPayload(undefined)).not.toThrow()
  })
})
