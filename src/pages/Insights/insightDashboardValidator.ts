import type {
  InsightDashboardSnapshot,
  InsightDashboardUseCaseError,
  InsightDashboardViewModel,
} from './insightDashboardContracts'

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function validateInsightDashboardSnapshot(
  snapshot: InsightDashboardSnapshot,
): InsightDashboardUseCaseError | null {
  if (
    !isNonEmptyString(snapshot.generatedAt)
    || !isFiniteNumber(snapshot.financialSummary.incomeTotal)
    || !isFiniteNumber(snapshot.financialSummary.expenseTotal)
    || !isFiniteNumber(snapshot.financialSummary.adjustmentTotal)
    || !isFiniteNumber(snapshot.financialSummary.netBalance)
    || !Array.isArray(snapshot.insights)
    || !Array.isArray(snapshot.warnings)
  ) {
    return {
      code: 'INSIGHT_DASHBOARD_VIEWMODEL_INVALID',
      message: 'El snapshot del dashboard no cumple el contrato esperado.',
    }
  }

  return null
}

export function validateInsightDashboardViewModel(
  viewModel: InsightDashboardViewModel,
): InsightDashboardUseCaseError | null {
  if (
    !isNonEmptyString(viewModel.title)
    || !isNonEmptyString(viewModel.generatedAt)
    || !Array.isArray(viewModel.insights)
    || !Array.isArray(viewModel.recommendedActions)
    || !Array.isArray(viewModel.warnings)
  ) {
    return {
      code: 'INSIGHT_DASHBOARD_VIEWMODEL_INVALID',
      message: 'El ViewModel del dashboard no cumple el contrato esperado.',
    }
  }

  return null
}
