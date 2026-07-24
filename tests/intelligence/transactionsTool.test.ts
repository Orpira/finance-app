import { describe, expect, it } from 'vitest'

import { createDefaultSettings } from '../../src/database/db'
import {
  createTransactionsAITool,
  createTransactionsToolUseCase,
  type TransactionsSummary,
  type TransactionsToolOutput,
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
    executionId: 'exec:transactions:001',
    conversationId: 'conversation:transactions:001',
    sessionId: 'session:transactions:001',
    providerId: 'OPENAI',
    model: 'gpt-4.1-mini',
    requestedAt: '2026-07-24T10:00:00.000Z',
    caller: 'PIPELINE' as const,
  }
}

describe('Transactions Tool', () => {
  it('retrieves and transforms domain transactions into contract output', async () => {
    const useCase = createTransactionsToolUseCase({
      getSettings: async () => createDefaultSettings(),
      listServiceIncomes: async () => [
        createIncome({ id: 1, eurValue: 200, notes: 'Ingreso principal' }),
        createIncome({ id: 2, type: 'ajuste', eurValue: -20, notes: 'Ajuste ingreso' }),
      ],
      listExpenses: async () => [
        createExpense({ id: 10, eurValue: 70, category: 'Operativo' }),
      ],
    })

    const result = await useCase.execute({
      requestId: 'financial:transactions:001',
      requestedAt: '2026-07-24T10:00:00.000Z',
      filters: {
        currencyCode: 'EUR',
      },
      sort: {
        field: 'amount',
        direction: 'desc',
      },
    })

    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('expected success result')
    }

    const output: TransactionsToolOutput = result.output
    const summary: TransactionsSummary = output.summary

    expect(summary.currencyCode).toBe('EUR')
    expect(summary.matchedCount).toBe(3)
    expect(summary.incomeTotal).toBe(200)
    expect(summary.expenseTotal).toBe(90)
    expect(summary.netTotal).toBe(110)
    expect(output.items[0]?.amount).toBe(200)
    expect(output.items.map((item) => item.kind)).toContain('adjustment')
    expect(output.items).toHaveLength(3)
  })

  it('returns empty list and zeroed summary when there is no data', async () => {
    const useCase = createTransactionsToolUseCase({
      getSettings: async () => createDefaultSettings(),
      listServiceIncomes: async () => [],
      listExpenses: async () => [],
    })

    const result = await useCase.execute({
      requestId: 'financial:transactions:002',
      requestedAt: '2026-07-24T10:00:00.000Z',
    })

    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('expected success result')
    }

    expect(result.output.summary).toEqual({
      currencyCode: 'EUR',
      matchedCount: 0,
      incomeTotal: 0,
      expenseTotal: 0,
      netTotal: 0,
    })
    expect(result.output.items).toEqual([])
  })

  it('maps read failures to controlled tool execution failures', async () => {
    const tool = createTransactionsAITool({
      getSettings: async () => createDefaultSettings(),
      listServiceIncomes: async () => {
        throw new Error('transactions source unavailable')
      },
      listExpenses: async () => [],
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
    expect(result.safeMessage).toContain('transactions source unavailable')
  })

  it('rejects invalid arguments in fail-closed mode', async () => {
    const tool = createTransactionsAITool()

    const result = await tool.execute({
      arguments: {
        requestId: 123,
      },
      context: createContext(),
    })

    expect(result.kind).toBe('failure')
    if (result.kind !== 'failure') {
      throw new Error('expected failure result')
    }

    expect(result.code).toBe('INVALID_ARGUMENTS')
  })
})
