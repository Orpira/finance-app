import { describe, expect, it, vi } from 'vitest'

import type { AITool, AIToolExecutor, AIToolResolver } from '../src/intelligence/ai-tools'
import { createConversationOrchestrator, createConversationOrchestratorRequest } from '../src/intelligence/conversation-orchestrator'
import { createPromptContextBuilder } from '../src/intelligence/prompt-context-builder'
import { createConversationResponseComposer } from '../src/intelligence/response-composer'
import {
  createAIConversationFacade,
  validateAIConversationExecutionResult,
  validateAIConversationFacadeResult,
  validateAIConversationPromptContext,
  validateAIConversationRequest,
  validateAIConversationResponse,
} from '../src/intelligence/ai-conversation/aiConversationFacade'

function createContext() {
  return {
    executionId: 'execution:conversation-orchestration:test',
    conversationId: 'conversation:orchestration:test',
    sessionId: 'session:orchestration:test',
    providerId: 'ORCHESTRATOR',
    model: 'provider-neutral',
    requestedAt: '2026-07-24T12:00:00.000Z',
    caller: 'SYSTEM',
  } as const
}

function createResolvedTool(name: string): AITool {
  return {
    definition: {
      name,
      description: `Tool ${name}`,
      permission: 'read-only',
      deterministic: true,
      failClosed: true,
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: true,
      },
      outputSchema: {
        type: 'object',
        additionalProperties: true,
      },
    },
    async execute() {
      return {
        kind: 'success',
        value: {
          toolName: name,
          output: { ok: true },
          permission: 'read-only',
          durationMs: 0,
        },
      }
    },
  }
}

describe('AI Conversation Facade (PB-IS-013.5)', () => {
  it('executes the full pipeline and returns a ConversationResponse', async () => {
    const resolvedTool = createResolvedTool('tool_one')
    const resolver: AIToolResolver = {
      resolve: vi.fn(() => ({ kind: 'success', tool: resolvedTool })),
      exists: vi.fn(() => true),
      listDefinitions: vi.fn(() => [resolvedTool.definition]),
    }

    const executor: AIToolExecutor = {
      resolveRequestFromProviderResponse: vi.fn(() => ({ kind: 'success', request: null })),
      execute: vi.fn(async () => ({
        kind: 'success',
        value: {
          toolName: 'tool_one',
          output: { value: 'ok' },
          permission: 'read-only',
          durationMs: 1,
        },
      })),
    }

    const orchestrator = createConversationOrchestrator({
      toolResolver: resolver,
      toolExecutor: executor,
    })
    const promptContextBuilder = createPromptContextBuilder()
    const responseComposer = createConversationResponseComposer()
    const facade = createAIConversationFacade({
      orchestrator,
      promptContextBuilder,
      responseComposer,
    })

    const request = createConversationOrchestratorRequest({
      executionId: 'conversation-orchestration:facade',
      context: createContext(),
      steps: [
        {
          stepId: 'step-1',
          order: 1,
          toolId: 'tool_one',
          arguments: {},
        },
      ],
    })

    expect(request.kind).toBe('success')
    if (request.kind !== 'success') {
      throw new Error('Expected a valid request')
    }

    const result = await facade.execute(request.request)
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('Expected a valid facade response')
    }

    expect(result.response.execution.stepCount).toBe(1)
    expect(result.response.execution.blockCount).toBe(2)
    expect(result.response.blocks[0]?.kind).toBe('summary')
    expect(result.response.blocks[1]?.kind).toBe('step-success')
    expect(result.response.promptContext.execution.executionId).toBe('conversation-orchestration:facade')
    expect(validateAIConversationFacadeResult(result)).toBeNull()
    expect(validateAIConversationResponse(result.response)).toBeNull()
    expect(validateAIConversationPromptContext(result.response.promptContext)).toBeNull()
  })

  it('propagates controlled orchestration failures and stops the pipeline', async () => {
    const orchestrator = {
      execute: vi.fn(async () => ({
        kind: 'failure' as const,
        code: 'TOOL_NOT_FOUND' as const,
        retryable: false as const,
        safeMessage: 'The tool was not found.',
      })),
    }

    const promptContextBuilder = {
      build: vi.fn(),
    }

    const responseComposer = {
      build: vi.fn(),
    }

    const facade = createAIConversationFacade({
      orchestrator,
      promptContextBuilder,
      responseComposer,
    })

    const request = createConversationOrchestratorRequest({
      executionId: 'conversation-orchestration:facade-failure',
      context: createContext(),
      steps: [
        {
          stepId: 'step-1',
          order: 1,
          toolId: 'missing-tool',
          arguments: {},
        },
      ],
    })

    expect(request.kind).toBe('success')
    if (request.kind !== 'success') {
      throw new Error('Expected a valid request')
    }

    const result = await facade.execute(request.request)
    expect(result.kind).toBe('failure')
    if (result.kind !== 'failure') {
      throw new Error('Expected a controlled failure')
    }

    expect(result.code).toBe('CONVERSATION_ORCHESTRATION_FAILED')
    expect(promptContextBuilder.build).not.toHaveBeenCalled()
    expect(responseComposer.build).not.toHaveBeenCalled()
  })

  it('validates the request, execution result, prompt context and response via reusable validators', () => {
    const request = createConversationOrchestratorRequest({
      executionId: 'conversation-orchestration:validator',
      context: createContext(),
      steps: [
        {
          stepId: 'step-1',
          order: 1,
          toolId: 'tool_one',
          arguments: {},
        },
      ],
    })

    expect(request.kind).toBe('success')
    if (request.kind !== 'success') {
      throw new Error('Expected a valid request')
    }

    expect(validateAIConversationRequest(request.request)).toBeNull()
    expect(validateAIConversationExecutionResult({
      executionId: 'conversation-orchestration:validator' as const,
      startedAt: '2026-07-24T12:00:00.000Z',
      finishedAt: '2026-07-24T12:00:01.000Z',
      status: 'success',
      summary: {
        totalSteps: 1,
        successfulSteps: 1,
        failedSteps: 0,
      },
      steps: [
        {
          kind: 'success',
          stepId: 'step-1',
          order: 1,
          toolId: 'tool_one',
          resolvedToolName: 'tool_one',
          execution: {
            toolName: 'tool_one',
            output: { ok: true },
            permission: 'read-only',
            durationMs: 1,
          },
        },
      ],
    })).toBeNull()

    const promptContextResult = createPromptContextBuilder().build({
      executionResult: {
        executionId: 'conversation-orchestration:validator' as const,
        startedAt: '2026-07-24T12:00:00.000Z',
        finishedAt: '2026-07-24T12:00:01.000Z',
        status: 'success',
        summary: {
          totalSteps: 1,
          successfulSteps: 1,
          failedSteps: 0,
        },
        steps: [
          {
            kind: 'success',
            stepId: 'step-1',
            order: 1,
            toolId: 'tool_one',
            resolvedToolName: 'tool_one',
            execution: {
              toolName: 'tool_one',
              output: { ok: true },
              permission: 'read-only',
              durationMs: 1,
            },
          },
        ],
      },
    })

    expect(promptContextResult.kind).toBe('success')
    if (promptContextResult.kind !== 'success') {
      throw new Error('Expected a valid prompt context')
    }

    expect(validateAIConversationPromptContext(promptContextResult.context)).toBeNull()

    const responseResult = createConversationResponseComposer().build({
      promptContext: promptContextResult.context,
    })

    expect(responseResult.kind).toBe('success')
    if (responseResult.kind !== 'success') {
      throw new Error('Expected a valid response')
    }

    expect(validateAIConversationResponse(responseResult.response)).toBeNull()
  })
})
