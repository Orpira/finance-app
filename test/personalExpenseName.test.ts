import { describe, expect, it } from 'vitest'

import { getExpenseDisplayName } from '../src/utils/activityLabels'
import {
  MAX_PERSONAL_EXPENSE_NAME_LENGTH,
  normalizePersonalExpenseName,
} from '../src/utils/personalExpenseName'
import type { Expense } from '../src/types/expense'

const expense = (overrides: Partial<Expense> = {}) => ({
  id: 12,
  type: 'gasto', date: '2026-09-05', category: 'Otros', amount: 50,
  currency: 'EUR', eurValue: 50, copValue: 200_000,
  createdAt: '2026-09-05T10:00:00.000Z', usageMode: 'basic',
  ...overrides,
} as Expense)

describe('personal expense name', () => {
  it('trims and collapses whitespace while preserving spelling and symbols', () => {
    expect(normalizePersonalExpenseName('  Compra   supermercado — nº 2  '))
      .toBe('Compra supermercado — nº 2')
  })

  it('stores blank input as undefined and rejects invalid type or length', () => {
    expect(normalizePersonalExpenseName('   ')).toBeUndefined()
    expect(() => normalizePersonalExpenseName(42)).toThrow()
    expect(() => normalizePersonalExpenseName('x'.repeat(MAX_PERSONAL_EXPENSE_NAME_LENGTH + 1))).toThrow()
    expect(normalizePersonalExpenseName('x'.repeat(MAX_PERSONAL_EXPENSE_NAME_LENGTH)))
      .toHaveLength(MAX_PERSONAL_EXPENSE_NAME_LENGTH)
  })

  it('uses the name only for Personal and preserves the historical fallback', () => {
    expect(getExpenseDisplayName(expense({ personalName: 'Compra supermercado' })))
      .toBe('Compra supermercado')
    expect(getExpenseDisplayName(expense())).toBe('Egreso #12')
    expect(getExpenseDisplayName(expense({ usageMode: 'professional', personalName: 'No mostrar' })))
      .toContain('Gasto #12 · Otros · 2026-09-05')
  })

  it('returns user HTML as plain text for React/escaped exporters to render safely', () => {
    expect(getExpenseDisplayName(expense({ personalName: '<script>alert(1)</script>' })))
      .toBe('<script>alert(1)</script>')
  })
})
