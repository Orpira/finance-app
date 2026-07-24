import type {
  FinancialActionPlan,
  FinancialPlanningStrategy,
  FinancialPlanningStrategyInput,
  FinancialRecommendedAction,
} from '../financialPlanningContracts'

function buildAction(input: FinancialPlanningStrategyInput): FinancialRecommendedAction {
  return {
    actionId: `action:goal-recovery:${input.sessionId}:${input.requestedAt}`,
    type: 'goal-recovery',
    description: 'Recalendarizar hitos de la meta en riesgo y priorizar aportes clave.',
    expectedBenefit: 'Aumentar probabilidad de cumplimiento de la meta activa.',
    effort: 'MEDIUM',
    priority: 'HIGH',
    affectedCategory: 'goal',
    relatedGoal: input.executionPlan.context?.activeGoal ?? input.insights.find((insight) => insight.category === 'goal')?.insightId ?? null,
    requiresConfirmation: true,
  }
}

export function createGoalRecoveryStrategy(): FinancialPlanningStrategy {
  return {
    strategyId: 'goal-recovery-strategy',
    supports(input) {
      return input.insights.some((insight) => insight.category === 'goal')
    },
    buildPlan(input): FinancialActionPlan | null {
      if (!this.supports(input)) {
        return null
      }

      return {
        planId: `plan:goal-recovery:${input.sessionId}:${input.requestedAt}`,
        createdAt: input.requestedAt,
        title: 'Plan de recuperacion de metas',
        summary: 'Estrategia para recuperar metas financieras detectadas con riesgo.',
        objective: 'Recuperar ritmo de cumplimiento de la meta prioritaria.',
        priority: 'HIGH',
        estimatedImpact: 'HIGH',
        recommendedActions: [buildAction(input)],
        relatedInsights: input.insights.filter((insight) => insight.category === 'goal').map((insight) => insight.insightId),
        assumptions: ['La meta puede ajustarse por fases sin perder su objetivo final.'],
        warnings: ['Cambios en metas requieren confirmacion explicita del usuario.'],
      }
    },
  }
}
