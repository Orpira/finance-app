import { describe, expect, it } from 'vitest'

import {
  getExpenseCategoryBadgeLabel,
  getIncomeCategoryBadgeLabel,
  getIncomeDisplayName,
} from '../src/utils/activityLabels'
import type { Expense } from '../src/types/expense'
import type { PersonalExpenseCategory } from '../src/types/personalExpenseCategory'
import type { PersonalIncomeCategory } from '../src/types/personalIncomeCategory'
import type { ServiceIncome } from '../src/types/service'

function baseIncome(overrides: Partial<ServiceIncome> = {}): ServiceIncome {
  return {
    date: '2026-01-01',
    duration: 0,
    totalAmount: 100,
    currency: 'EUR',
    percentage: 0,
    realGain: 100,
    eurValue: 100,
    copValue: 0,
    exchangeRateUsed: 1,
    ...overrides,
  }
}

function category(overrides: Partial<PersonalIncomeCategory> = {}): PersonalIncomeCategory {
  return {
    id: 'pic-1',
    name: 'Nómina',
    normalizedName: 'nomina',
    usageMode: 'basic',
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function baseExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    type: 'gasto',
    date: '2026-01-01',
    category: 'Otros',
    amount: 20,
    currency: 'EUR',
    eurValue: 20,
    copValue: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function expenseCategory(overrides: Partial<PersonalExpenseCategory> = {}): PersonalExpenseCategory {
  return {
    id: 'pec-1',
    name: 'Alimentación',
    normalizedName: 'alimentacion',
    usageMode: 'basic',
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('getIncomeCategoryBadgeLabel', () => {
  it('devuelve undefined cuando el ingreso Personal no tiene categoría', () => {
    const income = baseIncome({ usageMode: 'basic', personalName: 'Freelance' })
    expect(getIncomeCategoryBadgeLabel(income, [category()])).toBeUndefined()
  })

  it('devuelve el nombre de la categoría activa asignada', () => {
    const income = baseIncome({ usageMode: 'basic', personalCategoryId: 'pic-1' })
    expect(getIncomeCategoryBadgeLabel(income, [category()])).toBe('Nómina')
  })

  it('marca una categoría archivada con el sufijo "· Archivada"', () => {
    const income = baseIncome({ usageMode: 'basic', personalCategoryId: 'pic-1' })
    expect(getIncomeCategoryBadgeLabel(income, [category({ isArchived: true })])).toBe('Nómina · Archivada')
  })

  it('nunca se expone en un ingreso Profesional, aunque el campo esté presente', () => {
    const income = baseIncome({ usageMode: 'professional', personalCategoryId: 'pic-1' })
    expect(getIncomeCategoryBadgeLabel(income, [category()])).toBeUndefined()
  })

  it('devuelve undefined si la categoría referenciada no existe en la lista', () => {
    const income = baseIncome({ usageMode: 'basic', personalCategoryId: 'pic-inexistente' })
    expect(getIncomeCategoryBadgeLabel(income, [category()])).toBeUndefined()
  })

  it('el nombre libre del ingreso y la categoría permanecen separados', () => {
    const income = baseIncome({ usageMode: 'basic', personalName: 'Freelance diseño', personalCategoryId: 'pic-1' })
    expect(getIncomeDisplayName(income)).toBe('Freelance diseño')
    expect(getIncomeCategoryBadgeLabel(income, [category()])).toBe('Nómina')
  })
})

describe('getExpenseCategoryBadgeLabel', () => {
  it('devuelve undefined cuando el egreso Personal no tiene categoría', () => {
    const expense = baseExpense({ usageMode: 'basic', personalName: 'Supermercado' })
    expect(getExpenseCategoryBadgeLabel(expense, [expenseCategory()])).toBeUndefined()
  })

  it('devuelve el nombre de la categoría activa asignada', () => {
    const expense = baseExpense({ usageMode: 'basic', personalCategoryId: 'pec-1' })
    expect(getExpenseCategoryBadgeLabel(expense, [expenseCategory()])).toBe('Alimentación')
  })

  it('marca una categoría archivada con el sufijo "· Archivada"', () => {
    const expense = baseExpense({ usageMode: 'basic', personalCategoryId: 'pec-1' })
    expect(getExpenseCategoryBadgeLabel(expense, [expenseCategory({ isArchived: true })])).toBe('Alimentación · Archivada')
  })

  it('nunca se expone en un egreso Profesional, aunque el campo esté presente', () => {
    const expense = baseExpense({ usageMode: 'professional', personalCategoryId: 'pec-1' })
    expect(getExpenseCategoryBadgeLabel(expense, [expenseCategory()])).toBeUndefined()
  })

  it('devuelve undefined si la categoría referenciada no existe en la lista', () => {
    const expense = baseExpense({ usageMode: 'basic', personalCategoryId: 'pec-inexistente' })
    expect(getExpenseCategoryBadgeLabel(expense, [expenseCategory()])).toBeUndefined()
  })
})
