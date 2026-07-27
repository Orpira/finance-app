import { describe, expect, it } from 'vitest'

import { createOpportunityDetector } from '../src/intelligence/ai-conversation/provider-orchestration/coachingOpportunityDetector'
import { createNextBestActionGenerator } from '../src/intelligence/ai-conversation/provider-orchestration/coachingNextBestAction'
import { createInMemoryCoachingRecommendationHistory } from '../src/intelligence/ai-conversation/provider-orchestration/coachingRecommendationHistory'
import { createRecommendationPrioritizer } from '../src/intelligence/ai-conversation/provider-orchestration/recommendationPrioritizer'
import type { FinancialInsight } from '../src/intelligence/ai-conversation/provider-orchestration/financialInsightContracts'
import type { FinancialActionPlan } from '../src/intelligence/ai-conversation/provider-orchestration/financialPlanningStrategy'
import type { ConversationGoal } from '../src/intelligence/ai-conversation/provider-orchestration/conversationGoalContracts'

const REQUESTED_AT = '2026-07-27T10:00:00.000Z'

function createInsight(input: {
  readonly insightId: string
  readonly category: FinancialInsight['category']
  readonly priority: FinancialInsight['priority']
}): FinancialInsight {
  return {
    protocolVersion: 1,
    insightId: input.insightId,
    category: input.category,
    severity: input.priority,
    priority: input.priority,
    title: `title:${input.insightId}`,
    description: `description:${input.insightId}`,
    recommendation: `recommendation:${input.insightId}`,
    sourceTool: 'financial_insights',
    generatedAt: REQUESTED_AT,
  }
}

function createActionPlan(): FinancialActionPlan {
  return {
    planId: 'plan-1',
    createdAt: REQUESTED_AT,
    title: 'Plan',
    summary: 'Resumen',
    objective: 'Objetivo',
    priority: 'HIGH',
    estimatedImpact: 'HIGH',
    recommendedActions: [
      {
        actionId: 'action-expense',
        type: 'expense-reduction',
        description: 'Reducir gastos de ocio un 10%.',
        expectedBenefit: 'Libera 80 € al mes.',
        effort: 'LOW',
        priority: 'HIGH',
        affectedCategory: 'expense',
        relatedGoal: null,
        requiresConfirmation: false,
      },
    ],
    relatedInsights: ['insight-budget'],
    assumptions: [],
    warnings: [],
  }
}

describe('PB-IS-017.2 Opportunity Detector', () => {
  it('detección de oportunidades: envuelve acciones e insights ya generados sin calcular nada nuevo', () => {
    const detector = createOpportunityDetector({ recommendationPrioritizer: createRecommendationPrioritizer() })
    const insights = [
      createInsight({ insightId: 'insight-budget', category: 'budget', priority: 'HIGH' }),
      createInsight({ insightId: 'insight-income', category: 'income', priority: 'HIGH' }),
    ]
    const actionPlan = createActionPlan()

    const opportunities = detector.detect({ insights, actionPlan, goal: null })

    // El insight "insight-budget" ya esta representado por la accion
    // (relatedInsights), no debe duplicarse como oportunidad separada.
    expect(opportunities.map((o) => o.opportunityId)).toEqual(['action:action-expense', 'insight:insight-income'])
    expect(opportunities[0].title).toBe('Reducir gastos de ocio un 10%.')
    expect(opportunities[0].type).toBe('EXPENSE_OPPORTUNITY')
  })

  it('reutilización de Insights/Planning: nunca inventa texto, solo reexpone title/recommendation/description ya certificados', () => {
    const detector = createOpportunityDetector({ recommendationPrioritizer: createRecommendationPrioritizer() })
    const insights = [createInsight({ insightId: 'insight-only', category: 'health', priority: 'MEDIUM' })]

    const [opportunity] = detector.detect({ insights, actionPlan: null, goal: null })

    expect(opportunity.title).toBe('title:insight-only')
    expect(opportunity.recommendationText).toBe('recommendation:insight-only')
    expect(opportunity.type).toBe('FINANCIAL_HEALTH_OPPORTUNITY')
  })

  it('priorización: aplica el mismo orden que el Recommendation Prioritizer certificado, sin duplicar la logica de puntaje', () => {
    const prioritizer = createRecommendationPrioritizer()
    const detector = createOpportunityDetector({ recommendationPrioritizer: prioritizer })
    const low = createInsight({ insightId: 'low', category: 'expense', priority: 'LOW' })
    const critical = createInsight({ insightId: 'critical', category: 'expense', priority: 'CRITICAL' })

    const opportunities = detector.detect({ insights: [low, critical], actionPlan: null, goal: null })

    expect(opportunities.map((o) => o.opportunityId)).toEqual(['insight:critical', 'insight:low'])
  })

  it('ausencia de duplicación de cálculos: no modifica los montos ni el texto de la accion original', () => {
    const detector = createOpportunityDetector({ recommendationPrioritizer: createRecommendationPrioritizer() })
    const actionPlan = createActionPlan()

    const [opportunity] = detector.detect({ insights: [], actionPlan, goal: null })

    expect(opportunity.recommendationText).toBe('Libera 80 € al mes.')
    // El plan original permanece intacto (el detector solo lee, no muta).
    expect(actionPlan.recommendedActions[0].expectedBenefit).toBe('Libera 80 € al mes.')
  })
})

describe('PB-IS-017.2 Next Best Action', () => {
  it('selecciona la oportunidad de mayor rango como unica accion principal (DA-0172-03)', () => {
    const history = createInMemoryCoachingRecommendationHistory()
    const generator = createNextBestActionGenerator({ history })
    const detector = createOpportunityDetector({ recommendationPrioritizer: createRecommendationPrioritizer() })
    const opportunities = detector.detect({ insights: [], actionPlan: createActionPlan(), goal: null })

    const nextBestAction = generator.selectNextBestAction({ sessionId: 'session-1', opportunities })

    expect(nextBestAction?.opportunityId).toBe('action:action-expense')
    expect(nextBestAction?.actionText).toBe('Reducir gastos de ocio un 10%.')
  })

  it('devuelve null cuando no hay oportunidades (nunca inventa una accion)', () => {
    const generator = createNextBestActionGenerator({ history: createInMemoryCoachingRecommendationHistory() })
    expect(generator.selectNextBestAction({ sessionId: 'session-1', opportunities: [] })).toBeNull()
  })
})

describe('PB-IS-017.2 Recommendation History', () => {
  it('historial de recomendaciones: evita repetir continuamente la misma recomendación', () => {
    const history = createInMemoryCoachingRecommendationHistory()
    const generator = createNextBestActionGenerator({ history })
    const insights = [
      createInsight({ insightId: 'first', category: 'expense', priority: 'HIGH' }),
      createInsight({ insightId: 'second', category: 'income', priority: 'MEDIUM' }),
    ]
    const detector = createOpportunityDetector({ recommendationPrioritizer: createRecommendationPrioritizer() })
    const opportunities = detector.detect({ insights, actionPlan: null, goal: null })

    const first = generator.selectNextBestAction({ sessionId: 'session-1', opportunities })
    expect(first?.opportunityId).toBe('insight:first')

    const second = generator.selectNextBestAction({ sessionId: 'session-1', opportunities })
    expect(second?.opportunityId).toBe('insight:second')

    // Agotadas las oportunidades no mostradas, vuelve a la de mayor rango
    // en vez de no responder nada.
    const third = generator.selectNextBestAction({ sessionId: 'session-1', opportunities })
    expect(third?.opportunityId).toBe('insight:first')
  })

  it('el historial es independiente por sesion', () => {
    const history = createInMemoryCoachingRecommendationHistory()
    history.recordShown('session-a', 'insight:first')
    expect(history.getShownOpportunityIds('session-a')).toEqual(['insight:first'])
    expect(history.getShownOpportunityIds('session-b')).toEqual([])
  })

  it('ausencia de persistencia en IndexedDB: un historial nuevo no ve lo mostrado por otro', () => {
    const historyA = createInMemoryCoachingRecommendationHistory()
    historyA.recordShown('session-1', 'insight:first')

    const historyB = createInMemoryCoachingRecommendationHistory()
    expect(historyB.getShownOpportunityIds('session-1')).toEqual([])
  })
})

describe('PB-IS-017.2 alineación con el objetivo activo', () => {
  it('el objetivo activo influye en cual oportunidad se detecta primero (reutiliza el Prioritizer de 017.1)', () => {
    const detector = createOpportunityDetector({ recommendationPrioritizer: createRecommendationPrioritizer() })
    const unrelated = createInsight({ insightId: 'unrelated', category: 'income', priority: 'HIGH' })
    const related = createInsight({ insightId: 'related', category: 'expense', priority: 'HIGH' })
    const goal: ConversationGoal = {
      protocolVersion: 1,
      sessionId: 'session-1',
      type: 'REDUCE_EXPENSES',
      monthlyTargetAmount: null,
      motivation: null,
      timeHorizon: null,
      createdAt: REQUESTED_AT,
      updatedAt: REQUESTED_AT,
    }

    const opportunities = detector.detect({ insights: [unrelated, related], actionPlan: null, goal })

    expect(opportunities[0].opportunityId).toBe('insight:related')
  })
})
