import type { AITool, AIToolContext, AIToolJsonValue } from '../aiToolContracts'
import { createToolFailure } from '../aiToolValidator'
import { listCutoffReports } from '../../../services/cutoffReportService'
import {
  getSeasonStatistics,
  listEarningPeriods,
} from '../../../services/earningPeriodService'
import { getSettings } from '../../../services/settingsService'
import type { CutoffReport } from '../../../types/cutoffReport'
import type { EarningPeriod } from '../../../types/earningPeriod'
import type { AppSettings, CurrencyCode } from '../../../types/settings'
import {
  type FinancialReportFilters,
  type FinancialReportFormat,
  type FinancialReportInput,
  type FinancialReportKind,
  type FinancialReportOutput,
  type FinancialReportResult,
  type FinancialReportRow,
  type FinancialReportSection,
  type FinancialReportSummary,
} from './reportsContracts'

export type ReportsSummary = FinancialReportSummary
export type ReportsToolInput = FinancialReportInput
export type ReportsToolOutput = FinancialReportOutput
export type ReportsToolResult = FinancialReportResult

export interface ReportsToolDependencies {
  readonly getSettings?: typeof getSettings
  readonly listCutoffReports?: typeof listCutoffReports
  readonly listEarningPeriods?: typeof listEarningPeriods
  readonly getSeasonStatistics?: typeof getSeasonStatistics
}

export interface ReportsToolUseCase {
  execute(input: FinancialReportInput): Promise<FinancialReportResult>
}

const FORMAT_SET: readonly FinancialReportFormat[] = ['json', 'csv', 'xlsx', 'pdf', 'markdown']
const KIND_SET: readonly FinancialReportKind[] = [
  'balance',
  'transactions',
  'budget',
  'goals',
  'investments',
  'portfolio',
  'custom',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isReportFormat(value: unknown): value is FinancialReportFormat {
  return FORMAT_SET.includes(value as FinancialReportFormat)
}

function isReportKind(value: unknown): value is FinancialReportKind {
  return KIND_SET.includes(value as FinancialReportKind)
}

function normalizeReportsArguments(
  argumentsValue: Readonly<Record<string, AIToolJsonValue>>,
  context: AIToolContext,
): FinancialReportInput | null {
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

  if (!isReportFormat(formatValue)) {
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
        ...(isReportKind(filtersValue.kind) ? { kind: filtersValue.kind } : {}),
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
    format: formatValue,
    ...(filters === undefined ? {} : { filters }),
  }
}

function toDateOnly(value: string | undefined): string | undefined {
  if (value === undefined || value.length < 10) {
    return undefined
  }
  return value.slice(0, 10)
}

function buildReportId(input: FinancialReportInput): string {
  const kind = input.filters?.kind ?? 'custom'
  return `financial-report:${kind}:${input.requestId}`
}

function withinPeriod(
  fromValue: string | undefined,
  toValue: string | undefined,
  period: FinancialReportFilters['period'],
): boolean {
  if (period?.from !== undefined && fromValue !== undefined && fromValue < period.from) {
    return false
  }
  if (period?.to !== undefined && toValue !== undefined && toValue > period.to) {
    return false
  }
  return true
}

function matchesTags(sectionTags: readonly string[], filterTags: readonly string[] | undefined): boolean {
  if (filterTags === undefined || filterTags.length === 0) {
    return true
  }
  return filterTags.some((tag) => sectionTags.includes(tag))
}

function mapCutoffRows(
  reports: readonly CutoffReport[],
  filters: FinancialReportFilters | undefined,
): readonly FinancialReportRow[] {
  const currencyCode = filters?.currencyCode

  return reports
    .filter((report) => {
      if (currencyCode !== undefined && report.currency !== currencyCode) {
        return false
      }
      return withinPeriod(report.periodStart, report.periodEnd, filters?.period)
    })
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

async function mapSeasonRows(
  periods: readonly EarningPeriod[],
  dependencies: Required<ReportsToolDependencies>,
  filters: FinancialReportFilters | undefined,
  defaultCurrency: CurrencyCode,
): Promise<readonly FinancialReportRow[]> {
  const rows = await Promise.all(periods
    .filter((period) => {
      const periodStart = toDateOnly(period.startDate)
      const periodEnd = toDateOnly(period.endDate)
      if (!withinPeriod(periodStart, periodEnd, filters?.period)) {
        return false
      }

      if (filters?.currencyCode !== undefined && (period.baseCurrency ?? defaultCurrency) !== filters.currencyCode) {
        return false
      }

      return true
    })
    .map(async (period) => {
      if (period.id === undefined) {
        return null
      }

      const statistics = await dependencies.getSeasonStatistics(period.id)
      return {
        periodId: period.id,
        seasonName: period.name,
        status: period.status,
        currencyCode: period.baseCurrency ?? defaultCurrency,
        startDate: toDateOnly(period.startDate) ?? period.startDate,
        ...(toDateOnly(period.endDate) === undefined ? {} : { endDate: toDateOnly(period.endDate) as string }),
        grossIncome: statistics.grossIncome,
        realGain: statistics.realGain,
        expenses: statistics.expenses,
        adjustments: statistics.adjustments,
        netGain: statistics.netGain,
        serviceCount: statistics.serviceCount,
        appointmentCount: statistics.appointmentCount,
        completedAppointmentCount: statistics.completedAppointmentCount,
      }
    }))

  return rows.filter((row) => row !== null) as readonly FinancialReportRow[]
}

function includeCutoffSection(kind: FinancialReportKind | undefined): boolean {
  return kind === undefined || kind === 'balance' || kind === 'transactions' || kind === 'budget' || kind === 'custom' || kind === 'portfolio'
}

function includeSeasonSection(kind: FinancialReportKind | undefined): boolean {
  return kind === undefined || kind === 'goals' || kind === 'custom' || kind === 'portfolio'
}

function filterSections(
  sections: readonly FinancialReportSection[],
  filters: FinancialReportFilters | undefined,
): readonly FinancialReportSection[] {
  return sections.filter((section) => {
    if (filters?.sections !== undefined && filters.sections.length > 0 && !filters.sections.includes(section.sectionId)) {
      return false
    }

    const sectionTags = section.sectionId === 'cutoff-reports'
      ? ['cutoff', 'balance', 'budget', 'transactions']
      : ['season', 'goals']

    return matchesTags(sectionTags, filters?.tags)
  })
}

function mapSummary(
  sections: readonly FinancialReportSection[],
  currencyCode: CurrencyCode,
  input: FinancialReportInput,
): FinancialReportSummary {
  const rowCount = sections.reduce((count, section) => count + section.rows.length, 0)
  const reportKind = input.filters?.kind ?? 'custom'

  return {
    currencyCode,
    sectionCount: sections.length,
    rowCount,
    reportTitle: `Financial ${reportKind} report`,
  }
}

function mapOutput(
  sections: readonly FinancialReportSection[],
  currencyCode: CurrencyCode,
  input: FinancialReportInput,
): FinancialReportOutput {
  return {
    reportId: buildReportId(input),
    generatedAt: input.requestedAt,
    format: input.format,
    summary: mapSummary(sections, currencyCode, input),
    sections,
  }
}

export function createReportsToolUseCase(input: ReportsToolDependencies = {}): ReportsToolUseCase {
  const dependencies: Required<ReportsToolDependencies> = {
    getSettings: input.getSettings ?? getSettings,
    listCutoffReports: input.listCutoffReports ?? listCutoffReports,
    listEarningPeriods: input.listEarningPeriods ?? listEarningPeriods,
    getSeasonStatistics: input.getSeasonStatistics ?? getSeasonStatistics,
  }

  return {
    async execute(request) {
      try {
        const settings: AppSettings = await dependencies.getSettings()
        const currencyCode = (request.filters?.currencyCode ?? settings.defaultCurrency) as CurrencyCode
        const kind = request.filters?.kind

        const [cutoffReports, periods] = await Promise.all([
          includeCutoffSection(kind) ? dependencies.listCutoffReports() : Promise.resolve([]),
          includeSeasonSection(kind) ? dependencies.listEarningPeriods() : Promise.resolve([]),
        ])

        const sections: FinancialReportSection[] = []

        if (includeCutoffSection(kind)) {
          sections.push({
            sectionId: 'cutoff-reports',
            title: 'Cutoff Reports',
            description: 'Consolidated financial cutoffs from existing domain reports.',
            rows: mapCutoffRows(cutoffReports, request.filters),
          })
        }

        if (includeSeasonSection(kind)) {
          sections.push({
            sectionId: 'season-statistics',
            title: 'Season Statistics',
            description: 'Season-level financial statistics from existing domain services.',
            rows: await mapSeasonRows(periods, dependencies, request.filters, currencyCode),
          })
        }

        const filteredSections = filterSections(sections, request.filters)

        return {
          kind: 'success',
          output: mapOutput(filteredSections, currencyCode, request),
        }
      } catch (error) {
        return {
          kind: 'failure',
          code: 'REPORTS_READ_FAILED',
          retryable: true,
          message: error instanceof Error
            ? error.message
            : 'No se pudieron consultar los reportes financieros.',
        }
      }
    },
  }
}

export function createReportsAITool(input: ReportsToolDependencies = {}): AITool {
  const useCase = createReportsToolUseCase(input)

  return {
    definition: {
      name: 'financial_reports',
      description: 'Returns structured consolidated financial reports from existing domain report services.',
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
            enum: ['json', 'csv', 'xlsx', 'pdf', 'markdown'],
          },
          filters: {
            type: 'object',
            properties: {
              currencyCode: { type: 'string' },
              kind: {
                type: 'string',
                enum: ['balance', 'transactions', 'budget', 'goals', 'investments', 'portfolio', 'custom'],
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
        required: ['format'],
        additionalProperties: false,
      },
      outputSchema: {
        type: 'object',
        properties: {
          reportId: { type: 'string' },
          generatedAt: { type: 'string' },
          format: {
            type: 'string',
            enum: ['json', 'csv', 'xlsx', 'pdf', 'markdown'],
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
      tags: ['financial', 'reports', 'local-first', 'tool-calling'],
    },
    async execute(inputValue) {
      const normalized = normalizeReportsArguments(inputValue.arguments, inputValue.context)
      if (normalized === null) {
        return createToolFailure('INVALID_ARGUMENTS', 'Reports tool requires valid structured arguments and format.')
      }

      const result = await useCase.execute({
        requestId: normalized.requestId,
        requestedAt: normalized.requestedAt,
        format: normalized.format,
        ...(normalized.filters === undefined ? {} : { filters: normalized.filters }),
      })

      if (result.kind === 'failure') {
        return createToolFailure('TOOL_EXECUTION_FAILED', result.message, result.retryable)
      }

      return {
        kind: 'success',
        value: {
          toolName: 'financial_reports',
          output: result.output as unknown as AIToolJsonValue,
          permission: 'read-only',
          durationMs: 0,
        },
      }
    },
  }
}
