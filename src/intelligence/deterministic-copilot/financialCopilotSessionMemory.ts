import type { CurrencyCode } from '../../types/settings'

export interface FinancialCopilotSessionSnapshot {
  readonly currency: CurrencyCode
  readonly period: 'current_month' | 'yesterday'
  readonly lastQuery: string | null
  readonly lastCategory: string | null
}

export interface FinancialCopilotSessionMemory {
  getSnapshot(): FinancialCopilotSessionSnapshot
  remember(input: Partial<FinancialCopilotSessionSnapshot>): void
  clear(): void
}

export function createFinancialCopilotSessionMemory(input: {
  readonly currency: CurrencyCode
}): FinancialCopilotSessionMemory {
  const initial: FinancialCopilotSessionSnapshot = {
    currency: input.currency,
    period: 'current_month',
    lastQuery: null,
    lastCategory: null,
  }
  let state = { ...initial }

  return {
    getSnapshot() {
      return { ...state }
    },
    remember(next) {
      state = { ...state, ...next }
    },
    clear() {
      state = { ...initial }
    },
  }
}
