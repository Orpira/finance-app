import { describe, expect, it, vi } from 'vitest'

import { createDefaultSettings } from '../../src/database/db'
import {
  createBudgetAITool,
  createBudgetToolUseCase,
  type BudgetSummary,
  type BudgetToolOutput,
} from '../../src/intelligence/ai-tools/financial'
import type { CutoffReport } from '../../src/types/cutoffReport'

function createCutoffReport(partial: Partial<CutoffReport>): CutoffReport {
  return {
    id: 1,
    frequency: 'monthly',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    generatedAt: '2026-08-01T00:00:00.000Z',
    currency: 'EUR',
    incomeTotal: 1500,
    expenseTotal: 500,
    netTotal: 1000,
    incomeCount: 4,
    expenseCount: 2,
    serviceMinutes: 320,
    paymentTypeTotals: { Transferencia: 1000, Efectivo: 500 },
    expenseCategoryTotals: { Operativo: 300, Marketing: 200 },
    ...partial,
  }
}

function createContext() {
  return {
    executionId: 'exec:budget:001',
    conversationId: 'conversation:budget:001',
    sessionId: 'session:budget:001',
    providerId: 'OPENAI',
    model: 'gpt-4.1-mini',
    requestedAt: '2026-07-24T10:00:00.000Z',
    caller: 'PIPELINE' as const,
  }
}

describe('Budget Tool', () => {
  it('retrieves budget data from existing cutoff reports and maps it to contract output', async () => {
    const useCase = createBudgetToolUseCase({
      getSettings: async () => createDefaultSettings(),
      listCutoffReports: async () => [
        createCutoffReport({ id: 5, periodStart: '2026-06-01', periodEnd: '2026-06-30', incomeTotal: 1200, expenseTotal: 700, netTotal: 500 }),
        createCutoffReport({ id: 6, periodStart: '2026-07-01', periodEnd: '2026-07-31', incomeTotal: 1500, expenseTotal: 500, netTotal: 1000 }),
      ],
    })

    const result = await useCase.execute({
      requestId: 'financial:budget:001',
      requestedAt: '2026-07-24T10:00:00.000Z',
      filters: {
        currencyCode: 'EUR',
        statuses: ['closed'],
        tags: ['cutoff-report'],
      },
    })

    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('expected success result')
    }

    const output: BudgetToolOutput = result.output
    const summary: BudgetSummary = output.summary

    expect(summary.currencyCode).toBe('EUR')
    expect(summary.budgetCount).toBe(2)
    expect(summary.plannedTotal).toBe(2700)
    expect(summary.spentTotal).toBe(1200)
    expect(summary.remainingTotal).toBe(1500)
    expect(output.items).toHaveLength(2)
    expect(output.items[0]?.status).toBe('closed')
    expect(output.items[0]?.budgetId).toContain('cutoff:')
  })

  it('returns an empty output when no reports are available', async () => {
    const useCase = createBudgetToolUseCase({
      getSettings: async () => createDefaultSettings(),
      listCutoffReports: async () => [],
    })

    const result = await useCase.execute({
      requestId: 'financial:budget:002',
      requestedAt: '2026-07-24T10:00:00.000Z',
    })

    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('expected success result')
    }

    expect(result.output.summary).toEqual({
      currencyCode: 'EUR',
      budgetCount: 0,
      plannedTotal: 0,
      spentTotal: 0,
      remainingTotal: 0,
    })
    expect(result.output.items).toEqual([])
  })

  it('maps read failures to controlled tool execution failures', async () => {
    const tool = createBudgetAITool({
      getSettings: async () => createDefaultSettings(),
      listCutoffReports: async () => {
        throw new Error('budget source unavailable')
      },
    })

    const result = await tool.execute({
      arguments: {
        filters: {
          currencyCode: 'EUR',
        },
      },
      context: createContext(),
    })

    expect(result.kind).toBe('failure')
    if (result.kind !== 'failure') {
      throw new Error('expected failure result')
    }

    expect(result.code).toBe('TOOL_EXECUTION_FAILED')
    expect(result.safeMessage).toContain('budget source unavailable')
  })

  it('is read-only and does not trigger write flows', async () => {
    const getSettingsSpy = vi.fn(async () => createDefaultSettings())
    const listCutoffReportsSpy = vi.fn(async () => [createCutoffReport({ id: 99 })])

    const tool = createBudgetAITool({
      getSettings: getSettingsSpy,
      listCutoffReports: listCutoffReportsSpy,
    })

    const result = await tool.execute({
      arguments: {},
      context: createContext(),
    })

    expect(result.kind).toBe('success')
    expect(getSettingsSpy).toHaveBeenCalledTimes(1)
    expect(listCutoffReportsSpy).toHaveBeenCalledTimes(1)
  })
})
