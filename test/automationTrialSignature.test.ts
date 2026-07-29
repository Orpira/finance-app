import { createPrivateKey, generateKeyPairSync, sign } from 'node:crypto'

import { describe, expect, it, vi } from 'vitest'

// Genera un par de claves de prueba y lo inyecta en lugar de la clave pública
// de trial real, para poder firmar una licencia de trial válida en el test
// sin depender de ningún secreto real.
const trialTestKeys = await vi.hoisted(async () => {
  const { generateKeyPairSync: generateKeyPair } = await import('node:crypto')
  const { publicKey, privateKey } = generateKeyPair('ec', { namedCurve: 'P-256' })

  return {
    publicJwk: publicKey.export({ format: 'jwk' }),
    privateJwk: privateKey.export({ format: 'jwk' }),
  }
})

vi.mock('../server/trialLicenseSecurity', () => ({
  trialPublicLicenseKeyJwk: trialTestKeys.publicJwk,
}))

const { verifySignedLicenseForDevice } = await import('../server/automationSecurity')

function signTrialPayload(payload: Record<string, unknown>, privateKeyJwk: object) {
  const payloadBase64Url = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const privateKey = createPrivateKey({ key: privateKeyJwk, format: 'jwk' })
  const signature = sign('sha256', Buffer.from(payloadBase64Url), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  })

  return `PB-LIC-V2.${payloadBase64Url}.${signature.toString('base64url')}`
}

function trialPayload(deviceCode: string) {
  return {
    app: 'private-balance',
    version: 2,
    deviceCode,
    licenseType: 'trial',
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    features: ['core', 'backup', 'reports'],
    devicePolicy: 'single',
  }
}

describe('verifySignedLicenseForDevice - soporte de licencias de trial', () => {
  it('acepta una licencia trial firmada con la clave de trial (antes solo se probaba la clave de pago)', () => {
    const deviceCode = 'PB-DEVICE-AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'
    const code = signTrialPayload(trialPayload(deviceCode), trialTestKeys.privateJwk)

    const payload = verifySignedLicenseForDevice(code, deviceCode)

    expect(payload.licenseType).toBe('trial')
  })

  it('sigue rechazando una licencia trial firmada con una clave que no coincide', () => {
    const deviceCode = 'PB-DEVICE-BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB'
    const wrongKeyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    const wrongPrivateJwk = wrongKeyPair.privateKey.export({ format: 'jwk' })
    const code = signTrialPayload(trialPayload(deviceCode), wrongPrivateJwk)

    expect(() => verifySignedLicenseForDevice(code, deviceCode)).toThrow(
      'La firma digital de la licencia no es válida.',
    )
  })
})
