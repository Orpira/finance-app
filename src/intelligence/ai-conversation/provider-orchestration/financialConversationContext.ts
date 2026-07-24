import type {
  AIToolJsonValue,
} from '../../ai-tools'
import type {
  PromptContextStep,
} from '../../prompt-context-builder'
import type {
  ActivationDecision,
} from './activationContracts'
import type {
  ConversationMemorySnapshot,
} from './conversationMemoryContracts'
import type {
  FinancialConversationExecutionPlan,
} from './financialConversationExecutionPlan'
import type {
  FinancialInsight,
} from './financialInsightContracts'
import type {
  FinancialActionPlan,
} from './financialPlanningContracts'

export const FINANCIAL_CONVERSATION_CONTEXT_PROTOCOL_VERSION = 1 as const

export interface FinancialMappedToolResultFailure {
  readonly code: string
  readonly safeMessage: string
}

export interface FinancialMappedToolResult {
  readonly stepId: string
  readonly order: number
  readonly toolId: string
  readonly kind: 'success' | 'failure'
  readonly durationMs: number | null
  readonly permission: string | null
  readonly output: AIToolJsonValue | null
  readonly error: FinancialMappedToolResultFailure | null
}

export interface FinancialToolResultMapperInput {
  readonly steps: readonly PromptContextStep[]
}

export interface FinancialToolResultMapper {
  readonly mapperId: string
  map(input: FinancialToolResultMapperInput): readonly FinancialMappedToolResult[]
}

export interface FinancialConversationContext {
  readonly protocolVersion: typeof FINANCIAL_CONVERSATION_CONTEXT_PROTOCOL_VERSION
  readonly createdAt: string
  readonly toolResults: readonly FinancialMappedToolResult[]
  readonly memory: ConversationMemorySnapshot | null
  readonly insights: readonly FinancialInsight[]
  readonly actionPlan: FinancialActionPlan | null
  readonly userIntent: string
  readonly executionPlan: FinancialConversationExecutionPlan
  readonly activationDecision: ActivationDecision
}
