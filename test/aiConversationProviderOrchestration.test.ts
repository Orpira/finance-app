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
  createActivationEngine,
} from '../src/intelligence/ai-conversation/provider-orchestration/activationEngine'
import {
  createActivationPolicy,
} from '../src/intelligence/ai-conversation/provider-orchestration/activationPolicy'
import {
  createActivationEngineFromResolver,
} from '../src/intelligence/ai-conversation/provider-orchestration/activationFactory'
import {
  createInMemoryActivationMetricsRecorder,
} from '../src/intelligence/ai-conversation/provider-orchestration/activationMetrics'
import {
  validateActivationDecision,
  validateActivationPolicy,
  validateActivationRoutingStrategy,
} from '../src/intelligence/ai-conversation/provider-orchestration/activationValidator'
import {
  createAIConversationService,
} from '../src/intelligence/ai-conversation/provider-orchestration/aiConversationService'
import {
  createFinancialConversationSkillModule,
} from '../src/intelligence/ai-conversation/provider-orchestration/financialConversationFactory'
import {
  createFinancialConversationSkillRegistryStore,
} from '../src/intelligence/ai-conversation/provider-orchestration/financialConversationSkillRegistry'
import {
  createFinancialConversationSkillResolver,
} from '../src/intelligence/ai-conversation/provider-orchestration/financialConversationSkillResolver'
import {
  validateFinancialConversationExecutionPlan,
  validateFinancialConversationSkillRegistry,
} from '../src/intelligence/ai-conversation/provider-orchestration/financialConversationValidator'
import type {
  AIConversationServiceDependencies,
} from '../src/intelligence/ai-conversation/provider-orchestration/aiConversationContracts'

function createRequestFixture(userMessage: string): AIConversationRequest {
  return {
    protocolVersion: AI_CONVERSATION_ORCHESTRATOR_PROTOCOL_VERSION,
    executionId: 'conversation-orchestration:activation:test:001' as AIConversationRequest['executionId'],
    context: {
      executionId: 'execution:activation:test:001',
      conversationId: 'conversation:activation:test:001',
      sessionId: 'session:activation:test:001',
      providerId: 'ACTIVATION_TEST',
      model: 'provider-neutral',
      requestedAt: '2026-07-24T00:00:00.000Z',
      caller: 'SYSTEM',
    },
    steps: [
      {
        stepId: 'step-1',
        order: 1,
        toolId: 'financial_balance',
        arguments: {
          source: 'fixture',
          userMessage,
        },
      },
    ],
  }
}

function createConversationResponseFixture() {
  const promptContextResult = createPromptContextBuilder().build({
    executionResult: {
      executionId: 'conversation-orchestration:activation:execution:001' as AIConversationRequest['executionId'],
      startedAt: '2026-07-24T00:00:00.000Z',
      finishedAt: '2026-07-24T00:00:01.000Z',
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

function createFacadeFixture(): AIConversationFacade {
  return {
    async execute() {
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
  readonly failIntent?: boolean
  readonly throwIntent?: boolean
  readonly failGeneration?: boolean
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
      if (input.throwIntent) {
        throw new Error('timeout')
      }

      if (input.failIntent) {
        return {
          kind: 'failure',
          code: 'INTENT_RESOLUTION_FAILED',
          retryable: false,
          safeMessage: 'intent failed',
        }
      }

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
          timestamp: '2026-07-24T00:00:00.000Z',
        },
      }
    },

    async generateConversation(response) {
      if (input.failGeneration) {
        return {
          kind: 'failure',
          code: 'CONVERSATION_GENERATION_FAILED',
          retryable: false,
          safeMessage: 'generation failed',
        }
      }

      return {
        kind: 'success',
        message: {
          protocolVersion: 1,
          messageId: `${response.responseId}:message`,
          type: 'assistant',
          origin: 'MOCK_RENDERER',
          timestamp: '2026-07-24T00:00:00.000Z',
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
    confidence: 0.9,
    requiresAI: true,
    requiresTool: true,
    requiresExplanation: true,
    fallback: {
      used: false,
    },
    reason: 'fixture decision',
    intent: 'balance',
    ...input,
  }
}

function createTransactionsConversationResponseFixture(input: {
  readonly firstIncome: number
  readonly secondIncome: number
}) {
  const promptContextResult = createPromptContextBuilder().build({
    executionResult: {
      executionId: 'conversation-orchestration:activation:execution:transactions:001' as AIConversationRequest['executionId'],
      startedAt: '2026-07-24T00:00:00.000Z',
      finishedAt: '2026-07-24T00:00:01.000Z',
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
          toolId: 'financial_transactions',
          resolvedToolName: 'financial_transactions',
          execution: {
            toolName: 'financial_transactions',
            output: {
              summary: {
                currencyCode: 'USD',
                matchedCount: 2,
                incomeTotal: input.firstIncome + input.secondIncome,
                expenseTotal: 0,
                netTotal: input.firstIncome + input.secondIncome,
              },
              items: [
                {
                  transactionId: 'income-1',
                  kind: 'income',
                  date: '2026-07-20',
                  label: 'Ingreso 1',
                  amount: input.firstIncome,
                  currencyCode: 'USD',
                },
                {
                  transactionId: 'income-2',
                  kind: 'income',
                  date: '2026-07-10',
                  label: 'Ingreso 2',
                  amount: input.secondIncome,
                  currencyCode: 'USD',
                },
              ],
            },
            permission: 'read-only',
            durationMs: 2,
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

describe('PB-IS-014.5 Intelligent Conversation Activation Engine', () => {
  it('DIRECT_TOOL con confianza alta y tool existente', async () => {
    const metrics = createInMemoryActivationMetricsRecorder()
    const engine = createActivationEngine({
      primaryProviderId: 'openai-provider',
      fallbackProviderId: 'mock-ai-provider',
      primaryIntentResolver: createProviderFixture({ providerId: 'openai-provider', confidence: 0.95 }).resolveIntent,
      fallbackIntentResolver: createProviderFixture({ providerId: 'mock-ai-provider', confidence: 0.9 }).resolveIntent,
      routingStrategy: {
        exists(toolId: string) {
          return toolId === 'financial_balance'
        },
      },
      policy: createActivationPolicy({
        minimumConfidence: 0.7,
        enableDirectTools: true,
        enableAIExplanation: false,
      }),
      metrics: metrics.recorder,
      clock: (() => {
        let current = 0
        return () => {
          current += 25
          return current
        }
      })(),
    })

    const decision = await engine.decide({
      conversationRequest: createRequestFixture('cuanto dinero tengo'),
      userMessage: 'cuanto dinero tengo',
      turn: 1,
    })

    expect(decision.activationType).toBe('DIRECT_TOOL')
    expect(decision.requiresAI).toBe(false)
    expect(decision.requiresTool).toBe(true)
    expect(metrics.entries.length).toBe(1)
  })

  it('DIRECT_AI cuando no hay tool especializada', async () => {
    const engine = createActivationEngine({
      primaryProviderId: 'openai-provider',
      fallbackProviderId: 'mock-ai-provider',
      primaryIntentResolver: createProviderFixture({ providerId: 'openai-provider', confidence: 0.92 }).resolveIntent,
      fallbackIntentResolver: createProviderFixture({ providerId: 'mock-ai-provider', confidence: 0.9 }).resolveIntent,
      routingStrategy: {
        exists() {
          return false
        },
      },
      policy: createActivationPolicy(),
    })

    const decision = await engine.decide({
      conversationRequest: createRequestFixture('como puedo ahorrar mas?'),
      userMessage: 'como puedo ahorrar mas?',
      turn: 2,
    })

    expect(decision.activationType).toBe('DIRECT_AI')
    expect(decision.requiresAI).toBe(true)
    expect(decision.requiresTool).toBe(false)
  })

  it('TOOL_WITH_AI cuando hay explicacion habilitada', async () => {
    const engine = createActivationEngine({
      primaryProviderId: 'openai-provider',
      fallbackProviderId: 'mock-ai-provider',
      primaryIntentResolver: createProviderFixture({ providerId: 'openai-provider', confidence: 0.91 }).resolveIntent,
      fallbackIntentResolver: createProviderFixture({ providerId: 'mock-ai-provider', confidence: 0.9 }).resolveIntent,
      routingStrategy: {
        exists() {
          return true
        },
      },
      policy: createActivationPolicy({
        enableAIExplanation: true,
      }),
    })

    const decision = await engine.decide({
      conversationRequest: createRequestFixture('muestrame mis gastos y explicalos'),
      userMessage: 'muestrame mis gastos y explicalos',
      turn: 3,
    })

    expect(decision.activationType).toBe('TOOL_WITH_AI')
    expect(decision.requiresAI).toBe(true)
    expect(decision.requiresTool).toBe(true)
  })

  it('FALLBACK cuando falla provider primario o confianza es baja', async () => {
    const engine = createActivationEngine({
      primaryProviderId: 'openai-provider',
      fallbackProviderId: 'mock-ai-provider',
      primaryIntentResolver: createProviderFixture({ providerId: 'openai-provider', confidence: 0.2, failIntent: true }).resolveIntent,
      fallbackIntentResolver: createProviderFixture({ providerId: 'mock-ai-provider', confidence: 0.88 }).resolveIntent,
      routingStrategy: {
        exists() {
          return true
        },
      },
      policy: createActivationPolicy({
        minimumConfidence: 0.7,
        enableFallback: true,
      }),
    })

    const decision = await engine.decide({
      conversationRequest: createRequestFixture('fallback test'),
      userMessage: 'fallback test',
      turn: 4,
    })

    expect(decision.activationType).toBe('FALLBACK')
    expect(decision.fallback.used).toBe(true)
    expect(decision.provider).toBe('mock-ai-provider')
  })

  it('INVALID_REQUEST cuando la solicitud no es procesable', async () => {
    const engine = createActivationEngine({
      primaryProviderId: 'openai-provider',
      fallbackProviderId: 'mock-ai-provider',
      primaryIntentResolver: createProviderFixture({ providerId: 'openai-provider', confidence: 0.9 }).resolveIntent,
      fallbackIntentResolver: createProviderFixture({ providerId: 'mock-ai-provider', confidence: 0.9 }).resolveIntent,
      routingStrategy: {
        exists() {
          return true
        },
      },
      policy: createActivationPolicy(),
    })

    const decision = await engine.decide({
      conversationRequest: createRequestFixture(''),
      userMessage: '   ',
      turn: 5,
    })

    expect(decision.activationType).toBe('INVALID_REQUEST')
  })

  it('confidence alta/baja respeta la policy', async () => {
    const high = createActivationEngine({
      primaryProviderId: 'openai-provider',
      fallbackProviderId: 'mock-ai-provider',
      primaryIntentResolver: createProviderFixture({ providerId: 'openai-provider', confidence: 0.85 }).resolveIntent,
      fallbackIntentResolver: createProviderFixture({ providerId: 'mock-ai-provider', confidence: 0.9 }).resolveIntent,
      routingStrategy: { exists: () => true },
      policy: createActivationPolicy({ minimumConfidence: 0.7 }),
    })

    const low = createActivationEngine({
      primaryProviderId: 'openai-provider',
      fallbackProviderId: 'mock-ai-provider',
      primaryIntentResolver: createProviderFixture({ providerId: 'openai-provider', confidence: 0.2 }).resolveIntent,
      fallbackIntentResolver: createProviderFixture({ providerId: 'mock-ai-provider', confidence: 0.9, failIntent: true }).resolveIntent,
      routingStrategy: { exists: () => true },
      policy: createActivationPolicy({ minimumConfidence: 0.7, enableFallback: false }),
    })

    const highDecision = await high.decide({
      conversationRequest: createRequestFixture('high confidence'),
      userMessage: 'high confidence',
      turn: 6,
    })

    const lowDecision = await low.decide({
      conversationRequest: createRequestFixture('low confidence'),
      userMessage: 'low confidence',
      turn: 7,
    })

    expect(highDecision.activationType).not.toBe('INVALID_REQUEST')
    expect(lowDecision.activationType).toBe('INVALID_REQUEST')
  })

  it('validator, policy y routing strategy fail-closed', () => {
    expect(validateActivationPolicy(createActivationPolicy())).toBeNull()
    expect(validateActivationPolicy({ minimumConfidence: 2, enableFallback: true, enableAIExplanation: true, enableDirectTools: true })).not.toBeNull()

    expect(validateActivationRoutingStrategy({ exists: () => true })).toBeNull()
    expect(validateActivationRoutingStrategy({ exists: undefined as never })).not.toBeNull()

    const decision = createDecision({ activationType: 'DIRECT_TOOL', requiresAI: false, requiresTool: true })
    expect(validateActivationDecision(decision)).toBeNull()
    expect(validateActivationDecision(createDecision({ toolId: null, requiresTool: true }))).not.toBeNull()
  })

  it('factory crea engine configurable', async () => {
    const engine = createActivationEngineFromResolver({
      primaryProviderId: 'openai-provider',
      fallbackProviderId: 'mock-ai-provider',
      primaryIntentResolver: createProviderFixture({ providerId: 'openai-provider', confidence: 0.88 }).resolveIntent,
      fallbackIntentResolver: createProviderFixture({ providerId: 'mock-ai-provider', confidence: 0.9 }).resolveIntent,
      toolResolver: {
        resolve() {
          throw new Error('not used')
        },
        exists() {
          return true
        },
        listDefinitions() {
          return []
        },
      },
      policy: {
        minimumConfidence: 0.6,
      },
    })

    const decision = await engine.decide({
      conversationRequest: createRequestFixture('factory decision'),
      userMessage: 'factory decision',
      turn: 8,
    })

    expect(['DIRECT_TOOL', 'TOOL_WITH_AI', 'DIRECT_AI', 'FALLBACK', 'INVALID_REQUEST']).toContain(decision.activationType)
  })

  it('integracion completa: AI Conversation Service ejecuta la decision y no la construye', async () => {
    const activationEngine: ActivationEngine = {
      decide: vi.fn(async () => createDecision({
        activationType: 'DIRECT_TOOL',
        requiresAI: false,
        requiresTool: true,
        provider: 'openai-provider',
      })),
    }

    const provider = createProviderFixture({ providerId: 'openai-provider', confidence: 0.9, text: 'openai response' })
    provider.resolveIntent = vi.fn(async () => {
      throw new Error('should not be called by service when activation is injected')
    })

    const dependencies = {
      facade: createFacadeFixture(),
      provider,
      fallbackProvider: createProviderFixture({ providerId: 'mock-ai-provider', confidence: 0.9, text: 'mock response' }),
      confidencePolicy: { confidenceThreshold: 0.7 },
      activationEngine,
    } as AIConversationServiceDependencies & { readonly activationEngine: ActivationEngine }

    const service = createAIConversationService(dependencies)
    const result = await service.processConversation({
      conversationRequest: createRequestFixture('integracion activacion'),
      userMessage: 'integracion activacion',
      turn: 9,
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.execution.conversationGenerated).toBe(false)
      expect(result.message.text).toContain('determinista sin usar IA')
    }

    expect(activationEngine.decide).toHaveBeenCalledTimes(1)
    expect(provider.resolveIntent).not.toHaveBeenCalled()
  })

  it('AI Conversation Service incorpora insights proactivos solo como contexto del mensaje final', async () => {
    const activationEngine: ActivationEngine = {
      decide: vi.fn(async () => createDecision({
        activationType: 'TOOL_WITH_AI',
        requiresAI: true,
        requiresTool: true,
        provider: 'openai-provider',
        toolId: 'financial_balance',
      })),
    }

    const financialInsightEngine = {
      async evaluate() {
        return [
          {
            protocolVersion: 1 as const,
            insightId: 'insight:proactive:001',
            category: 'budget' as const,
            severity: 'HIGH' as const,
            priority: 'HIGH' as const,
            title: 'Gasto elevado',
            description: 'Los gastos muestran una tendencia alcista.',
            recommendation: 'Reduce gastos discrecionales para proteger el margen.',
            sourceTool: 'financial_insights',
            generatedAt: '2026-07-24T00:00:00.000Z',
          },
        ]
      },
    }

    const financialPlanningEngine = {
      build() {
        return {
          planId: 'plan:financial:001',
          createdAt: '2026-07-24T00:00:00.000Z',
          title: 'Plan financiero inteligente',
          summary: 'Consolidar ajustes para proteger flujo y mejorar ahorro.',
          objective: 'Mejorar estabilidad financiera',
          priority: 'HIGH' as const,
          estimatedImpact: 'HIGH' as const,
          recommendedActions: [
            {
              actionId: 'action:001',
              type: 'expense-reduction',
              description: 'Reducir gastos discrecionales de alta recurrencia.',
              expectedBenefit: 'Liberar liquidez para ahorro.',
              effort: 'LOW' as const,
              priority: 'HIGH' as const,
              affectedCategory: 'expense',
              relatedGoal: 'goal-1',
              requiresConfirmation: true,
            },
          ],
          relatedInsights: ['insight:proactive:001'],
          assumptions: ['Existen gastos ajustables'],
          warnings: ['Confirmar cambios con el usuario'],
        }
      },
    }

    const dependencies = {
      facade: createFacadeFixture(),
      provider: createProviderFixture({ providerId: 'openai-provider', confidence: 0.9, text: 'respuesta provider' }),
      fallbackProvider: createProviderFixture({ providerId: 'mock-ai-provider', confidence: 0.9, text: 'mock response' }),
      confidencePolicy: { confidenceThreshold: 0.7 },
      activationEngine,
      financialInsightEngine,
      financialPlanningEngine,
    } as AIConversationServiceDependencies & {
      readonly activationEngine: ActivationEngine
      readonly financialInsightEngine: typeof financialInsightEngine
      readonly financialPlanningEngine: typeof financialPlanningEngine
    }

    const service = createAIConversationService(dependencies)
    const result = await service.processConversation({
      conversationRequest: createRequestFixture('dame una recomendacion proactiva'),
      userMessage: 'dame una recomendacion proactiva',
      turn: 10,
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.message.text).toContain('Recomendaciones proactivas')
      expect(result.message.text).toContain('Reduce gastos discrecionales')
      expect(result.message.text).toContain('Plan financiero inteligente')
      expect(result.message.text).toContain('Acciones sugeridas')
    }
    expect(activationEngine.decide).toHaveBeenCalledTimes(1)
  })

  it('flujo E2E: Tool -> Context -> Prompt -> Provider -> Response usa datos reales y cambia segun resultados', async () => {
    const activationEngine: ActivationEngine = {
      decide: vi.fn(async () => createDecision({
        activationType: 'TOOL_WITH_AI',
        requiresAI: true,
        requiresTool: true,
        provider: 'openai-provider',
        toolId: 'financial_transactions',
        intent: 'transactions',
      })),
    }

    let selectedDataset: 'A' | 'B' = 'A'
    const facade = {
      async execute() {
        return {
          kind: 'success' as const,
          response: selectedDataset === 'A'
            ? createTransactionsConversationResponseFixture({ firstIncome: 2000, secondIncome: 1500 })
            : createTransactionsConversationResponseFixture({ firstIncome: 900, secondIncome: 700 }),
        }
      },
    }

    const provider = createProviderFixture({ providerId: 'openai-provider', confidence: 0.9, text: 'placeholder' })
    provider.generateConversation = vi.fn(async (response) => {
      const context = response.promptContext.metadata.attributes?.financialConversationContext
      expect(context).toBeDefined()

      const toolResults = (context as {
        readonly toolResults: readonly {
          readonly output: {
            readonly items: readonly { readonly amount: number }[]
          } | null
        }[]
      }).toolResults

      const items = toolResults[0]?.output?.items ?? []
      const incomeOne = items[0]?.amount ?? 0
      const incomeTwo = items[1]?.amount ?? 0

      return {
        kind: 'success' as const,
        message: {
          protocolVersion: 1,
          messageId: `${response.responseId}:message`,
          type: 'assistant' as const,
          origin: 'MOCK_RENDERER' as const,
          timestamp: '2026-07-24T00:00:00.000Z',
          text: `Comparacion de ingresos: ${incomeOne} vs ${incomeTwo}. Diferencia: ${incomeOne - incomeTwo}.`,
          responseId: response.responseId,
          conversationResponse: response,
          traceability: {
            executionId: response.execution.executionId,
            promptContextId: response.execution.promptContextId,
          },
        },
      }
    })

    const dependencies = {
      facade,
      provider,
      fallbackProvider: createProviderFixture({ providerId: 'mock-ai-provider', confidence: 0.9, text: 'mock response' }),
      confidencePolicy: { confidenceThreshold: 0.7 },
      activationEngine,
    } as AIConversationServiceDependencies & {
      readonly activationEngine: ActivationEngine
    }

    const service = createAIConversationService(dependencies)

    const first = await service.processConversation({
      conversationRequest: createRequestFixture('Compara mis dos ultimos ingresos'),
      userMessage: 'Compara mis dos ultimos ingresos',
      turn: 11,
    })

    selectedDataset = 'B'

    const second = await service.processConversation({
      conversationRequest: createRequestFixture('Compara mis dos ultimos ingresos'),
      userMessage: 'Compara mis dos ultimos ingresos',
      turn: 12,
    })

    expect(first.kind).toBe('success')
    expect(second.kind).toBe('success')

    if (first.kind === 'success' && second.kind === 'success') {
      expect(first.message.text).toContain('2000 vs 1500')
      expect(second.message.text).toContain('900 vs 700')
      expect(first.message.text).not.toBe(second.message.text)
    }

    expect(provider.generateConversation).toHaveBeenCalledTimes(2)
    expect(activationEngine.decide).toHaveBeenCalledTimes(2)
  })

  it('skill module default registra seis skills y valida registry', () => {
    const skillModule = createFinancialConversationSkillModule()
    const listed = skillModule.registry.list()

    expect(listed).toHaveLength(6)
    expect(validateFinancialConversationSkillRegistry(skillModule.registry)).toBeNull()
  })

  it('skill resolver crea execution plan valido para decision financiera', () => {
    const skillModule = createFinancialConversationSkillModule()
    const resolution = skillModule.resolver.resolve({
      activationDecision: createDecision({
        activationType: 'DIRECT_TOOL',
        requiresAI: false,
        requiresTool: true,
        toolId: 'financial_balance',
        intent: 'balance',
      }),
      userMessage: 'dime mi balance',
    })

    expect(resolution.kind).toBe('success')
    if (resolution.kind === 'success') {
      expect(resolution.skill.skillId).toBe('balance-conversation-skill')
      expect(resolution.plan.requiredTools).toEqual(['financial_balance'])
      expect(validateFinancialConversationExecutionPlan(resolution.plan)).toBeNull()
    }
  })

  it('skill resolver fail-closed cuando no existe skill compatible', () => {
    const emptyRegistry = createFinancialConversationSkillRegistryStore([])
    const resolver = createFinancialConversationSkillResolver(emptyRegistry)

    const resolution = resolver.resolve({
      activationDecision: createDecision({
        activationType: 'DIRECT_AI',
        requiresAI: true,
        requiresTool: false,
        toolId: null,
        intent: 'custom-unmapped-intent',
      }),
      userMessage: 'intent inventado',
    })

    expect(resolution.kind).toBe('failure')
    if (resolution.kind === 'failure') {
      expect(resolution.code).toBe('SKILL_NOT_FOUND')
    }
  })
})
