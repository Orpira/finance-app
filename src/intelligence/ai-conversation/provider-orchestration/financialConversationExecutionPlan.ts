import type {
  ActivationDecision,
} from './activationContracts'

export type FinancialConversationExecutionPriority = 'HIGH' | 'NORMAL' | 'LOW'

export interface FinancialConversationExecutionPlan {
  readonly skillId: string
  readonly activationDecision: ActivationDecision
  readonly requiredTools: readonly string[]
  readonly requiresAIExplanation: boolean
  readonly expectedOutput: string
  readonly executionPriority: FinancialConversationExecutionPriority
}
