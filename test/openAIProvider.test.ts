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
  type OpenAIAdapter,
  type OpenAIAdapterTransport,
} from '../src/intelligence/ai-provider/aiProvider'
import { createAIToolRegistry, type AITool } from '../src/intelligence/ai-tools'
import type {
  AIConversationRequest,
} from '../src/intelligence/ai-conversation'

function createFakeTransactionsTool(): AITool {
  return {
    definition: {
      name: 'financial_transactions',
      description: 'Test transactions tool.',
      permission: 'read-only',
      deterministic: true,
      failClosed: true,
      inputSchema: {
        type: 'object',
        required: ['requestId', 'requestedAt'],
        properties: {
          requestId: { type: 'string' },
          requestedAt: { type: 'string' },
          filters: {
            type: 'object',
            properties: { kinds: { type: 'array', items: { type: 'string' } } },
            additionalProperties: false,
          },
          sort: {
            type: 'object',
            properties: { field: { type: 'string' }, direction: { type: 'string', enum: ['asc', 'desc'] } },
            additionalProperties: false,
          },
          limit: { type: 'number' },
        },
        additionalProperties: false,
      },
      outputSchema: { type: 'object' },
      tags: ['financial'],
    },
    async execute() {
      return {
        kind: 'success',
        value: { toolName: 'financial_transactions', output: {}, permission: 'read-only', durationMs: 1 },
      }
    },
  }
}

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

  it('detecta strategy openai usando la variable documentada VITE_AI_PROVIDER (PB-IS-015.7)', () => {
    // README.md, ADR-025 y .env/.env.local configuran VITE_AI_PROVIDER, no
    // VITE_AI_PROVIDER_STRATEGY. Este test certifica que el provider real se
    // activa con la variable que realmente se configura en runtime.
    const strategy = resolveAIProviderStrategyFromEnvironment({
      environment: {
        VITE_AI_PROVIDER: 'openai',
      },
    })

    expect(strategy).toBe('openai')
  })

  it('resuelve modelo y timeout desde las variables documentadas VITE_AI_OPENAI_MODEL / VITE_AI_OPENAI_TIMEOUT_MS (PB-IS-015.7)', () => {
    const result = resolveOpenAIProviderConfiguration({
      environment: {
        VITE_OPENAI_API_KEY: 'test-openai-key',
        VITE_AI_OPENAI_MODEL: 'gpt-5-mini',
        VITE_AI_OPENAI_TIMEOUT_MS: '30000',
      },
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.configuration.intentModel).toBe('gpt-5-mini')
      expect(result.configuration.conversationModel).toBe('gpt-5-mini')
      expect(result.configuration.timeoutMs).toBe(30000)
    }
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

  it('provider envia contexto financiero estructurado al adapter', async () => {
    let receivedPayload = ''
    const adapter: OpenAIAdapter = {
      async resolveIntent() {
        return {
          kind: 'failure',
          code: 'INTENT_RESOLUTION_FAILED',
          retryable: false,
          safeMessage: 'not used',
        }
      },
      async generateConversationText(responseJson: string) {
        receivedPayload = responseJson
        return {
          kind: 'success',
          text: 'respuesta estructurada',
        }
      },
    }

    const provider = createOpenAIProvider({
      adapter,
      environment: VALID_ENV,
    })

    const baseResponse = createConversationResponse()
    const responseWithFinancialContext = {
      ...baseResponse,
      promptContext: {
        ...baseResponse.promptContext,
        metadata: {
          ...baseResponse.promptContext.metadata,
          attributes: {
            financialConversationContext: {
              protocolVersion: 1,
              createdAt: '2026-07-24T00:00:00.000Z',
              userIntent: 'transactions',
              toolResults: [
                {
                  stepId: 'step-1',
                  order: 1,
                  toolId: 'financial_transactions',
                  kind: 'success',
                  durationMs: 1,
                  permission: 'read-only',
                  output: {
                    items: [
                      { amount: 2100 },
                      { amount: 1500 },
                    ],
                  },
                  error: null,
                },
              ],
              memory: null,
              insights: [],
              actionPlan: null,
              executionPlan: {
                skillId: 'transactions-conversation-skill',
              },
              activationDecision: {
                intent: 'transactions',
              },
            },
          },
        },
      },
    }

    const result = await provider.generateConversation(responseWithFinancialContext as never)
    expect(result.kind).toBe('success')

    const parsed = JSON.parse(receivedPayload) as {
      readonly financialContext: {
        readonly userIntent: string
        readonly toolResults: readonly { readonly toolId: string }[]
      } | null
      readonly toolSteps: readonly unknown[]
      readonly responseBlocks: readonly unknown[]
    }

    expect(parsed.financialContext).not.toBeNull()
    expect(parsed.financialContext?.userIntent).toBe('transactions')
    expect(parsed.financialContext?.toolResults[0]?.toolId).toBe('financial_transactions')
    expect(parsed.toolSteps.length).toBeGreaterThan(0)
    expect(parsed.responseBlocks.length).toBeGreaterThan(0)
  })
})

describe('Financial Copilot Orchestrator — schema-aware intent prompt (PB-IS-016.1)', () => {
  it('cuando se provee un toolRegistry, el prompt del sistema incluye el schema real de la tool', async () => {
    const registry = createAIToolRegistry([createFakeTransactionsTool()])
    const transport: OpenAIAdapterTransport = {
      createChatCompletion: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          detectedIntent: 'transactions',
          confidence: 0.9,
          toolId: 'financial_transactions',
          arguments: { filters: { kinds: ['income'] } },
          reasoning: 'test',
        }),
      }),
    }

    const configResult = resolveOpenAIProviderConfiguration({ environment: VALID_ENV })
    if (configResult.kind !== 'success') {
      throw new Error('Expected success configuration')
    }

    const adapter = createOpenAIAdapter({
      configuration: configResult.configuration,
      transport,
      toolRegistry: registry,
    })

    await adapter.resolveIntent(createIntentRequest('Compara mis dos ultimos ingresos'))

    const [[request]] = (transport.createChatCompletion as ReturnType<typeof vi.fn>).mock.calls
    const systemMessage = request.messages.find((message: { readonly role: string }) => message.role === 'system')
    expect(systemMessage.content).toContain('financial_transactions')
    expect(systemMessage.content).toContain('"additionalProperties":false')
    expect(systemMessage.content).not.toContain('transaction_type')
  })

  it('sin toolRegistry, usa el prompt de respaldo (compatibilidad retroactiva)', async () => {
    const transport: OpenAIAdapterTransport = {
      createChatCompletion: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          detectedIntent: 'balance',
          confidence: 0.9,
          toolId: 'financial_balance',
          arguments: {},
          reasoning: 'test',
        }),
      }),
    }

    const configResult = resolveOpenAIProviderConfiguration({ environment: VALID_ENV })
    if (configResult.kind !== 'success') {
      throw new Error('Expected success configuration')
    }

    const adapter = createOpenAIAdapter({ configuration: configResult.configuration, transport })
    await adapter.resolveIntent(createIntentRequest('Cual es mi balance'))

    const [[request]] = (transport.createChatCompletion as ReturnType<typeof vi.fn>).mock.calls
    const systemMessage = request.messages.find((message: { readonly role: string }) => message.role === 'system')
    expect(systemMessage.content).toContain('Allowed toolId: financial_balance')
  })

  it('parsea un toolPlan de multiples tools cuando el modelo lo devuelve', async () => {
    const transport: OpenAIAdapterTransport = {
      createChatCompletion: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          detectedIntent: 'reports',
          confidence: 0.85,
          toolId: 'financial_reports',
          arguments: {},
          reasoning: 'Pregunta compuesta: reportes + insights',
          toolPlan: [
            { toolId: 'financial_reports', arguments: {} },
            { toolId: 'financial_insights', arguments: {} },
          ],
        }),
      }),
    }

    const configResult = resolveOpenAIProviderConfiguration({ environment: VALID_ENV })
    if (configResult.kind !== 'success') {
      throw new Error('Expected success configuration')
    }

    const adapter = createOpenAIAdapter({ configuration: configResult.configuration, transport })
    const result = await adapter.resolveIntent(
      createIntentRequest('Estoy ahorrando mas este mes y cuanto podria invertir?'),
    )

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.resolution.tools).toHaveLength(2)
      expect(result.resolution.tools.map((tool) => tool.toolId)).toEqual([
        'financial_reports',
        'financial_insights',
      ])
    }
  })

  it('un toolPlan de una sola entrada se ignora y se usa el toolId/arguments unico (compatibilidad)', async () => {
    const transport: OpenAIAdapterTransport = {
      createChatCompletion: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          detectedIntent: 'balance',
          confidence: 0.9,
          toolId: 'financial_balance',
          arguments: { currency: 'EUR' },
          reasoning: 'test',
          toolPlan: [{ toolId: 'financial_balance', arguments: { currency: 'EUR' } }],
        }),
      }),
    }

    const configResult = resolveOpenAIProviderConfiguration({ environment: VALID_ENV })
    if (configResult.kind !== 'success') {
      throw new Error('Expected success configuration')
    }

    const adapter = createOpenAIAdapter({ configuration: configResult.configuration, transport })
    const result = await adapter.resolveIntent(createIntentRequest('Cual es mi balance'))

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.resolution.tools).toHaveLength(1)
      expect(result.resolution.tools[0]?.toolId).toBe('financial_balance')
    }
  })
})
