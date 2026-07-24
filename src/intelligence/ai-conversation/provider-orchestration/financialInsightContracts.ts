import type {
  FinancialInsightsToolOutput,
  FinancialInsightsToolUseCase,
} from '../../ai-tools/financial/insightsTool'
import type {
  ConversationMemorySnapshot,
} from './conversationMemoryContracts'
import type {
  FinancialConversationExecutionPlan,
} from './financialConversationExecutionPlan'

export const FINANCIAL_INSIGHT_PROTOCOL_VERSION = 1 as const

export const FINANCIAL_INSIGHT_SEVERITIES = [
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'INFO',
] as const

export type FinancialInsightSeverity = (typeof FINANCIAL_INSIGHT_SEVERITIES)[number]

export type FinancialInsightPriority = FinancialInsightSeverity

export const FINANCIAL_INSIGHT_CATEGORIES = [
  'budget',
  'goal',
  'expense',
  'income',
  'subscription',
  'health',
] as const

export type FinancialInsightCategory = (typeof FINANCIAL_INSIGHT_CATEGORIES)[number]

export interface FinancialInsight {
  readonly protocolVersion: typeof FINANCIAL_INSIGHT_PROTOCOL_VERSION
  readonly insightId: string
  readonly category: FinancialInsightCategory
  readonly severity: FinancialInsightSeverity
  readonly priority: FinancialInsightPriority
  readonly title: string
  readonly description: string
  readonly recommendation: string
  readonly sourceTool: string
  readonly generatedAt: string
}

export interface FinancialInsightEvaluationInput {
  readonly sessionId: string
  readonly userMessage: string
  readonly requestedAt: string
  readonly plan: FinancialConversationExecutionPlan
  readonly snapshot: ConversationMemorySnapshot | null
  readonly report: FinancialInsightsToolOutput | null
}

export interface FinancialInsightEvaluator {
  readonly evaluatorId: string
  supports(input: FinancialInsightEvaluationInput): boolean
  evaluate(input: FinancialInsightEvaluationInput): Promise<readonly FinancialInsight[]>
}

export interface FinancialInsightRegistryRegisterSuccess {
  readonly kind: 'success'
  readonly evaluator: FinancialInsightEvaluator
}

export interface FinancialInsightRegistryRegisterFailure {
  readonly kind: 'failure'
  readonly code: 'INVALID_INSIGHT_EVALUATOR' | 'DUPLICATED_INSIGHT_EVALUATOR' | 'INVALID_INSIGHT_REGISTRY'
  readonly retryable: false
  readonly safeMessage: string
}

export type FinancialInsightRegistryRegisterResult =
  | FinancialInsightRegistryRegisterSuccess
  | FinancialInsightRegistryRegisterFailure

export interface FinancialInsightRegistry {
  register(evaluator: FinancialInsightEvaluator): FinancialInsightRegistryRegisterResult
  list(): readonly FinancialInsightEvaluator[]
  findById(evaluatorId: string): FinancialInsightEvaluator | null
  findSupporting(input: FinancialInsightEvaluationInput): readonly FinancialInsightEvaluator[]
}

export interface FinancialInsightPrioritizerConfig {
  readonly maxInsights: number
  readonly severityOrder: readonly FinancialInsightSeverity[]
  readonly priorityOrder: readonly FinancialInsightPriority[]
}

export interface FinancialInsightPrioritizer {
  prioritize(insights: readonly FinancialInsight[]): readonly FinancialInsight[]
}

export interface FinancialInsightEngineInput {
  readonly sessionId: string
  readonly userMessage: string
  readonly requestedAt: string
  readonly plan: FinancialConversationExecutionPlan
  readonly snapshot: ConversationMemorySnapshot | null
}

export interface FinancialInsightEngineDependencies {
  readonly financialInsightsToolUseCase?: FinancialInsightsToolUseCase
  readonly prioritizer?: FinancialInsightPrioritizer
  readonly registry?: FinancialInsightRegistry
  readonly now?: () => string
  readonly metrics?: {
    readonly record: (entry: {
      readonly evaluatorId: string
      readonly insightId: string | null
      readonly severity: FinancialInsightSeverity | null
      readonly durationMs: number
      readonly generatedCount: number
      readonly success: boolean
      readonly errorCode?: string
    }) => void
  }
}

export interface FinancialInsightEngine {
  evaluate(input: FinancialInsightEngineInput): Promise<readonly FinancialInsight[]>
}
