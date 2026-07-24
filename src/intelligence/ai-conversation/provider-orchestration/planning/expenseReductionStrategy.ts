import type {
  FinancialActionPlan,
  FinancialPlanningStrategy,
  FinancialPlanningStrategyInput,
  FinancialRecommendedAction,
} from '../financialPlanningContracts'

function buildAction(input: FinancialPlanningStrategyInput): FinancialRecommendedAction {
  return {
    actionId: `action:expense-reduction:${input.sessionId}:${input.requestedAt}`,
    type: 'expense-reduction',
    description: 'Reducir gastos de alta recurrencia y baja contribucion de valor.',
    expectedBenefit: 'Disminuir egresos mensuales y mejorar margen operativo.',
    effort: 'LOW',
    priority: 'HIGH',
    affectedCategory: input.executionPlan.context?.activeCategory ?? 'expense',
    relatedGoal: input.executionPlan.context?.activeGoal ?? null,
    requiresConfirmation: true,
  }
}

export function createExpenseReductionStrategy(): FinancialPlanningStrategy {
  return {
    strategyId: 'expense-reduction-strategy',
    supports(input) {
      return input.insights.some((insight) => insight.category === 'expense' || insight.category === 'subscription')
    },
    buildPlan(input): FinancialActionPlan | null {
      if (!this.supports(input)) {
        return null
      }

      return {
        planId: `plan:expense-reduction:${input.sessionId}:${input.requestedAt}`,
        createdAt: input.requestedAt,
        title: 'Plan de reduccion de gastos',
        summary: 'Acciones para desacelerar la tendencia de gasto y proteger liquidez.',
        objective: 'Reducir gastos no prioritarios de forma sostenible.',
        priority: 'HIGH',
        estimatedImpact: 'HIGH',
        recommendedActions: [buildAction(input)],
        relatedInsights: input.insights
          .filter((insight) => insight.category === 'expense' || insight.category === 'subscription')
          .map((insight) => insight.insightId),
        assumptions: ['Existen partidas con margen de optimizacion.'],
        warnings: ['Evitar reducciones que afecten compromisos esenciales.'],
      }
    },
  }
}
