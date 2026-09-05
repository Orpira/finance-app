export const MAX_PERSONAL_INCOME_CATEGORY_NAME_LENGTH = 50

export const INVALID_PERSONAL_INCOME_CATEGORY_NAME_MESSAGE =
  `La categoría debe ser texto y tener como máximo ${MAX_PERSONAL_INCOME_CATEGORY_NAME_LENGTH} caracteres.`

export function normalizePersonalIncomeCategoryName(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    throw new Error('Debe indicar un nombre para la categoría de ingreso personal.')
  }
  if (typeof value !== 'string') {
    throw new Error(INVALID_PERSONAL_INCOME_CATEGORY_NAME_MESSAGE)
  }

  const cleaned = value.trim().replace(/\s+/g, ' ')
  if (!cleaned) {
    throw new Error('Debe indicar un nombre para la categoría de ingreso personal.')
  }
  if (cleaned.length > MAX_PERSONAL_INCOME_CATEGORY_NAME_LENGTH) {
    throw new Error(INVALID_PERSONAL_INCOME_CATEGORY_NAME_MESSAGE)
  }

  return cleaned
}

export function buildNormalizedPersonalIncomeCategoryName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
}
