import { describe, expect, it, vi } from 'vitest'

import { createDefaultSettings } from '../../src/database/db'
import {
  createFinancialInsightsAITool,
  createFinancialInsightsToolUseCase,
  type FinancialInsightsToolOutput,
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
    incomeTotal: 1800,
    expenseTotal: 900,
    netTotal: 900,
    incomeCount: 6,
    expenseCount: 4,
    serviceMinutes: 510,
    paymentTypeTotals: { Transferencia: 1300, Efectivo: 500 },
    expenseCategoryTotals: { Operativo: 500, Marketing: 400 },
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
    executionId: 'exec:insights:001',
    conversationId: 'conversation:insights:001',
    sessionId: 'session:insights:001',
    providerId: 'OPENAI',
    model: 'gpt-4.1-mini',
    requestedAt: '2026-07-24T10:00:00.000Z',
    caller: 'PIPELINE' as const,
  }
}

describe('Financial Insights Tool', () => {
  it('reads existing indicators and maps them to structured insights output', async () => {
    const useCase = createFinancialInsightsToolUseCase({
      getSettings: async () => createDefaultSettings(),
      getActiveEarningPeriod: async () => createEarningPeriod({ id: 10, name: 'Temporada Actual', status: 'active' }),
      listClosedEarningPeriods: async () => [
        createEarningPeriod({ id: 9, name: 'Temporada Anterior', status: 'closed', startDate: '2026-06-01T00:00:00.000Z', endDate: '2026-06-30T23:59:59.999Z' }),
      ],
      getSeasonStatistics: async (periodId) => {
        if (periodId === 10) {
          return {
            grossIncome: 2500,
            realGain: 1100,
            expenses: 900,
            adjustments: 100,
            netGain: 200,
            bestDay: { date: '2026-07-19', amount: 320 },
            serviceCount: 9,
            appointmentCount: 10,
            completedAppointmentCount: 8,
            servicesByDay: [],
            expensesByCategory: [],
          }
        }

        return {
          grossIncome: 2000,
          realGain: 900,
          expenses: 700,
          adjustments: 60,
          netGain: 200,
          bestDay: { date: '2026-06-22', amount: 280 },
          serviceCount: 8,
          appointmentCount: 8,
          completedAppointmentCount: 8,
          servicesByDay: [],
          expensesByCategory: [],
        }
      },
      listCutoffReports: async () => [
        createCutoffReport({ id: 40, periodStart: '2026-07-01', periodEnd: '2026-07-31' }),
      ],
    })

    const result = await useCase.execute({
      requestId: 'financial:insights:001',
      requestedAt: '2026-07-24T10:00:00.000Z',
      format: 'json',
    })

    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('expected success result')
    }

    const output: FinancialInsightsToolOutput = result.output
    expect(output.reportId).toContain('financial-insights:')
    expect(output.format).toBe('json')
    expect(output.summary.sectionCount).toBe(4)
    expect(output.summary.rowCount).toBe(4)
    expect(output.sections.map((section) => section.sectionId)).toEqual([
      'current-season-insights',
      'previous-season-insights',
      'season-comparison',
      'historical-cutoff-insights',
    ])
  })

  it('returns valid empty sections when statistics are not available', async () => {
    const useCase = createFinancialInsightsToolUseCase({
      getSettings: async () => createDefaultSettings(),
      getActiveEarningPeriod: async () => undefined,
      listClosedEarningPeriods: async () => [],
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
      listCutoffReports: async () => [],
    })

    const result = await useCase.execute({
      requestId: 'financial:insights:002',
      requestedAt: '2026-07-24T10:00:00.000Z',
      format: 'json',
    })

    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('expected success result')
    }

    expect(result.output.summary.rowCount).toBe(0)
    expect(result.output.sections).toHaveLength(4)
    expect(result.output.sections.every((section) => section.rows.length === 0)).toBe(true)
  })

  it('supports season comparison section with existing domain indicators', async () => {
    const useCase = createFinancialInsightsToolUseCase({
      getSettings: async () => createDefaultSettings(),
      getActiveEarningPeriod: async () => createEarningPeriod({ id: 5, name: 'Temporada A' }),
      listClosedEarningPeriods: async () => [
        createEarningPeriod({ id: 4, name: 'Temporada B', status: 'closed' }),
      ],
      getSeasonStatistics: async (periodId) => ({
        grossIncome: periodId === 5 ? 1400 : 1200,
        realGain: periodId === 5 ? 700 : 600,
        expenses: 300,
        adjustments: 10,
        netGain: 390,
        serviceCount: periodId === 5 ? 7 : 6,
        appointmentCount: 7,
        completedAppointmentCount: 6,
        servicesByDay: [],
        expensesByCategory: [],
      }),
      listCutoffReports: async () => [],
    })

    const result = await useCase.execute({
      requestId: 'financial:insights:003',
      requestedAt: '2026-07-24T10:00:00.000Z',
      format: 'json',
      filters: {
        sections: ['season-comparison'],
      },
    })

    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('expected success result')
    }

    expect(result.output.sections).toHaveLength(1)
    expect(result.output.sections[0]?.sectionId).toBe('season-comparison')
    expect(result.output.sections[0]?.rows).toHaveLength(1)
  })

  it('maps domain failures into controlled tool execution failures', async () => {
    const tool = createFinancialInsightsAITool({
      getSettings: async () => createDefaultSettings(),
      getActiveEarningPeriod: async () => undefined,
      listClosedEarningPeriods: async () => {
        throw new Error('insights source unavailable')
      },
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
      listCutoffReports: async () => [],
    })

    const result = await tool.execute({
      arguments: { format: 'json' },
      context: createContext(),
    })

    expect(result.kind).toBe('failure')
    if (result.kind !== 'failure') {
      throw new Error('expected failure result')
    }

    expect(result.code).toBe('TOOL_EXECUTION_FAILED')
    expect(result.safeMessage).toContain('insights source unavailable')
  })

  it('is read-only and uses only domain read dependencies', async () => {
    const getSettingsSpy = vi.fn(async () => createDefaultSettings())
    const getActiveEarningPeriodSpy = vi.fn(async () => createEarningPeriod({ id: 66 }))
    const listClosedEarningPeriodsSpy = vi.fn(async () => [createEarningPeriod({ id: 65, status: 'closed' })])
    const getSeasonStatisticsSpy = vi.fn(async () => ({
      grossIncome: 1000,
      realGain: 500,
      expenses: 300,
      adjustments: 20,
      netGain: 180,
      serviceCount: 4,
      appointmentCount: 4,
      completedAppointmentCount: 4,
      servicesByDay: [],
      expensesByCategory: [],
    }))
    const listCutoffReportsSpy = vi.fn(async () => [createCutoffReport({ id: 99 })])

    const tool = createFinancialInsightsAITool({
      getSettings: getSettingsSpy,
      getActiveEarningPeriod: getActiveEarningPeriodSpy,
      listClosedEarningPeriods: listClosedEarningPeriodsSpy,
      getSeasonStatistics: getSeasonStatisticsSpy,
      listCutoffReports: listCutoffReportsSpy,
    })

    const result = await tool.execute({
      arguments: { format: 'json' },
      context: createContext(),
    })

    expect(result.kind).toBe('success')
    expect(getSettingsSpy).toHaveBeenCalledTimes(1)
    expect(getActiveEarningPeriodSpy).toHaveBeenCalledTimes(1)
    expect(listClosedEarningPeriodsSpy).toHaveBeenCalledTimes(1)
    expect(getSeasonStatisticsSpy).toHaveBeenCalledTimes(2)
    expect(listCutoffReportsSpy).toHaveBeenCalledTimes(1)
  })
})
