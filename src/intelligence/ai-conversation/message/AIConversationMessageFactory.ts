import type {
  AIConversationMessage,
  AIConversationMessageContent,
  AIConversationMessageId,
  AIConversationMessageFailureCode,
  AIConversationMessageResult,
  CreateAIConversationMessageInput,
} from './AIConversationMessageContracts'
import {
  validateAIConversationMessage,
  validateAIConversationMessageContent,
  isValidAIConversationMessageId,
} from './AIConversationMessageValidator'
import { AI_CONVERSATION_MESSAGE_PROTOCOL_VERSION } from './AIConversationMessageContracts'

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested)
  }

  return Object.freeze(value)
}

function createFailure(
  messageId: string,
  code: AIConversationMessageFailureCode,
  safeMessage: string,
): AIConversationMessageResult {
  return {
    kind: 'failure',
    messageId,
    code,
    retryable: false,
    safeMessage,
  }
}

export function createAIConversationMessageId(
  value: string,
): AIConversationMessageId | null {
  const normalized = value.trim()
  if (!isValidAIConversationMessageId(normalized)) {
    return null
  }

  return normalized as AIConversationMessageId
}

export function createAIConversationMessageContent(
  input: AIConversationMessageContent,
): AIConversationMessageContent | null {
  const validation = validateAIConversationMessageContent(input)
  if (validation) {
    return null
  }

  return deepFreeze({ ...input })
}

export function createAIConversationMessage(
  input: CreateAIConversationMessageInput,
): AIConversationMessageResult {
  const messageId = createAIConversationMessageId(input.id)
  if (!messageId) {
    return createFailure(
      input.id,
      'INVALID_MESSAGE_ID',
      'The AI conversation message identifier is invalid.',
    )
  }

  const content = createAIConversationMessageContent({
    kind: input.content.kind ?? 'TEXT',
    value: input.content.value,
    format: input.content.format ?? 'PLAIN_TEXT',
  })
  if (!content) {
    return createFailure(
      input.id,
      'INVALID_MESSAGE_CONTENT',
      'The AI conversation message content is invalid.',
    )
  }

  const message: AIConversationMessage = {
    protocolVersion: AI_CONVERSATION_MESSAGE_PROTOCOL_VERSION,
    id: messageId,
    conversationId: input.conversationId.trim() as AIConversationMessage['conversationId'],
    sessionId: input.sessionId.trim() as AIConversationMessage['sessionId'],
    role: input.role,
    content,
    status: input.status ?? 'CREATED',
    sequence: input.sequence as AIConversationMessage['sequence'],
    createdAt: input.createdAt,
    metadata: {
      contractVersion:
        input.metadata.contractVersion ?? AI_CONVERSATION_MESSAGE_PROTOCOL_VERSION,
      generatedLocally: input.metadata.generatedLocally,
      ...(input.metadata.correlationId === undefined
        ? {}
        : { correlationId: input.metadata.correlationId }),
      ...(input.metadata.interactionId === undefined
        ? {}
        : { interactionId: input.metadata.interactionId }),
      ...(input.metadata.tags === undefined ? {} : { tags: [...input.metadata.tags] }),
    },
  }

  const validation = validateAIConversationMessage(message)
  if (validation) {
    return validation
  }

  return {
    kind: 'success',
    message: deepFreeze(message),
  }
}
