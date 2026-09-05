export const MAX_PERSONAL_INCOME_NAME_LENGTH = 80

export const INVALID_PERSONAL_INCOME_NAME_MESSAGE =
  `El nombre del ingreso debe ser texto y tener como máximo ${MAX_PERSONAL_INCOME_NAME_LENGTH} caracteres.`

export function normalizePersonalIncomeName(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') throw new Error(INVALID_PERSONAL_INCOME_NAME_MESSAGE)

  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized) return undefined
  if (normalized.length > MAX_PERSONAL_INCOME_NAME_LENGTH) {
    throw new Error(INVALID_PERSONAL_INCOME_NAME_MESSAGE)
  }
  return normalized
}
