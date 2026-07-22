import { validateAIConversation } from '../aiConversationValidator'
import type {
  AIConversationSessionFailure,
  AIConversationSessionId,
  AIConversationSessionMetadata,
  AIConversationSessionSnapshot,
} from './AIConversationSessionContracts'
import {
  isAIConversationSessionEvent,
  type AIConversationSessionEvent,
} from './AIConversationSessionEvent'
import {
  AI_CONVERSATION_SESSION_TRANSITIONS,
  type AIConversationSessionTransition,
} from './AIConversationSessionTransition'
import {
  isAIConversationSessionStatus,
  isFinalAIConversationSessionStatus,
  type AIConversationSessionStatus,
} from './AIConversationSessionStatus'
import { validateAIConversationMessage } from '../message/AIConversationMessageValidator'

const SESSION_ID_PATTERN = /^session:[a-z0-9][a-z0-9:-]{2,127}$/

function createFailure(
  sessionId: string,
  code: AIConversationSessionFailure['code'],
  safeMessage: string,
): AIConversationSessionFailure {
  return {
    kind: 'failure',
    sessionId,
    code,
    retryable: false,
    safeMessage,
  }
}

export function isValidAIConversationSessionId(
  value: string,
): value is AIConversationSessionId {
  return SESSION_ID_PATTERN.test(value.trim())
}

export function validateAIConversationSessionMetadata(
  metadata: AIConversationSessionMetadata,
  sessionId = '',
): AIConversationSessionFailure | null {
  if (
    metadata.createdAt.trim().length === 0 ||
    (metadata.updatedAt !== undefined && metadata.updatedAt.trim().length === 0)
  ) {
    return createFailure(
      sessionId,
      'INVALID_SESSION_METADATA',
      'The AI conversation session metadata is invalid.',
    )
  }

  return null
}

export interface AIConversationSessionTransitionValidation {
  readonly allowed: boolean
  readonly from: string
  readonly event: string
  readonly nextStatus: AIConversationSessionStatus | null
  readonly code:
    | 'INVALID_SESSION_STATUS'
    | 'INVALID_SESSION_TRANSITION'
    | 'SESSION_FINAL_STATE_IMMUTABLE'
    | null
  readonly safeMessage: string
}

function buildTransitionTable(
  transitions: readonly AIConversationSessionTransition[],
): ReadonlyMap<AIConversationSessionStatus, ReadonlyMap<AIConversationSessionEvent, AIConversationSessionStatus>> {
  const table = new Map<AIConversationSessionStatus, Map<AIConversationSessionEvent, AIConversationSessionStatus>>()
  for (const transition of transitions) {
    const events = table.get(transition.from) ?? new Map<AIConversationSessionEvent, AIConversationSessionStatus>()
    events.set(transition.event, transition.to)
    table.set(transition.from, events)
  }
  return table
}

export class AIConversationSessionValidator {
  private readonly transitionTable: ReadonlyMap<
    AIConversationSessionStatus,
    ReadonlyMap<AIConversationSessionEvent, AIConversationSessionStatus>
  >

  constructor(
    transitions: readonly AIConversationSessionTransition[] = AI_CONVERSATION_SESSION_TRANSITIONS,
  ) {
    this.transitionTable = buildTransitionTable(transitions)
  }

  validate(session: AIConversationSessionSnapshot): AIConversationSessionFailure | null {
    if (!isValidAIConversationSessionId(session.sessionId)) {
      return createFailure(
        session.sessionId,
        'INVALID_SESSION_ID',
        'The AI conversation session identifier is invalid.',
      )
    }

    if (!isAIConversationSessionStatus(session.status)) {
      return createFailure(
        session.sessionId,
        'INVALID_SESSION_STATUS',
        'The AI conversation session status is invalid.',
      )
    }

    const conversationValidation = validateAIConversation(session.conversation)
    if (conversationValidation) {
      return createFailure(
        session.sessionId,
        'INVALID_SESSION',
        'The session references an invalid conversation contract.',
      )
    }

    if (session.participants.length === 0) {
      return createFailure(
        session.sessionId,
        'INVALID_SESSION',
        'The session must expose at least one participant.',
      )
    }

    const metadataValidation = validateAIConversationSessionMetadata(
      session.metadata,
      session.sessionId,
    )
    if (metadataValidation) {
      return metadataValidation
    }

    const seenSequences = new Set<number>()
    for (let index = 0; index < session.messages.length; index += 1) {
      const message = session.messages[index]
      const messageValidation = validateAIConversationMessage(message)
      if (messageValidation) {
        return {
          kind: 'failure',
          sessionId: session.sessionId,
          code: 'INVALID_SESSION_MESSAGES',
          retryable: false,
          safeMessage: 'The session contains an invalid conversation message.',
        }
      }

      if (
        message.conversationId !== session.conversation.conversationId ||
        message.sessionId !== session.sessionId
      ) {
        return createFailure(
          session.sessionId,
          'INVALID_SESSION_MESSAGES',
          'The session contains a message that does not belong to it.',
        )
      }

      if (message.sequence !== index || seenSequences.has(message.sequence)) {
        return createFailure(
          session.sessionId,
          'INVALID_SESSION_MESSAGES',
          'The session message ordering is invalid.',
        )
      }

      seenSequences.add(message.sequence)
    }

    if (session.messages.some((message) => message.id.trim().length === 0)) {
      return createFailure(
        session.sessionId,
        'INVALID_SESSION_MESSAGES',
        'The session messages collection contains invalid identifiers.',
      )
    }

    return null
  }

  validateTransition(
    from: string,
    event: string,
  ): AIConversationSessionTransitionValidation {
    if (!isAIConversationSessionStatus(from)) {
      return {
        allowed: false,
        from,
        event,
        nextStatus: null,
        code: 'INVALID_SESSION_STATUS',
        safeMessage: 'The AI conversation session status is invalid.',
      }
    }

    if (!isAIConversationSessionEvent(event)) {
      return {
        allowed: false,
        from,
        event,
        nextStatus: null,
        code: 'INVALID_SESSION_TRANSITION',
        safeMessage: 'The AI conversation session event is invalid.',
      }
    }

    if (isFinalAIConversationSessionStatus(from)) {
      return {
        allowed: false,
        from,
        event,
        nextStatus: null,
        code: 'SESSION_FINAL_STATE_IMMUTABLE',
        safeMessage: 'The AI conversation session is final and cannot transition.',
      }
    }

    const nextStatus = this.transitionTable.get(from)?.get(event) ?? null
    if (!nextStatus) {
      return {
        allowed: false,
        from,
        event,
        nextStatus: null,
        code: 'INVALID_SESSION_TRANSITION',
        safeMessage: 'The AI conversation session transition is not allowed.',
      }
    }

    return {
      allowed: true,
      from,
      event,
      nextStatus,
      code: null,
      safeMessage: 'Transition allowed.',
    }
  }
}
