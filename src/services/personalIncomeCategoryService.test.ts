// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const categoriesTable = {
  add: vi.fn(),
  put: vi.fn(),
  get: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  toArray: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
}

const servicesTable = {
  where: vi.fn(),
  toArray: vi.fn(),
}

const transactionMock = vi.fn(async (_mode: unknown, _tables: unknown, callback: () => unknown) => callback())

vi.mock('../database/db', () => ({
  db: {
    personalIncomeCategories: categoriesTable,
    services: servicesTable,
    transaction: (...args: unknown[]) =>
      transactionMock(...(args as [unknown, unknown, () => unknown])),
  },
}))

const {
  createPersonalIncomeCategory,
  listPersonalIncomeCategories,
  normalizePersonalIncomeCategoryName,
  renamePersonalIncomeCategory,
} = await import('./personalIncomeCategoryService')

describe('normalizePersonalIncomeCategoryName', () => {
  it('trims repeated spaces and preserves accents', () => {
    expect(normalizePersonalIncomeCategoryName('  Nómina   extra  ')).toBe('Nómina extra')
  })

  it('rejects empty names', () => {
    expect(() => normalizePersonalIncomeCategoryName('   ')).toThrow('Debe indicar')
  })
})

describe('createPersonalIncomeCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prevents duplicate names with normalized comparison', async () => {
    categoriesTable.toArray.mockResolvedValue([{ id: 'cat-1', name: 'Nómina', normalizedName: 'nomina' }])

    await expect(
      createPersonalIncomeCategory({ name: ' nómina ' }),
    ).rejects.toThrow('ya existe')
  })
})

describe('listPersonalIncomeCategories', () => {
  it('returns all categories ordered by name', async () => {
    categoriesTable.orderBy.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) })

    await listPersonalIncomeCategories({ archived: 'all' })

    expect(categoriesTable.orderBy).toHaveBeenCalledWith('name')
  })
})

describe('renamePersonalIncomeCategory', () => {
  it('updates the record and keeps the same ID', async () => {
    categoriesTable.get.mockResolvedValue({ id: 'cat-1', name: 'Reembolsos', normalizedName: 'reembolsos' })
    categoriesTable.toArray.mockResolvedValue([])
    categoriesTable.put.mockResolvedValue('cat-1')

    const result = await renamePersonalIncomeCategory('cat-1', 'Reembolso')

    expect(result.id).toBe('cat-1')
    expect(result.name).toBe('Reembolso')
  })
})
