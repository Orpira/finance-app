import type { AIPrompt, AIPromptMetadata, AIPromptSegment } from '../prompt-builder'
import {
  AI_PROVIDER_PROTOCOL_VERSION,
  type AIProvider,
  type AIProviderAdapter,
  type AIProviderErrorCode,
  type AIProviderFailure,
  type AIProviderRequest,
  type AIProviderRequestId,
  type AIProviderRequestResult,
  type AIProviderRequestSuccess,
  type AIProviderRequestMetadata,
  type AIProviderResolutionResult,
  type AIProviderResponse,
  type AIProviderResponseId,
  type AIProviderResponseResult,
  type AIProviderResponseSuccess,
  type AIProviderResponseMetadata,
  type AIProviderUsage,
  type CreateAIProviderRequestInput,
  type CreateAIProviderResponseInput,
} from './aiProviderContracts'
import {
  isValidAIProviderRequestId,
  isValidAIProviderResponseId,
  validateAIProviderCapabilities,
  validateAIProviderRequest,
  validateAIProviderResponse,
} from './aiProviderValidator'
import { createAIProvider } from './aiProviderAdapter'

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested)
  }

  return Object.freeze(value)
}

function clonePromptMetadata(metadata: AIPromptMetadata): AIPromptMetadata {
  return {
    ...metadata,
    ...(metadata.tags === undefined ? {} : { tags: [...metadata.tags] }),
    ...(metadata.attributes === undefined
      ? {}
      : { attributes: structuredClone(metadata.attributes) }),
  }
}

function clonePromptSegment(segment: AIPromptSegment): AIPromptSegment {
  return {
    ...segment,
    metadata: clonePromptMetadata(segment.metadata),
  }
}

function clonePrompt(prompt: AIPrompt): AIPrompt {
  return {
    ...prompt,
    segments: prompt.segments.map((segment) => clonePromptSegment(segment)),
    metadata: clonePromptMetadata(prompt.metadata),
  }
}

function cloneUsage(usage: AIProviderUsage): AIProviderUsage {
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
  }
}

function createFailure(
  code: AIProviderErrorCode,
  safeMessage: string,
  retryable = false,
): AIProviderFailure {
  return {
    kind: 'failure',
    code,
    retryable,
    safeMessage,
  }
}

function createRequestSuccess(request: AIProviderRequest): AIProviderRequestSuccess {
  return {
    kind: 'success',
    request,
  }
}

function createResponseSuccess(response: AIProviderResponse): AIProviderResponseSuccess {
  return {
    kind: 'success',
    response,
  }
}

function normalizeRequestMetadata(
  metadata: CreateAIProviderRequestInput['metadata'],
): AIProviderRequestMetadata {
  return {
    protocolVersion: metadata.protocolVersion ?? AI_PROVIDER_PROTOCOL_VERSION,
    createdAt: metadata.createdAt,
    source: metadata.source,
    deterministic: metadata.deterministic ?? true,
    failClosed: metadata.failClosed ?? true,
    providerId: metadata.providerId,
    model: metadata.model,
    ...(metadata.temperature === undefined ? {} : { temperature: metadata.temperature }),
    ...(metadata.maxOutputTokens === undefined
      ? {}
      : { maxOutputTokens: metadata.maxOutputTokens }),
    ...(metadata.timeoutMs === undefined ? {} : { timeoutMs: metadata.timeoutMs }),
    ...(metadata.responseFormat === undefined
      ? {}
      : { responseFormat: metadata.responseFormat }),
    ...(metadata.tags === undefined ? {} : { tags: [...metadata.tags] }),
    ...(metadata.attributes === undefined
      ? {}
      : { attributes: structuredClone(metadata.attributes) }),
  }
}

function normalizeResponseMetadata(
  metadata: CreateAIProviderResponseInput['metadata'],
): AIProviderResponseMetadata {
  return {
    protocolVersion: metadata.protocolVersion ?? AI_PROVIDER_PROTOCOL_VERSION,
    createdAt: metadata.createdAt,
    source: metadata.source,
    deterministic: metadata.deterministic ?? true,
    failClosed: metadata.failClosed ?? true,
    requestId: metadata.requestId,
    providerId: metadata.providerId,
    model: metadata.model,
    ...(metadata.latencyMs === undefined ? {} : { latencyMs: metadata.latencyMs }),
    ...(metadata.tags === undefined ? {} : { tags: [...metadata.tags] }),
    ...(metadata.attributes === undefined
      ? {}
      : { attributes: structuredClone(metadata.attributes) }),
  }
}

export function createProviderRequestId(value: string): AIProviderRequestId | null {
  const normalized = value.trim()
  if (!isValidAIProviderRequestId(normalized)) {
    return null
  }

  return normalized as AIProviderRequestId
}

export function createProviderResponseId(value: string): AIProviderResponseId | null {
  const normalized = value.trim()
  if (!isValidAIProviderResponseId(normalized)) {
    return null
  }

  return normalized as AIProviderResponseId
}

export function createProviderRequest(
  input: CreateAIProviderRequestInput,
): AIProviderRequestResult {
  const requestId = createProviderRequestId(input.id)
  if (!requestId) {
    return createFailure('INVALID_REQUEST_ID', 'The AI provider request identifier is invalid.')
  }

  const request: AIProviderRequest = {
    protocolVersion: AI_PROVIDER_PROTOCOL_VERSION,
    id: requestId,
    prompt: clonePrompt(input.prompt),
    metadata: normalizeRequestMetadata(input.metadata),
  }

  const validation = validateAIProviderRequest(request)
  if (validation) {
    return createFailure(validation.code, validation.safeMessage)
  }

  return createRequestSuccess(deepFreeze(request))
}

export function createProviderResponse(
  input: CreateAIProviderResponseInput,
): AIProviderResponseResult {
  const responseId = createProviderResponseId(input.id)
  if (!responseId) {
    return createFailure('INVALID_RESPONSE_ID', 'The AI provider response identifier is invalid.')
  }

  const response: AIProviderResponse = {
    protocolVersion: AI_PROVIDER_PROTOCOL_VERSION,
    id: responseId,
    content: input.content,
    usage: cloneUsage(input.usage),
    finishReason: input.finishReason,
    metadata: normalizeResponseMetadata(input.metadata),
  }

  const validation = validateAIProviderResponse(response)
  if (validation) {
    return createFailure(validation.code, validation.safeMessage)
  }

  return createResponseSuccess(deepFreeze(response))
}

export function createProvider(input: { readonly adapter: AIProviderAdapter }): AIProvider {
  const capabilitiesValidation = validateAIProviderCapabilities(input.adapter.getCapabilities())
  if (capabilitiesValidation) {
    throw new Error(capabilitiesValidation.safeMessage)
  }

  return createAIProvider(input)
}

export function resolveProvider(input: {
  readonly providerId: string
  readonly adapters: readonly AIProviderAdapter[]
}): AIProviderResolutionResult {
  const adapter = input.adapters.find((candidate) => candidate.providerId === input.providerId)
  if (!adapter) {
    return createFailure(
      'UNKNOWN_PROVIDER_ERROR',
      'The requested AI provider is not registered.',
    )
  }

  const capabilitiesValidation = validateAIProviderCapabilities(adapter.getCapabilities())
  if (capabilitiesValidation) {
    return createFailure(capabilitiesValidation.code, capabilitiesValidation.safeMessage)
  }

  return {
    kind: 'success',
    provider: createProvider({ adapter }),
  }
}
