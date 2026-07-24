import type {
  FinancialInsight,
} from './financialInsightContracts'
import type {
  FinancialConversationExecutionPlan,
} from './financialConversationExecutionPlan'

export type FinancialPlanningPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
export type FinancialPlanningImpact = 'HIGH' | 'MEDIUM' | 'LOW'
export type FinancialPlanningActionEffort = 'LOW' | 'MEDIUM' | 'HIGH'

export interface FinancialRecommendedAction {
  readonly actionId: string
  readonly type: string
  readonly description: string
  readonly expectedBenefit: string
  readonly effort: FinancialPlanningActionEffort
  readonly priority: FinancialPlanningPriority
  readonly affectedCategory: string | null
  readonly relatedGoal: string | null
  readonly requiresConfirmation: boolean
}

export interface FinancialActionPlan {
  readonly planId: string
  readonly createdAt: string
  readonly title: string
  readonly summary: string
  readonly objective: string
  readonly priority: FinancialPlanningPriority
  readonly estimatedImpact: FinancialPlanningImpact
  readonly recommendedActions: readonly FinancialRecommendedAction[]
  readonly relatedInsights: readonly string[]
  readonly assumptions: readonly string[]
  readonly warnings: readonly string[]
}

export interface FinancialPlanningStrategyInput {
  readonly sessionId: string
  readonly userMessage: string
  readonly requestedAt: string
  readonly executionPlan: FinancialConversationExecutionPlan
  readonly insights: readonly FinancialInsight[]
}

export interface FinancialPlanningStrategy {
  readonly strategyId: string
  supports(input: FinancialPlanningStrategyInput): boolean
  buildPlan(input: FinancialPlanningStrategyInput): FinancialActionPlan | null
}
