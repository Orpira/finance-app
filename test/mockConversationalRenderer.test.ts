import { describe, expect, it } from 'vitest'

import {
  createMockConversationalRenderer,
  validateChatMessage,
  validateMockConversationalRendererResult,
} from '../src/intelligence/mock-conversational-renderer/mockConversationalRenderer'
import type {
  AIConversationExecutionResult,
} from '../src/intelligence/conversation-orchestrator'
import { createPromptContextBuilder } from '../src/intelligence/prompt-context-builder'
import { createConversationResponseComposer } from '../src/intelligence/response-composer'

function createExecutionResult(input: {
  readonly toolId: string
  readonly output: unknown
  readonly kind?: 'success' | 'failure'
  readonly safeMessage?: string
}): AIConversationExecutionResult {
  if (input.kind === 'failure') {
    return {
      executionId: 'conversation-orchestration:renderer-failure' as AIConversationExecutionResult['executionId'],
      startedAt: '2026-07-24T12:00:00.000Z',
      finishedAt: '2026-07-24T12:00:01.000Z',
      status: 'partial-failure',
      summary: {
        totalSteps: 1,
        successfulSteps: 0,
        failedSteps: 1,
      },
      steps: [
        {
          kind: 'failure',
          stepId: 'step-1',
          order: 1,
          toolId: input.toolId,
          error: {
            kind: 'failure',
            code: 'TOOL_NOT_FOUND',
            retryable: false,
            safeMessage: input.safeMessage ?? 'Tool missing.',
          },
        },
      ],
    }
  }

  return {
    executionId: 'conversation-orchestration:renderer-success' as AIConversationExecutionResult['executionId'],
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
        toolId: input.toolId,
        resolvedToolName: input.toolId,
        execution: {
          toolName: input.toolId,
          output: input.output as never,
          permission: 'read-only',
          durationMs: 1,
        },
      },
    ],
  }
}

function createResponseFromExecution(execution: AIConversationExecutionResult) {
  const promptContextResult = createPromptContextBuilder().build({
    executionResult: execution,
  })

  if (promptContextResult.kind !== 'success') {
    throw new Error('Expected valid prompt context fixture')
  }

  const responseResult = createConversationResponseComposer().build({
    promptContext: promptContextResult.context,
  })

  if (responseResult.kind !== 'success') {
    throw new Error('Expected valid conversation response fixture')
  }

  return responseResult.response
}

describe('Mock Conversational Renderer (PB-IS-013.7)', () => {
  it('render Balance', () => {
    const renderer = createMockConversationalRenderer()
    const response = createResponseFromExecution(createExecutionResult({
      toolId: 'financial_balance',
      output: {
        summary: {
          netBalance: 1234,
        },
      },
    }))

    const result = renderer.render(response)
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('Expected successful render')
    }

    expect(result.message.text).toBe('Tu balance disponible es de $1234.')
  })

  it('render Transactions', () => {
    const renderer = createMockConversationalRenderer()
    const response = createResponseFromExecution(createExecutionResult({
      toolId: 'financial_transactions',
      output: {
        summary: {
          matchedCount: 3,
        },
      },
    }))

    const result = renderer.render(response)
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('Expected successful render')
    }

    expect(result.message.text).toBe('Encontré 3 transacciones.')
  })

  it('render Budget', () => {
    const renderer = createMockConversationalRenderer()
    const response = createResponseFromExecution(createExecutionResult({
      toolId: 'financial_budget',
      output: {
        summary: {
          budgetCount: 2,
        },
      },
    }))

    const result = renderer.render(response)
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('Expected successful render')
    }

    expect(result.message.text).toBe('Se encontraron 2 presupuestos.')
  })

  it('render Goals', () => {
    const renderer = createMockConversationalRenderer()
    const response = createResponseFromExecution(createExecutionResult({
      toolId: 'financial_goals',
      output: {
        summary: {
          goalCount: 4,
        },
      },
    }))

    const result = renderer.render(response)
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('Expected successful render')
    }

    expect(result.message.text).toBe('Actualmente tienes 4 objetivos financieros.')
  })

  it('render Reports', () => {
    const renderer = createMockConversationalRenderer()
    const response = createResponseFromExecution(createExecutionResult({
      toolId: 'financial_reports',
      output: {
        summary: {
          sectionCount: 5,
        },
      },
    }))

    const result = renderer.render(response)
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('Expected successful render')
    }

    expect(result.message.text).toBe('Hay 5 reportes disponibles.')
  })

  it('render Insights', () => {
    const renderer = createMockConversationalRenderer()
    const response = createResponseFromExecution(createExecutionResult({
      toolId: 'financial_insights',
      output: {
        summary: {
          rowCount: 6,
        },
      },
    }))

    const result = renderer.render(response)
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('Expected successful render')
    }

    expect(result.message.text).toBe('Se generaron 6 insights financieros.')
  })

  it('render Error', () => {
    const renderer = createMockConversationalRenderer()
    const response = createResponseFromExecution(createExecutionResult({
      toolId: 'financial_balance',
      output: null,
      kind: 'failure',
      safeMessage: 'No se pudo resolver la herramienta.',
    }))

    const result = renderer.render(response)
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('Expected controlled error render')
    }

    expect(result.message.type).toBe('error')
    expect(result.message.text).toContain('No fue posible completar la consulta.')
    expect(result.message.text).toContain('No se pudo resolver la herramienta.')
  })

  it('serialización y validator', () => {
    const renderer = createMockConversationalRenderer()
    const response = createResponseFromExecution(createExecutionResult({
      toolId: 'financial_transactions',
      output: {
        summary: {
          matchedCount: 1,
        },
      },
    }))

    const result = renderer.render(response)
    expect(validateMockConversationalRendererResult(result)).toBeNull()
    if (result.kind !== 'success') {
      throw new Error('Expected successful render')
    }

    expect(validateChatMessage(result.message)).toBeNull()

    const serialized = JSON.stringify(result.message)
    const parsed = JSON.parse(serialized) as { text: string; origin: string }
    expect(parsed.text).toBe('Encontré 1 transacción.')
    expect(parsed.origin).toBe('MOCK_RENDERER')
  })

  it('factory fail-closed para reglas inválidas', () => {
    const renderer = createMockConversationalRenderer({
      rules: [
        {
          ruleId: 'duplicated-tool',
          toolIds: ['financial_balance'],
          render: () => 'A',
        },
        {
          ruleId: 'duplicated-tool-2',
          toolIds: ['financial_balance'],
          render: () => 'B',
        },
      ],
    })

    const response = createResponseFromExecution(createExecutionResult({
      toolId: 'financial_balance',
      output: {
        summary: {
          netBalance: 50,
        },
      },
    }))

    const result = renderer.render(response)
    expect(result.kind).toBe('failure')
    if (result.kind !== 'failure') {
      throw new Error('Expected fail-closed result')
    }

    expect(result.code).toBe('INVALID_RENDER_RULES')
  })
})
