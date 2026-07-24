import type {
  FinancialActionPlan,
  FinancialPlanningStrategy,
  FinancialPlanningStrategyInput,
  FinancialRecommendedAction,
} from '../financialPlanningContracts'

function buildAction(input: FinancialPlanningStrategyInput): FinancialRecommendedAction {
  return {
    actionId: `action:savings-improvement:${input.sessionId}:${input.requestedAt}`,
    type: 'savings-improvement',
    description: 'Incrementar ahorro recurrente mediante reasignacion de excedentes.',
    expectedBenefit: 'Mayor capacidad de acumulacion y resiliencia ante imprevistos.',
    effort: 'LOW',
    priority: 'MEDIUM',
    affectedCategory: 'savings',
    relatedGoal: input.executionPlan.context?.activeGoal ?? null,
    requiresConfirmation: true,
  }
}

export function createSavingsImprovementStrategy(): FinancialPlanningStrategy {
  return {
    strategyId: 'savings-improvement-strategy',
    supports(input) {
      return input.insights.some((insight) => insight.category === 'health' || insight.category === 'goal')
    },
    buildPlan(input): FinancialActionPlan | null {
      if (!this.supports(input)) {
        return null
      }

      return {
        planId: `plan:savings-improvement:${input.sessionId}:${input.requestedAt}`,
        createdAt: input.requestedAt,
        title: 'Plan de mejora de ahorro',
        summary: 'Propuesta para elevar la tasa de ahorro con ajustes incrementales.',
        objective: 'Incrementar el ahorro neto mensual sin comprometer obligaciones esenciales.',
        priority: 'MEDIUM',
        estimatedImpact: 'MEDIUM',
        recommendedActions: [buildAction(input)],
        relatedInsights: input.insights.filter((insight) => insight.category === 'health' || insight.category === 'goal').map((insight) => insight.insightId),
        assumptions: ['Existe flujo disponible para redirigir a ahorro.'],
        warnings: ['Debe revisarse consistencia de ingresos antes de aumentar compromiso de ahorro.'],
      }
    },
  }
}
