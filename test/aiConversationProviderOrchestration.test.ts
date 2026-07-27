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
                currencyCode: 'EUR',
                incomeTotal: 5000,
                expenseTotal: 800,
                adjustmentTotal: 0,
                netBalance: 4200,
                hasData: true,
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
      // PB-IS-016.1-R1: la ruta DIRECT_TOOL construye la respuesta a partir
      // del payload real de la Tool (financialDirectResponseBuilder), sin
      // texto tecnico hardcodeado por toolId.
      expect(result.message.text).toContain('balance neto de 4.200,00 EUR')
      expect(result.message.text).not.toContain('determinista')
      expect(result.message.text).not.toContain('DIRECT_TOOL')
    }

    expect(activationEngine.decide).toHaveBeenCalledTimes(1)
    expect(provider.resolveIntent).not.toHaveBeenCalled()
  })

  it('PB-IS-016.2-R3: una consulta DIRECT_TOOL sin intencion de comparar NO se secuestra por el mensaje fijo de "dos ultimos ingresos" aunque el resultado tenga 2 ingresos', async () => {
    // Bug real demostrado con runtime en navegador (Chrome/Brave headless
    // contra Vite + IndexedDB reales): createIncomeComparisonMessage se
    // invocaba sin verificar detectCompareLatestIncomeIntent(userMessage),
    // por lo que CUALQUIER financial_transactions con >=2 ingresos devolvia
    // "Comparacion de tus dos ultimos ingresos..." sin importar la pregunta
    // real (p. ej. "cuantos ingresos obtuve ayer"). Los tests unitarios de
    // financialDirectResponseBuilder.ts (aislados) no cubrian esta ruta de
    // aiConversationService.ts, por lo que pasaban en verde mientras el
    // navegador real seguia respondiendo mal.
    const activationEngine: ActivationEngine = {
      decide: vi.fn(async () => createDecision({
        activationType: 'DIRECT_TOOL',
        requiresAI: false,
        requiresTool: true,
        provider: 'mock-ai-provider',
        toolId: 'financial_transactions',
        intent: 'transactions',
      })),
    }

    const facade: AIConversationFacade = {
      async execute() {
        return {
          kind: 'success',
          response: createTransactionsConversationResponseFixture({ firstIncome: 5250, secondIncome: 84 }),
        }
      },
    }

    const dependencies = {
      facade,
      provider: createProviderFixture({ providerId: 'mock-ai-provider', confidence: 0.9, text: 'mock response' }),
      fallbackProvider: createProviderFixture({ providerId: 'mock-ai-provider', confidence: 0.9, text: 'mock response' }),
      confidencePolicy: { confidenceThreshold: 0.7 },
      activationEngine,
    } as AIConversationServiceDependencies & { readonly activationEngine: ActivationEngine }

    const service = createAIConversationService(dependencies)
    const result = await service.processConversation({
      conversationRequest: createRequestFixture('¿Cuántos ingresos obtuve ayer?'),
      userMessage: '¿Cuántos ingresos obtuve ayer?',
      turn: 12,
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.message.text).not.toContain('Comparación de tus dos últimos ingresos')
      expect(result.message.text).toContain('2 ingresos')
    }
  })

  it('PB-IS-016.2-R3: el filters.period que llega a la Tool siempre lo calcula el Resolver determinista, aunque el proveedor primario (ej. OpenAI real) resuelva una fecha alucinada', async () => {
    // Bug real demostrado con runtime en un dispositivo del usuario con
    // VITE_AI_PROVIDER=openai activo (no reproducible con el proveedor mock
    // usado en el resto de los tests, ni en fixtures aisladas): con OpenAI
    // como resolver primario de intencion (conversationComposition.ts), el
    // filters.period que genera puede ser una fecha alucinada -- valida
    // contra el schema, por lo que la reparacion de PB-IS-016.1 no la
    // detecta -- que no corresponde a "ayer"/"hoy" reales. La Tool entonces
    // consulta la fecha equivocada y devuelve 0 resultados aunque la UI
    // muestre datos reales para "ayer". Este test simula exactamente eso:
    // el "proveedor primario" (Activation Engine decision) resuelve un
    // periodo alucinado (2024-05-31) para un mensaje que dice "ayer".
    const originalTz = process.env.TZ
    process.env.TZ = 'UTC'
    try {
      const activationEngine: ActivationEngine = {
        decide: vi.fn(async () => createDecision({
          activationType: 'DIRECT_TOOL',
          requiresAI: false,
          requiresTool: true,
          provider: 'openai-provider',
          toolId: 'financial_transactions',
          intent: 'transactions',
          toolArguments: {
            filters: {
              period: { from: '2024-05-31', to: '2024-05-31' },
              kinds: ['income'],
            },
          },
        })),
      }

      let capturedRequest: AIConversationRequest | undefined
      const facade: AIConversationFacade = {
        async execute(request) {
          capturedRequest = request
          return {
            kind: 'success',
            response: createTransactionsConversationResponseFixture({ firstIncome: 100, secondIncome: 50 }),
          }
        },
      }

      const dependencies = {
        facade,
        provider: createProviderFixture({ providerId: 'openai-provider', confidence: 0.9, text: 'openai response' }),
        fallbackProvider: createProviderFixture({ providerId: 'mock-ai-provider', confidence: 0.9, text: 'mock response' }),
        confidencePolicy: { confidenceThreshold: 0.7 },
        activationEngine,
      } as AIConversationServiceDependencies & { readonly activationEngine: ActivationEngine }

      const service = createAIConversationService(dependencies)
      const result = await service.processConversation({
        conversationRequest: createRequestFixture('¿Cuánto ingresé ayer?'),
        userMessage: '¿Cuánto ingresé ayer?',
        turn: 13,
        requestedAt: '2026-07-24T00:00:00.000Z',
      })

      expect(result.kind).toBe('success')
      expect(capturedRequest).toBeDefined()
      const sentArguments = capturedRequest?.steps[0]?.arguments as {
        readonly filters?: { readonly period?: { readonly from?: string; readonly to?: string }; readonly kinds?: readonly string[] }
      }
      // "ayer" relativo a requestedAt=2026-07-24 es 2026-07-23: el Resolver
      // determinista debe imponer esta fecha, descartando la alucinada.
      expect(sentArguments.filters?.period).toEqual({ from: '2026-07-23', to: '2026-07-23' })
      // El resto de los argumentos que resolvio el proveedor primario (kinds)
      // se conservan sin tocar.
      expect(sentArguments.filters?.kinds).toEqual(['income'])
    } finally {
      process.env.TZ = originalTz
    }
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

  it('Relevance Policy (PB-IS-016.2): una consulta puntual de balance NO anexa Insights ni Planning aunque los motores los generen', async () => {
    const activationEngine: ActivationEngine = {
      decide: vi.fn(async () => createDecision({
        activationType: 'DIRECT_TOOL',
        requiresAI: false,
        requiresTool: true,
        provider: 'mock-ai-provider',
        toolId: 'financial_balance',
      })),
    }

    const financialInsightEngine = {
      async evaluate() {
        return [
          {
            protocolVersion: 1 as const,
            insightId: 'insight:proactive:002',
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
          planId: 'plan:financial:002',
          createdAt: '2026-07-24T00:00:00.000Z',
          title: 'Plan financiero inteligente',
          summary: 'Consolidar ajustes para proteger flujo y mejorar ahorro.',
          objective: 'Mejorar estabilidad financiera',
          priority: 'HIGH' as const,
          estimatedImpact: 'HIGH' as const,
          recommendedActions: [
            {
              actionId: 'action:002',
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
          relatedInsights: ['insight:proactive:002'],
          assumptions: ['Existen gastos ajustables'],
          warnings: ['Confirmar cambios con el usuario'],
        }
      },
    }

    const dependencies = {
      facade: createFacadeFixture(),
      provider: createProviderFixture({ providerId: 'mock-ai-provider', confidence: 0.9, text: 'respuesta provider' }),
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
      conversationRequest: createRequestFixture('¿Cuál fue mi balance hoy?'),
      userMessage: '¿Cuál fue mi balance hoy?',
      turn: 11,
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      // La respuesta determinista (Builder) sigue funcionando con datos reales...
      expect(result.message.text).toContain('balance neto de 4.200,00 EUR')
      // ...pero Insights y Planning NO se anexan: la consulta es puntual,
      // no pide una evaluacion de la situacion financiera (DA-0162-03).
      expect(result.message.text).not.toContain('Recomendaciones proactivas')
      expect(result.message.text).not.toContain('Plan financiero inteligente')
    }
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

describe('PB-IS-017.1 Personal Financial Copilot Foundation', () => {
  function createGoalFixtureDependencies() {
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
            insightId: 'insight:budget:001',
            category: 'budget' as const,
            severity: 'HIGH' as const,
            priority: 'HIGH' as const,
            title: 'Gasto elevado',
            description: 'Los gastos muestran una tendencia alcista.',
            recommendation: 'Reduce gastos discrecionales para proteger el margen.',
            sourceTool: 'financial_insights',
            generatedAt: '2026-07-24T00:00:00.000Z',
          },
          {
            protocolVersion: 1 as const,
            insightId: 'insight:income:001',
            category: 'income' as const,
            severity: 'HIGH' as const,
            priority: 'HIGH' as const,
            title: 'Ingreso estable',
            description: 'Tus ingresos se han mantenido estables.',
            recommendation: 'Mantén tu fuente de ingresos actual.',
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
              relatedGoal: null,
              requiresConfirmation: false,
            },
          ],
          relatedInsights: ['insight:budget:001'],
          assumptions: ['Existen gastos ajustables'],
          warnings: [],
        }
      },
    }

    return {
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
  }

  it('continuidad conversacional: mantiene el objetivo activo, hace seguimiento y luego prioriza recomendaciones', async () => {
    // Reproduce el ejemplo de Runtime de la especificacion (seccion 23):
    // "Quiero ahorrar." -> "Mi objetivo son 500 € al mes." -> "¿Qué me
    // recomiendas?", sobre la MISMA instancia de servicio (misma sesion,
    // ya que createRequestFixture usa siempre el mismo sessionId fijo) para
    // demostrar que el Goal persiste entre turnos sin volver a preguntarse
    // por informacion ya conocida.
    const service = createAIConversationService(createGoalFixtureDependencies())

    const turn1 = await service.processConversation({
      conversationRequest: createRequestFixture('Quiero ahorrar.'),
      userMessage: 'Quiero ahorrar.',
      turn: 1,
    })
    expect(turn1.kind).toBe('success')
    if (turn1.kind === 'success') {
      expect(turn1.message.text).toContain('¿Tienes una meta mensual de ahorro?')
    }

    const turn2 = await service.processConversation({
      conversationRequest: createRequestFixture('Mi objetivo son 500 € al mes.'),
      userMessage: 'Mi objetivo son 500 € al mes.',
      turn: 2,
    })
    expect(turn2.kind).toBe('success')
    if (turn2.kind === 'success') {
      // Ya no debe repetir la misma pregunta: el campo ya quedo informado.
      expect(turn2.message.text).not.toContain('¿Tienes una meta mensual de ahorro?')
    }

    const turn3 = await service.processConversation({
      conversationRequest: createRequestFixture('¿Qué me recomiendas?'),
      userMessage: '¿Qué me recomiendas?',
      turn: 3,
    })
    expect(turn3.kind).toBe('success')
    if (turn3.kind === 'success') {
      expect(turn3.message.text).not.toContain('¿Tienes una meta mensual de ahorro?')
      expect(turn3.message.text).toContain('Recomendaciones proactivas')
      // El insight de categoria "budget" (alineado con el objetivo de
      // ahorro, seccion 9-11) debe anteponerse al de categoria "income".
      const budgetIndex = turn3.message.text.indexOf('Gasto elevado')
      const incomeIndex = turn3.message.text.indexOf('Ingreso estable')
      expect(budgetIndex).toBeGreaterThanOrEqual(0)
      expect(incomeIndex).toBeGreaterThanOrEqual(0)
      expect(budgetIndex).toBeLessThan(incomeIndex)
    }
  })

  it('integracion con Planning e Insights: el Financial Copilot nunca recalcula datos, solo reordena lo ya generado', async () => {
    const service = createAIConversationService(createGoalFixtureDependencies())

    const result = await service.processConversation({
      conversationRequest: createRequestFixture('Quiero reducir gastos, ¿qué me recomiendas?'),
      userMessage: 'Quiero reducir gastos, ¿qué me recomiendas?',
      turn: 1,
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      // Los mismos textos certificados de Insight/Planning Engine, sin
      // alterar montos ni descripciones.
      expect(result.message.text).toContain('Gasto elevado: Reduce gastos discrecionales para proteger el margen.')
      expect(result.message.text).toContain('Plan financiero inteligente: Consolidar ajustes para proteger flujo y mejorar ahorro.')
      expect(result.message.text).toContain('Reducir gastos discrecionales de alta recurrencia.')
    }
  })

  it('ausencia de persistencia en IndexedDB: dos instancias de servicio (misma composicion) no comparten el Goal de la otra', async () => {
    const serviceA = createAIConversationService(createGoalFixtureDependencies())
    const serviceB = createAIConversationService(createGoalFixtureDependencies())

    await serviceA.processConversation({
      conversationRequest: createRequestFixture('Quiero ahorrar.'),
      userMessage: 'Quiero ahorrar.',
      turn: 1,
    })

    const resultB = await serviceB.processConversation({
      conversationRequest: createRequestFixture('¿Qué me recomiendas?'),
      userMessage: '¿Qué me recomiendas?',
      turn: 1,
    })

    // serviceB nunca vio "Quiero ahorrar.": si el Goal estuviera persistido
    // en algun almacen compartido (Dexie u otro), apareceria aqui tambien.
    expect(resultB.kind).toBe('success')
    if (resultB.kind === 'success') {
      expect(resultB.message.text).not.toContain('¿Tienes una meta mensual de ahorro?')
    }
  })
})
