import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getIdempotencyRecord, saveIdempotencyRecord } = vi.hoisted(() => ({
  getIdempotencyRecord: vi.fn(),
  saveIdempotencyRecord: vi.fn(),
}))

vi.mock('../server/communication/repositories/idempotencyRepository', () => ({
  getIdempotencyRecord,
  saveIdempotencyRecord,
}))

import { withIdempotency, hashPayload } from '../server/communication/services/idempotencyService'
import { CommunicationDuplicateRequestError } from '../server/communication/errors/communicationErrors'

const REQUEST_ID = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  getIdempotencyRecord.mockReset()
  saveIdempotencyRecord.mockReset()
})

describe('withIdempotency — envíos salientes', () => {
  it('ejecuta y guarda el resultado cuando la clave es nueva', async () => {
    getIdempotencyRecord.mockResolvedValue(null)
    const execute = vi.fn().mockResolvedValue({ status: 200, body: { success: true } })

    const result = await withIdempotency(`outbound:${REQUEST_ID}`, { recipient: '1', text: 'hola' }, 30, execute)

    expect(execute).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ status: 200, body: { success: true }, replayed: false })
    expect(saveIdempotencyRecord).toHaveBeenCalledWith(expect.objectContaining({
      key: `outbound:${REQUEST_ID}`,
      resultStatus: 200,
      retentionDays: 30,
    }))
  })

  it('una solicitud repetida con el mismo requestId y el mismo payload no vuelve a ejecutar el efecto', async () => {
    const payload = { recipient: '1', text: 'hola' }
    getIdempotencyRecord.mockResolvedValue({
      key: `outbound:${REQUEST_ID}`,
      payloadHash: hashPayload(payload),
      resultStatus: 200,
      resultBody: { success: true, status: 'accepted' },
      createdAt: new Date().toISOString(),
    })
    const execute = vi.fn()

    const result = await withIdempotency(`outbound:${REQUEST_ID}`, payload, 30, execute)

    expect(execute).not.toHaveBeenCalled()
    expect(result).toEqual({ status: 200, body: { success: true, status: 'accepted' }, replayed: true })
  })

  it('una solicitud repetida con el mismo requestId pero payload distinto se rechaza como conflicto', async () => {
    getIdempotencyRecord.mockResolvedValue({
      key: `outbound:${REQUEST_ID}`,
      payloadHash: hashPayload({ recipient: '1', text: 'original' }),
      resultStatus: 200,
      resultBody: { success: true },
      createdAt: new Date().toISOString(),
    })
    const execute = vi.fn()

    await expect(
      withIdempotency(`outbound:${REQUEST_ID}`, { recipient: '1', text: 'diferente' }, 30, execute),
    ).rejects.toBeInstanceOf(CommunicationDuplicateRequestError)
    expect(execute).not.toHaveBeenCalled()
  })

  it('si execute() falla, no guarda ningún resultado (permite reintentar)', async () => {
    getIdempotencyRecord.mockResolvedValue(null)
    const execute = vi.fn().mockRejectedValue(new Error('fallo transitorio'))

    await expect(withIdempotency(`outbound:${REQUEST_ID}`, {}, 30, execute)).rejects.toThrow('fallo transitorio')
    expect(saveIdempotencyRecord).not.toHaveBeenCalled()
  })
})

describe('hashPayload', () => {
  it('produce el mismo hash para el mismo objeto en distintas invocaciones', () => {
    const payload = { a: 1, b: 'x' }
    expect(hashPayload(payload)).toBe(hashPayload({ a: 1, b: 'x' }))
  })

  it('produce hashes distintos para payloads distintos', () => {
    expect(hashPayload({ a: 1 })).not.toBe(hashPayload({ a: 2 }))
  })
})
