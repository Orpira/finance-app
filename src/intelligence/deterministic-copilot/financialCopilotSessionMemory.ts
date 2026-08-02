import type { CurrencyCode } from '../../types/settings'

export interface FinancialCopilotSessionSnapshot {
  readonly currency: CurrencyCode
  readonly period: 'current_month' | 'previous_month' | 'current_week' | 'previous_week' | 'yesterday'
  readonly lastQuery: string | null
  readonly lastCategory: string | null
  readonly lastMetric: 'income' | 'expenses' | 'balance' | 'movements' | 'pending_income' | 'appointments' | null
  readonly lastResult: {
    readonly intent: string
    readonly text: string
    readonly explanation: string
  } | null
  readonly lastFilter: {
    readonly type?: 'income' | 'expense'
    readonly category?: string
    readonly reported?: boolean
  } | null
  readonly lastEntity: {
    readonly type: 'income' | 'expense' | 'expense-category' | 'appointment' | 'goal'
    readonly label: string
  } | null
  readonly pendingProposal: string | null
  readonly lastReport: {
    readonly period: 'current_month' | 'previous_month' | 'current_week' | 'previous_week'
    readonly format: 'pdf' | 'csv'
  } | null
  readonly hiddenFilters: readonly ('period' | 'currency' | 'category')[]
}

export interface FinancialCopilotSessionMemory {
  getSnapshot(): FinancialCopilotSessionSnapshot
  remember(input: Partial<FinancialCopilotSessionSnapshot>): void
  clear(): void
  removeFilter(filter: 'period' | 'currency' | 'category'): void
}

export function createFinancialCopilotSessionMemory(input: {
  readonly currency: CurrencyCode
}): FinancialCopilotSessionMemory {
  const initial: FinancialCopilotSessionSnapshot = {
    currency: input.currency,
    period: 'current_month',
    lastQuery: null,
    lastCategory: null,
    lastMetric: null,
    lastResult: null,
    lastFilter: null,
    lastEntity: null,
    pendingProposal: null,
    lastReport: null,
    hiddenFilters: [],
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
    removeFilter(filter) {
      state = {
        ...state,
        hiddenFilters: [...new Set([...state.hiddenFilters, filter])],
        ...(filter === 'category' ? { lastCategory: null } : {}),
      }
    },
  }
}
