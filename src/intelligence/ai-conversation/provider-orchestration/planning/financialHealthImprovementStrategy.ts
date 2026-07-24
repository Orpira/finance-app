import type {
  FinancialActionPlan,
  FinancialPlanningStrategy,
  FinancialPlanningStrategyInput,
  FinancialRecommendedAction,
} from '../financialPlanningContracts'

function buildAction(input: FinancialPlanningStrategyInput): FinancialRecommendedAction {
  return {
    actionId: `action:financial-health-improvement:${input.sessionId}:${input.requestedAt}`,
    type: 'financial-health-improvement',
    description: 'Consolidar una revision semanal de margen, ahorro y cumplimiento de metas.',
    expectedBenefit: 'Mejor visibilidad de salud financiera y decisiones preventivas.',
    effort: 'LOW',
    priority: 'MEDIUM',
    affectedCategory: 'health',
    relatedGoal: input.executionPlan.context?.activeGoal ?? null,
    requiresConfirmation: false,
  }
}

export function createFinancialHealthImprovementStrategy(): FinancialPlanningStrategy {
  return {
    strategyId: 'financial-health-improvement-strategy',
    supports(input) {
      return input.insights.some((insight) => insight.category === 'health') || input.insights.length > 0
    },
    buildPlan(input): FinancialActionPlan | null {
      if (!this.supports(input)) {
        return null
      }

      return {
        planId: `plan:financial-health-improvement:${input.sessionId}:${input.requestedAt}`,
        createdAt: input.requestedAt,
        title: 'Plan de mejora de salud financiera',
        summary: 'Plan general para sostener mejoras y monitorear indicadores clave.',
        objective: 'Mantener estabilidad financiera con seguimiento continuo.',
        priority: 'MEDIUM',
        estimatedImpact: 'MEDIUM',
        recommendedActions: [buildAction(input)],
        relatedInsights: input.insights.map((insight) => insight.insightId),
        assumptions: ['La disciplina de seguimiento semanal es viable para el usuario.'],
        warnings: ['Requiere consistencia para que el impacto se materialice en el tiempo.'],
      }
    },
  }
}
