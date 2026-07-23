import {
  AIInteractionPolicyEngine,
  AIInteractionPolicyRegistry,
  createDeterministicInteractionPolicy,
} from '../../intelligence/ai-interaction/policies'
import {
  createAIConversationService,
  type AIConversationService,
} from '../../intelligence/ai-conversation/service'
import {
  createAIExecutionInspector,
  type AIExecutionTrace,
} from '../../intelligence/execution-inspector'
import {
  createAIToolExecutor,
  createAIToolRegistry,
  createPingTool,
  type AIToolExecutor,
} from '../../intelligence/ai-tools'
import {
  createDeterministicKnowledgeSearchEngine,
  createFixedWindowChunkingStrategy,
  createKnowledgeIndexer,
  createKnowledgeSearchAITool,
  createKnowledgeSearchToolUseCase,
} from '../knowledge'
import {
  createOpenAIProviderAdapter,
  createProvider,
  type AIProvider,
  type AIProviderAdapter,
  type OpenAIChatCompletionsResponse,
  type OpenAITransport,
} from '../../intelligence/provider'
import {
  getAutomationGatewayConfig,
} from '../../services/automationHubService'
import { LocalConversationRepository } from '../../database/localConversationRepository'
import { LocalKnowledgeRepository } from '../../database/localKnowledgeRepository'
import {
  createAIConversationApplicationService,
  createConversationExecutionPipeline,
} from './aiConversationApplicationService'
import type {
  AIConversationApplicationService,
} from './aiConversationApplicationContracts'

const DEFAULT_OPENAI_PROXY_API_KEY = 'server-proxy'
const DEFAULT_MODEL_FALLBACK = 'unconfigured-model'
const DEFAULT_TIMEOUT_MS = 10_000
const MIN_TIMEOUT_MS = 1_000
const MAX_TIMEOUT_MS = 30_000

interface ProductionConversationProviderConfig {
  readonly available: boolean
  readonly providerId: 'OPENAI'
  readonly model: string
  readonly timeoutMs: number
  readonly safeErrorMessage?: string
}

function parseTimeout(rawValue: unknown): number | null {
  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    return DEFAULT_TIMEOUT_MS
  }

  const parsed = Number(rawValue)
  if (!Number.isSafeInteger(parsed) || parsed < MIN_TIMEOUT_MS || parsed > MAX_TIMEOUT_MS) {
    return null
  }

  return parsed
}

function resolveProductionConversationProviderConfig(): ProductionConversationProviderConfig {
  const provider = typeof import.meta.env.VITE_AI_PROVIDER === 'string'
    ? import.meta.env.VITE_AI_PROVIDER.trim().toUpperCase()
    : ''
  const model = typeof import.meta.env.VITE_AI_OPENAI_MODEL === 'string'
    ? import.meta.env.VITE_AI_OPENAI_MODEL.trim()
    : ''
  const timeoutMs = parseTimeout(import.meta.env.VITE_AI_OPENAI_TIMEOUT_MS)

  if (provider !== 'OPENAI') {
    return {
      available: false,
      providerId: 'OPENAI',
      model: model || DEFAULT_MODEL_FALLBACK,
      timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT_MS,
      safeErrorMessage: 'El proveedor de IA no está configurado o no está permitido.',
    }
  }

  if (!model) {
    return {
      available: false,
      providerId: 'OPENAI',
      model: DEFAULT_MODEL_FALLBACK,
      timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT_MS,
      safeErrorMessage: 'Falta configurar el modelo de IA para producción.',
    }
  }

  if (timeoutMs === null) {
    return {
      available: false,
      providerId: 'OPENAI',
      model,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      safeErrorMessage: 'El timeout configurado para IA no es válido.',
    }
  }

  return {
    available: true,
    providerId: 'OPENAI',
    model,
    timeoutMs,
  }
}

function createPolicyEngine() {
  const policy = createDeterministicInteractionPolicy({
    policyId: 'conversation-preview',
    policyVersion: '1.0.0',
    allowedIntents: ['EDUCATIONAL_GUIDANCE'],
    allowedCapabilities: ['TEXT_GENERATION'],
    allowedProcessingModes: ['LOCAL_ONLY'],
    requireAuthorizedContext: false,
    requireUserConfirmation: false,
    requireRedactionForSensitiveData: false,
    featureAvailable: true,
  })

  return new AIInteractionPolicyEngine(
    new AIInteractionPolicyRegistry([policy]),
  )
}

function createOpenAIProxyTransport(): OpenAITransport {
  return {
    async execute(input) {
      const gateway = await getAutomationGatewayConfig()
      const startedAt = Date.now()
      const response = await fetch(`${gateway.baseUrl}/api/ai-provider-openai`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${gateway.bearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerId: 'OPENAI',
          model: input.payload.model,
          messages: input.payload.messages,
          ...(input.payload.temperature === undefined ? {} : { temperature: input.payload.temperature }),
          ...(input.payload.max_tokens === undefined ? {} : { max_tokens: input.payload.max_tokens }),
          ...(input.payload.response_format === undefined
            ? {}
            : { response_format: input.payload.response_format }),
          ...(input.timeoutMs === undefined ? {} : { timeoutMs: input.timeoutMs }),
        }),
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      })

      if (!response.ok) {
        let payload: Record<string, unknown> | undefined
        try {
          payload = await response.json() as Record<string, unknown>
        } catch {
          payload = undefined
        }

        const error = new Error(
          typeof payload?.error === 'string'
            ? payload.error
            : 'No se pudo contactar con el proveedor de IA.',
        ) as Error & {
          readonly status?: number
          readonly code?: string
        }
        Object.assign(error, {
          status: response.status,
          ...(typeof payload?.code === 'string' ? { code: payload.code } : {}),
        })
        throw error
      }

      const payload = await response.json() as OpenAIChatCompletionsResponse
      return {
        response: payload,
        latencyMs: Date.now() - startedAt,
      }
    },
  }
}

function createUnavailableProductionProvider(config: ProductionConversationProviderConfig): AIProvider {
  const adapter: AIProviderAdapter = createOpenAIProviderAdapter({
    apiKey: DEFAULT_OPENAI_PROXY_API_KEY,
    model: config.model,
    availabilityProbe: async () => false,
    transport: {
      async execute() {
        const error = new Error(config.safeErrorMessage ?? 'La IA no está disponible.') as Error & {
          readonly status?: number
        }
        Object.assign(error, { status: 503 })
        throw error
      },
    },
  })

  return createProvider({ adapter })
}

function createProductionConversationProvider(config: ProductionConversationProviderConfig): AIProvider {
  if (!config.available) {
    return createUnavailableProductionProvider(config)
  }

  const adapter = createOpenAIProviderAdapter({
    apiKey: DEFAULT_OPENAI_PROXY_API_KEY,
    model: config.model,
    availabilityProbe: async () => true,
    transport: createOpenAIProxyTransport(),
  })

  return createProvider({ adapter })
}

const registeredInspector = createAIExecutionInspector()
const registeredKnowledgeRepository = new LocalKnowledgeRepository({
  indexer: createKnowledgeIndexer({
    chunkingStrategy: createFixedWindowChunkingStrategy({
      targetChunkTokens: 140,
      overlapTokens: 28,
      minChunkTokens: 10,
    }),
  }),
  searchEngine: createDeterministicKnowledgeSearchEngine(),
})

const registeredKnowledgeSearchTool = createKnowledgeSearchAITool({
  tool: createKnowledgeSearchToolUseCase({
    repository: registeredKnowledgeRepository,
  }),
})

const registeredToolExecutor: AIToolExecutor = createAIToolExecutor({
  registry: createAIToolRegistry([
    createPingTool(),
    registeredKnowledgeSearchTool,
  ]),
})
let defaultApplicationService: AIConversationApplicationService | null = null

export function getRegisteredAIConversationExecutionTrace(): AIExecutionTrace | null {
  return registeredInspector.exportTrace()
}

export function createDefaultAIConversationExecutionPipeline() {
  const config = resolveProductionConversationProviderConfig()
  const conversationService: AIConversationService = createAIConversationService({
    policyEngine: createPolicyEngine(),
  })

  return createConversationExecutionPipeline({
    conversationPort: conversationService,
    provider: createProductionConversationProvider(config),
    toolExecutor: registeredToolExecutor,
    inspector: registeredInspector,
  })
}

export function createDefaultAIConversationApplicationService(): AIConversationApplicationService {
  if (defaultApplicationService !== null) {
    return defaultApplicationService
  }

  const config = resolveProductionConversationProviderConfig()
  const conversationService: AIConversationService = createAIConversationService({
    policyEngine: createPolicyEngine(),
  })

  defaultApplicationService = createAIConversationApplicationService({
    conversationService,
    executionPipeline: createConversationExecutionPipeline({
      conversationPort: conversationService,
      provider: createProductionConversationProvider(config),
      toolExecutor: registeredToolExecutor,
      inspector: registeredInspector,
    }),
    memoryPort: new LocalConversationRepository(),
    config: {
      providerId: config.providerId,
      model: config.model,
      resolutionStrategy: 'DEFAULT',
      responseFormat: 'TEXT',
      temperature: 0.2,
      maxOutputTokens: 400,
      timeoutMs: config.timeoutMs,
      retentionPolicy: {
        maxSessions: 25,
        maxMessagesPerSession: 300,
        evictionStrategy: 'KEEP_MOST_RECENT',
      },
    },
  })

  return defaultApplicationService
}

export function __resetDefaultAIConversationApplicationServiceForTests() {
  defaultApplicationService = null
}
