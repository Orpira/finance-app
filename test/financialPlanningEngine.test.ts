import { describe, expect, it } from 'vitest'

import type {
  ActivationDecision,
} from '../src/intelligence/ai-conversation/provider-orchestration/activationContracts'
import type {
  FinancialConversationExecutionPlan,
} from '../src/intelligence/ai-conversation/provider-orchestration/financialConversationExecutionPlan'
import type {
  FinancialInsight,
} from '../src/intelligence/ai-conversation/provider-orchestration/financialInsightContracts'
import {
  createFinancialPlanningEngine,
  createFinancialPlanningRegistry,
} from '../src/intelligence/ai-conversation/provider-orchestration/financialPlanningFactory'
import {
  createFinancialPlanningPrioritizer,
} from '../src/intelligence/ai-conversation/provider-orchestration/financialPlanningPrioritizer'
import {
  createFinancialPlanningRegistry as createRegistry,
} from '../src/intelligence/ai-conversation/provider-orchestration/financialPlanningRegistry'
import {
  validateFinancialActionPlan,
  validateFinancialPlanningPrioritizer,
  validateFinancialPlanningRegistry,
  validateFinancialPlanningStrategy,
} from '../src/intelligence/ai-conversation/provider-orchestration/financialPlanningValidator'
import {
  createBudgetOptimizationStrategy,
} from '../src/intelligence/ai-conversation/provider-orchestration/planning/budgetOptimizationStrategy'
import {
  createSavingsImprovementStrategy,
} from '../src/intelligence/ai-conversation/provider-orchestration/planning/savingsImprovementStrategy'
import {
  createGoalRecoveryStrategy,
} from '../src/intelligence/ai-conversation/provider-orchestration/planning/goalRecoveryStrategy'
import {
  createExpenseReductionStrategy,
} from '../src/intelligence/ai-conversation/provider-orchestration/planning/expenseReductionStrategy'
import {
  createCashFlowStabilizationStrategy,
} from '../src/intelligence/ai-conversation/provider-orchestration/planning/cashFlowStabilizationStrategy'
import {
  createFinancialHealthImprovementStrategy,
} from '../src/intelligence/ai-conversation/provider-orchestration/planning/financialHealthImprovementStrategy'

function createDecision(): ActivationDecision {
  return {
    protocolVersion: 1,
    activationType: 'TOOL_WITH_AI',
    provider: 'openai-provider',
    toolId: 'financial_insights',
    confidence: 0.92,
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
    requiredTools: ['financial_insights'],
    requiresAIExplanation: true,
    expectedOutput: 'INSIGHTS_EXPLANATION',
    executionPriority: 'NORMAL',
    context: {
      activePeriod: { from: '2026-07-01', to: '2026-07-31' },
      activeCategory: 'budget',
      activeAccount: 'account-1',
      activeGoal: 'goal-1',
      referencedEntities: [{ entityType: 'goal', entityId: 'goal-1' }],
    },
  }
}

function createInsight(input: Partial<FinancialInsight>): FinancialInsight {
  return {
    protocolVersion: 1,
    insightId: 'insight:test',
    category: 'health',
    severity: 'MEDIUM',
    priority: 'MEDIUM',
    title: 'Insight de prueba',
    description: 'Detalle de prueba',
    recommendation: 'Accion recomendada',
    sourceTool: 'financial_insights',
    generatedAt: '2026-07-25T00:00:00.000Z',
    ...input,
  }
}

function createEngineInput(insights: readonly FinancialInsight[]) {
  return {
    sessionId: 'session:planning:test',
    userMessage: 'Quiero un plan financiero inteligente',
    requestedAt: '2026-07-25T00:00:00.000Z',
    executionPlan: createPlan(),
    insights,
  }
}

describe('PB-IS-015.4 Intelligent Financial Planning Engine', () => {
  it('factory expone registry con seis estrategias certificadas', () => {
    const registry = createFinancialPlanningRegistry()
    expect(registry.list()).toHaveLength(6)
    expect(validateFinancialPlanningRegistry(registry)).toBeNull()
  })

  it('validator y contratos fail-closed', () => {
    const strategy = createBudgetOptimizationStrategy()
    expect(validateFinancialPlanningStrategy(strategy)).toBeNull()
    expect(validateFinancialPlanningStrategy({} as never)).not.toBeNull()

    const prioritizer = createFinancialPlanningPrioritizer({ maxActions: 3 })
    expect(validateFinancialPlanningPrioritizer(prioritizer)).toBeNull()
    expect(validateFinancialPlanningPrioritizer({} as never)).not.toBeNull()

    const plan = strategy.buildPlan(createEngineInput([
      createInsight({ category: 'budget', priority: 'HIGH', severity: 'HIGH' }),
    ]))
    expect(plan).not.toBeNull()
    if (plan !== null) {
      expect(validateFinancialActionPlan(plan)).toBeNull()
    }
    expect(validateFinancialActionPlan({} as never)).not.toBeNull()
  })

  it('registry evita duplicados y filtra por soporte', () => {
    const strategy = createBudgetOptimizationStrategy()
    const registry = createRegistry([strategy])

    const duplicated = registry.register(strategy)
    expect(duplicated.kind).toBe('failure')

    const supported = registry.findSupporting(createEngineInput([
      createInsight({ category: 'budget' }),
    ]))
    expect(supported.length).toBeGreaterThan(0)
  })

  it('prioritizer deduplica, ordena por impacto/prioridad y respeta limite', () => {
    const prioritizer = createFinancialPlanningPrioritizer({ maxActions: 2 })

    const prioritized = prioritizer.prioritize([
      {
        actionId: 'a-low',
        type: 'type',
        description: 'duplicada',
        expectedBenefit: 'beneficio',
        effort: 'HIGH',
        priority: 'INFO',
        affectedCategory: 'health',
        relatedGoal: null,
        requiresConfirmation: false,
      },
      {
        actionId: 'a-high',
        type: 'type',
        description: 'accion critica',
        expectedBenefit: 'beneficio alto',
        effort: 'LOW',
        priority: 'CRITICAL',
        affectedCategory: 'budget',
        relatedGoal: 'goal-1',
        requiresConfirmation: true,
      },
      {
        actionId: 'a-dup',
        type: 'type',
        description: 'duplicada',
        expectedBenefit: 'beneficio',
        effort: 'HIGH',
        priority: 'INFO',
        affectedCategory: 'health',
        relatedGoal: null,
        requiresConfirmation: false,
      },
    ])

    expect(prioritized).toHaveLength(2)
    expect(prioritized[0]?.priority).toBe('CRITICAL')
  })

  it('cada estrategia genera plan en su escenario', () => {
    const scenarios = [
      {
        strategy: createBudgetOptimizationStrategy(),
        insights: [createInsight({ category: 'budget' })],
      },
      {
        strategy: createSavingsImprovementStrategy(),
        insights: [createInsight({ category: 'health' })],
      },
      {
        strategy: createGoalRecoveryStrategy(),
        insights: [createInsight({ category: 'goal' })],
      },
      {
        strategy: createExpenseReductionStrategy(),
        insights: [createInsight({ category: 'expense' })],
      },
      {
        strategy: createCashFlowStabilizationStrategy(),
        insights: [createInsight({ category: 'income' })],
      },
      {
        strategy: createFinancialHealthImprovementStrategy(),
        insights: [createInsight({ category: 'health' })],
      },
    ] as const

    for (const scenario of scenarios) {
      const input = createEngineInput(scenario.insights)
      expect(scenario.strategy.supports(input)).toBe(true)
      const plan = scenario.strategy.buildPlan(input)
      expect(plan).not.toBeNull()
      if (plan !== null) {
        expect(validateFinancialActionPlan(plan)).toBeNull()
      }
    }
  })

  it('engine agrega, prioriza y entrega plan unificado', () => {
    const engine = createFinancialPlanningEngine()

    const actionPlan = engine.build(createEngineInput([
      createInsight({ insightId: 'insight:budget:1', category: 'budget', severity: 'HIGH', priority: 'HIGH' }),
      createInsight({ insightId: 'insight:goal:1', category: 'goal', severity: 'HIGH', priority: 'HIGH' }),
      createInsight({ insightId: 'insight:expense:1', category: 'expense', severity: 'CRITICAL', priority: 'CRITICAL' }),
      createInsight({ insightId: 'insight:health:1', category: 'health', severity: 'MEDIUM', priority: 'MEDIUM' }),
      createInsight({ insightId: 'insight:income:1', category: 'income', severity: 'HIGH', priority: 'HIGH' }),
    ]))

    expect(actionPlan).not.toBeNull()
    if (actionPlan !== null) {
      expect(actionPlan.recommendedActions.length).toBeGreaterThan(0)
      expect(actionPlan.priority).toBe('CRITICAL')
      expect(validateFinancialActionPlan(actionPlan)).toBeNull()
    }
  })

  it('engine retorna null cuando no hay insights aplicables', () => {
    const engine = createFinancialPlanningEngine()
    const result = engine.build(createEngineInput([]))
    expect(result).toBeNull()
  })
})
