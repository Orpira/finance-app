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

function historicalRows(input: FinancialInsightEvaluationInput) {
  return input.report?.sections.find((section) => section.sectionId === 'historical-cutoff-insights')?.rows ?? []
}

function createInsightId(input: FinancialInsightEvaluationInput): string {
  return normalizeText([
    input.sessionId,
    'subscription-opportunity',
    input.requestedAt,
  ].join(':'))
}

function createInsight(input: FinancialInsightEvaluationInput): FinancialInsight {
  return {
    protocolVersion: 1,
    insightId: createInsightId(input),
    category: 'subscription',
    severity: 'LOW',
    priority: 'LOW',
    title: 'Posibles gastos recurrentes optimizables',
    description: 'El historial muestra patrones de gasto repetitivo que podrían revisarse como suscripciones o servicios fijos.',
    recommendation: 'Revisa gastos repetitivos y cancela o renegocia los que no aporten valor real.',
    sourceTool: 'financial_insights',
    generatedAt: input.requestedAt,
  }
}

export function createSubscriptionOpportunityEvaluator(): FinancialInsightEvaluator {
  return {
    evaluatorId: 'subscription-opportunity-evaluator',
    supports(input) {
      return input.report !== null
    },
    async evaluate(input) {
      const rows = historicalRows(input)
      if (rows.length < 2) {
        return []
      }

      const expenseTotals = rows
        .map((row) => typeof row.expenseTotal === 'number' ? row.expenseTotal : null)
        .filter((value): value is number => value !== null && value > 0)

      const repeatedExpenseCount = rows.filter((row) => typeof row.expenseCount === 'number' && row.expenseCount >= 3).length

      if (expenseTotals.length < 2 || repeatedExpenseCount === 0) {
        return []
      }

      const min = Math.min(...expenseTotals)
      const max = Math.max(...expenseTotals)
      if (min === 0 || max / min > 1.2) {
        return []
      }

      return [createInsight(input)]
    },
  }
}
