import { describe, expect, it } from 'vitest'

import { createDefaultSettings } from '../../src/database/db'
import {
  createBalanceAITool,
  createBalanceToolUseCase,
  type BalanceSummary,
  type BalanceToolOutput,
} from '../../src/intelligence/ai-tools/financial'
import type { Expense } from '../../src/types/expense'
import type { ServiceIncome } from '../../src/types/service'

function createIncome(partial: Partial<ServiceIncome>): ServiceIncome {
  return {
    date: '2026-07-24',
    duration: 60,
    totalAmount: 0,
    currency: 'EUR',
    percentage: 0,
    realGain: 0,
    eurValue: 0,
    copValue: 0,
    exchangeRateUsed: 1,
    usageMode: 'professional',
    type: 'ingreso',
    ...partial,
  }
}

function createExpense(partial: Partial<Expense>): Expense {
  return {
    type: 'gasto',
    date: '2026-07-24',
    category: 'General',
    amount: 0,
    currency: 'EUR',
    eurValue: 0,
    copValue: 0,
    createdAt: '2026-07-24T10:00:00.000Z',
    usageMode: 'professional',
    ...partial,
  }
}

function createContext() {
  return {
    executionId: 'exec:balance:001',
    conversationId: 'conversation:balance:001',
    sessionId: 'session:balance:001',
    providerId: 'OPENAI',
    model: 'gpt-4.1-mini',
    requestedAt: '2026-07-24T10:00:00.000Z',
    caller: 'PIPELINE' as const,
  }
}

describe('Balance Tool', () => {
  it('builds a structured BalanceToolOutput from existing financial services', async () => {
    const useCase = createBalanceToolUseCase({
      getSettings: async () => createDefaultSettings(),
      listServiceIncomes: async () => [
        createIncome({ id: 1, eurValue: 200 }),
        createIncome({ id: 2, type: 'ajuste', eurValue: 30, notes: 'Ajuste ingreso' }),
      ],
      listExpenses: async () => [
        createExpense({ id: 10, eurValue: 70 }),
        createExpense({ id: 11, type: 'ajuste', eurValue: 5, notes: 'Ajuste egreso' }),
      ],
    })

    const result = await useCase.execute({
      requestId: 'financial:balance:001',
      requestedAt: '2026-07-24T10:00:00.000Z',
      filters: {
        currencyCode: 'EUR',
        usageMode: 'professional',
        includeAdjustments: true,
      },
    })

    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('expected success result')
    }

    const output: BalanceToolOutput = result.output
    const summary: BalanceSummary = output.summary

    expect(summary.currencyCode).toBe('EUR')
    expect(summary.incomeTotal).toBe(200)
    expect(summary.expenseTotal).toBe(70)
    expect(summary.adjustmentTotal).toBe(35)
    expect(summary.netBalance).toBe(165)
    expect(summary.hasData).toBe(true)
    expect(output.breakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'income' }),
        expect.objectContaining({ category: 'expense' }),
        expect.objectContaining({ category: 'adjustment' }),
      ]),
    )
  })

  it('returns an empty structured output when no financial data exists', async () => {
    const useCase = createBalanceToolUseCase({
      getSettings: async () => createDefaultSettings(),
      listServiceIncomes: async () => [],
      listExpenses: async () => [],
    })

    const result = await useCase.execute({
      requestId: 'financial:balance:002',
      requestedAt: '2026-07-24T10:00:00.000Z',
    })

    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('expected success result')
    }

    expect(result.output.summary).toEqual({
      currencyCode: 'EUR',
      incomeTotal: 0,
      expenseTotal: 0,
      adjustmentTotal: 0,
      netBalance: 0,
      hasData: false,
    })
    expect(result.output.breakdown).toEqual([])
  })

  it('surfaces controlled failures through the AITool wrapper', async () => {
    const tool = createBalanceAITool({
      getSettings: async () => createDefaultSettings(),
      listServiceIncomes: async () => {
        throw new Error('income store unavailable')
      },
      listExpenses: async () => [],
    })

    const result = await tool.execute({
      arguments: {
        filters: {
          currencyCode: 'EUR',
          usageMode: 'professional',
        },
      },
      context: createContext(),
    })

    expect(result.kind).toBe('failure')
    if (result.kind !== 'failure') {
      throw new Error('expected failure result')
    }

    expect(result.code).toBe('TOOL_EXECUTION_FAILED')
    expect(result.safeMessage).toContain('income store unavailable')
  })

  it('exposes a contract-safe tool definition', () => {
    const tool = createBalanceAITool()

    expect(tool.definition.name).toBe('financial_balance')
    expect(tool.definition.permission).toBe('read-only')
    expect(tool.definition.deterministic).toBe(true)
    expect(tool.definition.failClosed).toBe(true)
    expect(tool.definition.inputSchema.type).toBe('object')
    expect(tool.definition.outputSchema.type).toBe('object')
    expect(tool.definition.outputSchema.required).toEqual(['summary', 'breakdown'])
  })
})
