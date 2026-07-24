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
  createMockAIProvider,
  type AIProvider,
} from '../src/intelligence/ai-provider/aiProvider'
import type {
  AIConversationFacade,
} from '../src/intelligence/ai-conversation/aiConversationFacadeContracts'
import {
  createConfiguredAIConversationService,
} from '../src/intelligence/ai-conversation/provider-orchestration/aiConversationFactory'
import {
  createInMemoryAIConversationMetricsRecorder,
} from '../src/intelligence/ai-conversation/provider-orchestration/aiConversationMetrics'
import {
  createAIConversationService,
} from '../src/intelligence/ai-conversation/provider-orchestration/aiConversationService'
import {
  validateAIConversationConfidencePolicy,
  validateAIConversationExecution,
  validateAIConversationFallback,
  validateAIConversationProviderIdentifier,
} from '../src/intelligence/ai-conversation/provider-orchestration/aiConversationValidator'

function createRequestFixture(userMessage: string): AIConversationRequest {
  return {
    protocolVersion: AI_CONVERSATION_ORCHESTRATOR_PROTOCOL_VERSION,
    executionId: 'conversation-orchestration:service:test:001' as AIConversationRequest['executionId'],
    context: {
      executionId: 'execution:service:test:001',
      conversationId: 'conversation:service:test:001',
      sessionId: 'session:service:test:001',
      providerId: 'SERVICE_TEST',
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
      executionId: 'conversation-orchestration:service:execution:001' as AIConversationRequest['executionId'],
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

describe('PB-IS-014.4 AI Conversation Service', () => {
  it('coordina provider OpenAI con confianza alta sin fallback', async () => {
    const metrics = createInMemoryAIConversationMetricsRecorder()
    const service = createAIConversationService({
      facade: createFacadeFixture(),
      provider: createProviderFixture({ providerId: 'openai-provider', confidence: 0.95, text: 'openai ok' }),
      fallbackProvider: createProviderFixture({ providerId: 'mock-ai-provider', confidence: 0.9, text: 'fallback' }),
      confidencePolicy: { confidenceThreshold: 0.7 },
      metrics: metrics.recorder,
      clock: () => 100,
    })

    const result = await service.processConversation({
      conversationRequest: createRequestFixture('quiero mi balance'),
      userMessage: 'quiero mi balance',
      turn: 1,
      requestedAt: '2026-07-24T00:00:00.000Z',
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.execution.provider).toBe('openai-provider')
      expect(result.execution.fallbackUsed).toBe(false)
      expect(result.execution.success).toBe(true)
      expect(result.message.text).toContain('openai ok')
    }

    expect(metrics.entries.length).toBe(1)
    expect(metrics.entries[0]?.provider).toBe('openai-provider')
  })

  it('coordina provider Mock cuando strategy es mock', async () => {
    const service = createAIConversationService({
      facade: createFacadeFixture(),
      provider: createMockAIProvider(),
      fallbackProvider: createMockAIProvider(),
      confidencePolicy: { confidenceThreshold: 0.5 },
    })

    const result = await service.processConversation({
      conversationRequest: createRequestFixture('necesito transacciones'),
      userMessage: 'necesito transacciones',
      turn: 1,
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.message.type).toBe('assistant')
    }
  })

  it('aplica fallback cuando confianza primaria es baja', async () => {
    const service = createAIConversationService({
      facade: createFacadeFixture(),
      provider: createProviderFixture({ providerId: 'openai-provider', confidence: 0.3, text: 'openai low' }),
      fallbackProvider: createProviderFixture({ providerId: 'mock-ai-provider', confidence: 0.9, text: 'fallback ok' }),
      confidencePolicy: { confidenceThreshold: 0.7 },
    })

    const result = await service.processConversation({
      conversationRequest: createRequestFixture('dame insights'),
      userMessage: 'dame insights',
      turn: 2,
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.execution.fallbackUsed).toBe(true)
      expect(result.execution.provider).toBe('mock-ai-provider')
      expect(result.message.text).toContain('fallback ok')
    }
  })

  it('maneja timeout como error controlado y usa fallback', async () => {
    const service = createAIConversationService({
      facade: createFacadeFixture(),
      provider: createProviderFixture({ providerId: 'openai-provider', confidence: 0.9, throwIntent: true }),
      fallbackProvider: createProviderFixture({ providerId: 'mock-ai-provider', confidence: 0.9, text: 'fallback after timeout' }),
      confidencePolicy: { confidenceThreshold: 0.7 },
    })

    const result = await service.processConversation({
      conversationRequest: createRequestFixture('timeout test'),
      userMessage: 'timeout test',
      turn: 3,
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.execution.fallbackUsed).toBe(true)
      expect(result.execution.provider).toBe('mock-ai-provider')
    }
  })

  it('devuelve error controlado cuando fallback tambien falla', async () => {
    const service = createAIConversationService({
      facade: createFacadeFixture(),
      provider: createProviderFixture({ providerId: 'openai-provider', confidence: 0.3, failIntent: true }),
      fallbackProvider: createProviderFixture({ providerId: 'mock-ai-provider', confidence: 0.9, failIntent: true }),
      confidencePolicy: { confidenceThreshold: 0.7 },
    })

    const result = await service.processConversation({
      conversationRequest: createRequestFixture('falla total'),
      userMessage: 'falla total',
      turn: 4,
    })

    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('INTENT_RESOLUTION_FAILED')
    }
  })

  it('registra metricas seguras sin prompts ni datos financieros', async () => {
    const metrics = createInMemoryAIConversationMetricsRecorder()
    const service = createAIConversationService({
      facade: createFacadeFixture(),
      provider: createProviderFixture({ providerId: 'openai-provider', confidence: 0.95 }),
      fallbackProvider: createProviderFixture({ providerId: 'mock-ai-provider', confidence: 0.9 }),
      confidencePolicy: { confidenceThreshold: 0.7 },
      metrics: metrics.recorder,
      clock: (() => {
        let current = 0
        return () => {
          current += 25
          return current
        }
      })(),
    })

    await service.processConversation({
      conversationRequest: createRequestFixture('metric test'),
      userMessage: 'metric test',
      turn: 5,
    })

    expect(metrics.entries.length).toBe(1)
    const metric = metrics.entries[0]
    expect(metric?.provider).toBe('openai-provider')
    expect(metric?.operation).toBe('process-conversation')
    expect(metric?.success).toBe(true)
    expect(JSON.stringify(metric)).not.toContain('metric test')
  })

  it('valida execution, confidence, provider y fallback', () => {
    expect(validateAIConversationConfidencePolicy({ confidenceThreshold: 0.7 })).toBeNull()
    expect(validateAIConversationConfidencePolicy({ confidenceThreshold: 1.5 })).not.toBeNull()

    expect(validateAIConversationProviderIdentifier('openai-provider')).toBeNull()
    expect(validateAIConversationProviderIdentifier('')).not.toBeNull()

    expect(validateAIConversationFallback('mock-ai-provider', true)).toBeNull()
    expect(validateAIConversationFallback('', true)).not.toBeNull()

    expect(validateAIConversationExecution({
      protocolVersion: 1,
      provider: 'openai-provider',
      intent: 'balance',
      confidence: 0.8,
      conversationGenerated: true,
      executionTime: 120,
      fallbackUsed: false,
      success: true,
      error: null,
    })).toBeNull()
  })

  it('factory crea servicio configurable y ejecuta integracion', async () => {
    const facade = createFacadeFixture()
    const service = createConfiguredAIConversationService({
      facade,
      providerInput: {
        strategy: 'mock',
      },
      confidenceThreshold: 0.6,
    })

    const result = await service.processConversation({
      conversationRequest: createRequestFixture('factory integration'),
      userMessage: 'factory integration',
      turn: 6,
    })

    expect(result.kind).toBe('success')
  })

  it('integra facade + service y mantiene contrato de salida estable', async () => {
    const facadeExecute = vi.fn(async () => ({
      kind: 'success' as const,
      response: createConversationResponseFixture(),
    }))

    const service = createAIConversationService({
      facade: {
        execute: facadeExecute,
      },
      provider: createProviderFixture({ providerId: 'openai-provider', confidence: 0.9 }),
      fallbackProvider: createProviderFixture({ providerId: 'mock-ai-provider', confidence: 0.9 }),
      confidencePolicy: { confidenceThreshold: 0.7 },
    })

    const result = await service.processConversation({
      conversationRequest: createRequestFixture('integration'),
      userMessage: 'integration',
      turn: 7,
    })

    expect(result.kind).toBe('success')
    expect(facadeExecute).toHaveBeenCalledTimes(1)
  })
})
