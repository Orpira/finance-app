import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

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
  createProviderResponse,
  type AIProviderAdapter,
} from '../src/intelligence/provider'
import {
  createAIToolExecutor,
  createAIToolRegistry,
  createPingTool,
  type AITool,
} from '../src/intelligence/ai-tools'

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')

function createPromptFixture() {
  const segment = createPromptSegment({
    id: 'prompt-segment:tools:001',
    role: 'USER',
    content: 'Necesito una herramienta.',
    priority: 'HIGH',
    metadata: {
      createdAt: '2026-07-23T00:00:03.000Z',
      source: 'CONVERSATION',
    },
  })
  if (segment.kind !== 'success') {
    throw new Error('Expected valid prompt segment fixture')
  }

  const prompt = createPrompt({
    promptId: 'prompt:tools:001',
    segments: [segment.segment],
    metadata: {
      createdAt: '2026-07-23T00:00:03.000Z',
      source: 'APPLICATION',
    },
  })

  if (prompt.kind !== 'success') {
    throw new Error('Expected valid prompt fixture')
  }

  return prompt.prompt
}

function createExecutionRequestFixture() {
  const conversation = createAIConversation({
    conversationId: 'conversation:tools:001',
    status: 'OPEN',
    participants: [
      { participantId: 'user:1', role: 'USER', active: true },
      { participantId: 'assistant:1', role: 'ASSISTANT', active: true },
    ],
    metadata: {
      createdAt: '2026-07-23T00:00:00.000Z',
      source: 'APPLICATION',
    },
  })
  if (conversation.kind !== 'success') {
    throw new Error('Expected valid conversation fixture')
  }

  const userMessage = createAIConversationMessage({
    id: 'message:tools:user:001',
    conversationId: conversation.conversation.conversationId,
    sessionId: 'session:tools:001',
    role: 'USER',
    content: { value: 'Usa ping' },
    sequence: 0,
    createdAt: '2026-07-23T00:00:01.000Z',
    metadata: { generatedLocally: true },
  })
  if (userMessage.kind !== 'success') {
    throw new Error('Expected valid user message fixture')
  }

  const session = createAIConversationSession({
    sessionId: 'session:tools:001',
    conversation: conversation.conversation,
    messages: [userMessage.message],
    metadata: {
      createdAt: '2026-07-23T00:00:00.000Z',
      updatedAt: '2026-07-23T00:00:01.000Z',
      source: 'APPLICATION',
    },
  })
  if (session.kind !== 'success') {
    throw new Error('Expected valid session fixture')
  }

  const request = createExecutionRequest({
    id: 'execution:tools:001',
    conversation: conversation.conversation,
    session: session.session,
    userMessage: userMessage.message,
    metadata: {
      createdAt: '2026-07-23T00:00:04.000Z',
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
  const contextBuilder: AIExecutionContextBuilderPort = {
    buildContext() {
      return {
        kind: 'success',
        context: {
          protocolVersion: 1,
          id: 'context:tools:001' as never,
          sections: [],
          metadata: {
            protocolVersion: 1,
            createdAt: '2026-07-23T00:00:02.000Z',
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
          id: 'resolved-context:default:tools:001' as never,
          sections: [],
          strategy: 'DEFAULT',
          metadata: {
            protocolVersion: 1,
            createdAt: '2026-07-23T00:00:02.000Z',
            sourceContextId: 'context:tools:001',
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
        prompt: createPromptFixture(),
      }
    },
  }

  return { contextBuilder, contextResolver, promptBuilder }
}

function createProviderFromResponses(responses: readonly string[]) {
  let cursor = 0

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
      const content = responses[cursor] ?? responses[responses.length - 1] ?? 'fallback'
      cursor += 1

      const response = createProviderResponse({
        id: `provider-response:openai:tools:${cursor}`,
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
        kind: 'success',
        response: response.response,
      }
    },
  }

  return createProvider({ adapter })
}

describe('AI Tool Calling Infrastructure (PB-IS-011D)', () => {
  it('registers and lists PingTool', async () => {
    const registry = createAIToolRegistry()
    const registered = registry.register(createPingTool())
    expect(registered.kind).toBe('success')

    const definitions = registry.listDefinitions()
    expect(definitions).toHaveLength(1)
    expect(definitions[0]?.name).toBe('ping')

    const executor = createAIToolExecutor({ registry })
    const result = await executor.execute({
      toolName: 'ping',
      arguments: {},
      context: {
        executionId: 'execution:tools:register',
        conversationId: 'conversation:tools:register',
        sessionId: 'session:tools:register',
        providerId: 'OPENAI',
        model: 'gpt-4.1-mini',
        requestedAt: '2026-07-23T00:00:10.000Z',
        caller: 'PIPELINE',
      },
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.value.output).toBe('PONG')
    }
  })

  it('fails closed on duplicate registration', () => {
    const registry = createAIToolRegistry([createPingTool()])
    const duplicate = registry.register(createPingTool())

    expect(duplicate.kind).toBe('failure')
    if (duplicate.kind === 'failure') {
      expect(duplicate.code).toBe('TOOL_ALREADY_REGISTERED')
    }
  })

  it('fails when executing unknown tool', async () => {
    const executor = createAIToolExecutor({ registry: createAIToolRegistry() })
    const result = await executor.execute({
      toolName: 'missing',
      arguments: {},
      context: {
        executionId: 'execution:tools:not-found',
        conversationId: 'conversation:tools:not-found',
        sessionId: 'session:tools:not-found',
        providerId: 'OPENAI',
        model: 'gpt-4.1-mini',
        requestedAt: '2026-07-23T00:00:10.000Z',
        caller: 'PIPELINE',
      },
    })

    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('TOOL_NOT_FOUND')
    }
  })

  it('fails on invalid schema tool registration', () => {
    const invalidTool: AITool = {
      definition: {
        name: 'invalid',
        description: 'Broken schema',
        permission: 'read-only',
        deterministic: true,
        failClosed: true,
        inputSchema: {
          type: 'object',
          required: ['x'],
          additionalProperties: false,
          properties: {
            x: { type: 'array' },
          },
        },
        outputSchema: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
          },
          additionalProperties: false,
        },
      },
      async execute() {
        return {
          kind: 'success',
          value: {
            toolName: 'invalid',
            output: { ok: true },
            permission: 'read-only',
            durationMs: 0,
          },
        }
      },
    }

    const registry = createAIToolRegistry()
    const result = registry.register({
      ...invalidTool,
      definition: {
        ...invalidTool.definition,
        inputSchema: {
          ...invalidTool.definition.inputSchema,
          properties: {
            ...invalidTool.definition.inputSchema.properties,
            // @ts-expect-error intentional invalid schema for fail-closed test
            y: { type: 'nope' },
          },
        },
      },
    })

    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('INVALID_TOOL')
    }
  })

  it('fails on invalid arguments for PingTool', async () => {
    const executor = createAIToolExecutor({
      registry: createAIToolRegistry([createPingTool()]),
    })

    const result = await executor.execute({
      toolName: 'ping',
      arguments: { unexpected: true },
      context: {
        executionId: 'execution:tools:bad-args',
        conversationId: 'conversation:tools:bad-args',
        sessionId: 'session:tools:bad-args',
        providerId: 'OPENAI',
        model: 'gpt-4.1-mini',
        requestedAt: '2026-07-23T00:00:10.000Z',
        caller: 'PIPELINE',
      },
    })

    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('INVALID_ARGUMENTS')
    }
  })

  it('maps tool runtime exception to TOOL_EXECUTION_FAILED', async () => {
    const unstableTool: AITool = {
      definition: {
        name: 'unstable',
        description: 'Throws always',
        permission: 'read-only',
        deterministic: true,
        failClosed: true,
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        outputSchema: {
          type: 'string',
        },
      },
      async execute() {
        throw new Error('boom')
      },
    }

    const executor = createAIToolExecutor({
      registry: createAIToolRegistry([unstableTool]),
    })

    const result = await executor.execute({
      toolName: 'unstable',
      arguments: {},
      context: {
        executionId: 'execution:tools:error',
        conversationId: 'conversation:tools:error',
        sessionId: 'session:tools:error',
        providerId: 'OPENAI',
        model: 'gpt-4.1-mini',
        requestedAt: '2026-07-23T00:00:10.000Z',
        caller: 'PIPELINE',
      },
    })

    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('TOOL_EXECUTION_FAILED')
    }
  })

  it('supports dynamic registry growth without pipeline/provider edits', async () => {
    const registry = createAIToolRegistry([createPingTool()])
    const echoTool: AITool = {
      definition: {
        name: 'echo',
        description: 'Echoes input text',
        permission: 'read-only',
        deterministic: true,
        failClosed: true,
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string' },
          },
          required: ['text'],
          additionalProperties: false,
        },
        outputSchema: {
          type: 'string',
        },
      },
      async execute(input) {
        return {
          kind: 'success',
          value: {
            toolName: 'echo',
            output: input.arguments.text as string,
            permission: 'read-only',
            durationMs: 0,
          },
        }
      },
    }

    const registered = registry.register(echoTool)
    expect(registered.kind).toBe('success')

    const executor = createAIToolExecutor({ registry })
    const echoed = await executor.execute({
      toolName: 'echo',
      arguments: { text: 'hola' },
      context: {
        executionId: 'execution:tools:echo',
        conversationId: 'conversation:tools:echo',
        sessionId: 'session:tools:echo',
        providerId: 'OPENAI',
        model: 'gpt-4.1-mini',
        requestedAt: '2026-07-23T00:00:10.000Z',
        caller: 'PIPELINE',
      },
    })

    expect(echoed.kind).toBe('success')
    if (echoed.kind === 'success') {
      expect(echoed.value.output).toBe('hola')
    }
  })

  it('integrates pipeline with tool execution and final provider response', async () => {
    const request = createExecutionRequestFixture()
    const service = createAIConversationService()
    const ports = createStaticPipelinePorts()
    const provider = createProviderFromResponses([
      JSON.stringify({ type: 'tool_call', toolName: 'ping', arguments: {} }),
      'Tool executed correctly: PONG',
    ])

    const executor = createAIToolExecutor({
      registry: createAIToolRegistry([createPingTool()]),
    })

    const pipeline = createAIExecutionPipeline({
      conversationPort: {
        createAssistantMessage: service.createAssistantMessage,
        appendMessage: service.appendMessage,
      },
      contextBuilder: ports.contextBuilder,
      contextResolver: ports.contextResolver,
      promptBuilder: ports.promptBuilder,
      provider,
      toolExecutor: executor,
    })

    const result = await pipeline.execute(request)
    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.response.providerResponse.content).toBe('Tool executed correctly: PONG')
      expect(result.response.assistantMessage.content.value).toBe('Tool executed correctly: PONG')
    }
  })

  it('keeps provider adapter decoupled from tool infrastructure', () => {
    const openAIAdapterSource = readFileSync(
      resolve(__dirname, '../src/intelligence/provider/openAIProviderAdapter.ts'),
      'utf8',
    )
    const providerContractsSource = readFileSync(
      resolve(__dirname, '../src/intelligence/provider/aiProviderContracts.ts'),
      'utf8',
    )

    expect(openAIAdapterSource).not.toContain('ai-tools')
    expect(providerContractsSource).not.toContain('AITool')
  })

  it('parses tool call envelope from provider response without provider-side execution', async () => {
    const registry = createAIToolRegistry([createPingTool()])
    const executor = createAIToolExecutor({ registry })

    const parsed = executor.resolveRequestFromProviderResponse({
      content: JSON.stringify({ type: 'tool_call', toolName: 'ping', arguments: {} }),
      context: {
        executionId: 'execution:tools:parse',
        conversationId: 'conversation:tools:parse',
        sessionId: 'session:tools:parse',
        providerId: 'OPENAI',
        model: 'gpt-4.1-mini',
        requestedAt: '2026-07-23T00:00:12.000Z',
        caller: 'PIPELINE',
      },
    })

    expect(parsed.kind).toBe('success')
    if (parsed.kind !== 'success') {
      throw new Error('Expected parse success')
    }

    expect(parsed.request?.toolName).toBe('ping')

    const execution = await executor.execute(parsed.request as NonNullable<typeof parsed.request>)
    expect(execution.kind).toBe('success')
  })

  it('times out long-running tools in fail-closed mode', async () => {
    vi.useFakeTimers()

    const slowTool: AITool = {
      definition: {
        name: 'slow',
        description: 'Long running demo tool',
        permission: 'read-only',
        deterministic: true,
        failClosed: true,
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        outputSchema: {
          type: 'string',
        },
      },
      async execute() {
        return new Promise((resolvePromise) => {
          setTimeout(() => {
            resolvePromise({
              kind: 'success',
              value: {
                toolName: 'slow',
                output: 'late',
                permission: 'read-only',
                durationMs: 0,
              },
            })
          }, 200)
        })
      },
    }

    const executor = createAIToolExecutor({
      registry: createAIToolRegistry([slowTool]),
      defaultTimeoutMs: 50,
    })

    const pending = executor.execute({
      toolName: 'slow',
      arguments: {},
      context: {
        executionId: 'execution:tools:timeout',
        conversationId: 'conversation:tools:timeout',
        sessionId: 'session:tools:timeout',
        providerId: 'OPENAI',
        model: 'gpt-4.1-mini',
        requestedAt: '2026-07-23T00:00:12.000Z',
        caller: 'PIPELINE',
      },
    })

    await vi.advanceTimersByTimeAsync(60)
    const timeout = await pending

    expect(timeout.kind).toBe('failure')
    if (timeout.kind === 'failure') {
      expect(timeout.code).toBe('TOOL_TIMEOUT')
    }

    vi.useRealTimers()
  })
})
