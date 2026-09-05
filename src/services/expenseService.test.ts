import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Expense } from '../types/expense'

const expensesTable = {
  get: vi.fn(),
  add: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  toArray: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}

const servicesTable = {
  toArray: vi.fn(),
}

const personalExpenseCategoriesTable = {
  get: vi.fn(),
  where: vi.fn(),
}

const transactionMock = vi.fn(async (_mode: unknown, _tables: unknown, callback: () => unknown) =>
  callback(),
)

vi.mock('../database/db', () => ({
  db: {
    expenses: expensesTable,
    services: servicesTable,
    automationOutbox: {},
    personalExpenseCategories: personalExpenseCategoriesTable,
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

const { createExpense, updateExpense } = await import('./expenseService')

function basicSettings() {
  return { usageMode: 'basic' as const }
}

function professionalSettings() {
  return { usageMode: 'professional' as const }
}

function baseExpenseInput(overrides: Partial<Expense> = {}) {
  return {
    type: 'gasto' as const,
    date: '2026-09-05',
    category: 'Otros',
    amount: 50,
    currency: 'EUR',
    eurValue: 50,
    copValue: 200_000,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  expensesTable.add.mockResolvedValue(1)
  servicesTable.toArray.mockResolvedValue([])
  expensesTable.toArray.mockResolvedValue([])
  personalExpenseCategoriesTable.get.mockResolvedValue(undefined)
  personalExpenseCategoriesTable.where.mockReturnValue({
    equals: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(undefined) }),
  })
  transactionMock.mockImplementation(async (_mode, _tables, callback: () => unknown) => callback())
})

describe('createExpense', () => {
  it('persiste una categoría de egreso personal válida y la separa del catálogo de ingresos', async () => {
    getSettingsMock.mockResolvedValue(basicSettings())
    personalExpenseCategoriesTable.get.mockResolvedValue({
      id: 'pec-1',
      name: 'Alimentación',
      normalizedName: 'alimentacion',
      usageMode: 'basic',
      isArchived: false,
    })

    await createExpense(baseExpenseInput({ personalCategoryId: 'pec-1' }))

    expect(expensesTable.add).toHaveBeenCalledWith(
      expect.objectContaining({ personalCategoryId: 'pec-1', usageMode: 'basic' }),
    )
  })

  it('rechaza una categoría de egreso archivada al crear y una referencia en Profesional', async () => {
    getSettingsMock.mockResolvedValue(basicSettings())
    personalExpenseCategoriesTable.get.mockResolvedValue({
      id: 'pec-1',
      usageMode: 'basic',
      isArchived: true,
    })
    await expect(createExpense(baseExpenseInput({ personalCategoryId: 'pec-1' }))).rejects.toThrow('no es válida')

    getSettingsMock.mockResolvedValue(professionalSettings())
    await expect(createExpense(baseExpenseInput({ personalCategoryId: 'pec-1' }))).rejects.toThrow('NOT_ALLOWED')
  })

  it('normaliza y persiste el nombre de un egreso Personal', async () => {
    getSettingsMock.mockResolvedValue(basicSettings())
    await createExpense(baseExpenseInput({ personalName: '  Compra   supermercado  ' }))
    expect(expensesTable.add).toHaveBeenCalledWith(
      expect.objectContaining({ personalName: 'Compra supermercado', usageMode: 'basic' }),
    )
  })

  it('no persiste nombres vacíos ni nombres enviados en Profesional', async () => {
    getSettingsMock.mockResolvedValue(basicSettings())
    await createExpense(baseExpenseInput({ personalName: '   ' }))
    expect(expensesTable.add).toHaveBeenLastCalledWith(
      expect.objectContaining({ personalName: undefined }),
    )

    getSettingsMock.mockResolvedValue(professionalSettings())
    getActiveEarningPeriodMock.mockResolvedValue({ id: 7, startDate: '2026-01-01' })
    await createExpense(baseExpenseInput({ personalName: 'No permitido' }))
    expect(expensesTable.add).toHaveBeenLastCalledWith(
      expect.objectContaining({ personalName: undefined, usageMode: 'professional' }),
    )
  })

  it('rechaza nombres de más de 80 caracteres', async () => {
    getSettingsMock.mockResolvedValue(basicSettings())
    await expect(
      createExpense(baseExpenseInput({ personalName: 'x'.repeat(81) })),
    ).rejects.toThrow()
  })

  it('mantiene importe, fecha, categoría y contexto sin alterar', async () => {
    getSettingsMock.mockResolvedValue(basicSettings())
    await createExpense(baseExpenseInput({ personalName: 'Alquiler septiembre' }))
    const persisted = expensesTable.add.mock.calls[0][0]
    expect(persisted.amount).toBe(50)
    expect(persisted.date).toBe('2026-09-05')
    expect(persisted.category).toBe('Otros')
    expect(persisted.usageMode).toBe('basic')
  })
})

describe('updateExpense', () => {
  function existingExpense(overrides: Partial<Expense> = {}): Expense {
    return {
      id: 5,
      type: 'gasto',
      date: '2026-09-05',
      category: 'Otros',
      amount: 50,
      currency: 'EUR',
      eurValue: 50,
      copValue: 200_000,
      createdAt: '2026-09-05T10:00:00.000Z',
      usageMode: 'basic',
      personalName: 'Compra supermercado',
      ...overrides,
    }
  }

  it('permite editar el nombre en Personal', async () => {
    getSettingsMock.mockResolvedValue(basicSettings())
    const current = existingExpense()
    expensesTable.get.mockResolvedValue(current)

    await updateExpense(5, { personalName: 'Compra semanal supermercado' })

    expect(expensesTable.put).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 5,
        personalName: 'Compra semanal supermercado',
        amount: 50,
        date: '2026-09-05',
        category: 'Otros',
      }),
    )
  })

  it('permite conservar una categoría archivada y bloquea asignar otra archivada', async () => {
    getSettingsMock.mockResolvedValue(basicSettings())
    const current = existingExpense({ personalCategoryId: 'pec-1' })
    expensesTable.get.mockResolvedValue(current)
    personalExpenseCategoriesTable.get.mockResolvedValue({ id: 'pec-1', usageMode: 'basic', isArchived: true })
    await updateExpense(5, { personalName: 'Nuevo nombre' })
    expect(expensesTable.put).toHaveBeenCalledWith(expect.objectContaining({ personalCategoryId: 'pec-1' }))

    personalExpenseCategoriesTable.get.mockResolvedValue({ id: 'pec-2', usageMode: 'basic', isArchived: true })
    await expect(updateExpense(5, { personalCategoryId: 'pec-2' })).rejects.toThrow('no es válida')
  })

  it('permite eliminar el nombre existente', async () => {
    getSettingsMock.mockResolvedValue(basicSettings())
    const current = existingExpense()
    expensesTable.get.mockResolvedValue(current)

    await updateExpense(5, { personalName: '' })

    expect(expensesTable.put).toHaveBeenCalledWith(
      expect.objectContaining({ id: 5, personalName: undefined }),
    )
  })

  it('no permite inyectar un nombre en un egreso Profesional', async () => {
    getSettingsMock.mockResolvedValue(professionalSettings())
    const current = existingExpense({ usageMode: 'professional', personalName: undefined })
    expensesTable.get.mockResolvedValue(current)

    await updateExpense(5, { personalName: 'Intento manipulado' })

    expect(expensesTable.put).toHaveBeenCalledWith(
      expect.objectContaining({ personalName: undefined }),
    )
  })
})
