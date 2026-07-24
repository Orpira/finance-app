import {
  FINANCIAL_CONVERSATION_CONTEXT_PROTOCOL_VERSION,
  type FinancialConversationContext,
  type FinancialToolResultMapper,
} from './financialConversationContext'
import {
  validateFinancialConversationContext,
  validateFinancialToolResultMapper,
} from './financialConversationContextValidator'
import {
  createDefaultFinancialToolResultMapper,
} from './financialToolResultMapper'

export function createFinancialToolResultMapper(): FinancialToolResultMapper {
  const mapper = createDefaultFinancialToolResultMapper()
  const validation = validateFinancialToolResultMapper(mapper)
  if (validation !== null) {
    throw new Error(validation.safeMessage)
  }

  return mapper
}

export function createFinancialConversationContext(
  input: Omit<FinancialConversationContext, 'protocolVersion'>,
): FinancialConversationContext {
  const context: FinancialConversationContext = {
    protocolVersion: FINANCIAL_CONVERSATION_CONTEXT_PROTOCOL_VERSION,
    createdAt: input.createdAt,
    toolResults: structuredClone(input.toolResults),
    memory: input.memory === null ? null : structuredClone(input.memory),
    insights: structuredClone(input.insights),
    actionPlan: input.actionPlan === null ? null : structuredClone(input.actionPlan),
    userIntent: input.userIntent,
    executionPlan: structuredClone(input.executionPlan),
    activationDecision: structuredClone(input.activationDecision),
  }

  const validation = validateFinancialConversationContext(context)
  if (validation !== null) {
    throw new Error(validation.safeMessage)
  }

  return context
}
