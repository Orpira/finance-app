import type { AIPromptJsonValue } from '../prompt-builder'
import { validateAIPrompt } from '../prompt-builder'
import {
  AI_PROVIDER_ERROR_CODES,
  AI_PROVIDER_FINISH_REASONS,
  AI_PROVIDER_IDS,
  AI_PROVIDER_PROTOCOL_VERSION,
  type AIProviderCapabilities,
  type AIProviderErrorCode,
  type AIProviderFinishReason,
  type AIProviderMetadata,
  type AIProviderRequest,
  type AIProviderRequestId,
  type AIProviderRequestMetadata,
  type AIProviderResponse,
  type AIProviderResponseId,
  type AIProviderResponseMetadata,
  type AIProviderUsage,
} from './aiProviderContracts'

const UTC_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const PROVIDER_SET = new Set<string>(AI_PROVIDER_IDS)
const FINISH_REASON_SET = new Set<string>(AI_PROVIDER_FINISH_REASONS)

export interface AIProviderValidationError {
  readonly code: AIProviderErrorCode
  readonly safeMessage: string
}

function createError(
  code: AIProviderErrorCode,
  safeMessage: string,
): AIProviderValidationError {
  if (!AI_PROVIDER_ERROR_CODES.includes(code)) {
    throw new Error(`Unknown AI provider error code: ${code}`)
  }

  return { code, safeMessage }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isValidJsonValue(value: unknown, seen: ReadonlySet<object>): value is AIPromptJsonValue {
  if (value === null) {
    return true
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return true
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
  }

  if (typeof value !== 'object') {
    return false
  }

  if (value instanceof Date || seen.has(value)) {
    return false
  }

  const nextSeen = new Set(seen)
  nextSeen.add(value)

  if (Array.isArray(value)) {
    return value.every((item) => isValidJsonValue(item, nextSeen))
  }

  if (!isRecord(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    return false
  }

  return Object.values(value).every((item) => isValidJsonValue(item, nextSeen))
}

function validateMetadata(
  metadata: AIProviderMetadata,
  errorCode: 'INVALID_REQUEST_METADATA' | 'INVALID_RESPONSE_METADATA',
): AIProviderValidationError | null {
  if (metadata.protocolVersion !== AI_PROVIDER_PROTOCOL_VERSION) {
    return createError(errorCode, 'The AI provider metadata protocol version is invalid.')
  }

  if (!isNonEmpty(metadata.createdAt) || !UTC_INSTANT_PATTERN.test(metadata.createdAt)) {
    return createError(errorCode, 'The AI provider metadata creation time is invalid.')
  }

  if (
    metadata.source !== 'APPLICATION' &&
    metadata.source !== 'CONVERSATION' &&
    metadata.source !== 'SYSTEM'
  ) {
    return createError(errorCode, 'The AI provider metadata source is invalid.')
  }

  if (metadata.deterministic !== true || metadata.failClosed !== true) {
    return createError(errorCode, 'The AI provider metadata must be deterministic and fail-closed.')
  }

  if (metadata.tags !== undefined && !metadata.tags.every((tag) => isNonEmpty(tag))) {
    return createError(errorCode, 'The AI provider metadata tags are invalid.')
  }

  if (
    metadata.attributes !== undefined &&
    !isValidJsonValue(metadata.attributes, new Set())
  ) {
    return createError(errorCode, 'The AI provider metadata attributes are invalid.')
  }

  return null
}

function validateUsage(usage: AIProviderUsage): AIProviderValidationError | null {
  if (!isNonNegativeInteger(usage.inputTokens)) {
    return createError('INVALID_RESPONSE', 'The AI provider input token usage is invalid.')
  }

  if (!isNonNegativeInteger(usage.outputTokens)) {
    return createError('INVALID_RESPONSE', 'The AI provider output token usage is invalid.')
  }

  if (!isNonNegativeInteger(usage.totalTokens)) {
    return createError('INVALID_RESPONSE', 'The AI provider total token usage is invalid.')
  }

  if (usage.inputTokens + usage.outputTokens !== usage.totalTokens) {
    return createError('INVALID_RESPONSE', 'The AI provider token usage is inconsistent.')
  }

  return null
}

export function isValidAIProviderId(value: string): boolean {
  return PROVIDER_SET.has(value)
}

export function isValidAIProviderFinishReason(value: string): value is AIProviderFinishReason {
  return FINISH_REASON_SET.has(value)
}

export function isValidAIProviderRequestId(value: string): value is AIProviderRequestId {
  return /^provider-request:[a-z0-9]+(?:[a-z0-9:-]*[a-z0-9])?$/.test(value)
}

export function isValidAIProviderResponseId(value: string): value is AIProviderResponseId {
  return /^provider-response:[a-z0-9]+(?:[a-z0-9:-]*[a-z0-9])?$/.test(value)
}

export function validateAIProviderRequestMetadata(
  metadata: AIProviderRequestMetadata,
): AIProviderValidationError | null {
  const baseValidation = validateMetadata(metadata, 'INVALID_REQUEST_METADATA')
  if (baseValidation) {
    return baseValidation
  }

  if (!isValidAIProviderId(metadata.providerId)) {
    return createError('INVALID_PROVIDER', 'The AI provider identifier is invalid.')
  }

  if (!isNonEmpty(metadata.model)) {
    return createError('INVALID_REQUEST_METADATA', 'The AI provider model is invalid.')
  }

  if (
    metadata.temperature !== undefined &&
    (typeof metadata.temperature !== 'number' || !Number.isFinite(metadata.temperature))
  ) {
    return createError('INVALID_REQUEST_METADATA', 'The AI provider temperature is invalid.')
  }

  if (metadata.maxOutputTokens !== undefined && !isPositiveInteger(metadata.maxOutputTokens)) {
    return createError('INVALID_REQUEST_METADATA', 'The AI provider max output tokens are invalid.')
  }

  if (metadata.timeoutMs !== undefined && !isPositiveInteger(metadata.timeoutMs)) {
    return createError('INVALID_REQUEST_METADATA', 'The AI provider timeout is invalid.')
  }

  if (
    metadata.responseFormat !== undefined &&
    metadata.responseFormat !== 'TEXT' &&
    metadata.responseFormat !== 'JSON'
  ) {
    return createError('INVALID_REQUEST_METADATA', 'The AI provider response format is invalid.')
  }

  return null
}

export function validateAIProviderResponseMetadata(
  metadata: AIProviderResponseMetadata,
): AIProviderValidationError | null {
  const baseValidation = validateMetadata(metadata, 'INVALID_RESPONSE_METADATA')
  if (baseValidation) {
    return baseValidation
  }

  if (!isValidAIProviderRequestId(metadata.requestId)) {
    return createError('INVALID_REQUEST_ID', 'The AI provider request identifier is invalid.')
  }

  if (!isValidAIProviderId(metadata.providerId)) {
    return createError('INVALID_PROVIDER', 'The AI provider identifier is invalid.')
  }

  if (!isNonEmpty(metadata.model)) {
    return createError('INVALID_RESPONSE_METADATA', 'The AI provider model is invalid.')
  }

  if (metadata.latencyMs !== undefined && !isNonNegativeInteger(metadata.latencyMs)) {
    return createError('INVALID_RESPONSE_METADATA', 'The AI provider latency is invalid.')
  }

  return null
}

export function validateAIProviderCapabilities(
  capabilities: AIProviderCapabilities,
): AIProviderValidationError | null {
  if (!isPositiveInteger(capabilities.maxContextWindow)) {
    return createError('INVALID_PROVIDER', 'The AI provider max context window is invalid.')
  }

  if (
    !Array.isArray(capabilities.supportedModels) ||
    capabilities.supportedModels.length === 0 ||
    !capabilities.supportedModels.every((model) => isNonEmpty(model))
  ) {
    return createError('INVALID_PROVIDER', 'The AI provider supported models are invalid.')
  }

  return null
}

export function validateAIProviderRequest(
  request: AIProviderRequest,
): AIProviderValidationError | null {
  if (request.protocolVersion !== AI_PROVIDER_PROTOCOL_VERSION) {
    return createError('INVALID_REQUEST', 'The AI provider request protocol version is invalid.')
  }

  if (!isValidAIProviderRequestId(request.id)) {
    return createError('INVALID_REQUEST_ID', 'The AI provider request identifier is invalid.')
  }

  const promptValidation = validateAIPrompt(request.prompt)
  if (promptValidation) {
    return createError('INVALID_PROMPT', promptValidation.safeMessage)
  }

  return validateAIProviderRequestMetadata(request.metadata)
}

export function validateAIProviderResponse(
  response: AIProviderResponse,
): AIProviderValidationError | null {
  if (response.protocolVersion !== AI_PROVIDER_PROTOCOL_VERSION) {
    return createError('INVALID_RESPONSE', 'The AI provider response protocol version is invalid.')
  }

  if (!isValidAIProviderResponseId(response.id)) {
    return createError('INVALID_RESPONSE_ID', 'The AI provider response identifier is invalid.')
  }

  if (!isNonEmpty(response.content)) {
    return createError('INVALID_RESPONSE', 'The AI provider response content is invalid.')
  }

  if (!isValidAIProviderFinishReason(response.finishReason)) {
    return createError('INVALID_RESPONSE', 'The AI provider finish reason is invalid.')
  }

  const usageValidation = validateUsage(response.usage)
  if (usageValidation) {
    return usageValidation
  }

  return validateAIProviderResponseMetadata(response.metadata)
}
