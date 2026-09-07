export const MAX_WALLET_NAME_LENGTH = 50

export const INVALID_WALLET_NAME_MESSAGE =
  `El nombre de la wallet debe ser texto y tener como máximo ${MAX_WALLET_NAME_LENGTH} caracteres.`

export function normalizeWalletName(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    throw new Error('Debe indicar un nombre para la wallet.')
  }
  if (typeof value !== 'string') {
    throw new Error(INVALID_WALLET_NAME_MESSAGE)
  }

  const cleaned = value.trim().replace(/\s+/g, ' ')
  if (!cleaned) {
    throw new Error('Debe indicar un nombre para la wallet.')
  }
  if (cleaned.length > MAX_WALLET_NAME_LENGTH) {
    throw new Error(INVALID_WALLET_NAME_MESSAGE)
  }

  return cleaned
}

export function buildNormalizedWalletName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
}
