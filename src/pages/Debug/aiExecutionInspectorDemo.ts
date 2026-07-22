import {
  createAIConversation,
  createAIConversationMessage,
  createAIConversationService,
  createAIConversationSession,
} from '../../intelligence/ai-conversation'
import type { AIContext } from '../../intelligence/context-builder'
import {
  createExecutionRequest,
  createAIExecutionPipeline,
  type AIExecutionContextBuilderPort,
  type AIExecutionContextResolverPort,
  type AIExecutionPromptBuilderPort,
} from '../../intelligence/execution-pipeline'
import {
  createAIExecutionInspector,
  type AIExecutionTrace,
} from '../../intelligence/execution-inspector'
import type { AIResolvedContext } from '../../intelligence/context-resolution'
import {
  createPrompt,
  createPromptSegment,
} from '../../intelligence/prompt-builder'
import {
  createProvider,
  createProviderResponse,
  type AIProviderAdapter,
} from '../../intelligence/provider'

function buildConversationFixtures() {
  const conversation = createAIConversation({
    conversationId: 'conversation:debug-inspector:001',
    status: 'OPEN',
    participants: [
      { participantId: 'user:debug', role: 'USER', active: true, displayName: 'Usuario debug' },
      { participantId: 'assistant:debug', role: 'ASSISTANT', active: true, displayName: 'Private Balance AI' },
    ],
    metadata: {
      createdAt: '2026-07-22T00:00:00.000Z',
      source: 'APPLICATION',
    },
  })
  if (conversation.kind !== 'success') {
    throw new Error(conversation.safeMessage)
  }

  const userMessage = createAIConversationMessage({
    id: 'message:debug-inspector:user:001',
    conversationId: conversation.conversation.conversationId,
    sessionId: 'session:debug-inspector:001',
    role: 'USER',
    content: {
      value: 'Explícame por qué esta ejecución generó esta respuesta.',
    },
    sequence: 0,
    createdAt: '2026-07-22T00:00:01.000Z',
    metadata: {
      generatedLocally: true,
      correlationId: 'corr:debug-inspector:001',
      tags: ['debug-demo'],
    },
  })
  if (userMessage.kind !== 'success') {
    throw new Error(userMessage.safeMessage)
  }

  const session = createAIConversationSession({
    sessionId: 'session:debug-inspector:001',
    conversation: conversation.conversation,
    messages: [userMessage.message],
    metadata: {
      createdAt: '2026-07-22T00:00:00.000Z',
      updatedAt: '2026-07-22T00:00:01.000Z',
      source: 'APPLICATION',
    },
  })
  if (session.kind !== 'success') {
    throw new Error(session.safeMessage)
  }

  return {
    conversation: conversation.conversation,
    userMessage: userMessage.message,
    session: session.session,
  }
}

function createContextFixture(): AIContext {
  return {
    protocolVersion: 1,
    id: 'context:debug-inspector:001' as AIContext['id'],
    sections: [
      {
        id: 'context-section:debug-inspector:001' as AIContext['sections'][number]['id'],
        source: 'CONVERSATION',
        priority: 'HIGH',
        content: {
          text: 'Explícame por qué esta ejecución generó esta respuesta.',
        },
        metadata: {
          protocolVersion: 1,
          createdAt: '2026-07-22T00:00:02.000Z',
          source: 'CONVERSATION',
          deterministic: true,
          failClosed: true,
        },
      },
      {
        id: 'context-section:debug-inspector:002' as AIContext['sections'][number]['id'],
        source: 'APPLICATION',
        priority: 'CRITICAL',
        content: {
          locale: 'es-ES',
          usageMode: 'professional',
        },
        metadata: {
          protocolVersion: 1,
          createdAt: '2026-07-22T00:00:02.100Z',
          source: 'APPLICATION',
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
    id: 'resolved-context:default:debug-inspector:001' as AIResolvedContext['id'],
    sections: [
      {
        id: 'resolved-section:debug-inspector:001' as AIResolvedContext['sections'][number]['id'],
        source: 'APPLICATION',
        priority: 'CRITICAL',
        content: {
          locale: 'es-ES',
          usageMode: 'professional',
        },
        metadata: {
          protocolVersion: 1,
          createdAt: '2026-07-22T00:00:02.100Z',
          source: 'APPLICATION',
          deterministic: true,
          failClosed: true,
        },
      },
      {
        id: 'resolved-section:debug-inspector:002' as AIResolvedContext['sections'][number]['id'],
        source: 'CONVERSATION',
        priority: 'HIGH',
        content: {
          text: 'Explícame por qué esta ejecución generó esta respuesta.',
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
      createdAt: '2026-07-22T00:00:02.200Z',
      sourceContextId: 'context:debug-inspector:001',
      source: 'APPLICATION',
      deterministic: true,
      failClosed: true,
    },
  }
}

function createPromptFixture() {
  const segmentOne = createPromptSegment({
    id: 'prompt-segment:debug-inspector:001',
    role: 'SYSTEM',
    content: 'Responde en español de forma breve y explicable.',
    priority: 'CRITICAL',
    metadata: {
      createdAt: '2026-07-22T00:00:03.000Z',
      source: 'SYSTEM',
    },
  })
  const segmentTwo = createPromptSegment({
    id: 'prompt-segment:debug-inspector:002',
    role: 'USER',
    content: 'Explícame por qué esta ejecución generó esta respuesta.',
    priority: 'HIGH',
    metadata: {
      createdAt: '2026-07-22T00:00:03.100Z',
      source: 'CONVERSATION',
    },
  })

  if (segmentOne.kind !== 'success' || segmentTwo.kind !== 'success') {
    throw new Error('Invalid prompt segments for debug inspector demo')
  }

  const prompt = createPrompt({
    promptId: 'prompt:debug-inspector:001',
    segments: [segmentOne.segment, segmentTwo.segment],
    metadata: {
      createdAt: '2026-07-22T00:00:03.000Z',
      source: 'APPLICATION',
    },
  })

  if (prompt.kind !== 'success') {
    throw new Error(prompt.safeMessage)
  }

  return prompt.prompt
}

function createProviderFixture() {
  const response = createProviderResponse({
    id: 'provider-response:openai:debug-inspector:001',
    content: 'La respuesta fue generada usando el contexto de conversación y la configuración activa.',
    usage: {
      inputTokens: 132,
      outputTokens: 28,
      totalTokens: 160,
    },
    finishReason: 'STOP',
    metadata: {
      createdAt: '2026-07-22T00:00:04.000Z',
      requestId: 'provider-request:execution:debug-inspector:001' as never,
      providerId: 'OPENAI',
      model: 'gpt-4.1-mini',
      source: 'SYSTEM',
      latencyMs: 47,
    },
  })

  if (response.kind !== 'success') {
    throw new Error(response.safeMessage)
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

export async function runAIExecutionInspectorDemo(): Promise<AIExecutionTrace | null> {
  const fixtures = buildConversationFixtures()
  const request = createExecutionRequest({
    id: 'execution:debug-inspector:001',
    conversation: fixtures.conversation,
    session: fixtures.session,
    userMessage: fixtures.userMessage,
    metadata: {
      createdAt: '2026-07-22T00:00:04.000Z',
      source: 'APPLICATION',
      providerId: 'OPENAI',
      model: 'gpt-4.1-mini',
      resolutionStrategy: 'DEFAULT',
      responseFormat: 'TEXT',
    },
  })

  if (request.kind !== 'success') {
    throw new Error(request.safeMessage)
  }

  const contextBuilder: AIExecutionContextBuilderPort = {
    buildContext() {
      return {
        kind: 'success',
        context: createContextFixture(),
      }
    },
  }

  const contextResolver: AIExecutionContextResolverPort = {
    resolveContext() {
      return {
        kind: 'success',
        resolvedContext: createResolvedContextFixture(),
      }
    },
  }

  const promptBuilder: AIExecutionPromptBuilderPort = {
    buildPrompt() {
      return {
        kind: 'success',
        prompt: createPromptFixture(),
      }
    },
  }

  const inspector = createAIExecutionInspector()
  const service = createAIConversationService()
  const pipeline = createAIExecutionPipeline({
    conversationPort: {
      createAssistantMessage: service.createAssistantMessage,
      appendMessage: service.appendMessage,
    },
    contextBuilder,
    contextResolver,
    promptBuilder,
    provider: createProviderFixture(),
    inspector,
  })

  await pipeline.execute(request.request)
  return inspector.exportTrace()
}
