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
    'income-stability',
    input.requestedAt,
  ].join(':'))
}

function createInsight(input: FinancialInsightEvaluationInput, severity: FinancialInsight['severity']): FinancialInsight {
  return {
    protocolVersion: 1,
    insightId: createInsightId(input),
    category: 'income',
    severity,
    priority: severity,
    title: 'Ingresos con menor estabilidad',
    description: 'El ingreso actual se encuentra por debajo del periodo comparado y puede requerir atención.',
    recommendation: 'Verifica la consistencia de ingresos y anticipa caídas en el flujo disponible.',
    sourceTool: 'financial_insights',
    generatedAt: input.requestedAt,
  }
}

export function createIncomeStabilityEvaluator(): FinancialInsightEvaluator {
  return {
    evaluatorId: 'income-stability-evaluator',
    supports(input) {
      return input.report !== null
    },
    async evaluate(input) {
      const current = currentSeasonRow(input)
      const previous = previousSeasonRow(input)
      if (current === null || previous === null) {
        return []
      }

      const currentIncome = typeof current.grossIncome === 'number' ? current.grossIncome : null
      const previousIncome = typeof previous.grossIncome === 'number' ? previous.grossIncome : null

      if (currentIncome === null || previousIncome === null) {
        return []
      }

      if (currentIncome >= previousIncome * 0.9) {
        return []
      }

      const severity: FinancialInsight['severity'] = currentIncome < previousIncome * 0.75 ? 'HIGH' : 'MEDIUM'
      return [createInsight(input, severity)]
    },
  }
}
