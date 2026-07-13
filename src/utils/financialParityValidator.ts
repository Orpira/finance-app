export interface FinancialParityContext {
  rule?: string
  scope?: string
  mode?: string
  usageMode?: string
  currency?: string
  earningPeriodId?: number
  incomeCount?: number
  expenseCount?: number
  field?: string
  ids?: Array<number | string>
}

export interface ValidateFinancialParityInput {
  legacyValue: unknown
  newValue: unknown
  context: FinancialParityContext
}

interface FinancialParityValidatorOptions {
  dev?: boolean
  logger?: (message: string, details: Record<string, unknown>) => void
}

function areExactlyEqual(
  legacyValue: unknown,
  newValue: unknown,
): boolean {
  if (Object.is(legacyValue, newValue)) return true

  if (Array.isArray(legacyValue) || Array.isArray(newValue)) {
    if (!Array.isArray(legacyValue) || !Array.isArray(newValue)) return false
    return legacyValue.length === newValue.length &&
      legacyValue.every((value, index) => areExactlyEqual(value, newValue[index]))
  }

  if (
    legacyValue === null ||
    newValue === null ||
    typeof legacyValue !== 'object' ||
    typeof newValue !== 'object'
  ) {
    return false
  }

  const legacyKeys = Object.keys(legacyValue)
  const newKeys = Object.keys(newValue)
  const legacyRecord = legacyValue as Record<string, unknown>
  const newRecord = newValue as Record<string, unknown>

  return legacyKeys.length === newKeys.length &&
    legacyKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(newRecord, key) &&
        areExactlyEqual(legacyRecord[key], newRecord[key]),
    )
}

export function validateFinancialParity(
  input: ValidateFinancialParityInput,
  options: FinancialParityValidatorOptions = {},
) {
  const isEqual = areExactlyEqual(input.legacyValue, input.newValue)
  const isDevelopment = options.dev ?? import.meta.env.DEV

  if (!isEqual && isDevelopment) {
    const logger = options.logger ?? console.warn
    logger('[financial-parity] Divergence detected', {
      ...input.context,
      legacyValue: input.legacyValue,
      newValue: input.newValue,
    })
  }

  return isEqual
}
