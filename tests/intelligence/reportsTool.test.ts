import { describe, expect, it, vi } from 'vitest'

import { createDefaultSettings } from '../../src/database/db'
import {
  createReportsAITool,
  createReportsToolUseCase,
  type ReportsSummary,
  type ReportsToolOutput,
} from '../../src/intelligence/ai-tools/financial'
import type { CutoffReport } from '../../src/types/cutoffReport'
import type { EarningPeriod } from '../../src/types/earningPeriod'

function createCutoffReport(partial: Partial<CutoffReport>): CutoffReport {
  return {
    id: 1,
    frequency: 'monthly',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    generatedAt: '2026-08-01T00:00:00.000Z',
    currency: 'EUR',
    incomeTotal: 1600,
    expenseTotal: 700,
    netTotal: 900,
    incomeCount: 5,
    expenseCount: 3,
    serviceMinutes: 420,
    paymentTypeTotals: { Transferencia: 1100, Efectivo: 500 },
    expenseCategoryTotals: { Operativo: 450, Marketing: 250 },
    ...partial,
  }
}

function createEarningPeriod(partial: Partial<EarningPeriod>): EarningPeriod {
  return {
    id: 1,
    name: 'Temporada principal',
    percentage: 55,
    startDate: '2026-07-01T00:00:00.000Z',
    endDate: '2026-07-31T23:59:59.999Z',
    status: 'active',
    baseCurrency: 'EUR',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-02T00:00:00.000Z',
    ...partial,
  }
}

function createContext() {
  return {
    executionId: 'exec:reports:001',
    conversationId: 'conversation:reports:001',
    sessionId: 'session:reports:001',
    providerId: 'OPENAI',
    model: 'gpt-4.1-mini',
    requestedAt: '2026-07-24T10:00:00.000Z',
    caller: 'PIPELINE' as const,
  }
}

describe('Reports Tool', () => {
  it('retrieves consolidated reports from existing domain services and maps output contract', async () => {
    const useCase = createReportsToolUseCase({
      getSettings: async () => createDefaultSettings(),
      listCutoffReports: async () => [
        createCutoffReport({ id: 8, periodStart: '2026-07-01', periodEnd: '2026-07-31' }),
      ],
      listEarningPeriods: async () => [
        createEarningPeriod({ id: 44, name: 'Temporada Alfa', status: 'active' }),
      ],
      getSeasonStatistics: async () => ({
        grossIncome: 2200,
        realGain: 980,
        expenses: 600,
        adjustments: 40,
        netGain: 420,
        serviceCount: 8,
        appointmentCount: 8,
        completedAppointmentCount: 7,
        servicesByDay: [],
        expensesByCategory: [],
      }),
    })

    const result = await useCase.execute({
      requestId: 'financial:reports:001',
      requestedAt: '2026-07-24T10:00:00.000Z',
      format: 'json',
      filters: {
        currencyCode: 'EUR',
      },
    })

    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('expected success result')
    }

    const output: ReportsToolOutput = result.output
    const summary: ReportsSummary = output.summary

    expect(output.reportId).toContain('financial-report:custom:')
    expect(output.format).toBe('json')
    expect(summary.currencyCode).toBe('EUR')
    expect(summary.sectionCount).toBe(2)
    expect(summary.rowCount).toBe(2)
    expect(output.sections.map((section) => section.sectionId)).toEqual(['cutoff-reports', 'season-statistics'])
  })

  it('returns a valid empty report when there are no source reports', async () => {
    const useCase = createReportsToolUseCase({
      getSettings: async () => createDefaultSettings(),
      listCutoffReports: async () => [],
      listEarningPeriods: async () => [],
      getSeasonStatistics: async () => ({
        grossIncome: 0,
        realGain: 0,
        expenses: 0,
        adjustments: 0,
        netGain: 0,
        serviceCount: 0,
        appointmentCount: 0,
        completedAppointmentCount: 0,
        servicesByDay: [],
        expensesByCategory: [],
      }),
    })

    const result = await useCase.execute({
      requestId: 'financial:reports:002',
      requestedAt: '2026-07-24T10:00:00.000Z',
      format: 'json',
      filters: {
        kind: 'goals',
      },
    })

    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('expected success result')
    }

    expect(result.output.summary.sectionCount).toBe(1)
    expect(result.output.summary.rowCount).toBe(0)
    expect(result.output.sections).toHaveLength(1)
    expect(result.output.sections[0]?.rows).toEqual([])
  })

  it('maps domain read errors to controlled tool execution failures', async () => {
    const tool = createReportsAITool({
      getSettings: async () => createDefaultSettings(),
      listCutoffReports: async () => {
        throw new Error('reports source unavailable')
      },
      listEarningPeriods: async () => [],
      getSeasonStatistics: async () => ({
        grossIncome: 0,
        realGain: 0,
        expenses: 0,
        adjustments: 0,
        netGain: 0,
        serviceCount: 0,
        appointmentCount: 0,
        completedAppointmentCount: 0,
        servicesByDay: [],
        expensesByCategory: [],
      }),
    })

    const result = await tool.execute({
      arguments: {
        format: 'json',
      },
      context: createContext(),
    })

    expect(result.kind).toBe('failure')
    if (result.kind !== 'failure') {
      throw new Error('expected failure result')
    }

    expect(result.code).toBe('TOOL_EXECUTION_FAILED')
    expect(result.safeMessage).toContain('reports source unavailable')
  })

  it('is read-only and calls only read dependencies', async () => {
    const getSettingsSpy = vi.fn(async () => createDefaultSettings())
    const listCutoffReportsSpy = vi.fn(async () => [createCutoffReport({ id: 99 })])
    const listEarningPeriodsSpy = vi.fn(async () => [createEarningPeriod({ id: 88 })])
    const getSeasonStatisticsSpy = vi.fn(async () => ({
      grossIncome: 1000,
      realGain: 400,
      expenses: 300,
      adjustments: 20,
      netGain: 120,
      serviceCount: 3,
      appointmentCount: 4,
      completedAppointmentCount: 3,
      servicesByDay: [],
      expensesByCategory: [],
    }))

    const tool = createReportsAITool({
      getSettings: getSettingsSpy,
      listCutoffReports: listCutoffReportsSpy,
      listEarningPeriods: listEarningPeriodsSpy,
      getSeasonStatistics: getSeasonStatisticsSpy,
    })

    const result = await tool.execute({
      arguments: { format: 'json' },
      context: createContext(),
    })

    expect(result.kind).toBe('success')
    expect(getSettingsSpy).toHaveBeenCalledTimes(1)
    expect(listCutoffReportsSpy).toHaveBeenCalledTimes(1)
    expect(listEarningPeriodsSpy).toHaveBeenCalledTimes(1)
    expect(getSeasonStatisticsSpy).toHaveBeenCalledTimes(1)
  })
})
