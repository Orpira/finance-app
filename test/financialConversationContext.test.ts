import { describe, expect, it } from 'vitest'

import type {
  ActivationDecision,
} from '../src/intelligence/ai-conversation/provider-orchestration/activationContracts'
import type {
  FinancialConversationExecutionPlan,
} from '../src/intelligence/ai-conversation/provider-orchestration/financialConversationExecutionPlan'
import {
  createFinancialConversationContext,
  createFinancialToolResultMapper,
} from '../src/intelligence/ai-conversation/provider-orchestration/financialConversationContextFactory'
import {
  validateFinancialConversationContext,
  validateFinancialToolResultMapper,
} from '../src/intelligence/ai-conversation/provider-orchestration/financialConversationContextValidator'

function createDecision(): ActivationDecision {
  return {
    protocolVersion: 1,
    activationType: 'TOOL_WITH_AI',
    provider: 'openai-provider',
    toolId: 'financial_transactions',
    confidence: 0.9,
    requiresAI: true,
    requiresTool: true,
    requiresExplanation: true,
    fallback: { used: false },
    reason: 'fixture',
    intent: 'transactions',
    toolArguments: {
      limit: 2,
      kinds: ['income'],
    },
  }
}

function createPlan(): FinancialConversationExecutionPlan {
  return {
    skillId: 'transactions-conversation-skill',
    activationDecision: createDecision(),
    requiredTools: ['financial_transactions'],
    requiresAIExplanation: true,
    expectedOutput: 'TRANSACTIONS_SUMMARY',
    executionPriority: 'HIGH',
    context: {
      activePeriod: { from: '2026-07-01', to: '2026-07-31' },
      activeCategory: 'income',
    },
  }
}

describe('PB-IS-015.5 Financial Conversation Context', () => {
  it('mapper transforma steps de tools en contexto estructurado serializable', () => {
    const mapper = createFinancialToolResultMapper()

    const mapped = mapper.map({
      steps: [
        {
          kind: 'success',
          stepId: 'step-1',
          order: 1,
          toolId: 'financial_transactions',
          resolvedToolName: 'financial_transactions',
          permission: 'read-only',
          durationMs: 5,
          output: {
            summary: {
              incomeTotal: 3500,
            },
            items: [
              { label: 'Salario A', amount: 2000 },
              { label: 'Salario B', amount: 1500 },
            ],
          },
        },
        {
          kind: 'failure',
          stepId: 'step-2',
          order: 2,
          toolId: 'financial_missing',
          error: {
            kind: 'failure',
            code: 'TOOL_NOT_FOUND',
            retryable: false,
            safeMessage: 'not found',
          },
        },
      ],
    })

    expect(mapped).toHaveLength(2)
    expect(mapped[0]?.kind).toBe('success')
    expect(mapped[1]?.kind).toBe('failure')
    expect(JSON.parse(JSON.stringify(mapped))).toHaveLength(2)
  })

  it('factory crea FinancialConversationContext válido fail-closed', () => {
    const mapper = createFinancialToolResultMapper()
    const toolResults = mapper.map({
      steps: [
        {
          kind: 'success',
          stepId: 'step-1',
          order: 1,
          toolId: 'financial_transactions',
          resolvedToolName: 'financial_transactions',
          permission: 'read-only',
          durationMs: 5,
          output: {
            summary: {
              incomeTotal: 3500,
            },
            items: [
              { label: 'Salario A', amount: 2000 },
              { label: 'Salario B', amount: 1500 },
            ],
          },
        },
      ],
    })

    const context = createFinancialConversationContext({
      createdAt: '2026-07-24T00:00:00.000Z',
      toolResults,
      memory: {
        protocolVersion: 1,
        sessionId: 'session:test:0155',
        lastIntent: 'transactions',
        lastSkill: 'transactions-conversation-skill',
        lastTool: 'financial_transactions',
        lastPeriod: { from: '2026-07-01', to: '2026-07-31' },
        lastCategory: 'income',
        lastAccount: null,
        lastGoal: null,
        referencedEntities: [],
        conversationTimestamp: '2026-07-24T00:00:00.000Z',
      },
      insights: [],
      actionPlan: null,
      userIntent: 'transactions',
      executionPlan: createPlan(),
      activationDecision: createDecision(),
    })

    expect(validateFinancialConversationContext(context)).toBeNull()
    expect(context.toolResults[0]?.toolId).toBe('financial_transactions')
  })

  it('validator detecta contratos inválidos de mapper/context', () => {
    expect(validateFinancialToolResultMapper(createFinancialToolResultMapper())).toBeNull()
    expect(validateFinancialToolResultMapper({} as never)).not.toBeNull()
    expect(validateFinancialConversationContext({} as never)).not.toBeNull()
  })
})
