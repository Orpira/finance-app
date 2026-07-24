import type {
  FinancialConversationSkill,
} from '../financialConversationSkill'

const SKILL_ID = 'balance-conversation-skill' as const
const TOOL_ID = 'financial_balance' as const

export function createBalanceConversationSkill(): FinancialConversationSkill {
  return {
    skillId: SKILL_ID,
    supportedIntents: ['balance'],
    supportedTools: [TOOL_ID],
    canHandle(input) {
      return input.activationDecision.intent === 'balance'
        || input.activationDecision.toolId === TOOL_ID
    },
    buildExecutionPlan(input) {
      return {
        skillId: SKILL_ID,
        activationDecision: input.activationDecision,
        requiredTools: input.activationDecision.requiresTool ? [TOOL_ID] : [],
        requiresAIExplanation: input.activationDecision.requiresAI,
        expectedOutput: 'BALANCE_SUMMARY',
        executionPriority: 'HIGH',
      }
    },
  }
}
