import type {
  FinancialActionPlan,
  FinancialRecommendedAction,
} from '../../intelligence/ai-conversation/provider-orchestration/financialPlanningContracts'
import type {
  FinancialInsight,
  FinancialInsightSeverity,
} from '../../intelligence/ai-conversation/provider-orchestration/financialInsightContracts'
import type { CurrencyCode, UsageMode } from '../../types/settings'

export interface InsightDashboardFinancialSummary {
  readonly currency: CurrencyCode
  readonly usageMode: UsageMode
  readonly incomeTotal: number
  readonly expenseTotal: number
  readonly adjustmentTotal: number
  readonly netBalance: number
  readonly incomeCount: number
  readonly expenseCount: number
  readonly adjustmentCount: number
  readonly hasData: boolean
}

export interface InsightDashboardDataSources {
  readonly incomes: string
  readonly expenses: string
  readonly settings: string
  readonly activePeriod: string
  readonly insightEngine: string
  readonly planningEngine: string
}

export interface InsightDashboardSnapshot {
  readonly generatedAt: string
  readonly financialSummary: InsightDashboardFinancialSummary
  readonly insights: readonly FinancialInsight[]
  readonly actionPlan: FinancialActionPlan | null
  readonly dataSources: InsightDashboardDataSources
  readonly isPartial: boolean
  readonly warnings: readonly string[]
}

export interface InsightDashboardInsightCard {
  readonly id: string
  readonly category: string
  readonly priority: FinancialInsightSeverity
  readonly severity: FinancialInsightSeverity
  readonly title: string
  readonly description: string
  readonly recommendation: string
  readonly generatedAt: string
}

export interface InsightDashboardActionCard {
  readonly id: string
  readonly type: string
  readonly description: string
  readonly expectedBenefit: string
  readonly effort: string
  readonly priority: string
  readonly requiresConfirmation: boolean
}

export interface InsightDashboardActionPlanView {
  readonly planId: string
  readonly title: string
  readonly summary: string
  readonly objective: string
  readonly priority: string
  readonly estimatedImpact: string
  readonly relatedInsights: readonly string[]
  readonly warnings: readonly string[]
}

export interface InsightDashboardViewModel {
  readonly title: string
  readonly subtitle: string
  readonly generatedAt: string
  readonly generatedAtLabel: string
  readonly dataStatus: 'complete' | 'partial'
  readonly warnings: readonly string[]
  readonly summary: InsightDashboardFinancialSummary
  readonly insights: readonly InsightDashboardInsightCard[]
  readonly actionPlan: InsightDashboardActionPlanView | null
  readonly recommendedActions: readonly InsightDashboardActionCard[]
}

export type InsightDashboardUseCaseErrorCode =
  | 'INSIGHT_DASHBOARD_READ_FAILED'
  | 'INSIGHT_DASHBOARD_TIMEOUT'
  | 'INSIGHT_DASHBOARD_INSIGHT_ENGINE_FAILED'
  | 'INSIGHT_DASHBOARD_VIEWMODEL_INVALID'

export interface InsightDashboardUseCaseError {
  readonly code: InsightDashboardUseCaseErrorCode
  readonly message: string
}

export interface InsightDashboardUseCaseSuccess {
  readonly kind: 'success' | 'empty' | 'partial'
  readonly snapshot: InsightDashboardSnapshot
  readonly viewModel: InsightDashboardViewModel
}

export interface InsightDashboardUseCaseFailure {
  readonly kind: 'error'
  readonly error: InsightDashboardUseCaseError
}

export type InsightDashboardUseCaseResult =
  | InsightDashboardUseCaseSuccess
  | InsightDashboardUseCaseFailure

export interface InsightDashboardUseCase {
  execute(): Promise<InsightDashboardUseCaseResult>
}

export interface InsightDashboardMapperInput {
  readonly snapshot: InsightDashboardSnapshot
}

export interface InsightDashboardMapper {
  map(input: InsightDashboardMapperInput): InsightDashboardViewModel
}

export interface InsightDashboardFinancialData {
  readonly usageMode: UsageMode
  readonly currency: CurrencyCode
  readonly incomeTotal: number
  readonly expenseTotal: number
  readonly adjustmentTotal: number
  readonly netBalance: number
  readonly incomeCount: number
  readonly expenseCount: number
  readonly adjustmentCount: number
  readonly hasData: boolean
  readonly periodId?: number
  readonly periodStart?: string
  readonly periodEnd?: string
}

export interface InsightDashboardFinancialDataReader {
  read(): Promise<InsightDashboardFinancialData>
}

export interface InsightDashboardPlanningRunner {
  run(input: {
    readonly sessionId: string
    readonly requestedAt: string
    readonly insights: readonly FinancialInsight[]
    readonly periodStart?: string
    readonly periodEnd?: string
  }): FinancialActionPlan | null
}

export function mapRecommendedActions(
  actionPlan: FinancialActionPlan | null,
): readonly FinancialRecommendedAction[] {
  return actionPlan?.recommendedActions ?? []
}
