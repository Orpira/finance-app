import type { FinancialInsight, FinancialInsightCategory } from './financialInsightContracts'
import type { FinancialActionPlan, FinancialRecommendedAction } from './financialPlanningStrategy'
import type { RecommendationPrioritizer } from './recommendationPrioritizer'
import type { ConversationGoal } from './conversationGoalContracts'
import { COACHING_PROTOCOL_VERSION, type CoachingOpportunity, type OpportunityType } from './coachingContracts'

export interface OpportunityDetector {
  /**
   * Detecta oportunidades a partir unicamente de insights y del plan ya
   * generados por Insight Engine / Planning Engine (seccion 5: "Nunca
   * calcular informacion nueva"). El orden ya viene del
   * `RecommendationPrioritizer` certificado en PB-IS-017.1 -- este
   * detector no reordena ni recalcula, solo envuelve cada entrada ya
   * priorizada como una `CoachingOpportunity` con su tipo.
   */
  detect(input: {
    readonly insights: readonly FinancialInsight[]
    readonly actionPlan: FinancialActionPlan | null
    readonly goal: ConversationGoal | null
  }): readonly CoachingOpportunity[]
}

const INSIGHT_CATEGORY_TO_OPPORTUNITY_TYPE: Readonly<Record<FinancialInsightCategory, OpportunityType>> = {
  budget: 'BUDGET_OPPORTUNITY',
  goal: 'GOAL_OPPORTUNITY',
  expense: 'EXPENSE_OPPORTUNITY',
  income: 'INCOME_OPPORTUNITY',
  subscription: 'SUBSCRIPTION_OPPORTUNITY',
  health: 'FINANCIAL_HEALTH_OPPORTUNITY',
}

const ACTION_TYPE_TO_OPPORTUNITY_TYPE: Readonly<Record<string, OpportunityType>> = {
  'expense-reduction': 'EXPENSE_OPPORTUNITY',
  'budget-optimization': 'BUDGET_OPPORTUNITY',
  'savings-improvement': 'GOAL_OPPORTUNITY',
  'goal-recovery': 'GOAL_OPPORTUNITY',
  'cashflow-stabilization': 'INCOME_OPPORTUNITY',
  'financial-health-improvement': 'FINANCIAL_HEALTH_OPPORTUNITY',
}

function opportunityFromInsight(insight: FinancialInsight, rank: number): CoachingOpportunity {
  return {
    protocolVersion: COACHING_PROTOCOL_VERSION,
    opportunityId: `insight:${insight.insightId}`,
    type: INSIGHT_CATEGORY_TO_OPPORTUNITY_TYPE[insight.category],
    sourceKind: 'insight',
    title: insight.title,
    recommendationText: insight.recommendation,
    rank,
  }
}

function opportunityFromAction(action: FinancialRecommendedAction, rank: number): CoachingOpportunity {
  return {
    protocolVersion: COACHING_PROTOCOL_VERSION,
    opportunityId: `action:${action.actionId}`,
    type: ACTION_TYPE_TO_OPPORTUNITY_TYPE[action.type] ?? 'FINANCIAL_HEALTH_OPPORTUNITY',
    sourceKind: 'action',
    title: action.description,
    recommendationText: action.expectedBenefit,
    rank,
  }
}

/**
 * Compone (no duplica, DA-0172-04) el `RecommendationPrioritizer` ya
 * certificado en PB-IS-017.1 para obtener insights/acciones ya ordenados
 * por prioridad, facilidad y afinidad con el objetivo activo, y los expone
 * como una unica lista de oportunidades intercaladas por rango relativo:
 * primero todas las acciones del Planning Engine (ya priorizadas), luego
 * los insights restantes que no dieron lugar a una accion (seccion 6).
 */
export function createOpportunityDetector(
  input: { readonly recommendationPrioritizer: RecommendationPrioritizer },
): OpportunityDetector {
  return {
    detect({ insights, actionPlan, goal }) {
      const prioritizedInsights = input.recommendationPrioritizer.prioritizeInsights(insights, goal)
      const prioritizedActionPlan = input.recommendationPrioritizer.prioritizeActionPlan(actionPlan, goal)

      const actionOpportunities = (prioritizedActionPlan?.recommendedActions ?? [])
        .map((action, index) => opportunityFromAction(action, index))

      const relatedInsightIds = new Set(prioritizedActionPlan?.relatedInsights ?? [])
      const remainingInsights = prioritizedInsights.filter((insight) => !relatedInsightIds.has(insight.insightId))
      const insightOpportunities = remainingInsights
        .map((insight, index) => opportunityFromInsight(insight, actionOpportunities.length + index))

      return [...actionOpportunities, ...insightOpportunities]
    },
  }
}
