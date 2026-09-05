import { describe, expect, it } from 'vitest'

import { getIncomeCategoryBadgeLabel, getIncomeDisplayName } from '../src/utils/activityLabels'
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
