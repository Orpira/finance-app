import type {
  FinancialInsight,
  FinancialInsightEvaluationInput,
  FinancialInsightEvaluator,
} from '../financialInsightContracts'

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function currentSeasonRow(input: FinancialInsightEvaluationInput) {
  return input.report?.sections.find((section) => section.sectionId === 'current-season-insights')?.rows[0] ?? null
}

function previousSeasonRow(input: FinancialInsightEvaluationInput) {
  return input.report?.sections.find((section) => section.sectionId === 'previous-season-insights')?.rows[0] ?? null
}

function createInsightId(input: FinancialInsightEvaluationInput): string {
  return normalizeText([
    input.sessionId,
    'savings-goal-risk',
    input.requestedAt,
    input.plan.skillId,
  ].join(':'))
}

function createInsight(input: FinancialInsightEvaluationInput, severity: FinancialInsight['severity']): FinancialInsight {
  const goalLabel = input.snapshot?.lastGoal ?? 'meta activa'
  return {
    protocolVersion: 1,
    insightId: createInsightId(input),
    category: 'goal',
    severity,
    priority: severity,
    title: 'Riesgo en la meta de ahorro',
    description: `La meta ${goalLabel} muestra señales de presión frente al ritmo actual de ahorro.`,
    recommendation: 'Ajusta el ahorro mensual o reduce gasto discrecional para proteger la meta activa.',
    sourceTool: 'financial_insights',
    generatedAt: input.requestedAt,
  }
}

export function createSavingsGoalRiskEvaluator(): FinancialInsightEvaluator {
  return {
    evaluatorId: 'savings-goal-risk-evaluator',
    supports(input) {
      return input.report !== null && input.snapshot?.lastGoal !== null && input.snapshot?.lastGoal !== undefined
    },
    async evaluate(input) {
      const current = currentSeasonRow(input)
      const previous = previousSeasonRow(input)
      if (current === null || previous === null) {
        return []
      }

      const currentNetGain = typeof current.netGain === 'number' ? current.netGain : null
      const previousRealGain = typeof previous.realGain === 'number' ? previous.realGain : null

      if (currentNetGain === null || previousRealGain === null) {
        return []
      }

      if (currentNetGain > 0 && currentNetGain >= previousRealGain * 0.8) {
        return []
      }

      const severity: FinancialInsight['severity'] = currentNetGain <= 0 ? 'HIGH' : 'MEDIUM'
      return [createInsight(input, severity)]
    },
  }
}
