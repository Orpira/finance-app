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

function createInsightId(input: FinancialInsightEvaluationInput): string {
  return normalizeText([
    input.sessionId,
    'financial-health',
    input.requestedAt,
  ].join(':'))
}

function createInsight(input: FinancialInsightEvaluationInput, severity: FinancialInsight['severity']): FinancialInsight {
  return {
    protocolVersion: 1,
    insightId: createInsightId(input),
    category: 'health',
    severity,
    priority: severity,
    title: 'Estado financiero general',
    description: 'La evaluación general del reporte ofrece una lectura resumida de la salud financiera actual.',
    recommendation: 'Sigue revisando tendencia de ingresos, gasto y margen para mantener estabilidad.',
    sourceTool: 'financial_insights',
    generatedAt: input.requestedAt,
  }
}

export function createFinancialHealthEvaluator(): FinancialInsightEvaluator {
  return {
    evaluatorId: 'financial-health-evaluator',
    supports(input) {
      return input.report !== null && (input.report?.summary.rowCount ?? 0) > 0
    },
    async evaluate(input) {
      const current = currentSeasonRow(input)
      if (current === null) {
        return [createInsight(input, 'INFO')]
      }

      const netGain = typeof current.netGain === 'number' ? current.netGain : null
      const grossIncome = typeof current.grossIncome === 'number' ? current.grossIncome : null
      const totalExpenses = typeof current.totalExpenses === 'number' ? current.totalExpenses : null

      if (netGain === null || grossIncome === null || totalExpenses === null) {
        return [createInsight(input, 'INFO')]
      }

      if (netGain < 0 || totalExpenses > grossIncome) {
        return [createInsight(input, 'MEDIUM')]
      }

      if (netGain < grossIncome * 0.15) {
        return [createInsight(input, 'LOW')]
      }

      return [createInsight(input, 'INFO')]
    },
  }
}
