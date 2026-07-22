import { AIConversationSession } from './AIConversationSession'
import type {
  AIConversationSessionId,
  AIConversationSessionResult,
  AIConversationSessionSnapshot,
  CreateAIConversationSessionInput,
} from './AIConversationSessionContracts'
import { AI_CONVERSATION_SESSION_PROTOCOL_VERSION } from './AIConversationSessionContracts'
import { AIConversationSessionValidator, isValidAIConversationSessionId } from './AIConversationSessionValidator'

function createFailure(
  sessionId: string,
  code: 'INVALID_SESSION_ID' | 'INVALID_SESSION',
  safeMessage: string,
) {
  return {
    kind: 'failure' as const,
    sessionId,
    code,
    retryable: false,
    safeMessage,
  }
}

export function createAIConversationSessionId(
  value: string,
): AIConversationSessionId | null {
  const normalized = value.trim()
  if (!isValidAIConversationSessionId(normalized)) {
    return null
  }

  return normalized as AIConversationSessionId
}

export function createAIConversationSession(
  input: CreateAIConversationSessionInput,
): AIConversationSessionResult {
  const sessionId = createAIConversationSessionId(input.sessionId)
  if (!sessionId) {
    return createFailure(
      input.sessionId,
      'INVALID_SESSION_ID',
      'The AI conversation session identifier is invalid.',
    )
  }

  const snapshot: AIConversationSessionSnapshot = {
    protocolVersion: AI_CONVERSATION_SESSION_PROTOCOL_VERSION,
    sessionId,
    conversation: input.conversation,
    status: input.status ?? 'CREATED',
    participants: input.conversation.participants,
    messages: [...(input.messages ?? [])],
    metadata: {
      ...input.metadata,
      ...(input.metadata.tags === undefined ? {} : { tags: [...input.metadata.tags] }),
    },
    interaction: null,
  }

  const validator = new AIConversationSessionValidator()
  const validation = validator.validate(snapshot)
  if (validation) {
    return createFailure(
      input.sessionId,
      'INVALID_SESSION',
      validation.safeMessage,
    )
  }

  const aggregate = new AIConversationSession(snapshot)
  return {
    kind: 'success',
    session: aggregate.getSnapshot(),
  }
}
