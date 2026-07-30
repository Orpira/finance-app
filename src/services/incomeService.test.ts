import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ServiceIncome } from '../types/service'

const servicesTable = {
  get: vi.fn(),
  add: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  toArray: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}

const expensesTable = {
  where: vi.fn(),
  toArray: vi.fn(),
}

const incomeAdditionalsTable = {
  where: vi.fn(),
}

const transactionMock = vi.fn(async (_mode: unknown, _tables: unknown, callback: () => unknown) =>
  callback(),
)

vi.mock('../database/db', () => ({
  db: {
    services: servicesTable,
    expenses: expensesTable,
    automationOutbox: {},
    incomeAdditionals: incomeAdditionalsTable,
    transaction: (...args: unknown[]) =>
      transactionMock(...(args as [unknown, unknown, () => unknown])),
  },
}))

const getSettingsMock = vi.fn()
vi.mock('./settingsService', () => ({
  getSettings: () => getSettingsMock(),
}))

const getActiveEarningPeriodMock = vi.fn()
const assertRecordIsMutableMock = vi.fn()
vi.mock('./earningPeriodService', () => ({
  getActiveEarningPeriod: () => getActiveEarningPeriodMock(),
  assertRecordIsMutable: (...args: unknown[]) => assertRecordIsMutableMock(...args),
}))

vi.mock('./automationOutboxService', () => ({
  createAutomationOutboxRecord: vi.fn((event: string, payload: unknown) => ({ event, payload })),
  enqueueAutomationEvent: vi.fn(),
  scheduleAutomationOutboxFlush: vi.fn(),
}))

vi.mock('./serviceTimerService', () => ({
  buildInitialServiceTimerState: vi.fn(() => ({})),
}))

const {
  createServiceIncome,
  updateServiceIncome,
  deleteServiceIncome,
} = await import('./incomeService')

function basicSettings() {
  return { usageMode: 'basic' as const }
}

function baseIncomeInput(overrides: Partial<ServiceIncome> = {}) {
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

beforeEach(() => {
  vi.clearAllMocks()
  servicesTable.add.mockResolvedValue(1)
  transactionMock.mockImplementation(async (_mode, _tables, callback: () => unknown) => callback())
})

describe('createServiceIncome', () => {
  it('persiste incomeCalculationMethod="service_duration" por defecto cuando el input no lo especifica', async () => {
    getSettingsMock.mockResolvedValue(basicSettings())

    await createServiceIncome(baseIncomeInput())

    expect(servicesTable.add).toHaveBeenCalledTimes(1)
    const persisted = servicesTable.add.mock.calls[0][0]
    expect(persisted.incomeCalculationMethod).toBe('service_duration')
  })

  it('respeta el incomeCalculationMethod explícito del input (p.ej. "hourly_workday")', async () => {
    getSettingsMock.mockResolvedValue(basicSettings())

    await createServiceIncome(baseIncomeInput({ incomeCalculationMethod: 'hourly_workday' }))

    const persisted = servicesTable.add.mock.calls[0][0]
    expect(persisted.incomeCalculationMethod).toBe('hourly_workday')
  })
})

describe('updateServiceIncome', () => {
  it('ignora un incomeCalculationMethod distinto en los updates (inmutable tras la creación)', async () => {
    getSettingsMock.mockResolvedValue(basicSettings())
    const current: ServiceIncome = {
      id: 1,
      ...baseIncomeInput(),
      incomeCalculationMethod: 'service_duration',
    }
    servicesTable.get.mockResolvedValue(current)
    servicesTable.toArray.mockResolvedValue([current])
    expensesTable.toArray.mockResolvedValue([])

    const result = await updateServiceIncome(1, {
      incomeCalculationMethod: 'hourly_workday',
      totalAmount: 200,
    })

    expect(result.incomeCalculationMethod).toBe('service_duration')
    expect(result.totalAmount).toBe(200)
    expect(servicesTable.put).toHaveBeenCalledWith(
      expect.objectContaining({ incomeCalculationMethod: 'service_duration' }),
    )
  })
})

describe('deleteServiceIncome', () => {
  function mockNoLinkedAdjustment() {
    expensesTable.where.mockReturnValue({
      equals: () => ({
        and: () => ({ first: async () => undefined }),
      }),
    })
  }

  function mockLinkedAdjustment() {
    expensesTable.where.mockReturnValue({
      equals: () => ({
        and: () => ({ first: async () => ({ id: 99, type: 'ajuste', relatedIncomeId: 1 }) }),
      }),
    })
  }

  it('borra en cascada los incomeAdditionals del ingreso antes de eliminar el ingreso', async () => {
    getSettingsMock.mockResolvedValue(basicSettings())
    const current: ServiceIncome = { id: 1, ...baseIncomeInput() }
    servicesTable.get.mockResolvedValue(current)
    mockNoLinkedAdjustment()
    const deleteAdditionalsMock = vi.fn()
    incomeAdditionalsTable.where.mockReturnValue({
      equals: () => ({ delete: deleteAdditionalsMock }),
    })

    await deleteServiceIncome(1)

    expect(incomeAdditionalsTable.where).toHaveBeenCalledWith('incomeId')
    expect(deleteAdditionalsMock).toHaveBeenCalledTimes(1)
    expect(servicesTable.delete).toHaveBeenCalledWith(1)
  })

  it('sigue bloqueando el borrado si hay un ajuste vinculado (regresión)', async () => {
    getSettingsMock.mockResolvedValue(basicSettings())
    const current: ServiceIncome = { id: 1, ...baseIncomeInput() }
    servicesTable.get.mockResolvedValue(current)
    mockLinkedAdjustment()

    await expect(deleteServiceIncome(1)).rejects.toThrow(
      'No puedes eliminar un ingreso que tiene ajustes relacionados. Elimina primero sus ajustes.',
    )
    expect(servicesTable.delete).not.toHaveBeenCalled()
  })
})
