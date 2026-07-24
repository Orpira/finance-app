import type {
  FinancialConversationSkill,
} from '../financialConversationSkill'

const SKILL_ID = 'budget-conversation-skill' as const
const TOOL_ID = 'financial_budget' as const

export function createBudgetConversationSkill(): FinancialConversationSkill {
  return {
    skillId: SKILL_ID,
    supportedIntents: ['budget'],
    supportedTools: [TOOL_ID],
    canHandle(input) {
      return input.activationDecision.intent === 'budget'
        || input.activationDecision.toolId === TOOL_ID
    },
    buildExecutionPlan(input) {
      return {
        skillId: SKILL_ID,
        activationDecision: input.activationDecision,
        requiredTools: input.activationDecision.requiresTool ? [TOOL_ID] : [],
        requiresAIExplanation: input.activationDecision.requiresAI,
        expectedOutput: 'BUDGET_STATUS',
        executionPriority: 'NORMAL',
      }
    },
  }
}
