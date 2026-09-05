import { describe, expect, it } from 'vitest'

import { getIncomeDisplayName } from '../src/utils/activityLabels'
import {
  MAX_PERSONAL_INCOME_NAME_LENGTH,
  normalizePersonalIncomeName,
} from '../src/utils/personalIncomeName'
import type { ServiceIncome } from '../src/types/service'

const income = (overrides: Partial<ServiceIncome> = {}) => ({
  id: 12,
  date: '2026-09-05', duration: 0, totalAmount: 100, currency: 'EUR',
  percentage: 100, realGain: 100, eurValue: 100, copValue: 400_000,
  exchangeRateUsed: 4_000, type: 'ingreso', usageMode: 'basic',
  ...overrides,
} as ServiceIncome)

describe('personal income name', () => {
  it('trims and collapses whitespace while preserving spelling and symbols', () => {
    expect(normalizePersonalIncomeName('  Nómina   septiembre — nº 2  '))
      .toBe('Nómina septiembre — nº 2')
  })

  it('stores blank input as undefined and rejects invalid type or length', () => {
    expect(normalizePersonalIncomeName('   ')).toBeUndefined()
    expect(() => normalizePersonalIncomeName(42)).toThrow()
    expect(() => normalizePersonalIncomeName('x'.repeat(MAX_PERSONAL_INCOME_NAME_LENGTH + 1))).toThrow()
    expect(normalizePersonalIncomeName('x'.repeat(MAX_PERSONAL_INCOME_NAME_LENGTH)))
      .toHaveLength(MAX_PERSONAL_INCOME_NAME_LENGTH)
  })

  it('uses the name only for Personal and preserves the historical fallback', () => {
    expect(getIncomeDisplayName(income({ personalName: 'Venta del portátil' })))
      .toBe('Venta del portátil')
    expect(getIncomeDisplayName(income())).toBe('Ingreso #12')
    expect(getIncomeDisplayName(income({ usageMode: 'professional', personalName: 'No mostrar' })))
      .toBe('Servicio #12')
  })

  it('returns user HTML as plain text for React/escaped exporters to render safely', () => {
    expect(getIncomeDisplayName(income({ personalName: '<script>alert(1)</script>' })))
      .toBe('<script>alert(1)</script>')
  })
})
