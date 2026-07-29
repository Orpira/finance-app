import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const testKeys = await vi.hoisted(async () => {
  const { generateKeyPairSync } = await import('node:crypto')
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })

  return {
    publicJwk: publicKey.export({ format: 'jwk' }),
    privateJwk: privateKey.export({ format: 'jwk' }),
  }
})

vi.mock('../server/trialLicenseSecurity', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server/trialLicenseSecurity')>()
  return {
    ...actual,
    trialPublicLicenseKeyJwk: testKeys.publicJwk,
  }
})

vi.mock('../server/licenseDeviceRegistry', () => ({
  authorizeLicenseDevice: vi.fn().mockResolvedValue({
    licenseKey: 'test-license-key',
    deviceAuthorization: 'registered',
    activeDevices: 1,
    maxDevices: 1,
  }),
}))

const { InMemoryTrialGrantsRepository } = await import('../server/trialGrantsRepository')
const {
  issueOrReactivateTrial,
  TrialExpiredError,
} = await import('../server/trialLicenseService')
const { verifySignedLicenseForDevice } = await import('../server/automationSecurity')

const input = {
  deviceCode: 'PB-DEVICE-11111111-1111-4111-8111-111111111111',
  userCode: 'PB-USER-test',
  platform: 'web' as const,
}

beforeEach(() => {
  vi.stubEnv('TRIAL_LICENSE_PRIVATE_KEY_JWK', JSON.stringify(testKeys.privateJwk))
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('issueOrReactivateTrial', () => {
  it('device nuevo crea una fila y devuelve outcome issued', async () => {
    const repository = new InMemoryTrialGrantsRepository()

    const result = await issueOrReactivateTrial(input, repository)

    expect(result.outcome).toBe('issued')
    expect(result.activationCode).toMatch(/^PB-LIC-V2\./)
    expect(repository.count()).toBe(1)
  })

  it('segunda llamada del mismo device con trial vigente reactiva sin duplicar fila', async () => {
    const repository = new InMemoryTrialGrantsRepository()

    const first = await issueOrReactivateTrial(input, repository)
    const second = await issueOrReactivateTrial(input, repository)

    expect(second.outcome).toBe('reactivated')
    expect(second.activationCode).toMatch(/^PB-LIC-V2\./)
    expect(second.expiresAt).toBe(first.expiresAt)
    expect(repository.count()).toBe(1)
  })

  it('device con trial expirado lanza TrialExpiredError', async () => {
    const repository = new InMemoryTrialGrantsRepository()
    await repository.insert({
      deviceCode: input.deviceCode,
      userCode: input.userCode,
      issuedAt: '2020-01-01T00:00:00.000Z',
      expiresAt: '2020-01-08T00:00:00.000Z',
    })

    await expect(issueOrReactivateTrial(input, repository)).rejects.toThrow(
      TrialExpiredError,
    )
  })

  it('el activationCode reactivado verifica correctamente contra la clave publica del trial', async () => {
    const repository = new InMemoryTrialGrantsRepository()

    await issueOrReactivateTrial(input, repository)
    const reactivated = await issueOrReactivateTrial(input, repository)

    const payload = verifySignedLicenseForDevice(
      reactivated.activationCode,
      input.deviceCode,
    )
    expect(payload.licenseType).toBe('trial')
  })
})
