import type { AITool, AIToolContext, AIToolJsonValue } from '../aiToolContracts'
import { createToolFailure } from '../aiToolValidator'
import { listCutoffReports } from '../../../services/cutoffReportService'
import { getSettings } from '../../../services/settingsService'
import type { AppSettings, CurrencyCode } from '../../../types/settings'
import type { CutoffReport } from '../../../types/cutoffReport'
import {
  type FinancialBudgetFilters,
  type FinancialBudgetInput,
  type FinancialBudgetOutput,
  type FinancialBudgetRecord,
  type FinancialBudgetResult,
  type FinancialBudgetStatus,
  type FinancialBudgetSummary,
} from './budgetContracts'

export type BudgetSummary = FinancialBudgetSummary
export type BudgetToolInput = FinancialBudgetInput
export type BudgetToolOutput = FinancialBudgetOutput
export type BudgetToolResult = FinancialBudgetResult

export interface BudgetToolDependencies {
  readonly getSettings?: typeof getSettings
  readonly listCutoffReports?: typeof listCutoffReports
}

export interface BudgetToolUseCase {
  execute(input: FinancialBudgetInput): Promise<FinancialBudgetResult>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isBudgetStatus(value: unknown): value is FinancialBudgetStatus {
  return (
    value === 'draft'
    || value === 'planned'
    || value === 'active'
    || value === 'paused'
    || value === 'closed'
    || value === 'archived'
  )
}

function normalizeBudgetArguments(
  argumentsValue: Readonly<Record<string, AIToolJsonValue>>,
  context: AIToolContext,
): FinancialBudgetInput | null {
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

  const filters: FinancialBudgetFilters | undefined = filtersValue === undefined
    ? undefined
    : {
        ...(typeof filtersValue.currencyCode === 'string' ? { currencyCode: filtersValue.currencyCode as CurrencyCode } : {}),
        ...(period === undefined ? {} : { period }),
        ...(Array.isArray(filtersValue.statuses)
          ? { statuses: filtersValue.statuses.filter((status): status is FinancialBudgetStatus => isBudgetStatus(status)) }
          : {}),
        ...(Array.isArray(filtersValue.budgetIds)
          ? { budgetIds: filtersValue.budgetIds.filter((id): id is string => isNonEmptyString(id)) }
          : {}),
        ...(Array.isArray(filtersValue.tags)
          ? { tags: filtersValue.tags.filter((tag): tag is string => isNonEmptyString(tag)) }
          : {}),
      }

  return {
    requestId: requestId ?? context.executionId,
    requestedAt: requestedAt ?? context.requestedAt,
    ...(filters === undefined ? {} : { filters }),
  }
}

function buildBudgetId(report: CutoffReport): string {
  if (report.id !== undefined) {
    return `cutoff:${String(report.id)}`
  }
  return `cutoff:${report.frequency}:${report.periodStart}:${report.periodEnd}`
}

function mapReportToBudgetRecord(
  report: CutoffReport,
  timezone: string | undefined,
): FinancialBudgetRecord {
  const budgetId = buildBudgetId(report)

  return {
    budgetId,
    label: `Cutoff ${report.periodStart} - ${report.periodEnd}`,
    currencyCode: report.currency,
    status: 'closed',
    plannedAmount: report.incomeTotal,
    spentAmount: report.expenseTotal,
    remainingAmount: report.netTotal,
    period: {
      from: report.periodStart,
      to: report.periodEnd,
      ...(timezone === undefined ? {} : { timezone }),
    },
    tags: ['cutoff-report', report.frequency],
  }
}

function applyBudgetFilters(
  records: readonly FinancialBudgetRecord[],
  filters: FinancialBudgetFilters | undefined,
): readonly FinancialBudgetRecord[] {
  return records.filter((record) => {
    if (filters?.currencyCode !== undefined && record.currencyCode !== filters.currencyCode) {
      return false
    }
    if (filters?.statuses !== undefined && filters.statuses.length > 0 && !filters.statuses.includes(record.status)) {
      return false
    }
    if (filters?.budgetIds !== undefined && filters.budgetIds.length > 0 && !filters.budgetIds.includes(record.budgetId)) {
      return false
    }
    if (filters?.period?.from !== undefined && record.period?.from !== undefined && record.period.from < filters.period.from) {
      return false
    }
    if (filters?.period?.to !== undefined && record.period?.to !== undefined && record.period.to > filters.period.to) {
      return false
    }
    if (filters?.tags !== undefined && filters.tags.length > 0) {
      const recordTags = record.tags ?? []
      const hasTag = filters.tags.some((tag) => recordTags.includes(tag))
      if (!hasTag) {
        return false
      }
    }
    return true
  })
}

function mapBudgetSummary(
  records: readonly FinancialBudgetRecord[],
  currency: CurrencyCode,
): FinancialBudgetSummary {
  return {
    currencyCode: currency,
    budgetCount: records.length,
    plannedTotal: records.reduce((total, item) => total + item.plannedAmount, 0),
    spentTotal: records.reduce((total, item) => total + item.spentAmount, 0),
    remainingTotal: records.reduce((total, item) => total + item.remainingAmount, 0),
  }
}

function mapBudgetOutput(
  records: readonly FinancialBudgetRecord[],
  currency: CurrencyCode,
): FinancialBudgetOutput {
  return {
    summary: mapBudgetSummary(records, currency),
    items: records,
  }
}

export function createBudgetToolUseCase(input: BudgetToolDependencies = {}): BudgetToolUseCase {
  const dependencies: Required<BudgetToolDependencies> = {
    getSettings: input.getSettings ?? getSettings,
    listCutoffReports: input.listCutoffReports ?? listCutoffReports,
  }

  return {
    async execute(request) {
      try {
        const settings: AppSettings = await dependencies.getSettings()
        const currency = (request.filters?.currencyCode ?? settings.defaultCurrency) as CurrencyCode
        const timezone = request.filters?.period?.timezone

        const reports = await dependencies.listCutoffReports()
        const records = reports.map((report) => mapReportToBudgetRecord(report, timezone))
        const filtered = applyBudgetFilters(records, request.filters)

        return {
          kind: 'success',
          output: mapBudgetOutput(filtered, currency),
        }
      } catch (error) {
        return {
          kind: 'failure',
          code: 'BUDGET_READ_FAILED',
          retryable: true,
          message: error instanceof Error
            ? error.message
            : 'No se pudo consultar el estado presupuestal.',
        }
      }
    },
  }
}

export function createBudgetAITool(input: BudgetToolDependencies = {}): AITool {
  const useCase = createBudgetToolUseCase(input)

  return {
    definition: {
      name: 'financial_budget',
      description: 'Returns structured budget status from existing local cutoff reports.',
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
              statuses: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['draft', 'planned', 'active', 'paused', 'closed', 'archived'],
                },
              },
              budgetIds: {
                type: 'array',
                items: { type: 'string' },
              },
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
              budgetCount: { type: 'number' },
              plannedTotal: { type: 'number' },
              spentTotal: { type: 'number' },
              remainingTotal: { type: 'number' },
            },
            required: ['currencyCode', 'budgetCount', 'plannedTotal', 'spentTotal', 'remainingTotal'],
            additionalProperties: false,
          },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                budgetId: { type: 'string' },
                label: { type: 'string' },
                currencyCode: { type: 'string' },
                status: {
                  type: 'string',
                  enum: ['draft', 'planned', 'active', 'paused', 'closed', 'archived'],
                },
                plannedAmount: { type: 'number' },
                spentAmount: { type: 'number' },
                remainingAmount: { type: 'number' },
                period: {
                  type: 'object',
                  properties: {
                    from: { type: 'string' },
                    to: { type: 'string' },
                    timezone: { type: 'string' },
                  },
                  additionalProperties: false,
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              required: [
                'budgetId',
                'label',
                'currencyCode',
                'status',
                'plannedAmount',
                'spentAmount',
                'remainingAmount',
              ],
              additionalProperties: false,
            },
          },
        },
        required: ['summary', 'items'],
        additionalProperties: false,
      },
      tags: ['financial', 'budget', 'local-first', 'tool-calling'],
    },
    async execute(inputValue) {
      const normalized = normalizeBudgetArguments(inputValue.arguments, inputValue.context)
      if (normalized === null) {
        return createToolFailure('INVALID_ARGUMENTS', 'Budget tool requires valid structured arguments.')
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
          toolName: 'financial_budget',
          output: result.output as unknown as AIToolJsonValue,
          permission: 'read-only',
          durationMs: 0,
        },
      }
    },
  }
}
