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

function sectionById(input: FinancialInsightEvaluationInput, sectionId: string) {
  return input.report?.sections.find((section) => section.sectionId === sectionId) ?? null
}

function firstRow(section: { readonly rows: readonly Record<string, string | number | boolean | null>[] } | null) {
  return section?.rows[0] ?? null
}

function createInsightId(input: FinancialInsightEvaluationInput): string {
  return normalizeText([
    input.sessionId,
    'budget-overspending',
    input.requestedAt,
  ].join(':'))
}

function createInsight(input: FinancialInsightEvaluationInput, severity: FinancialInsight['severity']): FinancialInsight {
  return {
    protocolVersion: 1,
    insightId: createInsightId(input),
    category: 'budget',
    severity,
    priority: severity,
    title: 'Gasto por encima del ingreso',
    description: 'El reporte financiero muestra que los gastos actuales superan la capacidad de ingreso disponible.',
    recommendation: 'Revisa el presupuesto y reduce partidas no esenciales antes de que el margen empeore.',
    sourceTool: 'financial_insights',
    generatedAt: input.requestedAt,
  }
}

export function createBudgetOverspendingEvaluator(): FinancialInsightEvaluator {
  return {
    evaluatorId: 'budget-overspending-evaluator',
    supports(input) {
      return input.report !== null && sectionById(input, 'current-season-insights') !== null
    },
    async evaluate(input) {
      const row = firstRow(sectionById(input, 'current-season-insights'))
      if (row === null) {
        return []
      }

      const grossIncome = typeof row.grossIncome === 'number' ? row.grossIncome : null
      const totalExpenses = typeof row.totalExpenses === 'number' ? row.totalExpenses : null
      const netGain = typeof row.netGain === 'number' ? row.netGain : null

      if (grossIncome === null || totalExpenses === null || netGain === null) {
        return []
      }

      if (totalExpenses <= grossIncome && netGain >= 0) {
        return []
      }

      const severity: FinancialInsight['severity'] = netGain < 0 || totalExpenses > grossIncome * 1.15
        ? 'CRITICAL'
        : 'HIGH'

      return [createInsight(input, severity)]
    },
  }
}
