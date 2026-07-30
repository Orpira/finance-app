import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ServiceIncome } from '../types/service'

const servicesTable = { get: vi.fn(), update: vi.fn() }
const incomeAdditionalsTable = {
  add: vi.fn(),
  delete: vi.fn(),
  where: vi.fn(),
}

const transactionMock = vi.fn(async (_mode: unknown, _tables: unknown, callback: () => unknown) =>
  callback(),
)

vi.mock('../database/db', () => ({
  db: {
    services: servicesTable,
    incomeAdditionals: incomeAdditionalsTable,
    transaction: (...args: unknown[]) =>
      transactionMock(...(args as [unknown, unknown, () => unknown])),
  },
}))

const getSettingsMock = vi.fn()
vi.mock('./settingsService', () => ({
  getSettings: () => getSettingsMock(),
}))

const assertRecordIsMutableMock = vi.fn()
vi.mock('./earningPeriodService', () => ({
  assertRecordIsMutable: (...args: unknown[]) => assertRecordIsMutableMock(...args),
}))

const {
  addIncomeAdditional,
  deleteIncomeAdditional,
  listIncomeAdditionals,
} = await import('./incomeAdditionalService')

function basicSettings() {
  return { usageMode: 'basic' as const }
}

function serviceDurationIncome(overrides: Partial<ServiceIncome> = {}): ServiceIncome {
  return {
    id: 1,
    date: '2026-01-01',
    duration: 60,
    totalAmount: 100,
    currency: 'EUR',
    percentage: 50,
    realGain: 50,
    eurValue: 50,
    copValue: 0,
    exchangeRateUsed: 1,
    incomeCalculationMethod: 'service_duration',
    type: 'ingreso',
    ...overrides,
  }
}

function whereChain(items: unknown[]) {
  return {
    equals: () => ({
      toArray: async () => items,
      delete: vi.fn(),
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getSettingsMock.mockResolvedValue(basicSettings())
})

describe('addIncomeAdditional', () => {
  it('rechaza un importe negativo sin llegar a persistir nada', async () => {
    await expect(addIncomeAdditional(1, { amount: -5 })).rejects.toThrow(
      'El importe del adicional no puede ser negativo.',
    )
    expect(incomeAdditionalsTable.add).not.toHaveBeenCalled()
  })

  it('rechaza agregar un adicional a un ingreso ya reportado', async () => {
    const income = serviceDurationIncome({ reportStatusCode: 'reported' })
    servicesTable.get.mockResolvedValue(income)

    await expect(addIncomeAdditional(1, { amount: 10 })).rejects.toThrow(
      'Este registro ya fue reportado y no se puede modificar ni eliminar.',
    )
    expect(incomeAdditionalsTable.add).not.toHaveBeenCalled()
  })

  it('recalcula ÚNICAMENTE additionalsTotal — nunca toca realGain/totalAmount/eurValue del registro', async () => {
    const income = serviceDurationIncome({
      realGain: 50,
      eurValue: 50,
      copValue: 215000,
      baseCurrencyValue: 50,
      secondaryCurrencyValue: 215000,
    })
    servicesTable.get.mockResolvedValue(income)
    incomeAdditionalsTable.where.mockReturnValue(whereChain([{ amount: 20 }]))

    await addIncomeAdditional(1, { amount: 20 })

    expect(incomeAdditionalsTable.add).toHaveBeenCalledWith(
      expect.objectContaining({ incomeId: 1, amount: 20 }),
    )
    expect(servicesTable.update).toHaveBeenCalledWith(1, {
      additionalsTotal: 20,
      updatedAt: expect.any(String),
    })
  })

  it('nunca aplica el % ni recalcula nada del registro para "hourly_workday" tampoco', async () => {
    const income = serviceDurationIncome({
      incomeCalculationMethod: 'hourly_workday',
      totalAmount: 40,
      percentage: 50,
      realGain: 40,
    })
    servicesTable.get.mockResolvedValue(income)
    incomeAdditionalsTable.where.mockReturnValue(whereChain([{ amount: 10 }]))

    await addIncomeAdditional(1, { amount: 10 })

    expect(servicesTable.update).toHaveBeenCalledWith(1, {
      additionalsTotal: 10,
      updatedAt: expect.any(String),
    })
  })
})

describe('deleteIncomeAdditional', () => {
  it('recalcula additionalsTotal tras eliminar, sin tocar el resto del registro', async () => {
    const income = serviceDurationIncome()
    servicesTable.get.mockResolvedValue(income)
    incomeAdditionalsTable.where.mockReturnValue(whereChain([]))

    await deleteIncomeAdditional(7, 1)

    expect(incomeAdditionalsTable.delete).toHaveBeenCalledWith(7)
    expect(servicesTable.update).toHaveBeenCalledWith(1, {
      additionalsTotal: 0,
      updatedAt: expect.any(String),
    })
  })
})

describe('listIncomeAdditionals', () => {
  it('lista los adicionales de un ingreso', async () => {
    const items = [{ id: 1, incomeId: 1, amount: 10, createdAt: '2026-01-01T00:00:00.000Z' }]
    incomeAdditionalsTable.where.mockReturnValue(whereChain(items))

    await expect(listIncomeAdditionals(1)).resolves.toEqual(items)
  })
})
