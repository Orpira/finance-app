import OpenAI from 'openai'

import {
  INTENT_RESOLVER_PROTOCOL_VERSION,
  type IntentResolutionDetectedIntent,
  type IntentResolutionRequest,
  type IntentResolverResolveResult,
} from '../intent-resolver/intentResolver'
import type {
  AIToolJsonValue,
} from '../ai-tools'
import type {
  AIProviderFailure,
} from './aiProviderContracts'
import type {
  OpenAIProviderConfiguration,
} from './openAIConfiguration'

interface OpenAIAdapterChatCompletionRequest {
  readonly model: string
  readonly messages: {
    readonly role: 'system' | 'user'
    readonly content: string
  }[]
  readonly timeoutMs: number
  readonly temperature: number
  readonly maxTokens: number
  readonly responseFormat: 'json' | 'text'
}

interface OpenAIAdapterChatCompletionResponse {
  readonly content: string
  readonly usage?: {
    readonly promptTokens?: number
    readonly completionTokens?: number
    readonly totalTokens?: number
  }
  readonly statusCode?: number
}

export interface OpenAIAdapterTransport {
  createChatCompletion(
    request: OpenAIAdapterChatCompletionRequest,
  ): Promise<OpenAIAdapterChatCompletionResponse>
}

export interface OpenAIAdapter {
  resolveIntent(request: IntentResolutionRequest): Promise<IntentResolverResolveResult>
  generateConversationText(responseJson: string): Promise<
    | {
        readonly kind: 'success'
        readonly text: string
      }
    | AIProviderFailure
  >
}

export interface CreateOpenAIAdapterInput {
  readonly configuration: OpenAIProviderConfiguration
  readonly transport?: OpenAIAdapterTransport
  readonly now?: () => string
  readonly logger?: (event: string, payload: Readonly<Record<string, unknown>>) => void
}

interface ParsedIntentPayload {
  readonly detectedIntent: IntentResolutionDetectedIntent
  readonly confidence: number
  readonly toolId: string
  readonly reasoning: string
  readonly arguments?: IntentResolutionRequest['conversationRequest']['steps'][number]['arguments']
}

const INTENTS: readonly IntentResolutionDetectedIntent[] = [
  'balance',
  'transactions',
  'budget',
  'goals',
  'reports',
  'insights',
  'unknown',
] as const

function createFailure(
  code: AIProviderFailure['code'],
  safeMessage: string,
): AIProviderFailure {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
  }
}

function extractJsonObject(content: string): Record<string, unknown> | null {
  const trimmed = content.trim()

  try {
    const parsed = JSON.parse(trimmed)
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // continue to fenced extraction
  }

  const fenced = trimmed.match(/```json\s*([\s\S]*?)\s*```/i)
  if (fenced !== null && fenced[1] !== undefined) {
    try {
      const parsed = JSON.parse(fenced[1])
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return null
    }
  }

  return null
}

function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const record = error as Error & { readonly status?: number; readonly code?: string }
    if (typeof record.status === 'number') {
      return [408, 409, 425, 429, 500, 502, 503, 504].includes(record.status)
    }

    if (typeof record.code === 'string') {
      return ['ETIMEDOUT', 'ECONNRESET', 'ECONNABORTED'].includes(record.code)
    }

    return record.name === 'AbortError' || record.name === 'TimeoutError'
  }

  return false
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms)
  })
}

function parseIntentPayload(content: string): ParsedIntentPayload | null {
  const parsed = extractJsonObject(content)
  if (parsed === null) {
    return null
  }

  const detectedIntent = parsed.detectedIntent
  const confidence = parsed.confidence
  const toolId = parsed.toolId
  const reasoning = parsed.reasoning
  const args = parsed.arguments

  if (!INTENTS.includes(detectedIntent as IntentResolutionDetectedIntent)) {
    return null
  }

  if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    return null
  }

  if (typeof toolId !== 'string' || toolId.trim().length === 0) {
    return null
  }

  if (typeof reasoning !== 'string' || reasoning.trim().length === 0) {
    return null
  }

  const safeArguments = args !== null && typeof args === 'object' && !Array.isArray(args)
    ? (args as Readonly<Record<string, AIToolJsonValue>>)
    : ({} as IntentResolutionRequest['conversationRequest']['steps'][number]['arguments'])

  return {
    detectedIntent: detectedIntent as IntentResolutionDetectedIntent,
    confidence,
    toolId,
    reasoning,
    arguments: safeArguments,
  }
}

function createOpenAITransport(
  configuration: OpenAIProviderConfiguration,
): OpenAIAdapterTransport {
  const client = new OpenAI({
    apiKey: configuration.apiKey,
    ...(configuration.baseUrl === undefined ? {} : { baseURL: configuration.baseUrl }),
    dangerouslyAllowBrowser: true,
  })

  return {
    async createChatCompletion(request): Promise<OpenAIAdapterChatCompletionResponse> {
      const response = await client.chat.completions.create({
        model: request.model,
        messages: [...request.messages],
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        ...(request.responseFormat === 'json'
          ? { response_format: { type: 'json_object' as const } }
          : {}),
      })

      const first = response.choices[0]
      const content = first?.message?.content
      return {
        content: typeof content === 'string' ? content : '',
        usage: {
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
          totalTokens: response.usage?.total_tokens,
        },
      }
    },
  }
}

export function createOpenAIAdapter(input: CreateOpenAIAdapterInput): OpenAIAdapter {
  const now = input.now ?? (() => new Date().toISOString())
  const logger = input.logger ?? (() => undefined)
  const transport = input.transport ?? createOpenAITransport(input.configuration)

  async function executeWithRetry(
    operation: 'resolve-intent' | 'generate-conversation',
    request: OpenAIAdapterChatCompletionRequest,
  ): Promise<OpenAIAdapterChatCompletionResponse> {
    let attempt = 0
    let lastError: unknown = null

    while (attempt <= input.configuration.retryCount) {
      const startedAt = Date.now()
      attempt += 1

      try {
        const output = await Promise.race([
          transport.createChatCompletion(request),
          new Promise<OpenAIAdapterChatCompletionResponse>((_, reject) => {
            setTimeout(() => {
              const timeoutError = new Error('Operation timed out') as Error & { readonly code?: string }
              Object.assign(timeoutError, { code: 'ETIMEDOUT' })
              reject(timeoutError)
            }, request.timeoutMs)
          }),
        ])

        logger('openai.operation.success', {
          provider: 'OPENAI',
          operation,
          durationMs: Date.now() - startedAt,
          attempt,
          timestamp: now(),
          ...(output.usage?.totalTokens === undefined
            ? {}
            : { totalTokens: output.usage.totalTokens }),
        })

        return output
      } catch (error) {
        lastError = error
        const transient = isTransientError(error)

        logger('openai.operation.error', {
          provider: 'OPENAI',
          operation,
          durationMs: Date.now() - startedAt,
          attempt,
          transient,
          timestamp: now(),
          errorType: error instanceof Error ? error.name : 'UnknownError',
        })

        if (!transient || attempt > input.configuration.retryCount) {
          throw error
        }

        await delay(Math.min(200 * attempt, 600))
      }
    }

    throw lastError
  }

  return {
    async resolveIntent(request): Promise<IntentResolverResolveResult> {
      try {
        const output = await executeWithRetry('resolve-intent', {
          model: input.configuration.intentModel,
          timeoutMs: input.configuration.timeoutMs,
          temperature: input.configuration.temperature,
          maxTokens: input.configuration.maxTokens,
          responseFormat: 'json',
          messages: [
            {
              role: 'system',
              content: [
                'You resolve financial chat intent.',
                'Return strict JSON with keys: detectedIntent, confidence, toolId, arguments, reasoning.',
                'Allowed detectedIntent: balance, transactions, budget, goals, reports, insights, unknown.',
                'Allowed toolId: financial_balance, financial_transactions, financial_budget, financial_goals, financial_reports, financial_insights.',
                'Use confidence between 0 and 1.',
              ].join(' '),
            },
            {
              role: 'user',
              content: request.metadata.userMessage,
            },
          ],
        })

        const parsed = parseIntentPayload(output.content)
        if (parsed === null) {
          return {
            kind: 'failure',
            code: 'INVALID_INTENT_RESULT',
            retryable: false,
            safeMessage: 'OpenAI intent response is invalid.',
          }
        }

        return {
          kind: 'success',
          resolution: {
            protocolVersion: INTENT_RESOLVER_PROTOCOL_VERSION,
            detectedIntent: parsed.detectedIntent,
            confidence: parsed.confidence,
            tools: [
              {
                toolId: parsed.toolId,
                arguments: parsed.arguments ?? {},
              },
            ],
            reasoning: parsed.reasoning,
            provider: 'OPENAI_PROVIDER',
            timestamp: now(),
          },
        }
      } catch {
        return {
          kind: 'failure',
          code: 'INTENT_RESOLUTION_FAILED',
          retryable: false,
          safeMessage: 'No fue posible resolver la intención con OpenAI.',
        }
      }
    },

    async generateConversationText(responseJson) {
      try {
        const output = await executeWithRetry('generate-conversation', {
          model: input.configuration.conversationModel,
          timeoutMs: input.configuration.timeoutMs,
          temperature: input.configuration.temperature,
          maxTokens: input.configuration.maxTokens,
          responseFormat: 'text',
          messages: [
            {
              role: 'system',
              content: [
                'You generate a concise financial assistant response in Spanish.',
                'Do not invent data outside the provided structured response.',
                'Never output JSON.',
              ].join(' '),
            },
            {
              role: 'user',
              content: responseJson,
            },
          ],
        })

        const text = output.content.trim()
        if (text.length === 0) {
          return createFailure('CONVERSATION_GENERATION_FAILED', 'OpenAI returned an empty conversation response.')
        }

        return {
          kind: 'success',
          text,
        }
      } catch {
        return createFailure('CONVERSATION_GENERATION_FAILED', 'No fue posible generar la conversación con OpenAI.')
      }
    },
  }
}
