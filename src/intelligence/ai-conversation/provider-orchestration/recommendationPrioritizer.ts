import type { FinancialInsight, FinancialInsightPriority } from './financialInsightContracts'
import type { FinancialActionPlan, FinancialRecommendedAction } from './financialPlanningStrategy'
import {
  CONVERSATION_GOAL_RELATED_CATEGORIES,
  type ConversationGoal,
} from './conversationGoalContracts'

export interface RecommendationPrioritizer {
  /**
   * Reordena insights ya generados por severidad/prioridad y, si hay un
   * objetivo activo, por afinidad con su categoria (seccion 9-11). Nunca
   * agrega, quita ni recalcula un insight -- solo cambia el orden del mismo
   * arreglo recibido.
   */
  prioritizeInsights(insights: readonly FinancialInsight[], goal: ConversationGoal | null): readonly FinancialInsight[]
  /**
   * Devuelve el mismo `FinancialActionPlan` con `recommendedActions`
   * reordenadas por impacto, facilidad y afinidad con el objetivo activo
   * (seccion 9-10). El resto del plan (resumen, objetivo, warnings) no se
   * modifica -- nunca se recalcula un plan (DA-0171-01).
   */
  prioritizeActionPlan(actionPlan: FinancialActionPlan | null, goal: ConversationGoal | null): FinancialActionPlan | null
}

const PRIORITY_WEIGHT: Readonly<Record<FinancialInsightPriority, number>> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
}

const EFFORT_EASE_WEIGHT: Readonly<Record<FinancialRecommendedAction['effort'], number>> = {
  LOW: 3,
  MEDIUM: 2,
  HIGH: 1,
}

function goalAlignmentBonus(category: string | null, goal: ConversationGoal | null): number {
  if (category === null || goal === null) {
    return 0
  }
  const relatedCategories = CONVERSATION_GOAL_RELATED_CATEGORIES[goal.type]
  return relatedCategories.includes(category.toLowerCase()) ? 2 : 0
}

function scoreInsight(insight: FinancialInsight, goal: ConversationGoal | null): number {
  return PRIORITY_WEIGHT[insight.priority] * 3 + goalAlignmentBonus(insight.category, goal)
}

function scoreAction(action: FinancialRecommendedAction, goal: ConversationGoal | null): number {
  const riskPenalty = action.requiresConfirmation ? 1 : 0
  return (
    PRIORITY_WEIGHT[action.priority] * 3
    + EFFORT_EASE_WEIGHT[action.effort]
    + goalAlignmentBonus(action.affectedCategory, goal)
    - riskPenalty
  )
}

/**
 * Ordena de mayor a menor puntaje de forma estable (`Array.prototype
 * .toSorted`/`slice().sort` con comparador que preserva el orden original en
 * empates), para que un reordenamiento a igual puntaje nunca resulte
 * arbitrario entre corridas (seccion 9: impacto, urgencia, facilidad,
 * riesgo, objetivo activo -- todos derivados de datos ya certificados por
 * Insight Engine/Planning Engine, nunca inventados, DA-0171-03).
 */
export function createRecommendationPrioritizer(): RecommendationPrioritizer {
  return {
    prioritizeInsights(insights, goal) {
      return insights
        .map((insight, index) => ({ insight, index, score: scoreInsight(insight, goal) }))
        .sort((a, b) => (b.score - a.score) || (a.index - b.index))
        .map((entry) => entry.insight)
    },

    prioritizeActionPlan(actionPlan, goal) {
      if (actionPlan === null) {
        return null
      }
      const recommendedActions = actionPlan.recommendedActions
        .map((action, index) => ({ action, index, score: scoreAction(action, goal) }))
        .sort((a, b) => (b.score - a.score) || (a.index - b.index))
        .map((entry) => entry.action)

      return { ...actionPlan, recommendedActions }
    },
  }
}
