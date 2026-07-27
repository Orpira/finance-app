import type { FinancialInsight } from './financialInsightContracts'
import type { FinancialActionPlan } from './financialPlanningStrategy'
import type { ConversationGoal } from './conversationGoalContracts'

/**
 * Resumen interno de la conversacion (seccion 13). Consumido unicamente por
 * el propio Copilot (p. ej. para runtime metrics o para decidir el proximo
 * follow-up); nunca se muestra al usuario ni se envia como texto de
 * respuesta.
 */
export interface ConversationSummary {
  readonly sessionId: string
  readonly goal: {
    readonly type: ConversationGoal['type']
    readonly monthlyTargetAmount: number | null
    readonly motivation: string | null
    readonly timeHorizon: string | null
  } | null
  readonly mainIssue: string | null
  readonly lastRecommendation: string | null
  readonly pendingFollowUp: string | null
  readonly generatedAt: string
}

export interface ConversationSummaryBuilder {
  build(input: {
    readonly sessionId: string
    readonly goal: ConversationGoal | null
    readonly prioritizedInsights: readonly FinancialInsight[]
    readonly prioritizedActionPlan: FinancialActionPlan | null
    readonly pendingFollowUpQuestion: string | null
    readonly requestedAt: string
  }): ConversationSummary
}

export function createConversationSummaryBuilder(): ConversationSummaryBuilder {
  return {
    build(input) {
      const topInsight = input.prioritizedInsights[0]
      const topAction = input.prioritizedActionPlan?.recommendedActions[0]

      return {
        sessionId: input.sessionId,
        goal: input.goal === null
          ? null
          : {
              type: input.goal.type,
              monthlyTargetAmount: input.goal.monthlyTargetAmount,
              motivation: input.goal.motivation,
              timeHorizon: input.goal.timeHorizon,
            },
        mainIssue: topInsight?.title ?? null,
        lastRecommendation: topAction?.description ?? null,
        pendingFollowUp: input.pendingFollowUpQuestion,
        generatedAt: input.requestedAt,
      }
    },
  }
}
