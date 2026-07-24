import type {
  FinancialConversationSkill,
} from '../financialConversationSkill'

const SKILL_ID = 'transactions-conversation-skill' as const
const TOOL_ID = 'financial_transactions' as const

export function createTransactionsConversationSkill(): FinancialConversationSkill {
  return {
    skillId: SKILL_ID,
    supportedIntents: ['transactions'],
    supportedTools: [TOOL_ID],
    canHandle(input) {
      return input.activationDecision.intent === 'transactions'
        || input.activationDecision.toolId === TOOL_ID
    },
    buildExecutionPlan(input) {
      return {
        skillId: SKILL_ID,
        activationDecision: input.activationDecision,
        requiredTools: input.activationDecision.requiresTool ? [TOOL_ID] : [],
        requiresAIExplanation: input.activationDecision.requiresAI,
        expectedOutput: 'TRANSACTIONS_SUMMARY',
        executionPriority: 'HIGH',
      }
    },
  }
}
