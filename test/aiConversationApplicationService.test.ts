import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getAutomationGatewayConfig } = vi.hoisted(() => ({
  getAutomationGatewayConfig: vi.fn(),
}))

vi.mock('../src/services/automationHubService', () => ({
  getAutomationGatewayConfig,
}))

import {
  createAIConversation,
  createAIConversationService,
  type AIConversation,
} from '../src/intelligence/ai-conversation'
import {
  __resetDefaultAIConversationApplicationServiceForTests,
  type AIConversationMemoryPort,
  createAIConversationApplicationService,
  createDefaultAIConversationApplicationService,
  getRegisteredAIConversationExecutionTrace,
} from '../src/application/ai-conversation'
import {
  createExecutionResponse,
  type AIExecutionPipeline,
  type AIExecutionRequest,
} from '../src/intelligence/execution-pipeline'
import { createProviderResponse } from '../src/intelligence/provider'

function createConversationFixture(): AIConversation {
  const created = createAIConversation({
    conversationId: 'conversation:application:001',
    status: 'OPEN',
    participants: [
      { participantId: 'user:1', role: 'USER', active: true },
      { participantId: 'assistant:1', role: 'ASSISTANT', active: true },
    ],
    metadata: {
      createdAt: '2026-07-22T00:00:00.000Z',
      source: 'APPLICATION',
    },
  })

  if (created.kind !== 'success') {
    throw new Error('Expected valid conversation fixture')
  }

  return created.conversation
}

function createStartedSession() {
  const service = createAIConversationService()
  const started = service.createConversationSession({
    sessionId: 'session:application:001',
    conversation: createConversationFixture(),
    metadata: {
      createdAt: '2026-07-22T00:00:00.000Z',
      source: 'APPLICATION',
    },
  })

  if (started.kind !== 'success') {
    throw new Error('Expected valid started session fixture')
  }

  return {
    service,
    session: started.value,
  }
}

function createPipelineSuccess(): AIExecutionPipeline {
  return {
    async execute(request: AIExecutionRequest) {
      const assistant = createAIConversationService().createAssistantMessage({
        id: 'message:application:assistant:001',
        conversationId: request.conversation.conversationId,
        sessionId: request.session.sessionId,
        content: {
          value: 'Respuesta integrada desde el pipeline.',
        },
        sequence: request.session.messages.length,
        createdAt: request.metadata.createdAt,
        metadata: {
          generatedLocally: false,
          correlationId: request.id,
        },
      })

      if (assistant.kind !== 'success') {
        throw new Error('Expected valid assistant message fixture')
      }

      const appended = createAIConversationService().appendMessage(request.session, assistant.value)
      if (appended.kind !== 'success') {
        throw new Error('Expected valid appended session fixture')
      }

      const providerResponse = createProviderResponse({
        id: 'provider-response:openai:application:001',
        content: 'Respuesta integrada desde el pipeline.',
        usage: {
          inputTokens: 100,
          outputTokens: 20,
          totalTokens: 120,
        },
        finishReason: 'STOP',
        metadata: {
          createdAt: request.metadata.createdAt,
          requestId: 'provider-request:execution:application:001' as never,
          providerId: 'OPENAI',
          model: 'gpt-4.1-mini',
          source: 'SYSTEM',
        },
      })

      if (providerResponse.kind !== 'success') {
        throw new Error('Expected valid provider response fixture')
      }

      const response = createExecutionResponse({
        id: request.id,
        session: appended.value,
        assistantMessage: assistant.value,
        providerResponse: providerResponse.response,
        metadata: {
          createdAt: request.metadata.createdAt,
          source: 'APPLICATION',
          requestId: request.id,
          conversationId: request.conversation.conversationId,
          sessionId: appended.value.sessionId,
          contextId: 'context:application:001',
          resolvedContextId: 'resolved-context:default:application:001',
          promptId: 'prompt:application:001',
          providerId: 'OPENAI',
          model: 'gpt-4.1-mini',
        },
      })

      if (response.kind !== 'success') {
        throw new Error('Expected valid execution response fixture')
      }

      return {
        kind: 'success',
        response: response.response,
      }
    },
  }
}

function createMemoryPortFixture(): AIConversationMemoryPort {
  const records = new Map<string, ReturnType<typeof createStartedSession>['session']>()

  return {
    async saveSession(input) {
      records.set(input.session.sessionId, structuredClone(input.session))

      return {
        kind: 'success',
        value: {
          record: {
            metadata: {
              sessionId: input.session.sessionId,
              createdAt: input.session.metadata.createdAt,
              updatedAt: input.session.metadata.updatedAt ?? input.session.metadata.createdAt,
              lastMessageAt: input.session.messages.at(-1)?.createdAt ?? null,
              messageCount: input.session.messages.length,
              status: input.session.status,
              source: input.session.metadata.source,
              tags: [...(input.session.metadata.tags ?? [])],
            },
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
      } as const
    },
    async loadSession(input) {
      const loaded = input?.sessionId === undefined
        ? [...records.values()].at(-1)
        : records.get(input.sessionId)

      if (loaded === undefined) {
        return {
          kind: 'failure',
          code: 'SESSION_NOT_FOUND',
          retryable: false,
          safeMessage: 'No se encontro una sesion conversacional en memoria local.',
        } as const
      }

      return {
        kind: 'success',
        value: {
          metadata: {
            sessionId: loaded.sessionId,
            createdAt: loaded.metadata.createdAt,
            updatedAt: loaded.metadata.updatedAt ?? loaded.metadata.createdAt,
            lastMessageAt: loaded.messages.at(-1)?.createdAt ?? null,
            messageCount: loaded.messages.length,
            status: loaded.status,
            source: loaded.metadata.source,
            tags: [...(loaded.metadata.tags ?? [])],
          },
          session: structuredClone(loaded),
        },
      } as const
    },
    async listSessions() {
      return {
        kind: 'success',
        value: [...records.values()].map((session) => ({
          sessionId: session.sessionId,
          createdAt: session.metadata.createdAt,
          updatedAt: session.metadata.updatedAt ?? session.metadata.createdAt,
          lastMessageAt: session.messages.at(-1)?.createdAt ?? null,
          messageCount: session.messages.length,
          status: session.status,
          source: session.metadata.source,
          tags: [...(session.metadata.tags ?? [])],
        })),
      } as const
    },
    async deleteSession(input) {
      const deleted = records.delete(input.sessionId)
      return {
        kind: 'success',
        value: { deleted },
      } as const
    },
    async clearMemory() {
      const deletedCount = records.size
      records.clear()
      return {
        kind: 'success',
        value: { deletedCount },
      } as const
    },
  }
}

describe('AIConversationApplicationService (Milestone 11A)', () => {
  beforeEach(() => {
    __resetDefaultAIConversationApplicationServiceForTests()
    getAutomationGatewayConfig.mockReset()
  })

  it('sends a message successfully through the execution pipeline', async () => {
    const { service, session } = createStartedSession()
    const applicationService = createAIConversationApplicationService({
      conversationService: service,
      executionPipeline: createPipelineSuccess(),
      config: {
        providerId: 'OPENAI',
        model: 'gpt-4.1-mini',
        resolutionStrategy: 'DEFAULT',
        responseFormat: 'TEXT',
      },
      now: () => '2026-07-22T00:00:01.000Z',
      idFactory: { create: () => 'execution:application:001' },
    })

    const states: string[] = []
    const result = await applicationService.sendMessage({
      session,
      message: 'Hola IA',
      onStateChange: (state) => states.push(state),
    })

    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error(`Expected success but got ${result.code}`)
    }

    expect(states).toEqual(['Sending', 'Receiving', 'Success'])
    expect(result.value.session.messages).toHaveLength(2)
    expect(result.value.userMessage.role).toBe('USER')
    expect(result.value.assistantMessage.role).toBe('ASSISTANT')
  })

  it('translates pipeline provider failure to AIUnavailable', async () => {
    const { service, session } = createStartedSession()
    const applicationService = createAIConversationApplicationService({
      conversationService: service,
      executionPipeline: {
        async execute() {
          return {
            kind: 'failure',
            code: 'PROVIDER_EXECUTION_FAILED',
            retryable: true,
            safeMessage: 'Provider unavailable',
          }
        },
      },
      config: {
        providerId: 'OPENAI',
        model: 'gpt-4.1-mini',
      },
    })

    const result = await applicationService.sendMessage({
      session,
      message: 'Hola IA',
    })

    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('AI_UNAVAILABLE')
      expect(result.retryable).toBe(true)
    }
  })

  it('fails closed for invalid conversation state', async () => {
    const { service } = createStartedSession()
    const applicationService = createAIConversationApplicationService({
      conversationService: service,
      executionPipeline: createPipelineSuccess(),
      config: {
        providerId: 'OPENAI',
        model: 'gpt-4.1-mini',
      },
    })

    const result = await applicationService.sendMessage({
      session: null,
      message: 'Hola IA',
    })

    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('CONVERSATION_NOT_FOUND')
    }
  })

  it('persists, loads, lists, deletes and clears sessions through memory port', async () => {
    const { service, session } = createStartedSession()
    const memoryPort = createMemoryPortFixture()
    const applicationService = createAIConversationApplicationService({
      conversationService: service,
      executionPipeline: createPipelineSuccess(),
      memoryPort,
      config: {
        providerId: 'OPENAI',
        model: 'gpt-4.1-mini',
      },
    })

    const saved = await applicationService.saveSession({ session })
    expect(saved.kind).toBe('success')
    if (saved.kind === 'success') {
      expect(saved.value.retention.evictedCount).toBe(0)
      expect(saved.value.session.sessionId).toBe(session.sessionId)
    }

    const loaded = await applicationService.loadSession({ sessionId: session.sessionId })
    expect(loaded.kind).toBe('success')
    if (loaded.kind === 'success') {
      expect(loaded.value.sessionId).toBe(session.sessionId)
      expect(loaded.value.messages).toEqual(session.messages)
    }

    const listed = await applicationService.listSessions()
    expect(listed.kind).toBe('success')
    if (listed.kind === 'success') {
      expect(listed.value).toHaveLength(1)
      expect(listed.value[0]?.sessionId).toBe(session.sessionId)
    }

    const deleted = await applicationService.deleteSession({ sessionId: session.sessionId })
    expect(deleted).toEqual({ kind: 'success', value: { deleted: true } })

    const cleared = await applicationService.clearMemory()
    expect(cleared).toEqual({ kind: 'success', value: { deletedCount: 0 } })
  })

  it('maps memory persistence failures to MEMORY_WRITE_FAILED', async () => {
    const { service, session } = createStartedSession()
    const applicationService = createAIConversationApplicationService({
      conversationService: service,
      executionPipeline: createPipelineSuccess(),
      memoryPort: {
        async saveSession() {
          return {
            kind: 'failure',
            code: 'MEMORY_WRITE_FAILED',
            retryable: true,
            safeMessage: 'Disk write failed',
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
          return { kind: 'success', value: [] }
        },
        async deleteSession() {
          return { kind: 'success', value: { deleted: false } }
        },
        async clearMemory() {
          return { kind: 'success', value: { deletedCount: 0 } }
        },
      },
      config: {
        providerId: 'OPENAI',
        model: 'gpt-4.1-mini',
      },
    })

    const saved = await applicationService.saveSession({ session })
    expect(saved.kind).toBe('failure')
    if (saved.kind === 'failure') {
      expect(saved.code).toBe('MEMORY_WRITE_FAILED')
      expect(saved.retryable).toBe(true)
    }
  })

  it('returns SESSION_NOT_FOUND explicitly when no memory session exists', async () => {
    const { service } = createStartedSession()
    const applicationService = createAIConversationApplicationService({
      conversationService: service,
      executionPipeline: createPipelineSuccess(),
      memoryPort: createMemoryPortFixture(),
      config: {
        providerId: 'OPENAI',
        model: 'gpt-4.1-mini',
      },
    })

    const loaded = await applicationService.loadSession({
      sessionId: 'session:application:missing',
    })
    expect(loaded.kind).toBe('failure')
    if (loaded.kind === 'failure') {
      expect(loaded.code).toBe('SESSION_NOT_FOUND')
    }
  })

  it('exposes a real inspector trace from the default integrated service', async () => {
    vi.stubEnv('VITE_AI_PROVIDER', 'OPENAI')
    vi.stubEnv('VITE_AI_OPENAI_MODEL', 'gpt-4.1-mini')
    vi.stubEnv('VITE_AI_OPENAI_TIMEOUT_MS', '5000')

    getAutomationGatewayConfig.mockResolvedValue({
      baseUrl: 'https://private-balance.example.com',
      bearerToken: 'jwt-token',
    })

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      id: 'chatcmpl_remote_001',
      model: 'gpt-4.1-mini',
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: 'Respuesta remota real a través del proxy.',
          },
        },
      ],
      usage: {
        prompt_tokens: 90,
        completion_tokens: 30,
        total_tokens: 120,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })))

    const applicationService = createDefaultAIConversationApplicationService()
    const started = applicationService.startConversation({
      userDisplayName: 'Usuario',
      assistantDisplayName: 'Private Balance AI',
    })

    if (started.kind !== 'success') {
      throw new Error('Expected started conversation from default app service')
    }

    const result = await applicationService.sendMessage({
      session: started.value,
      message: 'Quiero una respuesta integrada.',
    })

    expect(result.kind).toBe('success')
    const trace = getRegisteredAIConversationExecutionTrace()
    expect(trace).not.toBeNull()
    if (trace !== null) {
      expect(trace.metadata.status).toBe('SUCCESS')
    }

    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })
})

