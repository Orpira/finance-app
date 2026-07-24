import type {
  FinancialConversationSkill,
} from '../financialConversationSkill'

const SKILL_ID = 'goals-conversation-skill' as const
const TOOL_ID = 'financial_goals' as const

export function createGoalsConversationSkill(): FinancialConversationSkill {
  return {
    skillId: SKILL_ID,
    supportedIntents: ['goals'],
    supportedTools: [TOOL_ID],
    canHandle(input) {
      return input.activationDecision.intent === 'goals'
        || input.activationDecision.toolId === TOOL_ID
    },
    buildExecutionPlan(input) {
      return {
        skillId: SKILL_ID,
        activationDecision: input.activationDecision,
        requiredTools: input.activationDecision.requiresTool ? [TOOL_ID] : [],
        requiresAIExplanation: input.activationDecision.requiresAI,
        expectedOutput: 'GOALS_PROGRESS',
        executionPriority: 'NORMAL',
      }
    },
  }
}
