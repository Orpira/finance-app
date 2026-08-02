import type {
  FinancialActionPlan,
  FinancialPlanningStrategy,
  FinancialPlanningStrategyInput,
  FinancialRecommendedAction,
} from '../financialPlanningContracts'

function buildAction(input: FinancialPlanningStrategyInput): FinancialRecommendedAction {
  return {
    actionId: `action:budget-optimization:${input.sessionId}:${input.requestedAt}`,
    type: 'budget-optimization',
    description: 'Reducir partidas de gasto que exceden el presupuesto operativo actual.',
    expectedBenefit: 'Disminuir el desbalance y recuperar margen mensual.',
    effort: 'MEDIUM',
    priority: 'HIGH',
    affectedCategory: input.executionPlan.context?.activeCategory ?? 'budget',
    relatedGoal: input.executionPlan.context?.activeGoal ?? null,
    requiresConfirmation: true,
  }
}

export function createBudgetOptimizationStrategy(): FinancialPlanningStrategy {
  return {
    strategyId: 'budget-optimization-strategy',
    supports(input) {
      return input.insights.some((insight) => insight.category === 'budget')
    },
    buildPlan(input): FinancialActionPlan | null {
      if (!this.supports(input)) {
        return null
      }

      return {
        planId: `plan:budget-optimization:${input.sessionId}:${input.requestedAt}`,
        createdAt: input.requestedAt,
        title: 'Plan de optimización de presupuesto',
        summary: 'Estrategia para reducir sobrecostos detectados por el análisis proactivo.',
        objective: 'Recuperar control del presupuesto mensual.',
        priority: 'HIGH',
        estimatedImpact: 'HIGH',
        recommendedActions: [buildAction(input)],
        relatedInsights: input.insights.filter((insight) => insight.category === 'budget').map((insight) => insight.insightId),
        assumptions: ['Las categorías de gasto son ajustables en el siguiente ciclo.'],
        warnings: ['Requiere validación del usuario antes de aplicar cambios operativos.'],
      }
    },
  }
}
