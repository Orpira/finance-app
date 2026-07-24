import type {
  FinancialConversationSkill,
} from '../financialConversationSkill'

const SKILL_ID = 'insights-conversation-skill' as const
const TOOL_ID = 'financial_insights' as const

export function createInsightsConversationSkill(): FinancialConversationSkill {
  return {
    skillId: SKILL_ID,
    supportedIntents: ['insights', 'unknown'],
    supportedTools: [TOOL_ID],
    canHandle(input) {
      return input.activationDecision.intent === 'insights'
        || input.activationDecision.intent === 'unknown'
        || input.activationDecision.toolId === TOOL_ID
    },
    buildExecutionPlan(input) {
      return {
        skillId: SKILL_ID,
        activationDecision: input.activationDecision,
        requiredTools: input.activationDecision.requiresTool ? [TOOL_ID] : [],
        requiresAIExplanation: input.activationDecision.requiresAI,
        expectedOutput: 'INSIGHTS_EXPLANATION',
        executionPriority: 'LOW',
      }
    },
  }
}
