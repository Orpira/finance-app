import {
  validateAIConversation,
  validateAIConversationMessage,
  AIConversationSessionValidator,
  type AIConversationMessage,
} from '../ai-conversation'
import {
  AI_EXECUTION_ERROR_CODES,
  AI_EXECUTION_PROTOCOL_VERSION,
  type AIExecutionErrorCode,
  type AIExecutionMetadata,
  type AIExecutionRequest,
  type AIExecutionResponse,
  type AIExecutionResponseMetadata,
  type AIExecutionId,
} from './aiExecutionContracts'

const UTC_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

export interface AIExecutionValidationError {
  readonly code: AIExecutionErrorCode
  readonly safeMessage: string
}

function createError(
  code: AIExecutionErrorCode,
  safeMessage: string,
): AIExecutionValidationError {
  if (!AI_EXECUTION_ERROR_CODES.includes(code)) {
    throw new Error(`Unknown AI execution error code: ${code}`)
  }

  return { code, safeMessage }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isValidJsonValue(value: unknown, seen: ReadonlySet<object>): boolean {
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

function validateBaseMetadata(
  metadata: AIExecutionMetadata | AIExecutionResponseMetadata,
  code: 'INVALID_EXECUTION_METADATA' | 'INVALID_EXECUTION_RESPONSE',
): AIExecutionValidationError | null {
  if (metadata.protocolVersion !== AI_EXECUTION_PROTOCOL_VERSION) {
    return createError(code, 'The AI execution metadata protocol version is invalid.')
  }

  if (!isNonEmpty(metadata.createdAt) || !UTC_INSTANT_PATTERN.test(metadata.createdAt)) {
    return createError(code, 'The AI execution metadata creation time is invalid.')
  }

  if (
    metadata.source !== 'APPLICATION' &&
    metadata.source !== 'CONVERSATION' &&
    metadata.source !== 'SYSTEM'
  ) {
    return createError(code, 'The AI execution metadata source is invalid.')
  }

  if (metadata.deterministic !== true || metadata.failClosed !== true) {
    return createError(code, 'The AI execution metadata must be deterministic and fail-closed.')
  }

  if (metadata.tags !== undefined && !metadata.tags.every((tag) => isNonEmpty(tag))) {
    return createError(code, 'The AI execution metadata tags are invalid.')
  }

  if (
    metadata.attributes !== undefined &&
    !isValidJsonValue(metadata.attributes, new Set())
  ) {
    return createError(code, 'The AI execution metadata attributes are invalid.')
  }

  return null
}

export function isValidAIExecutionId(value: string): value is AIExecutionId {
  return /^execution:[a-z0-9]+(?:[a-z0-9:-]*[a-z0-9])?$/.test(value)
}

export function validateAIExecutionMetadata(
  metadata: AIExecutionMetadata,
): AIExecutionValidationError | null {
  const baseValidation = validateBaseMetadata(metadata, 'INVALID_EXECUTION_METADATA')
  if (baseValidation) {
    return baseValidation
  }

  if (!isNonEmpty(metadata.providerId)) {
    return createError('INVALID_EXECUTION_METADATA', 'The AI execution provider identifier is invalid.')
  }

  if (!isNonEmpty(metadata.model)) {
    return createError('INVALID_EXECUTION_METADATA', 'The AI execution model is invalid.')
  }

  if (
    metadata.temperature !== undefined &&
    (typeof metadata.temperature !== 'number' || !Number.isFinite(metadata.temperature))
  ) {
    return createError('INVALID_EXECUTION_METADATA', 'The AI execution temperature is invalid.')
  }

  if (
    metadata.maxOutputTokens !== undefined &&
    (!Number.isSafeInteger(metadata.maxOutputTokens) || metadata.maxOutputTokens <= 0)
  ) {
    return createError('INVALID_EXECUTION_METADATA', 'The AI execution max output tokens are invalid.')
  }

  if (
    metadata.timeoutMs !== undefined &&
    (!Number.isSafeInteger(metadata.timeoutMs) || metadata.timeoutMs <= 0)
  ) {
    return createError('INVALID_EXECUTION_METADATA', 'The AI execution timeout is invalid.')
  }

  return null
}

export function validateAIExecutionResponseMetadata(
  metadata: AIExecutionResponseMetadata,
): AIExecutionValidationError | null {
  const baseValidation = validateBaseMetadata(metadata, 'INVALID_EXECUTION_RESPONSE')
  if (baseValidation) {
    return baseValidation
  }

  if (!isValidAIExecutionId(metadata.requestId)) {
    return createError('INVALID_EXECUTION_RESPONSE', 'The AI execution request identifier is invalid.')
  }

  if (!isNonEmpty(metadata.conversationId)) {
    return createError('INVALID_EXECUTION_RESPONSE', 'The AI execution response conversation identifier is invalid.')
  }

  if (!isNonEmpty(metadata.sessionId)) {
    return createError('INVALID_EXECUTION_RESPONSE', 'The AI execution response session identifier is invalid.')
  }

  if (!isNonEmpty(metadata.contextId)) {
    return createError('INVALID_EXECUTION_RESPONSE', 'The AI execution response context identifier is invalid.')
  }

  if (!isNonEmpty(metadata.resolvedContextId)) {
    return createError('INVALID_EXECUTION_RESPONSE', 'The AI execution response resolved context identifier is invalid.')
  }

  if (!isNonEmpty(metadata.promptId)) {
    return createError('INVALID_EXECUTION_RESPONSE', 'The AI execution response prompt identifier is invalid.')
  }

  if (!isNonEmpty(metadata.providerId)) {
    return createError('INVALID_EXECUTION_RESPONSE', 'The AI execution response provider identifier is invalid.')
  }

  if (!isNonEmpty(metadata.model)) {
    return createError('INVALID_EXECUTION_RESPONSE', 'The AI execution response model is invalid.')
  }

  return null
}

function validateSessionUserMessageRelation(
  sessionMessages: readonly AIConversationMessage[],
  userMessage: AIConversationMessage,
): AIExecutionValidationError | null {
  if (sessionMessages.length === 0) {
    return createError(
      'INVALID_EXECUTION_REQUEST',
      'The AI execution session must already contain the user message.',
    )
  }

  const lastMessage = sessionMessages[sessionMessages.length - 1]
  if (lastMessage.id !== userMessage.id) {
    return createError(
      'INVALID_EXECUTION_REQUEST',
      'The AI execution session must end with the provided user message.',
    )
  }

  if (userMessage.role !== 'USER') {
    return createError('INVALID_MESSAGE', 'The AI execution user message role is invalid.')
  }

  return null
}

export function validateAIExecutionRequest(
  request: AIExecutionRequest,
): AIExecutionValidationError | null {
  if (request.protocolVersion !== AI_EXECUTION_PROTOCOL_VERSION) {
    return createError('INVALID_EXECUTION_REQUEST', 'The AI execution request protocol version is invalid.')
  }

  if (!isValidAIExecutionId(request.id)) {
    return createError('INVALID_EXECUTION_ID', 'The AI execution identifier is invalid.')
  }

  const conversationValidation = validateAIConversation(request.conversation)
  if (conversationValidation) {
    return createError('INVALID_CONVERSATION', conversationValidation.safeMessage)
  }

  const sessionValidation = new AIConversationSessionValidator().validate(request.session)
  if (sessionValidation) {
    return createError('INVALID_SESSION', sessionValidation.safeMessage)
  }

  const userMessageValidation = validateAIConversationMessage(request.userMessage)
  if (userMessageValidation) {
    return createError('INVALID_MESSAGE', userMessageValidation.safeMessage)
  }

  const metadataValidation = validateAIExecutionMetadata(request.metadata)
  if (metadataValidation) {
    return metadataValidation
  }

  if (request.session.conversation.conversationId !== request.conversation.conversationId) {
    return createError(
      'INVALID_EXECUTION_REQUEST',
      'The AI execution session does not belong to the provided conversation.',
    )
  }

  if (request.userMessage.conversationId !== request.conversation.conversationId) {
    return createError(
      'INVALID_MESSAGE',
      'The AI execution user message does not belong to the provided conversation.',
    )
  }

  if (request.userMessage.sessionId !== request.session.sessionId) {
    return createError(
      'INVALID_MESSAGE',
      'The AI execution user message does not belong to the provided session.',
    )
  }

  return validateSessionUserMessageRelation(request.session.messages, request.userMessage)
}

export function validateAIExecutionResponse(
  response: AIExecutionResponse,
): AIExecutionValidationError | null {
  if (response.protocolVersion !== AI_EXECUTION_PROTOCOL_VERSION) {
    return createError('INVALID_EXECUTION_RESPONSE', 'The AI execution response protocol version is invalid.')
  }

  if (!isValidAIExecutionId(response.id)) {
    return createError('INVALID_EXECUTION_ID', 'The AI execution identifier is invalid.')
  }

  const sessionValidation = new AIConversationSessionValidator().validate(response.session)
  if (sessionValidation) {
    return createError('INVALID_EXECUTION_RESPONSE', sessionValidation.safeMessage)
  }

  const assistantMessageValidation = validateAIConversationMessage(response.assistantMessage)
  if (assistantMessageValidation) {
    return createError('INVALID_EXECUTION_RESPONSE', assistantMessageValidation.safeMessage)
  }

  if (response.assistantMessage.role !== 'ASSISTANT') {
    return createError('INVALID_EXECUTION_RESPONSE', 'The AI execution assistant message role is invalid.')
  }

  if (response.assistantMessage.content.value !== response.providerResponse.content) {
    return createError(
      'INVALID_EXECUTION_RESPONSE',
      'The AI execution assistant message does not match the provider response.',
    )
  }

  const metadataValidation = validateAIExecutionResponseMetadata(response.metadata)
  if (metadataValidation) {
    return metadataValidation
  }

  if (response.metadata.conversationId !== response.assistantMessage.conversationId) {
    return createError(
      'INVALID_EXECUTION_RESPONSE',
      'The AI execution response conversation identifier is inconsistent.',
    )
  }

  if (response.metadata.sessionId !== response.assistantMessage.sessionId) {
    return createError(
      'INVALID_EXECUTION_RESPONSE',
      'The AI execution response session identifier is inconsistent.',
    )
  }

  if (response.session.sessionId !== response.metadata.sessionId) {
    return createError(
      'INVALID_EXECUTION_RESPONSE',
      'The AI execution response session snapshot is inconsistent.',
    )
  }

  if (response.metadata.providerId !== response.providerResponse.metadata.providerId) {
    return createError(
      'INVALID_EXECUTION_RESPONSE',
      'The AI execution response provider identifier is inconsistent.',
    )
  }

  return null
}
