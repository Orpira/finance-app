import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const licenseFiles = [
  'api/license-activate.ts',
  'api/automation-token.ts',
  'src/services/licenseAuthorizationService.ts',
  'src/services/licenseService.ts',
  'src/services/signedLicenseService.ts',
  'server/licenseDeviceRegistry.ts',
]

describe('license and WhatsApp architecture boundary', () => {
  it('does not create or connect Evolution instances from licensing code', () => {
    const source = licenseFiles
      .map((file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'))
      .join('\n')

    expect(source).not.toMatch(/instance\/create|device\.whatsapp\.connect\.requested/i)
    expect(source).not.toMatch(/evolution\.orpira\.es/i)
  })
})
