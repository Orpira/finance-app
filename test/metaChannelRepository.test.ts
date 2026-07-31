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
  getMetaChannel,
  getMetaChannelByPhoneNumber,
  upsertMetaChannel,
} from '../server/communication/repositories/metaChannelRepository'

const DUMMY_DB_URL = 'postgresql://user:pass@localhost/db'
const USER_CODE = 'PB-USER-11111111-1111-4111-8111-111111111111'
const DEVICE_CODE = 'PB-DEVICE-22222222-2222-4222-8222-222222222222'

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1, user_code: USER_CODE, device_code: DEVICE_CODE, status: 'connected', mode: 'simulation',
    enabled: true, phone_number: '34600000000', phone_number_id: '1234567890', waba_id: null,
    masked_phone_number: null, display_name: null, webhook_enabled: false, automation_enabled: true,
    inbound_forwarding_enabled: false, connected_at: '2026-07-31T10:00:00.000Z', last_disconnected_at: null,
    last_seen_at: null, last_inbound_at: null, last_outbound_at: null, last_error_code: null, last_error_at: null,
    provider_metadata: {}, created_at: '2026-07-31T10:00:00.000Z', updated_at: '2026-07-31T10:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  process.env.DATABASE_URL = DUMMY_DB_URL
})

describe('metaChannelRepository', () => {
  it('getMetaChannel devuelve null cuando no hay fila', async () => {
    const sql = (await import('@neondatabase/serverless')).neon() as NeonSqlMock
    sql._nextResponse = []
    expect(await getMetaChannel(USER_CODE, DEVICE_CODE)).toBeNull()
  })

  it('getMetaChannel mapea la fila persistida a camelCase', async () => {
    const sql = (await import('@neondatabase/serverless')).neon() as NeonSqlMock
    sql._nextResponse = [row()]

    const channel = await getMetaChannel(USER_CODE, DEVICE_CODE)

    expect(channel).toMatchObject({
      userCode: USER_CODE,
      deviceCode: DEVICE_CODE,
      status: 'connected',
      mode: 'simulation',
      enabled: true,
      phoneNumber: '34600000000',
      phoneNumberId: '1234567890',
      automationEnabled: true,
    })
  })

  it('getMetaChannelByPhoneNumber mapea la fila más reciente', async () => {
    const sql = (await import('@neondatabase/serverless')).neon() as NeonSqlMock
    sql._nextResponse = [row({ phone_number: '34611111111' })]

    const channel = await getMetaChannelByPhoneNumber('34611111111')
    expect(channel?.phoneNumber).toBe('34611111111')
  })

  it('upsertMetaChannel completa sin lanzar y devuelve la fila mapeada', async () => {
    const sql = (await import('@neondatabase/serverless')).neon() as NeonSqlMock
    sql._nextResponse = [row({ status: 'disabled', enabled: false })]

    const channel = await upsertMetaChannel({
      userCode: USER_CODE,
      deviceCode: DEVICE_CODE,
      status: 'disabled',
      mode: null,
      enabled: false,
      webhookEnabled: false,
      automationEnabled: false,
      inboundForwardingEnabled: false,
    })

    expect(channel.status).toBe('disabled')
    expect(channel.enabled).toBe(false)
  })
})
