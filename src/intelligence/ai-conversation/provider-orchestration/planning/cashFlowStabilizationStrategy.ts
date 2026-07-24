import type {
  FinancialActionPlan,
  FinancialPlanningStrategy,
  FinancialPlanningStrategyInput,
  FinancialRecommendedAction,
} from '../financialPlanningContracts'

function buildAction(input: FinancialPlanningStrategyInput): FinancialRecommendedAction {
  return {
    actionId: `action:cashflow-stabilization:${input.sessionId}:${input.requestedAt}`,
    type: 'cashflow-stabilization',
    description: 'Ajustar calendario de ingresos y egresos para reducir volatilidad de caja.',
    expectedBenefit: 'Mayor estabilidad de flujo y menor riesgo operativo mensual.',
    effort: 'MEDIUM',
    priority: 'CRITICAL',
    affectedCategory: 'cash-flow',
    relatedGoal: input.executionPlan.context?.activeGoal ?? null,
    requiresConfirmation: true,
  }
}

export function createCashFlowStabilizationStrategy(): FinancialPlanningStrategy {
  return {
    strategyId: 'cash-flow-stabilization-strategy',
    supports(input) {
      return input.insights.some((insight) => insight.category === 'income' || insight.category === 'budget')
    },
    buildPlan(input): FinancialActionPlan | null {
      if (!this.supports(input)) {
        return null
      }

      return {
        planId: `plan:cash-flow-stabilization:${input.sessionId}:${input.requestedAt}`,
        createdAt: input.requestedAt,
        title: 'Plan de estabilizacion de flujo de caja',
        summary: 'Acciones para fortalecer liquidez y reducir desbalances de flujo.',
        objective: 'Estabilizar flujo de caja de corto plazo.',
        priority: 'CRITICAL',
        estimatedImpact: 'HIGH',
        recommendedActions: [buildAction(input)],
        relatedInsights: input.insights
          .filter((insight) => insight.category === 'income' || insight.category === 'budget')
          .map((insight) => insight.insightId),
        assumptions: ['La programacion de pagos y cobros puede reordenarse.'],
        warnings: ['No ejecutar reprogramaciones sin confirmacion del usuario.'],
      }
    },
  }
}
