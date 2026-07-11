export type FinancialParityValue =
  | number
  | string
  | boolean
  | null
  | undefined
  | FinancialParityValue[]
  | { [key: string]: FinancialParityValue }

export interface FinancialParityContext {
  rule: string
  mode?: string
  currency?: string
  ids?: Array<number | string>
}

export interface ValidateFinancialParityInput {
  legacyValue: FinancialParityValue
  newValue: FinancialParityValue
  context: FinancialParityContext
}

interface FinancialParityValidatorOptions {
  dev?: boolean
  logger?: (message: string, details: Record<string, unknown>) => void
}

function areExactlyEqual(
  legacyValue: FinancialParityValue,
  newValue: FinancialParityValue,
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

  return legacyKeys.length === newKeys.length &&
    legacyKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(newValue, key) &&
        areExactlyEqual(legacyValue[key], newValue[key]),
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
