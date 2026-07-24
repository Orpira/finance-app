import type {
  FinancialConversationSkill,
} from '../financialConversationSkill'

const SKILL_ID = 'reports-conversation-skill' as const
const TOOL_ID = 'financial_reports' as const

export function createReportsConversationSkill(): FinancialConversationSkill {
  return {
    skillId: SKILL_ID,
    supportedIntents: ['reports'],
    supportedTools: [TOOL_ID],
    canHandle(input) {
      return input.activationDecision.intent === 'reports'
        || input.activationDecision.toolId === TOOL_ID
    },
    buildExecutionPlan(input) {
      return {
        skillId: SKILL_ID,
        activationDecision: input.activationDecision,
        requiredTools: input.activationDecision.requiresTool ? [TOOL_ID] : [],
        requiresAIExplanation: input.activationDecision.requiresAI,
        expectedOutput: 'REPORTS_OVERVIEW',
        executionPriority: 'LOW',
      }
    },
  }
}
