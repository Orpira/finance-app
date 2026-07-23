import { describe, expect, it } from 'vitest'

import {
  createAIConversation,
  createAIConversationMessage,
  createAIConversationService,
  createAIConversationSession,
} from '../src/intelligence/ai-conversation'
import {
  createAIExecutionPipeline,
  createExecutionRequest,
  type AIExecutionContextBuilderPort,
  type AIExecutionContextResolverPort,
  type AIExecutionPromptBuilderPort,
} from '../src/intelligence/execution-pipeline'
import {
  createPrompt,
  createPromptSegment,
} from '../src/intelligence/prompt-builder'
import {
  createProvider,
  type AIProviderRequest,
  createProviderResponse,
  type AIProviderAdapter,
} from '../src/intelligence/provider'
import {
  createAIToolExecutor,
  createAIToolRegistry,
} from '../src/intelligence/ai-tools'
import {
  createDeterministicKnowledgeSearchEngine,
  createFixedWindowChunkingStrategy,
  createKnowledgeIndexer,
  createKnowledgeSearchAITool,
  createKnowledgeSearchToolUseCase,
  type KnowledgeDocument,
} from '../src/application/knowledge'
import { LocalKnowledgeRepository } from '../src/database/localKnowledgeRepository'
import type { PersistedKnowledgeDocument } from '../src/types/persistedKnowledgeDocument'
import type { PersistedKnowledgeChunk } from '../src/types/persistedKnowledgeChunk'

class InMemoryTable<TRecord extends { [key in TId]: string }, TId extends keyof TRecord> {
  private readonly storage = new Map<string, TRecord>()

  constructor(private readonly idKey: TId) {}

  async put(value: TRecord): Promise<void> {
    this.storage.set(value[this.idKey], structuredClone(value))
  }

  async bulkPut(values: readonly TRecord[]): Promise<void> {
    for (const value of values) {
      this.storage.set(value[this.idKey], structuredClone(value))
    }
  }

  async get(id: string): Promise<TRecord | undefined> {
    const record = this.storage.get(id)
    return record === undefined ? undefined : structuredClone(record)
  }

  async delete(id: string): Promise<void> {
    this.storage.delete(id)
  }

  async bulkDelete(ids: readonly string[]): Promise<void> {
    for (const id of ids) {
      this.storage.delete(id)
    }
  }

  async toArray(): Promise<TRecord[]> {
    return [...this.storage.values()].map((record) => structuredClone(record))
  }
}

function createKnowledgeRepositoryFixture() {
  const knowledgeDocuments = new InMemoryTable<PersistedKnowledgeDocument, 'documentId'>('documentId')
  const knowledgeChunks = new InMemoryTable<PersistedKnowledgeChunk, 'chunkId'>('chunkId')

  return new LocalKnowledgeRepository({
    database: {
      knowledgeDocuments,
      knowledgeChunks,
      async transaction(_mode, _tables, scope) {
        return scope()
      },
    },
    indexer: createKnowledgeIndexer({
      chunkingStrategy: createFixedWindowChunkingStrategy({
        targetChunkTokens: 24,
        overlapTokens: 6,
        minChunkTokens: 4,
      }),
    }),
    searchEngine: createDeterministicKnowledgeSearchEngine(),
  })
}

function createKnowledgeDocument(input: {
  readonly documentId: string
  readonly title: string
  readonly content: string
}): KnowledgeDocument {
  return {
    documentId: input.documentId,
    title: input.title,
    content: input.content,
    sourceType: 'manual',
    tags: ['kb'],
    createdAt: '2026-07-23T10:00:00.000Z',
    updatedAt: '2026-07-23T10:00:00.000Z',
  }
}

function createPipelineRequestFixture() {
  const conversation = createAIConversation({
    conversationId: 'conversation:knowledge:001',
    status: 'OPEN',
    participants: [
      { participantId: 'user:1', role: 'USER', active: true },
      { participantId: 'assistant:1', role: 'ASSISTANT', active: true },
    ],
    metadata: {
      createdAt: '2026-07-23T11:00:00.000Z',
      source: 'APPLICATION',
    },
  })
  if (conversation.kind !== 'success') {
    throw new Error('Expected valid conversation fixture')
  }

  const userMessage = createAIConversationMessage({
    id: 'message:knowledge:user:001',
    conversationId: conversation.conversation.conversationId,
    sessionId: 'session:knowledge:001',
    role: 'USER',
    content: { value: 'Busca conocimiento sobre IVA' },
    sequence: 0,
    createdAt: '2026-07-23T11:00:01.000Z',
    metadata: { generatedLocally: true },
  })
  if (userMessage.kind !== 'success') {
    throw new Error('Expected valid user message fixture')
  }

  const session = createAIConversationSession({
    sessionId: 'session:knowledge:001',
    conversation: conversation.conversation,
    messages: [userMessage.message],
    metadata: {
      createdAt: '2026-07-23T11:00:00.000Z',
      updatedAt: '2026-07-23T11:00:01.000Z',
      source: 'APPLICATION',
    },
  })
  if (session.kind !== 'success') {
    throw new Error('Expected valid session fixture')
  }

  const request = createExecutionRequest({
    id: 'execution:knowledge:001',
    conversation: conversation.conversation,
    session: session.session,
    userMessage: userMessage.message,
    metadata: {
      createdAt: '2026-07-23T11:00:02.000Z',
      source: 'APPLICATION',
      providerId: 'OPENAI',
      model: 'gpt-4.1-mini',
      responseFormat: 'TEXT',
    },
  })
  if (request.kind !== 'success') {
    throw new Error('Expected valid execution request fixture')
  }

  return request.request
}

function createStaticPipelinePorts() {
  const promptSegment = createPromptSegment({
    id: 'prompt-segment:knowledge:001',
    role: 'USER',
    content: 'consulta de prueba',
    priority: 'HIGH',
    metadata: {
      createdAt: '2026-07-23T11:00:00.000Z',
      source: 'CONVERSATION',
    },
  })
  if (promptSegment.kind !== 'success') {
    throw new Error('Expected valid prompt segment fixture')
  }

  const prompt = createPrompt({
    promptId: 'prompt:knowledge:001',
    segments: [promptSegment.segment],
    metadata: {
      createdAt: '2026-07-23T11:00:00.000Z',
      source: 'APPLICATION',
    },
  })
  if (prompt.kind !== 'success') {
    throw new Error('Expected valid prompt fixture')
  }

  const contextBuilder: AIExecutionContextBuilderPort = {
    buildContext() {
      return {
        kind: 'success',
        context: {
          protocolVersion: 1,
          id: 'context:knowledge:001' as never,
          sections: [],
          metadata: {
            protocolVersion: 1,
            createdAt: '2026-07-23T11:00:00.000Z',
            source: 'APPLICATION',
            deterministic: true,
            failClosed: true,
          },
        },
      }
    },
  }

  const contextResolver: AIExecutionContextResolverPort = {
    resolveContext() {
      return {
        kind: 'success',
        resolvedContext: {
          id: 'resolved-context:knowledge:001' as never,
          sections: [],
          strategy: 'DEFAULT',
          metadata: {
            protocolVersion: 1,
            createdAt: '2026-07-23T11:00:00.000Z',
            sourceContextId: 'context:knowledge:001',
            source: 'APPLICATION',
            deterministic: true,
            failClosed: true,
          },
        },
      }
    },
  }

  const promptBuilder: AIExecutionPromptBuilderPort = {
    buildPrompt() {
      return {
        kind: 'success',
        prompt: prompt.prompt,
      }
    },
  }

  return { contextBuilder, contextResolver, promptBuilder }
}

function createProviderFromResponses(responses: readonly string[]) {
  let cursor = 0
  const requests: AIProviderRequest[] = []

  const adapter: AIProviderAdapter = {
    providerId: 'OPENAI',
    getCapabilities() {
      return {
        supportsStreaming: false,
        supportsVision: false,
        supportsTools: true,
        supportsJson: true,
        maxContextWindow: 128000,
        supportedModels: ['gpt-4.1-mini'],
      }
    },
    async isAvailable() {
      return true
    },
    async executePrompt(request) {
      requests.push(structuredClone(request))
      const content = responses[cursor] ?? responses[responses.length - 1] ?? 'fallback'
      cursor += 1

      const response = createProviderResponse({
        id: `provider-response:knowledge:${cursor}`,
        content,
        usage: {
          inputTokens: 10,
          outputTokens: 10,
          totalTokens: 20,
        },
        finishReason: 'STOP',
        metadata: {
          createdAt: request.metadata.createdAt,
          requestId: request.id,
          providerId: 'OPENAI',
          model: request.metadata.model,
          source: 'SYSTEM',
        },
      })

      if (response.kind !== 'success') {
        throw new Error('Expected provider response fixture')
      }

      return {
        kind: 'success' as const,
        response: response.response,
      }
    },
  }

  return {
    provider: createProvider({ adapter }),
    requests,
  }
}

describe('Knowledge Retrieval Tool Infrastructure (PB-IS-011E)', () => {
  it('saves, updates, deletes and lists documents with local indexing', async () => {
    const repository = createKnowledgeRepositoryFixture()
    const source = createKnowledgeDocument({
      documentId: 'doc:iva:001',
      title: 'Guia IVA',
      content: 'El impuesto IVA se declara de forma mensual cuando aplica.',
    })

    const saved = await repository.saveDocument({ document: source })
    expect(saved.kind).toBe('success')
    if (saved.kind === 'success') {
      expect(saved.value.chunksIndexed).toBeGreaterThan(0)
    }

    const updated = await repository.updateDocument({
      document: {
        ...source,
        content: 'El impuesto IVA se declara de forma mensual y trimestral segun regimen.',
        updatedAt: '2026-07-23T10:05:00.000Z',
      },
    })
    expect(updated.kind).toBe('success')

    const listed = await repository.listDocuments()
    expect(listed.kind).toBe('success')
    if (listed.kind === 'success') {
      expect(listed.value).toHaveLength(1)
      expect(listed.value[0]?.documentId).toBe(source.documentId)
    }

    const deleted = await repository.deleteDocument({ documentId: source.documentId })
    expect(deleted).toEqual({ kind: 'success', value: { deleted: true } })
  })

  it('searches with deterministic ranking and returns NO_RESULTS when needed', async () => {
    const repository = createKnowledgeRepositoryFixture()

    await repository.saveDocument({
      document: createKnowledgeDocument({
        documentId: 'doc:iva:001',
        title: 'IVA mensual',
        content: 'IVA mensual para autonomos. Declaracion y cierre fiscal mensual.',
      }),
    })

    await repository.saveDocument({
      document: createKnowledgeDocument({
        documentId: 'doc:ventas:002',
        title: 'Ventas',
        content: 'Reporte de ventas semanales y control de tickets.',
      }),
    })

    const ranked = await repository.search({
      query: {
        text: 'iva fiscal mensual',
        limit: 3,
      },
    })
    expect(ranked.kind).toBe('success')
    if (ranked.kind === 'success') {
      expect(ranked.value.matches.length).toBeGreaterThan(0)
      expect(ranked.value.matches[0]?.document.documentId).toBe('doc:iva:001')
    }

    const noResults = await repository.search({
      query: {
        text: 'criptografia cuantica',
        limit: 3,
      },
    })

    expect(noResults.kind).toBe('failure')
    if (noResults.kind === 'failure') {
      expect(noResults.code).toBe('NO_RESULTS')
    }
  })

  it('executes KnowledgeSearchTool through registry/executor and pipeline tool-calling', async () => {
    const repository = createKnowledgeRepositoryFixture()
    await repository.saveDocument({
      document: createKnowledgeDocument({
        documentId: 'doc:iva:tool:001',
        title: 'IVA base',
        content: 'El IVA general en Espana es del 21 por ciento con excepciones.',
      }),
    })

    const knowledgeTool = createKnowledgeSearchAITool({
      tool: createKnowledgeSearchToolUseCase({ repository }),
    })

    const executor = createAIToolExecutor({
      registry: createAIToolRegistry([knowledgeTool]),
    })

    const direct = await executor.execute({
      toolName: 'knowledge_search',
      arguments: {
        query: 'iva general espana',
        limit: 3,
      },
      context: {
        executionId: 'execution:knowledge:tool:direct',
        conversationId: 'conversation:knowledge:tool:direct',
        sessionId: 'session:knowledge:tool:direct',
        providerId: 'OPENAI',
        model: 'gpt-4.1-mini',
        requestedAt: '2026-07-23T11:10:00.000Z',
        caller: 'PIPELINE',
      },
    })

    expect(direct.kind).toBe('success')
    if (direct.kind === 'success') {
      const payload = direct.value.output as { status: string; chunks: readonly unknown[] }
      expect(payload.status).toBe('ok')
      expect(payload.chunks.length).toBeGreaterThan(0)
    }

    const request = createPipelineRequestFixture()
    const ports = createStaticPipelinePorts()
    const providerFixture = createProviderFromResponses([
      JSON.stringify({
        type: 'tool_call',
        toolName: 'knowledge_search',
        arguments: { query: 'iva general espana', limit: 2 },
      }),
      'Resumen con evidencia local completado.',
    ])
    const service = createAIConversationService()

    const pipeline = createAIExecutionPipeline({
      conversationPort: {
        createAssistantMessage: service.createAssistantMessage,
        appendMessage: service.appendMessage,
      },
      contextBuilder: ports.contextBuilder,
      contextResolver: ports.contextResolver,
      promptBuilder: ports.promptBuilder,
      provider: providerFixture.provider,
      toolExecutor: executor,
    })

    const pipelineResult = await pipeline.execute(request)
    expect(pipelineResult.kind).toBe('success')
    if (pipelineResult.kind === 'success') {
      expect(pipelineResult.response.providerResponse.content).toBe('Resumen con evidencia local completado.')
      expect(pipelineResult.response.assistantMessage.content.value).toBe('Resumen con evidencia local completado.')
    }

    expect(providerFixture.requests).toHaveLength(2)
    const followUpPromptContent = providerFixture.requests[1]?.prompt.segments
      .map((segment) => segment.content)
      .join('\n') ?? ''
    expect(followUpPromptContent).toContain('"type":"tool_result"')
    expect(followUpPromptContent).toContain('"toolName":"knowledge_search"')
    expect(followUpPromptContent).toContain('"status":"ok"')
  })
})
