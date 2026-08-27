import { describe, expect, it } from 'vitest'

import { getSeasonGoalProgress } from '../src/services/earningPeriodService'
import { calculateSeasonFinancialResult, recordBelongsToEarningPeriod } from '../src/utils/financeStats'
import type { Expense } from '../src/types/expense'
import type { ServiceIncome } from '../src/types/service'

function income(overrides: Partial<ServiceIncome> = {}): ServiceIncome {
  return {
    date: '2026-08-20',
    duration: 60,
    totalAmount: 100,
    currency: 'EUR',
    percentage: 30,
    realGain: 30,
    eurValue: 30,
    copValue: 129_000,
    exchangeRateUsed: 4_300,
    baseCurrency: 'EUR',
    baseCurrencyValue: 30,
    usageMode: 'professional',
    earningPeriodId: 7,
    ...overrides,
  }
}

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    type: 'gasto',
    date: '2026-08-20',
    category: 'Materiales',
    amount: 10,
    currency: 'EUR',
    eurValue: 10,
    copValue: 43_000,
    baseCurrency: 'EUR',
    baseCurrencyValue: 10,
    usageMode: 'professional',
    earningPeriodId: 7,
    createdAt: '2026-08-20T10:00:00.000Z',
    ...overrides,
  }
}

describe('calculateSeasonFinancialResult', () => {
  it('calcula ingresos netos menos egresos con el mismo valor almacenado para cada origen', () => {
    const result = calculateSeasonFinancialResult({
      incomes: [
        income({ id: 1 }),
        income({ id: 2 }),
        income({ id: 3 }),
      ],
      expenses: [expense({ amount: 20, eurValue: 20, baseCurrencyValue: 20 })],
      currency: 'EUR',
      usageMode: 'professional',
      earningPeriodId: 7,
    })

    expect(result).toEqual({
      netIncome: 90,
      expenses: 20,
      result: 70,
    })
  })

  it('aísla modo y temporada y no colapsa ajustes en ingresos o egresos', () => {
    const result = calculateSeasonFinancialResult({
      incomes: [
        income(),
        income({ usageMode: 'basic' }),
        income({ earningPeriodId: 8 }),
        income({ type: 'ajuste', realGain: 50, eurValue: 50, baseCurrencyValue: 50 }),
      ],
      expenses: [
        expense(),
        expense({ usageMode: 'basic' }),
        expense({ earningPeriodId: 8 }),
        expense({ type: 'ajuste', amount: 5, eurValue: 5, baseCurrencyValue: 5 }),
      ],
      currency: 'EUR',
      usageMode: 'professional',
      earningPeriodId: 7,
    })

    expect(result).toEqual({ netIncome: 30, expenses: 10, result: 20 })
  })

  it('reconoce seasonPeriodId en registros históricos', () => {
    const result = calculateSeasonFinancialResult({
      incomes: [income({ earningPeriodId: undefined, seasonPeriodId: 7 })],
      expenses: [expense({ earningPeriodId: undefined, seasonPeriodId: 7 })],
      currency: 'EUR',
      usageMode: 'professional',
      earningPeriodId: 7,
    })

    expect(result).toEqual({ netIncome: 30, expenses: 10, result: 20 })
  })

  it('rechaza de forma fail-closed registros con identificadores de temporada contradictorios', () => {
    const contradictoryRecord = { earningPeriodId: 7, seasonPeriodId: 8 }

    expect(recordBelongsToEarningPeriod(contradictoryRecord, 7)).toBe(false)
    expect(recordBelongsToEarningPeriod(contradictoryRecord, 8)).toBe(false)
    expect(recordBelongsToEarningPeriod(contradictoryRecord)).toBe(false)
    expect(calculateSeasonFinancialResult({
      incomes: [income(contradictoryRecord)],
      expenses: [expense(contradictoryRecord)],
      currency: 'EUR',
      usageMode: 'professional',
      earningPeriodId: 7,
    })).toEqual({ netIncome: 0, expenses: 0, result: 0 })
  })

  it('recalcula al editar y eliminar un egreso', () => {
    const input = {
      incomes: [income()],
      currency: 'EUR' as const,
      usageMode: 'professional' as const,
      earningPeriodId: 7,
    }

    expect(calculateSeasonFinancialResult({
      ...input,
      expenses: [expense()],
    }).result).toBe(20)
    expect(calculateSeasonFinancialResult({
      ...input,
      expenses: [expense({ amount: 20, eurValue: 20, baseCurrencyValue: 20 })],
    }).result).toBe(10)
    expect(calculateSeasonFinancialResult({ ...input, expenses: [] }).result).toBe(30)
  })
})

describe('getSeasonGoalProgress', () => {
  it('no crea progreso cuando la temporada no tiene meta', () => {
    expect(getSeasonGoalProgress({}, { netIncome: 500, expenses: 0, result: 500 })).toBeNull()
  })

  it('calcula resultado, restante y porcentaje sin modificar la meta', () => {
    expect(getSeasonGoalProgress({ economicGoal: 8_500 }, {
      netIncome: 7_000,
      expenses: 800,
      result: 6_200,
    })).toEqual({
      completed: false,
      exceeded: 0,
      expenses: 800,
      goal: 8_500,
      netIncome: 7_000,
      percentage: (6_200 / 8_500) * 100,
      remaining: 2_300,
      result: 6_200,
    })
  })

  it('presenta cero por ciento cuando la meta no tiene resultado realizado', () => {
    expect(getSeasonGoalProgress({ economicGoal: 5_000 }, {
      netIncome: 0,
      expenses: 0,
      result: 0,
    })).toMatchObject({
      completed: false,
      percentage: 0,
      remaining: 5_000,
      result: 0,
    })
  })

  it('marca el objetivo como conseguido al alcanzar exactamente la meta', () => {
    expect(getSeasonGoalProgress({ economicGoal: 1_000 }, {
      netIncome: 1_300,
      expenses: 300,
      result: 1_000,
    })).toMatchObject({
      completed: true,
      exceeded: 0,
      percentage: 100,
      remaining: 0,
      result: 1_000,
    })
  })

  it('permite superar el cien por ciento y nunca produce restante negativo', () => {
    expect(getSeasonGoalProgress({ economicGoal: 1_000 }, {
      netIncome: 1_500,
      expenses: 250,
      result: 1_250,
    })).toMatchObject({
      completed: true,
      exceeded: 250,
      percentage: 125,
      remaining: 0,
      result: 1_250,
    })
  })

  it('mantiene el resultado negativo y suma la pérdida al importe restante', () => {
    expect(getSeasonGoalProgress({ economicGoal: 5_000 }, {
      netIncome: 500,
      expenses: 800,
      result: -300,
    })).toMatchObject({
      completed: false,
      exceeded: 0,
      percentage: -6,
      remaining: 5_300,
      result: -300,
    })
  })
})