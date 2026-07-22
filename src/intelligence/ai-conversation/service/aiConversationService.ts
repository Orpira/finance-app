import type { AIConversationStatus, AIConversationParticipant } from '../aiConversationContracts'
import { createAIConversation } from '../aiConversationFactory'
import type { AIInteraction } from '../../ai-interaction/aiInteractionContracts'
import { AIInteractionLifecycle, type AIInteractionEvent } from '../../ai-interaction/lifecycle'
import type {
  AIInteractionPolicyEngine,
  AIInteractionPolicyEvaluationContext,
} from '../../ai-interaction/policies'
import {
  createAIConversationMessage,
  validateAIConversationMessage,
  type AIConversationMessage,
  type CreateAIConversationMessageInput,
} from '../message'
import {
  createAIConversationSession,
  type AIConversationSessionResult,
  type AIConversationSessionSnapshot,
  type AIConversationSessionStatus,
  type CreateAIConversationSessionInput,
} from '../session'
import { AIConversationSession } from '../session'
import { AIConversationSessionValidator } from '../session'
import {
  createDefaultAIConversationTurnIdFactory,
  type AIConversationTurnIdFactory,
} from './conversationTurnIdFactory'
import {
  createMockAIConversationReplyProvider,
  type AIConversationReplyProvider,
} from './aiConversationReplyProvider'

export const AI_CONVERSATION_SERVICE_FAILURE_CODES = [
  'INVALID_CONVERSATION',
  'INVALID_SESSION',
  'INVALID_MESSAGE',
  'INVALID_TRANSITION',
  'INVALID_SEQUENCE',
  'DUPLICATE_MESSAGE',
  'SESSION_NOT_WRITABLE',
  'POLICY_DENIED',
  'INTERACTION_ERROR',
] as const

export type AIConversationServiceFailureCode =
  (typeof AI_CONVERSATION_SERVICE_FAILURE_CODES)[number]

export interface AIConversationServiceFailure {
  readonly kind: 'failure'
  readonly code: AIConversationServiceFailureCode
  readonly retryable: false
  readonly safeMessage: string
}

export interface AIConversationServiceSuccess<TValue> {
  readonly kind: 'success'
  readonly value: TValue
}

export interface AIConversationTurnResult {
  readonly session: AIConversationSessionSnapshot
  readonly userMessage: AIConversationMessage
  readonly assistantMessage: AIConversationMessage
}

export interface StartAIConversationInput {
  readonly createdAt?: string
  readonly userParticipantId?: string
  readonly userDisplayName?: string
  readonly assistantParticipantId?: string
  readonly assistantDisplayName?: string
}

export interface SendAIConversationMessageInput {
  readonly session: AIConversationSessionSnapshot
  readonly message: string
}

export interface AIConversationServiceDependencies {
  readonly policyEngine?: AIInteractionPolicyEngine
  readonly policyContext?: AIInteractionPolicyEvaluationContext
  readonly replyProvider?: AIConversationReplyProvider
  readonly lifecycle?: AIInteractionLifecycle
  readonly idFactory?: AIConversationTurnIdFactory
  readonly now?: () => string
}

export type AIConversationServiceResult<TValue> =
  | AIConversationServiceSuccess<TValue>
  | AIConversationServiceFailure

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested)
  }

  return Object.freeze(value)
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

function failure(
  code: AIConversationServiceFailureCode,
  safeMessage: string,
): AIConversationServiceFailure {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
  }
}

function fromSessionResult(
  result: AIConversationSessionResult,
): AIConversationServiceResult<AIConversationSessionSnapshot> {
  if (result.kind === 'failure') {
    if (result.code === 'INVALID_SESSION_TRANSITION') {
      return failure('INVALID_TRANSITION', result.safeMessage)
    }
    return failure('INVALID_SESSION', result.safeMessage)
  }

  return { kind: 'success', value: result.session }
}

export interface AIConversationService {
  readonly startConversation: (
    input?: StartAIConversationInput,
  ) => AIConversationServiceResult<AIConversationSessionSnapshot>
  readonly sendMessage: (
    input: SendAIConversationMessageInput,
  ) => Promise<AIConversationServiceResult<AIConversationTurnResult>>
  readonly createConversationSession: (
    input: CreateAIConversationSessionInput,
  ) => AIConversationServiceResult<AIConversationSessionSnapshot>
  readonly activateConversationSession: (
    session: AIConversationSessionSnapshot,
  ) => AIConversationServiceResult<AIConversationSessionSnapshot>
  readonly pauseConversationSession: (
    session: AIConversationSessionSnapshot,
  ) => AIConversationServiceResult<AIConversationSessionSnapshot>
  readonly resumeConversationSession: (
    session: AIConversationSessionSnapshot,
  ) => AIConversationServiceResult<AIConversationSessionSnapshot>
  readonly completeConversationSession: (
    session: AIConversationSessionSnapshot,
  ) => AIConversationServiceResult<AIConversationSessionSnapshot>
  readonly cancelConversationSession: (
    session: AIConversationSessionSnapshot,
  ) => AIConversationServiceResult<AIConversationSessionSnapshot>
  readonly createUserMessage: (
    input: Omit<CreateAIConversationMessageInput, 'role'>,
  ) => AIConversationServiceResult<AIConversationMessage>
  readonly createAssistantMessage: (
    input: Omit<CreateAIConversationMessageInput, 'role'>,
  ) => AIConversationServiceResult<AIConversationMessage>
  readonly createSystemMessage: (
    input: Omit<CreateAIConversationMessageInput, 'role'>,
  ) => AIConversationServiceResult<AIConversationMessage>
  readonly appendMessage: (
    session: AIConversationSessionSnapshot,
    message: AIConversationMessage,
  ) => AIConversationServiceResult<AIConversationSessionSnapshot>
  readonly getMessages: (
    session: AIConversationSessionSnapshot,
  ) => AIConversationServiceResult<readonly AIConversationMessage[]>
  readonly getParticipants: (
    session: AIConversationSessionSnapshot,
  ) => AIConversationServiceResult<readonly AIConversationParticipant[]>
  readonly getConversationStatus: (
    session: AIConversationSessionSnapshot,
  ) => AIConversationServiceResult<AIConversationStatus>
  readonly getSessionStatus: (
    session: AIConversationSessionSnapshot,
  ) => AIConversationServiceResult<AIConversationSessionStatus>
  readonly evaluateInteractionPolicy: (
    session: AIConversationSessionSnapshot,
    interaction: AIInteraction,
    policyEngine: AIInteractionPolicyEngine,
    context: AIInteractionPolicyEvaluationContext,
  ) => AIConversationServiceResult<AIConversationSessionSnapshot>
  readonly applyInteractionLifecycleEvent: (
    session: AIConversationSessionSnapshot,
    event: AIInteractionEvent,
    lifecycle?: AIInteractionLifecycle,
  ) => AIConversationServiceResult<AIConversationSessionSnapshot>
}

const DEFAULT_POLICY_CONTEXT: AIInteractionPolicyEvaluationContext = {
  hasAuthorizedContext: true,
  hasUserConfirmation: true,
  containsSensitiveData: false,
  redactionApplied: true,
}

export function createAIConversationService(
  dependencies: AIConversationServiceDependencies = {},
): AIConversationService {
  const sessionValidator = new AIConversationSessionValidator()
  const lifecycle = dependencies.lifecycle ?? new AIInteractionLifecycle()
  const policyContext = dependencies.policyContext ?? DEFAULT_POLICY_CONTEXT
  const replyProvider =
    dependencies.replyProvider ?? createMockAIConversationReplyProvider()
  const idFactory =
    dependencies.idFactory ?? createDefaultAIConversationTurnIdFactory()
  const now = dependencies.now ?? (() => new Date().toISOString())

  function ensureValidSession(
    session: AIConversationSessionSnapshot,
  ): AIConversationServiceResult<AIConversationSessionSnapshot> {
    const validation = sessionValidator.validate(session)
    if (validation) {
      return failure('INVALID_SESSION', validation.safeMessage)
    }

    return { kind: 'success', value: session }
  }

  function ensureWritableSession(
    session: AIConversationSessionSnapshot,
  ): AIConversationServiceResult<AIConversationSessionSnapshot> {
    if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
      return failure(
        'SESSION_NOT_WRITABLE',
        'The conversation session is closed and cannot accept messages.',
      )
    }

    return { kind: 'success', value: session }
  }

  function createMessageWithRole(
    input: Omit<CreateAIConversationMessageInput, 'role'>,
    role: 'USER' | 'ASSISTANT' | 'SYSTEM',
  ): AIConversationServiceResult<AIConversationMessage> {
    const created = createAIConversationMessage({
      ...input,
      role,
    })
    if (created.kind === 'failure') {
      return failure('INVALID_MESSAGE', created.safeMessage)
    }

    return { kind: 'success', value: created.message }
  }

  function transitionSession(
    session: AIConversationSessionSnapshot,
    operation: (aggregate: AIConversationSession) => AIConversationSessionResult,
  ): AIConversationServiceResult<AIConversationSessionSnapshot> {
    const validSession = ensureValidSession(session)
    if (validSession.kind === 'failure') {
      return validSession
    }

    const aggregate = new AIConversationSession(session)
    return fromSessionResult(operation(aggregate))
  }

  function buildInteraction(createdAt: string): AIInteraction {
    return {
      protocolVersion: 1,
      interactionId: idFactory.create('interaction'),
      intent: 'EDUCATIONAL_GUIDANCE',
      requiredCapabilities: ['TEXT_GENERATION'],
      policy: {
        policyId: 'conversation-preview',
        policyVersion: '1.0.0',
        purpose: 'EDUCATIONAL_GUIDANCE',
        processingMode: 'LOCAL_ONLY',
      },
      status: 'CREATED',
      metadata: {
        createdAt,
        source: 'CONVERSATION',
      },
    }
  }

  function createUserConversationMessage(
    session: AIConversationSessionSnapshot,
    content: string,
    createdAt: string,
  ): AIConversationServiceResult<AIConversationMessage> {
    return service.createUserMessage({
      id: idFactory.create('message'),
      conversationId: session.conversation.conversationId,
      sessionId: session.sessionId,
      content: { value: content },
      sequence: session.messages.length,
      createdAt,
      metadata: {
        generatedLocally: true,
      },
    })
  }

  function createAssistantConversationMessage(
    session: AIConversationSessionSnapshot,
    content: string,
    interactionId: string,
    createdAt: string,
    correlationId?: string,
    tags?: readonly string[],
  ): AIConversationServiceResult<AIConversationMessage> {
    return service.createAssistantMessage({
      id: idFactory.create('message'),
      conversationId: session.conversation.conversationId,
      sessionId: session.sessionId,
      content: { value: content },
      sequence: session.messages.length,
      createdAt,
      metadata: {
        generatedLocally: false,
        interactionId,
        ...(correlationId === undefined ? {} : { correlationId }),
        ...(tags === undefined ? {} : { tags }),
      },
    })
  }

  const service: AIConversationService = {
    startConversation(input = {}) {
      const createdAt = input.createdAt ?? now()
      const createdConversation = createAIConversation({
        conversationId: idFactory.create('conversation'),
        status: 'OPEN',
        participants: [
          {
            participantId: input.userParticipantId ?? 'user:current',
            role: 'USER',
            active: true,
            ...(input.userDisplayName === undefined
              ? {}
              : { displayName: input.userDisplayName }),
          },
          {
            participantId: input.assistantParticipantId ?? 'assistant:preview',
            role: 'ASSISTANT',
            active: true,
            ...(input.assistantDisplayName === undefined
              ? {}
              : { displayName: input.assistantDisplayName }),
          },
        ],
        metadata: {
          createdAt,
          source: 'APPLICATION',
        },
      })

      if (createdConversation.kind !== 'success') {
        return failure('INVALID_CONVERSATION', createdConversation.safeMessage)
      }

      return service.createConversationSession({
        sessionId: idFactory.create('session'),
        conversation: createdConversation.conversation,
        metadata: {
          createdAt,
          source: 'APPLICATION',
        },
      })
    },

    async sendMessage(input) {
      const createdAt = now()
      const validSession = ensureValidSession(input.session)
      if (validSession.kind === 'failure') {
        return validSession
      }

      const userMessage = createUserConversationMessage(
        input.session,
        input.message,
        createdAt,
      )
      if (userMessage.kind === 'failure') {
        return userMessage
      }

      const appendedUserMessage = service.appendMessage(input.session, userMessage.value)
      if (appendedUserMessage.kind === 'failure') {
        return appendedUserMessage
      }

      const policyEngine = dependencies.policyEngine
      if (!policyEngine) {
        return failure(
          'INTERACTION_ERROR',
          'The conversation service is missing a policy engine dependency.',
        )
      }

      const interaction = buildInteraction(createdAt)
      const policyEvaluated = service.evaluateInteractionPolicy(
        appendedUserMessage.value,
        interaction,
        policyEngine,
        policyContext,
      )
      if (policyEvaluated.kind === 'failure') {
        return policyEvaluated
      }

      const validatedInteraction = service.applyInteractionLifecycleEvent(
        policyEvaluated.value,
        'VALIDATE',
        lifecycle,
      )
      if (validatedInteraction.kind === 'failure') {
        return validatedInteraction
      }

      const authorizedInteraction = service.applyInteractionLifecycleEvent(
        validatedInteraction.value,
        'AUTHORIZE',
        lifecycle,
      )
      if (authorizedInteraction.kind === 'failure') {
        return authorizedInteraction
      }

      const builtContextInteraction = service.applyInteractionLifecycleEvent(
        authorizedInteraction.value,
        'BUILD_CONTEXT',
        lifecycle,
      )
      if (builtContextInteraction.kind === 'failure') {
        return builtContextInteraction
      }

      const executingInteraction = service.applyInteractionLifecycleEvent(
        builtContextInteraction.value,
        'EXECUTE',
        lifecycle,
      )
      if (executingInteraction.kind === 'failure') {
        return executingInteraction
      }

      const reply = await replyProvider.generateReply({
        interaction,
        session: executingInteraction.value,
        userMessage: userMessage.value,
      })

      if (reply.kind === 'failure') {
        const failedInteraction = service.applyInteractionLifecycleEvent(
          executingInteraction.value,
          'FAIL',
          lifecycle,
        )
        if (failedInteraction.kind === 'failure') {
          return failedInteraction
        }

        return failure('INTERACTION_ERROR', reply.safeMessage)
      }

      const assistantMessage = createAssistantConversationMessage(
        executingInteraction.value,
        reply.content,
        interaction.interactionId,
        reply.createdAt ?? now(),
        reply.metadata?.correlationId,
        reply.metadata?.tags,
      )
      if (assistantMessage.kind === 'failure') {
        return assistantMessage
      }

      const completedSession = service.appendMessage(
        executingInteraction.value,
        assistantMessage.value,
      )
      if (completedSession.kind === 'failure') {
        return completedSession
      }

      const succeededInteraction = service.applyInteractionLifecycleEvent(
        completedSession.value,
        'COMPLETE',
        lifecycle,
      )
      if (succeededInteraction.kind === 'failure') {
        return succeededInteraction
      }

      return {
        kind: 'success',
        value: {
          session: succeededInteraction.value,
          userMessage: userMessage.value,
          assistantMessage: assistantMessage.value,
        },
      }
    },

    createConversationSession(input) {
      const created = createAIConversationSession(input)
      if (created.kind === 'failure') {
        return failure('INVALID_CONVERSATION', created.safeMessage)
      }

      return {
        kind: 'success',
        value: created.session,
      }
    },

    activateConversationSession(session) {
      return transitionSession(session, (aggregate) => aggregate.activate())
    },

    pauseConversationSession(session) {
      return transitionSession(session, (aggregate) => aggregate.pause())
    },

    resumeConversationSession(session) {
      return transitionSession(session, (aggregate) => aggregate.resume())
    },

    completeConversationSession(session) {
      return transitionSession(session, (aggregate) => aggregate.complete())
    },

    cancelConversationSession(session) {
      return transitionSession(session, (aggregate) => aggregate.cancel())
    },

    createUserMessage(input) {
      return createMessageWithRole(input, 'USER')
    },

    createAssistantMessage(input) {
      return createMessageWithRole(input, 'ASSISTANT')
    },

    createSystemMessage(input) {
      return createMessageWithRole(input, 'SYSTEM')
    },

    appendMessage(session, message) {
      const validSession = ensureValidSession(session)
      if (validSession.kind === 'failure') {
        return validSession
      }

      const writableSession = ensureWritableSession(session)
      if (writableSession.kind === 'failure') {
        return writableSession
      }

      const messageValidation = validateAIConversationMessage(message)
      if (messageValidation) {
        return failure('INVALID_MESSAGE', messageValidation.safeMessage)
      }

      if (
        message.conversationId !== session.conversation.conversationId ||
        message.sessionId !== session.sessionId
      ) {
        return failure(
          'INVALID_MESSAGE',
          'The message does not belong to the target conversation session.',
        )
      }

      if (message.sequence !== session.messages.length) {
        return failure('INVALID_SEQUENCE', 'The message sequence is out of order.')
      }

      if (session.messages.some((existing) => existing.id === message.id)) {
        return failure(
          'DUPLICATE_MESSAGE',
          'The session already contains a message with the same identifier.',
        )
      }

      const nextSnapshot: AIConversationSessionSnapshot = {
        ...session,
        messages: [...session.messages.map((entry) => cloneMessage(entry)), cloneMessage(message)],
        metadata: {
          ...session.metadata,
          updatedAt: message.createdAt,
        },
      }

      const validation = sessionValidator.validate(nextSnapshot)
      if (validation) {
        return failure('INVALID_SESSION', validation.safeMessage)
      }

      return {
        kind: 'success',
        value: new AIConversationSession(nextSnapshot).getSnapshot(),
      }
    },

    getMessages(session) {
      const validSession = ensureValidSession(session)
      if (validSession.kind === 'failure') {
        return validSession
      }

      return {
        kind: 'success',
        value: deepFreeze(session.messages.map((message) => cloneMessage(message))),
      }
    },

    getParticipants(session) {
      const validSession = ensureValidSession(session)
      if (validSession.kind === 'failure') {
        return validSession
      }

      return {
        kind: 'success',
        value: deepFreeze(session.participants.map((participant) => ({ ...participant }))),
      }
    },

    getConversationStatus(session) {
      const validSession = ensureValidSession(session)
      if (validSession.kind === 'failure') {
        return validSession
      }

      return {
        kind: 'success',
        value: session.conversation.status,
      }
    },

    getSessionStatus(session) {
      const validSession = ensureValidSession(session)
      if (validSession.kind === 'failure') {
        return validSession
      }

      return {
        kind: 'success',
        value: session.status,
      }
    },

    evaluateInteractionPolicy(session, interaction, policyEngine, context) {
      const validSession = ensureValidSession(session)
      if (validSession.kind === 'failure') {
        return validSession
      }

      const aggregate = new AIConversationSession(session)
      const result = aggregate.evaluateInteractionPolicy(interaction, policyEngine, context)
      if (result.kind === 'failure') {
        if (result.code === 'POLICY_DENIED') {
          return failure('POLICY_DENIED', result.safeMessage)
        }
        return failure('INTERACTION_ERROR', result.safeMessage)
      }

      return {
        kind: 'success',
        value: result.session,
      }
    },

    applyInteractionLifecycleEvent(session, event, lifecycle) {
      const validSession = ensureValidSession(session)
      if (validSession.kind === 'failure') {
        return validSession
      }

      const aggregate = new AIConversationSession(session)
      const result = aggregate.applyInteractionLifecycleEvent(
        event,
        lifecycle ?? new AIInteractionLifecycle(),
      )
      if (result.kind === 'failure') {
        return failure('INTERACTION_ERROR', result.safeMessage)
      }

      return {
        kind: 'success',
        value: result.session,
      }
    },
  }

  return service
}
