import type { AIConversation } from '../aiConversationContracts'
import {
  AIInteractionLifecycle,
  type AIInteractionEvent,
  type AIInteractionState,
  isAIInteractionState,
} from '../../ai-interaction/lifecycle'
import type { AIInteraction } from '../../ai-interaction/aiInteractionContracts'
import {
  type AIInteractionPolicyEvaluationContext,
  type AIInteractionPolicyEngine,
} from '../../ai-interaction/policies'
import type {
  AIConversationSessionFailure,
  AIConversationSessionInteraction,
  AIConversationSessionResult,
  AIConversationSessionSnapshot,
} from './AIConversationSessionContracts'
import type { AIConversationSessionStatus } from './AIConversationSessionStatus'
import { AIConversationSessionValidator } from './AIConversationSessionValidator'
import type { AIConversationMessage } from '../message/AIConversationMessageContracts'

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested)
  }

  return Object.freeze(value)
}

function cloneConversation(conversation: AIConversation): AIConversation {
  return {
    ...conversation,
    participants: conversation.participants.map((participant) => ({ ...participant })),
    metadata: {
      ...conversation.metadata,
      ...(conversation.metadata.tags === undefined
        ? {}
        : { tags: [...conversation.metadata.tags] }),
    },
  }
}

function cloneMessage(message: AIConversationMessage): AIConversationMessage {
  return {
    ...message,
    content: { ...message.content },
    metadata: {
      ...message.metadata,
      ...(message.metadata.tags === undefined
        ? {}
        : { tags: [...message.metadata.tags] }),
    },
  }
}

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

export class AIConversationSession {
  private readonly snapshot: AIConversationSessionSnapshot
  private readonly validator: AIConversationSessionValidator

  constructor(snapshot: AIConversationSessionSnapshot) {
    this.validator = new AIConversationSessionValidator()
    this.snapshot = deepFreeze({
      ...snapshot,
      conversation: cloneConversation(snapshot.conversation),
      participants: snapshot.participants.map((participant) => ({ ...participant })),
      messages: snapshot.messages.map((message) => cloneMessage(message)),
      metadata: {
        ...snapshot.metadata,
        ...(snapshot.metadata.tags === undefined
          ? {}
          : { tags: [...snapshot.metadata.tags] }),
      },
      interaction: snapshot.interaction === null
        ? null
        : { ...snapshot.interaction },
    })
  }

  getSnapshot(): AIConversationSessionSnapshot {
    return this.snapshot
  }

  getConversation(): AIConversation {
    return this.snapshot.conversation
  }

  getParticipants(): AIConversationSessionSnapshot['participants'] {
    return this.snapshot.participants
  }

  getMessages(): AIConversationSessionSnapshot['messages'] {
    return this.snapshot.messages
  }

  getStatus(): AIConversationSessionStatus {
    return this.snapshot.status
  }

  getInteraction(): AIConversationSessionInteraction | null {
    return this.snapshot.interaction
  }

  activate(): AIConversationSessionResult {
    return this.applySessionEvent('ACTIVATE')
  }

  pause(): AIConversationSessionResult {
    return this.applySessionEvent('PAUSE')
  }

  resume(): AIConversationSessionResult {
    return this.applySessionEvent('RESUME')
  }

  complete(): AIConversationSessionResult {
    return this.applySessionEvent('COMPLETE')
  }

  cancel(): AIConversationSessionResult {
    return this.applySessionEvent('CANCEL')
  }

  evaluateInteractionPolicy(
    interaction: AIInteraction,
    policyEngine: AIInteractionPolicyEngine,
    context: AIInteractionPolicyEvaluationContext,
  ): AIConversationSessionResult {
    const decision = policyEngine.evaluate(interaction, context)
    if (decision.kind !== 'ALLOW') {
      return createFailure(
        this.snapshot.sessionId,
        'POLICY_DENIED',
        'The interaction policy denied this conversation session operation.',
      )
    }

    return this.withInteraction({
      interactionId: interaction.interactionId,
      lifecycleState: 'CREATED',
      policyDecision: decision.kind,
    })
  }

  applyInteractionLifecycleEvent(
    event: AIInteractionEvent,
    lifecycle: AIInteractionLifecycle = new AIInteractionLifecycle(),
  ): AIConversationSessionResult {
    if (!this.snapshot.interaction) {
      return createFailure(
        this.snapshot.sessionId,
        'INVALID_INTERACTION',
        'No interaction is linked to this conversation session.',
      )
    }

    let nextState: AIInteractionState
    try {
      const resolved = lifecycle.applyEvent(this.snapshot.interaction.lifecycleState, event)
      if (!isAIInteractionState(resolved)) {
        return createFailure(
          this.snapshot.sessionId,
          'INTERACTION_LIFECYCLE_ERROR',
          'The interaction lifecycle returned an invalid state.',
        )
      }
      nextState = resolved
    } catch {
      return createFailure(
        this.snapshot.sessionId,
        'INTERACTION_LIFECYCLE_ERROR',
        'The interaction lifecycle transition is invalid for this session.',
      )
    }

    return this.withInteraction({
      ...this.snapshot.interaction,
      lifecycleState: nextState,
    })
  }

  private withInteraction(
    interaction: AIConversationSessionInteraction | null,
  ): AIConversationSessionResult {
    const candidate: AIConversationSessionSnapshot = {
      ...this.snapshot,
      interaction,
      metadata: {
        ...this.snapshot.metadata,
        updatedAt: new Date().toISOString(),
      },
    }

    const validation = this.validator.validate(candidate)
    if (validation) {
      return validation
    }

    return {
      kind: 'success',
      session: new AIConversationSession(candidate).getSnapshot(),
    }
  }

  private applySessionEvent(event: string): AIConversationSessionResult {
    const transition = this.validator.validateTransition(this.snapshot.status, event)
    if (!transition.allowed || !transition.nextStatus) {
      return createFailure(
        this.snapshot.sessionId,
        'INVALID_SESSION_TRANSITION',
        transition.safeMessage,
      )
    }

    const candidate: AIConversationSessionSnapshot = {
      ...this.snapshot,
      status: transition.nextStatus,
      metadata: {
        ...this.snapshot.metadata,
        updatedAt: new Date().toISOString(),
      },
    }

    const validation = this.validator.validate(candidate)
    if (validation) {
      return validation
    }

    return {
      kind: 'success',
      session: new AIConversationSession(candidate).getSnapshot(),
    }
  }
}
