import type { AITool, AIToolContext, AIToolJsonValue } from '../aiToolContracts'
import { createToolFailure } from '../aiToolValidator'
import { listCutoffReports } from '../../../services/cutoffReportService'
import {
  getActiveEarningPeriod,
  getSeasonStatistics,
  listClosedEarningPeriods,
} from '../../../services/earningPeriodService'
import { getSettings } from '../../../services/settingsService'
import type { CutoffReport } from '../../../types/cutoffReport'
import type { EarningPeriod } from '../../../types/earningPeriod'
import type { AppSettings, CurrencyCode } from '../../../types/settings'
import {
  type FinancialReportFilters,
  type FinancialReportInput,
  type FinancialReportOutput,
  type FinancialReportResult,
  type FinancialReportRow,
  type FinancialReportSection,
  type FinancialReportSummary,
} from './reportsContracts'

export type FinancialInsightsToolInput = FinancialReportInput
export type FinancialInsightsToolOutput = FinancialReportOutput
export type FinancialInsightsToolResult = FinancialReportResult
export type InsightsSummary = FinancialReportSummary

export interface FinancialInsightsToolDependencies {
  readonly getSettings?: typeof getSettings
  readonly getActiveEarningPeriod?: typeof getActiveEarningPeriod
  readonly listClosedEarningPeriods?: typeof listClosedEarningPeriods
  readonly getSeasonStatistics?: typeof getSeasonStatistics
  readonly listCutoffReports?: typeof listCutoffReports
}

export interface FinancialInsightsToolUseCase {
  execute(input: FinancialInsightsToolInput): Promise<FinancialInsightsToolResult>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeInsightsArguments(
  argumentsValue: Readonly<Record<string, AIToolJsonValue>>,
  context: AIToolContext,
): FinancialInsightsToolInput | null {
  const requestId = argumentsValue.requestId
  const requestedAt = argumentsValue.requestedAt
  const formatValue = argumentsValue.format
  const filtersValue = argumentsValue.filters

  if (requestId !== undefined && !isNonEmptyString(requestId)) {
    return null
  }

  if (requestedAt !== undefined && !isNonEmptyString(requestedAt)) {
    return null
  }

  if (formatValue !== undefined && formatValue !== 'json') {
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

  const filters: FinancialReportFilters | undefined = filtersValue === undefined
    ? undefined
    : {
        ...(typeof filtersValue.currencyCode === 'string' ? { currencyCode: filtersValue.currencyCode as CurrencyCode } : {}),
        ...(period === undefined ? {} : { period }),
        ...(Array.isArray(filtersValue.tags)
          ? { tags: filtersValue.tags.filter((tag): tag is string => isNonEmptyString(tag)) }
          : {}),
        ...(Array.isArray(filtersValue.sections)
          ? { sections: filtersValue.sections.filter((section): section is string => isNonEmptyString(section)) }
          : {}),
      }

  return {
    requestId: requestId ?? context.executionId,
    requestedAt: requestedAt ?? context.requestedAt,
    format: 'json',
    ...(filters === undefined ? {} : { filters }),
  }
}

function toDateOnly(value: string | undefined): string | undefined {
  if (value === undefined || value.length < 10) {
    return undefined
  }
  return value.slice(0, 10)
}

function mapSeasonRows(
  period: EarningPeriod,
  stats: Awaited<ReturnType<typeof getSeasonStatistics>>,
  currencyCode: CurrencyCode,
): readonly FinancialReportRow[] {
  return [
    {
      seasonId: period.id ?? null,
      seasonName: period.name,
      status: period.status,
      startDate: toDateOnly(period.startDate) ?? period.startDate,
      endDate: toDateOnly(period.endDate) ?? null,
      currencyCode,
      grossIncome: stats.grossIncome,
      realGain: stats.realGain,
      totalExpenses: stats.expenses,
      totalAdjustments: stats.adjustments,
      netGain: stats.netGain,
      serviceCount: stats.serviceCount,
      appointmentCount: stats.appointmentCount,
      completedAppointmentCount: stats.completedAppointmentCount,
      bestDayDate: stats.bestDay?.date ?? null,
      bestDayAmount: stats.bestDay?.amount ?? null,
    },
  ]
}

function mapSeasonComparisonRows(
  current: {
    readonly period: EarningPeriod
    readonly stats: Awaited<ReturnType<typeof getSeasonStatistics>>
    readonly currencyCode: CurrencyCode
  } | null,
  previous: {
    readonly period: EarningPeriod
    readonly stats: Awaited<ReturnType<typeof getSeasonStatistics>>
    readonly currencyCode: CurrencyCode
  } | null,
): readonly FinancialReportRow[] {
  if (current === null || previous === null) {
    return []
  }

  return [
    {
      currentSeasonId: current.period.id ?? null,
      currentSeasonName: current.period.name,
      currentCurrencyCode: current.currencyCode,
      currentGrossIncome: current.stats.grossIncome,
      currentRealGain: current.stats.realGain,
      currentNetGain: current.stats.netGain,
      currentServiceCount: current.stats.serviceCount,
      previousSeasonId: previous.period.id ?? null,
      previousSeasonName: previous.period.name,
      previousCurrencyCode: previous.currencyCode,
      previousGrossIncome: previous.stats.grossIncome,
      previousRealGain: previous.stats.realGain,
      previousNetGain: previous.stats.netGain,
      previousServiceCount: previous.stats.serviceCount,
    },
  ]
}

function mapHistoricalRows(reports: readonly CutoffReport[], currencyFilter: CurrencyCode | undefined): readonly FinancialReportRow[] {
  return reports
    .filter((report) => currencyFilter === undefined || report.currency === currencyFilter)
    .map((report) => ({
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      frequency: report.frequency,
      currencyCode: report.currency,
      incomeTotal: report.incomeTotal,
      expenseTotal: report.expenseTotal,
      netTotal: report.netTotal,
      incomeCount: report.incomeCount,
      expenseCount: report.expenseCount,
      serviceMinutes: report.serviceMinutes,
      generatedAt: report.generatedAt,
    }))
}

function filterSections(
  sections: readonly FinancialReportSection[],
  filters: FinancialReportFilters | undefined,
): readonly FinancialReportSection[] {
  if (filters?.sections === undefined || filters.sections.length === 0) {
    return sections
  }

  return sections.filter((section) => filters.sections?.includes(section.sectionId))
}

function mapSummary(
  sections: readonly FinancialReportSection[],
  currencyCode: CurrencyCode,
): FinancialReportSummary {
  return {
    currencyCode,
    sectionCount: sections.length,
    rowCount: sections.reduce((count, section) => count + section.rows.length, 0),
    reportTitle: 'Financial insights report',
  }
}

function mapOutput(
  input: FinancialInsightsToolInput,
  sections: readonly FinancialReportSection[],
  currencyCode: CurrencyCode,
): FinancialInsightsToolOutput {
  return {
    reportId: `financial-insights:${input.requestId}`,
    generatedAt: input.requestedAt,
    format: 'json',
    summary: mapSummary(sections, currencyCode),
    sections,
  }
}

export function createFinancialInsightsToolUseCase(input: FinancialInsightsToolDependencies = {}): FinancialInsightsToolUseCase {
  const dependencies: Required<FinancialInsightsToolDependencies> = {
    getSettings: input.getSettings ?? getSettings,
    getActiveEarningPeriod: input.getActiveEarningPeriod ?? getActiveEarningPeriod,
    listClosedEarningPeriods: input.listClosedEarningPeriods ?? listClosedEarningPeriods,
    getSeasonStatistics: input.getSeasonStatistics ?? getSeasonStatistics,
    listCutoffReports: input.listCutoffReports ?? listCutoffReports,
  }

  return {
    async execute(request) {
      try {
        const settings: AppSettings = await dependencies.getSettings()
        const defaultCurrency = (request.filters?.currencyCode ?? settings.defaultCurrency) as CurrencyCode
        const [activePeriod, closedPeriods, cutoffReports] = await Promise.all([
          dependencies.getActiveEarningPeriod(),
          dependencies.listClosedEarningPeriods(),
          dependencies.listCutoffReports(),
        ])

        const previousClosed = closedPeriods[0]
        const currentSeason = activePeriod?.id === undefined
          ? null
          : {
              period: activePeriod,
              stats: await dependencies.getSeasonStatistics(activePeriod.id),
              currencyCode: activePeriod.baseCurrency ?? defaultCurrency,
            }
        const previousSeason = previousClosed?.id === undefined
          ? null
          : {
              period: previousClosed,
              stats: await dependencies.getSeasonStatistics(previousClosed.id),
              currencyCode: previousClosed.baseCurrency ?? defaultCurrency,
            }

        const sections: FinancialReportSection[] = [
          {
            sectionId: 'current-season-insights',
            title: 'Current Season Insights',
            description: 'Existing season indicators from domain statistics.',
            rows: currentSeason === null
              ? []
              : mapSeasonRows(currentSeason.period, currentSeason.stats, currentSeason.currencyCode),
          },
          {
            sectionId: 'previous-season-insights',
            title: 'Previous Season Insights',
            description: 'Existing previous season indicators from domain statistics.',
            rows: previousSeason === null
              ? []
              : mapSeasonRows(previousSeason.period, previousSeason.stats, previousSeason.currencyCode),
          },
          {
            sectionId: 'season-comparison',
            title: 'Season Comparison',
            description: 'Side-by-side comparison using existing season indicators without recalculation.',
            rows: mapSeasonComparisonRows(currentSeason, previousSeason),
          },
          {
            sectionId: 'historical-cutoff-insights',
            title: 'Historical Cutoff Insights',
            description: 'Historical consolidated cutoff metrics from existing reports.',
            rows: mapHistoricalRows(cutoffReports, request.filters?.currencyCode as CurrencyCode | undefined),
          },
        ]

        const filteredSections = filterSections(sections, request.filters)

        return {
          kind: 'success',
          output: mapOutput(request, filteredSections, defaultCurrency),
        }
      } catch (error) {
        return {
          kind: 'failure',
          code: 'INSIGHTS_READ_FAILED',
          retryable: true,
          message: error instanceof Error
            ? error.message
            : 'No se pudieron consultar los indicadores financieros.',
        }
      }
    },
  }
}

export function createFinancialInsightsAITool(input: FinancialInsightsToolDependencies = {}): AITool {
  const useCase = createFinancialInsightsToolUseCase(input)

  return {
    definition: {
      name: 'financial_insights',
      description: 'Returns structured financial indicators from existing domain statistics and reports.',
      permission: 'read-only',
      deterministic: true,
      failClosed: true,
      inputSchema: {
        type: 'object',
        properties: {
          requestId: { type: 'string' },
          requestedAt: { type: 'string' },
          format: {
            type: 'string',
            enum: ['json'],
          },
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
              tags: {
                type: 'array',
                items: { type: 'string' },
              },
              sections: {
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
          reportId: { type: 'string' },
          generatedAt: { type: 'string' },
          format: {
            type: 'string',
            enum: ['json'],
          },
          summary: {
            type: 'object',
            properties: {
              currencyCode: { type: 'string' },
              sectionCount: { type: 'number' },
              rowCount: { type: 'number' },
              reportTitle: { type: 'string' },
            },
            required: ['currencyCode', 'sectionCount', 'rowCount', 'reportTitle'],
            additionalProperties: false,
          },
          sections: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                sectionId: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                rows: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: true,
                  },
                },
              },
              required: ['sectionId', 'title', 'rows'],
              additionalProperties: false,
            },
          },
        },
        required: ['reportId', 'generatedAt', 'format', 'summary', 'sections'],
        additionalProperties: false,
      },
      tags: ['financial', 'insights', 'local-first', 'tool-calling'],
    },
    async execute(inputValue) {
      const normalized = normalizeInsightsArguments(inputValue.arguments, inputValue.context)
      if (normalized === null) {
        return createToolFailure('INVALID_ARGUMENTS', 'Financial insights tool requires valid structured arguments.')
      }

      const result = await useCase.execute({
        requestId: normalized.requestId,
        requestedAt: normalized.requestedAt,
        format: 'json',
        ...(normalized.filters === undefined ? {} : { filters: normalized.filters }),
      })

      if (result.kind === 'failure') {
        return createToolFailure('TOOL_EXECUTION_FAILED', result.message, result.retryable)
      }

      return {
        kind: 'success',
        value: {
          toolName: 'financial_insights',
          output: result.output as unknown as AIToolJsonValue,
          permission: 'read-only',
          durationMs: 0,
        },
      }
    },
  }
}
