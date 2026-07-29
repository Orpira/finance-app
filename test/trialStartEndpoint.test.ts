import { beforeEach, describe, expect, it, vi } from 'vitest'

const { issueOrReactivateTrial } = vi.hoisted(() => ({
  issueOrReactivateTrial: vi.fn(),
}))

vi.mock('../server/trialLicenseService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server/trialLicenseService')>()
  return {
    ...actual,
    issueOrReactivateTrial,
  }
})

vi.mock('../server/neonTrialGrantsRepository', () => ({
  neonTrialGrantsRepository: {},
}))

import handler from '../api/trial-start'
import type { VercelRequest, VercelResponse } from '../server/apiUtils'
import { ClockTamperedError, TrialExpiredError } from '../server/trialLicenseService'

const DEVICE_CODE = 'PB-DEVICE-11111111-1111-4111-8111-111111111111'

function createResponse() {
  const response = {
    statusCode: 200,
    headers: {} as Record<string, unknown>,
    body: undefined as unknown,
    status(statusCode: number) {
      this.statusCode = statusCode
      return this
    },
    json(body: unknown) {
      this.body = body
      return this
    },
    end() {
      return this
    },
    setHeader(name: string, value: unknown) {
      this.headers[name] = value
      return this
    },
  }
  return response as unknown as VercelResponse & typeof response
}

function createRequest(body: unknown) {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  } as unknown as VercelRequest
}

const validBody = {
  deviceCode: DEVICE_CODE,
  userCode: 'PB-USER-test',
  platform: 'web',
}

beforeEach(() => {
  issueOrReactivateTrial.mockReset()
})

describe('/api/trial-start', () => {
  it('body invalido responde 400', async () => {
    const response = createResponse()

    await handler(createRequest({ deviceCode: 'no-valido' }), response)

    expect(response.statusCode).toBe(400)
    expect(issueOrReactivateTrial).not.toHaveBeenCalled()
  })

  it('device nuevo responde 200 con outcome issued', async () => {
    issueOrReactivateTrial.mockResolvedValue({
      outcome: 'issued',
      activationCode: 'PB-LIC-V2.payload.sig',
      expiresAt: '2026-01-08T00:00:00.000Z',
      deviceAuthorization: 'registered',
      activeDevices: 1,
      maxDevices: 1,
    })
    const response = createResponse()

    await handler(createRequest(validBody), response)

    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({
      outcome: 'issued',
      activationCode: 'PB-LIC-V2.payload.sig',
    })
  })

  it('device con trial vigente responde 200 con outcome reactivated (no 409)', async () => {
    issueOrReactivateTrial.mockResolvedValue({
      outcome: 'reactivated',
      activationCode: 'PB-LIC-V2.payload.sig2',
      expiresAt: '2026-01-08T00:00:00.000Z',
      deviceAuthorization: 'existing',
      activeDevices: 1,
      maxDevices: 1,
    })
    const response = createResponse()

    await handler(createRequest(validBody), response)

    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({ outcome: 'reactivated' })
  })

  it('device con trial expirado responde 409 con outcome expired', async () => {
    issueOrReactivateTrial.mockRejectedValue(new TrialExpiredError())
    const response = createResponse()

    await handler(createRequest(validBody), response)

    expect(response.statusCode).toBe(409)
    expect(response.body).toMatchObject({ outcome: 'expired' })
  })

  it('reloj manipulado responde 409 con outcome clock-tampered', async () => {
    issueOrReactivateTrial.mockRejectedValue(new ClockTamperedError())
    const response = createResponse()

    await handler(createRequest(validBody), response)

    expect(response.statusCode).toBe(409)
    expect(response.body).toMatchObject({ outcome: 'clock-tampered' })
  })
})
