import { describe, expect, it } from 'vitest'

import { canUseCapability, type UsageCapability } from '../src/utils/usageCapabilities'

const ALL_CAPABILITIES: UsageCapability[] = [
  'payment-method',
  'main-priority',
  'income-calculation-method',
  'time-based-income',
  'professional-percentages',
  'professional-agenda',
  'unreported-income',
  'professional-notifications',
]

describe('canUseCapability — matriz central (Bloque 3)', () => {
  it('bloquea cada capacidad profesional en Personal', () => {
    for (const capability of ALL_CAPABILITIES) {
      expect(canUseCapability(capability, 'basic')).toBe(false)
    }
  })

  it('permite cada capacidad en Profesional', () => {
    for (const capability of ALL_CAPABILITIES) {
      expect(canUseCapability(capability, 'professional')).toBe(true)
    }
  })
})
