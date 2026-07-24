import { describe, expect, it, vi } from 'vitest'

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
  createAIProvider,
  createOpenAIAdapter,
  createOpenAIProvider,
  resolveAIProviderStrategyFromEnvironment,
  resolveOpenAIProviderConfiguration,
  validateOpenAIProviderConfiguration,
  type OpenAIAdapterTransport,
} from '../src/intelligence/ai-provider/aiProvider'
import type {
  AIConversationRequest,
} from '../src/intelligence/ai-conversation'

function createIntentRequest(message: string): {
  readonly protocolVersion: 1
  readonly conversationRequest: AIConversationRequest
  readonly metadata: {
    readonly userMessage: string
    readonly turn: number
    readonly requestedAt: string
  }
} {
  const requestedAt = '2026-01-01T00:00:00.000Z'

  return {
    protocolVersion: 1,
    conversationRequest: {
      protocolVersion: AI_CONVERSATION_ORCHESTRATOR_PROTOCOL_VERSION,
      executionId: 'conversation-orchestration:openai-provider:test:001' as AIConversationRequest['executionId'],
      context: {
        executionId: 'execution:openai-provider:test:001',
        conversationId: 'conversation:openai-provider:test:001',
        sessionId: 'session:openai-provider:test:001',
        providerId: 'OPENAI_PROVIDER',
        model: 'gpt-4o-mini',
        requestedAt,
        caller: 'SYSTEM',
      },
      steps: [
        {
          stepId: 'step-1',
          order: 1,
          toolId: 'financial_balance',
          arguments: {
            currency: 'EUR',
          },
        },
      ],
    },
    metadata: {
      userMessage: message,
      turn: 1,
      requestedAt,
    },
  }
}

function createConversationResponse() {
  const promptContext = createPromptContextBuilder().build({
    executionResult: {
      executionId: 'conversation-orchestration:openai-provider:execution:001' as AIConversationRequest['executionId'],
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: '2026-01-01T00:00:01.000Z',
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
                netBalance: 1250,
              },
            },
            permission: 'read-only',
            durationMs: 1,
          },
        },
      ],
    },
  })

  if (promptContext.kind !== 'success') {
    throw new Error('Expected prompt context fixture')
  }

  const responseResult = createConversationResponseComposer().build({
    promptContext: promptContext.context,
  })

  if (responseResult.kind !== 'success') {
    throw new Error('Expected response fixture')
  }

  return responseResult.response
}

const VALID_ENV = {
  VITE_OPENAI_API_KEY: 'test-openai-key',
  VITE_OPENAI_INTENT_MODEL: 'gpt-4o-mini',
  VITE_OPENAI_CONVERSATION_MODEL: 'gpt-4o-mini',
  VITE_OPENAI_TIMEOUT_MS: '2000',
  VITE_OPENAI_RETRY_COUNT: '1',
  VITE_OPENAI_TEMPERATURE: '0.2',
  VITE_OPENAI_MAX_TOKENS: '250',
} as const

describe('PB-IS-014.3 OpenAI Provider Adapter', () => {
  it('resuelve configuración válida desde environment', () => {
    const result = resolveOpenAIProviderConfiguration({
      environment: VALID_ENV,
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.configuration.providerId).toBe('openai-provider')
      expect(result.configuration.retryCount).toBe(1)
    }
  })

  it('falla si falta API key', () => {
    const result = resolveOpenAIProviderConfiguration({
      environment: {
        VITE_OPENAI_TIMEOUT_MS: '2000',
      },
    })

    expect(result.kind).toBe('failure')
  })

  it('detecta strategy openai por environment', () => {
    const strategy = resolveAIProviderStrategyFromEnvironment({
      environment: {
        VITE_AI_PROVIDER_STRATEGY: 'openai',
      },
    })

    expect(strategy).toBe('openai')
  })

  it('reintenta en error transitorio y resuelve intent', async () => {
    const transport: OpenAIAdapterTransport = {
      createChatCompletion: vi
        .fn()
        .mockRejectedValueOnce(Object.assign(new Error('rate limit'), { status: 429 }))
        .mockResolvedValueOnce({
          content: JSON.stringify({
            detectedIntent: 'balance',
            confidence: 0.91,
            toolId: 'financial_balance',
            arguments: { currency: 'EUR' },
            reasoning: 'User asks for current balance',
          }),
        }),
    }

    const configResult = resolveOpenAIProviderConfiguration({
      environment: VALID_ENV,
    })
    expect(configResult.kind).toBe('success')
    if (configResult.kind !== 'success') {
      return
    }

    const adapter = createOpenAIAdapter({
      configuration: configResult.configuration,
      transport,
      now: () => '2026-01-01T00:00:00.000Z',
      logger: () => undefined,
    })

    const result = await adapter.resolveIntent(createIntentRequest('¿Cuál es mi balance actual?'))
    expect(result.kind).toBe('success')
    expect(transport.createChatCompletion).toHaveBeenCalledTimes(2)
  })

  it('falla closed si timeout sin respuesta', async () => {
    const transport: OpenAIAdapterTransport = {
      createChatCompletion: vi
        .fn()
        .mockImplementation(() => new Promise(() => undefined)),
    }

    const configResult = resolveOpenAIProviderConfiguration({
      environment: {
        ...VALID_ENV,
        VITE_OPENAI_TIMEOUT_MS: '50',
      },
    })

    expect(configResult.kind).toBe('failure')

    const safeConfigResult = resolveOpenAIProviderConfiguration({
      environment: VALID_ENV,
    })
    expect(safeConfigResult.kind).toBe('success')
    if (safeConfigResult.kind !== 'success') {
      return
    }

    const adapter = createOpenAIAdapter({
      configuration: {
        ...safeConfigResult.configuration,
        timeoutMs: 10,
        retryCount: 0,
      },
      transport,
      logger: () => undefined,
    })

    const result = await adapter.resolveIntent(createIntentRequest('Necesito un resumen'))
    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('INTENT_RESOLUTION_FAILED')
    }
  })

  it('genera conversación desde OpenAI adapter', async () => {
    const transport: OpenAIAdapterTransport = {
      createChatCompletion: vi.fn().mockResolvedValue({
        content: 'Tu balance actual es 1.250 EUR.',
      }),
    }

    const configResult = resolveOpenAIProviderConfiguration({
      environment: VALID_ENV,
    })
    expect(configResult.kind).toBe('success')
    if (configResult.kind !== 'success') {
      return
    }

    const adapter = createOpenAIAdapter({
      configuration: configResult.configuration,
      transport,
      now: () => '2026-01-01T00:00:00.000Z',
      logger: () => undefined,
    })

    const result = await adapter.generateConversationText(JSON.stringify(createConversationResponse()))
    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.text).toContain('balance actual')
    }
  })

  it('provider openai falla closed sin api key', async () => {
    const provider = createOpenAIProvider({
      environment: {
        VITE_AI_PROVIDER_STRATEGY: 'openai',
      },
    })

    const intentResult = await provider.resolveIntent(createIntentRequest('balance'))
    expect(intentResult.kind).toBe('failure')

    const conversationResult = await provider.generateConversation(createConversationResponse())
    expect(conversationResult.kind).toBe('failure')
  })

  it('factory selecciona openai cuando strategy=openai', () => {
    const provider = createAIProvider({
      strategy: 'openai',
      environment: {
        ...VALID_ENV,
      },
    })

    const metadata = provider.metadata
    expect(metadata.providerId).toBe('openai-provider')

    const validation = validateOpenAIProviderConfiguration({
      providerId: 'openai-provider',
      apiKey: 'k',
      intentModel: 'gpt-4o-mini',
      conversationModel: 'gpt-4o-mini',
      timeoutMs: 2000,
      retryCount: 1,
      temperature: 0.2,
      maxTokens: 100,
    })
    expect(validation).toBeNull()
  })
})
