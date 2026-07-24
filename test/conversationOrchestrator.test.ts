import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import type {
  AITool,
  AIToolExecutionResult,
  AIToolExecutor,
  AIToolFailure,
  AIToolResolver,
} from '../src/intelligence/ai-tools'
import {
  createAIToolRegistry,
  createPingTool,
} from '../src/intelligence/ai-tools'
import {
  registerFinancialToolsCatalog,
} from '../src/intelligence/ai-tools/financial'
import {
  createConversationOrchestrator,
  createConversationOrchestratorRequest,
  createFinancialConversationOrchestrator,
  type AIConversationOrchestratorRequest,
} from '../src/intelligence/conversation-orchestrator'

function createContext(): AIConversationOrchestratorRequest['context'] {
  return {
    executionId: 'execution:conversation-orchestration:test',
    conversationId: 'conversation:orchestration:test',
    sessionId: 'session:orchestration:test',
    providerId: 'ORCHESTRATOR',
    model: 'provider-neutral',
    requestedAt: '2026-07-24T12:00:00.000Z',
    caller: 'SYSTEM',
  }
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

function createSuccessExecution(toolName: string, output: Record<string, unknown>): Extract<AIToolExecutionResult, { kind: 'success' }> {
  return {
    kind: 'success',
    value: {
      toolName,
      output,
      permission: 'read-only',
      durationMs: 1,
    },
  }
}

function createFailure(code: AIToolFailure['code'], safeMessage: string): AIToolFailure {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
  }
}

describe('AI Conversation Orchestrator (PB-IS-013.2)', () => {
  it('executes one tool successfully through resolver plus executor', async () => {
    const resolvedTool = createResolvedTool('tool_one')
    const resolver: AIToolResolver = {
      resolve: vi.fn(() => ({ kind: 'success', tool: resolvedTool })),
      exists: vi.fn(() => true),
      listDefinitions: vi.fn(() => [resolvedTool.definition]),
    }

    const executor: AIToolExecutor = {
      resolveRequestFromProviderResponse: vi.fn(() => ({ kind: 'success', request: null })),
      execute: vi.fn(async () => createSuccessExecution('tool_one', { value: 'ok' })),
    }

    const orchestrator = createConversationOrchestrator({
      toolResolver: resolver,
      toolExecutor: executor,
    })

    const request = createConversationOrchestratorRequest({
      executionId: 'conversation-orchestration:single',
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
      throw new Error('Expected valid request')
    }

    const result = await orchestrator.execute(request.request)
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('Expected orchestrator success')
    }

    expect(result.result.status).toBe('success')
    expect(result.result.summary).toEqual({
      totalSteps: 1,
      successfulSteps: 1,
      failedSteps: 0,
    })
    expect(result.result.steps[0]?.kind).toBe('success')
    if (result.result.steps[0]?.kind === 'success') {
      expect(result.result.steps[0].resolvedToolName).toBe('tool_one')
      expect(result.result.steps[0].execution.output).toEqual({ value: 'ok' })
    }

    expect(resolver.resolve).toHaveBeenCalledWith('tool_one')
    expect(executor.execute).toHaveBeenCalledTimes(1)
  })

  it('executes multiple tools sequentially by declared order', async () => {
    const resolver: AIToolResolver = {
      resolve: vi.fn((toolId: string) => ({
        kind: 'success',
        tool: createResolvedTool(toolId === 'tool-a' ? 'tool_a' : 'tool_b'),
      })),
      exists: vi.fn(() => true),
      listDefinitions: vi.fn(() => []),
    }

    const executedOrder: string[] = []
    const executor: AIToolExecutor = {
      resolveRequestFromProviderResponse: vi.fn(() => ({ kind: 'success', request: null })),
      execute: vi.fn(async (executionRequest) => {
        executedOrder.push(executionRequest.toolName)
        return createSuccessExecution(executionRequest.toolName, { order: executedOrder.length })
      }),
    }

    const orchestrator = createConversationOrchestrator({ toolResolver: resolver, toolExecutor: executor })
    const request = createConversationOrchestratorRequest({
      executionId: 'conversation-orchestration:multi',
      context: createContext(),
      steps: [
        { stepId: 'step-b', order: 2, toolId: 'tool-b', arguments: {} },
        { stepId: 'step-a', order: 1, toolId: 'tool-a', arguments: {} },
      ],
    })

    expect(request.kind).toBe('success')
    if (request.kind !== 'success') {
      throw new Error('Expected valid request')
    }

    const result = await orchestrator.execute(request.request)
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('Expected orchestrator success')
    }

    expect(executedOrder).toEqual(['tool_a', 'tool_b'])
    expect(result.result.steps.map((step) => step.order)).toEqual([1, 2])
    expect(result.result.status).toBe('success')
  })

  it('captures failures and continues remaining steps', async () => {
    const resolver: AIToolResolver = {
      resolve: vi.fn((toolId: string) => {
        if (toolId === 'missing-tool') {
          return createFailure('TOOL_NOT_FOUND', 'Missing tool')
        }

        return {
          kind: 'success',
          tool: createResolvedTool(toolId),
        }
      }),
      exists: vi.fn(() => true),
      listDefinitions: vi.fn(() => []),
    }

    const executedTools: string[] = []
    const executor: AIToolExecutor = {
      resolveRequestFromProviderResponse: vi.fn(() => ({ kind: 'success', request: null })),
      execute: vi.fn(async (executionRequest) => {
        executedTools.push(executionRequest.toolName)

        if (executionRequest.toolName === 'tool-error') {
          return createFailure('TOOL_EXECUTION_FAILED', 'Runtime failure')
        }

        return createSuccessExecution(executionRequest.toolName, { ok: true })
      }),
    }

    const orchestrator = createConversationOrchestrator({ toolResolver: resolver, toolExecutor: executor })
    const request = createConversationOrchestratorRequest({
      executionId: 'conversation-orchestration:continuity',
      context: createContext(),
      steps: [
        { stepId: 'step-1', order: 1, toolId: 'tool-error', arguments: {} },
        { stepId: 'step-2', order: 2, toolId: 'missing-tool', arguments: {} },
        { stepId: 'step-3', order: 3, toolId: 'tool-ok', arguments: {} },
      ],
    })

    expect(request.kind).toBe('success')
    if (request.kind !== 'success') {
      throw new Error('Expected valid request')
    }

    const result = await orchestrator.execute(request.request)
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('Expected orchestrator success')
    }

    expect(result.result.status).toBe('partial-failure')
    expect(result.result.summary).toEqual({
      totalSteps: 3,
      successfulSteps: 1,
      failedSteps: 2,
    })
    expect(result.result.steps.map((step) => step.kind)).toEqual(['failure', 'failure', 'success'])
    expect(executedTools).toEqual(['tool-error', 'tool-ok'])
  })

  it('fails closed on invalid conversation request structure', async () => {
    const resolver: AIToolResolver = {
      resolve: vi.fn(() => ({ kind: 'success', tool: createResolvedTool('tool_x') })),
      exists: vi.fn(() => true),
      listDefinitions: vi.fn(() => []),
    }

    const executor: AIToolExecutor = {
      resolveRequestFromProviderResponse: vi.fn(() => ({ kind: 'success', request: null })),
      execute: vi.fn(async () => createSuccessExecution('tool_x', { ok: true })),
    }

    const orchestrator = createConversationOrchestrator({ toolResolver: resolver, toolExecutor: executor })
    const invalidRequest = {
      protocolVersion: 1,
      executionId: 'conversation-orchestration:invalid',
      context: createContext(),
      steps: [
        { stepId: 'step-1', order: 1, toolId: 'tool_x', arguments: {} },
        { stepId: 'step-2', order: 3, toolId: 'tool_x', arguments: {} },
      ],
    } as AIConversationOrchestratorRequest

    const result = await orchestrator.execute(invalidRequest)
    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('INVALID_ARGUMENTS')
    }

    expect(resolver.resolve).not.toHaveBeenCalled()
    expect(executor.execute).not.toHaveBeenCalled()
  })

  it('integrates with financial resolver factory and rejects non-catalog tool ids', async () => {
    const registry = createAIToolRegistry([createPingTool()])
    const registration = registerFinancialToolsCatalog(registry)
    expect(registration.kind).toBe('success')

    const orchestrator = createFinancialConversationOrchestrator({ registry })
    const request = createConversationOrchestratorRequest({
      executionId: 'conversation-orchestration:financial-scope',
      context: createContext(),
      steps: [
        {
          stepId: 'step-1',
          order: 1,
          toolId: 'ping',
          arguments: {},
        },
      ],
    })

    expect(request.kind).toBe('success')
    if (request.kind !== 'success') {
      throw new Error('Expected valid request')
    }

    const result = await orchestrator.execute(request.request)
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('Expected orchestrator success')
    }

    expect(result.result.status).toBe('partial-failure')
    expect(result.result.steps[0]?.kind).toBe('failure')
    if (result.result.steps[0]?.kind === 'failure') {
      expect(result.result.steps[0].error.code).toBe('TOOL_NOT_FOUND')
    }
  })

  it('exports public orchestrator APIs and keeps provider-neutral dependencies', async () => {
    const module = await import('../src/intelligence/conversation-orchestrator')
    expect(typeof module.createConversationOrchestrator).toBe('function')
    expect(typeof module.createFinancialConversationOrchestrator).toBe('function')
    expect(typeof module.createConversationOrchestratorRequest).toBe('function')
    expect(typeof module.validateConversationOrchestratorRequest).toBe('function')

    const source = readFileSync(
      resolve(process.cwd(), 'src/intelligence/conversation-orchestrator/conversationOrchestrator.ts'),
      'utf8',
    )

    expect(source).not.toContain("from '../provider'")
    expect(source).not.toContain('OpenAI')
    expect(source).not.toContain('Gemini')
    expect(source).not.toContain('Claude')
  })
})
