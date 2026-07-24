import type { AITool, AIToolContext, AIToolJsonValue } from '../aiToolContracts'
import { createToolFailure } from '../aiToolValidator'
import { getSettings } from '../../../services/settingsService'
import { listExpenses, type ExpenseListOptions } from '../../../services/expenseService'
import { listServiceIncomes, type ServiceIncomeListOptions } from '../../../services/incomeService'
import type { Expense } from '../../../types/expense'
import type { ServiceIncome } from '../../../types/service'
import type { AppSettings, CurrencyCode } from '../../../types/settings'
import { isAdjustmentIncome } from '../../../utils/incomeTypes'
import { recordBelongsToUsageMode } from '../../../utils/usageMode'
import {
  type FinancialTransactionFilters,
  type FinancialTransactionInput,
  type FinancialTransactionKind,
  type FinancialTransactionOutput,
  type FinancialTransactionRecord,
  type FinancialTransactionResult,
  type FinancialTransactionSort,
  type FinancialTransactionSortDirection,
  type FinancialTransactionSortField,
  type FinancialTransactionStatus,
  type FinancialTransactionSummary,
} from './transactionsContracts'

export type TransactionsSummary = FinancialTransactionSummary
export type TransactionsToolInput = FinancialTransactionInput
export type TransactionsToolOutput = FinancialTransactionOutput
export type TransactionsToolResult = FinancialTransactionResult

export interface TransactionsToolDependencies {
  readonly getSettings?: typeof getSettings
  readonly listServiceIncomes?: typeof listServiceIncomes
  readonly listExpenses?: typeof listExpenses
}

export interface TransactionsToolUseCase {
  execute(input: FinancialTransactionInput): Promise<FinancialTransactionResult>
}

interface UnifiedTransactionRecord {
  readonly transactionId: string
  readonly kind: FinancialTransactionKind
  readonly date: string
  readonly label: string
  readonly amount: number
  readonly currencyCode: string
  readonly status: FinancialTransactionStatus
  readonly category?: string
  readonly usageMode: 'basic' | 'professional'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isTransactionKind(value: unknown): value is FinancialTransactionKind {
  return value === 'income' || value === 'expense' || value === 'adjustment' || value === 'transfer'
}

function isTransactionStatus(value: unknown): value is FinancialTransactionStatus {
  return value === 'pending' || value === 'cleared' || value === 'reported' || value === 'reconciled'
}

function parseSafeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function normalizeTransactionArguments(
  argumentsValue: Readonly<Record<string, AIToolJsonValue>>,
  context: AIToolContext,
): FinancialTransactionInput | null {
  const requestId = argumentsValue.requestId
  const requestedAt = argumentsValue.requestedAt
  const filtersValue = argumentsValue.filters
  const sortValue = argumentsValue.sort
  const limitValue = argumentsValue.limit
  const cursorValue = argumentsValue.cursor

  if (requestId !== undefined && !isNonEmptyString(requestId)) {
    return null
  }

  if (requestedAt !== undefined && !isNonEmptyString(requestedAt)) {
    return null
  }

  if (filtersValue !== undefined && !isRecord(filtersValue)) {
    return null
  }

  if (sortValue !== undefined && !isRecord(sortValue)) {
    return null
  }

  if (limitValue !== undefined && (typeof limitValue !== 'number' || !Number.isFinite(limitValue))) {
    return null
  }

  if (cursorValue !== undefined && !isNonEmptyString(cursorValue)) {
    return null
  }

  const periodValue = filtersValue !== undefined && isRecord(filtersValue.period)
    ? filtersValue.period
    : undefined

  const period = periodValue === undefined
    ? undefined
    : {
        ...(typeof periodValue.from === 'string' ? { from: periodValue.from } : {}),
        ...(typeof periodValue.to === 'string' ? { to: periodValue.to } : {}),
        ...(typeof periodValue.timezone === 'string' ? { timezone: periodValue.timezone } : {}),
      }

  const filters: FinancialTransactionFilters | undefined = filtersValue === undefined
    ? undefined
    : {
        ...(typeof filtersValue.currencyCode === 'string' ? { currencyCode: filtersValue.currencyCode as CurrencyCode } : {}),
        ...(period === undefined ? {} : { period }),
        ...(Array.isArray(filtersValue.kinds)
          ? { kinds: filtersValue.kinds.filter((kind): kind is FinancialTransactionKind => isTransactionKind(kind)) }
          : {}),
        ...(Array.isArray(filtersValue.statuses)
          ? { statuses: filtersValue.statuses.filter((status): status is FinancialTransactionStatus => isTransactionStatus(status)) }
          : {}),
        ...(typeof filtersValue.query === 'string' ? { query: filtersValue.query.trim() } : {}),
        ...(parseSafeNumber(filtersValue.minAmount) === undefined ? {} : { minAmount: parseSafeNumber(filtersValue.minAmount) }),
        ...(parseSafeNumber(filtersValue.maxAmount) === undefined ? {} : { maxAmount: parseSafeNumber(filtersValue.maxAmount) }),
        ...(Array.isArray(filtersValue.tags)
          ? { tags: filtersValue.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0) }
          : {}),
      }

  const sort: FinancialTransactionSort | undefined = sortValue !== undefined
    ? {
        field: (
          sortValue.field === 'date' ||
          sortValue.field === 'amount' ||
          sortValue.field === 'label' ||
          sortValue.field === 'status'
            ? sortValue.field
            : 'date'
        ) as FinancialTransactionSortField,
        direction: (
          sortValue.direction === 'asc' || sortValue.direction === 'desc'
            ? sortValue.direction
            : 'desc'
        ) as FinancialTransactionSortDirection,
      }
    : undefined

  return {
    requestId: requestId ?? context.executionId,
    requestedAt: requestedAt ?? context.requestedAt,
    ...(filters === undefined ? {} : { filters }),
    ...(sort === undefined ? {} : { sort }),
    ...(limitValue === undefined ? {} : { limit: Math.max(1, Math.floor(limitValue)) }),
    ...(cursorValue === undefined ? {} : { cursor: cursorValue }),
  }
}

function mapIncomeToTransaction(income: ServiceIncome, currency: CurrencyCode): UnifiedTransactionRecord {
  const amount = currency === 'COP' ? income.copValue : income.eurValue
  const kind: FinancialTransactionKind = isAdjustmentIncome(income) ? 'adjustment' : 'income'

  return {
    transactionId: `income:${String(income.id ?? `${income.date}:${amount}`)}`,
    kind,
    date: income.date,
    label: income.notes?.trim() || (kind === 'adjustment' ? 'Ajuste de ingreso' : 'Ingreso'),
    amount,
    currencyCode: currency,
    status: income.reportStatusCode === 'reported' ? 'reported' : 'pending',
    category: income.paymentType,
    usageMode: recordBelongsToUsageMode(income, 'professional') ? 'professional' : 'basic',
  }
}

function mapExpenseToTransaction(expense: Expense, currency: CurrencyCode): UnifiedTransactionRecord {
  const amount = currency === 'COP' ? expense.copValue : expense.eurValue
  const kind: FinancialTransactionKind = expense.type === 'ajuste' ? 'adjustment' : 'expense'

  return {
    transactionId: `expense:${String(expense.id ?? `${expense.date}:${amount}`)}`,
    kind,
    date: expense.date,
    label: expense.notes?.trim() || expense.category || (kind === 'adjustment' ? 'Ajuste de egreso' : 'Egreso'),
    amount,
    currencyCode: currency,
    status: expense.reportStatusCode === 'reported' ? 'reported' : 'pending',
    category: expense.category,
    usageMode: recordBelongsToUsageMode(expense, 'professional') ? 'professional' : 'basic',
  }
}

function applyFilters(
  items: readonly UnifiedTransactionRecord[],
  request: FinancialTransactionInput,
  usageMode: 'basic' | 'professional',
): readonly UnifiedTransactionRecord[] {
  const query = request.filters?.query?.trim().toLowerCase()
  const kinds = request.filters?.kinds
  const statuses = request.filters?.statuses
  const minAmount = request.filters?.minAmount
  const maxAmount = request.filters?.maxAmount

  return items.filter((item) => {
    if (item.usageMode !== usageMode) {
      return false
    }
    if (kinds !== undefined && kinds.length > 0 && !kinds.includes(item.kind)) {
      return false
    }
    if (statuses !== undefined && statuses.length > 0 && !statuses.includes(item.status)) {
      return false
    }
    if (minAmount !== undefined && item.amount < minAmount) {
      return false
    }
    if (maxAmount !== undefined && item.amount > maxAmount) {
      return false
    }
    if (query !== undefined && query.length > 0) {
      const searchable = `${item.label} ${item.category ?? ''}`.toLowerCase()
      if (!searchable.includes(query)) {
        return false
      }
    }
    return true
  })
}

function sortTransactions(
  items: readonly UnifiedTransactionRecord[],
  request: FinancialTransactionInput,
): UnifiedTransactionRecord[] {
  const field = request.sort?.field ?? 'date'
  const direction = request.sort?.direction ?? 'desc'
  const factor = direction === 'asc' ? 1 : -1

  return [...items].sort((a, b) => {
    if (field === 'amount') {
      return (a.amount - b.amount) * factor
    }
    if (field === 'label') {
      return a.label.localeCompare(b.label, 'es') * factor
    }
    if (field === 'status') {
      return a.status.localeCompare(b.status) * factor
    }
    return a.date.localeCompare(b.date) * factor
  })
}

function paginateTransactions(
  items: readonly UnifiedTransactionRecord[],
  request: FinancialTransactionInput,
): {
  readonly values: readonly UnifiedTransactionRecord[]
  readonly nextCursor?: string
} {
  const limit = request.limit === undefined
    ? 50
    : Math.max(1, Math.min(200, Math.floor(request.limit)))

  if (items.length <= limit) {
    return {
      values: items,
    }
  }

  return {
    values: items.slice(0, limit),
    nextCursor: `offset:${limit}`,
  }
}

function mapSummary(
  items: readonly UnifiedTransactionRecord[],
  currency: CurrencyCode,
): FinancialTransactionSummary {
  const incomeTotal = items
    .filter((item) => item.kind === 'income' || (item.kind === 'adjustment' && item.amount >= 0))
    .reduce((total, item) => total + item.amount, 0)
  const expenseTotal = items
    .filter((item) => item.kind === 'expense' || (item.kind === 'adjustment' && item.amount < 0))
    .reduce((total, item) => total + Math.abs(item.amount), 0)

  return {
    currencyCode: currency,
    matchedCount: items.length,
    incomeTotal,
    expenseTotal,
    netTotal: incomeTotal - expenseTotal,
  }
}

function mapOutput(
  items: readonly UnifiedTransactionRecord[],
  request: FinancialTransactionInput,
  currency: CurrencyCode,
): FinancialTransactionOutput {
  const paginated = paginateTransactions(items, request)
  const mappedItems: readonly FinancialTransactionRecord[] = paginated.values.map((item) => ({
    transactionId: item.transactionId,
    kind: item.kind,
    date: item.date,
    label: item.label,
    amount: item.amount,
    currencyCode: item.currencyCode,
    status: item.status,
    ...(item.category === undefined ? {} : { category: item.category }),
  }))

  return {
    summary: mapSummary(items, currency),
    items: mappedItems,
    ...(paginated.nextCursor === undefined ? {} : { nextCursor: paginated.nextCursor }),
  }
}

export function createTransactionsToolUseCase(input: TransactionsToolDependencies = {}): TransactionsToolUseCase {
  const dependencies: Required<TransactionsToolDependencies> = {
    getSettings: input.getSettings ?? getSettings,
    listServiceIncomes: input.listServiceIncomes ?? listServiceIncomes,
    listExpenses: input.listExpenses ?? listExpenses,
  }

  return {
    async execute(request) {
      try {
        const settings: AppSettings = await dependencies.getSettings()
        const effectiveUsageMode: 'basic' | 'professional' = settings.usageMode
        const currency = (request.filters?.currencyCode ?? settings.defaultCurrency) as CurrencyCode
        const period = request.filters?.period

        const incomeOptions: ServiceIncomeListOptions = {
          ...(period?.from === undefined ? {} : { from: period.from }),
          ...(period?.to === undefined ? {} : { to: period.to }),
          newestFirst: false,
        }
        const expenseOptions: ExpenseListOptions = {
          ...(period?.from === undefined ? {} : { from: period.from }),
          ...(period?.to === undefined ? {} : { to: period.to }),
          newestFirst: false,
        }

        const [incomes, expenses] = await Promise.all([
          dependencies.listServiceIncomes(incomeOptions),
          dependencies.listExpenses(expenseOptions),
        ])

        const unifiedItems = [
          ...incomes.map((income) => mapIncomeToTransaction(income, currency)),
          ...expenses.map((expense) => mapExpenseToTransaction(expense, currency)),
        ]

        const filtered = applyFilters(unifiedItems, request, effectiveUsageMode)
        const sorted = sortTransactions(filtered, request)

        return {
          kind: 'success',
          output: mapOutput(sorted, request, currency),
        }
      } catch (error) {
        return {
          kind: 'failure',
          code: 'TRANSACTIONS_READ_FAILED',
          retryable: true,
          message: error instanceof Error
            ? error.message
            : 'No se pudo leer el historial de transacciones.',
        }
      }
    },
  }
}

export function createTransactionsAITool(input: TransactionsToolDependencies = {}): AITool {
  const useCase = createTransactionsToolUseCase(input)

  return {
    definition: {
      name: 'financial_transactions',
      description: 'Returns structured financial transactions from local domain services.',
      permission: 'read-only',
      deterministic: true,
      failClosed: true,
      inputSchema: {
        type: 'object',
        properties: {
          requestId: { type: 'string' },
          requestedAt: { type: 'string' },
          filters: {
            type: 'object',
            properties: {
              currencyCode: { type: 'string' },
              period: {
                type: 'object',
                properties: {
                  from: { type: 'string' },
                  to: { type: 'string' },
                  timezone: { type: 'string' },
                },
                additionalProperties: false,
              },
              kinds: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['income', 'expense', 'adjustment', 'transfer'],
                },
              },
              statuses: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['pending', 'cleared', 'reported', 'reconciled'],
                },
              },
              query: { type: 'string' },
              minAmount: { type: 'number' },
              maxAmount: { type: 'number' },
              tags: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            additionalProperties: false,
          },
          sort: {
            type: 'object',
            properties: {
              field: {
                type: 'string',
                enum: ['date', 'amount', 'label', 'status'],
              },
              direction: {
                type: 'string',
                enum: ['asc', 'desc'],
              },
            },
            additionalProperties: false,
          },
          limit: { type: 'number' },
          cursor: { type: 'string' },
        },
        additionalProperties: false,
      },
      outputSchema: {
        type: 'object',
        properties: {
          summary: {
            type: 'object',
            properties: {
              currencyCode: { type: 'string' },
              matchedCount: { type: 'number' },
              incomeTotal: { type: 'number' },
              expenseTotal: { type: 'number' },
              netTotal: { type: 'number' },
            },
            required: ['currencyCode', 'matchedCount', 'incomeTotal', 'expenseTotal', 'netTotal'],
            additionalProperties: false,
          },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                transactionId: { type: 'string' },
                kind: {
                  type: 'string',
                  enum: ['income', 'expense', 'adjustment', 'transfer'],
                },
                date: { type: 'string' },
                label: { type: 'string' },
                amount: { type: 'number' },
                currencyCode: { type: 'string' },
                status: {
                  type: 'string',
                  enum: ['pending', 'cleared', 'reported', 'reconciled'],
                },
                category: { type: 'string' },
              },
              required: ['transactionId', 'kind', 'date', 'label', 'amount', 'currencyCode', 'status'],
              additionalProperties: false,
            },
          },
          nextCursor: { type: 'string' },
        },
        required: ['summary', 'items'],
        additionalProperties: false,
      },
      tags: ['financial', 'transactions', 'local-first', 'tool-calling'],
    },
    async execute(inputValue) {
      const normalized = normalizeTransactionArguments(inputValue.arguments, inputValue.context)
      if (normalized === null) {
        return createToolFailure('INVALID_ARGUMENTS', 'Transactions tool requires valid structured arguments.')
      }

      const result = await useCase.execute({
        requestId: normalized.requestId,
        requestedAt: normalized.requestedAt,
        ...(normalized.filters === undefined ? {} : { filters: normalized.filters }),
        ...(normalized.sort === undefined ? {} : { sort: normalized.sort }),
        ...(normalized.limit === undefined ? {} : { limit: normalized.limit }),
        ...(normalized.cursor === undefined ? {} : { cursor: normalized.cursor }),
      })

      if (result.kind === 'failure') {
        return createToolFailure('TOOL_EXECUTION_FAILED', result.message, result.retryable)
      }

      return {
        kind: 'success',
        value: {
          toolName: 'financial_transactions',
          output: result.output as unknown as AIToolJsonValue,
          permission: 'read-only',
          durationMs: 0,
        },
      }
    },
  }
}
