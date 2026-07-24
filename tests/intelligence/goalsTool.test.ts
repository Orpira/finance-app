import { describe, expect, it, vi } from 'vitest'

import { createDefaultSettings } from '../../src/database/db'
import {
  createGoalsAITool,
  createGoalsToolUseCase,
  type GoalsSummary,
  type GoalsToolOutput,
} from '../../src/intelligence/ai-tools/financial'
import type { EarningPeriod } from '../../src/types/earningPeriod'

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
    executionId: 'exec:goals:001',
    conversationId: 'conversation:goals:001',
    sessionId: 'session:goals:001',
    providerId: 'OPENAI',
    model: 'gpt-4.1-mini',
    requestedAt: '2026-07-24T10:00:00.000Z',
    caller: 'PIPELINE' as const,
  }
}

describe('Goals Tool', () => {
  it('retrieves goals from earning periods and maps output to public contract', async () => {
    const useCase = createGoalsToolUseCase({
      getSettings: async () => createDefaultSettings(),
      listEarningPeriods: async () => [
        createEarningPeriod({ id: 10, name: 'Temporada Alfa', status: 'active' }),
        createEarningPeriod({ id: 11, name: 'Temporada Beta', status: 'closed', startDate: '2026-06-01T00:00:00.000Z', endDate: '2026-06-30T23:59:59.999Z' }),
      ],
      getSeasonStatistics: async (periodId) => {
        if (periodId === 10) {
          return {
            grossIncome: 2000,
            realGain: 900,
            expenses: 400,
            adjustments: 0,
            netGain: 500,
            serviceCount: 8,
            appointmentCount: 8,
            completedAppointmentCount: 7,
            servicesByDay: [],
            expensesByCategory: [],
          }
        }

        return {
          grossIncome: 1500,
          realGain: 750,
          expenses: 300,
          adjustments: 0,
          netGain: 450,
          serviceCount: 6,
          appointmentCount: 6,
          completedAppointmentCount: 6,
          servicesByDay: [],
          expensesByCategory: [],
        }
      },
    })

    const result = await useCase.execute({
      requestId: 'financial:goals:001',
      requestedAt: '2026-07-24T10:00:00.000Z',
      filters: {
        currencyCode: 'EUR',
        statuses: ['active', 'achieved'],
        tags: ['earning-period-goal'],
      },
    })

    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('expected success result')
    }

    const output: GoalsToolOutput = result.output
    const summary: GoalsSummary = output.summary

    expect(summary.currencyCode).toBe('EUR')
    expect(summary.goalCount).toBe(2)
    expect(summary.activeCount).toBe(1)
    expect(summary.achievedCount).toBe(1)
    expect(summary.totalTargetAmount).toBe(3500)
    expect(summary.totalAchievedAmount).toBe(1650)
    expect(summary.averageProgressPercentage).toBeGreaterThan(0)

    expect(output.items).toHaveLength(2)
    expect(output.items[0]?.goalId).toContain('earning-period:')
    expect(output.items[0]?.priority).toBe('medium')
  })

  it('returns an empty output when there are no periods', async () => {
    const useCase = createGoalsToolUseCase({
      getSettings: async () => createDefaultSettings(),
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
      requestId: 'financial:goals:002',
      requestedAt: '2026-07-24T10:00:00.000Z',
    })

    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('expected success result')
    }

    expect(result.output.summary).toEqual({
      currencyCode: 'EUR',
      goalCount: 0,
      activeCount: 0,
      achievedCount: 0,
      totalTargetAmount: 0,
      totalAchievedAmount: 0,
      averageProgressPercentage: 0,
    })
    expect(result.output.items).toEqual([])
  })

  it('maps domain read errors to controlled tool failures', async () => {
    const tool = createGoalsAITool({
      getSettings: async () => createDefaultSettings(),
      listEarningPeriods: async () => {
        throw new Error('goals source unavailable')
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
    expect(result.safeMessage).toContain('goals source unavailable')
  })

  it('is read-only and only calls domain read dependencies', async () => {
    const getSettingsSpy = vi.fn(async () => createDefaultSettings())
    const listEarningPeriodsSpy = vi.fn(async () => [createEarningPeriod({ id: 44 })])
    const getSeasonStatisticsSpy = vi.fn(async () => ({
      grossIncome: 1000,
      realGain: 450,
      expenses: 250,
      adjustments: 0,
      netGain: 200,
      serviceCount: 4,
      appointmentCount: 4,
      completedAppointmentCount: 4,
      servicesByDay: [],
      expensesByCategory: [],
    }))

    const tool = createGoalsAITool({
      getSettings: getSettingsSpy,
      listEarningPeriods: listEarningPeriodsSpy,
      getSeasonStatistics: getSeasonStatisticsSpy,
    })

    const result = await tool.execute({
      arguments: {},
      context: createContext(),
    })

    expect(result.kind).toBe('success')
    expect(getSettingsSpy).toHaveBeenCalledTimes(1)
    expect(listEarningPeriodsSpy).toHaveBeenCalledTimes(1)
    expect(getSeasonStatisticsSpy).toHaveBeenCalledTimes(1)
  })
})
