import type { AITool, AIToolContext, AIToolJsonValue } from '../aiToolContracts'
import { createToolFailure } from '../aiToolValidator'
import { buildBalanceReport, type BalanceReportResult } from '../../../services/balanceReportService'
import { getSettings } from '../../../services/settingsService'
import { listExpenses, type ExpenseListOptions } from '../../../services/expenseService'
import { listServiceIncomes, type ServiceIncomeListOptions } from '../../../services/incomeService'
import type { Expense } from '../../../types/expense'
import type { ServiceIncome } from '../../../types/service'
import type { AppSettings, CurrencyCode } from '../../../types/settings'
import { isAdjustmentIncome } from '../../../utils/incomeTypes'
import { recordBelongsToUsageMode } from '../../../utils/usageMode'
import {
  type FinancialBalanceFilters,
  type FinancialBalanceInput,
  type FinancialBalanceOutput,
  type FinancialBalancePeriodFilter,
  type FinancialBalanceResult,
  type FinancialBalanceSummary,
  type FinancialBalanceSummaryItem,
  type FinancialBalanceUsageMode,
} from './balanceContracts'

export type BalanceSummary = FinancialBalanceSummary
export type BalanceToolInput = FinancialBalanceInput
export type BalanceToolOutput = FinancialBalanceOutput
export type BalanceToolResult = FinancialBalanceResult

export interface BalanceToolDependencies {
  readonly getSettings?: typeof getSettings
  readonly listServiceIncomes?: typeof listServiceIncomes
  readonly listExpenses?: typeof listExpenses
  readonly buildBalanceReport?: typeof buildBalanceReport
}

export interface BalanceToolUseCase {
  execute(input: FinancialBalanceInput): Promise<FinancialBalanceResult>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUsageMode(value: unknown): value is FinancialBalanceUsageMode {
  return value === 'basic' || value === 'professional'
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function clonePeriod(period: FinancialBalancePeriodFilter | undefined): FinancialBalancePeriodFilter | undefined {
  if (period === undefined) {
    return undefined
  }

  return {
    ...(period.from === undefined ? {} : { from: period.from }),
    ...(period.to === undefined ? {} : { to: period.to }),
    ...(period.timezone === undefined ? {} : { timezone: period.timezone }),
  }
}

function normalizeBalanceToolArguments(
  argumentsValue: Readonly<Record<string, AIToolJsonValue>>,
  context: AIToolContext,
): FinancialBalanceInput | null {
  const requestId = argumentsValue.requestId
  const requestedAt = argumentsValue.requestedAt
  const filtersValue = argumentsValue.filters

  if (requestId !== undefined && !isNonEmptyString(requestId)) {
    return null
  }

  if (requestedAt !== undefined && !isNonEmptyString(requestedAt)) {
    return null
  }

  if (filtersValue !== undefined && !isRecord(filtersValue)) {
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

  const filters: FinancialBalanceFilters | undefined = filtersValue === undefined
    ? undefined
    : {
        ...(typeof filtersValue.currencyCode === 'string' ? { currencyCode: filtersValue.currencyCode as CurrencyCode } : {}),
        ...(isUsageMode(filtersValue.usageMode) ? { usageMode: filtersValue.usageMode } : {}),
        ...(period === undefined ? {} : { period }),
        ...(typeof filtersValue.includeAdjustments === 'boolean' ? { includeAdjustments: filtersValue.includeAdjustments } : {}),
        ...(Array.isArray(filtersValue.tags)
          ? { tags: filtersValue.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0) }
          : {}),
      }

  return {
    requestId: requestId ?? context.executionId,
    requestedAt: requestedAt ?? context.requestedAt,
    ...(filters === undefined ? {} : { filters }),
  }
}

function mapBalanceSummary(
  report: BalanceReportResult,
  input: FinancialBalanceInput,
  currency: CurrencyCode,
): FinancialBalanceSummary {
  const includeAdjustments = input.filters?.includeAdjustments !== false
  const adjustmentTotal = includeAdjustments ? report.adjustmentImpactTotal : 0

  return {
    currencyCode: currency,
    incomeTotal: report.incomeGrossTotal,
    expenseTotal: report.expenseTotal,
    adjustmentTotal,
    netBalance: includeAdjustments ? report.generalBalance : report.netProfit,
    hasData: report.hasData,
  }
}

function mapBalanceBreakdown(report: BalanceReportResult, input: FinancialBalanceInput): readonly FinancialBalanceSummaryItem[] {
  const includeAdjustments = input.filters?.includeAdjustments !== false

  const incomeItems = report.incomesByType.map((item) => ({
    category: 'income' as const,
    label: item.label,
    count: item.count,
    totalAmount: item.total,
  }))

  const expenseItems = report.expensesByType.map((item) => ({
    category: 'expense' as const,
    label: item.label,
    count: item.count,
    totalAmount: item.total,
  }))

  const adjustmentItems = includeAdjustments
    && report.adjustments.length > 0
    ? [
        {
          category: 'adjustment' as const,
          label: 'Ajustes',
          count: report.adjustments.length,
          totalAmount: report.adjustmentImpactTotal,
        },
      ]
    : []

  return [...incomeItems, ...expenseItems, ...adjustmentItems]
}

function mapBalanceOutput(
  report: BalanceReportResult,
  input: FinancialBalanceInput,
  currency: CurrencyCode,
): BalanceToolOutput {
  return {
    summary: mapBalanceSummary(report, input, currency),
    ...(input.filters?.period === undefined ? {} : { period: clonePeriod(input.filters.period) }),
    breakdown: mapBalanceBreakdown(report, input),
  }
}

export function createBalanceToolUseCase(input: BalanceToolDependencies = {}): BalanceToolUseCase {
  const dependencies: Required<BalanceToolDependencies> = {
    getSettings: input.getSettings ?? getSettings,
    listServiceIncomes: input.listServiceIncomes ?? listServiceIncomes,
    listExpenses: input.listExpenses ?? listExpenses,
    buildBalanceReport: input.buildBalanceReport ?? buildBalanceReport,
  }

  return {
    async execute(request) {
      try {
        const settings: AppSettings = await dependencies.getSettings()
        const usageMode = request.filters?.usageMode ?? settings.usageMode
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

        const scopedIncomes = incomes.filter((income) => recordBelongsToUsageMode(income, usageMode))
        const scopedExpenses = expenses.filter((expense) => recordBelongsToUsageMode(expense, usageMode))

        const incomesForReport: ServiceIncome[] = request.filters?.includeAdjustments === false
          ? scopedIncomes.filter((income) => !isAdjustmentIncome(income))
          : [...scopedIncomes]
        const expensesForReport: Expense[] = request.filters?.includeAdjustments === false
          ? scopedExpenses.filter((expense) => expense.type !== 'ajuste')
          : [...scopedExpenses]

        const report = dependencies.buildBalanceReport({
          incomes: incomesForReport,
          expenses: expensesForReport,
          currency,
        })

        return {
          kind: 'success',
          output: mapBalanceOutput(report, {
            ...request,
            filters: {
              ...(request.filters === undefined ? {} : request.filters),
              currencyCode: request.filters?.currencyCode ?? currency,
              usageMode,
            },
          }, currency),
        }
      } catch (error) {
        return {
          kind: 'failure',
          code: 'BALANCE_DATA_READ_FAILED',
          retryable: true,
          message: error instanceof Error
            ? error.message
            : 'No se pudo obtener el balance financiero.',
        }
      }
    },
  }
}

export function createBalanceAITool(input: BalanceToolDependencies = {}): AITool {
  const useCase = createBalanceToolUseCase(input)

  return {
    definition: {
      name: 'financial_balance',
      description: 'Returns a structured consolidated financial balance from local domain services.',
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
              usageMode: { type: 'string', enum: ['basic', 'professional'] },
              period: {
                type: 'object',
                properties: {
                  from: { type: 'string' },
                  to: { type: 'string' },
                  timezone: { type: 'string' },
                },
                additionalProperties: false,
              },
              includeAdjustments: { type: 'boolean' },
              tags: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            additionalProperties: false,
          },
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
              incomeTotal: { type: 'number' },
              expenseTotal: { type: 'number' },
              adjustmentTotal: { type: 'number' },
              netBalance: { type: 'number' },
              hasData: { type: 'boolean' },
            },
            required: ['currencyCode', 'incomeTotal', 'expenseTotal', 'adjustmentTotal', 'netBalance', 'hasData'],
            additionalProperties: false,
          },
          period: {
            type: 'object',
            properties: {
              from: { type: 'string' },
              to: { type: 'string' },
              timezone: { type: 'string' },
            },
            additionalProperties: false,
          },
          breakdown: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                category: { type: 'string' },
                label: { type: 'string' },
                count: { type: 'number' },
                totalAmount: { type: 'number' },
              },
              required: ['category', 'label', 'count', 'totalAmount'],
              additionalProperties: false,
            },
          },
        },
        required: ['summary', 'breakdown'],
        additionalProperties: false,
      },
      tags: ['financial', 'balance', 'local-first', 'tool-calling'],
    },
    async execute(inputValue) {
      const normalized = normalizeBalanceToolArguments(inputValue.arguments, inputValue.context)
      if (normalized === null) {
        return createToolFailure('INVALID_ARGUMENTS', 'Balance tool requires valid structured arguments.')
      }

      const result = await useCase.execute({
        requestId: normalized.requestId,
        requestedAt: normalized.requestedAt,
        ...(normalized.filters === undefined ? {} : { filters: normalized.filters }),
      })

      if (result.kind === 'failure') {
        return createToolFailure('TOOL_EXECUTION_FAILED', result.message, result.retryable)
      }

      return {
        kind: 'success',
        value: {
          toolName: 'financial_balance',
          output: result.output as unknown as AIToolJsonValue,
          permission: 'read-only',
          durationMs: 0,
        },
      }
    },
  }
}
