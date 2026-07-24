import type { AITool, AIToolContext, AIToolJsonValue } from '../aiToolContracts'
import { createToolFailure } from '../aiToolValidator'
import {
  getSeasonStatistics,
  listEarningPeriods,
} from '../../../services/earningPeriodService'
import { getSettings } from '../../../services/settingsService'
import type { EarningPeriod } from '../../../types/earningPeriod'
import type { AppSettings, CurrencyCode } from '../../../types/settings'
import {
  type FinancialGoalFilters,
  type FinancialGoalInput,
  type FinancialGoalOutput,
  type FinancialGoalPriority,
  type FinancialGoalRecord,
  type FinancialGoalResult,
  type FinancialGoalStatus,
  type FinancialGoalSummary,
} from './goalsContracts'

export type GoalsSummary = FinancialGoalSummary
export type GoalsToolInput = FinancialGoalInput
export type GoalsToolOutput = FinancialGoalOutput
export type GoalsToolResult = FinancialGoalResult

export interface GoalsToolDependencies {
  readonly getSettings?: typeof getSettings
  readonly listEarningPeriods?: typeof listEarningPeriods
  readonly getSeasonStatistics?: typeof getSeasonStatistics
}

export interface GoalsToolUseCase {
  execute(input: FinancialGoalInput): Promise<FinancialGoalResult>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isGoalStatus(value: unknown): value is FinancialGoalStatus {
  return (
    value === 'draft'
    || value === 'planned'
    || value === 'active'
    || value === 'paused'
    || value === 'achieved'
    || value === 'cancelled'
  )
}

function isGoalPriority(value: unknown): value is FinancialGoalPriority {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'critical'
}

function normalizeGoalArguments(
  argumentsValue: Readonly<Record<string, AIToolJsonValue>>,
  context: AIToolContext,
): FinancialGoalInput | null {
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

  const filters: FinancialGoalFilters | undefined = filtersValue === undefined
    ? undefined
    : {
        ...(typeof filtersValue.currencyCode === 'string' ? { currencyCode: filtersValue.currencyCode as CurrencyCode } : {}),
        ...(period === undefined ? {} : { period }),
        ...(Array.isArray(filtersValue.statuses)
          ? { statuses: filtersValue.statuses.filter((status): status is FinancialGoalStatus => isGoalStatus(status)) }
          : {}),
        ...(Array.isArray(filtersValue.priorities)
          ? { priorities: filtersValue.priorities.filter((priority): priority is FinancialGoalPriority => isGoalPriority(priority)) }
          : {}),
        ...(Array.isArray(filtersValue.goalIds)
          ? { goalIds: filtersValue.goalIds.filter((id): id is string => isNonEmptyString(id)) }
          : {}),
        ...(typeof filtersValue.query === 'string' ? { query: filtersValue.query } : {}),
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

function mapGoalStatus(period: EarningPeriod): FinancialGoalStatus {
  return period.status === 'active' ? 'active' : 'achieved'
}

function buildGoalId(period: EarningPeriod): string {
  if (period.id !== undefined) {
    return `earning-period:${String(period.id)}`
  }
  return `earning-period:${period.startDate}`
}

function toDateOnly(value: string | undefined): string | undefined {
  if (value === undefined || value.length < 10) {
    return undefined
  }
  return value.slice(0, 10)
}

function mapPriority(): FinancialGoalPriority {
  return 'medium'
}

function mapGoalRecord(
  period: EarningPeriod,
  currencyCode: CurrencyCode,
  targetAmount: number,
  achievedAmount: number,
  progressPercentage: number,
  timezone: string | undefined,
): FinancialGoalRecord {
  const from = toDateOnly(period.startDate)
  const to = toDateOnly(period.endDate)

  return {
    goalId: buildGoalId(period),
    label: period.name,
    currencyCode,
    status: mapGoalStatus(period),
    priority: mapPriority(),
    targetAmount,
    achievedAmount,
    progressPercentage,
    ...(to === undefined ? {} : { targetDate: to }),
    ...(from === undefined && to === undefined
      ? {}
      : {
          period: {
            ...(from === undefined ? {} : { from }),
            ...(to === undefined ? {} : { to }),
            ...(timezone === undefined ? {} : { timezone }),
          },
        }),
    tags: ['earning-period-goal', period.status],
  }
}

function applyGoalFilters(
  records: readonly FinancialGoalRecord[],
  filters: FinancialGoalFilters | undefined,
): readonly FinancialGoalRecord[] {
  const normalizedQuery = filters?.query?.trim().toLowerCase()

  return records.filter((record) => {
    if (filters?.currencyCode !== undefined && record.currencyCode !== filters.currencyCode) {
      return false
    }
    if (filters?.statuses !== undefined && filters.statuses.length > 0 && !filters.statuses.includes(record.status)) {
      return false
    }
    if (filters?.priorities !== undefined && filters.priorities.length > 0 && !filters.priorities.includes(record.priority)) {
      return false
    }
    if (filters?.goalIds !== undefined && filters.goalIds.length > 0 && !filters.goalIds.includes(record.goalId)) {
      return false
    }
    if (normalizedQuery !== undefined && normalizedQuery.length > 0) {
      const haystack = `${record.label} ${record.goalId}`.toLowerCase()
      if (!haystack.includes(normalizedQuery)) {
        return false
      }
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

function mapGoalsSummary(
  records: readonly FinancialGoalRecord[],
  currencyCode: CurrencyCode,
): FinancialGoalSummary {
  const goalCount = records.length
  const totalTargetAmount = records.reduce((total, item) => total + item.targetAmount, 0)
  const totalAchievedAmount = records.reduce((total, item) => total + item.achievedAmount, 0)
  const progressSum = records.reduce((total, item) => total + item.progressPercentage, 0)

  return {
    currencyCode,
    goalCount,
    activeCount: records.filter((item) => item.status === 'active').length,
    achievedCount: records.filter((item) => item.status === 'achieved').length,
    totalTargetAmount,
    totalAchievedAmount,
    averageProgressPercentage: goalCount === 0 ? 0 : progressSum / goalCount,
  }
}

function mapGoalsOutput(
  records: readonly FinancialGoalRecord[],
  currencyCode: CurrencyCode,
): FinancialGoalOutput {
  return {
    summary: mapGoalsSummary(records, currencyCode),
    items: records,
  }
}

export function createGoalsToolUseCase(input: GoalsToolDependencies = {}): GoalsToolUseCase {
  const dependencies: Required<GoalsToolDependencies> = {
    getSettings: input.getSettings ?? getSettings,
    listEarningPeriods: input.listEarningPeriods ?? listEarningPeriods,
    getSeasonStatistics: input.getSeasonStatistics ?? getSeasonStatistics,
  }

  return {
    async execute(request) {
      try {
        const settings: AppSettings = await dependencies.getSettings()
        const defaultCurrency = (request.filters?.currencyCode ?? settings.defaultCurrency) as CurrencyCode
        const timezone = request.filters?.period?.timezone

        const periods = await dependencies.listEarningPeriods()
        const records = await Promise.all(periods.map(async (period) => {
          if (period.id === undefined) {
            return null
          }

          const statistics = await dependencies.getSeasonStatistics(period.id)
          const targetAmount = statistics.grossIncome
          const achievedAmount = statistics.realGain
          const progressPercentage = targetAmount === 0 ? 0 : (achievedAmount / targetAmount) * 100
          const currencyCode = period.baseCurrency ?? defaultCurrency

          return mapGoalRecord(
            period,
            currencyCode,
            targetAmount,
            achievedAmount,
            progressPercentage,
            timezone,
          )
        }))

        const validRecords = records.filter((record): record is FinancialGoalRecord => record !== null)
        const filtered = applyGoalFilters(validRecords, request.filters)

        return {
          kind: 'success',
          output: mapGoalsOutput(filtered, defaultCurrency),
        }
      } catch (error) {
        return {
          kind: 'failure',
          code: 'GOALS_READ_FAILED',
          retryable: true,
          message: error instanceof Error
            ? error.message
            : 'No se pudo consultar el estado de metas financieras.',
        }
      }
    },
  }
}

export function createGoalsAITool(input: GoalsToolDependencies = {}): AITool {
  const useCase = createGoalsToolUseCase(input)

  return {
    definition: {
      name: 'financial_goals',
      description: 'Returns structured financial goals status from existing earning period services.',
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
                  enum: ['draft', 'planned', 'active', 'paused', 'achieved', 'cancelled'],
                },
              },
              priorities: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['low', 'medium', 'high', 'critical'],
                },
              },
              goalIds: {
                type: 'array',
                items: { type: 'string' },
              },
              query: { type: 'string' },
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
              goalCount: { type: 'number' },
              activeCount: { type: 'number' },
              achievedCount: { type: 'number' },
              totalTargetAmount: { type: 'number' },
              totalAchievedAmount: { type: 'number' },
              averageProgressPercentage: { type: 'number' },
            },
            required: [
              'currencyCode',
              'goalCount',
              'activeCount',
              'achievedCount',
              'totalTargetAmount',
              'totalAchievedAmount',
              'averageProgressPercentage',
            ],
            additionalProperties: false,
          },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                goalId: { type: 'string' },
                label: { type: 'string' },
                currencyCode: { type: 'string' },
                status: {
                  type: 'string',
                  enum: ['draft', 'planned', 'active', 'paused', 'achieved', 'cancelled'],
                },
                priority: {
                  type: 'string',
                  enum: ['low', 'medium', 'high', 'critical'],
                },
                targetAmount: { type: 'number' },
                achievedAmount: { type: 'number' },
                progressPercentage: { type: 'number' },
                targetDate: { type: 'string' },
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
                'goalId',
                'label',
                'currencyCode',
                'status',
                'priority',
                'targetAmount',
                'achievedAmount',
                'progressPercentage',
              ],
              additionalProperties: false,
            },
          },
        },
        required: ['summary', 'items'],
        additionalProperties: false,
      },
      tags: ['financial', 'goals', 'local-first', 'tool-calling'],
    },
    async execute(inputValue) {
      const normalized = normalizeGoalArguments(inputValue.arguments, inputValue.context)
      if (normalized === null) {
        return createToolFailure('INVALID_ARGUMENTS', 'Goals tool requires valid structured arguments.')
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
          toolName: 'financial_goals',
          output: result.output as unknown as AIToolJsonValue,
          permission: 'read-only',
          durationMs: 0,
        },
      }
    },
  }
}
