import { describe, expect, it, vi } from 'vitest'

import { validateFinancialParity } from '../src/utils/financialParityValidator'

const context = { rule: 'balance.general', mode: 'professional', currency: 'EUR' }

describe('validateFinancialParity', () => {
  it('accepts exact primitive equality', () => {
    expect(validateFinancialParity({ legacyValue: 10, newValue: 10, context }, { dev: true })).toBe(true)
  })

  it('detects a monetary difference of 0.01', () => {
    expect(validateFinancialParity({ legacyValue: 10, newValue: 10.01, context }, { dev: false })).toBe(false)
  })

  it('accepts equal objects and ordered arrays', () => {
    expect(validateFinancialParity({ legacyValue: { total: 10, rows: [1, 2] }, newValue: { total: 10, rows: [1, 2] }, context }, { dev: true })).toBe(true)
  })

  it('detects different objects and array order', () => {
    expect(validateFinancialParity({ legacyValue: { rows: [1, 2] }, newValue: { rows: [2, 1] }, context }, { dev: false })).toBe(false)
  })

  it('logs divergences in development', () => {
    const logger = vi.fn()
    validateFinancialParity({ legacyValue: true, newValue: false, context }, { dev: true, logger })
    expect(logger).toHaveBeenCalledOnce()
    expect(logger).toHaveBeenCalledWith(
      '[financial-parity] Divergence detected',
      expect.objectContaining({ rule: 'balance.general', legacyValue: true, newValue: false }),
    )
  })

  it('does not log divergences in production', () => {
    const logger = vi.fn()
    validateFinancialParity({ legacyValue: 'legacy', newValue: 'new', context }, { dev: false, logger })
    expect(logger).not.toHaveBeenCalled()
  })
})
