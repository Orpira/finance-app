import { describe, expect, it, vi } from 'vitest'

import type {
  AIConversationRequest,
} from '../src/intelligence/ai-conversation'
import {
  AI_CONVERSATION_ORCHESTRATOR_PROTOCOL_VERSION,
} from '../src/intelligence/conversation-orchestrator'
import {
  createPromptContextBuilder,
} from '../src/intelligence/prompt-context-builder'
import {
  createConversationResponseComposer,
} from '../src/intelligence/response-composer'
import {
  AI_PROVIDER_PROTOCOL_VERSION,
  type AIProvider,
} from '../src/intelligence/ai-provider/aiProvider'
import type {
  AIConversationFacade,
} from '../src/intelligence/ai-conversation/aiConversationFacadeContracts'
import type {
  ActivationEngine,
  ActivationDecision,
} from '../src/intelligence/ai-conversation/provider-orchestration/activationContracts'
import {
  createAIConversationService,
} from '../src/intelligence/ai-conversation/provider-orchestration/aiConversationService'
import {
  createConversationContextResolver,
  createConversationMemory,
  createConversationMemoryFactoryStore,
} from '../src/intelligence/ai-conversation/provider-orchestration/conversationMemoryFactory'
import {
  createConversationMemorySnapshot,
} from '../src/intelligence/ai-conversation/provider-orchestration/conversationMemorySnapshot'
import {
  createFinancialConversationSkillModule,
} from '../src/intelligence/ai-conversation/provider-orchestration/financialConversationFactory'
import {
  validateConversationContextResolver,
  validateConversationMemorySnapshot,
  validateConversationMemoryStore,
} from '../src/intelligence/ai-conversation/provider-orchestration/conversationMemoryValidator'
import type {
  AIConversationServiceDependencies,
} from '../src/intelligence/ai-conversation/provider-orchestration/aiConversationContracts'

function createRequestFixture(input: {
  readonly userMessage: string
  readonly sessionId?: string
}): AIConversationRequest {
  return {
    protocolVersion: AI_CONVERSATION_ORCHESTRATOR_PROTOCOL_VERSION,
    executionId: 'conversation-orchestration:memory:test:001' as AIConversationRequest['executionId'],
    context: {
      executionId: 'execution:memory:test:001',
      conversationId: 'conversation:memory:test:001',
      sessionId: input.sessionId ?? 'session:memory:test:001',
      providerId: 'MEMORY_TEST',
      model: 'provider-neutral',
      requestedAt: '2026-07-24T10:00:00.000Z',
      caller: 'SYSTEM',
    },
    steps: [
      {
        stepId: 'step-1',
        order: 1,
        toolId: 'financial_balance',
        arguments: {
          source: 'fixture',
          userMessage: input.userMessage,
        },
      },
    ],
  }
}

function createConversationResponseFixture() {
  const promptContextResult = createPromptContextBuilder().build({
    executionResult: {
      executionId: 'conversation-orchestration:memory:execution:001' as AIConversationRequest['executionId'],
      startedAt: '2026-07-24T10:00:00.000Z',
      finishedAt: '2026-07-24T10:00:01.000Z',
      status: 'success',
      summary: {
        totalSteps: 1,
        successfulSteps: 1,
        failedSteps: 0,
      },
      steps: [
        {
          kind: 'success',
          stepId: 'step-1',
          order: 1,
          toolId: 'financial_balance',
          resolvedToolName: 'financial_balance',
          execution: {
            toolName: 'financial_balance',
            output: {
              summary: {
                netBalance: 4200,
              },
            },
            permission: 'read-only',
            durationMs: 1,
          },
        },
      ],
    },
  })

  if (promptContextResult.kind !== 'success') {
    throw new Error('Expected prompt context fixture')
  }

  const responseResult = createConversationResponseComposer().build({
    promptContext: promptContextResult.context,
  })

  if (responseResult.kind !== 'success') {
    throw new Error('Expected response fixture')
  }

  return responseResult.response
}

function createFacadeFixture(execute?: AIConversationFacade['execute']): AIConversationFacade {
  return {
    async execute(request) {
      if (execute !== undefined) {
        return execute(request)
      }

      return {
        kind: 'success',
        response: createConversationResponseFixture(),
      }
    },
  }
}

function createProviderFixture(input: {
  readonly providerId: string
  readonly confidence: number
  readonly intent?: 'balance' | 'transactions' | 'budget' | 'goals' | 'reports' | 'insights' | 'unknown'
  readonly text?: string
}): AIProvider {
  return {
    metadata: {
      protocolVersion: AI_PROVIDER_PROTOCOL_VERSION,
      providerId: input.providerId,
      providerName: `${input.providerId} provider`,
      providerVersion: '1.0.0',
      capabilities: ['INTENT_RESOLUTION', 'CONVERSATION_GENERATION'],
    },
    async resolveIntent() {
      return {
        kind: 'success',
        resolution: {
          protocolVersion: 1,
          detectedIntent: input.intent ?? 'balance',
          confidence: input.confidence,
          tools: [
            {
              toolId: 'financial_balance',
              arguments: {},
            },
          ],
          reasoning: 'fixture reasoning',
          provider: input.providerId,
          timestamp: '2026-07-24T10:00:00.000Z',
        },
      }
    },
    async generateConversation(response) {
      return {
        kind: 'success',
        message: {
          protocolVersion: 1,
          messageId: `${response.responseId}:message`,
          type: 'assistant',
          origin: 'MOCK_RENDERER',
          timestamp: '2026-07-24T10:00:00.000Z',
          text: input.text ?? 'respuesta provider',
          responseId: response.responseId,
          conversationResponse: response,
          traceability: {
            executionId: response.execution.executionId,
            promptContextId: response.execution.promptContextId,
          },
        },
      }
    },
  }
}

function createDecision(input: Partial<ActivationDecision>): ActivationDecision {
  return {
    protocolVersion: 1,
    activationType: 'TOOL_WITH_AI',
    provider: 'openai-provider',
    toolId: 'financial_balance',
    confidence: 0.91,
    requiresAI: false,
    requiresTool: true,
    requiresExplanation: false,
    fallback: {
      used: false,
    },
    reason: 'fixture decision',
    intent: 'balance',
    ...input,
  }
}

describe('PB-IS-015.2 Contextual Conversation Memory', () => {
  it('crea snapshot serializable minimo', () => {
    const snapshot = createConversationMemorySnapshot({
      sessionId: 'session:memory:test:001',
      conversationTimestamp: '2026-07-24T10:00:00.000Z',
      lastIntent: 'balance',
      lastSkill: 'balance-conversation-skill',
      lastTool: 'financial_balance',
      lastPeriod: {
        from: '2026-07-01',
        to: '2026-07-31',
      },
      lastGoal: 'goal-001',
      referencedEntities: [{ entityType: 'goal', entityId: 'goal-001' }],
    })

    expect(validateConversationMemorySnapshot(snapshot)).toBeNull()
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
  })

  it('store permite guardar, recuperar, expirar y limpiar por sesion', () => {
    const store = createConversationMemoryFactoryStore({
      expirationWindowMs: 30 * 60 * 1000,
    })

    const snapshot = createConversationMemorySnapshot({
      sessionId: 'session:memory:test:exp',
      conversationTimestamp: '2026-07-24T10:00:00.000Z',
      lastIntent: 'reports',
      lastSkill: 'reports-conversation-skill',
      lastTool: 'financial_reports',
    })

    store.saveSnapshot(snapshot)

    expect(store.getSnapshot('session:memory:test:exp', '2026-07-24T10:29:59.000Z')).toEqual(snapshot)
    expect(store.getSnapshot('session:memory:test:exp', '2026-07-24T10:31:00.000Z')).toBeNull()

    store.saveSnapshot(snapshot)
    store.clearSession('session:memory:test:exp')
    expect(store.getSnapshot('session:memory:test:exp', '2026-07-24T10:10:00.000Z')).toBeNull()
  })

  it('memory actualiza contexto reutilizable desde plan ejecutado', () => {
    const memory = createConversationMemory()

    const stored = memory.remember({
      sessionId: 'session:memory:test:update',
      userMessage: 'Muestrame la meta ahorro casa de este mes',
      requestedAt: '2026-07-24T10:00:00.000Z',
      plan: {
        skillId: 'goals-conversation-skill',
        activationDecision: {
          intent: 'goals',
          toolId: 'financial_goals',
          toolArguments: {
            filters: {
              goalIds: ['goal-casa'],
              period: {
                from: '2026-07-01',
                to: '2026-07-31',
              },
            },
          },
        },
        context: {
          activeGoal: 'goal-casa',
        },
      },
    })

    expect(stored.lastGoal).toBe('goal-casa')
    expect(stored.lastPeriod).toEqual({
      from: '2026-07-01',
      to: '2026-07-31',
    })
    expect(memory.getSnapshot('session:memory:test:update', '2026-07-24T10:05:00.000Z')).toEqual(stored)
  })

  it('resolver enriquece referencias, periodos y entidades sin decidir flujo', () => {
    const memory = createConversationMemory()
    memory.remember({
      sessionId: 'session:memory:test:resolver',
      userMessage: 'Resumen de mi meta casa del mes pasado',
      requestedAt: '2026-07-24T10:00:00.000Z',
      plan: {
        skillId: 'goals-conversation-skill',
        activationDecision: {
          intent: 'goals',
          toolId: 'financial_goals',
          toolArguments: {
            filters: {
              goalIds: ['goal-casa'],
              period: {
                from: '2026-06-01',
                to: '2026-06-30',
              },
            },
          },
        },
      },
    })

    const resolver = createConversationContextResolver()
    const enrichment = resolver.enrich({
      request: createRequestFixture({
        userMessage: 'Compáralo con el mes pasado y esa meta',
        sessionId: 'session:memory:test:resolver',
      }),
      userMessage: 'Compáralo con el mes pasado y esa meta',
      plan: {
        skillId: 'goals-conversation-skill',
        activationDecision: {
          toolId: 'financial_goals',
          toolArguments: {},
        },
        requiredTools: ['financial_goals'],
      },
      snapshot: memory.getSnapshot('session:memory:test:resolver', '2026-07-24T10:05:00.000Z'),
    })

    expect(enrichment.referencesResolved.length).toBeGreaterThan(0)
    expect(enrichment.periodResolved).toBe(true)
    expect(enrichment.entitiesResolved).toContain('meta')
    expect(enrichment.toolArgumentsPatch).toEqual({
      filters: {
        goalIds: ['goal-casa'],
        period: {
          from: '2026-06-01',
          to: '2026-06-30',
        },
      },
    })
  })

  it('validator fail-closed para snapshot, store y resolver', () => {
    const invalidSnapshot = {
      protocolVersion: 99,
      sessionId: '',
      lastIntent: null,
      lastSkill: null,
      lastTool: null,
      lastPeriod: null,
      lastCategory: null,
      lastAccount: null,
      lastGoal: null,
      referencedEntities: [],
      conversationTimestamp: '',
    }

    expect(validateConversationMemorySnapshot(invalidSnapshot as never)).not.toBeNull()
    expect(validateConversationMemoryStore(createConversationMemoryFactoryStore())).toBeNull()
    expect(validateConversationMemoryStore({} as never)).not.toBeNull()
    expect(validateConversationContextResolver(createConversationContextResolver())).toBeNull()
    expect(validateConversationContextResolver({} as never)).not.toBeNull()
  })

  it('integracion completa enriquece el execution plan y conserva Activation Engine + AI Conversation Service', async () => {
    const activationEngine: ActivationEngine = {
      decide: vi.fn(async () => createDecision({
        toolId: 'financial_goals',
        intent: 'goals',
      })),
    }

    const skillModule = createFinancialConversationSkillModule()
    const memory = createConversationMemory()
    memory.remember({
      sessionId: 'session:memory:test:integration',
      userMessage: 'Muestrame la meta casa del mes pasado',
      requestedAt: '2026-07-24T10:00:00.000Z',
      plan: {
        skillId: 'goals-conversation-skill',
        activationDecision: {
          intent: 'goals',
          toolId: 'financial_goals',
          toolArguments: {
            filters: {
              goalIds: ['goal-casa'],
              period: {
                from: '2026-06-01',
                to: '2026-06-30',
              },
            },
          },
        },
      },
    })

    const executeSpy = vi.fn(async (request: AIConversationRequest) => {
      expect(request.context.sessionId).toBe('session:memory:test:integration')
      expect(request.steps[0]?.toolId).toBe('financial_goals')
      expect(request.steps[0]?.arguments).toEqual({
        filters: {
          goalIds: ['goal-casa'],
          period: {
            from: '2026-06-01',
            to: '2026-06-30',
          },
        },
      })

      return {
        kind: 'success',
        response: createConversationResponseFixture(),
      }
    })

    const dependencies = {
      facade: createFacadeFixture(executeSpy),
      provider: createProviderFixture({ providerId: 'openai-provider', confidence: 0.9, intent: 'goals' }),
      fallbackProvider: createProviderFixture({ providerId: 'mock-ai-provider', confidence: 0.9, intent: 'goals' }),
      confidencePolicy: { confidenceThreshold: 0.7 },
      activationEngine,
      skillResolver: skillModule.resolver,
      conversationMemory: memory,
      conversationContextResolver: createConversationContextResolver(),
    } as AIConversationServiceDependencies & {
      readonly activationEngine: ActivationEngine
      readonly skillResolver: typeof skillModule.resolver
      readonly conversationMemory: typeof memory
      readonly conversationContextResolver: ReturnType<typeof createConversationContextResolver>
    }

    const service = createAIConversationService(dependencies)
    const result = await service.processConversation({
      conversationRequest: createRequestFixture({
        userMessage: 'Compáralo con el mes pasado y esa meta',
        sessionId: 'session:memory:test:integration',
      }),
      userMessage: 'Compáralo con el mes pasado y esa meta',
      turn: 2,
      requestedAt: '2026-07-24T10:05:00.000Z',
    })

    expect(result.kind).toBe('success')
    expect(activationEngine.decide).toHaveBeenCalledTimes(1)
    expect(executeSpy).toHaveBeenCalledTimes(1)

    const updatedSnapshot = memory.getSnapshot('session:memory:test:integration', '2026-07-24T10:06:00.000Z')
    expect(updatedSnapshot?.lastTool).toBe('financial_goals')
    expect(updatedSnapshot?.lastGoal).toBe('goal-casa')
  })
})