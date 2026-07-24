import type {
  FinancialInsight,
} from './financialInsightContracts'
import type {
  FinancialConversationExecutionPlan,
} from './financialConversationExecutionPlan'
import type {
  FinancialActionPlan,
  FinancialPlanningPriority,
  FinancialPlanningStrategy,
  FinancialPlanningStrategyInput,
  FinancialRecommendedAction,
} from './financialPlanningStrategy'

export const FINANCIAL_PLANNING_PROTOCOL_VERSION = 1 as const

export const FINANCIAL_PLANNING_PRIORITIES: readonly FinancialPlanningPriority[] = [
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'INFO',
] as const

export const FINANCIAL_PLANNING_IMPACTS = ['HIGH', 'MEDIUM', 'LOW'] as const

export type FinancialPlanningImpact = (typeof FINANCIAL_PLANNING_IMPACTS)[number]

export type {
  FinancialActionPlan,
  FinancialPlanningActionEffort,
  FinancialPlanningPriority,
  FinancialPlanningStrategy,
  FinancialPlanningStrategyInput,
  FinancialRecommendedAction,
} from './financialPlanningStrategy'

export interface FinancialPlanningRegistryRegisterSuccess {
  readonly kind: 'success'
  readonly strategy: FinancialPlanningStrategy
}

export interface FinancialPlanningRegistryRegisterFailure {
  readonly kind: 'failure'
  readonly code: 'INVALID_FINANCIAL_PLANNING_STRATEGY' | 'DUPLICATED_FINANCIAL_PLANNING_STRATEGY'
  readonly retryable: false
  readonly safeMessage: string
}

export type FinancialPlanningRegistryRegisterResult =
  | FinancialPlanningRegistryRegisterSuccess
  | FinancialPlanningRegistryRegisterFailure

export interface FinancialPlanningRegistry {
  register(strategy: FinancialPlanningStrategy): FinancialPlanningRegistryRegisterResult
  list(): readonly FinancialPlanningStrategy[]
  findById(strategyId: string): FinancialPlanningStrategy | null
  findSupporting(input: FinancialPlanningStrategyInput): readonly FinancialPlanningStrategy[]
}

export interface FinancialPlanningPrioritizerConfig {
  readonly maxActions: number
  readonly priorityOrder: readonly FinancialPlanningPriority[]
  readonly impactOrder: readonly FinancialPlanningImpact[]
}

export interface FinancialPlanningPrioritizer {
  prioritize(actions: readonly FinancialRecommendedAction[]): readonly FinancialRecommendedAction[]
}

export interface FinancialPlanningEngineInput {
  readonly sessionId: string
  readonly userMessage: string
  readonly requestedAt: string
  readonly executionPlan: FinancialConversationExecutionPlan
  readonly insights: readonly FinancialInsight[]
}

export interface FinancialPlanningEngineDependencies {
  readonly registry?: FinancialPlanningRegistry
  readonly prioritizer?: FinancialPlanningPrioritizer
  readonly now?: () => string
  readonly metrics?: {
    readonly record: (entry: {
      readonly strategyId: string
      readonly planId: string | null
      readonly actionCount: number
      readonly priority: FinancialPlanningPriority | null
      readonly durationMs: number
      readonly success: boolean
      readonly errorCode?: string
    }) => void
  }
}

export interface FinancialPlanningEngine {
  build(input: FinancialPlanningEngineInput): FinancialActionPlan | null
}
