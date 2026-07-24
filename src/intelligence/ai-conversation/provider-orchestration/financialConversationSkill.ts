import type {
  ActivationDecision,
} from './activationContracts'
import type {
  FinancialConversationExecutionPlan,
} from './financialConversationExecutionPlan'

export interface FinancialConversationSkillContext {
  readonly activationDecision: ActivationDecision
  readonly userMessage: string
}

export interface FinancialConversationSkill {
  readonly skillId: string
  readonly supportedIntents: readonly string[]
  readonly supportedTools: readonly string[]
  canHandle(input: FinancialConversationSkillContext): boolean
  buildExecutionPlan(input: FinancialConversationSkillContext): FinancialConversationExecutionPlan
}
