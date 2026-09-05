// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const categoriesTable = {
  put: vi.fn(),
  get: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  toArray: vi.fn(),
  delete: vi.fn(),
}

const expensesTable = {
  where: vi.fn(),
}

const transactionMock = vi.fn(async (_mode: unknown, _tables: unknown, callback: () => unknown) => callback())

vi.mock('../database/db', () => ({
  db: {
    personalExpenseCategories: categoriesTable,
    expenses: expensesTable,
    transaction: (...args: unknown[]) => transactionMock(...(args as [unknown, unknown, () => unknown])),
  },
}))

const {
  createPersonalExpenseCategory,
  listPersonalExpenseCategories,
  normalizePersonalExpenseCategoryName,
  renamePersonalExpenseCategory,
} = await import('./personalExpenseCategoryService')

beforeEach(() => {
  vi.clearAllMocks()
  categoriesTable.orderBy.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) })
  categoriesTable.where.mockReturnValue({
    equals: vi.fn().mockReturnValue({
      first: vi.fn().mockResolvedValue(undefined),
      count: vi.fn().mockResolvedValue(0),
    }),
  })
})

describe('personalExpenseCategoryService', () => {
  it('normaliza espacios y conserva tildes en la etiqueta visible', () => {
    expect(normalizePersonalExpenseCategoryName('  Alimentación   y salud ')).toBe('Alimentación y salud')
  })

  it('crea categorías en el catálogo de egresos con modo básico', async () => {
    const category = await createPersonalExpenseCategory({ name: ' Alimentación ' })
    expect(category).toEqual(expect.objectContaining({
      name: 'Alimentación',
      normalizedName: 'alimentacion',
      usageMode: 'basic',
      isArchived: false,
    }))
    expect(categoriesTable.put).toHaveBeenCalledWith(category)
  })

  it('consulta por nombre normalizado y renombra sin cambiar el ID', async () => {
    categoriesTable.get.mockResolvedValue({
      id: 'pec-1',
      name: 'Comida',
      normalizedName: 'comida',
      usageMode: 'basic',
      isArchived: false,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    })
    await renamePersonalExpenseCategory('pec-1', 'Salud')
    expect(categoriesTable.where).toHaveBeenCalledWith('normalizedName')
    expect(categoriesTable.put).toHaveBeenCalledWith(expect.objectContaining({ id: 'pec-1', normalizedName: 'salud' }))
  })

  it('filtra activas por defecto y permite todas', async () => {
    const toArray = vi.fn().mockResolvedValue([
      { id: 'pec-1', name: 'Activa', isArchived: false },
      { id: 'pec-2', name: 'Archivada', isArchived: true },
    ])
    categoriesTable.orderBy.mockReturnValue({ toArray })
    expect(await listPersonalExpenseCategories()).toEqual([{ id: 'pec-1', name: 'Activa', isArchived: false }])
    expect(await listPersonalExpenseCategories({ archived: 'all' })).toHaveLength(2)
  })
})
