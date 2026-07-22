import { describe, expect, it } from 'vitest'

import {
  createAIConversation,
  createAIConversationMessage,
  createAIConversationService,
  createAIConversationSession,
  type AIConversation,
  type AIConversationMessage,
  type AIConversationSessionSnapshot,
} from '../src/intelligence/ai-conversation'
import type { AIContext } from '../src/intelligence/context-builder'
import type { AIResolvedContext } from '../src/intelligence/context-resolution'
import {
  createExecutionId,
  createExecutionRequest,
  createExecutionResponse,
  createAIExecutionPipeline,
  validateAIExecutionRequest,
  validateAIExecutionResponse,
  type AIExecutionContextBuilderPort,
  type AIExecutionContextResolverPort,
  type AIExecutionPromptBuilderPort,
} from '../src/intelligence/execution-pipeline'
import {
  createPrompt,
  createPromptSegment,
  type AIPrompt,
} from '../src/intelligence/prompt-builder'
import {
  createProvider,
  createProviderResponse,
  type AIProviderAdapter,
} from '../src/intelligence/provider'

function createConversationFixture(): AIConversation {
  const created = createAIConversation({
    conversationId: 'conversation:execution:001',
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

function createUserMessageFixture(sessionId: string, conversationId: string): AIConversationMessage {
  const created = createAIConversationMessage({
    id: 'message:execution:user:001',
    conversationId,
    sessionId,
    role: 'USER',
    content: {
      value: 'Explica mi balance mensual.',
    },
    sequence: 0,
    createdAt: '2026-07-22T00:00:01.000Z',
    metadata: {
      generatedLocally: true,
      correlationId: 'corr:execution:001',
    },
  })

  if (created.kind !== 'success') {
    throw new Error('Expected valid user message fixture')
  }

  return created.message
}

function createSessionFixture(): {
  readonly conversation: AIConversation
  readonly session: AIConversationSessionSnapshot
  readonly userMessage: AIConversationMessage
} {
  const conversation = createConversationFixture()
  const userMessage = createUserMessageFixture('session:execution:001', conversation.conversationId)
  const session = createAIConversationSession({
    sessionId: 'session:execution:001',
    conversation,
    messages: [userMessage],
    metadata: {
      createdAt: '2026-07-22T00:00:00.000Z',
      updatedAt: '2026-07-22T00:00:01.000Z',
      source: 'APPLICATION',
    },
  })

  if (session.kind !== 'success') {
    throw new Error('Expected valid session fixture')
  }

  return {
    conversation,
    session: session.session,
    userMessage,
  }
}

function createContextFixture(): AIContext {
  return {
    protocolVersion: 1,
    id: 'context:execution:001' as AIContext['id'],
    sections: [
      {
        id: 'context-section:execution:001' as AIContext['sections'][number]['id'],
        source: 'CONVERSATION',
        priority: 'HIGH',
        content: {
          text: 'Explica mi balance mensual.',
        },
        metadata: {
          protocolVersion: 1,
          createdAt: '2026-07-22T00:00:01.000Z',
          source: 'CONVERSATION',
          deterministic: true,
          failClosed: true,
        },
      },
    ],
    metadata: {
      protocolVersion: 1,
      createdAt: '2026-07-22T00:00:02.000Z',
      source: 'APPLICATION',
      deterministic: true,
      failClosed: true,
    },
  }
}

function createResolvedContextFixture(): AIResolvedContext {
  return {
    id: 'resolved-context:default:execution:001' as AIResolvedContext['id'],
    sections: [
      {
        id: 'resolved-section:execution:001' as AIResolvedContext['sections'][number]['id'],
        source: 'CONVERSATION',
        priority: 'HIGH',
        content: {
          text: 'Explica mi balance mensual.',
        },
        metadata: {
          protocolVersion: 1,
          createdAt: '2026-07-22T00:00:02.000Z',
          source: 'APPLICATION',
          deterministic: true,
          failClosed: true,
        },
      },
    ],
    strategy: 'DEFAULT',
    metadata: {
      protocolVersion: 1,
      createdAt: '2026-07-22T00:00:02.000Z',
      sourceContextId: 'context:execution:001',
      source: 'APPLICATION',
      deterministic: true,
      failClosed: true,
    },
  }
}

function createPromptFixture(): AIPrompt {
  const segment = createPromptSegment({
    id: 'prompt-segment:execution:001',
    role: 'USER',
    content: 'Explica mi balance mensual.',
    priority: 'HIGH',
    metadata: {
      createdAt: '2026-07-22T00:00:03.000Z',
      source: 'CONVERSATION',
    },
  })

  if (segment.kind !== 'success') {
    throw new Error('Expected valid prompt segment fixture')
  }

  const prompt = createPrompt({
    promptId: 'prompt:execution:001',
    segments: [segment.segment],
    metadata: {
      createdAt: '2026-07-22T00:00:03.000Z',
      source: 'APPLICATION',
    },
  })

  if (prompt.kind !== 'success') {
    throw new Error('Expected valid prompt fixture')
  }

  return prompt.prompt
}

function createProviderFixture() {
  const response = createProviderResponse({
    id: 'provider-response:openai:execution:001',
    content: 'Tu balance mensual es positivo.',
    usage: {
      inputTokens: 100,
      outputTokens: 20,
      totalTokens: 120,
    },
    finishReason: 'STOP',
    metadata: {
      createdAt: '2026-07-22T00:00:04.000Z',
      requestId: 'provider-request:execution:execution:001' as never,
      providerId: 'OPENAI',
      model: 'gpt-4.1-mini',
      source: 'SYSTEM',
    },
  })

  expect(response.kind).toBe('success')
  if (response.kind !== 'success') {
    throw new Error('Expected valid provider response fixture')
  }

  const adapter: AIProviderAdapter = {
    providerId: 'OPENAI',
    getCapabilities() {
      return {
        supportsStreaming: false,
        supportsVision: false,
        supportsTools: false,
        supportsJson: true,
        maxContextWindow: 128000,
        supportedModels: ['gpt-4.1-mini'],
      }
    },
    async isAvailable() {
      return true
    },
    async executePrompt() {
      return {
        kind: 'success',
        response: response.response,
      }
    },
  }

  return createProvider({ adapter })
}

function createExecutionRequestFixture() {
  const fixture = createSessionFixture()
  const request = createExecutionRequest({
    id: 'execution:001',
    conversation: fixture.conversation,
    session: fixture.session,
    userMessage: fixture.userMessage,
    metadata: {
      createdAt: '2026-07-22T00:00:04.000Z',
      source: 'APPLICATION',
      providerId: 'OPENAI',
      model: 'gpt-4.1-mini',
      resolutionStrategy: 'DEFAULT',
      responseFormat: 'TEXT',
    },
  })

  expect(request.kind).toBe('success')
  if (request.kind !== 'success') {
    throw new Error(`Expected valid execution request but got ${request.code}`)
  }

  return request.request
}

describe('AIExecution factory and validator (Milestone 10E)', () => {
  it('creates immutable execution request and response', () => {
    const request = createExecutionRequestFixture()
    expect(createExecutionId('execution:main:001')).toBe('execution:main:001')
    expect(validateAIExecutionRequest(request)).toBeNull()
    expect(Object.isFrozen(request)).toBe(true)

    const service = createAIConversationService()
    const assistant = service.createAssistantMessage({
      id: 'message:execution:assistant:001',
      conversationId: request.conversation.conversationId,
      sessionId: request.session.sessionId,
      content: {
        value: 'Tu balance mensual es positivo.',
      },
      sequence: 1,
      createdAt: '2026-07-22T00:00:04.000Z',
      metadata: {
        generatedLocally: false,
        correlationId: request.id,
      },
    })

    if (assistant.kind !== 'success') {
      throw new Error('Expected valid assistant message fixture')
    }

    const provider = createProviderFixture()
    const providerResult = createProviderResponse({
      id: 'provider-response:openai:001',
      content: 'Tu balance mensual es positivo.',
      usage: {
        inputTokens: 100,
        outputTokens: 20,
        totalTokens: 120,
      },
      finishReason: 'STOP',
      metadata: {
        createdAt: '2026-07-22T00:00:04.000Z',
        requestId: 'provider-request:execution:001' as never,
        providerId: provider.providerId,
        model: 'gpt-4.1-mini',
        source: 'SYSTEM',
      },
    })

    if (providerResult.kind !== 'success') {
      throw new Error('Expected valid provider response fixture')
    }

    const appendedSession = createAIConversationService().appendMessage(
      request.session,
      assistant.value,
    )

    if (appendedSession.kind !== 'success') {
      throw new Error('Expected valid appended session fixture')
    }

    const response = createExecutionResponse({
      id: request.id,
      session: appendedSession.value,
      assistantMessage: assistant.value,
      providerResponse: providerResult.response,
      metadata: {
        createdAt: '2026-07-22T00:00:04.000Z',
        source: 'APPLICATION',
        requestId: request.id,
        conversationId: request.conversation.conversationId,
        sessionId: request.session.sessionId,
        contextId: 'context:execution:001',
        resolvedContextId: 'resolved-context:default:execution:001',
        promptId: 'prompt:execution:001',
        providerId: 'OPENAI',
        model: 'gpt-4.1-mini',
      },
    })

    expect(response.kind).toBe('success')
    if (response.kind !== 'success') {
      throw new Error(`Expected valid execution response but got ${response.code}`)
    }

    expect(validateAIExecutionResponse(response.response)).toBeNull()
    expect(Object.isFrozen(response.response)).toBe(true)
  })

  it('fails closed when session does not end with the provided user message', () => {
    const fixture = createSessionFixture()
    const otherUserMessage = createAIConversationMessage({
      id: 'message:execution:user:999',
      conversationId: fixture.conversation.conversationId,
      sessionId: fixture.session.sessionId,
      role: 'USER',
      content: {
        value: 'Otro mensaje.',
      },
      sequence: 1,
      createdAt: '2026-07-22T00:00:02.000Z',
      metadata: {
        generatedLocally: true,
      },
    })

    if (otherUserMessage.kind !== 'success') {
      throw new Error('Expected valid alternate user message fixture')
    }

    const request = createExecutionRequest({
      id: 'execution:invalid:001',
      conversation: fixture.conversation,
      session: fixture.session,
      userMessage: otherUserMessage.message,
      metadata: {
        createdAt: '2026-07-22T00:00:04.000Z',
        source: 'APPLICATION',
        providerId: 'OPENAI',
        model: 'gpt-4.1-mini',
      },
    })

    expect(request.kind).toBe('failure')
    if (request.kind === 'failure') {
      expect(request.code).toBe('INVALID_EXECUTION_REQUEST')
    }
  })
})

describe('AIExecutionPipeline orchestration', () => {
  it('executes the full deterministic pipeline in order', async () => {
    const request = createExecutionRequestFixture()
    const service = createAIConversationService()
    const calls: string[] = []

    const contextBuilder: AIExecutionContextBuilderPort = {
      buildContext() {
        calls.push('context-builder')
        return {
          kind: 'success',
          context: createContextFixture(),
        }
      },
    }

    const contextResolver: AIExecutionContextResolverPort = {
      resolveContext() {
        calls.push('context-resolver')
        return {
          kind: 'success',
          resolvedContext: createResolvedContextFixture(),
        }
      },
    }

    const promptBuilder: AIExecutionPromptBuilderPort = {
      buildPrompt() {
        calls.push('prompt-builder')
        return {
          kind: 'success',
          prompt: createPromptFixture(),
        }
      },
    }

    const provider = createProviderFixture()
    const pipeline = createAIExecutionPipeline({
      conversationPort: {
        createAssistantMessage(input) {
          calls.push('conversation-create-assistant')
          return service.createAssistantMessage(input)
        },
        appendMessage(session, message) {
          calls.push('conversation-append')
          return service.appendMessage(session, message)
        },
      },
      contextBuilder,
      contextResolver,
      promptBuilder,
      provider: {
        ...provider,
        async executePrompt(providerRequest) {
          calls.push('provider-execute')
          return provider.executePrompt(providerRequest)
        },
      },
    })

    const result = await pipeline.execute(request)

    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error(`Expected success but got ${result.code}`)
    }

    expect(calls).toEqual([
      'context-builder',
      'context-resolver',
      'prompt-builder',
      'provider-execute',
      'conversation-create-assistant',
      'conversation-append',
    ])
    expect(result.response.assistantMessage.role).toBe('ASSISTANT')
    expect(result.response.assistantMessage.content.value).toBe('Tu balance mensual es positivo.')
    expect(result.response.providerResponse.content).toBe('Tu balance mensual es positivo.')
    expect(result.response.metadata.promptId).toBe('prompt:execution:001')
  })

  it('fails when context builder fails', async () => {
    const request = createExecutionRequestFixture()
    const pipeline = createAIExecutionPipeline({
      conversationPort: createAIConversationService(),
      contextBuilder: {
        buildContext() {
          return {
            kind: 'failure',
            code: 'INVALID_CONTEXT',
            retryable: false,
            safeMessage: 'Context failed.',
          }
        },
      },
      contextResolver: {
        resolveContext() {
          throw new Error('not expected')
        },
      },
      promptBuilder: {
        buildPrompt() {
          throw new Error('not expected')
        },
      },
      provider: createProviderFixture(),
    })

    const result = await pipeline.execute(request)
    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('CONTEXT_BUILD_FAILED')
    }
  })

  it('fails when context resolution fails', async () => {
    const request = createExecutionRequestFixture()
    const pipeline = createAIExecutionPipeline({
      conversationPort: createAIConversationService(),
      contextBuilder: {
        buildContext() {
          return {
            kind: 'success',
            context: createContextFixture(),
          }
        },
      },
      contextResolver: {
        resolveContext() {
          return {
            kind: 'failure',
            code: 'NO_SECTIONS_RESOLVED',
            retryable: false,
            safeMessage: 'Resolution failed.',
          }
        },
      },
      promptBuilder: {
        buildPrompt() {
          throw new Error('not expected')
        },
      },
      provider: createProviderFixture(),
    })

    const result = await pipeline.execute(request)
    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('CONTEXT_RESOLUTION_FAILED')
    }
  })

  it('fails when prompt builder fails', async () => {
    const request = createExecutionRequestFixture()
    const pipeline = createAIExecutionPipeline({
      conversationPort: createAIConversationService(),
      contextBuilder: {
        buildContext() {
          return {
            kind: 'success',
            context: createContextFixture(),
          }
        },
      },
      contextResolver: {
        resolveContext() {
          return {
            kind: 'success',
            resolvedContext: createResolvedContextFixture(),
          }
        },
      },
      promptBuilder: {
        buildPrompt() {
          return {
            kind: 'failure',
            code: 'INVALID_PROMPT',
            retryable: false,
            safeMessage: 'Prompt failed.',
          }
        },
      },
      provider: createProviderFixture(),
    })

    const result = await pipeline.execute(request)
    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('PROMPT_BUILD_FAILED')
    }
  })

  it('fails when provider execution fails', async () => {
    const request = createExecutionRequestFixture()
    const pipeline = createAIExecutionPipeline({
      conversationPort: createAIConversationService(),
      contextBuilder: {
        buildContext() {
          return {
            kind: 'success',
            context: createContextFixture(),
          }
        },
      },
      contextResolver: {
        resolveContext() {
          return {
            kind: 'success',
            resolvedContext: createResolvedContextFixture(),
          }
        },
      },
      promptBuilder: {
        buildPrompt() {
          return {
            kind: 'success',
            prompt: createPromptFixture(),
          }
        },
      },
      provider: {
        providerId: 'OPENAI',
        getCapabilities() {
          return {
            supportsStreaming: false,
            supportsVision: false,
            supportsTools: false,
            supportsJson: true,
            maxContextWindow: 128000,
            supportedModels: ['gpt-4.1-mini'],
          }
        },
        async isAvailable() {
          return true
        },
        async executePrompt() {
          return {
            kind: 'failure',
            code: 'PROVIDER_UNAVAILABLE',
            retryable: true,
            safeMessage: 'Provider failed.',
          }
        },
      },
    })

    const result = await pipeline.execute(request)
    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('PROVIDER_EXECUTION_FAILED')
    }
  })

  it('fails when conversation update fails', async () => {
    const request = createExecutionRequestFixture()
    const service = createAIConversationService()
    const pipeline = createAIExecutionPipeline({
      conversationPort: {
        createAssistantMessage: service.createAssistantMessage,
        appendMessage() {
          return {
            kind: 'failure',
            code: 'SESSION_NOT_WRITABLE',
            retryable: false,
            safeMessage: 'Append failed.',
          }
        },
      },
      contextBuilder: {
        buildContext() {
          return {
            kind: 'success',
            context: createContextFixture(),
          }
        },
      },
      contextResolver: {
        resolveContext() {
          return {
            kind: 'success',
            resolvedContext: createResolvedContextFixture(),
          }
        },
      },
      promptBuilder: {
        buildPrompt() {
          return {
            kind: 'success',
            prompt: createPromptFixture(),
          }
        },
      },
      provider: createProviderFixture(),
    })

    const result = await pipeline.execute(request)
    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('CONVERSATION_UPDATE_FAILED')
    }
  })
})
