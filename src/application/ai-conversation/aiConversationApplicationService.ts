import type {
  AIConversationMessage,
} from '../../intelligence/ai-conversation'
import {
  createContextBuilder,
  createContextSectionFromConversationMessage,
  createContextSectionFromSession,
  type AIContextPriority,
} from '../../intelligence/context-builder'
import {
  createExecutionRequest,
  createAIExecutionPipeline,
  type AIExecutionContextBuilderPort,
  type AIExecutionContextResolverPort,
  type AIExecutionPromptBuilderPort,
  type AIExecutionPipeline,
} from '../../intelligence/execution-pipeline'
import {
  createAIContextResolver,
} from '../../intelligence/context-resolution'
import type {
  AIToolExecutor,
} from '../../intelligence/ai-tools'
import {
  createPromptBuilder,
  createPromptSegmentFromConversationMessage,
  type AIPromptPriority,
} from '../../intelligence/prompt-builder'
import type { AIExecutionInspector } from '../../intelligence/execution-inspector'
import type { AIProvider } from '../../intelligence/provider'
import {
  type AIConversationApplicationFailure,
  type AIConversationApplicationMemoryClearResponse,
  type AIConversationApplicationMemoryDeleteRequest,
  type AIConversationApplicationMemoryDeleteResponse,
  type AIConversationApplicationMemoryLoadRequest,
  type AIConversationApplicationMemorySaveRequest,
  type AIConversationApplicationMemorySaveResponse,
  type AIConversationApplicationResult,
  type AIConversationApplicationService,
  type AIConversationApplicationServiceDependencies,
} from './aiConversationApplicationContracts'
import type {
  AIConversationMemoryFailure,
  AIConversationMemoryMetadata,
  AIConversationMemoryPort,
  AIConversationRetentionPolicy,
} from './aiConversationMemoryContracts'
import {
  validateAIConversationApplicationSendRequest,
} from './aiConversationApplicationValidator'
import { AIConversationSessionValidator } from '../../intelligence/ai-conversation/session'

function failure(
  code: AIConversationApplicationFailure['code'],
  safeMessage: string,
  retryable = false,
): AIConversationApplicationFailure {
  return {
    kind: 'failure',
    code,
    retryable,
    safeMessage,
  }
}

function success<TValue>(value: TValue): AIConversationApplicationResult<TValue> {
  return {
    kind: 'success',
    value,
  }
}

function normalizeIdentifierFragment(value: string): string {
  return value.replace(/[^a-z0-9:-]/gi, '-').toLowerCase()
}

function contextPriorityFromMessage(message: AIConversationMessage): AIContextPriority {
  if (message.role === 'USER') {
    return 'HIGH'
  }

  if (message.role === 'SYSTEM') {
    return 'CRITICAL'
  }

  return 'NORMAL'
}

function promptPriorityFromResolvedSection(
  priority: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW',
): AIPromptPriority {
  if (priority === 'CRITICAL') return 'CRITICAL'
  if (priority === 'HIGH') return 'HIGH'
  if (priority === 'NORMAL') return 'MEDIUM'
  return 'LOW'
}

function earliestTimestamp(values: readonly string[]): string {
  return [...values].sort((left, right) => left.localeCompare(right))[0]
}

function debugConversationBoundary(event: string, payload: Record<string, unknown>): void {
  // Temporal: trazas sanitizadas para auditar consistencia entre pipeline y controller.
  console.info('[ConversationTrace]', event, payload)
}

const DEFAULT_RETENTION_POLICY: AIConversationRetentionPolicy = {
  maxSessions: 25,
  maxMessagesPerSession: 300,
  evictionStrategy: 'KEEP_MOST_RECENT',
}

function resolveRetentionPolicy(
  configured?: AIConversationRetentionPolicy,
): AIConversationRetentionPolicy {
  if (configured === undefined) {
    return DEFAULT_RETENTION_POLICY
  }

  return configured
}

function validateMemorySession(
  session: AIConversationApplicationMemorySaveRequest['session'],
): AIConversationApplicationFailure | null {
  const validation = new AIConversationSessionValidator().validate(session)
  if (validation) {
    return failure('INVALID_CONVERSATION', 'La sesion de conversacion no cumple el contrato canonico.')
  }
  return null
}

function mapMemoryFailureToApplicationFailure(
  code: AIConversationMemoryFailure['code'],
  safeMessage: string,
  retryable: boolean,
): AIConversationApplicationFailure {
  if (
    code === 'SESSION_NOT_FOUND' ||
    code === 'MEMORY_READ_FAILED' ||
    code === 'MEMORY_WRITE_FAILED' ||
    code === 'MEMORY_CORRUPTED' ||
    code === 'MEMORY_VERSION_UNSUPPORTED' ||
    code === 'MEMORY_MAX_MESSAGES_EXCEEDED' ||
    code === 'MEMORY_UNAVAILABLE'
  ) {
    return failure(code, safeMessage, retryable)
  }

  return failure('MEMORY_ERROR', safeMessage, retryable)
}

function createNoopMemoryPort(): AIConversationMemoryPort {
  return {
    async saveSession(input) {
      const updatedAt = input.session.metadata.updatedAt ?? input.session.metadata.createdAt
      const metadata: AIConversationMemoryMetadata = {
        sessionId: input.session.sessionId,
        createdAt: input.session.metadata.createdAt,
        updatedAt,
        lastMessageAt: input.session.messages.at(-1)?.createdAt ?? null,
        messageCount: input.session.messages.length,
        status: input.session.status,
        source: input.session.metadata.source,
        tags: [...(input.session.metadata.tags ?? [])],
      }
      return {
        kind: 'success',
        value: {
          record: {
            metadata,
            session: structuredClone(input.session),
          },
          retention: {
            evictionStrategy: input.retentionPolicy.evictionStrategy,
            maxSessions: input.retentionPolicy.maxSessions,
            maxMessagesPerSession: input.retentionPolicy.maxMessagesPerSession,
            evictedSessionIds: [],
            evictedCount: 0,
            messagesTruncated: false,
          },
        },
      }
    },
    async loadSession() {
      return {
        kind: 'failure',
        code: 'SESSION_NOT_FOUND',
        retryable: false,
        safeMessage: 'No se encontro una sesion conversacional en memoria local.',
      }
    },
    async listSessions() {
      return {
        kind: 'success',
        value: [],
      }
    },
    async deleteSession() {
      return {
        kind: 'success',
        value: { deleted: false },
      }
    },
    async clearMemory() {
      return {
        kind: 'success',
        value: { deletedCount: 0 },
      }
    },
  }
}

export function createExecutionIdFactory() {
  return {
    create(kind: 'execution'): string {
      return `${kind}:${normalizeIdentifierFragment(`${Date.now()}`)}`
    },
  }
}

export function createConversationExecutionContextBuilder(): AIExecutionContextBuilderPort {
  return {
    buildContext(input) {
      const contextCreatedAt = earliestTimestamp([
        input.request.session.metadata.createdAt,
        ...input.request.session.messages.map((message) => message.createdAt),
        input.request.metadata.createdAt,
      ])

      const builder = createContextBuilder().createContext({
        id: `context:${normalizeIdentifierFragment(input.request.id)}`,
        createdAt: contextCreatedAt,
        source: 'APPLICATION',
        tags: ['conversation-execution'],
      })

      const sessionSection = createContextSectionFromSession({
        id: `context-section:session:${normalizeIdentifierFragment(input.request.session.sessionId)}`,
        session: input.request.session,
        priority: 'HIGH',
      })
      if (sessionSection.kind === 'failure') {
        return {
          kind: 'failure',
          code: sessionSection.code,
          retryable: false,
          safeMessage: sessionSection.safeMessage,
        }
      }

      builder.addSection({
        id: sessionSection.section.id,
        source: sessionSection.section.source,
        priority: sessionSection.section.priority,
        content: sessionSection.section.content,
        createdAt: sessionSection.section.metadata.createdAt,
        sourceMetadata: sessionSection.section.metadata.source,
        ...(sessionSection.section.metadata.tags === undefined
          ? {}
          : { tags: sessionSection.section.metadata.tags }),
        ...(sessionSection.section.metadata.attributes === undefined
          ? {}
          : { attributes: sessionSection.section.metadata.attributes }),
      })

      for (const message of input.request.session.messages) {
        const section = createContextSectionFromConversationMessage({
          id: `context-section:message:${normalizeIdentifierFragment(message.id)}`,
          message,
          priority: contextPriorityFromMessage(message),
        })
        if (section.kind === 'failure') {
          return {
            kind: 'failure',
            code: section.code,
            retryable: false,
            safeMessage: section.safeMessage,
          }
        }

        builder.addSection({
          id: section.section.id,
          source: section.section.source,
          priority: section.section.priority,
          content: section.section.content,
          createdAt: section.section.metadata.createdAt,
          sourceMetadata: section.section.metadata.source,
          ...(section.section.metadata.tags === undefined ? {} : { tags: section.section.metadata.tags }),
          ...(section.section.metadata.attributes === undefined
            ? {}
            : { attributes: section.section.metadata.attributes }),
        })
      }

      builder.sortSections()
      return builder.build()
    },
  }
}

export function createConversationExecutionContextResolver(): AIExecutionContextResolverPort {
  const resolver = createAIContextResolver()
  return {
    resolveContext(input) {
      return resolver.resolve({
        context: input.context,
        strategy: input.request.metadata.resolutionStrategy ?? 'DEFAULT',
        createdAt: input.request.metadata.createdAt,
      })
    },
  }
}

export function createConversationExecutionPromptBuilder(): AIExecutionPromptBuilderPort {
  return {
    buildPrompt(input) {
      const promptCreatedAt = earliestTimestamp([
        ...input.resolvedContext.sections.map((section) => section.metadata.createdAt),
        input.request.userMessage.createdAt,
        input.request.metadata.createdAt,
      ])

      const builder = createPromptBuilder().createPrompt({
        promptId: `prompt:${normalizeIdentifierFragment(input.request.id)}`,
        createdAt: promptCreatedAt,
        source: 'APPLICATION',
        tags: ['conversation-execution'],
      })

      builder.addSegment({
        id: `prompt-segment:system:${normalizeIdentifierFragment(input.request.id)}`,
        role: 'SYSTEM',
        content: [
          'Eres Private Balance AI.',
          'Responde en espanol de forma clara, breve y basada solo en el contexto disponible.',
          'Si necesitas conocimiento documental adicional, usa tool calling con el envelope JSON exacto:',
          '{"type":"tool_call","toolName":"knowledge_search","arguments":{"query":"<consulta>","limit":5}}',
          'No inventes citas ni contenido documental no recuperado por la herramienta.',
        ].join(' '),
        priority: 'CRITICAL',
        createdAt: promptCreatedAt,
        source: 'SYSTEM',
        tags: ['conversation-system-instruction'],
      })

      for (const section of input.resolvedContext.sections) {
        builder.addSegment({
          id: `prompt-segment:context:${normalizeIdentifierFragment(section.id)}`,
          role: 'CONTEXT',
          content: JSON.stringify(section.content),
          priority: promptPriorityFromResolvedSection(section.priority),
          createdAt: section.metadata.createdAt,
          source: section.metadata.source,
          tags: [
            'resolved-context-section',
            `source:${section.source.toLowerCase()}`,
          ],
        })
      }

      const userSegment = createPromptSegmentFromConversationMessage({
        id: `prompt-segment:user:${normalizeIdentifierFragment(input.request.userMessage.id)}`,
        message: input.request.userMessage,
        priority: 'HIGH',
      })
      if (userSegment.kind === 'failure') {
        return {
          kind: 'failure',
          code: userSegment.code,
          retryable: false,
          safeMessage: userSegment.safeMessage,
        }
      }

      builder.addSegment({
        id: userSegment.segment.id,
        role: userSegment.segment.role,
        content: userSegment.segment.content,
        priority: userSegment.segment.priority,
        createdAt: userSegment.segment.metadata.createdAt,
        source: userSegment.segment.metadata.source,
        ...(userSegment.segment.metadata.tags === undefined ? {} : { tags: userSegment.segment.metadata.tags }),
        ...(userSegment.segment.metadata.attributes === undefined
          ? {}
          : { attributes: userSegment.segment.metadata.attributes }),
      })

      builder.sortSegments()
      return builder.build()
    },
  }
}

export function createConversationExecutionPipeline(input: {
  readonly provider: AIProvider
  readonly conversationPort: AIConversationApplicationServiceDependencies['conversationService']
  readonly toolExecutor?: AIToolExecutor
  readonly inspector?: AIExecutionInspector
}): AIExecutionPipeline {
  return createAIExecutionPipeline({
    conversationPort: input.conversationPort,
    contextBuilder: createConversationExecutionContextBuilder(),
    contextResolver: createConversationExecutionContextResolver(),
    promptBuilder: createConversationExecutionPromptBuilder(),
    provider: input.provider,
    ...(input.toolExecutor === undefined ? {} : { toolExecutor: input.toolExecutor }),
    ...(input.inspector === undefined ? {} : { inspector: input.inspector }),
  })
}

export function createAIConversationApplicationService(
  dependencies: AIConversationApplicationServiceDependencies,
): AIConversationApplicationService {
  const now = dependencies.now ?? (() => new Date().toISOString())
  const idFactory = dependencies.idFactory ?? createExecutionIdFactory()
  const memoryPort = dependencies.memoryPort ?? createNoopMemoryPort()
  const retentionPolicy = resolveRetentionPolicy(dependencies.config.retentionPolicy)

  async function saveSession(
    input: AIConversationApplicationMemorySaveRequest,
  ): Promise<AIConversationApplicationResult<AIConversationApplicationMemorySaveResponse>> {
    const validation = validateMemorySession(input.session)
    if (validation) {
      return validation
    }

    const persisted = await memoryPort.saveSession({
      session: input.session,
      retentionPolicy: input.retentionPolicy ?? retentionPolicy,
    })
    if (persisted.kind === 'failure') {
      return mapMemoryFailureToApplicationFailure(
        persisted.code,
        persisted.safeMessage,
        persisted.retryable,
      )
    }

    return success({
      session: persisted.value.record.session,
      retention: persisted.value.retention,
    })
  }

  async function loadSession(
    input?: AIConversationApplicationMemoryLoadRequest,
  ): Promise<AIConversationApplicationResult<AIConversationApplicationMemorySaveRequest['session']>> {
    const loaded = await memoryPort.loadSession(input)
    if (loaded.kind === 'failure') {
      return mapMemoryFailureToApplicationFailure(loaded.code, loaded.safeMessage, loaded.retryable)
    }

    const validation = validateMemorySession(loaded.value.session)
    if (validation) {
      return failure('MEMORY_CORRUPTED', 'La sesion recuperada de memoria local es invalida para el dominio.')
    }

    return success(loaded.value.session)
  }

  async function listSessions(): Promise<AIConversationApplicationResult<
    readonly AIConversationMemoryMetadata[]
  >> {
    const listed = await memoryPort.listSessions()
    if (listed.kind === 'failure') {
      return mapMemoryFailureToApplicationFailure(listed.code, listed.safeMessage, listed.retryable)
    }

    return success(listed.value.map((item) => mapMemoryMetadata(item)))
  }

  function mapMemoryMetadata(
    metadata: {
      readonly sessionId: string
      readonly createdAt: string
      readonly updatedAt: string
      readonly lastMessageAt: string | null
      readonly messageCount: number
      readonly status: AIConversationApplicationMemorySaveRequest['session']['status']
      readonly source: AIConversationApplicationMemorySaveRequest['session']['metadata']['source']
      readonly tags: readonly string[]
    },
  ) {
    return {
      sessionId: metadata.sessionId,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      lastMessageAt: metadata.lastMessageAt,
      messageCount: metadata.messageCount,
      status: metadata.status,
      source: metadata.source,
      tags: [...metadata.tags],
    } as const
  }

  async function deleteSession(
    input: AIConversationApplicationMemoryDeleteRequest,
  ): Promise<AIConversationApplicationResult<AIConversationApplicationMemoryDeleteResponse>> {
    if (input.sessionId.trim().length === 0) {
      return failure('INVALID_REQUEST', 'El identificador de sesion es obligatorio para eliminar memoria.')
    }

    const deleted = await memoryPort.deleteSession(input)
    if (deleted.kind === 'failure') {
      return mapMemoryFailureToApplicationFailure(deleted.code, deleted.safeMessage, deleted.retryable)
    }

    return success({ deleted: deleted.value.deleted })
  }

  async function clearMemory(): Promise<AIConversationApplicationResult<AIConversationApplicationMemoryClearResponse>> {
    const cleared = await memoryPort.clearMemory()
    if (cleared.kind === 'failure') {
      return mapMemoryFailureToApplicationFailure(cleared.code, cleared.safeMessage, cleared.retryable)
    }

    return success({ deletedCount: cleared.value.deletedCount })
  }

  return {
    startConversation(input) {
      const result = dependencies.conversationService.startConversation(input)
      if (result.kind === 'failure') {
        return failure('INVALID_CONVERSATION', result.safeMessage)
      }

      return success(result.value)
    },

    async sendMessage(input) {
      const requestValidation = validateAIConversationApplicationSendRequest(input)
      if (requestValidation) {
        return requestValidation
      }

      if (input.cancellationSignal?.aborted === true) {
        return failure('SEND_MESSAGE_FAILED', 'La solicitud fue cancelada antes de ejecutarse.')
      }

      input.onStateChange?.('Sending')

      const session = input.session
      if (session === null) {
        input.onStateChange?.('Error')
        return failure('CONVERSATION_NOT_FOUND', 'No hay una conversación activa para enviar mensajes.')
      }

      const createdAt = now()
      const userMessage = dependencies.conversationService.createUserMessage({
        id: `message:user:${normalizeIdentifierFragment(`${session.sessionId}:${session.messages.length}:${createdAt}`)}`,
        conversationId: session.conversation.conversationId,
        sessionId: session.sessionId,
        content: {
          value: input.message.trim(),
        },
        sequence: session.messages.length,
        createdAt,
        metadata: {
          generatedLocally: true,
          correlationId: `send:${session.sessionId}:${session.messages.length}`,
          tags: ['conversation-user-message'],
        },
      })
      if (userMessage.kind === 'failure') {
        input.onStateChange?.('Error')
        return failure('SEND_MESSAGE_FAILED', 'No se pudo construir el mensaje del usuario.')
      }

      const appendedUserMessage = dependencies.conversationService.appendMessage(
        session,
        userMessage.value,
      )
      if (appendedUserMessage.kind === 'failure') {
        input.onStateChange?.('Error')
        return failure('INVALID_CONVERSATION', 'No se pudo actualizar la conversación activa.')
      }

      const executionRequest = createExecutionRequest({
        id: idFactory.create('execution'),
        conversation: appendedUserMessage.value.conversation,
        session: appendedUserMessage.value,
        userMessage: userMessage.value,
        metadata: {
          createdAt,
          source: 'APPLICATION',
          providerId: dependencies.config.providerId,
          model: dependencies.config.model,
          ...(dependencies.config.resolutionStrategy === undefined
            ? {}
            : { resolutionStrategy: dependencies.config.resolutionStrategy }),
          ...(dependencies.config.responseFormat === undefined
            ? {}
            : { responseFormat: dependencies.config.responseFormat }),
          ...(dependencies.config.temperature === undefined
            ? {}
            : { temperature: dependencies.config.temperature }),
          ...(dependencies.config.maxOutputTokens === undefined
            ? {}
            : { maxOutputTokens: dependencies.config.maxOutputTokens }),
          ...(dependencies.config.timeoutMs === undefined
            ? {}
            : { timeoutMs: dependencies.config.timeoutMs }),
          tags: ['conversation-application-service'],
        },
      })
      if (executionRequest.kind === 'failure') {
        input.onStateChange?.('Error')
        return failure('SEND_MESSAGE_FAILED', 'No se pudo preparar la ejecución de IA.')
      }

      input.onStateChange?.('Receiving')
      const executionResult = await dependencies.executionPipeline.execute(executionRequest.request)
      if (executionResult.kind === 'failure') {
        input.onStateChange?.('Error')

        if (executionResult.code === 'PROVIDER_EXECUTION_FAILED') {
          return failure('AI_UNAVAILABLE', 'La IA no está disponible en este momento.', executionResult.retryable)
        }

        if (
          executionResult.code === 'INVALID_CONVERSATION' ||
          executionResult.code === 'INVALID_SESSION' ||
          executionResult.code === 'INVALID_MESSAGE'
        ) {
          return failure('INVALID_CONVERSATION', 'La conversación activa es inválida.')
        }

        return failure('SEND_MESSAGE_FAILED', 'No se pudo procesar la respuesta del asistente.', executionResult.retryable)
      }

      debugConversationBoundary('application.updatedSession.returned', {
        executionId: executionRequest.request.id,
        sessionId: executionResult.response.session.sessionId,
        messageCount: executionResult.response.session.messages.length,
        assistantMessageId: executionResult.response.assistantMessage.id,
      })

      input.onStateChange?.('Success')
      return success({
        session: executionResult.response.session,
        userMessage: userMessage.value,
        assistantMessage: executionResult.response.assistantMessage,
      })
    },

    saveSession,
    loadSession,
    listSessions,
    deleteSession,
    clearMemory,
  }
}
