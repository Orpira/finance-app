import {
  AI_CONVERSATION_PROTOCOL_VERSION,
  AI_CONVERSATION_ROLES,
  AI_CONVERSATION_STATUSES,
  type AIConversation,
  type AIConversationFailure,
  type AIConversationId,
  type AIConversationMetadata,
  type AIConversationParticipant,
  type AIConversationRole,
} from './aiConversationContracts'

const statuses = new Set<string>(AI_CONVERSATION_STATUSES)
const roles = new Set<string>(AI_CONVERSATION_ROLES)
const CONVERSATION_ID_PATTERN = /^conversation:[a-z0-9][a-z0-9:-]{2,127}$/

export function isAIConversationRole(value: string): value is AIConversationRole {
  return roles.has(value)
}

export function isValidAIConversationId(value: string): value is AIConversationId {
  return CONVERSATION_ID_PATTERN.test(value.trim())
}

export function validateAIConversationMetadata(
  metadata: AIConversationMetadata,
): AIConversationFailure | null {
  if (
    metadata.createdAt.trim().length === 0 ||
    (metadata.updatedAt !== undefined && metadata.updatedAt.trim().length === 0)
  ) {
    return {
      kind: 'failure',
      conversationId: '',
      code: 'INVALID_METADATA',
      retryable: false,
      safeMessage: 'The AI conversation metadata is invalid.',
    }
  }

  return null
}

export function validateAIConversationParticipant(
  participant: AIConversationParticipant,
): AIConversationFailure | null {
  if (
    participant.participantId.trim().length === 0 ||
    !isAIConversationRole(participant.role) ||
    (participant.displayName !== undefined && participant.displayName.trim().length === 0)
  ) {
    return {
      kind: 'failure',
      conversationId: '',
      code: 'INVALID_PARTICIPANT',
      retryable: false,
      safeMessage: 'The AI conversation participant is invalid.',
    }
  }

  return null
}

export function validateAIConversation(
  conversation: AIConversation,
): AIConversationFailure | null {
  if (
    conversation.protocolVersion !== AI_CONVERSATION_PROTOCOL_VERSION ||
    !isValidAIConversationId(conversation.conversationId) ||
    !statuses.has(conversation.status) ||
    conversation.participants.length === 0
  ) {
    return {
      kind: 'failure',
      conversationId: conversation.conversationId,
      code: 'INVALID_CONVERSATION',
      retryable: false,
      safeMessage: 'The AI conversation contract is invalid.',
    }
  }

  const participantIds = new Set<string>()
  for (const participant of conversation.participants) {
    const participantValidation = validateAIConversationParticipant(participant)
    if (participantValidation) {
      return {
        ...participantValidation,
        conversationId: conversation.conversationId,
      }
    }

    const normalizedId = participant.participantId.trim()
    if (participantIds.has(normalizedId)) {
      return {
        kind: 'failure',
        conversationId: conversation.conversationId,
        code: 'INVALID_PARTICIPANT',
        retryable: false,
        safeMessage: 'The AI conversation contains duplicated participant identifiers.',
      }
    }
    participantIds.add(normalizedId)
  }

  const metadataValidation = validateAIConversationMetadata(conversation.metadata)
  if (metadataValidation) {
    return {
      ...metadataValidation,
      conversationId: conversation.conversationId,
    }
  }

  return null
}
