import { beforeEach, describe, expect, it, vi } from 'vitest'

type MockResponse = readonly Record<string, unknown>[]
type NeonSqlMock = ((...args: readonly unknown[]) => Promise<MockResponse>) & { _nextResponse: MockResponse }

// Mismo patrón de mock de @neondatabase/serverless usado en test/licenseRegistry.test.ts.
vi.mock('@neondatabase/serverless', () => {
  const sqlFunction = () => {
    const fn = sqlFunction as NeonSqlMock
    return Promise.resolve(fn._nextResponse)
  }
  ;(sqlFunction as NeonSqlMock)._nextResponse = []
  return { neon: () => sqlFunction }
})

import { getIdempotencyRecord, saveIdempotencyRecord } from '../server/communication/repositories/idempotencyRepository'

const DUMMY_DB_URL = 'postgresql://user:pass@localhost/db'

beforeEach(() => {
  process.env.DATABASE_URL = DUMMY_DB_URL
})

describe('idempotencyRepository', () => {
  it('getIdempotencyRecord devuelve null cuando no hay filas (clave nueva)', async () => {
    const sql = (await import('@neondatabase/serverless')).neon() as NeonSqlMock
    sql._nextResponse = []

    const record = await getIdempotencyRecord('outbound:missing')
    expect(record).toBeNull()
  })

  it('getIdempotencyRecord mapea la fila persistida a camelCase', async () => {
    const sql = (await import('@neondatabase/serverless')).neon() as NeonSqlMock
    sql._nextResponse = [{
      idempotency_key: 'outbound:1',
      payload_hash: 'abc123',
      result_status: 200,
      result_body: { success: true, status: 'accepted' },
      created_at: '2026-07-31T10:00:00.000Z',
    }]

    const record = await getIdempotencyRecord('outbound:1')

    expect(record).toEqual({
      key: 'outbound:1',
      payloadHash: 'abc123',
      resultStatus: 200,
      resultBody: { success: true, status: 'accepted' },
      createdAt: '2026-07-31T10:00:00.000Z',
    })
  })

  it('saveIdempotencyRecord completa sin lanzar con una retención válida', async () => {
    const sql = (await import('@neondatabase/serverless')).neon() as NeonSqlMock
    sql._nextResponse = []

    await expect(saveIdempotencyRecord({
      key: 'outbound:2',
      payloadHash: 'hash',
      resultStatus: 200,
      resultBody: { ok: true },
      retentionDays: 30,
    })).resolves.toBeUndefined()
  })
})
