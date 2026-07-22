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

