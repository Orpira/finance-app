import { beforeEach, describe, expect, it, vi } from 'vitest'

type MockResponse = readonly Record<string, unknown>[]
type NeonSqlMock = ((...args: readonly unknown[]) => Promise<MockResponse>) & { _nextResponse: MockResponse }

vi.mock('@neondatabase/serverless', () => {
  const sqlFunction = () => {
    const fn = sqlFunction as NeonSqlMock
    return Promise.resolve(fn._nextResponse)
  }
  ;(sqlFunction as NeonSqlMock)._nextResponse = []
  return { neon: () => sqlFunction }
})

import {
  getCorrelationByRequestId,
  recordCorrelation,
  updateCorrelationStatusByProviderMessageId,
} from '../server/communication/repositories/correlationRepository'

const DUMMY_DB_URL = 'postgresql://user:pass@localhost/db'
const REQUEST_ID = 'pb:income.created:01HXYZ:ab12cd34'

beforeEach(() => {
  process.env.DATABASE_URL = DUMMY_DB_URL
})

describe('correlationRepository', () => {
  it('recordCorrelation completa sin lanzar', async () => {
    const sql = (await import('@neondatabase/serverless')).neon() as NeonSqlMock
    sql._nextResponse = []

    await expect(recordCorrelation({
      requestId: REQUEST_ID,
      eventId: '01HXYZ',
      workflowId: 'pb-whatsapp-cloud-send-staging',
      userReference: 'opaque-user',
      deviceReference: 'opaque-device',
      status: 'accepted',
    })).resolves.toBeUndefined()
  })

  it('updateCorrelationStatusByProviderMessageId completa sin lanzar', async () => {
    const sql = (await import('@neondatabase/serverless')).neon() as NeonSqlMock
    sql._nextResponse = []

    await expect(updateCorrelationStatusByProviderMessageId('wamid.1', 'delivered')).resolves.toBeUndefined()
  })

  it('getCorrelationByRequestId devuelve null cuando no hay fila', async () => {
    const sql = (await import('@neondatabase/serverless')).neon() as NeonSqlMock
    sql._nextResponse = []
    expect(await getCorrelationByRequestId(REQUEST_ID)).toBeNull()
  })

  it('getCorrelationByRequestId mapea la fila persistida', async () => {
    const sql = (await import('@neondatabase/serverless')).neon() as NeonSqlMock
    sql._nextResponse = [{
      id: 1, event_id: '01HXYZ', workflow_id: 'pb-whatsapp-cloud-send-staging', request_id: REQUEST_ID,
      provider_message_id: 'wamid.1', user_reference: 'opaque-user', device_reference: 'opaque-device',
      status: 'accepted', created_at: '2026-07-31T10:00:00.000Z', updated_at: '2026-07-31T10:00:00.000Z',
    }]

    const record = await getCorrelationByRequestId(REQUEST_ID)
    expect(record).toMatchObject({
      requestId: REQUEST_ID,
      providerMessageId: 'wamid.1',
      status: 'accepted',
    })
  })
})
