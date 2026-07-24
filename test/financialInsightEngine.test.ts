import { describe, expect, it, vi } from 'vitest'

import type {
  FinancialReportOutput,
} from '../src/intelligence/ai-tools/financial/reportsContracts'
import type {
  ActivationDecision,
} from '../src/intelligence/ai-conversation/provider-orchestration/activationContracts'
import type {
  FinancialConversationExecutionPlan,
} from '../src/intelligence/ai-conversation/provider-orchestration/financialConversationExecutionPlan'
import {
  createFinancialInsightEngine,
  createFinancialInsightRegistryInstance,
} from '../src/intelligence/ai-conversation/provider-orchestration/financialInsightFactory'
import {
  createFinancialInsightPrioritizer,
} from '../src/intelligence/ai-conversation/provider-orchestration/financialInsightPrioritizer'
import {
  createFinancialInsightRegistry,
} from '../src/intelligence/ai-conversation/provider-orchestration/financialInsightRegistry'
import {
  validateFinancialInsight,
  validateFinancialInsightEvaluator,
  validateFinancialInsightPrioritizer,
  validateFinancialInsightRegistry,
} from '../src/intelligence/ai-conversation/provider-orchestration/financialInsightValidator'
import type {
  FinancialInsight,
  FinancialInsightEvaluationInput,
  FinancialInsightEvaluator,
} from '../src/intelligence/ai-conversation/provider-orchestration/financialInsightContracts'
import {
  createBudgetOverspendingEvaluator,
} from '../src/intelligence/ai-conversation/provider-orchestration/insights/budgetOverspendingEvaluator'
import {
  createSavingsGoalRiskEvaluator,
} from '../src/intelligence/ai-conversation/provider-orchestration/insights/savingsGoalRiskEvaluator'
import {
  createExpenseTrendEvaluator,
} from '../src/intelligence/ai-conversation/provider-orchestration/insights/expenseTrendEvaluator'
import {
  createIncomeStabilityEvaluator,
} from '../src/intelligence/ai-conversation/provider-orchestration/insights/incomeStabilityEvaluator'
import {
  createSubscriptionOpportunityEvaluator,
} from '../src/intelligence/ai-conversation/provider-orchestration/insights/subscriptionOpportunityEvaluator'
import {
  createFinancialHealthEvaluator,
} from '../src/intelligence/ai-conversation/provider-orchestration/insights/financialHealthEvaluator'

function createDecision(): ActivationDecision {
  return {
    protocolVersion: 1,
    activationType: 'TOOL_WITH_AI',
    provider: 'openai-provider',
    toolId: 'financial_insights',
    confidence: 0.91,
    requiresAI: true,
    requiresTool: true,
    requiresExplanation: true,
    fallback: { used: false },
    reason: 'fixture decision',
    intent: 'insights',
  }
}

function createPlan(): FinancialConversationExecutionPlan {
  return {
    skillId: 'insights-conversation-skill',
    activationDecision: createDecision(),
    requiredTools: [],
    requiresAIExplanation: true,
    expectedOutput: 'INSIGHTS_EXPLANATION',
    executionPriority: 'LOW',
    context: {
      activePeriod: { from: '2026-06-01', to: '2026-06-30' },
      activeCategory: 'budget',
      activeAccount: 'account-1',
      activeGoal: 'goal-1',
      referencedEntities: [{ entityType: 'goal', entityId: 'goal-1' }],
    },
  }
}

function createReport(input: {
  readonly currentGrossIncome: number
  readonly currentTotalExpenses: number
  readonly currentNetGain: number
  readonly previousGrossIncome: number
  readonly previousTotalExpenses: number
  readonly previousRealGain: number
  readonly historicalExpenseCount?: number
}): FinancialReportOutput {
  return {
    reportId: 'report:insights:test',
    generatedAt: '2026-07-24T12:00:00.000Z',
    format: 'json',
    summary: {
      currencyCode: 'USD',
      sectionCount: 4,
      rowCount: 4,
      reportTitle: 'Financial insights report',
    },
    sections: [
      {
        sectionId: 'current-season-insights',
        title: 'Current Season Insights',
        rows: [
          {
            grossIncome: input.currentGrossIncome,
            totalExpenses: input.currentTotalExpenses,
            netGain: input.currentNetGain,
          },
        ],
      },
      {
        sectionId: 'previous-season-insights',
        title: 'Previous Season Insights',
        rows: [
          {
            grossIncome: input.previousGrossIncome,
            totalExpenses: input.previousTotalExpenses,
            netGain: input.previousRealGain,
            realGain: input.previousRealGain,
          },
        ],
      },
      {
        sectionId: 'season-comparison',
        title: 'Season Comparison',
        rows: [],
      },
      {
        sectionId: 'historical-cutoff-insights',
        title: 'Historical Cutoff Insights',
        rows: [
          {
            expenseCount: input.historicalExpenseCount ?? 4,
            expenseTotal: 100,
          },
          {
            expenseCount: input.historicalExpenseCount ?? 4,
            expenseTotal: 102,
          },
        ],
      },
    ],
  }
}

function createInput(report: FinancialReportOutput | null): FinancialInsightEvaluationInput {
  return {
    sessionId: 'session:insights:test',
    userMessage: 'Analiza mi salud financiera',
    requestedAt: '2026-07-24T12:00:00.000Z',
    plan: createPlan(),
    snapshot: {
      protocolVersion: 1,
      sessionId: 'session:insights:test',
      lastIntent: 'insights',
      lastSkill: 'insights-conversation-skill',
      lastTool: 'financial_insights',
      lastPeriod: { from: '2026-06-01', to: '2026-06-30' },
      lastCategory: 'budget',
      lastAccount: 'account-1',
      lastGoal: 'goal-1',
      referencedEntities: [{ entityType: 'goal', entityId: 'goal-1' }],
      conversationTimestamp: '2026-07-24T12:00:00.000Z',
    },
    report,
  }
}

function createInsight(input: Partial<FinancialInsight>): FinancialInsight {
  return {
    protocolVersion: 1,
    insightId: 'insight:test',
    category: 'health',
    severity: 'INFO',
    priority: 'INFO',
    title: 'Insight test',
    description: 'Insight test',
    recommendation: 'Recomendacion test',
    sourceTool: 'financial_insights',
    generatedAt: '2026-07-24T12:00:00.000Z',
    ...input,
  }
}

describe('PB-IS-015.3 Proactive Financial Insights Engine', () => {
  it('registry certificada contiene seis evaluadores', () => {
    const registry = createFinancialInsightRegistryInstance()
    expect(registry.list()).toHaveLength(6)
    expect(validateFinancialInsightRegistry(registry)).toBeNull()
  })

  it('validator y contracts fail-closed', () => {
    expect(validateFinancialInsight(createInsight({}))).toBeNull()
    expect(validateFinancialInsight({} as never)).not.toBeNull()

    const evaluator: FinancialInsightEvaluator = {
      evaluatorId: 'evaluator:test',
      supports: () => true,
      async evaluate() {
        return []
      },
    }
    expect(validateFinancialInsightEvaluator(evaluator)).toBeNull()
    expect(validateFinancialInsightEvaluator({} as never)).not.toBeNull()

    expect(validateFinancialInsightPrioritizer({ prioritize: (insights) => insights })).toBeNull()
    expect(validateFinancialInsightPrioritizer({} as never)).not.toBeNull()

    const customRegistry = createFinancialInsightRegistry([evaluator])
    expect(validateFinancialInsightRegistry(customRegistry)).toBeNull()
  })

  it('prioritizer elimina duplicados y respeta severidad y límite', () => {
    const prioritizer = createFinancialInsightPrioritizer({ maxInsights: 2 })
    const duplicate = createInsight({ insightId: 'duplicate', title: 'Duplicado', recommendation: 'Duplicado' })

    const prioritized = prioritizer.prioritize([
      createInsight({ insightId: 'low', severity: 'LOW', priority: 'LOW', title: 'B', recommendation: 'B' }),
      createInsight({ insightId: 'critical', severity: 'CRITICAL', priority: 'CRITICAL', title: 'A', recommendation: 'A' }),
      duplicate,
      { ...duplicate, insightId: 'duplicate-2' },
    ])

    expect(prioritized).toHaveLength(2)
    expect(prioritized[0]?.severity).toBe('CRITICAL')
    expect(prioritized[1]?.severity).toBe('LOW')
  })

  it('cada evaluador analiza un unico escenario', async () => {
    const input = createInput(createReport({
      currentGrossIncome: 100,
      currentTotalExpenses: 160,
      currentNetGain: -60,
      previousGrossIncome: 200,
      previousTotalExpenses: 120,
      previousRealGain: 80,
    }))

    const evaluators = [
      createBudgetOverspendingEvaluator(),
      createSavingsGoalRiskEvaluator(),
      createExpenseTrendEvaluator(),
      createIncomeStabilityEvaluator(),
      createSubscriptionOpportunityEvaluator(),
      createFinancialHealthEvaluator(),
    ]

    for (const evaluator of evaluators) {
      expect(evaluator.supports(input)).toBe(true)
      const evaluated = await evaluator.evaluate(input)
      expect(Array.isArray(evaluated)).toBe(true)
    }
  })

  it('detecta budget overspending, risk de meta, tendencia de gasto e ingresos inestables', async () => {
    const input = createInput(createReport({
      currentGrossIncome: 100,
      currentTotalExpenses: 160,
      currentNetGain: -60,
      previousGrossIncome: 200,
      previousTotalExpenses: 120,
      previousRealGain: 80,
    }))

    await expect(createBudgetOverspendingEvaluator().evaluate(input)).resolves.toHaveLength(1)
    await expect(createSavingsGoalRiskEvaluator().evaluate(input)).resolves.toHaveLength(1)
    await expect(createExpenseTrendEvaluator().evaluate(input)).resolves.toHaveLength(1)
    await expect(createIncomeStabilityEvaluator().evaluate(input)).resolves.toHaveLength(1)
  })

  it('detecta oportunidad de suscripciones y health general', async () => {
    const input = createInput(createReport({
      currentGrossIncome: 1000,
      currentTotalExpenses: 300,
      currentNetGain: 700,
      previousGrossIncome: 1000,
      previousTotalExpenses: 290,
      previousRealGain: 710,
      historicalExpenseCount: 4,
    }))

    await expect(createSubscriptionOpportunityEvaluator().evaluate(input)).resolves.toHaveLength(1)
    await expect(createFinancialHealthEvaluator().evaluate(input)).resolves.toHaveLength(1)
  })

  it('engine evalua, prioriza y usa el reporte financiero existente', async () => {
    const useCase = {
      execute: vi.fn(async () => ({
        kind: 'success' as const,
        output: createReport({
          currentGrossIncome: 100,
          currentTotalExpenses: 160,
          currentNetGain: -60,
          previousGrossIncome: 200,
          previousTotalExpenses: 120,
          previousRealGain: 80,
        }),
      })),
    }

    const engine = createFinancialInsightEngine({
      financialInsightsToolUseCase: useCase,
      metrics: {
        record: vi.fn(),
      },
    })

    const insights = await engine.evaluate(createInput(null))
    expect(useCase.execute).toHaveBeenCalledTimes(1)
    expect(insights.length).toBeGreaterThan(0)
    expect(insights[0]?.severity).toBe('CRITICAL')
  })

  it('factory expone registry y engine listos para componer', () => {
    const registry = createFinancialInsightRegistryInstance()
    expect(registry.findById('budget-overspending-evaluator')).not.toBeNull()
    expect(() => createFinancialInsightEngine()).not.toThrow()
  })
})