import type { AIProviderFailure } from './aiProviderContracts'

export type AIProviderStrategy = 'mock' | 'openai'

export interface OpenAIProviderConfiguration {
  readonly providerId: 'openai-provider'
  readonly apiKey: string
  readonly intentModel: string
  readonly conversationModel: string
  readonly timeoutMs: number
  readonly retryCount: number
  readonly temperature: number
  readonly maxTokens: number
  readonly baseUrl?: string
}

export interface ResolveOpenAIConfigurationInput {
  readonly environment?: Readonly<Record<string, unknown>>
}

const DEFAULT_INTENT_MODEL = 'gpt-4o-mini'
const DEFAULT_CONVERSATION_MODEL = 'gpt-4o-mini'
const DEFAULT_TIMEOUT_MS = 12_000
const DEFAULT_RETRY_COUNT = 1
const DEFAULT_TEMPERATURE = 0.2
const DEFAULT_MAX_TOKENS = 400

function createFailure(safeMessage: string): AIProviderFailure {
  return {
    kind: 'failure',
    code: 'INVALID_PROVIDER_METADATA',
    retryable: false,
    safeMessage,
  }
}

function readEnvironmentSource(
  input?: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  if (input !== undefined) {
    return input
  }

  const viteEnv = (import.meta as ImportMeta & { readonly env?: Record<string, unknown> }).env
  if (viteEnv !== undefined) {
    return viteEnv
  }

  const globalProcess = (globalThis as { readonly process?: { readonly env?: Record<string, unknown> } }).process
  if (globalProcess?.env !== undefined) {
    return globalProcess.env
  }

  return {}
}

function getString(environment: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = environment[key]
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function getNumber(environment: Readonly<Record<string, unknown>>, key: string): number | undefined {
  const value = environment[key]
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return undefined
}

export function resolveAIProviderStrategyFromEnvironment(
  input: ResolveOpenAIConfigurationInput = {},
): AIProviderStrategy {
  const environment = readEnvironmentSource(input.environment)
  const rawStrategy = getString(environment, 'VITE_AI_PROVIDER_STRATEGY')

  if (rawStrategy === undefined) {
    return 'mock'
  }

  const strategy = rawStrategy.toLowerCase()
  return strategy === 'openai' ? 'openai' : 'mock'
}

export function resolveOpenAIProviderConfiguration(
  input: ResolveOpenAIConfigurationInput = {},
):
  | { readonly kind: 'success'; readonly configuration: OpenAIProviderConfiguration }
  | AIProviderFailure {
  const environment = readEnvironmentSource(input.environment)

  const apiKey = getString(environment, 'VITE_OPENAI_API_KEY')
  if (apiKey === undefined) {
    return createFailure('OpenAI API key is missing. Set VITE_OPENAI_API_KEY to enable the OpenAI provider.')
  }

  const intentModel = getString(environment, 'VITE_OPENAI_INTENT_MODEL') ?? DEFAULT_INTENT_MODEL
  const conversationModel = getString(environment, 'VITE_OPENAI_CONVERSATION_MODEL') ?? DEFAULT_CONVERSATION_MODEL
  const timeoutMs = Math.floor(getNumber(environment, 'VITE_OPENAI_TIMEOUT_MS') ?? DEFAULT_TIMEOUT_MS)
  const retryCount = Math.floor(getNumber(environment, 'VITE_OPENAI_RETRY_COUNT') ?? DEFAULT_RETRY_COUNT)
  const temperature = getNumber(environment, 'VITE_OPENAI_TEMPERATURE') ?? DEFAULT_TEMPERATURE
  const maxTokens = Math.floor(getNumber(environment, 'VITE_OPENAI_MAX_TOKENS') ?? DEFAULT_MAX_TOKENS)
  const baseUrl = getString(environment, 'VITE_OPENAI_BASE_URL')

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
    return createFailure('OpenAI timeout is invalid. Set VITE_OPENAI_TIMEOUT_MS between 1000 and 120000.')
  }

  if (!Number.isSafeInteger(retryCount) || retryCount < 0 || retryCount > 3) {
    return createFailure('OpenAI retry count is invalid. Set VITE_OPENAI_RETRY_COUNT between 0 and 3.')
  }

  if (typeof temperature !== 'number' || !Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    return createFailure('OpenAI temperature is invalid. Set VITE_OPENAI_TEMPERATURE between 0 and 2.')
  }

  if (!Number.isSafeInteger(maxTokens) || maxTokens < 64 || maxTokens > 4096) {
    return createFailure('OpenAI max tokens is invalid. Set VITE_OPENAI_MAX_TOKENS between 64 and 4096.')
  }

  return {
    kind: 'success',
    configuration: {
      providerId: 'openai-provider',
      apiKey,
      intentModel,
      conversationModel,
      timeoutMs,
      retryCount,
      temperature,
      maxTokens,
      ...(baseUrl === undefined ? {} : { baseUrl }),
    },
  }
}
