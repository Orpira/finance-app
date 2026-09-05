import { describe, expect, it } from 'vitest'

import { assertPersonalIncomeCategoriesAreValid } from '../src/utils/personalIncomeCategoryImport'

function category(overrides: Record<string, unknown> = {}) {
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

describe('assertPersonalIncomeCategoriesAreValid', () => {
  it('acepta una categoría válida sin referencias', () => {
    expect(() => assertPersonalIncomeCategoriesAreValid([category()], [])).not.toThrow()
  })

  it('acepta un backup histórico sin categorías y sin referencias', () => {
    expect(() => assertPersonalIncomeCategoriesAreValid([], [])).not.toThrow()
  })

  it('acepta categorías válidas no utilizadas por ningún ingreso', () => {
    expect(() =>
      assertPersonalIncomeCategoriesAreValid(
        [category(), category({ id: 'pic-2', name: 'Reembolsos', normalizedName: 'reembolsos' })],
        [],
      ),
    ).not.toThrow()
  })

  it('rechaza id inválido', () => {
    expect(() => assertPersonalIncomeCategoriesAreValid([category({ id: '' })], []))
      .toThrow('PERSONAL_INCOME_CATEGORY_INVALID_ID')
    expect(() => assertPersonalIncomeCategoriesAreValid([category({ id: undefined })], []))
      .toThrow('PERSONAL_INCOME_CATEGORY_INVALID_ID')
  })

  it('rechaza nombre inválido', () => {
    expect(() => assertPersonalIncomeCategoriesAreValid([category({ name: '   ' })], []))
      .toThrow('PERSONAL_INCOME_CATEGORY_INVALID_NAME')
    expect(() => assertPersonalIncomeCategoriesAreValid([category({ name: 123 })], []))
      .toThrow('PERSONAL_INCOME_CATEGORY_INVALID_NAME')
  })

  it('rechaza usageMode "professional"', () => {
    expect(() => assertPersonalIncomeCategoriesAreValid([category({ usageMode: 'professional' })], []))
      .toThrow('PERSONAL_INCOME_CATEGORY_INVALID_USAGE_MODE')
  })

  it('rechaza usageMode "hybrid"', () => {
    expect(() => assertPersonalIncomeCategoriesAreValid([category({ usageMode: 'hybrid' })], []))
      .toThrow('PERSONAL_INCOME_CATEGORY_INVALID_USAGE_MODE')
  })

  it('rechaza isArchived con tipo inválido', () => {
    expect(() => assertPersonalIncomeCategoriesAreValid([category({ isArchived: 'yes' })], []))
      .toThrow('PERSONAL_INCOME_CATEGORY_INVALID_IS_ARCHIVED')
  })

  it('rechaza createdAt/updatedAt con tipo inválido cuando están presentes', () => {
    expect(() => assertPersonalIncomeCategoriesAreValid([category({ createdAt: 12345 })], []))
      .toThrow('PERSONAL_INCOME_CATEGORY_INVALID_TIMESTAMP')
    expect(() => assertPersonalIncomeCategoriesAreValid([category({ updatedAt: 12345 })], []))
      .toThrow('PERSONAL_INCOME_CATEGORY_INVALID_TIMESTAMP')
  })

  it('acepta createdAt/updatedAt ausentes (se rellenan después)', () => {
    expect(() =>
      assertPersonalIncomeCategoriesAreValid(
        [category({ createdAt: undefined, updatedAt: undefined })],
        [],
      ),
    ).not.toThrow()
  })

  it('rechaza normalizedName que no corresponde a la normalización canónica de name', () => {
    expect(() =>
      assertPersonalIncomeCategoriesAreValid(
        [category({ name: 'Nómina', normalizedName: 'algo-distinto' })],
        [],
      ),
    ).toThrow('PERSONAL_INCOME_CATEGORY_NORMALIZED_NAME_MISMATCH')
  })

  it('acepta normalizedName ausente, sin exigirlo', () => {
    expect(() =>
      assertPersonalIncomeCategoriesAreValid([category({ normalizedName: undefined })], []),
    ).not.toThrow()
  })

  it('rechaza IDs duplicados', () => {
    expect(() =>
      assertPersonalIncomeCategoriesAreValid(
        [
          category({ id: 'pic-1' }),
          category({ id: 'pic-1', name: 'Otra', normalizedName: 'otra' }),
        ],
        [],
      ),
    ).toThrow('PERSONAL_INCOME_CATEGORY_DUPLICATE_ID')
  })

  it('rechaza un duplicado exacto de nombre', () => {
    expect(() =>
      assertPersonalIncomeCategoriesAreValid(
        [category({ id: 'pic-1', name: 'Nómina' }), category({ id: 'pic-2', name: 'Nómina' })],
        [],
      ),
    ).toThrow('PERSONAL_INCOME_CATEGORY_DUPLICATE_NAME')
  })

  it('rechaza un duplicado por nombre normalizado (mayúsculas, espacios, tildes)', () => {
    expect(() =>
      assertPersonalIncomeCategoriesAreValid(
        [
          category({ id: 'pic-1', name: 'Nómina', normalizedName: undefined }),
          category({ id: 'pic-2', name: '  NOMINA  ', normalizedName: undefined }),
        ],
        [],
      ),
    ).toThrow('PERSONAL_INCOME_CATEGORY_DUPLICATE_NAME')
  })

  it('permite una referencia existente desde un ingreso básico', () => {
    expect(() =>
      assertPersonalIncomeCategoriesAreValid(
        [category({ id: 'pic-1' })],
        [{ usageMode: 'basic', personalCategoryId: 'pic-1' }],
      ),
    ).not.toThrow()
  })

  it('rechaza una referencia huérfana', () => {
    expect(() =>
      assertPersonalIncomeCategoriesAreValid(
        [category({ id: 'pic-1' })],
        [{ usageMode: 'basic', personalCategoryId: 'pic-inexistente' }],
      ),
    ).toThrow('PERSONAL_INCOME_CATEGORY_ORPHAN_REFERENCE')
  })

  it('rechaza cualquier referencia cuando el backup no trae categorías', () => {
    expect(() =>
      assertPersonalIncomeCategoriesAreValid(
        [],
        [{ usageMode: 'basic', personalCategoryId: 'pic-1' }],
      ),
    ).toThrow('PERSONAL_INCOME_CATEGORY_ORPHAN_REFERENCE')
  })

  it('permite una referencia a una categoría archivada (asignación histórica válida)', () => {
    expect(() =>
      assertPersonalIncomeCategoriesAreValid(
        [category({ id: 'pic-1', isArchived: true })],
        [{ usageMode: 'basic', personalCategoryId: 'pic-1' }],
      ),
    ).not.toThrow()
  })

  it('rechaza una referencia personal en un ingreso profesional', () => {
    expect(() =>
      assertPersonalIncomeCategoriesAreValid(
        [category({ id: 'pic-1' })],
        [{ usageMode: 'professional', personalCategoryId: 'pic-1' }],
      ),
    ).toThrow('PERSONAL_INCOME_CATEGORY_NOT_ALLOWED_FOR_PROFESSIONAL')
  })

  it('ignora ingresos sin personalCategoryId', () => {
    expect(() =>
      assertPersonalIncomeCategoriesAreValid(
        [],
        [{ usageMode: 'professional' }, { usageMode: 'basic' }],
      ),
    ).not.toThrow()
  })
})
