import {
  AI_CONVERSATION_PROTOCOL_VERSION,
  type AIConversation,
  type AIConversationId,
  type AIConversationMetadata,
  type AIConversationParticipant,
  type AIConversationResult,
  type AIConversationStatus,
} from './aiConversationContracts'
import { isValidAIConversationId, validateAIConversation } from './aiConversationValidator'

export interface CreateAIConversationInput {
  readonly conversationId: string
  readonly status: AIConversationStatus
  readonly participants: readonly AIConversationParticipant[]
  readonly metadata: AIConversationMetadata
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested)
  }

  return Object.freeze(value)
}

export function createAIConversationId(value: string): AIConversationId | null {
  const normalized = value.trim()
  if (!isValidAIConversationId(normalized)) {
    return null
  }

  return normalized as AIConversationId
}

export function createAIConversation(
  input: CreateAIConversationInput,
): AIConversationResult {
  const conversationId = createAIConversationId(input.conversationId)
  if (!conversationId) {
    return {
      kind: 'failure',
      conversationId: input.conversationId,
      code: 'INVALID_CONVERSATION_ID',
      retryable: false,
      safeMessage: 'The AI conversation identifier is invalid.',
    }
  }

  const conversation: AIConversation = {
    protocolVersion: AI_CONVERSATION_PROTOCOL_VERSION,
    conversationId,
    status: input.status,
    participants: input.participants.map((participant) => ({ ...participant })),
    metadata: {
      ...input.metadata,
      ...(input.metadata.tags === undefined
        ? {}
        : { tags: [...input.metadata.tags] }),
    },
  }

  const validation = validateAIConversation(conversation)
  if (validation) {
    return validation
  }

  return {
    kind: 'success',
    conversation: deepFreeze(conversation),
  }
}
