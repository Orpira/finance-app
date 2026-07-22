import type {
  AIPrompt,
  AIPromptRole,
} from '../prompt-builder'
import {
  type AIProviderAdapter,
  type AIProviderCapabilities,
  type AIProviderErrorCode,
  type AIProviderFailure,
  type AIProviderRequest,
  type AIProviderResponseFormat,
} from './aiProviderContracts'
import {
  createProviderResponse,
} from './aiProviderFactory'
import {
  validateAIProviderRequest,
} from './aiProviderValidator'

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'

type OpenAIRole = 'system' | 'user' | 'assistant'

interface OpenAIMessage {
  readonly role: OpenAIRole
  readonly content: string
}

interface OpenAIResponseFormatDescriptor {
  readonly type: 'text' | 'json_object'
}

export interface OpenAIChatCompletionsRequest {
  readonly model: string
  readonly messages: readonly OpenAIMessage[]
  readonly temperature?: number
  readonly max_tokens?: number
  readonly response_format?: OpenAIResponseFormatDescriptor
}

interface OpenAIChatCompletionChoice {
  readonly finish_reason: string | null
  readonly message?: {
    readonly content?: string | null
  }
}

export interface OpenAIChatCompletionsResponse {
  readonly id: string
  readonly model: string
  readonly choices: readonly OpenAIChatCompletionChoice[]
  readonly usage?: {
    readonly prompt_tokens?: number
    readonly completion_tokens?: number
    readonly total_tokens?: number
  }
}

export interface OpenAITransportExecuteInput {
  readonly apiKey: string
  readonly baseUrl: string
  readonly payload: OpenAIChatCompletionsRequest
  readonly timeoutMs?: number
}

export interface OpenAITransportExecuteOutput {
  readonly response: OpenAIChatCompletionsResponse
  readonly latencyMs?: number
}

export interface OpenAITransport {
  execute(input: OpenAITransportExecuteInput): Promise<OpenAITransportExecuteOutput>
}

export interface CreateOpenAIProviderAdapterInput {
  readonly apiKey: string | null | undefined
  readonly model: string
  readonly baseUrl?: string
  readonly maxContextWindow?: number
  readonly transport?: OpenAITransport
  readonly availabilityProbe?: () => Promise<boolean>
}

interface OpenAIHttpError extends Error {
  readonly status?: number
  readonly code?: string
  readonly type?: string
}

function debugConversationBoundary(event: string, payload: Record<string, unknown>): void {
  // Temporal: trazas sanitizadas para auditar pérdida de estado end-to-end.
  console.info('[ConversationTrace]', event, payload)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function roleToOpenAI(role: AIPromptRole): OpenAIRole {
  if (role === 'USER') {
    return 'user'
  }

  if (role === 'ASSISTANT') {
    return 'assistant'
  }

  return 'system'
}

function responseFormatToOpenAI(
  responseFormat: AIProviderResponseFormat | undefined,
): OpenAIResponseFormatDescriptor | undefined {
  if (responseFormat === 'JSON') {
    return { type: 'json_object' }
  }

  if (responseFormat === 'TEXT') {
    return { type: 'text' }
  }

  return undefined
}

function normalizeIdentifierFragment(value: string): string {
  return value.replace(/[^a-z0-9:-]/gi, '-').toLowerCase()
}

function responseIdFromRequest(request: AIProviderRequest): string {
  return `provider-response:openai:${normalizeIdentifierFragment(request.id)}`
}

function createFailure(
  code: AIProviderErrorCode,
  safeMessage: string,
  retryable = false,
  details?: AIProviderFailure['details'],
): AIProviderFailure {
  return {
    kind: 'failure',
    code,
    retryable,
    safeMessage,
    ...(details === undefined ? {} : { details }),
  }
}

function promptToOpenAIPayload(request: AIProviderRequest): OpenAIChatCompletionsRequest {
  const messages = request.prompt.segments.map((segment) => ({
    role: roleToOpenAI(segment.role),
    content: segment.content,
  }))

  return {
    model: request.metadata.model,
    messages,
    ...(request.metadata.temperature === undefined
      ? {}
      : { temperature: request.metadata.temperature }),
    ...(request.metadata.maxOutputTokens === undefined
      ? {}
      : { max_tokens: request.metadata.maxOutputTokens }),
    ...(responseFormatToOpenAI(request.metadata.responseFormat) === undefined
      ? {}
      : { response_format: responseFormatToOpenAI(request.metadata.responseFormat) }),
  }
}

function finishReasonFromOpenAI(value: string | null):
  | 'STOP'
  | 'MAX_TOKENS'
  | 'CONTENT_FILTER'
  | 'UNKNOWN' {
  if (value === 'stop') {
    return 'STOP'
  }

  if (value === 'length') {
    return 'MAX_TOKENS'
  }

  if (value === 'content_filter') {
    return 'CONTENT_FILTER'
  }

  return 'UNKNOWN'
}

function mapOpenAIError(error: unknown): AIProviderFailure {
  if (error instanceof Error && error.name === 'AbortError') {
    return createFailure('PROVIDER_TIMEOUT', 'The OpenAI provider request timed out.', true)
  }

  if (isRecord(error)) {
    const status = typeof error.status === 'number' ? error.status : undefined
    const code = typeof error.code === 'string' ? error.code : undefined
    const details = {
      ...(status === undefined ? {} : { status }),
      ...(code === undefined ? {} : { providerCode: code }),
    }

    if (status === 401 || status === 403) {
      return createFailure(
        'AUTHENTICATION_FAILED',
        'The OpenAI provider authentication failed.',
        false,
        details,
      )
    }

    if (status === 429) {
      return createFailure(
        'RATE_LIMITED',
        'The OpenAI provider rate limit was exceeded.',
        true,
        details,
      )
    }

    if (status === 408 || status === 504 || code === 'ETIMEDOUT') {
      return createFailure(
        'PROVIDER_TIMEOUT',
        'The OpenAI provider request timed out.',
        true,
        details,
      )
    }

    if (status === 502 || status === 503) {
      return createFailure(
        'PROVIDER_UNAVAILABLE',
        'The OpenAI provider is unavailable.',
        true,
        details,
      )
    }
  }

  return createFailure(
    'UNKNOWN_PROVIDER_ERROR',
    'The OpenAI provider request failed unexpectedly.',
    true,
  )
}

async function safeReadJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function createFetchTransport(): OpenAITransport {
  return {
    async execute(input) {
      const controller = new AbortController()
      const timeoutId = input.timeoutMs === undefined
        ? null
        : setTimeout(() => controller.abort(), input.timeoutMs)

      const startedAt = Date.now()

      try {
        const response = await fetch(`${input.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${input.apiKey}`,
          },
          body: JSON.stringify(input.payload),
          signal: controller.signal,
        })

        if (!response.ok) {
          const body = await safeReadJson(response)
          const error = new Error('OpenAI request failed') as OpenAIHttpError
          error.status = response.status
          if (isRecord(body) && isRecord(body.error)) {
            error.code = typeof body.error.code === 'string' ? body.error.code : undefined
            error.type = typeof body.error.type === 'string' ? body.error.type : undefined
          }
          throw error
        }

        const payload = await response.json() as OpenAIChatCompletionsResponse
        return {
          response: payload,
          latencyMs: Date.now() - startedAt,
        }
      } finally {
        if (timeoutId !== null) {
          clearTimeout(timeoutId)
        }
      }
    },
  }
}

function cloneCapabilities(capabilities: AIProviderCapabilities): AIProviderCapabilities {
  return {
    ...capabilities,
    supportedModels: [...capabilities.supportedModels],
  }
}

export function createOpenAIProviderAdapter(
  input: CreateOpenAIProviderAdapterInput,
): AIProviderAdapter {
  const transport = input.transport ?? createFetchTransport()
  const capabilities: AIProviderCapabilities = Object.freeze({
    supportsStreaming: false,
    supportsVision: false,
    supportsTools: false,
    supportsJson: true,
    maxContextWindow: input.maxContextWindow ?? 128000,
    supportedModels: Object.freeze([input.model]),
  })

  async function isAvailable(): Promise<boolean> {
    if (typeof input.apiKey !== 'string' || input.apiKey.trim().length === 0) {
      return false
    }

    if (input.availabilityProbe !== undefined) {
      try {
        return await input.availabilityProbe()
      } catch {
        return false
      }
    }

    return true
  }

  return {
    providerId: 'OPENAI',

    getCapabilities() {
      return cloneCapabilities(capabilities)
    },

    isAvailable,

    async executePrompt(request) {
      const validation = validateAIProviderRequest(request)
      if (validation) {
        return createFailure(validation.code, validation.safeMessage)
      }

      if (request.metadata.providerId !== 'OPENAI') {
        return createFailure('INVALID_PROVIDER', 'The AI provider identifier is invalid.')
      }

      if (!(await isAvailable())) {
        return createFailure('PROVIDER_UNAVAILABLE', 'The OpenAI provider is unavailable.', true)
      }

      try {
        const execution = await transport.execute({
          apiKey: input.apiKey ?? '',
          baseUrl: input.baseUrl ?? DEFAULT_OPENAI_BASE_URL,
          payload: promptToOpenAIPayload(request),
          ...(request.metadata.timeoutMs === undefined
            ? {}
            : { timeoutMs: request.metadata.timeoutMs }),
        })

        const choice = execution.response.choices[0]
        const content = choice?.message?.content?.trim()
        if (content === undefined || content.length === 0) {
          return createFailure(
            'INVALID_RESPONSE',
            'The OpenAI provider returned an invalid response payload.',
          )
        }

        debugConversationBoundary('provider.response.parsed', {
          providerId: 'OPENAI',
          requestId: request.id,
          responseId: execution.response.id,
          model: execution.response.model || request.metadata.model,
          choiceCount: execution.response.choices.length,
          contentLength: content.length,
          finishReason: choice?.finish_reason ?? null,
          latencyMs: execution.latencyMs ?? null,
        })

        const usage = execution.response.usage
        const promptTokens = usage?.prompt_tokens ?? 0
        const completionTokens = usage?.completion_tokens ?? 0
        const totalTokens = usage?.total_tokens ?? promptTokens + completionTokens

        const responseResult = createProviderResponse({
          id: responseIdFromRequest(request),
          content,
          usage: {
            inputTokens: promptTokens,
            outputTokens: completionTokens,
            totalTokens,
          },
          finishReason: finishReasonFromOpenAI(choice?.finish_reason ?? null),
          metadata: {
            createdAt: request.metadata.createdAt,
            requestId: request.id,
            providerId: 'OPENAI',
            model: execution.response.model || request.metadata.model,
            source: 'SYSTEM',
            ...(execution.latencyMs === undefined ? {} : { latencyMs: execution.latencyMs }),
            tags: [
              'provider-response',
              'provider:openai',
            ],
            attributes: {
              openAIResponseId: execution.response.id,
            },
          },
        })

        if (responseResult.kind === 'failure') {
          return responseResult
        }

        return {
          kind: 'success',
          response: responseResult.response,
        }
      } catch (error) {
        debugConversationBoundary('provider.response.error', {
          providerId: 'OPENAI',
          requestId: request.id,
          errorType: error instanceof Error ? error.name : typeof error,
        })
        return mapOpenAIError(error)
      }
    },
  }
}

export function mapPromptToOpenAIRequest(prompt: AIPrompt, metadata: {
  readonly model: string
  readonly temperature?: number
  readonly maxOutputTokens?: number
  readonly responseFormat?: AIProviderResponseFormat
}): OpenAIChatCompletionsRequest {
  return {
    model: metadata.model,
    messages: prompt.segments.map((segment) => ({
      role: roleToOpenAI(segment.role),
      content: segment.content,
    })),
    ...(metadata.temperature === undefined ? {} : { temperature: metadata.temperature }),
    ...(metadata.maxOutputTokens === undefined
      ? {}
      : { max_tokens: metadata.maxOutputTokens }),
    ...(responseFormatToOpenAI(metadata.responseFormat) === undefined
      ? {}
      : { response_format: responseFormatToOpenAI(metadata.responseFormat) }),
  }
}
