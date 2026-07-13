import { describe, expect, it } from 'vitest'

import { calculateStoredRealGain } from '../src/utils/realGain'

describe('calculateStoredRealGain', () => {
  it.each([
    ['basic mode uses the total amount', { totalAmount: 120, percentage: 25, usageMode: 'basic' as const }, 120],
    ['professional mode applies the percentage', { totalAmount: 120, percentage: 25, usageMode: 'professional' as const, incomeType: 'ingreso' as const }, 30],
    ['supports a zero percentage', { totalAmount: 120, percentage: 0, usageMode: 'professional' as const, incomeType: 'ingreso' as const }, 0],
    ['supports a 100 percent percentage', { totalAmount: 120, percentage: 100, usageMode: 'professional' as const, incomeType: 'ingreso' as const }, 120],
    ['income adjustments use the total amount', { totalAmount: 120, percentage: 25, usageMode: 'professional' as const, incomeType: 'ajuste' as const }, 120],
    ['historical other income keeps its stored gain', { totalAmount: 120, percentage: 25, usageMode: 'professional' as const, incomeType: 'otro' as const, storedRealGain: 17 }, 17],
    ['historical other income falls back to its total', { totalAmount: 120, percentage: 25, usageMode: 'professional' as const, incomeType: 'otro' as const }, 120],
    ['preserves decimal rounding', { totalAmount: 10.01, percentage: 33.33, usageMode: 'professional' as const, incomeType: 'ingreso' as const }, 3.34],
    ['supports a zero total amount', { totalAmount: 0, percentage: 50, usageMode: 'professional' as const, incomeType: 'ingreso' as const }, 0],
    ['uses the service behavior for a legacy undefined type', { totalAmount: 80, percentage: 50, usageMode: 'professional' as const }, 40],
    ['matches an appointment converted to income', { totalAmount: 200, percentage: 40, usageMode: 'professional' as const, incomeType: 'ingreso' as const }, 80],
  ])('%s', (_label, input, expected) => {
    expect(calculateStoredRealGain(input)).toBe(expected)
  })
})
