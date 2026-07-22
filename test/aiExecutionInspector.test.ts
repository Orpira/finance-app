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
import {
  createExecutionRequest,
  createAIExecutionPipeline,
  type AIExecutionContextBuilderPort,
  type AIExecutionContextResolverPort,
  type AIExecutionPromptBuilderPort,
} from '../src/intelligence/execution-pipeline'
import {
  createAIExecutionInspector,
  createAIExecutionInspectorViewModel,
  createSnapshot,
  createStage,
  createTrace,
  validateAIExecutionTrace,
  type AIExecutionTrace,
} from '../src/intelligence/execution-inspector'
import type { AIResolvedContext } from '../src/intelligence/context-resolution'
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
    conversationId: 'conversation:inspector:001',
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
    id: 'message:inspector:user:001',
    conversationId,
    sessionId,
    role: 'USER',
    content: {
      value: 'Necesito inspeccionar la ejecución.',
    },
    sequence: 0,
    createdAt: '2026-07-22T00:00:01.000Z',
    metadata: {
      generatedLocally: true,
      correlationId: 'corr:inspector:001',
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
  const userMessage = createUserMessageFixture('session:inspector:001', conversation.conversationId)
  const session = createAIConversationSession({
    sessionId: 'session:inspector:001',
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
    id: 'context:inspector:001' as AIContext['id'],
    sections: [
      {
        id: 'context-section:inspector:001' as AIContext['sections'][number]['id'],
        source: 'CONVERSATION',
        priority: 'HIGH',
        content: {
          text: 'Necesito inspeccionar la ejecución.',
        },
        metadata: {
          protocolVersion: 1,
          createdAt: '2026-07-22T00:00:02.000Z',
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
    id: 'resolved-context:default:inspector:001' as AIResolvedContext['id'],
    sections: [
      {
        id: 'resolved-section:inspector:001' as AIResolvedContext['sections'][number]['id'],
        source: 'CONVERSATION',
        priority: 'HIGH',
        content: {
          text: 'Necesito inspeccionar la ejecución.',
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
      sourceContextId: 'context:inspector:001',
      source: 'APPLICATION',
      deterministic: true,
      failClosed: true,
    },
  }
}

function createPromptFixture(): AIPrompt {
  const segment = createPromptSegment({
    id: 'prompt-segment:inspector:001',
    role: 'USER',
    content: 'Necesito inspeccionar la ejecución.',
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
    promptId: 'prompt:inspector:001',
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
    id: 'provider-response:openai:inspector:001',
    content: 'La traza fue capturada correctamente.',
    usage: {
      inputTokens: 120,
      outputTokens: 30,
      totalTokens: 150,
    },
    finishReason: 'STOP',
    metadata: {
      createdAt: '2026-07-22T00:00:04.000Z',
      requestId: 'provider-request:execution:inspector:001' as never,
      providerId: 'OPENAI',
      model: 'gpt-4.1-mini',
      source: 'SYSTEM',
    },
  })

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
    id: 'execution:inspector:001',
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

  if (request.kind !== 'success') {
    throw new Error(`Expected valid execution request but got ${request.code}`)
  }

  return request.request
}

describe('AIExecutionInspector factory and validator (Milestone 10F)', () => {
  it('creates immutable snapshots, stages and traces with consistent order', () => {
    const request = createExecutionRequestFixture()
    const snapshot = createSnapshot({
      createdAt: '2026-07-22T00:00:05.000Z',
      executionRequest: request,
      context: createContextFixture(),
    })

    expect(snapshot.kind).toBe('success')
    if (snapshot.kind !== 'success') {
      throw new Error(`Expected valid snapshot but got ${snapshot.code}`)
    }

    const stage = createStage({
      name: 'CONTEXT_BUILD',
      status: 'SUCCESS',
      startedAt: '2026-07-22T00:00:05.000Z',
      finishedAt: '2026-07-22T00:00:05.010Z',
      duration: 10,
      snapshot: snapshot.snapshot,
    })

    expect(stage.kind).toBe('success')
    if (stage.kind !== 'success') {
      throw new Error(`Expected valid stage but got ${stage.code}`)
    }

    const pendingSnapshot = createSnapshot({
      createdAt: '2026-07-22T00:00:05.011Z',
    })
    if (pendingSnapshot.kind !== 'success') {
      throw new Error(`Expected valid empty snapshot but got ${pendingSnapshot.code}`)
    }

    const trace = createTrace({
      id: 'execution:trace:001',
      startedAt: '2026-07-22T00:00:05.000Z',
      finishedAt: '2026-07-22T00:00:05.020Z',
      stages: [
        stage.stage,
        createStage({ name: 'CONTEXT_RESOLUTION', status: 'SKIPPED', startedAt: '2026-07-22T00:00:05.020Z', finishedAt: '2026-07-22T00:00:05.020Z', duration: 0, snapshot: pendingSnapshot.snapshot }).stage,
        createStage({ name: 'PROMPT_BUILD', status: 'SKIPPED', startedAt: '2026-07-22T00:00:05.020Z', finishedAt: '2026-07-22T00:00:05.020Z', duration: 0, snapshot: pendingSnapshot.snapshot }).stage,
        createStage({ name: 'PROVIDER_REQUEST', status: 'SKIPPED', startedAt: '2026-07-22T00:00:05.020Z', finishedAt: '2026-07-22T00:00:05.020Z', duration: 0, snapshot: pendingSnapshot.snapshot }).stage,
        createStage({ name: 'PROVIDER_RESPONSE', status: 'SKIPPED', startedAt: '2026-07-22T00:00:05.020Z', finishedAt: '2026-07-22T00:00:05.020Z', duration: 0, snapshot: pendingSnapshot.snapshot }).stage,
        createStage({ name: 'ASSISTANT_MESSAGE', status: 'SKIPPED', startedAt: '2026-07-22T00:00:05.020Z', finishedAt: '2026-07-22T00:00:05.020Z', duration: 0, snapshot: pendingSnapshot.snapshot }).stage,
        createStage({ name: 'CONVERSATION_UPDATE', status: 'SKIPPED', startedAt: '2026-07-22T00:00:05.020Z', finishedAt: '2026-07-22T00:00:05.020Z', duration: 0, snapshot: pendingSnapshot.snapshot }).stage,
      ],
      metadata: {
        status: 'FAILED',
        conversationId: request.conversation.conversationId,
        sessionId: request.session.sessionId,
        providerId: request.metadata.providerId,
        model: request.metadata.model,
      },
    })

    expect(trace.kind).toBe('success')
    if (trace.kind !== 'success') {
      throw new Error(`Expected valid trace but got ${trace.code}`)
    }

    expect(validateAIExecutionTrace(trace.trace)).toBeNull()
    expect(Object.isFrozen(trace.trace)).toBe(true)
    expect(Object.isFrozen(trace.trace.stages)).toBe(true)
  })

  it('captures stages and exports an immutable trace with skipped tail stages', () => {
    const request = createExecutionRequestFixture()
    const inspector = createAIExecutionInspector()

    inspector.beginTrace({
      id: request.id,
      startedAt: '2026-07-22T00:00:05.000Z',
      metadata: {
        conversationId: request.conversation.conversationId,
        sessionId: request.session.sessionId,
        providerId: request.metadata.providerId,
        model: request.metadata.model,
      },
    })
    inspector.captureStage({
      name: 'CONTEXT_BUILD',
      status: 'SUCCESS',
      startedAt: '2026-07-22T00:00:05.000Z',
      finishedAt: '2026-07-22T00:00:05.015Z',
      duration: 15,
      snapshot: {
        createdAt: '2026-07-22T00:00:05.015Z',
        executionRequest: request,
        context: createContextFixture(),
      },
    })
    inspector.finishTrace({
      finishedAt: '2026-07-22T00:00:05.020Z',
      status: 'FAILED',
    })

    const trace = inspector.exportTrace()
    expect(trace).not.toBeNull()
    if (trace === null) {
      throw new Error('Expected trace export')
    }

    expect(trace.metadata.status).toBe('FAILED')
    expect(trace.stages[0].status).toBe('SUCCESS')
    expect(trace.stages[1].status).toBe('SKIPPED')
    expect(Object.isFrozen(trace)).toBe(false)
    expect(validateAIExecutionTrace(trace)).toBeNull()
  })
})

describe('AIExecutionInspector integration and view model', () => {
  it('captures a full pipeline trace without altering pipeline behavior', async () => {
    const request = createExecutionRequestFixture()
    const service = createAIConversationService()
    const inspector = createAIExecutionInspector()

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

    const result = await pipeline.execute(request)
    expect(result.kind).toBe('success')

    const trace = inspector.exportTrace()
    expect(trace).not.toBeNull()
    if (trace === null) {
      throw new Error('Expected trace export')
    }

    expect(trace.metadata.status).toBe('SUCCESS')
    expect(trace.stages.map((stage) => stage.status)).toEqual([
      'SUCCESS',
      'SUCCESS',
      'SUCCESS',
      'SUCCESS',
      'SUCCESS',
      'SUCCESS',
      'SUCCESS',
    ])
    expect(trace.stages[0].snapshot.context?.id).toBe('context:inspector:001')
    expect(trace.stages[2].snapshot.prompt?.promptId).toBe('prompt:inspector:001')
    expect(trace.stages[3].snapshot.providerRequest?.metadata.providerId).toBe('OPENAI')
    expect(trace.stages[4].snapshot.providerResponse?.content).toBe('La traza fue capturada correctamente.')
    expect(trace.stages[5].snapshot.assistantMessage?.role).toBe('ASSISTANT')
    expect(trace.stages[6].snapshot.session?.messages).toHaveLength(2)
  })

  it('builds a read-only view model from an exported trace', () => {
    const trace = createAIExecutionInspector()
    const request = createExecutionRequestFixture()

    trace.beginTrace({
      id: request.id,
      startedAt: '2026-07-22T00:00:05.000Z',
      metadata: {
        conversationId: request.conversation.conversationId,
        sessionId: request.session.sessionId,
        providerId: request.metadata.providerId,
        model: request.metadata.model,
      },
    })
    trace.captureStage({
      name: 'CONTEXT_BUILD',
      status: 'SUCCESS',
      startedAt: '2026-07-22T00:00:05.000Z',
      finishedAt: '2026-07-22T00:00:05.010Z',
      duration: 10,
      snapshot: {
        createdAt: '2026-07-22T00:00:05.010Z',
        executionRequest: request,
        context: createContextFixture(),
      },
    })
    trace.finishTrace({
      finishedAt: '2026-07-22T00:00:05.030Z',
      status: 'SUCCESS',
    })

    const exported = trace.exportTrace() as AIExecutionTrace
    const viewModel = createAIExecutionInspectorViewModel(exported)

    expect(viewModel).not.toBeNull()
    if (viewModel === null) {
      throw new Error('Expected execution inspector view model')
    }

    expect(viewModel.status).toBe('SUCCESS')
    expect(viewModel.stages[0].label).toBe('Context Builder')
    expect(viewModel.stages[0].sections[0].label).toBe('Execution Request')
    expect(viewModel.stages[1].status).toBe('SKIPPED')
  })
})
