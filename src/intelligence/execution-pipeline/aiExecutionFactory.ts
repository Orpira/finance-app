import type {
  AIConversation,
  AIConversationMessage,
  AIConversationSessionSnapshot,
} from '../ai-conversation'
import type { AIPromptJsonValue } from '../prompt-builder'
import type {
  AIExecutionErrorCode,
  AIExecutionFailure,
  AIExecutionId,
  AIExecutionMetadata,
  AIExecutionRequest,
  AIExecutionRequestResult,
  AIExecutionRequestSuccess,
  AIExecutionResponse,
  AIExecutionResponseMetadata,
  AIExecutionResponseResult,
  AIExecutionResponseSuccess,
  CreateAIExecutionRequestInput,
  CreateAIExecutionResponseInput,
} from './aiExecutionContracts'
import {
  AI_EXECUTION_PROTOCOL_VERSION,
} from './aiExecutionContracts'
import {
  isValidAIExecutionId,
  validateAIExecutionRequest,
  validateAIExecutionResponse,
} from './aiExecutionValidator'

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested)
  }

  return Object.freeze(value)
}

function cloneConversation<T extends AIConversation | AIConversationSessionSnapshot | AIConversationMessage>(
  value: T,
): T {
  return structuredClone(value) as T
}

function cloneAttributes(
  attributes: Readonly<Record<string, AIPromptJsonValue>> | undefined,
) {
  return attributes === undefined ? {} : { attributes: structuredClone(attributes) }
}

function createFailure(
  code: AIExecutionErrorCode,
  safeMessage: string,
  retryable = false,
): AIExecutionFailure {
  return {
    kind: 'failure',
    code,
    retryable,
    safeMessage,
  }
}

function createRequestSuccess(request: AIExecutionRequest): AIExecutionRequestSuccess {
  return {
    kind: 'success',
    request,
  }
}

function createResponseSuccess(response: AIExecutionResponse): AIExecutionResponseSuccess {
  return {
    kind: 'success',
    response,
  }
}

function normalizeExecutionMetadata(
  metadata: CreateAIExecutionRequestInput['metadata'],
): AIExecutionMetadata {
  return {
    protocolVersion: metadata.protocolVersion ?? AI_EXECUTION_PROTOCOL_VERSION,
    createdAt: metadata.createdAt,
    source: metadata.source,
    deterministic: metadata.deterministic ?? true,
    failClosed: metadata.failClosed ?? true,
    providerId: metadata.providerId,
    model: metadata.model,
    ...(metadata.resolutionStrategy === undefined
      ? {}
      : { resolutionStrategy: metadata.resolutionStrategy }),
    ...(metadata.temperature === undefined ? {} : { temperature: metadata.temperature }),
    ...(metadata.maxOutputTokens === undefined
      ? {}
      : { maxOutputTokens: metadata.maxOutputTokens }),
    ...(metadata.timeoutMs === undefined ? {} : { timeoutMs: metadata.timeoutMs }),
    ...(metadata.responseFormat === undefined
      ? {}
      : { responseFormat: metadata.responseFormat }),
    ...(metadata.tags === undefined ? {} : { tags: [...metadata.tags] }),
    ...cloneAttributes(metadata.attributes),
  }
}

function normalizeExecutionResponseMetadata(
  metadata: CreateAIExecutionResponseInput['metadata'],
): AIExecutionResponseMetadata {
  return {
    protocolVersion: metadata.protocolVersion ?? AI_EXECUTION_PROTOCOL_VERSION,
    createdAt: metadata.createdAt,
    source: metadata.source,
    deterministic: metadata.deterministic ?? true,
    failClosed: metadata.failClosed ?? true,
    requestId: metadata.requestId,
    conversationId: metadata.conversationId,
    sessionId: metadata.sessionId,
    contextId: metadata.contextId,
    resolvedContextId: metadata.resolvedContextId,
    promptId: metadata.promptId,
    providerId: metadata.providerId,
    model: metadata.model,
    ...(metadata.tags === undefined ? {} : { tags: [...metadata.tags] }),
    ...cloneAttributes(metadata.attributes),
  }
}

export function createExecutionId(value: string): AIExecutionId | null {
  const normalized = value.trim()
  if (!isValidAIExecutionId(normalized)) {
    return null
  }

  return normalized as AIExecutionId
}

export function createExecutionRequest(
  input: CreateAIExecutionRequestInput,
): AIExecutionRequestResult {
  const id = createExecutionId(input.id)
  if (!id) {
    return createFailure('INVALID_EXECUTION_ID', 'The AI execution identifier is invalid.')
  }

  const request: AIExecutionRequest = {
    protocolVersion: AI_EXECUTION_PROTOCOL_VERSION,
    id,
    conversation: cloneConversation(input.conversation),
    session: cloneConversation(input.session),
    userMessage: cloneConversation(input.userMessage),
    metadata: normalizeExecutionMetadata(input.metadata),
  }

  const validation = validateAIExecutionRequest(request)
  if (validation) {
    return createFailure(validation.code, validation.safeMessage)
  }

  return createRequestSuccess(deepFreeze(request))
}

export function createExecutionResponse(
  input: CreateAIExecutionResponseInput,
): AIExecutionResponseResult {
  const id = createExecutionId(input.id)
  if (!id) {
    return createFailure('INVALID_EXECUTION_ID', 'The AI execution identifier is invalid.')
  }

  const response: AIExecutionResponse = {
    protocolVersion: AI_EXECUTION_PROTOCOL_VERSION,
    id,
    session: cloneConversation(input.session),
    assistantMessage: cloneConversation(input.assistantMessage),
    providerResponse: structuredClone(input.providerResponse),
    metadata: normalizeExecutionResponseMetadata(input.metadata),
  }

  const validation = validateAIExecutionResponse(response)
  if (validation) {
    return createFailure(validation.code, validation.safeMessage)
  }

  return createResponseSuccess(deepFreeze(response))
}
