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
    'expense-trend',
    input.requestedAt,
  ].join(':'))
}

function createInsight(input: FinancialInsightEvaluationInput, severity: FinancialInsight['severity']): FinancialInsight {
  return {
    protocolVersion: 1,
    insightId: createInsightId(input),
    category: 'expense',
    severity,
    priority: severity,
    title: 'Gastos en tendencia ascendente',
    description: 'El gasto actual supera al periodo comparado y sugiere una tendencia de crecimiento.',
    recommendation: 'Identifica las partidas que más crecieron y corrige el patrón antes del siguiente cierre.',
    sourceTool: 'financial_insights',
    generatedAt: input.requestedAt,
  }
}

export function createExpenseTrendEvaluator(): FinancialInsightEvaluator {
  return {
    evaluatorId: 'expense-trend-evaluator',
    supports(input) {
      return input.report !== null
    },
    async evaluate(input) {
      const current = currentSeasonRow(input)
      const previous = previousSeasonRow(input)
      if (current === null || previous === null) {
        return []
      }

      const currentExpenses = typeof current.totalExpenses === 'number' ? current.totalExpenses : null
      const previousExpenses = typeof previous.totalExpenses === 'number' ? previous.totalExpenses : null

      if (currentExpenses === null || previousExpenses === null) {
        return []
      }

      if (currentExpenses <= previousExpenses * 1.15) {
        return []
      }

      const severity: FinancialInsight['severity'] = currentExpenses > previousExpenses * 1.35 ? 'HIGH' : 'MEDIUM'
      return [createInsight(input, severity)]
    },
  }
}
