import { beforeEach, describe, expect, it, vi } from 'vitest'

const { dispatchAutomationEvent, verifyAutomationJwt } = vi.hoisted(() => ({
  dispatchAutomationEvent: vi.fn(),
  verifyAutomationJwt: vi.fn(),
}))

vi.mock('../server/automation/eventDispatcher', () => ({
  dispatchAutomationEvent,
}))

vi.mock('../server/automationSecurity', () => ({
  verifyAutomationJwt,
}))

import handler from '../api/automation'
import type { VercelRequest, VercelResponse } from '../server/apiUtils'

const PAYLOAD_EVENT_ID = '11111111-1111-4111-8111-111111111111'
const IDEMPOTENCY_KEY = '22222222-2222-4222-8222-222222222222'
const PRIVATE_EVENT_ID = '33333333-3333-4333-8333-333333333333'
const DEVICE_CODE = 'PB-DEVICE-22222222-2222-4222-8222-222222222222'

function createResponse() {
  const response = {
    statusCode: 200,
    headers: {} as Record<string, unknown>,
    body: undefined as unknown,
    ended: false,
    status(statusCode: number) {
      this.statusCode = statusCode
      return this
    },
    json(body: unknown) {
      this.body = body
      return this
    },
    end() {
      this.ended = true
      return this
    },
    setHeader(name: string, value: unknown) {
      this.headers[name] = value
      return this
    },
  }
  return response as unknown as VercelResponse & typeof response
}

function createRequest(headers: Record<string, string | undefined>) {
  return {
    method: 'POST',
    headers: {
      authorization: 'Bearer token',
      'content-type': 'application/json',
      ...headers,
    },
    body: {
      eventId: PAYLOAD_EVENT_ID,
      event: 'income.created',
      createdAt: '2026-07-09T10:50:45.809Z',
      schemaVersion: 1,
      source: 'private-balance-pwa',
      data: { income: { id: 138 } },
    },
  } as unknown as VercelRequest
}

beforeEach(() => {
  verifyAutomationJwt.mockReset()
  verifyAutomationJwt.mockReturnValue({ sub: DEVICE_CODE })
  dispatchAutomationEvent.mockReset()
  dispatchAutomationEvent.mockResolvedValue({
    status: 202,
    body: { accepted: true },
    empty: false,
  })
})

describe('/api/automation idempotency headers', () => {
  it('prioriza X-Private-Balance-Event-Id sobre Idempotency-Key y payload.eventId', async () => {
    const response = createResponse()

    await handler(createRequest({
      'x-private-balance-event-id': PRIVATE_EVENT_ID,
      'idempotency-key': IDEMPOTENCY_KEY,
    }), response)

    expect(dispatchAutomationEvent).toHaveBeenCalledWith({
      envelope: expect.objectContaining({ eventId: PRIVATE_EVENT_ID }),
      licenseDeviceCode: DEVICE_CODE,
    })
  })

  it('usa Idempotency-Key cuando no llega X-Private-Balance-Event-Id', async () => {
    const response = createResponse()

    await handler(createRequest({
      'idempotency-key': IDEMPOTENCY_KEY,
    }), response)

    expect(dispatchAutomationEvent).toHaveBeenCalledWith({
      envelope: expect.objectContaining({ eventId: IDEMPOTENCY_KEY }),
      licenseDeviceCode: DEVICE_CODE,
    })
  })

  it('usa payload.eventId cuando no llegan headers de idempotencia', async () => {
    const response = createResponse()

    await handler(createRequest({}), response)

    expect(dispatchAutomationEvent).toHaveBeenCalledWith({
      envelope: expect.objectContaining({ eventId: PAYLOAD_EVENT_ID }),
      licenseDeviceCode: DEVICE_CODE,
    })
  })
})
