import {
  AI_CONVERSATION_MESSAGE_FORMATS,
  AI_CONVERSATION_MESSAGE_PROTOCOL_VERSION,
  AI_CONVERSATION_MESSAGE_STATUSES,
  AI_CONVERSATION_MESSAGE_TYPES,
  type AIConversationMessage,
  type AIConversationMessageContent,
  type AIConversationMessageFailure,
  type AIConversationMessageMetadata,
  type AIConversationMessageStatus,
} from './AIConversationMessageContracts'
import { isValidAIConversationId } from '../aiConversationValidator'
import { isValidAIConversationSessionId } from '../session/AIConversationSessionValidator'
import { AI_CONVERSATION_ROLES, type AIConversationRole } from '../aiConversationContracts'

const statuses = new Set<string>(AI_CONVERSATION_MESSAGE_STATUSES)
const contentTypes = new Set<string>(AI_CONVERSATION_MESSAGE_TYPES)
const contentFormats = new Set<string>(AI_CONVERSATION_MESSAGE_FORMATS)
const roles = new Set<string>(AI_CONVERSATION_ROLES)
const MESSAGE_ID_PATTERN = /^message:[a-z0-9][a-z0-9:-]{2,127}$/
const MAX_MESSAGE_TEXT_LENGTH = 4000

function createFailure(
  messageId: string,
  code: AIConversationMessageFailure['code'],
  safeMessage: string,
): AIConversationMessageFailure {
  return {
    kind: 'failure',
    messageId,
    code,
    retryable: false,
    safeMessage,
  }
}

export function isValidAIConversationMessageId(value: string): boolean {
  return MESSAGE_ID_PATTERN.test(value.trim())
}

export function validateAIConversationMessageContent(
  content: AIConversationMessageContent,
): AIConversationMessageFailure | null {
  if (
    !contentTypes.has(content.kind) ||
    !contentFormats.has(content.format) ||
    content.value.trim().length === 0 ||
    content.value.length > MAX_MESSAGE_TEXT_LENGTH
  ) {
    return createFailure(
      '',
      'INVALID_MESSAGE_CONTENT',
      'The AI conversation message content is invalid.',
    )
  }

  return null
}

export function isAIConversationMessageRole(value: string): value is AIConversationRole {
  return roles.has(value)
}

export function validateAIConversationMessageStatus(
  status: AIConversationMessageStatus,
): AIConversationMessageFailure | null {
  if (!statuses.has(status)) {
    return createFailure(
      '',
      'INVALID_MESSAGE_STATUS',
      'The AI conversation message status is invalid.',
    )
  }

  return null
}

export function validateAIConversationMessageSequence(
  sequence: number,
): AIConversationMessageFailure | null {
  if (
    !Number.isSafeInteger(sequence) ||
    sequence < 0
  ) {
    return createFailure(
      '',
      'INVALID_MESSAGE_SEQUENCE',
      'The AI conversation message sequence is invalid.',
    )
  }

  return null
}

export function validateAIConversationMessageMetadata(
  metadata: AIConversationMessageMetadata,
): AIConversationMessageFailure | null {
  if (
    metadata.contractVersion !== AI_CONVERSATION_MESSAGE_PROTOCOL_VERSION ||
    typeof metadata.generatedLocally !== 'boolean' ||
    (metadata.correlationId !== undefined && metadata.correlationId.trim().length === 0) ||
    (metadata.interactionId !== undefined && metadata.interactionId.trim().length === 0) ||
    (metadata.tags !== undefined && metadata.tags.some((tag) => tag.trim().length === 0))
  ) {
    return createFailure(
      '',
      'INVALID_MESSAGE_METADATA',
      'The AI conversation message metadata is invalid.',
    )
  }

  return null
}

export function validateAIConversationMessage(
  message: AIConversationMessage,
): AIConversationMessageFailure | null {
  if (
    message.protocolVersion !== AI_CONVERSATION_MESSAGE_PROTOCOL_VERSION ||
    !isValidAIConversationMessageId(message.id) ||
    !isValidAIConversationId(message.conversationId) ||
    !isValidAIConversationSessionId(message.sessionId) ||
    !isAIConversationMessageRole(message.role) ||
    message.createdAt.trim().length === 0
  ) {
    return createFailure(
      message.id,
      'INVALID_MESSAGE',
      'The AI conversation message contract is invalid.',
    )
  }

  const contentValidation = validateAIConversationMessageContent(message.content)
  if (contentValidation) {
    return { ...contentValidation, messageId: message.id }
  }

  const statusValidation = validateAIConversationMessageStatus(message.status)
  if (statusValidation) {
    return { ...statusValidation, messageId: message.id }
  }

  const sequenceValidation = validateAIConversationMessageSequence(message.sequence)
  if (sequenceValidation) {
    return { ...sequenceValidation, messageId: message.id }
  }

  const metadataValidation = validateAIConversationMessageMetadata(message.metadata)
  if (metadataValidation) {
    return { ...metadataValidation, messageId: message.id }
  }

  return null
}
